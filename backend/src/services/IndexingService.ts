import { QdrantClient, getQdrantClient } from "../lib/qdrant";
import { EmbeddingService } from "./EmbeddingService";
import { DocumentProcessor, Chunk } from "./DocumentProcessor";
import { DocumentRepository } from "../repositories/DocumentRepository";
import { StatusIndexacao } from "@prisma/client";

export class IndexingService {
  private qdrantClient: QdrantClient;
  private embeddingService: EmbeddingService;
  private documentProcessor: DocumentProcessor;
  private repository: DocumentRepository;

  constructor(
    qdrantClient: QdrantClient,
    embeddingService: EmbeddingService,
    documentProcessor: DocumentProcessor,
    repository: DocumentRepository
  ) {
    this.qdrantClient = qdrantClient;
    this.embeddingService = embeddingService;
    this.documentProcessor = documentProcessor;
    this.repository = repository;
  }

  /**
   * Indexa um documento completo: processa, gera embeddings e salva no Qdrant
   * @param documentId - ID do documento no banco
   * @param filePath - Caminho do arquivo
   * @param titulo - Título do documento
   */
  async indexDocument(
    documentId: string,
    filePath: string,
    titulo: string
  ): Promise<void> {
    try {
      console.log(`📄 Iniciando indexação do documento: ${titulo}`);

      // 1. Processar documento (ler e fazer chunking)
      const chunks = await this.documentProcessor.processDocument(filePath);
      console.log(`✂️  Documento dividido em ${chunks.length} chunks`);

      if (chunks.length === 0) {
        throw new Error("Nenhum chunk gerado do documento");
      }

      // 2. Gerar embeddings para todos os chunks (batch)
      console.log(`🔢 Gerando embeddings para ${chunks.length} chunks...`);
      const embeddings = await this.embeddingService.generateEmbeddings(
        chunks.map((chunk) => chunk.text)
      );

      if (embeddings.length !== chunks.length) {
        throw new Error(
          `Número de embeddings (${embeddings.length}) não corresponde ao número de chunks (${chunks.length})`
        );
      }

      // 3. Inserir pontos no Qdrant
      console.log(`💾 Salvando ${chunks.length} pontos no Qdrant...`);
      const points = chunks.map((chunk, index) => ({
        id: `${documentId}-${chunk.index}`, // ID único: documentId-chunkIndex
        vector: embeddings[index],
        payload: {
          text: chunk.text,
          document_id: documentId,
          chunk_index: chunk.index,
          titulo: titulo,
        },
      }));

      // Inserir em lotes para melhor performance
      const batchSize = 10;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        await Promise.all(
          batch.map((point) =>
            this.qdrantClient.upsertPoint(
              point.id,
              point.vector,
              point.payload
            )
          )
        );
      }

      // 4. Atualizar status no banco
      await this.repository.update(documentId, {
        status_indexacao: StatusIndexacao.INDEXADO,
      });

      console.log(`✅ Documento indexado com sucesso: ${titulo}`);
    } catch (error: any) {
      console.error(`❌ Erro ao indexar documento ${documentId}:`, error);

      // Atualizar status para ERRO
      try {
        await this.repository.update(documentId, {
          status_indexacao: StatusIndexacao.ERRO,
        });
      } catch (updateError) {
        console.error("Erro ao atualizar status para ERRO:", updateError);
      }

      throw new Error(
        `Falha ao indexar documento: ${error.message}`
      );
    }
  }

  /**
   * Remove todos os pontos de um documento do Qdrant
   * @param documentId - ID do documento
   */
  async removeDocumentFromIndex(documentId: string): Promise<void> {
    try {
      await this.qdrantClient.deleteDocumentPoints(documentId);
      console.log(`🗑️  Documento removido do índice: ${documentId}`);
    } catch (error: any) {
      console.error(
        `Erro ao remover documento do índice ${documentId}:`,
        error
      );
      throw new Error(
        `Falha ao remover documento do índice: ${error.message}`
      );
    }
  }

  /**
   * Reindexa um documento (remove pontos antigos e cria novos)
   * @param documentId - ID do documento
   * @param filePath - Caminho do arquivo
   * @param titulo - Título do documento
   */
  async reindexDocument(
    documentId: string,
    filePath: string,
    titulo: string
  ): Promise<void> {
    try {
      // Remover pontos antigos
      await this.removeDocumentFromIndex(documentId);
      // Indexar novamente
      await this.indexDocument(documentId, filePath, titulo);
    } catch (error: any) {
      throw new Error(
        `Falha ao reindexar documento: ${error.message}`
      );
    }
  }
}

