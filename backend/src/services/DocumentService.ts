import { DocumentRepository } from "../repositories/DocumentRepository";
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentResponse,
} from "../types/document.types";
import { StatusIndexacao } from "@prisma/client";

export class DocumentService {
  private repository: DocumentRepository;

  constructor(repository: DocumentRepository) {
    this.repository = repository;
  }

  async createDocument(
    data: CreateDocumentDto
  ): Promise<DocumentResponse> {
    const document = await this.repository.create({
      titulo: data.titulo,
      caminho_arquivo: data.caminho_arquivo,
      status_indexacao: StatusIndexacao.PENDENTE,
    });

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

