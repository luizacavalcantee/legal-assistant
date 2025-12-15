import { Request, Response } from "express";
import { DocumentService } from "../services/DocumentService";
import { CreateDocumentDto, UpdateDocumentDto } from "../types/document.types";
import * as path from "path";

export class DocumentController {
  private service: DocumentService;

  constructor(service: DocumentService) {
    this.service = service;
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

      // Se há arquivo enviado, usar o caminho absoluto do arquivo salvo
      if (file) {
        // file.path já é o caminho completo retornado pelo multer
        caminhoArquivo = path.resolve(file.path);
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
        caminho_arquivo: caminhoArquivo,
      };

      const document = await this.service.createDocument(data, file?.path);

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
    } catch (error) {
      console.error("Erro ao listar documentos:", error);
      return res.status(500).json({
        error: "Erro interno do servidor ao listar documentos",
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

      const fs = require("fs");
      const filePath = document.caminho_arquivo;

      // Verificar se o arquivo existe
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          error: "Arquivo não encontrado no servidor",
        });
      }

      // Determinar o tipo MIME baseado na extensão
      const path = require("path");
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
