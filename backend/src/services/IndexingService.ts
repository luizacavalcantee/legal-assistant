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
      console.log(`📄 Iniciando indexação do documento: ${titulo} (ID: ${documentId})`);
      console.log(`   📁 Arquivo: ${filePath}`);

      // 1. Processar documento (ler e fazer chunking)
      console.log(`   🔍 Lendo e processando arquivo...`);
      let chunks;
      try {
        chunks = await this.documentProcessor.processDocument(filePath);
        console.log(`✂️  Documento dividido em ${chunks.length} chunks`);
      } catch (error: any) {
        console.error(`❌ Erro ao processar documento: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        throw error;
      }

      if (chunks.length === 0) {
        throw new Error("Nenhum chunk gerado do documento");
      }

      // Limitar número máximo de chunks para evitar problemas de memória
      const maxChunks = 1000;
      if (chunks.length > maxChunks) {
        console.warn(`⚠️  Documento tem ${chunks.length} chunks. Limitando a ${maxChunks} para evitar problemas de memória.`);
        chunks.splice(maxChunks);
      }

      // 2. Processar em lotes menores para economizar memória
      const embeddingBatchSize = 20; // Processar 20 chunks por vez
      const qdrantBatchSize = 10; // Inserir 10 pontos por vez no Qdrant
      
      console.log(`🔢 Processando embeddings em lotes de ${embeddingBatchSize}...`);

      // Processar chunks em lotes
      for (let i = 0; i < chunks.length; i += embeddingBatchSize) {
        const batchEnd = Math.min(i + embeddingBatchSize, chunks.length);
        const batch = chunks.slice(i, batchEnd);
        const batchNumber = Math.floor(i / embeddingBatchSize) + 1;
        const totalBatches = Math.ceil(chunks.length / embeddingBatchSize);
        
        console.log(`🔢 Processando lote ${batchNumber}/${totalBatches} (chunks ${i + 1}-${batchEnd})...`);

        // Gerar embeddings para este lote
        console.log(`   🔢 Gerando embeddings para lote ${batchNumber}...`);
        const batchTexts = batch.map((chunk) => chunk.text);
        const embeddings = await this.embeddingService.generateEmbeddings(batchTexts);
        console.log(`   ✅ ${embeddings.length} embeddings gerados`);

        if (embeddings.length !== batch.length) {
          throw new Error(
            `Número de embeddings (${embeddings.length}) não corresponde ao número de chunks no lote (${batch.length})`
          );
        }

        // Inserir pontos no Qdrant em sub-lotes
        for (let j = 0; j < batch.length; j += qdrantBatchSize) {
          const qdrantBatch = batch.slice(j, j + qdrantBatchSize);
          const qdrantEmbeddings = embeddings.slice(j, j + qdrantBatchSize);

          const points = qdrantBatch.map((chunk, idx) => ({
            id: `${documentId}-${chunk.index}`,
            vector: qdrantEmbeddings[idx],
            payload: {
              text: chunk.text,
              document_id: documentId,
              chunk_index: chunk.index,
              titulo: titulo,
            },
          }));

          // Inserir lote no Qdrant
          console.log(`   💾 Inserindo ${points.length} pontos no Qdrant...`);
          await Promise.all(
            points.map((point) =>
              this.qdrantClient.upsertPoint(
                point.id,
                point.vector,
                point.payload
              )
            )
          );
          console.log(`   ✅ ${points.length} pontos inseridos no Qdrant`);
        }

        // Limpar memória entre lotes
        if (global.gc && i % (embeddingBatchSize * 2) === 0) {
          global.gc();
        }
      }

      // 3. Atualizar status no banco
      await this.repository.update(documentId, {
        status_indexacao: StatusIndexacao.INDEXADO,
      });

      console.log(`✅ Documento indexado com sucesso: ${titulo} (${chunks.length} chunks)`);
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

