import { StatusIndexacao } from "@prisma/client";

export interface CreateDocumentDto {
  titulo: string;
  caminho_arquivo: string;
}

export interface UpdateDocumentDto {
  titulo?: string;
  caminho_arquivo?: string;
  status_indexacao?: StatusIndexacao;
}

export interface DocumentResponse {
  id: string;
  titulo: string;
  caminho_arquivo: string;
  status_indexacao: StatusIndexacao;
  criado_em: Date;
}

