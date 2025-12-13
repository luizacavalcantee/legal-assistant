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
  private indexingService?: IndexingService;

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
    if (this.indexingService && filePath) {
      this.indexingService
        .indexDocument(document.id, filePath, data.titulo)
        .catch((error) => {
          console.error(
            `Erro ao indexar documento ${document.id} em background:`,
            error
          );
        });
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

  private mapToResponse(document: {
    id: string;
    titulo: string;
    caminho_arquivo: string;
    status_indexacao: StatusIndexacao;
    criado_em: Date;
  }): DocumentResponse {
    return {
      id: document.id,
      titulo: document.titulo,
      caminho_arquivo: document.caminho_arquivo,
      status_indexacao: document.status_indexacao,
      criado_em: document.criado_em,
    };
  }
}

