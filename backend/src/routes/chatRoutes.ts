import { Router } from "express";
import { ChatController } from "../controllers/ChatController";
import { LLMService } from "../services/LLMService";
import { RAGChainService } from "../services/RAGChainService";
import { eSAJService } from "../services/eSAJService";
import { getQdrantClient } from "../lib/qdrant";
import { EmbeddingService } from "../services/EmbeddingService";
import { DocumentService } from "../services/DocumentService";
import { DocumentRepository } from "../repositories/DocumentRepository";
import { IndexingService } from "../services/IndexingService";
import { DocumentProcessor } from "../services/DocumentProcessor";

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
  console.warn(
    "⚠️  QDRANT_URL não definido. Chat funcionará sem RAG (apenas LLM direto)"
  );
}

// Inicializar DocumentService para integração com Google Drive e Base de Conhecimento
let documentService: DocumentService | undefined = undefined;

if (process.env.QDRANT_URL) {
  try {
    console.log(
      "🔧 Inicializando DocumentService para integração com Google Drive..."
    );
    const qdrantClient = getQdrantClient();
    const embeddingService = new EmbeddingService();
    const documentProcessor = new DocumentProcessor();
    const documentRepository = new DocumentRepository();

    const indexingService = new IndexingService(
      qdrantClient,
      embeddingService,
      documentProcessor,
      documentRepository
    );

    documentService = new DocumentService(documentRepository, indexingService);
    console.log("✅ DocumentService inicializado com sucesso");
  } catch (error: any) {
    console.error("❌ Erro ao inicializar DocumentService:", error.message);
    console.warn(
      "⚠️  Documentos do e-SAJ não serão salvos na Base de Conhecimento"
    );
    documentService = undefined;
  }
} else {
  console.warn(
    "⚠️  QDRANT_URL não definido. DocumentService não será inicializado."
  );
}

const chatController = new ChatController(
  llmService,
  ragChainService,
  eSAJServiceInstance,
  documentService
);

// Rota para enviar mensagem ao chat (modo tradicional - resposta única)
router.post("/message", (req, res) =>
  chatController.handleChatRequest(req, res)
);

// Rota para enviar mensagem ao chat com SSE (progresso em tempo real)
router.post("/message-stream", (req, res) =>
  chatController.handleChatRequestSSE(req, res)
);

// Rota para servir arquivos baixados do e-SAJ
router.get("/download/:fileName", (req, res) =>
  chatController.serveDownload(req, res)
);

export default router;
