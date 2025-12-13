import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { KnowledgeBasePage } from "./pages/KnowledgeBasePage";
import { ChatPage } from "./pages/ChatPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/knowledge-base" replace />} />
        <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
