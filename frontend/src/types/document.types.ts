export enum StatusIndexacao {
  PENDENTE = "PENDENTE",
  INDEXADO = "INDEXADO",
  ERRO = "ERRO",
}

export interface Document {
  id: string;
  titulo: string;
  caminho_arquivo: string;
  status_indexacao: StatusIndexacao;
  criado_em: string;
}

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
  message: string;
  data: Document;
}

export interface DocumentListResponse {
  message: string;
  data: Document[];
  total: number;
}

