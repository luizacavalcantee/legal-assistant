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
  timeout: 300000, // 5 minutos de timeout para operações do e-SAJ (Render é mais lento)
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
  // Enviar mensagem ao chat (modo tradicional)
  async sendMessage(data: ChatMessageRequest): Promise<ChatMessageResponse> {
    try {
      console.log("📤 Enviando requisição para /chat/message:", data);
      const response = await api.post<ChatMessageResponse>(
        "/chat/message",
        data
      );
      console.log("✅ Resposta recebida:", response.data);
      return response.data;
    } catch (error: any) {
      console.error("❌ Erro na requisição de chat:", error);
      console.error("   Status:", error.response?.status);
      console.error("   Data:", error.response?.data);
      console.error("   Message:", error.message);
      throw error;
    }
  },

  // Enviar mensagem com SSE (progresso em tempo real)
  async sendMessageWithProgress(
    data: ChatMessageRequest,
    onProgress: (event: {
      type: "progress" | "complete" | "error";
      status: string;
      message: string;
      data?: any;
      error?: string;
      progress?: number;
    }) => void
  ): Promise<ChatMessageResponse> {
    return new Promise((resolve, reject) => {
      const apiUrl = getApiUrl();
      const url = `${apiUrl}/chat/message-stream`;

      console.log("📤 Iniciando requisição SSE para:", url);

      // Fazer requisição POST usando fetch
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error("Response body is null");
          }

          let buffer = "";

          const processStream = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();

                if (done) {
                  console.log("✅ Stream concluído");
                  break;
                }

                // Decodificar chunk
                buffer += decoder.decode(value, { stream: true });

                // Processar linhas completas
                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; // Guardar linha incompleta

                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    try {
                      const eventData = JSON.parse(line.substring(6));
                      console.log("📨 Evento SSE recebido:", eventData);

                      // Chamar callback de progresso
                      onProgress(eventData);

                      // Se for evento de conclusão, resolver a promise
                      if (eventData.type === "complete") {
                        resolve(eventData.data);
                      }

                      // Se for evento de erro, rejeitar a promise
                      if (eventData.type === "error") {
                        reject(new Error(eventData.error || eventData.message));
                      }
                    } catch (parseError) {
                      console.error(
                        "❌ Erro ao parsear evento SSE:",
                        parseError
                      );
                    }
                  }
                }
              }
            } catch (error) {
              console.error("❌ Erro ao processar stream:", error);
              reject(error);
            }
          };

          processStream();
        })
        .catch((error) => {
          console.error("❌ Erro na requisição SSE:", error);
          reject(error);
        });
    });
  },
};

export default api;
