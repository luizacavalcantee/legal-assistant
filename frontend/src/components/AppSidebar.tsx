import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  MessageSquare,
  Edit2,
  Trash2,
  Database,
  Moon,
  Sun,
} from "lucide-react";
import { ChatSession } from "../types/chat.types";
import {
  loadChatSessions,
  deleteChatSession,
  updateChatTitle,
} from "../utils/chatStorage";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  SidebarSeparator,
  useSidebar,
} from "./ui/sidebar";
import { useTheme } from "../contexts/ThemeContext";
import logo from "../assets/logo.svg?url";

interface AppSidebarProps {
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
}

export function AppSidebar({ onChatSelect, onNewChat }: AppSidebarProps) {
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId: string }>();
  const { state } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const isCollapsed = state === "collapsed";
  const [sessions, setSessions] = useState<ChatSession[]>(loadChatSessions());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  // Recarregar sessões quando necessário
  const refreshSessions = () => {
    setSessions(loadChatSessions());
  };

  // Atualizar sessões quando o Local Storage mudar
  useEffect(() => {
    const interval = setInterval(() => {
      const currentSessions = loadChatSessions();
      // Verificar se houve mudanças (não apenas no tamanho, mas também no conteúdo)
      const hasChanged =
        currentSessions.length !== sessions.length ||
        currentSessions.some((session, index) => {
          const existing = sessions[index];
          return (
            !existing ||
            existing.id !== session.id ||
            existing.updatedAt !== session.updatedAt
          );
        });

      if (hasChanged) {
        setSessions(currentSessions);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sessions]);

  const handleNewChat = () => {
    // Criar ID temporário único sem salvar no Local Storage
    // A sessão só será salva quando houver mensagens
    // Usar timestamp + random para garantir unicidade mesmo em cliques rápidos
    const tempId = `chat-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    onNewChat();
    // Usar replace para evitar histórico de navegação desnecessário
    navigate(`/chat/${tempId}`, { replace: false });
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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5 justify-center">
          <img src={logo} alt="Logo" className="w-8 h-8 flex-shrink-0" />
          {!isCollapsed && (
            <div className="flex flex-col flex-1 min-w-0">
              <h1 className="text-lg font-heading font-semibold truncate">
                JurisIA
              </h1>
            </div>
          )}
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleNewChat}
              tooltip="Novo Chat"
              className="bg-teal-900 text-white items-center justify-center"
            >
              <Plus />
              <span>Novo Chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {sessions.length === 0
                ? !isCollapsed && (
                    <SidebarMenuItem>
                      <div className="text-sm text-sidebar-foreground/70 text-center py-8 px-4">
                        Nenhum chat ainda. Clique em "Novo Chat" para começar.
                      </div>
                    </SidebarMenuItem>
                  )
                : sessions
                    .sort(
                      (a, b) =>
                        new Date(b.updatedAt).getTime() -
                        new Date(a.updatedAt).getTime()
                    )
                    .map((session) => (
                      <SidebarMenuItem key={session.id}>
                        {editingId === session.id ? (
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
                            <SidebarMenuButton
                              onClick={() => {
                                onChatSelect(session.id);
                                navigate(`/chat/${session.id}`);
                              }}
                              isActive={chatId === session.id}
                              tooltip={session.title}
                            >
                              <MessageSquare />
                              <span>{session.title}</span>
                            </SidebarMenuButton>
                            <SidebarMenuAction
                              showOnHover
                              onClick={(e) => handleStartEdit(session, e)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </SidebarMenuAction>
                            <SidebarMenuAction
                              showOnHover
                              onClick={(e) => handleDeleteChat(session.id, e)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </SidebarMenuAction>
                          </>
                        )}
                      </SidebarMenuItem>
                    ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate("/knowledge-base")}
              tooltip="Base de Conhecimento"
            >
              <Database />
              <span>Base de Conhecimento</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarSeparator />
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
              <span>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
