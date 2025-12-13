import axios from "axios";
import {
  Document,
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentListResponse,
  DocumentResponse,
} from "../types/document.types";
import {
  ChatMessageRequest,
  ChatMessageResponse,
} from "../types/chat.types";

const api = axios.create({
  baseURL: "http://localhost:3000",
  headers: {
    "Content-Type": "application/json",
  },
});

export const documentService = {
  // Listar todos os documentos
  async getAll(): Promise<Document[]> {
    const response = await api.get<DocumentListResponse>("/documents");
    return response.data.data;
  },

  // Buscar documento por ID
  async getById(id: string): Promise<Document> {
    const response = await api.get<DocumentResponse>(`/documents/${id}`);
    return response.data.data;
  },

  // Criar novo documento
  async create(data: CreateDocumentDto): Promise<Document> {
    const response = await api.post<DocumentResponse>("/documents", data);
    return response.data.data;
  },

  // Atualizar documento
  async update(id: string, data: UpdateDocumentDto): Promise<Document> {
    const response = await api.put<DocumentResponse>(`/documents/${id}`, data);
    return response.data.data;
  },

  // Remover documento
  async delete(id: string): Promise<void> {
    await api.delete(`/documents/${id}`);
  },
};

export const chatService = {
  // Enviar mensagem ao chat
  async sendMessage(data: ChatMessageRequest): Promise<ChatMessageResponse> {
    const response = await api.post<ChatMessageResponse>("/chat/message", data);
    return response.data;
  },
};

export default api;
