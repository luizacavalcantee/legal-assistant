import { Outlet, useNavigate, useParams } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "./ui/sidebar";
import { useEffect } from "react";
import { loadChatSessions } from "../utils/chatStorage";

export function MainLayout() {
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId: string }>();

  // Se não há chatId, criar ou redirecionar para o primeiro chat
  useEffect(() => {
    const currentPath = window.location.pathname;
    // Só redirecionar se estiver na rota raiz ou /chat sem ID
    if (currentPath === "/" || currentPath === "/chat" || currentPath === "/chat/") {
      const sessions = loadChatSessions();
      if (sessions.length > 0) {
        // Redirecionar para o chat mais recente
        const mostRecent = sessions.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0];
        navigate(`/chat/${mostRecent.id}`, { replace: true });
      } else {
        // Criar ID temporário sem salvar - só será salvo quando houver mensagens
        const tempId = `chat-${Date.now()}`;
        navigate(`/chat/${tempId}`, { replace: true });
      }
    }
  }, [chatId, navigate]);

  const handleChatSelect = (_selectedChatId: string) => {
    // A navegação será feita pelo AppSidebar
  };

  const handleNewChat = () => {
    // A navegação será feita pelo AppSidebar
  };

  return (
    <SidebarProvider>
      <AppSidebar onChatSelect={handleChatSelect} onNewChat={handleNewChat} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <div className="flex flex-1 flex-col overflow-hidden">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

