import { Router } from "express";
import { ChatController } from "../controllers/ChatController";
import { LLMService } from "../services/LLMService";
import { RAGChainService } from "../services/RAGChainService";
import { eSAJService } from "../services/eSAJService";
import { getQdrantClient } from "../lib/qdrant";
import { EmbeddingService } from "../services/EmbeddingService";

const router = Router();

// Inicializar dependências (padrão de injeção de dependências)
const llmService = new LLMService();

// Inicializar e-SAJ Service
const eSAJServiceInstance = new eSAJService();
console.log("✅ e-SAJ Service inicializado");

// Inicializar RAG Chain Service (opcional - só se Qdrant estiver configurado)
let ragChainService: RAGChainService | undefined = undefined;

if (process.env.QDRANT_URL) {
  try {
    console.log("🔧 Inicializando RAG Chain Service...");
    const qdrantClient = getQdrantClient();
    const embeddingService = new EmbeddingService();

    ragChainService = new RAGChainService(
      qdrantClient,
      embeddingService,
      llmService
    );
    console.log("✅ RAG Chain Service inicializado com sucesso");
  } catch (error: any) {
    console.error("❌ Erro ao inicializar RAG Chain Service:", error.message);
    console.warn("⚠️  Chat funcionará sem RAG (apenas LLM direto)");
    ragChainService = undefined;
  }
} else {
  console.warn("⚠️  QDRANT_URL não definido. Chat funcionará sem RAG (apenas LLM direto)");
}

const chatController = new ChatController(
  llmService,
  ragChainService,
  eSAJServiceInstance
);

// Rota para enviar mensagem ao chat
router.post("/message", (req, res) => chatController.handleChatRequest(req, res));

// Rota para servir arquivos baixados do e-SAJ
router.get("/download/:fileName", (req, res) => chatController.serveDownload(req, res));

export default router;

