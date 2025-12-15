import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

export class LLMService {
  private openai: OpenAI;
  private systemPrompt: string;
  private provider: "openai" | "openrouter";
  private model: string;

  constructor() {
    // Determinar qual provedor usar
    this.provider = (process.env.LLM_PROVIDER || "openrouter").toLowerCase() as
      | "openai"
      | "openrouter";

    // Configurar API key baseado no provedor
    let apiKey: string | undefined;

    if (this.provider === "openrouter") {
      // Aceitar OPENROUTER_API_KEY ou OPENAI_API_KEY (para compatibilidade)
      apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        // OpenRouter permite uso sem API key para modelos gratuitos
        // Mas é recomendado ter uma key para melhor rate limiting
        console.warn(
          "⚠️  OPENROUTER_API_KEY ou OPENAI_API_KEY não definida. " +
            "Alguns modelos podem ter rate limits mais restritos. " +
            "Obtenha uma key gratuita em: https://openrouter.ai/keys"
        );
      } else {
        // Verificar se a chave parece ser do OpenRouter (começa com sk-or-v1-)
        if (apiKey.startsWith("sk-or-v1-")) {
          console.log("✅ Usando API key do OpenRouter");
        } else {
          console.warn(
            "⚠️  API key não parece ser do OpenRouter (deve começar com 'sk-or-v1-'). " +
              "Certifique-se de usar uma chave válida do OpenRouter em: https://openrouter.ai/keys"
          );
        }
      }
    } else {
      apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "OPENAI_API_KEY não está definida no arquivo .env\n" +
            "Por favor, adicione ao arquivo backend/.env:\n" +
            '  OPENAI_API_KEY="sk-sua-chave-aqui"\n\n' +
            "Obtenha sua API key em: https://platform.openai.com/api-keys\n" +
            "OU use OpenRouter (gratuito) configurando:\n" +
            '  LLM_PROVIDER="openrouter"\n' +
            '  LLM_MODEL="meta-llama/llama-3.3-70b-instruct:free"'
        );
      }
    }

    // Configurar cliente OpenAI (compatível com OpenRouter)
    const baseURL =
      this.provider === "openrouter"
        ? "https://openrouter.ai/api/v1"
        : undefined;

    // Configurar headers para OpenRouter conforme documentação oficial
    // HTTP-Referer e X-Title são recomendados para rankings no OpenRouter
    // Devem ser enviados sempre quando usar OpenRouter (com ou sem API key)
    const defaultHeaders: Record<string, string> = {};

    if (this.provider === "openrouter") {
      defaultHeaders["HTTP-Referer"] =
        process.env.OPENROUTER_HTTP_REFERER || "http://localhost:3000";
      defaultHeaders["X-Title"] =
        process.env.OPENROUTER_SITE_NAME || "Assistente Jurídico Inteligente";
    }

    this.openai = new OpenAI({
      apiKey: apiKey || "sk-or-v1-placeholder", // Placeholder se não tiver key
      baseURL: baseURL,
      // O SDK da OpenAI automaticamente adiciona "Bearer " ao apiKey no header Authorization
      // Os headers HTTP-Referer e X-Title são adicionados conforme documentação do OpenRouter
      defaultHeaders:
        Object.keys(defaultHeaders).length > 0 ? defaultHeaders : undefined,
    });

    // Configurar modelo baseado no provedor
    if (this.provider === "openrouter") {
      // Modelos gratuitos recomendados do OpenRouter
      // tngtech/deepseek-r1t-chimera:free - DeepSeek R1T Chimera (gratuito)
      // meta-llama/llama-3.3-70b-instruct:free - Llama 3.3 70B (gratuito)
      // google/gemini-flash-1.5:free - Gemini Flash (gratuito)
      // microsoft/phi-3.5-mini-128k-instruct:free - Phi-3.5 Mini (gratuito)
      this.model = process.env.LLM_MODEL || "tngtech/deepseek-r1t-chimera:free";
    } else {
      this.model = process.env.LLM_MODEL || "gpt-3.5-turbo";
    }

    this.systemPrompt =
      "Você é um assistente jurídico inteligente. Sempre responda de forma concisa, útil e precisa sobre questões jurídicas. Se não tiver certeza sobre algo, seja honesto e indique que é necessário consultar um advogado para orientação específica.";
  }

  /**
   * Gera um resumo de processo judicial a partir das movimentações extraídas
   * @param movementsText - Texto completo das movimentações/andamentos do processo
   * @returns Resumo gerado pelo LLM
   */
  async summarizeProcess(movementsText: string): Promise<string> {
    try {
      const prompt = `Você é um assistente jurídico especializado em análise de processos judiciais. 

Analise as movimentações/andamentos do processo abaixo e gere um resumo conciso, estruturado e profissional em português brasileiro.

**Instruções:**
1. Identifique o **status geral do processo** (em andamento, julgado, arquivado, suspenso, etc.)
2. Identifique a **fase processual** em que se encontra (conhecimento, execução, cumprimento de sentença, etc.)
3. Destaque **decisões relevantes**, sentenças, despachos importantes e seus efeitos
4. Identifique **partes envolvidas** (requerente, requerido, advogados) quando disponível
5. Mencione **prazos importantes**, eventos recentes significativos e próximos passos processuais
6. Seja objetivo, preciso e use linguagem jurídica apropriada, mas acessível
7. Se não houver informações suficientes sobre algum aspecto, indique claramente

**Formato do Resumo (obrigatório):**
- **Status:** [status do processo]
- **Fase:** [fase processual atual]
- **Resumo:** [resumo narrativo das principais movimentações, decisões e contexto do processo]
- **Últimas Movimentações:** [últimas 2-3 movimentações relevantes com datas]

**Movimentações do Processo:**
${movementsText}

Gere o resumo agora seguindo exatamente o formato especificado:`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: this.systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3, // Temperatura mais baixa para resumos mais consistentes
        max_tokens: 1500, // Limite adequado para resumos
      });

      const summary = completion.choices[0]?.message?.content || "";

      if (!summary || summary.trim().length === 0) {
        throw new Error("Resposta vazia do LLM ao gerar resumo");
      }

      return summary.trim();
    } catch (error: any) {
      console.error("Erro ao gerar resumo do processo:", error);

      if (error instanceof OpenAI.APIError) {
        // Tratamento específico para erro 401 (autenticação)
        if (error.status === 401) {
          if (this.provider === "openrouter") {
            throw new Error(
              `AUTENTICACAO_FALHOU: API key inválida ou não encontrada no OpenRouter. ` +
                `Certifique-se de usar uma chave válida do OpenRouter (começa com 'sk-or-v1-'). ` +
                `Obtenha uma chave gratuita em: https://openrouter.ai/keys ` +
                `Erro original: ${error.message}`
            );
          } else {
            throw new Error(
              `AUTENTICACAO_FALHOU: API key inválida ou não encontrada. ` +
                `Verifique se OPENAI_API_KEY está correta no arquivo .env. ` +
                `Erro original: ${error.message}`
            );
          }
        }
      }

      throw error;
    }
  }

  /**
   * Responde uma pergunta específica sobre o conteúdo de um documento
   * @param question - Pergunta do usuário sobre o documento
   * @param documentText - Texto completo do documento
   * @param documentType - Tipo do documento (ex: "sentença", "petição inicial")
   * @param protocolNumber - Número do protocolo do processo
   * @returns Resposta gerada pelo LLM baseada no conteúdo do documento
   */
  async answerDocumentQuestion(
    question: string,
    documentText: string,
    documentType?: string,
    protocolNumber?: string
  ): Promise<string> {
    try {
      const documentContext = documentType
        ? `Documento: ${documentType}${
            protocolNumber ? ` do processo ${protocolNumber}` : ""
          }`
        : protocolNumber
        ? `Documento do processo ${protocolNumber}`
        : "Documento";

      const prompt = `Você é um assistente jurídico especializado em análise de documentos processuais.

O usuário fez uma pergunta específica sobre o conteúdo de um documento. Use APENAS as informações fornecidas no texto do documento abaixo para responder à pergunta.

**${documentContext}**

**Pergunta do usuário:**
${question}

**Texto do documento:**
${documentText}

**Instruções:**
1. Responda a pergunta do usuário de forma clara e precisa
2. Use APENAS informações presentes no texto do documento fornecido
3. Se a resposta não estiver no documento, diga honestamente que não foi possível encontrar a informação solicitada
4. Cite trechos relevantes do documento quando apropriado
5. Use linguagem jurídica apropriada, mas acessível
6. Seja objetivo e direto

**Resposta:`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: this.systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3, // Temperatura baixa para respostas mais precisas
        max_tokens: 2000, // Limite adequado para respostas detalhadas
      });

      const answer = completion.choices[0]?.message?.content || "";

      if (!answer || answer.trim().length === 0) {
        throw new Error(
          "Resposta vazia do LLM ao responder pergunta sobre documento"
        );
      }

      return answer.trim();
    } catch (error: any) {
      console.error("Erro ao responder pergunta sobre documento:", error);

      if (error instanceof OpenAI.APIError) {
        // Tratamento específico para erro 401 (autenticação)
        if (error.status === 401) {
          if (this.provider === "openrouter") {
            throw new Error(
              `AUTENTICACAO_FALHOU: API key inválida ou não encontrada no OpenRouter. ` +
                `Certifique-se de usar uma chave válida do OpenRouter (começa com 'sk-or-v1-'). ` +
                `Obtenha uma chave gratuita em: https://openrouter.ai/keys ` +
                `Erro original: ${error.message}`
            );
          } else {
            throw new Error(
              `AUTENTICACAO_FALHOU: API key inválida ou não encontrada. ` +
                `Verifique se OPENAI_API_KEY está correta no arquivo .env. ` +
                `Erro original: ${error.message}`
            );
          }
        }

        // Tratamento específico para erro 429 (quota excedida)
        if (error.status === 429) {
          if (this.provider === "openrouter") {
            throw new Error(
              `QUOTA_EXCEDIDA: Rate limit excedido no OpenRouter. ` +
                `Aguarde alguns minutos ou obtenha uma API key gratuita em: https://openrouter.ai/keys ` +
                `Para mais informações: https://openrouter.ai/docs`
            );
          } else {
            throw new Error(
              `QUOTA_EXCEDIDA: Você excedeu sua cota atual da OpenAI. ` +
                `Por favor, verifique seu plano e detalhes de faturamento. ` +
                `Acesse: https://platform.openai.com/account/billing ` +
                `Para mais informações: https://platform.openai.com/docs/guides/error-codes/api-errors`
            );
          }
        }

        // Tratamento para outros erros da API
        throw new Error(
          `Erro na API do ${
            this.provider === "openrouter" ? "OpenRouter" : "OpenAI"
          }: ${error.message} (Status: ${error.status})`
        );
      }

      if (error instanceof OpenAI.APIError) {
        // Tratamento específico para erro 401 (autenticação)
        if (error.status === 401) {
          if (this.provider === "openrouter") {
            throw new Error(
              `AUTENTICACAO_FALHOU: API key inválida ou não encontrada no OpenRouter. ` +
                `Certifique-se de usar uma chave válida do OpenRouter (começa com 'sk-or-v1-'). ` +
                `Obtenha uma chave gratuita em: https://openrouter.ai/keys ` +
                `Erro original: ${error.message}`
            );
          } else {
            throw new Error(
              `AUTENTICACAO_FALHOU: API key inválida ou não encontrada. ` +
                `Verifique se OPENAI_API_KEY está correta no arquivo .env. ` +
                `Erro original: ${error.message}`
            );
          }
        }

        // Tratamento específico para erro 429 (quota excedida)
        if (error.status === 429) {
          if (this.provider === "openrouter") {
            throw new Error(
              `QUOTA_EXCEDIDA: Rate limit excedido no OpenRouter. ` +
                `Aguarde alguns minutos ou obtenha uma API key gratuita em: https://openrouter.ai/keys ` +
                `Para mais informações: https://openrouter.ai/docs`
            );
          } else {
            throw new Error(
              `QUOTA_EXCEDIDA: Você excedeu sua cota atual da OpenAI. ` +
                `Por favor, verifique seu plano e detalhes de faturamento. ` +
                `Acesse: https://platform.openai.com/account/billing ` +
                `Para mais informações: https://platform.openai.com/docs/guides/error-codes/api-errors`
            );
          }
        }

        // Tratamento para outros erros da API
        throw new Error(
          `Erro na API do ${
            this.provider === "openrouter" ? "OpenRouter" : "OpenAI"
          }: ${error.message} (Status: ${error.status})`
        );
      }

      throw new Error(
        `Falha ao responder pergunta sobre documento: ${
          error.message || "Erro desconhecido"
        }`
      );
    }
  }

  /**
   * Gera uma resposta do LLM baseada na mensagem do usuário
   * @param message - Mensagem do usuário
   * @returns Resposta gerada pelo LLM
   */
  async generateResponse(message: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: this.systemPrompt,
          },
          {
            role: "user",
            content: message,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const response = completion.choices[0]?.message?.content;

      if (!response) {
        throw new Error("Resposta vazia do modelo de linguagem");
      }

      return response;
    } catch (error: any) {
      console.error("Erro ao gerar resposta do LLM:", error);

      if (error instanceof OpenAI.APIError) {
        // Tratamento específico para erro 401 (autenticação)
        if (error.status === 401) {
          if (this.provider === "openrouter") {
            throw new Error(
              `AUTENTICACAO_FALHOU: API key inválida ou não encontrada no OpenRouter. ` +
                `Certifique-se de usar uma chave válida do OpenRouter (começa com 'sk-or-v1-'). ` +
                `Obtenha uma chave gratuita em: https://openrouter.ai/keys ` +
                `Erro original: ${error.message}`
            );
          } else {
            throw new Error(
              `AUTENTICACAO_FALHOU: API key inválida da OpenAI. ` +
                `Verifique se a chave está correta e ativa. ` +
                `Erro original: ${error.message}`
            );
          }
        }

        // Tratamento específico para erro 429 (quota excedida)
        if (error.status === 429) {
          if (this.provider === "openrouter") {
            throw new Error(
              `QUOTA_EXCEDIDA: Rate limit excedido no OpenRouter. ` +
                `Aguarde alguns minutos ou obtenha uma API key gratuita em: https://openrouter.ai/keys ` +
                `Para mais informações: https://openrouter.ai/docs`
            );
          } else {
            throw new Error(
              `QUOTA_EXCEDIDA: Você excedeu sua cota atual da OpenAI. ` +
                `Por favor, verifique seu plano e detalhes de faturamento. ` +
                `Acesse: https://platform.openai.com/account/billing ` +
                `Para mais informações: https://platform.openai.com/docs/guides/error-codes/api-errors`
            );
          }
        }

        // Tratamento para outros erros da API
        throw new Error(
          `Erro na API do ${
            this.provider === "openrouter" ? "OpenRouter" : "OpenAI"
          }: ${error.message} (Status: ${error.status})`
        );
      }

      throw new Error(
        `Erro ao comunicar com o modelo de linguagem: ${error.message}`
      );
    }
  }
}
