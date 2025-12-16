import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { KnowledgeBasePage } from "./pages/KnowledgeBasePage";
import { ChatPage } from "./pages/ChatPage";
import { MainLayout } from "./components/MainLayout";
import { ThemeProvider } from "./contexts/ThemeContext";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<ChatPage />} />
            <Route path="chat/:chatId" element={<ChatPage />} />
            <Route path="knowledge-base" element={<KnowledgeBasePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
