import { VectorStore } from "@langchain/core/vectorstores";
import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { QdrantClient } from "../qdrant";
import { EmbeddingService } from "../../services/EmbeddingService";

/**
 * Adaptador para usar Qdrant como VectorStore do LangChain
 */
export class QdrantVectorStore extends VectorStore {
  private qdrantClient: QdrantClient;
  private embeddingService: EmbeddingService;
  private collectionName: string;

  constructor(
    qdrantClient: QdrantClient,
    embeddingService: EmbeddingService,
    embeddings: Embeddings
  ) {
    super(embeddings, {});
    this.qdrantClient = qdrantClient;
    this.embeddingService = embeddingService;
    this.collectionName =
      process.env.QDRANT_COLLECTION_NAME || "knowledge_base";
    
    // Garantir que o método _vectorstoreType existe
    if (!this._vectorstoreType) {
      (this as any)._vectorstoreType = () => "qdrant";
    }
  }

  /**
   * Método obrigatório do VectorStore
   * Retorna o tipo do vector store
   */
  _vectorstoreType(): string {
    return "qdrant";
  }

  /**
   * Adiciona documentos ao vector store (não usado diretamente, já temos indexação)
   */
  async addDocuments(documents: Document[]): Promise<string[]> {
    // Não implementado - usamos a indexação existente
    throw new Error(
      "Use a indexação via DocumentService ao invés de addDocuments"
    );
  }

  /**
   * Adiciona vetores ao vector store (não usado diretamente)
   */
  async addVectors(vectors: number[][], documents: Document[]): Promise<string[]> {
    // Não implementado - usamos a indexação existente
    throw new Error(
      "Use a indexação via DocumentService ao invés de addVectors"
    );
  }

  /**
   * Busca documentos similares usando busca vetorial
   */
  async similaritySearch(
    query: string,
    k: number = 4,
    filter?: any
  ): Promise<Document[]> {
    try {
      // Gerar embedding da query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      // Buscar no Qdrant
      const results = await this.qdrantClient.searchSimilar(
        queryEmbedding,
        k,
        filter
      );

      // Converter resultados em Documentos do LangChain
      const documents: Document[] = results.map((result: any) => {
        const payload = result.payload || {};
        return new Document({
          pageContent: payload.text || "",
          metadata: {
            document_id: payload.document_id || "",
            chunk_index: payload.chunk_index || 0,
            titulo: payload.titulo || "",
            score: result.score || 0,
          },
        });
      });

      return documents;
    } catch (error: any) {
      console.error("Erro na busca de similaridade:", error);
      throw new Error(`Falha na busca de similaridade: ${error.message}`);
    }
  }

  /**
   * Busca com scores (similaridade)
   */
  async similaritySearchWithScore(
    query: string,
    k: number = 4,
    filter?: any
  ): Promise<[Document, number][]> {
    try {
      // Gerar embedding da query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      // Buscar no Qdrant
      const results = await this.qdrantClient.searchSimilar(
        queryEmbedding,
        k,
        filter
      );

      // Converter resultados em tuplas [Document, score]
      const documentsWithScores: [Document, number][] = results.map(
        (result: any) => {
          const payload = result.payload || {};
          const document = new Document({
            pageContent: payload.text || "",
            metadata: {
              document_id: payload.document_id || "",
              chunk_index: payload.chunk_index || 0,
              titulo: payload.titulo || "",
              score: result.score || 0,
            },
          });
          return [document, result.score || 0];
        }
      );

      return documentsWithScores;
    } catch (error: any) {
      console.error("Erro na busca de similaridade com score:", error);
      throw new Error(
        `Falha na busca de similaridade com score: ${error.message}`
      );
    }
  }

  /**
   * Busca por vetor (usado internamente)
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: any
  ): Promise<[Document, number][]> {
    try {
      // Buscar no Qdrant
      const results = await this.qdrantClient.searchSimilar(query, k, filter);

      // Converter resultados
      const documentsWithScores: [Document, number][] = results.map(
        (result: any) => {
          const payload = result.payload || {};
          const document = new Document({
            pageContent: payload.text || "",
            metadata: {
              document_id: payload.document_id || "",
              chunk_index: payload.chunk_index || 0,
              titulo: payload.titulo || "",
              score: result.score || 0,
            },
          });
          return [document, result.score || 0];
        }
      );

      return documentsWithScores;
    } catch (error: any) {
      console.error("Erro na busca por vetor:", error);
      throw new Error(`Falha na busca por vetor: ${error.message}`);
    }
  }
}

