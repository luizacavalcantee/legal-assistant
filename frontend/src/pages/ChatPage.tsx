import { useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { MessageList } from "../components/MessageList";
import { MessageInput } from "../components/MessageInput";
import { useChat } from "../hooks/useChat";
import { useChatSession } from "../hooks/useChatSession";

export function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Hook para gerenciar sessão (localStorage)
  const { messages: sessionMessages, setMessages: setSessionMessages } =
    useChatSession(chatId);

  // Hook para gerenciar chat
  const { messages, isLoading, sendMessage, setMessages } = useChat();

  // Sincronizar mensagens da sessão com o hook de chat
  useEffect(() => {
    if (sessionMessages.length > 0 && messages.length === 0) {
      setMessages(sessionMessages);
    }
  }, [sessionMessages, messages.length, setMessages]);

  // Sincronizar mensagens do chat com a sessão
  useEffect(() => {
    if (messages.length > 0) {
      setSessionMessages(messages);
    }
  }, [messages, setSessionMessages]);

  // Scroll automático
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Área de Mensagens */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="h-full max-w-4xl mx-auto flex flex-col">
          <MessageList messages={messages} isLoading={isLoading} />
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Campo de Entrada */}
      <div className="shrink-0 border-t bg-background">
        <div className="max-w-4xl mx-auto">
          <MessageInput onSendMessage={sendMessage} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
