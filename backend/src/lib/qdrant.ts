import { QdrantClient as QdrantClientSDK } from "@qdrant/js-client-rest";
import dotenv from "dotenv";

dotenv.config();

export class QdrantClient {
  private client: QdrantClientSDK;
  private collectionName: string;

  constructor() {
    const url = process.env.QDRANT_URL || "http://localhost:6333";
    const apiKey = process.env.QDRANT_API_KEY;

    const config: any = {
      url,
    };

    if (apiKey) {
      config.apiKey = apiKey;
    }

    this.client = new QdrantClientSDK(config);

    this.collectionName = process.env.QDRANT_COLLECTION_NAME || "knowledge_base";
  }

  /**
   * Inicializa a coleção no Qdrant (cria se não existir)
   */
  async initializeCollection(): Promise<void> {
    try {
      // Verificar se a coleção já existe
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        (col) => col.name === this.collectionName
      );

      if (!collectionExists) {
        // Criar coleção com configuração para embeddings
        // Assumindo dimensão de 1536 (OpenAI text-embedding-3-small)
        // ou 384 (modelos menores). Pode ser configurável via env
        const vectorSize = parseInt(
          process.env.EMBEDDING_DIMENSION || "1536"
        );

        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: vectorSize,
            distance: "Cosine", // Distância cosseno para similaridade
          },
        });

        console.log(`✅ Coleção "${this.collectionName}" criada no Qdrant`);
      } else {
        console.log(`✅ Coleção "${this.collectionName}" já existe no Qdrant`);
      }
    } catch (error: any) {
      console.error("Erro ao inicializar coleção Qdrant:", error);
      throw new Error(
        `Falha ao inicializar coleção Qdrant: ${error.message}`
      );
    }
  }

  /**
   * Insere um ponto (vetor) na coleção
   */
  async upsertPoint(
    id: string | number,
    vector: number[],
    payload: {
      text: string;
      document_id: string;
      chunk_index: number;
      titulo?: string;
    }
  ): Promise<void> {
    try {
      // Converter id para número se for string numérica, senão usar hash
      let pointId: string | number;
      if (typeof id === "string" && /^\d+$/.test(id)) {
        pointId = parseInt(id);
      } else if (typeof id === "string") {
        // Usar hash simples para strings não numéricas
        pointId = this.stringToNumber(id);
      } else {
        pointId = id;
      }

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: pointId,
            vector: vector,
            payload: payload,
          },
        ],
      });
    } catch (error: any) {
      console.error("Erro ao inserir ponto no Qdrant:", error);
      throw new Error(`Falha ao inserir ponto no Qdrant: ${error.message}`);
    }
  }

  /**
   * Converte string para número (hash simples)
   */
  private stringToNumber(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Busca pontos similares (para RAG)
   */
  async searchSimilar(
    queryVector: number[],
    limit: number = 5,
    filter?: {
      document_id?: string;
    }
  ): Promise<any[]> {
    try {
      const searchResult = await this.client.search(this.collectionName, {
        vector: queryVector,
        limit: limit,
        filter: filter
          ? {
              must: [
                {
                  key: "document_id",
                  match: { value: filter.document_id },
                },
              ],
            }
          : undefined,
      });

      return searchResult;
    } catch (error: any) {
      console.error("Erro ao buscar no Qdrant:", error);
      throw new Error(`Falha ao buscar no Qdrant: ${error.message}`);
    }
  }

  /**
   * Remove todos os pontos de um documento
   */
  async deleteDocumentPoints(documentId: string): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter: {
          must: [
            {
              key: "document_id",
              match: { value: documentId },
            },
          ],
        },
      });
    } catch (error: any) {
      console.error("Erro ao deletar pontos do Qdrant:", error);
      throw new Error(
        `Falha ao deletar pontos do Qdrant: ${error.message}`
      );
    }
  }

  /**
   * Obtém informações da coleção
   */
  async getCollectionInfo(): Promise<any> {
    try {
      return await this.client.getCollection(this.collectionName);
    } catch (error: any) {
      console.error("Erro ao obter informações da coleção:", error);
      throw new Error(
        `Falha ao obter informações da coleção: ${error.message}`
      );
    }
  }
}

// Instância singleton
let qdrantClientInstance: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!qdrantClientInstance) {
    qdrantClientInstance = new QdrantClient();
  }
  return qdrantClientInstance;
}

