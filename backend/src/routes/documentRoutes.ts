import { Router } from "express";
import { DocumentController } from "../controllers/DocumentController";
import { DocumentService } from "../services/DocumentService";
import { DocumentRepository } from "../repositories/DocumentRepository";
import { IndexingService } from "../services/IndexingService";
import { getQdrantClient } from "../lib/qdrant";
import { EmbeddingService } from "../services/EmbeddingService";
import { DocumentProcessor } from "../services/DocumentProcessor";
import { uploadSingle } from "../middleware/upload";

const router = Router();

// Inicializar dependências (padrão de injeção de dependências)
const repository = new DocumentRepository();

// Inicializar serviços de RAG (opcional - só se Qdrant estiver configurado)
let indexingService: IndexingService | undefined;
try {
  const qdrantClient = getQdrantClient();
  const embeddingService = new EmbeddingService();
  const documentProcessor = new DocumentProcessor();

  // Inicializar coleção no Qdrant
  qdrantClient.initializeCollection().catch((error) => {
    console.warn("⚠️  Qdrant não disponível. Indexação vetorial desabilitada:", error.message);
  });

  indexingService = new IndexingService(
    qdrantClient,
    embeddingService,
    documentProcessor,
    repository
  );
} catch (error: any) {
  console.warn("⚠️  Serviços de RAG não inicializados:", error.message);
  console.warn("   A indexação vetorial estará desabilitada.");
}

const service = new DocumentService(repository, indexingService);
const controller = new DocumentController(service);

// Rotas
// POST com upload de arquivo (multipart/form-data)
router.post("/", (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err) {
      // Erro do multer (tipo de arquivo, tamanho, etc.)
      return res.status(400).json({
        error: err.message || "Erro ao processar arquivo",
      });
    }
    // Chamar controller
    controller.create(req, res).catch(next);
  });
});
router.get("/", (req, res) => controller.list(req, res));
router.get("/:id", (req, res) => controller.getById(req, res));
router.get("/:id/file", (req, res) => controller.getFile(req, res));
router.put("/:id", (req, res) => controller.update(req, res));
router.delete("/:id", (req, res) => controller.delete(req, res));

export default router;

