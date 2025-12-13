import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

export class EmbeddingService {
  private openai: OpenAI;
  private provider: "openai" | "openrouter";
  private model: string;

  constructor() {
    this.provider = (process.env.LLM_PROVIDER || "openrouter").toLowerCase() as
      | "openai"
      | "openrouter";

    let apiKey: string | undefined;

    if (this.provider === "openrouter") {
      apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    } else {
      apiKey = process.env.OPENAI_API_KEY;
    }

    if (!apiKey && this.provider === "openai") {
      throw new Error(
        "OPENAI_API_KEY não está definida para gerar embeddings"
      );
    }

    const baseURL =
      this.provider === "openrouter"
        ? "https://openrouter.ai/api/v1"
        : undefined;

    const defaultHeaders: Record<string, string> = {};
    if (this.provider === "openrouter") {
      defaultHeaders["HTTP-Referer"] =
        process.env.OPENROUTER_HTTP_REFERER || "http://localhost:3000";
      defaultHeaders["X-Title"] =
        process.env.OPENROUTER_SITE_NAME || "Assistente Jurídico Inteligente";
    }

    this.openai = new OpenAI({
      apiKey: apiKey || "sk-or-v1-placeholder",
      baseURL: baseURL,
      defaultHeaders: Object.keys(defaultHeaders).length > 0 ? defaultHeaders : undefined,
    });

    // Modelos de embedding disponíveis
    // OpenAI: text-embedding-3-small (1536 dims), text-embedding-3-large (3072 dims)
    // OpenRouter: text-embedding-3-small, text-embedding-ada-002 (1536 dims)
    if (this.provider === "openrouter") {
      this.model =
        process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small";
    } else {
      this.model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
    }
  }

  /**
   * Gera embedding (vetor) para um texto
   * @param text - Texto para gerar embedding
   * @returns Array de números representando o vetor
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Limitar tamanho do texto (modelos têm limites)
      const maxLength = 8000; // Limite seguro para embeddings
      const truncatedText = text.slice(0, maxLength);

      const response = await this.openai.embeddings.create({
        model: this.model,
        input: truncatedText,
      });

      const embedding = response.data[0]?.embedding;

      if (!embedding) {
        throw new Error("Resposta vazia do serviço de embedding");
      }

      return embedding;
    } catch (error: any) {
      console.error("Erro ao gerar embedding:", error);

      if (error instanceof OpenAI.APIError) {
        throw new Error(
          `Erro na API de embedding: ${error.message} (Status: ${error.status})`
        );
      }

      throw new Error(
        `Erro ao gerar embedding: ${error.message}`
      );
    }
  }

  /**
   * Gera embeddings para múltiplos textos (batch)
   * @param texts - Array de textos
   * @returns Array de vetores
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const truncatedTexts = texts.map((text) => text.slice(0, 8000));

      const response = await this.openai.embeddings.create({
        model: this.model,
        input: truncatedTexts,
      });

      return response.data.map((item) => item.embedding);
    } catch (error: any) {
      console.error("Erro ao gerar embeddings em batch:", error);
      throw new Error(
        `Erro ao gerar embeddings em batch: ${error.message}`
      );
    }
  }

  /**
   * Retorna a dimensão do embedding baseado no modelo
   */
  getEmbeddingDimension(): number {
    // text-embedding-3-small: 1536
    // text-embedding-3-large: 3072
    // text-embedding-ada-002: 1536
    if (this.model.includes("large")) {
      return 3072;
    }
    return 1536;
  }
}

