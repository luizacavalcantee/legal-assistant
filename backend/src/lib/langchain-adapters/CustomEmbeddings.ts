import { Embeddings } from "@langchain/core/embeddings";
import { EmbeddingService } from "../../services/EmbeddingService";

/**
 * Adaptador para usar EmbeddingService como Embeddings do LangChain
 */
export class CustomEmbeddings extends Embeddings {
  private embeddingService: EmbeddingService;

  constructor(embeddingService: EmbeddingService) {
    super({});
    this.embeddingService = embeddingService;
  }

  /**
   * Gera embedding para um texto
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    try {
      return await this.embeddingService.generateEmbeddings(texts);
    } catch (error: any) {
      console.error("Erro ao gerar embeddings:", error);
      throw new Error(`Falha ao gerar embeddings: ${error.message}`);
    }
  }

  /**
   * Gera embedding para uma query
   */
  async embedQuery(text: string): Promise<number[]> {
    try {
      return await this.embeddingService.generateEmbedding(text);
    } catch (error: any) {
      console.error("Erro ao gerar embedding da query:", error);
      throw new Error(`Falha ao gerar embedding da query: ${error.message}`);
    }
  }
}

