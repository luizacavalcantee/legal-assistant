export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ChatMessageRequest {
  message: string;
}

export interface ChatMessageResponse {
  message: string;
  response: string;
  timestamp: string;
}

