export interface ChatMessageRequest {
  message: string;
}

export interface ChatMessageResponse {
  message: string;
  response: string;
  timestamp: string;
}

export interface ChatErrorResponse {
  error: string;
  message?: string;
}

