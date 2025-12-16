import axios from "axios";
import {
  Document,
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentListResponse,
  DocumentResponse,
} from "../types/document.types";
import { ChatMessageRequest, ChatMessageResponse } from "../types/chat.types";

// Validar e construir a URL da API
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;

  // Se não há URL configurada, usar localhost apenas em desenvolvimento
  if (!envUrl) {
    if (import.meta.env.DEV) {
      return "http://localhost:3000";
    }
    console.error(
      "VITE_API_URL não está configurada! Configure a variável de ambiente na Vercel."
    );
    throw new Error(
      "API URL não configurada. Configure VITE_API_URL na Vercel."
    );
  }

  // Remover barra final se houver
  return envUrl.replace(/\/$/, "");
};

const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 180000, // 120 segundos (2 minutos) de timeout para operações do e-SAJ
});

// Interceptor para log de erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.code === "ERR_NETWORK" ||
      error.message.includes("Failed to fetch")
    ) {
      console.error("Erro de rede. Verifique:", {
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        message:
          "Verifique se VITE_API_URL está configurada corretamente na Vercel",
      });
    }
    return Promise.reject(error);
  }
);

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

  // Criar novo documento (com upload de arquivo)
  async create(data: CreateDocumentDto, file?: File): Promise<Document> {
    if (file) {
      // Enviar como multipart/form-data
      const formData = new FormData();
      formData.append("titulo", data.titulo);
      formData.append("arquivo", file);

      const response = await api.post<DocumentResponse>(
        "/documents",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data.data;
    } else {
      // Enviar como JSON (compatibilidade com API antiga)
      const response = await api.post<DocumentResponse>("/documents", data);
      return response.data.data;
    }
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
