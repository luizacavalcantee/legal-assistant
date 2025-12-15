import { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";

/**
 * Controller para servir arquivos baixados do e-SAJ
 */
export class DownloadController {
  private downloadsDir: string;

  constructor() {
    // Diretório para downloads temporários
    this.downloadsDir =
      process.env.DOWNLOADS_DIR || path.join(process.cwd(), "downloads_esaj");

    // Criar diretório se não existir
    if (!fs.existsSync(this.downloadsDir)) {
      fs.mkdirSync(this.downloadsDir, { recursive: true });
    }
  }

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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Arquivo não encontrado
   *       500:
   *         description: Erro interno do servidor
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Erro interno do servidor ao buscar arquivo
   */
  async downloadFile(req: Request, res: Response): Promise<Response | void> {
    try {
      const { filename } = req.params;

      // Validar nome do arquivo (prevenir path traversal)
      if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
        return res.status(400).json({
          error: "Nome de arquivo inválido",
        });
      }

      const filePath = path.join(this.downloadsDir, filename);

      // Verificar se o arquivo existe
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          error: "Arquivo não encontrado",
        });
      }

      // Verificar se é um arquivo (não um diretório)
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return res.status(404).json({
          error: "Arquivo não encontrado",
        });
      }

      // Verificar se o arquivo não está vazio
      if (stats.size === 0) {
        return res.status(404).json({
          error: "Arquivo está vazio",
        });
      }

      // Determinar o tipo MIME baseado na extensão
      const ext = path.extname(filePath).toLowerCase();
      let contentType = "application/octet-stream";

      switch (ext) {
        case ".pdf":
          contentType = "application/pdf";
          break;
        case ".txt":
          contentType = "text/plain";
          break;
        case ".doc":
          contentType = "application/msword";
          break;
        case ".docx":
          contentType =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          break;
      }

      // Configurar headers para forçar download no navegador
      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("Content-Length", stats.size.toString());

      // Enviar arquivo usando streaming
      const fileStream = fs.createReadStream(filePath);
      
      fileStream.on("error", (error) => {
        console.error("Erro ao ler arquivo:", error);
        if (!res.headersSent) {
          res.status(500).json({
            error: "Erro ao ler arquivo",
          });
        }
      });

      fileStream.pipe(res);
    } catch (error: any) {
      console.error("Erro ao buscar arquivo:", error);
      if (!res.headersSent) {
        return res.status(500).json({
          error: "Erro interno do servidor ao buscar arquivo",
        });
      }
    }
  }

  /**
   * Remove arquivos antigos do diretório de downloads (limpeza automática)
   * @param maxAgeHours - Idade máxima em horas (padrão: 24 horas)
   */
  async cleanupOldFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      if (!fs.existsSync(this.downloadsDir)) {
        return;
      }

      const files = fs.readdirSync(this.downloadsDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000; // Converter para milissegundos

      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.downloadsDir, file);
        const stats = fs.statSync(filePath);

        // Verificar se é um arquivo e se é antigo
        if (stats.isFile() && now - stats.mtime.getTime() > maxAge) {
          try {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`🗑️  Arquivo antigo removido: ${file}`);
          } catch (error: any) {
            console.error(`❌ Erro ao remover arquivo ${file}:`, error.message);
          }
        }
      }

      if (deletedCount > 0) {
        console.log(`✅ Limpeza concluída: ${deletedCount} arquivo(s) removido(s)`);
      }
    } catch (error: any) {
      console.error("❌ Erro ao limpar arquivos antigos:", error);
    }
  }
}

