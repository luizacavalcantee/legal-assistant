import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChatMessage } from "../types/chat.types";
import { chatService } from "../services/api";
import { MessageList } from "../components/MessageList";
import { MessageInput } from "../components/MessageInput";
import { Button } from "../components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";

export function ChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    try {
      // Chamar API do backend
      const response = await chatService.sendMessage({ message });

      // Verificar se há link de download na resposta
      const downloadLink = extractDownloadLink(response.response);
      let displayContent = response.response;

      if (downloadLink) {
        // Extrair nome do arquivo da URL
        const fileName = downloadLink.split("/").pop() || "documento.pdf";

        // Fazer download automático
        await downloadFile(downloadLink, decodeURIComponent(fileName));

        // Limpar mensagem para mostrar apenas informações essenciais
        displayContent = cleanDownloadMessage(response.response);
      }

      // Adicionar resposta da IA ao histórico
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: displayContent,
        timestamp: response.timestamp,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("Erro ao enviar mensagem:", err);

      // Adicionar mensagem de erro ao histórico
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content:
          err.response?.data?.error ||
          err.response?.data?.message ||
          "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.",
        timestamp: new Date().toISOString(),
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
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/knowledge-base")}
            title="Voltar para Base de Conhecimento"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              Assistente Jurídico Inteligente
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Faça perguntas sobre questões jurídicas e receba respostas
              precisas
            </p>
          </div>
        </div>
      </header>

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
