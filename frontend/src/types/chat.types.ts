export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: Array<{
    document_id: string;
    titulo: string;
    chunk_index: number;
    score: number;
    text: string;
  }>;
  isError?: boolean;
  status?: "loading" | "rag" | "esaj_search" | "esaj_download" | "complete";
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRequest {
  message: string;
}

export interface ChatMessageResponse {
  message: string;
  response: string;
  timestamp: string;
  intention?: string;
  protocolNumber?: string;
  documentType?: string;
  downloadUrl?: string;
  fileName?: string;
  sources?: Array<{
    document_id: string;
    titulo: string;
    chunk_index: number;
    score: number;
    text: string;
  }>;
}

