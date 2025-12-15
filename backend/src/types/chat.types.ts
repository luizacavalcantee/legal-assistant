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

export interface ChatErrorResponse {
  error: string;
  message?: string;
}

