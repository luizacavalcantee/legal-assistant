import React from "react";
import { ChatMessage } from "../types/chat.types";
import { Loader2, Bot, User, AlertCircle, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Bot
          className="h-16 w-16 text-muted-foreground mb-4"
          strokeWidth={1.5}
        />
        <h3 className="text-lg font-semibold text-muted-foreground mb-2">
          Olá! Sou seu Assistente Jurídico
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Faça uma pergunta sobre questões jurídicas e eu te ajudarei com
          informações precisas e úteis.
        </p>
      </div>
    );
  }

  // Função para obter mensagem de status baseada no status (fallback caso não tenha conteúdo)
  const getStatusMessage = (status?: ChatMessage["status"]): string => {
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

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => {
        const isStatusMessage = message.status && message.status !== "complete";
        const isErrorMessage = message.isError;

        return (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role === "assistant" && (
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  isErrorMessage
                    ? "bg-destructive/10"
                    : isStatusMessage
                    ? "bg-primary/10"
                    : "bg-primary/10"
                }`}
              >
                {isErrorMessage ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : isStatusMessage ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <Bot className="h-5 w-5 text-primary" />
                )}
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : isErrorMessage
                  ? "bg-destructive/10 border border-destructive/20 text-destructive"
                  : isStatusMessage
                  ? "bg-muted/50 text-muted-foreground border border-muted"
                  : "bg-muted text-foreground"
              }`}
            >
              {isStatusMessage ? (
                <p
                  className={`text-sm whitespace-pre-wrap break-words ${
                    isErrorMessage ? "text-destructive" : ""
                  }`}
                >
                  {getStatusMessage(message.status)}
                </p>
              ) : (
                <div
                  className={`text-sm prose prose-sm dark:prose-invert max-w-none break-words ${
                    isErrorMessage ? "text-destructive" : ""
                  }`}
                >
                  <ReactMarkdown
                    components={{
                      p: ({ children }: { children?: React.ReactNode }) => (
                        <p className="mb-3 last:mb-0 leading-relaxed">
                          {children}
                        </p>
                      ),
                      strong: ({
                        children,
                      }: {
                        children?: React.ReactNode;
                      }) => (
                        <strong className="font-semibold">{children}</strong>
                      ),
                      em: ({ children }: { children?: React.ReactNode }) => (
                        <em className="italic">{children}</em>
                      ),
                      ul: ({ children }: { children?: React.ReactNode }) => (
                        <ul className="list-disc list-inside mb-3 space-y-1.5 ml-2">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }: { children?: React.ReactNode }) => (
                        <ol className="list-decimal list-inside mb-3 space-y-1.5 ml-2">
                          {children}
                        </ol>
                      ),
                      li: ({ children }: { children?: React.ReactNode }) => (
                        <li className="ml-1">{children}</li>
                      ),
                      h1: ({ children }: { children?: React.ReactNode }) => (
                        <h1 className="text-lg font-bold mb-3 mt-4 first:mt-0">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }: { children?: React.ReactNode }) => (
                        <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }: { children?: React.ReactNode }) => (
                        <h3 className="text-sm font-bold mb-1.5 mt-2 first:mt-0">
                          {children}
                        </h3>
                      ),
                      br: () => <br />,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}

              {/* Exibir sources se disponíveis */}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Fontes usadas:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {message.sources.map((source, index) => (
                      <span
                        key={`${source.document_id}-${source.chunk_index}`}
                        className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-md"
                        title={`Score: ${source.score.toFixed(2)}`}
                      >
                        {source.titulo || `Documento ${index + 1}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <span
                className={`text-xs mt-1 block ${
                  message.role === "user"
                    ? "text-primary-foreground/70"
                    : isErrorMessage
                    ? "text-destructive/70"
                    : "text-muted-foreground"
                }`}
              >
                {formatTime(message.timestamp)}
              </span>
            </div>

            {message.role === "user" && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </div>
        );
      })}

      {isLoading &&
        !messages.some((msg) => msg.status && msg.status !== "complete") && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Pensando...</span>
            </div>
          </div>
        )}
    </div>
  );
}
