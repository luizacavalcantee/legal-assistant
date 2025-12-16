import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SidebarContextType {
  isExpanded: boolean;
  toggleSidebar: () => void;
  expandSidebar: () => void;
  collapseSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const SIDEBAR_STATE_KEY = "sidebar_expanded_state";

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Carregar estado inicial do Local Storage (padrão: expandida)
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STATE_KEY);
      return stored !== null ? stored === "true" : true;
    } catch {
      return true;
    }
  });

  // Salvar estado no Local Storage quando mudar
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STATE_KEY, String(isExpanded));
    } catch (error) {
      console.error("Erro ao salvar estado da sidebar:", error);
    }
  }, [isExpanded]);

  const toggleSidebar = () => {
    setIsExpanded((prev) => !prev);
  };

  const expandSidebar = () => {
    setIsExpanded(true);
  };

  const collapseSidebar = () => {
    setIsExpanded(false);
  };

  return (
    <SidebarContext.Provider
      value={{ isExpanded, toggleSidebar, expandSidebar, collapseSidebar }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar deve ser usado dentro de um SidebarProvider");
  }
  return context;
}

