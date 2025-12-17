import { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { LLMService } from "../services/LLMService";
import { RAGChainService } from "../services/RAGChainService";
import {
  IntentDetectionService,
  UserIntent,
} from "../services/IntentDetectionService";
import { eSAJService as eSAJServiceClass } from "../services/eSAJService";
import { ChatMessageRequest } from "../types/chat.types";
import { GoogleDriveService } from "../services/GoogleDriveService";
import { DocumentService } from "../services/DocumentService";
import {
  RequestValidator,
  ResponseBuilder,
  SSEHelper,
  IntentRouter,
} from "./chat";

export class ChatController {
  private llmService: LLMService;
  private ragChainService?: RAGChainService;
  private intentDetectionService: IntentDetectionService;
  private eSAJService: eSAJServiceClass;
  private googleDriveService: GoogleDriveService;
  private documentService?: DocumentService;
  private intentRouter: IntentRouter;

  constructor(
    llmService: LLMService,
    ragChainService?: RAGChainService,
    eSAJService?: eSAJServiceClass,
    documentService?: DocumentService
  ) {
    this.llmService = llmService;
    this.ragChainService = ragChainService;
    this.intentDetectionService = new IntentDetectionService(llmService);
    this.eSAJService = eSAJService ?? new eSAJServiceClass();
    this.googleDriveService = new GoogleDriveService();
    this.documentService = documentService;
    this.intentRouter = new IntentRouter(
      llmService,
      this.eSAJService,
      this.googleDriveService,
      ragChainService,
      documentService
    );
  }

  /**
   * @swagger
   * /chat/message:
   *   post:
   *     summary: Enviar mensagem para o assistente jurídico (LLM, RAG, e-SAJ)
   *     description: |
   *       O sistema detecta automaticamente a intenção do usuário e roteia para:
   *       - **RAG_QUERY:** Busca na base de conhecimento indexada
   *       - **DOWNLOAD_DOCUMENT:** Download de documento do e-SAJ
   *       - **SUMMARIZE_PROCESS:** Resumo completo de processo judicial
   *       - **SUMMARIZE_DOCUMENT:** Resumo de documento específico do processo
   *       - **QUERY_DOCUMENT:** Pergunta sobre conteúdo de documento
   *       - **GENERAL_QUERY:** Resposta genérica com LLM
   *     tags: [Chat]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ChatMessageRequest'
   *     responses:
   *       200:
   *         description: Resposta gerada com sucesso (pode incluir resumo, download, RAG, etc.)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ChatMessageResponse'
   *       400:
   *         description: Mensagem não fornecida ou inválida
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Erro interno do servidor ou na comunicação com o LLM/e-SAJ
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  async handleChatRequest(req: Request, res: Response): Promise<Response> {
    try {
      const { message }: ChatMessageRequest = req.body;

      // Validação
      const validation = RequestValidator.validateChatMessage(req);
      if (!validation.isValid) {
        return res.status(validation.statusCode!).json({
          error: validation.error,
        });
      }

      // Detectar intenção
      console.log("🧠 Detectando intenção do usuário...");
      const intentResult = await this.intentDetectionService.detectIntent(
        message.trim()
      );
      console.log(
        `✅ Intenção detectada: ${intentResult.intention}${
          intentResult.protocolNumber
            ? ` (Protocolo: ${intentResult.protocolNumber})`
            : ""
        }`
      );

      // Rotear para o handler apropriado
      const result = await this.intentRouter.route(
        intentResult,
        message.trim(),
        req
      );

      // Construir resposta final
      const chatResponse = ResponseBuilder.createChatResponse(
        message,
        result.response,
        intentResult.intention,
        intentResult.protocolNumber,
        intentResult.documentType,
        result.downloadUrl,
        result.fileName,
        result.sources
      );

      return res.status(200).json(chatResponse);
    } catch (error: any) {
      return this.handleError(res, error);
    }
  }

  /**
   * Trata erros do chat
   */
  private handleError(res: Response, error: any): Response {
    console.error("Erro ao processar requisição de chat:", error);

    // Erro 401 - Autenticação falhou
    if (error.message?.includes("AUTENTICACAO_FALHOU")) {
      return res.status(401).json({
        error: "Falha na autenticação",
        message: error.message,
        details: {
          solution:
            "Verifique se sua API key está correta e é do OpenRouter (deve começar com 'sk-or-v1-'). " +
            "Obtenha uma chave gratuita em: https://openrouter.ai/keys",
          documentation: "https://openrouter.ai/docs",
        },
      });
    }

    // Erro 429 - Quota excedida
    if (error.message?.includes("QUOTA_EXCEDIDA")) {
      return res.status(429).json({
        error: "Cota da API excedida",
        message: error.message,
        details: {
          solution:
            "Verifique seu plano e adicione créditos em: https://platform.openai.com/account/billing",
          documentation:
            "https://platform.openai.com/docs/guides/error-codes/api-errors",
        },
      });
    }

    // Erros específicos da API do OpenAI
    if (error.message?.includes("API do OpenAI")) {
      return res.status(502).json({
        error: "Erro na comunicação com o serviço de IA",
        message: error.message,
      });
    }

    return res.status(500).json({
      error: "Erro interno do servidor ao processar a mensagem",
      message: error.message,
    });
  }

  /**
   * Serve arquivos baixados do e-SAJ
   */
  async serveDownload(req: Request, res: Response): Promise<Response | void> {
    try {
      const { fileName } = req.params;

      // Validação
      const validation = RequestValidator.validateFileDownload(fileName);
      if (!validation.isValid) {
        return res.status(validation.statusCode!).json({
          error: validation.error,
        });
      }

      // Decodificar nome do arquivo
      const decodedFileName = decodeURIComponent(fileName);

      // Diretório de downloads
      const downloadsDir =
        process.env.DOWNLOADS_DIR || path.join(process.cwd(), "downloads_esaj");
      const filePath = path.join(downloadsDir, decodedFileName);

      // Verificar se o arquivo existe
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          error: "Arquivo não encontrado",
          message: `O arquivo ${decodedFileName} não foi encontrado no servidor.`,
        });
      }

      // Verificar se é um arquivo (não diretório)
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return res.status(400).json({
          error: "Caminho inválido",
          message: "O caminho fornecido não é um arquivo.",
        });
      }

      // Determinar tipo MIME baseado na extensão
      const ext = path.extname(decodedFileName).toLowerCase();
      let contentType = "application/octet-stream";

      switch (ext) {
        case ".pdf":
          contentType = "application/pdf";
          break;
        case ".zip":
          contentType = "application/zip";
          break;
        case ".doc":
          contentType = "application/msword";
          break;
        case ".docx":
          contentType =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          break;
        case ".txt":
          contentType = "text/plain";
          break;
      }

      // Enviar arquivo
      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${decodedFileName}"`
      );
      res.setHeader("Content-Length", stats.size.toString());

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      fileStream.on("error", (error) => {
        console.error("Erro ao ler arquivo:", error);
        if (!res.headersSent) {
          res.status(500).json({
            error: "Erro ao ler arquivo",
            message: error.message,
          });
        }
      });
    } catch (error: any) {
      console.error("Erro ao servir arquivo:", error);
      return res.status(500).json({
        error: "Erro interno do servidor ao servir arquivo",
        message: error.message,
      });
    }
  }

  /**
   * Handler para chat com Server-Sent Events (SSE)
   * Envia progresso em tempo real para o frontend
   */
  async handleChatRequestSSE(req: Request, res: Response): Promise<void> {
    try {
      const { message }: ChatMessageRequest = req.body;

      // Validação
      const validation = RequestValidator.validateChatMessage(req);
      if (!validation.isValid) {
        res.status(validation.statusCode!).json({
          error: validation.error,
        });
        return;
      }

      // Configurar headers SSE
      SSEHelper.setupHeaders(res);

      // Detectar intenção
      SSEHelper.sendProgress(
        res,
        "intent_detection",
        "🧠 Analisando sua mensagem e detectando a intenção..."
      );

      const intentResult = await this.intentDetectionService.detectIntent(
        message.trim()
      );

      // Rotear com callback de progresso SSE
      const progressCallback = SSEHelper.createESAJProgressCallback(res);

      const result = await this.intentRouter.route(
        intentResult,
        message.trim(),
        req,
        progressCallback
      );

      // Enviar resposta final
      const chatResponse = ResponseBuilder.createChatResponse(
        message,
        result.response,
        intentResult.intention,
        intentResult.protocolNumber,
        intentResult.documentType,
        result.downloadUrl,
        result.fileName,
        result.sources
      );

      SSEHelper.sendComplete(res, chatResponse);
      res.end();
    } catch (error: any) {
      console.error("Erro ao processar requisição de chat SSE:", error);
      SSEHelper.sendError(res, error.message);
      res.end();
    }
  }
}
