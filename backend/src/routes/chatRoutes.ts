import { Router } from "express";
import { ChatController } from "../controllers/ChatController";
import { LLMService } from "../services/LLMService";

const router = Router();

// Inicializar dependências (padrão de injeção de dependências)
const llmService = new LLMService();
const chatController = new ChatController(llmService);

// Rota para enviar mensagem ao chat
router.post("/message", (req, res) => chatController.handleChatRequest(req, res));

export default router;

