import { useState, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { ChatMessage } from "../types/chat.types";
import { chatService } from "../services/api";
import {
  downloadFile,
  extractDownloadLink,
  cleanDownloadMessage,
} from "../utils/fileDownload";
import { getErrorMessage } from "../utils/errorHandler";

/**
 * Hook customizado para gerenciar lógica do chat
 */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const statusMessageIdRef = useRef<string | null>(null);

  // Adicionar mensagem de status temporária
  const addStatusMessage = useCallback(
    (status: ChatMessage["status"], content: string) => {
      const statusId = `status-${Date.now()}`;
      statusMessageIdRef.current = statusId;

      const statusMessage: ChatMessage = {
        id: statusId,
        role: "assistant",
        content,
        timestamp: new Date().toISOString(),
        status,
      };

      setMessages((prev) => [...prev, statusMessage]);
      return statusId;
    },
    []
  );

  // Remover mensagem de status
  const removeStatusMessage = useCallback((statusId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== statusId));
    if (statusMessageIdRef.current === statusId) {
      statusMessageIdRef.current = null;
    }
  }, []);

  // Substituir mensagem de status
  const replaceStatusMessage = useCallback(
    (statusId: string, finalMessage: ChatMessage) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === statusId ? finalMessage : msg))
      );
      if (statusMessageIdRef.current === statusId) {
        statusMessageIdRef.current = null;
      }
    },
    []
  );

  // Mapeamento de status SSE
  const statusMap: Record<string, any> = {
    intent_detection: { status: "loading", emoji: "🧠" },
    rag: { status: "rag", emoji: "📚" },
    esaj_search: { status: "esaj_search", emoji: "🔍" },
    esaj_processing: { status: "esaj_search", emoji: "📄" },
    esaj_download: { status: "esaj_download", emoji: "📥" },
    llm_processing: { status: "loading", emoji: "💭" },
    loading: { status: "loading", emoji: "⏳" },
  };

  // Enviar mensagem
  const sendMessage = useCallback(
    async (message: string) => {
      // Adicionar mensagem do usuário
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Adicionar mensagem de status inicial
      let currentStatusId: string | null = addStatusMessage(
        "loading",
        "🧠 Analisando sua mensagem..."
      );

      try {
        // Chamar API com SSE
        const response = await chatService.sendMessageWithProgress(
          { message },
          (event) => {
            // Atualizar mensagem de status
            if (event.type === "progress" && currentStatusId) {
              const mappedStatus = statusMap[event.status] || {
                status: "loading",
                emoji: "⏳",
              };

              replaceStatusMessage(currentStatusId, {
                id: currentStatusId,
                role: "assistant",
                content: event.message,
                timestamp: new Date().toISOString(),
                status: mappedStatus.status,
              });
            }
          }
        );

        // Remover mensagem de status
        if (currentStatusId) {
          removeStatusMessage(currentStatusId);
          currentStatusId = null;
        }

        // Processar download se houver
        const downloadLink = extractDownloadLink(response.response);
        let displayContent = response.response;

        if (downloadLink) {
          const fileName = downloadLink.split("/").pop() || "documento.pdf";
          await downloadFile(downloadLink, decodeURIComponent(fileName));
          displayContent = cleanDownloadMessage(response.response);
        }

        // Adicionar resposta da IA
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: displayContent,
          timestamp: response.timestamp,
          sources: response.sources,
          status: "complete",
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err: any) {
        console.error("❌ Erro ao enviar mensagem:", err);

        const { errorContent, errorDetails } = getErrorMessage(err);

        // Criar mensagem de erro
        const errorMessage: ChatMessage = {
          id: currentStatusId || `error-${Date.now()}`,
          role: "assistant",
          content: `${errorContent}\n\n${errorDetails}`,
          timestamp: new Date().toISOString(),
          isError: true,
        };

        // Substituir status ou adicionar nova mensagem
        if (currentStatusId) {
          replaceStatusMessage(currentStatusId, errorMessage);
          currentStatusId = null;
        } else {
          setMessages((prev) => [...prev, errorMessage]);
        }

        toast.error(errorContent, { autoClose: 7000 });
      } finally {
        setIsLoading(false);
      }
    },
    [addStatusMessage, removeStatusMessage, replaceStatusMessage, statusMap]
  );

  return {
    messages,
    isLoading,
    sendMessage,
    setMessages,
  };
}
