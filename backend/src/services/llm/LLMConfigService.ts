import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

export type LLMProvider = "openai" | "openrouter";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  model: string;
  baseURL?: string;
  defaultHeaders?: Record<string, string>;
}

/**
 * Serviço responsável por configurar o cliente OpenAI/OpenRouter
 */
export class LLMConfigService {
  private provider: LLMProvider;
  private apiKey?: string;
  private model: string;

  constructor() {
    this.provider = (
      process.env.LLM_PROVIDER || "openrouter"
    ).toLowerCase() as LLMProvider;
    this.model = this.getDefaultModel();
    this.apiKey = this.getApiKey();
  }

  /**
   * Retorna o modelo padrão baseado no provedor
   */
  private getDefaultModel(): string {
    if (this.provider === "openrouter") {
      return process.env.LLM_MODEL || "tngtech/deepseek-r1t-chimera:free";
    } else {
      return process.env.LLM_MODEL || "gpt-3.5-turbo";
    }
  }

  /**
   * Obtém e valida a API key
   */
  private getApiKey(): string | undefined {
    if (this.provider === "openrouter") {
      return this.getOpenRouterApiKey();
    } else {
      return this.getOpenAIApiKey();
    }
  }

  /**
   * Obtém API key do OpenRouter
   */
  private getOpenRouterApiKey(): string | undefined {
    const primaryKey =
      process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

    if (!primaryKey) {
      console.warn(
        "⚠️  OPENROUTER_API_KEY ou OPENAI_API_KEY não definida. " +
          "Alguns modelos podem ter rate limits mais restritos. " +
          "Obtenha uma key gratuita em: https://openrouter.ai/keys"
      );
      return undefined;
    }

    // Suporte para múltiplas chaves (separadas por vírgula)
    const apiKeys = primaryKey
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    const apiKey = apiKeys[0];

    if (apiKey.startsWith("sk-or-v1-")) {
      console.log("✅ Usando API key do OpenRouter");
    } else {
      console.warn(
        "⚠️  API key não parece ser do OpenRouter (deve começar com 'sk-or-v1-'). " +
          "Certifique-se de usar uma chave válida do OpenRouter em: https://openrouter.ai/keys"
      );
    }

    return apiKey;
  }

  /**
   * Obtém API key do OpenAI
   */
  private getOpenAIApiKey(): string {
    const apiKey = process.env.OPENAI_API_KEY;

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

    return apiKey;
  }

  /**
   * Retorna a configuração completa para criar o cliente OpenAI
   */
  getConfig(): LLMConfig {
    const config: LLMConfig = {
      provider: this.provider,
      apiKey: this.apiKey || "sk-or-v1-placeholder",
      model: this.model,
    };

    // Configurar baseURL para OpenRouter
    if (this.provider === "openrouter") {
      config.baseURL = "https://openrouter.ai/api/v1";

      // Headers recomendados pela documentação do OpenRouter
      config.defaultHeaders = {
        "HTTP-Referer":
          process.env.OPENROUTER_HTTP_REFERER || "http://localhost:3000",
        "X-Title":
          process.env.OPENROUTER_SITE_NAME || "Assistente Jurídico Inteligente",
      };
    }

    return config;
  }

  /**
   * Cria uma instância do cliente OpenAI configurado
   */
  createClient(): OpenAI {
    const config = this.getConfig();

    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      defaultHeaders: config.defaultHeaders,
    });
  }

  getProvider(): LLMProvider {
    return this.provider;
  }

  getModel(): string {
    return this.model;
  }
}
