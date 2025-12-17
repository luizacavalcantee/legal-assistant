import { DocumentRepository } from "../repositories/DocumentRepository";
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentResponse,
} from "../types/document.types";
import { StatusIndexacao } from "@prisma/client";
import { IndexingService } from "./IndexingService";

export class DocumentService {
  private repository: DocumentRepository;
  public indexingService?: IndexingService; // Tornar público para permitir atualização

  constructor(
    repository: DocumentRepository,
    indexingService?: IndexingService
  ) {
    this.repository = repository;
    this.indexingService = indexingService;
  }

  async createDocument(
    data: CreateDocumentDto,
    filePath?: string
  ): Promise<DocumentResponse> {
    // Usar caminho do arquivo enviado ou o caminho fornecido
    const caminhoArquivo = filePath || data.caminho_arquivo;

    // Criar documento no banco com status PENDENTE
    const document = await this.repository.create({
      titulo: data.titulo,
      caminho_arquivo: caminhoArquivo,
      status_indexacao: StatusIndexacao.PENDENTE,
    });

    // Indexar documento de forma assíncrona (não bloqueia a resposta)
    // Aguardar um pouco para garantir que o IndexingService esteja inicializado
    if (filePath) {
      // Função para tentar indexar (pode ser chamada imediatamente ou após delay)
      const tryIndexDocument = async (retryCount = 0) => {
        if (this.indexingService) {
          try {
            console.log(`🚀 Iniciando indexação assíncrona do documento ${document.id}...`);
            await this.indexingService.indexDocument(document.id, filePath, data.titulo);
            console.log(`✅ Indexação concluída para documento ${document.id}`);
          } catch (error: any) {
            console.error(
              `❌ Erro ao indexar documento ${document.id} em background:`,
              error.message
            );
            console.error("   Stack:", error.stack);
          }
        } else {
          // Se não estiver disponível e ainda não tentou muitas vezes, tentar novamente após delay
          if (retryCount < 5) {
            console.log(`⏳ IndexingService ainda não disponível. Tentando novamente em 2 segundos... (tentativa ${retryCount + 1}/5)`);
            setTimeout(() => tryIndexDocument(retryCount + 1), 2000);
          } else {
            console.warn(`⚠️  IndexingService não disponível após ${retryCount} tentativas. Documento ${document.id} não será indexado.`);
            console.warn(`   Isso pode acontecer se o Qdrant não estiver configurado ou ainda estiver inicializando.`);
          }
        }
      };

      // Tentar indexar imediatamente ou após um pequeno delay
      if (this.indexingService) {
        tryIndexDocument();
      } else {
        // Aguardar 1 segundo antes da primeira tentativa para dar tempo ao IndexingService inicializar
        setTimeout(() => tryIndexDocument(), 1000);
      }
    } else {
      console.warn(`⚠️  Caminho do arquivo não fornecido. Documento ${document.id} não será indexado.`);
    }

    return this.mapToResponse(document);
  }

  async listDocuments(): Promise<DocumentResponse[]> {
    const documents = await this.repository.findAll();
    return documents.map((doc) => this.mapToResponse(doc));
  }

  async getDocumentById(id: string): Promise<DocumentResponse> {
    const document = await this.repository.findById(id);

    if (!document) {
      throw new Error("Documento não encontrado");
    }

    return this.mapToResponse(document);
  }

  async updateDocument(
    id: string,
    data: UpdateDocumentDto
  ): Promise<DocumentResponse> {
    // Verificar se o documento existe
    const existingDocument = await this.repository.findById(id);
    if (!existingDocument) {
      throw new Error("Documento não encontrado");
    }

    const updatedDocument = await this.repository.update(id, data);
    return this.mapToResponse(updatedDocument);
  }

  async deleteDocument(id: string): Promise<void> {
    // Verificar se o documento existe
    const existingDocument = await this.repository.findById(id);
    if (!existingDocument) {
      throw new Error("Documento não encontrado");
    }

    // Remover do índice vetorial antes de deletar do banco
    if (this.indexingService) {
      try {
        await this.indexingService.removeDocumentFromIndex(id);
      } catch (error) {
        console.error(
          `Erro ao remover documento ${id} do índice:`,
          error
        );
        // Continua com a deleção mesmo se falhar ao remover do índice
      }
    }

    await this.repository.delete(id);
  }

  private mapToResponse(document: any): DocumentResponse {
    // Usar 'any' para permitir campos opcionais que podem não existir no banco ainda
    return {
      id: document.id,
      titulo: document.titulo,
      caminho_arquivo: document.caminho_arquivo,
      status_indexacao: document.status_indexacao,
      criado_em: document.criado_em,
      google_drive_file_id: document.google_drive_file_id || null,
      google_drive_view_link: document.google_drive_view_link || null,
    };
  }
}

