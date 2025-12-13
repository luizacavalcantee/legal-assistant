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
