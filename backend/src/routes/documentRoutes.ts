import { Router } from "express";
import { DocumentController } from "../controllers/DocumentController";
import { DocumentService } from "../services/DocumentService";
import { DocumentRepository } from "../repositories/DocumentRepository";

const router = Router();

// Inicializar dependências (padrão de injeção de dependências)
const repository = new DocumentRepository();
const service = new DocumentService(repository);
const controller = new DocumentController(service);

// Rotas
router.post("/", (req, res) => controller.create(req, res));
router.get("/", (req, res) => controller.list(req, res));
router.get("/:id", (req, res) => controller.getById(req, res));
router.put("/:id", (req, res) => controller.update(req, res));
router.delete("/:id", (req, res) => controller.delete(req, res));

export default router;

