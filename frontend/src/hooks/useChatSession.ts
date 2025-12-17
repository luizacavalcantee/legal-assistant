import { useState, useEffect, useRef } from "react";
import { ChatMessage } from "../types/chat.types";
import {
  getChatSession,
  updateChatSession,
  createChatSession,
  addChatSession,
} from "../utils/chatStorage";

/**
 * Hook customizado para gerenciar sessão do chat (localStorage)
 */
export function useChatSession(chatId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const currentChatIdRef = useRef<string | undefined>(chatId);
  const messagesToSaveRef = useRef<ChatMessage[]>([]);
  const isChangingChatRef = useRef(false);

  // Carregar mensagens quando chatId mudar
  useEffect(() => {
    if (currentChatIdRef.current !== chatId) {
      isChangingChatRef.current = true;
      setMessages([]);
      messagesToSaveRef.current = [];
      currentChatIdRef.current = chatId;
    }

    if (chatId) {
      const session = getChatSession(chatId);
      if (session) {
        setMessages(session.messages);
        messagesToSaveRef.current = session.messages;
      } else {
        setMessages([]);
        messagesToSaveRef.current = [];
      }
    } else {
      setMessages([]);
      messagesToSaveRef.current = [];
    }

    setTimeout(() => {
      isChangingChatRef.current = false;
    }, 100);
  }, [chatId]);

  // Salvar mensagens quando mudarem
  useEffect(() => {
    if (isChangingChatRef.current) {
      return;
    }

    if (
      chatId &&
      currentChatIdRef.current === chatId &&
      messages.length > 0 &&
      JSON.stringify(messages) !== JSON.stringify(messagesToSaveRef.current)
    ) {
      messagesToSaveRef.current = messages;

      const session = getChatSession(chatId);
      if (session) {
        updateChatSession(chatId, { messages });
      } else {
        const existingSession = getChatSession(chatId);
        if (!existingSession) {
          const firstUserMessage = messages.find((m) => m.role === "user");
          const newSession = createChatSession(firstUserMessage?.content);
          newSession.id = chatId;
          newSession.messages = messages;
          addChatSession(newSession);
          messagesToSaveRef.current = messages;
        }
      }
    }
  }, [messages, chatId]);

  return { messages, setMessages };
}
