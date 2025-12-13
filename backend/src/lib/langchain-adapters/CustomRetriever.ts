import { BaseRetriever } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import { QdrantVectorStore } from "./QdrantVectorStore";

/**
 * Retriever customizado para QdrantVectorStore
 */
export class CustomRetriever extends BaseRetriever {
  private vectorStore: QdrantVectorStore;
  private k: number;

  constructor(vectorStore: QdrantVectorStore, k: number = 5) {
    super({});
    this.vectorStore = vectorStore;
    this.k = k;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    try {
      return await this.vectorStore.similaritySearch(query, this.k);
    } catch (error: any) {
      console.error("Erro no retriever:", error);
      throw new Error(`Falha no retriever: ${error.message}`);
    }
  }
}

