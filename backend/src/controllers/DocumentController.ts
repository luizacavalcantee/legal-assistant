import { Request, Response } from "express";
import { DocumentService } from "../services/DocumentService";
import { CreateDocumentDto, UpdateDocumentDto } from "../types/document.types";

export class DocumentController {
  private service: DocumentService;

  constructor(service: DocumentService) {
    this.service = service;
  }

  /**
   * @swagger
   * /documents:
   *   post:
   *     summary: Criar novo documento (US-BC-01)
   *     tags: [Documents]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateDocumentDto'
   *     responses:
   *       201:
   *         description: Documento criado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessResponse'
   *       400:
   *         description: Dados inválidos
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
      const data: CreateDocumentDto = req.body;

      // Validação básica
      if (!data.titulo || !data.caminho_arquivo) {
        return res.status(400).json({
          error: "Campos 'titulo' e 'caminho_arquivo' são obrigatórios",
        });
      }

      const document = await this.service.createDocument(data);

      return res.status(201).json({
        message: "Documento criado com sucesso",
        data: document,
      });
    } catch (error) {
      console.error("Erro ao criar documento:", error);
      return res.status(500).json({
        error: "Erro interno do servidor ao criar documento",
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
}
