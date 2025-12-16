import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "./ui/button";
import {
  Plus,
  MessageSquare,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Database,
} from "lucide-react";
import { ChatSession } from "../types/chat.types";
import {
  loadChatSessions,
  deleteChatSession,
  updateChatTitle,
} from "../utils/chatStorage";
import { useSidebar } from "../contexts/SidebarContext";
import logo from "../assets/logo.svg?url";

interface SidebarProps {
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
}

export function Sidebar({ onChatSelect, onNewChat }: SidebarProps) {
  const { isExpanded, toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId: string }>();
  const [sessions, setSessions] = useState<ChatSession[]>(loadChatSessions());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  // Recarregar sessões quando necessário
  const refreshSessions = () => {
    setSessions(loadChatSessions());
  };

  const handleNewChat = () => {
    // Criar ID temporário sem salvar no Local Storage
    // A sessão só será salva quando houver mensagens
    const tempId = `chat-${Date.now()}`;
    onNewChat();
    navigate(`/chat/${tempId}`);
  };

  const handleDeleteChat = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Tem certeza que deseja excluir este chat?")) {
      deleteChatSession(sessionId);
      refreshSessions();
      // Se o chat deletado era o atual, redirecionar para novo chat
      if (sessionId === chatId) {
        const remainingSessions = loadChatSessions();
        if (remainingSessions.length > 0) {
          navigate(`/chat/${remainingSessions[0].id}`);
        } else {
          handleNewChat();
        }
      }
    }
  };

  const handleStartEdit = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditingTitle(session.title);
  };

  const handleSaveEdit = (sessionId: string) => {
    if (editingTitle.trim()) {
      updateChatTitle(sessionId, editingTitle.trim());
      refreshSessions();
    }
    setEditingId(null);
    setEditingTitle("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === "Enter") {
      handleSaveEdit(sessionId);
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  return (
    <div
      className={`relative h-screen bg-card border-r border-border flex flex-col transition-all duration-300 ${
        isExpanded ? "w-64" : "w-16"
      }`}
    >
      {/* Logo e Título */}
      <div className="p-4 border-b border-border relative">
        <div className="flex items-center gap-3 mb-3">
          <img src={logo} alt="Logo" className="w-8 h-8 flex-shrink-0" />
          {isExpanded && (
            <h1 className="text-xl font-heading font-semibold whitespace-nowrap text-teal-900">
              JurisIA
            </h1>
          )}
        </div>
        <Button
          onClick={handleNewChat}
          className={isExpanded ? "w-full bg-teal-700" : "w-full px-0 bg-teal-700"}
          size="sm"
          title={!isExpanded ? "Novo Chat" : undefined}
        >
          <Plus className="h-4 w-4" />
          {isExpanded && <span className="ml-2">Novo Chat</span>}
        </Button>

        {/* Botão de Toggle */}
        <Button
          variant="outline"
          size="icon"
          className="absolute top-4 right-0 translate-x-1/2 h-6 w-6 rounded-full bg-card border-2 border-border shadow-sm z-10"
          onClick={toggleSidebar}
          title={isExpanded ? "Retrair sidebar" : "Expandir sidebar"}
        >
          {isExpanded ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Histórico de Chats */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {sessions.length === 0 ? (
            <div
              className={`text-sm text-muted-foreground text-center py-8 ${
                isExpanded ? "px-4" : "px-2"
              }`}
            >
              {isExpanded
                ? "Nenhum chat ainda. Clique em 'Novo Chat' para começar."
                : "Nenhum chat"}
            </div>
          ) : (
            sessions
              .sort(
                (a, b) =>
                  new Date(b.updatedAt).getTime() -
                  new Date(a.updatedAt).getTime()
              )
              .map((session) => (
                <div
                  key={session.id}
                  className={`group relative rounded-lg p-2 cursor-pointer transition-colors ${
                    chatId === session.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => {
                    onChatSelect(session.id);
                    navigate(`/chat/${session.id}`);
                  }}
                  title={!isExpanded ? session.title : undefined}
                >
                  {editingId === session.id && isExpanded ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleSaveEdit(session.id)}
                      onKeyDown={(e) => handleKeyDown(e, session.id)}
                      className="w-full bg-background text-foreground px-2 py-1 rounded text-sm"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 flex-shrink-0" />
                        {isExpanded && (
                          <span className="text-sm truncate flex-1">
                            {session.title}
                          </span>
                        )}
                      </div>
                      {isExpanded && (
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => handleStartEdit(session, e)}
                            title="Editar título"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={(e) => handleDeleteChat(session.id, e)}
                            title="Excluir chat"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
          )}
        </div>
      </div>

      {/* Divisória e Botão Base de Conhecimento */}
      <div className="border-t border-border p-2">
        <Button
          variant="outline"
          className={isExpanded ? "w-full" : "w-full px-0"}
          onClick={() => navigate("/knowledge-base")}
          title={!isExpanded ? "Base de Conhecimento" : undefined}
        >
          <Database className="h-4 w-4" />
          {isExpanded && <span className="ml-2">Base de Conhecimento</span>}
        </Button>
      </div>
    </div>
  );
}
