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

// Variável compartilhada para IndexingService (será atualizada após inicialização)
let indexingService: IndexingService | undefined = undefined;

// Função para inicializar RAG
async function initializeRAGServices(): Promise<void> {
  if (!process.env.QDRANT_URL) {
    console.warn(
      "⚠️  QDRANT_URL não definido. Indexação vetorial desabilitada."
    );
    return;
  }

  try {
    console.log("🔧 Inicializando serviços de RAG...");
    const qdrantClient = getQdrantClient();
    const embeddingService = new EmbeddingService();
    const documentProcessor = new DocumentProcessor();

    // Inicializar coleção no Qdrant com timeout de 10 segundos
    try {
      const initPromise = qdrantClient.initializeCollection();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Timeout ao inicializar Qdrant (10s)")),
          10000
        )
      );

      await Promise.race([initPromise, timeoutPromise]);
      console.log("✅ Qdrant inicializado com sucesso");

      indexingService = new IndexingService(
        qdrantClient,
        embeddingService,
        documentProcessor,
        repository
      );
      console.log("✅ Serviços de RAG inicializados com sucesso");
      console.log(`   IndexingService disponível: ${indexingService ? 'SIM' : 'NÃO'}`);
      
      // Atualizar o DocumentService para garantir que o getter funcione
      // Usar o setter do Object.defineProperty para atualizar
      if (service) {
        (service as any).indexingService = indexingService;
        console.log("✅ DocumentService atualizado com IndexingService");
      }
    } catch (initError: any) {
      console.error("❌ Erro ao inicializar Qdrant:", initError.message);
      console.error("   Detalhes:", initError);
      console.warn(
        "⚠️  Indexação vetorial desabilitada. Verifique se o Qdrant está rodando."
      );
      console.warn(`   URL configurada: ${process.env.QDRANT_URL}`);
      indexingService = undefined;
    }
  } catch (error: any) {
    console.error("❌ Erro ao inicializar serviços de RAG:", error.message);
    console.error("   Stack:", error.stack);
    console.warn("⚠️  A indexação vetorial estará desabilitada.");
    indexingService = undefined;
  }
}

// Criar DocumentService com getter que verifica a variável compartilhada
const service = new DocumentService(repository, undefined);
// Substituir o getter do indexingService para verificar a variável compartilhada
Object.defineProperty(service, "indexingService", {
  get: () => indexingService,
  set: (value) => {
    indexingService = value;
  },
  enumerable: true,
  configurable: true,
});

const controller = new DocumentController(service);

// Inicializar RAG em background (não bloqueia o carregamento do módulo)
initializeRAGServices().catch((error) => {
  console.error("❌ Erro fatal ao inicializar RAG:", error);
  indexingService = undefined;
});

// Rotas
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
router.get("/", (req, res, next) => {
  controller.list(req, res).catch(next);
});
router.get("/:id", (req, res) => controller.getById(req, res));
router.get("/:id/file", (req, res) => controller.getFile(req, res));
router.put("/:id", (req, res) => controller.update(req, res));
router.delete("/:id", (req, res) => controller.delete(req, res));

export default router;
