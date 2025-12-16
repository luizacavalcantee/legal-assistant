import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ChatMessage } from "../types/chat.types";
import { chatService } from "../services/api";
import { MessageList } from "../components/MessageList";
import { MessageInput } from "../components/MessageInput";
import { AlertCircle } from "lucide-react";
import { 
  getChatSession, 
  updateChatSession,
  createChatSession,
  addChatSession
} from "../utils/chatStorage";

export function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const statusMessageIdRef = useRef<string | null>(null);

  // Ref para rastrear o chatId anterior e evitar salvamento incorreto
  const previousChatIdRef = useRef<string | undefined>(chatId);
  const isInitialMount = useRef(true);

  // Carregar mensagens do chat atual quando chatId mudar
  useEffect(() => {
    // Limpar mensagens imediatamente quando o chatId mudar (exceto no mount inicial)
    if (!isInitialMount.current && previousChatIdRef.current !== chatId) {
      setMessages([]);
    }
    
    previousChatIdRef.current = chatId;
    isInitialMount.current = false;

    if (chatId) {
      const session = getChatSession(chatId);
      if (session) {
        setMessages(session.messages);
      } else {
        // Se a sessão não existe, garantir que mensagens estão vazias
        setMessages([]);
      }
    } else {
      // Se não há chatId, limpar mensagens (o MainLayout vai redirecionar)
      setMessages([]);
    }
  }, [chatId]);

  // Salvar mensagens sempre que mudarem, mas só se houver mensagens
  useEffect(() => {
    // Não salvar se o chatId mudou (evitar salvar mensagens do chat anterior)
    // Verificar se o chatId atual corresponde ao que está sendo salvo
    if (chatId && previousChatIdRef.current === chatId && messages.length > 0) {
      const session = getChatSession(chatId);
      if (session) {
        // Sessão já existe, apenas atualizar
        updateChatSession(chatId, { messages });
      } else {
        // Sessão não existe, criar e salvar pela primeira vez
        // Verificar novamente antes de criar para evitar race conditions
        const existingSession = getChatSession(chatId);
        if (!existingSession) {
          const firstUserMessage = messages.find((m) => m.role === "user");
          const newSession = createChatSession(firstUserMessage?.content);
          newSession.id = chatId;
          newSession.messages = messages;
          addChatSession(newSession);
        }
      }
    }
  }, [messages, chatId]);

  // Scroll automático para a última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Função para detectar e extrair link de download da resposta
  const extractDownloadLink = (text: string): string | null => {
    // Procurar por padrão: http://.../download/file/... ou https://.../download/file/...
    const downloadPattern = /https?:\/\/[^\s\n]+\/download\/file\/([^\s\n\)]+)/;
    const match = text.match(downloadPattern);
    return match ? match[0] : null;
  };

  // Função para fazer download automático do arquivo
  const downloadFile = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro ao baixar arquivo: ${response.statusText}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Erro ao fazer download:", error);
    }
  };

  // Função para limpar mensagem removendo link e mantendo apenas informações essenciais
  const cleanDownloadMessage = (text: string): string => {
    // Extrair nome do arquivo se presente
    const fileNameMatch = text.match(/📋 Nome do arquivo: ([^\n]+)/);
    const fileName = fileNameMatch ? fileNameMatch[1] : null;

    // Retornar mensagem limpa
    if (fileName) {
      return `✅ Documento baixado com sucesso!\n\n📋 Nome do arquivo: ${fileName}`;
    }

    // Se não encontrar nome do arquivo, retornar apenas a primeira linha de sucesso
    const successMatch = text.match(/✅[^\n]+/);
    return successMatch ? successMatch[0] : text;
  };

  // Função para adicionar mensagem de status temporária
  const addStatusMessage = (status: ChatMessage["status"], content: string) => {
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
  };

  // Função para remover mensagem de status
  const removeStatusMessage = (statusId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== statusId));
    if (statusMessageIdRef.current === statusId) {
      statusMessageIdRef.current = null;
    }
  };

  // Função para atualizar mensagem de status com resposta final
  const replaceStatusMessage = (
    statusId: string,
    finalMessage: ChatMessage
  ) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === statusId ? finalMessage : msg))
    );
    if (statusMessageIdRef.current === statusId) {
      statusMessageIdRef.current = null;
    }
  };

  const handleSendMessage = async (message: string) => {
    // Adicionar mensagem do usuário ao histórico
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // Adicionar mensagem de status inicial genérica
    const initialStatusId = addStatusMessage(
      "loading",
      "Processando sua mensagem..."
    );

    try {
      // Chamar API do backend
      const response = await chatService.sendMessage({ message });

      // Remover mensagem de status inicial de forma síncrona
      setMessages((prev) => prev.filter((msg) => msg.id !== initialStatusId));
      if (statusMessageIdRef.current === initialStatusId) {
        statusMessageIdRef.current = null;
      }

      // Adicionar mensagens de status baseadas na intenção
      let statusId: string | null = null;
      if (response.intention === "RAG_QUERY") {
        statusId = addStatusMessage(
          "rag",
          "A IA está consultando documentos internos..."
        );
      } else if (
        response.intention === "DOWNLOAD_DOCUMENT" ||
        response.intention === "SUMMARIZE_PROCESS" ||
        response.intention === "SUMMARIZE_DOCUMENT" ||
        response.intention === "QUERY_DOCUMENT"
      ) {
        if (response.protocolNumber) {
          statusId = addStatusMessage(
            "esaj_search",
            `Buscando processo ${response.protocolNumber} no e-SAJ...`
          );
        }
      } else {
        // Para outras intenções (GENERAL_QUERY), não adicionar mensagem de status adicional
        // A mensagem inicial já foi removida
      }

      // Simular delay mínimo para mostrar status (opcional)
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verificar se há link de download na resposta
      const downloadLink = extractDownloadLink(response.response);
      let displayContent = response.response;

      // Se for download, adicionar status de download
      if (response.intention === "DOWNLOAD_DOCUMENT" && statusId) {
        replaceStatusMessage(statusId, {
          id: statusId,
          role: "assistant",
          content: "Processo encontrado. Baixando documento...",
          timestamp: new Date().toISOString(),
          status: "esaj_download",
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (downloadLink) {
        // Extrair nome do arquivo da URL
        const fileName = downloadLink.split("/").pop() || "documento.pdf";

        // Fazer download automático
        await downloadFile(downloadLink, decodeURIComponent(fileName));

        // Limpar mensagem para mostrar apenas informações essenciais
        displayContent = cleanDownloadMessage(response.response);
      }

      // Remover mensagem de status se ainda existir
      if (statusId) {
        removeStatusMessage(statusId);
      }

      // Adicionar resposta da IA ao histórico
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
      console.error("Erro ao enviar mensagem:", err);

      // Remover mensagem de status se existir
      if (statusMessageIdRef.current) {
        removeStatusMessage(statusMessageIdRef.current);
      }

      // Adicionar mensagem de erro ao histórico
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content:
          err.response?.data?.error ||
          err.response?.data?.message ||
          "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.",
        timestamp: new Date().toISOString(),
        isError: true,
      };

      setMessages((prev) => [...prev, errorMessage]);
      setError(
        err.response?.data?.error ||
          "Erro ao comunicar com o assistente. Verifique sua conexão."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Área de Mensagens */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto flex flex-col">
          {error && (
            <div className="mx-4 mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <MessageList messages={messages} isLoading={isLoading} />
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Campo de Entrada */}
      <MessageInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
}
