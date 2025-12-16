import { ChatSession } from "../types/chat.types";

const STORAGE_KEY = "chat_sessions_juridico";

/**
 * Gera um título para o chat baseado na primeira mensagem
 */
function generateChatTitle(firstMessage: string): string {
  const maxLength = 50;
  if (firstMessage.length <= maxLength) {
    return firstMessage;
  }
  return firstMessage.substring(0, maxLength) + "...";
}

/**
 * Carrega todas as sessões de chat do Local Storage
 */
export function loadChatSessions(): ChatSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    console.error("Erro ao carregar sessões de chat do Local Storage:", error);
    return [];
  }
}

/**
 * Salva todas as sessões de chat no Local Storage
 */
export function saveChatSessions(sessions: ChatSession[]): void {
  try {
    // Limitar a 50 sessões para evitar problemas de performance
    const limitedSessions = sessions.slice(-50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedSessions));
  } catch (error) {
    console.error("Erro ao salvar sessões de chat no Local Storage:", error);
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      try {
        // Manter apenas as últimas 25 sessões
        const reducedSessions = sessions.slice(-25);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reducedSessions));
      } catch (retryError) {
        console.error("Erro ao salvar sessões reduzidas:", retryError);
      }
    }
  }
}

/**
 * Cria uma nova sessão de chat
 */
export function createChatSession(firstMessage?: string): ChatSession {
  const now = new Date().toISOString();
  const session: ChatSession = {
    id: `chat-${Date.now()}`,
    title: firstMessage ? generateChatTitle(firstMessage) : "Novo Chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  return session;
}

/**
 * Adiciona uma nova sessão de chat (verifica se já existe antes de adicionar)
 */
export function addChatSession(session: ChatSession): void {
  const sessions = loadChatSessions();
  // Verificar se a sessão já existe (por ID)
  const existingIndex = sessions.findIndex((s) => s.id === session.id);
  if (existingIndex !== -1) {
    // Se já existe, atualizar em vez de adicionar
    sessions[existingIndex] = {
      ...sessions[existingIndex],
      ...session,
      updatedAt: new Date().toISOString(),
    };
  } else {
    // Se não existe, adicionar
    sessions.push(session);
  }
  saveChatSessions(sessions);
}

/**
 * Atualiza uma sessão de chat existente
 */
export function updateChatSession(chatId: string, updates: Partial<ChatSession>): void {
  const sessions = loadChatSessions();
  const index = sessions.findIndex((s) => s.id === chatId);
  if (index !== -1) {
    sessions[index] = {
      ...sessions[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    // Se há mensagens, atualizar o título baseado na primeira mensagem do usuário
    if (updates.messages && updates.messages.length > 0) {
      const firstUserMessage = updates.messages.find((m) => m.role === "user");
      if (firstUserMessage) {
        sessions[index].title = generateChatTitle(firstUserMessage.content);
      }
    }
    saveChatSessions(sessions);
  }
}

/**
 * Obtém uma sessão de chat por ID
 */
export function getChatSession(chatId: string): ChatSession | null {
  const sessions = loadChatSessions();
  return sessions.find((s) => s.id === chatId) || null;
}

/**
 * Remove uma sessão de chat
 */
export function deleteChatSession(chatId: string): void {
  const sessions = loadChatSessions();
  const filtered = sessions.filter((s) => s.id !== chatId);
  saveChatSessions(filtered);
}

/**
 * Atualiza o título de uma sessão de chat
 */
export function updateChatTitle(chatId: string, title: string): void {
  const sessions = loadChatSessions();
  const index = sessions.findIndex((s) => s.id === chatId);
  if (index !== -1) {
    sessions[index].title = title;
    sessions[index].updatedAt = new Date().toISOString();
    saveChatSessions(sessions);
  }
}

/**
 * Limpa todas as sessões de chat
 */
export function clearAllChatSessions(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Erro ao limpar sessões de chat do Local Storage:", error);
  }
}

