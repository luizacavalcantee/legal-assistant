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
    // Suporte para múltiplas chaves (fallback automático)
    let apiKey: string | undefined;
    let apiKeys: string[] = [];

    if (this.provider === "openrouter") {
      // Aceitar OPENROUTER_API_KEY ou OPENAI_API_KEY (para compatibilidade)
      const primaryKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
      
      // Suporte para múltiplas chaves (separadas por vírgula)
      // Exemplo: OPENROUTER_API_KEY="sk-or-v1-key1,sk-or-v1-key2,sk-or-v1-key3"
      if (primaryKey) {
        apiKeys = primaryKey.split(",").map(k => k.trim()).filter(k => k.length > 0);
        apiKey = apiKeys[0]; // Usar primeira chave como padrão
      }
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
      const prompt = `Você é um analista jurídico especializado em análise de processos judiciais. 

Analise as movimentações/andamentos do processo abaixo e gere um resumo jurídico conciso, estruturado e profissional em português brasileiro.

**IMPORTANTE - Filtragem de Informações:**
- **FOCAR em eventos jurídicos relevantes:** citação, contestação, decisões, sentenças, recursos, audiências, perícias, intimação de partes
- **IGNORAR informações administrativas:** autuação, distribuição, juntada de documentos sem conteúdo jurídico relevante, movimentações puramente processuais sem impacto no mérito
- **PRIORIZAR decisões judiciais:** sentenças, despachos decisórios, acórdãos, decisões interlocutórias relevantes
- **DESTACAR eventos processuais significativos:** prazos importantes, recursos interpostos, julgamentos, suspensões, arquivamentos

**Instruções de Análise:**
1. Identifique o **Status Geral** do processo (em andamento, julgado, arquivado, suspenso, extinto, etc.)
2. Identifique a **Fase Processual Atual** (conhecimento, execução, cumprimento de sentença, etc.)
3. Destaque **Decisões Relevantes** com seus efeitos jurídicos (sentenças, acórdãos, decisões interlocutórias importantes)
4. Identifique **Partes Envolvidas** (requerente/autor, requerido/réu, advogados) quando disponível
5. Mencione **Eventos Jurídicos Significativos** (citações, contestações, recursos, audiências, perícias)
6. Seja objetivo, preciso e use linguagem jurídica apropriada, mas acessível
7. Se não houver informações suficientes sobre algum aspecto, indique claramente

**Formato do Resumo (obrigatório):**
- **Status:** [status geral do processo]
- **Fase:** [fase processual atual]
- **Decisões Relevantes:** [principais decisões judiciais, sentenças e seus efeitos]
- **Resumo:** [resumo narrativo focado nos eventos jurídicos mais relevantes, ignorando detalhes administrativos]

**Movimentações do Processo:**
${movementsText}

Gere o resumo agora seguindo exatamente o formato especificado, focando apenas em informações jurídicas relevantes:`;

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

      // Remover markdown (**, __, etc.) para exibição limpa
      return this.removeMarkdown(summary.trim());
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
        
        // Tratamento específico para erro 429 (rate limit)
        if (error.status === 429) {
          if (this.provider === "openrouter") {
            throw new Error(
              `QUOTA_EXCEDIDA: Limite de requisições diárias excedido no OpenRouter. ` +
                `O plano gratuito permite 50 requisições por dia. ` +
                `Adicione créditos em: https://openrouter.ai/credits ou aguarde o reset diário. ` +
                `Para obter uma API key gratuita: https://openrouter.ai/keys`
            );
          } else {
            throw new Error(
              `QUOTA_EXCEDIDA: Limite de requisições excedido na OpenAI. ` +
                `Verifique seu plano e limites em: https://platform.openai.com/usage ` +
                `Erro original: ${error.message}`
            );
          }
        }
      }

      throw error;
    }
  }

  /**
   * Gera um resumo estruturado de um documento específico de um processo
   * @param documentText - Texto completo do documento
   * @param documentType - Tipo do documento (ex: "sentença", "petição inicial")
   * @param protocolNumber - Número do protocolo do processo
   * @returns Resumo estruturado do documento
   */
  async summarizeDocument(
    documentText: string,
    documentType?: string,
    protocolNumber?: string
  ): Promise<string> {
    try {
      const documentContext = documentType
        ? `${documentType}${protocolNumber ? ` do processo ${protocolNumber}` : ""}`
        : protocolNumber
        ? `Documento do processo ${protocolNumber}`
        : "Documento";

      const prompt = `Você é um analista jurídico especializado em análise de documentos processuais.

Analise o documento abaixo e gere um resumo jurídico conciso, estruturado e profissional em português brasileiro.

**Documento:** ${documentContext}

**Instruções:**
1. Identifique o **tipo de documento** (sentença, petição inicial, despacho, etc.)
2. Identifique as **partes envolvidas** (autor, réu, requerente, requerido)
3. Destaque os **pedidos principais** (se for petição inicial) ou **decisão** (se for sentença/despacho)
4. Identifique **fundamentos jurídicos** relevantes mencionados
5. Mencione **prazos, valores ou condições** importantes quando aplicável
6. Seja objetivo, preciso e use linguagem jurídica apropriada, mas acessível

**Formato do Resumo (obrigatório):**
- **Tipo de Documento:** [tipo identificado]
- **Partes:** [partes envolvidas]
- **Conteúdo Principal:** [resumo do conteúdo principal - pedidos, decisão, etc.]
- **Fundamentos:** [fundamentos jurídicos mencionados, se houver]
- **Resumo Detalhado:** [resumo narrativo completo do documento]

**Texto do Documento:**
${documentText}

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
        max_tokens: 2000, // Limite adequado para resumos de documentos
      });

      const summary = completion.choices[0]?.message?.content || "";

      if (!summary || summary.trim().length === 0) {
        throw new Error("Resposta vazia do LLM ao gerar resumo do documento");
      }

      // Remover markdown (**, __, etc.) para exibição limpa
      return this.removeMarkdown(summary.trim());
    } catch (error: any) {
      console.error("Erro ao gerar resumo do documento:", error);

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
        
        // Tratamento específico para erro 429 (rate limit)
        if (error.status === 429) {
          if (this.provider === "openrouter") {
            throw new Error(
              `QUOTA_EXCEDIDA: Limite de requisições diárias excedido no OpenRouter. ` +
                `O plano gratuito permite 50 requisições por dia. ` +
                `Adicione créditos em: https://openrouter.ai/credits ou aguarde o reset diário. ` +
                `Para obter uma API key gratuita: https://openrouter.ai/keys`
            );
          } else {
            throw new Error(
              `QUOTA_EXCEDIDA: Limite de requisições excedido na OpenAI. ` +
                `Verifique seu plano e limites em: https://platform.openai.com/usage ` +
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

      // Remover markdown (**, __, etc.) para exibição limpa
      return this.removeMarkdown(answer.trim());
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

  /**
   * Remove formatação markdown do texto (**, __, etc.)
   * @param text - Texto com markdown
   * @returns Texto sem formatação markdown
   */
  private removeMarkdown(text: string): string {
    if (!text) return text;

    // Remover markdown de negrito (**texto** ou __texto__)
    let cleaned = text.replace(/\*\*([^*]+)\*\*/g, "$1");
    cleaned = cleaned.replace(/__([^_]+)__/g, "$1");
    
    // Remover markdown de itálico (*texto* ou _texto_)
    cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");
    cleaned = cleaned.replace(/_([^_]+)_/g, "$1");
    
    // Remover markdown de código (`código`)
    cleaned = cleaned.replace(/`([^`]+)`/g, "$1");
    
    // Remover markdown de links [texto](url)
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
    
    // Limpar espaços múltiplos que possam ter sido criados
    cleaned = cleaned.replace(/\s+/g, " ");
    
    return cleaned.trim();
  }
}
