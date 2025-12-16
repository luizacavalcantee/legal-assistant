import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ChatMessage } from "../types/chat.types";
import { chatService, default as api } from "../services/api";
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

  // Ref para rastrear o chatId atual e evitar salvamento incorreto
  const currentChatIdRef = useRef<string | undefined>(chatId);
  const isInitialMount = useRef(true);
  const messagesToSaveRef = useRef<ChatMessage[]>([]);
  const isChangingChatRef = useRef(false);

  // Carregar mensagens do chat atual quando chatId mudar
  useEffect(() => {
    // Se o chatId mudou, marcar que estamos mudando de chat
    if (currentChatIdRef.current !== chatId) {
      isChangingChatRef.current = true;
      // Limpar mensagens imediatamente para evitar salvamento incorreto
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
        // Se a sessão não existe, garantir que mensagens estão vazias
        setMessages([]);
        messagesToSaveRef.current = [];
      }
    } else {
      // Se não há chatId, limpar mensagens (o MainLayout vai redirecionar)
      setMessages([]);
      messagesToSaveRef.current = [];
    }
    
    // Marcar que terminamos de mudar de chat após um pequeno delay
    // Isso garante que qualquer salvamento pendente seja cancelado
    setTimeout(() => {
      isChangingChatRef.current = false;
    }, 100);
    
    isInitialMount.current = false;
  }, [chatId]);

  // Salvar mensagens sempre que mudarem, mas só se houver mensagens e o chatId corresponder
  useEffect(() => {
    // Não salvar se estamos mudando de chat
    if (isChangingChatRef.current) {
      return;
    }
    
    // Só salvar se:
    // 1. Há um chatId válido
    // 2. O chatId atual corresponde ao que está sendo salvo
    // 3. Há mensagens para salvar
    // 4. As mensagens são diferentes das que já foram salvas (evitar loops)
    // 5. Não estamos no mount inicial sem mensagens
    if (
      chatId && 
      currentChatIdRef.current === chatId && 
      messages.length > 0 &&
      JSON.stringify(messages) !== JSON.stringify(messagesToSaveRef.current)
    ) {
      // Atualizar referência das mensagens salvas
      messagesToSaveRef.current = messages;
      
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
          messagesToSaveRef.current = messages;
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
    if (match) {
      return match[0];
    }
    
    // Se não encontrar URL completa, procurar por URL relativa
    const relativePattern = /\/download\/file\/([^\s\n\)]+)/;
    const relativeMatch = text.match(relativePattern);
    if (relativeMatch) {
      // Construir URL completa usando a baseURL da API
      const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:3000";
      return `${apiUrl}${relativeMatch[0]}`;
    }
    
    return null;
  };

  // Função para fazer download automático do arquivo
  const downloadFile = async (url: string, fileName: string) => {
    try {
      console.log("📥 Iniciando download:", url);
      console.log("📋 Nome do arquivo:", fileName);
      
      // Se a URL é relativa, construir URL completa
      let fullUrl = url;
      if (url.startsWith("/")) {
        const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:3000";
        fullUrl = `${apiUrl}${url}`;
      }
      
      // Garantir que a URL use HTTPS se o frontend estiver em HTTPS
      if (window.location.protocol === "https:" && fullUrl.startsWith("http://")) {
        fullUrl = fullUrl.replace("http://", "https://");
        console.log("🔒 Convertendo URL para HTTPS:", fullUrl);
      }
      
      console.log("🔗 URL completa:", fullUrl);
      
      // Usar axios para fazer o download (já tem baseURL configurada)
      const response = await api.get(fullUrl, {
        responseType: "blob",
      });

      const blob = response.data;
      console.log("📦 Blob criado, tamanho:", blob.size, "bytes");
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      
      console.log("🖱️  Clicando no link de download...");
      link.click();
      
      // Aguardar um pouco antes de remover para garantir que o download inicie
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        console.log("✅ Download concluído:", fileName);
      }, 200);
    } catch (error: any) {
      console.error("❌ Erro ao fazer download com axios:", error);
      // Tentar fallback com fetch direto
      try {
        let fullUrl = url;
        if (url.startsWith("/")) {
          const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:3000";
          fullUrl = `${apiUrl}${url}`;
        }
        
        // Garantir que a URL use HTTPS se o frontend estiver em HTTPS
        if (window.location.protocol === "https:" && fullUrl.startsWith("http://")) {
          fullUrl = fullUrl.replace("http://", "https://");
          console.log("🔒 Convertendo URL para HTTPS no fallback:", fullUrl);
        }
        
        console.log("🔄 Tentando fallback com fetch:", fullUrl);
        const response = await fetch(fullUrl);
        if (!response.ok) {
          throw new Error(`Erro ao baixar arquivo: ${response.statusText}`);
        }
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = fileName;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(downloadUrl);
        }, 200);
        console.log("✅ Download concluído via fallback:", fileName);
      } catch (fallbackError: any) {
        console.error("❌ Erro no fallback de download:", fallbackError);
        alert(`Erro ao baixar arquivo: ${fallbackError.message}`);
      }
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

    // Adicionar mensagem de status inicial mais descritiva
    const initialStatusId = addStatusMessage(
      "loading",
      "🧠 Analisando sua mensagem e detectando a intenção..."
    );

    // Atualizar mensagem após alguns segundos para mostrar progresso
    const progressInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - parseInt(initialStatusId.split("-")[1])) / 1000);
      if (elapsed > 3 && statusMessageIdRef.current === initialStatusId) {
        replaceStatusMessage(initialStatusId, {
          id: initialStatusId,
          role: "assistant",
          content: "⏳ Processando sua solicitação... Isso pode levar alguns segundos.",
          timestamp: new Date().toISOString(),
          status: "loading",
        });
      }
    }, 1000);

    try {
      // Chamar API do backend
      console.log("📤 Enviando mensagem para o backend...");
      const response = await chatService.sendMessage({ message });
      console.log("✅ Resposta recebida do backend:", {
        intention: response.intention,
        hasResponse: !!response.response,
        hasDownloadUrl: !!response.downloadUrl,
        hasSources: !!response.sources,
      });

      // Limpar intervalo de progresso
      clearInterval(progressInterval);

      // Remover mensagem de status inicial
      setMessages((prev) => prev.filter((msg) => msg.id !== initialStatusId));
      if (statusMessageIdRef.current === initialStatusId) {
        statusMessageIdRef.current = null;
      }

      // Adicionar mensagens de status baseadas na intenção com mais detalhes
      let statusId: string | null = null;
      if (response.intention === "RAG_QUERY") {
        statusId = addStatusMessage(
          "rag",
          "📚 Buscando informações na base de conhecimento...\n\n🔍 Analisando documentos relevantes para sua pergunta."
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
            `🔍 Buscando processo ${response.protocolNumber} no portal e-SAJ...\n\n⏳ Isso pode levar até 1 minuto. Por favor, aguarde.`
          );
          
          // Atualizar mensagem após alguns segundos para mostrar progresso
          setTimeout(() => {
            if (statusId && statusMessageIdRef.current === statusId) {
              replaceStatusMessage(statusId, {
                id: statusId,
                role: "assistant",
                content: `🔍 Buscando processo ${response.protocolNumber} no portal e-SAJ...\n\n📄 Acessando o portal e preenchendo o formulário de busca...`,
                timestamp: new Date().toISOString(),
                status: "esaj_search",
              });
            }
          }, 10000);
          
          setTimeout(() => {
            if (statusId && statusMessageIdRef.current === statusId) {
              replaceStatusMessage(statusId, {
                id: statusId,
                role: "assistant",
                content: `🔍 Buscando processo ${response.protocolNumber} no portal e-SAJ...\n\n⏳ Aguardando resposta do portal... Isso pode levar alguns segundos.`,
                timestamp: new Date().toISOString(),
                status: "esaj_search",
              });
            }
          }, 20000);
        }
      } else {
        // Para outras intenções (GENERAL_QUERY), adicionar mensagem mais descritiva
        statusId = addStatusMessage(
          "loading",
          "🤔 Processando sua pergunta...\n\n💭 Gerando resposta personalizada para você."
        );
      }

      // Simular delay mínimo para mostrar status (opcional)
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verificar se há link de download na resposta
      const downloadLink = extractDownloadLink(response.response);
      let displayContent = response.response;

      // Se for download, adicionar status de download com mais detalhes
      if (response.intention === "DOWNLOAD_DOCUMENT" && statusId) {
        replaceStatusMessage(statusId, {
          id: statusId,
          role: "assistant",
          content: "✅ Processo encontrado!\n\n📥 Acessando a pasta digital e preparando o download do documento...",
          timestamp: new Date().toISOString(),
          status: "esaj_download",
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        // Atualizar para mostrar progresso do download
        replaceStatusMessage(statusId, {
          id: statusId,
          role: "assistant",
          content: "✅ Processo encontrado!\n\n📥 Baixando documento do e-SAJ... Isso pode levar alguns segundos.",
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
      console.error("❌ Erro ao enviar mensagem:", err);
      console.error("   Detalhes do erro:", {
        message: err.message,
        code: err.code,
        response: err.response?.data,
        status: err.response?.status,
        config: err.config,
      });

      // Limpar intervalo de progresso se existir
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      // Remover mensagem de status se existir
      if (statusMessageIdRef.current) {
        removeStatusMessage(statusMessageIdRef.current);
      }

      // Determinar mensagem de erro mais descritiva
      let errorContent = "Desculpe, ocorreu um erro ao processar sua mensagem.";
      let errorDetails = "";

      if (err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        errorContent = "❌ Erro de conexão";
        errorDetails = "Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.";
      } else if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        errorContent = "⏳ Tempo de espera esgotado";
        errorDetails = "A operação está demorando mais que o esperado. Isso pode acontecer com buscas no e-SAJ. Por favor, tente novamente.";
      } else if (err.response?.status === 500) {
        errorContent = "⚠️ Erro no servidor";
        errorDetails = err.response?.data?.error || err.response?.data?.message || "O servidor encontrou um erro ao processar sua solicitação. Tente novamente em alguns instantes.";
      } else if (err.response?.status === 404) {
        errorContent = "🔍 Recurso não encontrado";
        errorDetails = "O endpoint solicitado não foi encontrado. Isso pode indicar um problema de configuração.";
      } else if (err.response?.status === 403) {
        errorContent = "🔒 Acesso negado";
        errorDetails = "Você não tem permissão para realizar esta operação.";
      } else if (err.response?.data?.error) {
        errorContent = "❌ Erro";
        errorDetails = err.response.data.error;
      } else if (err.response?.data?.message) {
        errorContent = "❌ Erro";
        errorDetails = err.response.data.message;
      } else if (err.message) {
        errorContent = "❌ Erro";
        errorDetails = err.message;
      } else {
        errorDetails = "Por favor, tente novamente. Se o problema persistir, entre em contato com o suporte.";
      }

      // Adicionar mensagem de erro ao histórico
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `${errorContent}\n\n${errorDetails}`,
        timestamp: new Date().toISOString(),
        isError: true,
      };

      setMessages((prev) => [...prev, errorMessage]);
      setError(errorDetails);
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
