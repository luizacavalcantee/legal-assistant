import { ChatMessage } from "../types/chat.types";

/**
 * Formata timestamp para exibição
 */
export const formatMessageTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Retorna mensagem de status baseada no status da mensagem
 */
export const getStatusMessage = (status?: ChatMessage["status"]): string => {
  switch (status) {
    case "rag":
      return "📚 Buscando informações na base de conhecimento...";
    case "esaj_search":
      return "🔍 Acessando portal e-SAJ e buscando processo...";
    case "esaj_download":
      return "📥 Baixando documento do e-SAJ...";
    case "loading":
      return "⏳ Processando...";
    default:
      return "💭 Pensando...";
  }
};

/**
 * Verifica se a mensagem é uma mensagem de status (em progresso)
 */
export const isStatusMessage = (message: ChatMessage): boolean => {
  return !!(message.status && message.status !== "complete");
};

/**
 * Verifica se a mensagem é de erro
 */
export const isErrorMessage = (message: ChatMessage): boolean => {
  return !!message.isError;
};
