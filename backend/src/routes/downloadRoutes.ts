import { Router } from "express";
import { DownloadController } from "../controllers/DownloadController";

const router = Router();
const downloadController = new DownloadController();

/**
 * @swagger
 * /download/file/{filename}:
 *   get:
 *     summary: Baixar arquivo PDF baixado do e-SAJ
 *     tags: [Downloads]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Nome do arquivo a ser baixado
 *     responses:
 *       200:
 *         description: Arquivo enviado com sucesso
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Arquivo não encontrado
 */
router.get("/file/:filename", (req, res) => {
  downloadController.downloadFile(req, res);
});

export default router;

