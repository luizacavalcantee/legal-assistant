import OpenAI from "openai";
import { LLMProvider } from "./LLMConfigService";

/**
 * Serviço responsável por tratar erros da API do OpenAI/OpenRouter
 */
export class LLMErrorHandler {
  constructor(private provider: LLMProvider) {}

  /**
   * Trata erros da API OpenAI/OpenRouter
   * @param error - Erro capturado
   * @param context - Contexto da operação (para logging)
   * @throws Error com mensagem amigável
   */
  handleError(error: any, context: string): never {
    console.error(`Erro ao ${context}:`, error);

    if (error instanceof OpenAI.APIError) {
      // Erro 401 - Autenticação
      if (error.status === 401) {
        throw new Error(this.getAuthenticationError(error.message));
      }

      // Erro 429 - Rate limit / Quota
      if (error.status === 429) {
        throw new Error(this.getQuotaError(error.message));
      }

      // Outros erros da API
      throw new Error(
        `Erro na API do ${this.getProviderName()}: ${error.message} (Status: ${
          error.status
        })`
      );
    }

    // Erro genérico
    throw new Error(
      `Falha ao ${context}: ${error.message || "Erro desconhecido"}`
    );
  }

  /**
   * Retorna mensagem de erro de autenticação
   */
  private getAuthenticationError(errorMessage: string): string {
    if (this.provider === "openrouter") {
      return (
        `AUTENTICACAO_FALHOU: API key inválida ou não encontrada no OpenRouter. ` +
        `Certifique-se de usar uma chave válida do OpenRouter (começa com 'sk-or-v1-'). ` +
        `Obtenha uma chave gratuita em: https://openrouter.ai/keys ` +
        `Erro original: ${errorMessage}`
      );
    } else {
      return (
        `AUTENTICACAO_FALHOU: API key inválida ou não encontrada. ` +
        `Verifique se OPENAI_API_KEY está correta no arquivo .env. ` +
        `Erro original: ${errorMessage}`
      );
    }
  }

  /**
   * Retorna mensagem de erro de quota/rate limit
   */
  private getQuotaError(errorMessage: string): string {
    if (this.provider === "openrouter") {
      return (
        `QUOTA_EXCEDIDA: Limite de requisições diárias excedido no OpenRouter. ` +
        `O plano gratuito permite 50 requisições por dia. ` +
        `Adicione créditos em: https://openrouter.ai/credits ou aguarde o reset diário. ` +
        `Para obter uma API key gratuita: https://openrouter.ai/keys`
      );
    } else {
      return (
        `QUOTA_EXCEDIDA: Limite de requisições excedido na OpenAI. ` +
        `Verifique seu plano e limites em: https://platform.openai.com/usage ` +
        `Erro original: ${errorMessage}`
      );
    }
  }

  /**
   * Retorna o nome amigável do provedor
   */
  private getProviderName(): string {
    return this.provider === "openrouter" ? "OpenRouter" : "OpenAI";
  }
}
