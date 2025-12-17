import { Request, Response } from "express";
import { DocumentService } from "../services/DocumentService";
import { GoogleDriveService } from "../services/GoogleDriveService";
import { CreateDocumentDto, UpdateDocumentDto } from "../types/document.types";
import * as path from "path";
import * as fs from "fs";

export class DocumentController {
  private service: DocumentService;
  private googleDriveService: GoogleDriveService;

  constructor(service: DocumentService) {
    this.service = service;
    this.googleDriveService = new GoogleDriveService();
  }

  /**
   * @swagger
   * /documents:
   *   post:
   *     summary: Criar novo documento com upload de arquivo (US-BC-01)
   *     tags: [Documents]
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - titulo
   *               - file
   *             properties:
   *               titulo:
   *                 type: string
   *                 description: Título do documento
   *                 example: "Lei 13.105/2015"
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: Arquivo a ser enviado (PDF, TXT, MD, DOCX - máximo 10MB)
   *     responses:
   *       201:
   *         description: Documento criado com sucesso (indexação iniciada em background)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessResponse'
   *       400:
   *         description: Dados inválidos ou arquivo não fornecido
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Erro interno do servidor
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  async create(req: Request, res: Response): Promise<Response> {
    try {
      // Verificar se há arquivo enviado (multipart/form-data)
      const file = (req as any).file;
      const titulo = req.body.titulo;

      // Validação básica
      if (!titulo) {
        return res.status(400).json({
          error: "Campo 'titulo' é obrigatório",
        });
      }

      let caminhoArquivo: string | undefined;
      let filePathForIndexing: string | undefined;

      // Se há arquivo enviado
      if (file) {
        const localFilePath = path.resolve(file.path);
        
        // Tentar fazer upload para Google Drive se estiver configurado
        if (this.googleDriveService.isConfigured()) {
          try {
            console.log("📤 Fazendo upload para Google Drive...");
            const driveResult = await this.googleDriveService.uploadFile(
              localFilePath,
              file.originalname
            );
            
            if (driveResult) {
              // Salvar o fileId do Google Drive no banco
              caminhoArquivo = `gdrive:${driveResult.fileId}`;
              console.log(`✅ Arquivo enviado para Google Drive: ${driveResult.fileId}`);
              console.log(`   Link de visualização: ${driveResult.webViewLink}`);
            } else {
              // Fallback para armazenamento local
              caminhoArquivo = localFilePath;
            }
          } catch (driveError: any) {
            console.error("❌ Erro ao fazer upload para Google Drive:", driveError);
            console.log("   Usando armazenamento local como fallback");
            caminhoArquivo = localFilePath;
          }
        } else {
          // Google Drive não configurado, usar armazenamento local
          caminhoArquivo = localFilePath;
        }
        
        // Manter arquivo local para indexação
        filePathForIndexing = localFilePath;
      } else if (req.body.caminho_arquivo) {
        // Se não há arquivo, usar o caminho fornecido (compatibilidade com API antiga)
        caminhoArquivo = req.body.caminho_arquivo;
      } else {
        return res.status(400).json({
          error: "É necessário enviar um arquivo ou fornecer 'caminho_arquivo'",
        });
      }

      const data: CreateDocumentDto = {
        titulo,
        caminho_arquivo: caminhoArquivo!,
      };

      const document = await this.service.createDocument(data, filePathForIndexing);

      return res.status(201).json({
        message: "Documento criado com sucesso",
        data: document,
      });
    } catch (error: any) {
      console.error("Erro ao criar documento:", error);
      
      // Limpar arquivo se houve erro
      if ((req as any).file) {
        const fs = require("fs");
        try {
          fs.unlinkSync((req as any).file.path);
        } catch (unlinkError) {
          console.error("Erro ao remover arquivo:", unlinkError);
        }
      }

      return res.status(500).json({
        error: error.message || "Erro interno do servidor ao criar documento",
      });
    }
  }

  /**
   * @swagger
   * /documents:
   *   get:
   *     summary: Listar todos os documentos (US-BC-02)
   *     tags: [Documents]
   *     responses:
   *       200:
   *         description: Lista de documentos
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ListResponse'
   *       500:
   *         description: Erro interno do servidor
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  async list(req: Request, res: Response): Promise<Response> {
    try {
      const documents = await this.service.listDocuments();

      return res.status(200).json({
        message: "Documentos listados com sucesso",
        data: documents,
        total: documents.length,
      });
    } catch (error: any) {
      console.error("Erro ao listar documentos:", error);
      console.error("Stack:", error?.stack);
      
      // Retornar mensagem de erro mais detalhada em desenvolvimento
      const errorMessage = process.env.NODE_ENV === 'production'
        ? "Erro interno do servidor ao listar documentos"
        : error?.message || "Erro desconhecido ao listar documentos";
      
      return res.status(500).json({
        error: errorMessage,
        details: process.env.NODE_ENV !== 'production' ? error?.stack : undefined,
      });
    }
  }

  /**
   * @swagger
   * /documents/{id}:
   *   get:
   *     summary: Buscar documento por ID
   *     tags: [Documents]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do documento
   *     responses:
   *       200:
   *         description: Documento encontrado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessResponse'
   *       404:
   *         description: Documento não encontrado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Erro interno do servidor
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const document = await this.service.getDocumentById(id);

      return res.status(200).json({
        message: "Documento encontrado",
        data: document,
      });
    } catch (error: any) {
      if (error.message === "Documento não encontrado") {
        return res.status(404).json({
          error: error.message,
        });
      }

      console.error("Erro ao buscar documento:", error);
      return res.status(500).json({
        error: "Erro interno do servidor ao buscar documento",
      });
    }
  }

  /**
   * @swagger
   * /documents/{id}:
   *   put:
   *     summary: Atualizar documento (US-BC-03)
   *     tags: [Documents]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do documento
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateDocumentDto'
   *     responses:
   *       200:
   *         description: Documento atualizado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessResponse'
   *       404:
   *         description: Documento não encontrado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Erro interno do servidor
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const data: UpdateDocumentDto = req.body;

      const document = await this.service.updateDocument(id, data);

      return res.status(200).json({
        message: "Documento atualizado com sucesso",
        data: document,
      });
    } catch (error: any) {
      if (error.message === "Documento não encontrado") {
        return res.status(404).json({
          error: error.message,
        });
      }

      console.error("Erro ao atualizar documento:", error);
      return res.status(500).json({
        error: "Erro interno do servidor ao atualizar documento",
      });
    }
  }

  /**
   * @swagger
   * /documents/{id}:
   *   delete:
   *     summary: Remover documento (US-BC-04)
   *     tags: [Documents]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do documento
   *     responses:
   *       200:
   *         description: Documento removido com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Documento removido com sucesso
   *       404:
   *         description: Documento não encontrado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Erro interno do servidor
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      await this.service.deleteDocument(id);

      return res.status(200).json({
        message: "Documento removido com sucesso",
      });
    } catch (error: any) {
      if (error.message === "Documento não encontrado") {
        return res.status(404).json({
          error: error.message,
        });
      }

      console.error("Erro ao remover documento:", error);
      return res.status(500).json({
        error: "Erro interno do servidor ao remover documento",
      });
    }
  }

  /**
   * @swagger
   * /documents/{id}/file:
   *   get:
   *     summary: Baixar/visualizar arquivo do documento
   *     tags: [Documents]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do documento
   *     responses:
   *       200:
   *         description: Arquivo enviado com sucesso
   *         content:
   *           application/pdf:
   *             schema:
   *               type: string
   *               format: binary
   *           text/plain:
   *             schema:
   *               type: string
   *       404:
   *         description: Documento não encontrado ou arquivo não existe
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Erro interno do servidor
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  async getFile(req: Request, res: Response): Promise<Response | void> {
    try {
      const { id } = req.params;

      const document = await this.service.getDocumentById(id);

      if (!document) {
        return res.status(404).json({
          error: "Documento não encontrado",
        });
      }

      let filePath = document.caminho_arquivo;
      let isGoogleDrive = false;
      let googleDriveFileId: string | null = null;

      // Verificar se o arquivo está no Google Drive
      if (filePath.startsWith("gdrive:")) {
        isGoogleDrive = true;
        googleDriveFileId = filePath.replace("gdrive:", "");
        console.log(`📁 Arquivo no Google Drive: ${googleDriveFileId}`);
      } else {
        // Arquivo local - construir caminho absoluto
        if (!path.isAbsolute(filePath)) {
          const documentsBasePath = process.env.DOCUMENTS_BASE_PATH || "./documents";
          filePath = path.resolve(documentsBasePath, filePath);
        }
      }

      // Se for Google Drive, fazer download
      if (isGoogleDrive && googleDriveFileId) {
        try {
          const fileBuffer = await this.googleDriveService.downloadFile(googleDriveFileId);
          
          if (!fileBuffer) {
            return res.status(404).json({
              error: "Arquivo não encontrado no Google Drive",
            });
          }

          // Obter link de visualização
          const viewLink = await this.googleDriveService.getFileViewLink(googleDriveFileId);
          
          // Determinar tipo MIME
          const ext = path.extname(document.titulo).toLowerCase();
          let contentType = "application/octet-stream";
          switch (ext) {
            case ".pdf":
              contentType = "application/pdf";
              break;
            case ".txt":
              contentType = "text/plain";
              break;
            case ".md":
              contentType = "text/markdown";
              break;
            case ".docx":
              contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
              break;
          }

          // Enviar arquivo
          res.setHeader("Content-Type", contentType);
          res.setHeader(
            "Content-Disposition",
            `inline; filename="${document.titulo}"`
          );
          
          // Se houver link de visualização, adicionar header customizado
          if (viewLink) {
            res.setHeader("X-Google-Drive-View-Link", viewLink);
          }

          return res.send(fileBuffer);
        } catch (error: any) {
          console.error("❌ Erro ao fazer download do Google Drive:", error);
          return res.status(500).json({
            error: "Erro ao buscar arquivo no Google Drive",
            message: error.message,
          });
        }
      }

      // Arquivo local - verificar se existe
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Arquivo não encontrado: ${filePath}`);
        console.error(`   Document ID: ${id}`);
        console.error(`   Caminho no banco: ${document.caminho_arquivo}`);
        
        return res.status(404).json({
          error: "Arquivo não encontrado no servidor",
          message: `O arquivo não foi encontrado no caminho: ${filePath}. Isso pode acontecer após um redeploy no Render, pois o sistema de arquivos é efêmero.`,
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
        case ".md":
          contentType = "text/markdown";
          break;
        case ".docx":
          contentType =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          break;
      }

      // Enviar arquivo
      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${path.basename(filePath)}"`
      );

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error: any) {
      if (error.message === "Documento não encontrado") {
        return res.status(404).json({
          error: error.message,
        });
      }

      console.error("Erro ao buscar arquivo:", error);
      return res.status(500).json({
        error: "Erro interno do servidor ao buscar arquivo",
      });
    }
  }
}
