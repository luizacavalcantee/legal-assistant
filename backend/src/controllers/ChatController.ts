import { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { LLMService } from "../services/LLMService";
import { RAGChainService } from "../services/RAGChainService";
import { IntentDetectionService, UserIntent } from "../services/IntentDetectionService";
import { eSAJService } from "../services/eSAJService";
import { ChatMessageRequest, ChatMessageResponse } from "../types/chat.types";

export class ChatController {
  private llmService: LLMService;
  private ragChainService?: RAGChainService;
  private intentDetectionService: IntentDetectionService;
  private eSAJService: eSAJService;

  constructor(
    llmService: LLMService,
    ragChainService?: RAGChainService,
    eSAJService?: eSAJService
  ) {
    this.llmService = llmService;
    this.ragChainService = ragChainService;
    this.intentDetectionService = new IntentDetectionService(llmService);
    this.eSAJService = eSAJService ?? new eSAJService();
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

      // Validação básica
      if (
        !message ||
        typeof message !== "string" ||
        message.trim().length === 0
      ) {
        return res.status(400).json({
          error:
            "Campo 'message' é obrigatório e deve ser uma string não vazia",
        });
      }

      // Limitar tamanho da mensagem
      if (message.length > 2000) {
        return res.status(400).json({
          error: "Mensagem muito longa. Máximo de 2000 caracteres permitido",
        });
      }

      // 1. Detectar intenção do usuário
      console.log("🧠 Detectando intenção do usuário...");
      const intentResult = await this.intentDetectionService.detectIntent(
        message.trim()
      );
      console.log(
        `✅ Intenção detectada: ${intentResult.intention}${intentResult.protocolNumber ? ` (Protocolo: ${intentResult.protocolNumber})` : ""}`
      );

      let response: string;
      let sources: ChatMessageResponse["sources"] = undefined;
      let protocolNumber: string | undefined = intentResult.protocolNumber;
      let downloadUrlResponse: string | undefined = undefined;
      let fileNameResponse: string | undefined = undefined;

      // 2. Rotear baseado na intenção
      switch (intentResult.intention) {
        case UserIntent.QUERY_DOCUMENT:
        case UserIntent.DOWNLOAD_DOCUMENT:
        case UserIntent.SUMMARIZE_PROCESS:
        case UserIntent.SUMMARIZE_DOCUMENT:
          // Verificar se há número de protocolo
          if (!protocolNumber) {
            response =
              "Não foi possível identificar o número do protocolo na sua mensagem. " +
              "Por favor, forneça o número do processo no formato: NNNNNNN-DD.AAAA.J.TR.OOOO";
          } else {
            // Buscar processo no e-SAJ
            console.log(
              `🔍 Buscando processo ${protocolNumber} no e-SAJ...`
            );
            const processResult = await this.eSAJService.findProcess(
              protocolNumber
            );

            if (!processResult.found) {
              response =
                `Processo ${protocolNumber} não foi encontrado no portal e-SAJ. ` +
                (processResult.error
                  ? `Erro: ${processResult.error}`
                  : "Verifique se o número do protocolo está correto.");
            } else {
              // Processo encontrado - realizar ação solicitada
              if (intentResult.intention === UserIntent.DOWNLOAD_DOCUMENT) {
                // Baixar documento (reutilizando a página já aberta se disponível)
                console.log(
                  `📥 Iniciando download de documento${intentResult.documentType ? ` (${intentResult.documentType})` : ""}...`
                );
                const downloadResult = await this.eSAJService.downloadDocument(
                  protocolNumber,
                  intentResult.documentType || "documento",
                  processResult.processPageUrl, // Passar a URL da página de detalhes
                  processResult.page // Passar a página já aberta para reutilização
                );

                if (downloadResult.success) {
                  // Verificar se o arquivo foi baixado com sucesso (filePath e fileName)
                  if (downloadResult.filePath && downloadResult.fileName) {
                    // Construir URL de download do servidor
                    const baseUrl = `${req.protocol}://${req.get("host")}`;
                    const downloadUrl = `${baseUrl}/download/file/${encodeURIComponent(downloadResult.fileName)}`;
                    
                    downloadUrlResponse = downloadUrl;
                    fileNameResponse = downloadResult.fileName;

                    response =
                      `✅ Documento baixado com sucesso!\n\n` +
                      `📄 Clique no link abaixo para baixar o documento:\n` +
                      `${downloadUrl}\n\n` +
                      `📋 Nome do arquivo: ${downloadResult.fileName}`;
                  } else if (downloadResult.pdfUrl) {
                    // Fallback: Se não foi baixado mas tem URL do PDF (comportamento antigo)
                    downloadUrlResponse = downloadResult.pdfUrl;
                    fileNameResponse = `${downloadResult.documentType || "documento"}.pdf`;

                    response =
                      `✅ Documento encontrado!\n\n` +
                      `📄 Veja o documento clicando no link abaixo:\n` +
                      `${downloadResult.pdfUrl}\n\n` +
                      `⚠️ **Atenção:** Esta URL pode expirar após alguns minutos devido à sessão do e-SAJ. ` +
                      `Acesse o link o mais rápido possível.`;
                  } else {
                    response =
                      `❌ Erro ao baixar documento: ${downloadResult.error || "Erro desconhecido"}`;
                  }
                } else {
                  response =
                    `❌ Erro ao localizar documento: ${downloadResult.error || "Erro desconhecido"}`;
                }
              } else if (intentResult.intention === UserIntent.QUERY_DOCUMENT) {
                // QUERY_DOCUMENT - Pergunta sobre conteúdo de documento
                console.log(
                  `📄 Iniciando extração de texto do documento${intentResult.documentType ? ` (${intentResult.documentType})` : ""} do processo ${protocolNumber}...`
                );
                const textResult = await this.eSAJService.extractDocumentText(
                  protocolNumber,
                  intentResult.documentType || "documento",
                  processResult.processPageUrl // Passar a URL da página de detalhes
                );

                if (!textResult.success || !textResult.text) {
                  response =
                    `❌ Erro ao extrair texto do documento: ${textResult.error || "Erro desconhecido"}`;
                } else {
                  console.log(
                    `✅ Texto extraído (${textResult.text.length} caracteres). Respondendo pergunta com LLM...`
                  );
                  try {
                    // Usar a mensagem original do usuário como pergunta
                    const answer = await this.llmService.answerDocumentQuestion(
                      message.trim(), // Pergunta original do usuário
                      textResult.text,
                      textResult.documentType,
                      protocolNumber
                    );
                    response = `📄 **Resposta sobre o documento${textResult.documentType ? ` (${textResult.documentType})` : ""} do processo ${protocolNumber}**\n\n${answer}`;
                  } catch (answerError: any) {
                    console.error(
                      `❌ Erro ao responder pergunta:`,
                      answerError
                    );
                    response =
                      `❌ Erro ao responder pergunta sobre o documento: ${answerError.message || "Erro desconhecido"}`;
                  }
                }
              } else if (intentResult.intention === UserIntent.SUMMARIZE_DOCUMENT) {
                // SUMMARIZE_DOCUMENT - Resumo estruturado de um documento específico
                console.log(
                  `📄 Iniciando extração e resumo do documento${intentResult.documentType ? ` (${intentResult.documentType})` : ""} do processo ${protocolNumber}...`
                );
                const textResult = await this.eSAJService.extractDocumentText(
                  protocolNumber,
                  intentResult.documentType || "documento",
                  processResult.processPageUrl // Passar a URL da página de detalhes
                );

                if (!textResult.success || !textResult.text) {
                  response =
                    `❌ Erro ao extrair texto do documento: ${textResult.error || "Erro desconhecido"}`;
                } else {
                  console.log(
                    `✅ Texto extraído (${textResult.text.length} caracteres). Gerando resumo estruturado com LLM...`
                  );
                  try {
                    const summary = await this.llmService.summarizeDocument(
                      textResult.text,
                      textResult.documentType || intentResult.documentType,
                      protocolNumber
                    );
                    response = `📄 **Resumo do Documento${textResult.documentType ? ` (${textResult.documentType})` : ""} do Processo ${protocolNumber}**\n\n${summary}`;
                  } catch (summaryError: any) {
                    console.error(
                      `❌ Erro ao gerar resumo do documento:`,
                      summaryError
                    );
                    response =
                      `❌ Erro ao gerar resumo do documento: ${summaryError.message || "Erro desconhecido"}`;
                  }
                }
              } else {
                // SUMMARIZE_PROCESS
                console.log(
                  `📋 Iniciando extração de movimentações do processo ${protocolNumber}...`
                );
                try {
                  // Usar o método orquestrador, reutilizando a página já aberta
                  const movementsText = await this.eSAJService.getProcessMovementsForSummary(
                    protocolNumber,
                    processResult.processPageUrl, // Passar URL para evitar busca duplicada
                    processResult.page // Passar página para reutilizar
                  );

                  if (!movementsText || movementsText.trim().length === 0) {
                    response =
                      `❌ Erro ao extrair movimentações do processo: Nenhuma movimentação encontrada.`;
                  } else {
                    console.log(
                      `✅ Movimentações extraídas (${movementsText.length} caracteres). Gerando resumo com LLM...`
                    );
                    try {
                      const summary = await this.llmService.summarizeProcess(
                        movementsText
                      );
                      response = `📋 **Resumo do Processo ${protocolNumber}**\n\n${summary}`;
                    } catch (summaryError: any) {
                      console.error(
                        `❌ Erro ao gerar resumo:`,
                        summaryError
                      );
                      response =
                        `❌ Erro ao gerar resumo do processo: ${summaryError.message || "Erro desconhecido"}`;
                    }
                  }
                } catch (extractionError: any) {
                  console.error(
                    `❌ Erro ao extrair movimentações:`,
                    extractionError
                  );
                  response =
                    `❌ Erro ao extrair movimentações do processo: ${extractionError.message || "Erro desconhecido"}`;
                }
              }
            }
          }
          break;

        case UserIntent.RAG_QUERY:
          // Usar RAG para responder
          if (this.ragChainService) {
            try {
              const isRAGAvailable =
                await this.ragChainService.isAvailable();

              if (isRAGAvailable) {
                console.log("🔍 Usando RAG para responder...");
                const ragResult = await this.ragChainService.query(
                  message.trim()
                );
                response = ragResult.answer;
                sources = ragResult.sources;
              } else {
                console.log(
                  "⚠️  RAG não disponível (sem documentos indexados). Usando LLM direto..."
                );
                response = await this.llmService.generateResponse(
                  message.trim()
                );
              }
            } catch (ragError: any) {
              console.error("Erro ao usar RAG, usando LLM direto:", ragError);
              response = await this.llmService.generateResponse(
                message.trim()
              );
            }
          } else {
            console.log("⚠️  RAG não configurado. Usando LLM direto...");
            response = await this.llmService.generateResponse(message.trim());
          }
          break;

        case UserIntent.GENERAL_QUERY:
        default:
          // Se não há número de protocolo, tentar RAG primeiro (pode ser pergunta sobre base de conhecimento)
          if (!protocolNumber && this.ragChainService) {
            try {
              const isRAGAvailable =
                await this.ragChainService.isAvailable();

              if (isRAGAvailable) {
                console.log(
                  "🔍 Tentando RAG para pergunta genérica (pode estar na base de conhecimento)..."
                );
                const ragResult = await this.ragChainService.query(
                  message.trim()
                );
                response = ragResult.answer;
                sources = ragResult.sources;
                // Atualizar intenção para RAG_QUERY se funcionou
                intentResult.intention = UserIntent.RAG_QUERY;
              } else {
                console.log(
                  "💬 RAG não disponível. Usando LLM direto para pergunta genérica..."
                );
                response = await this.llmService.generateResponse(
                  message.trim()
                );
              }
            } catch (ragError: any) {
              console.log(
                "💬 Erro ao usar RAG, usando LLM direto para pergunta genérica:",
                ragError.message
              );
              response = await this.llmService.generateResponse(
                message.trim()
              );
            }
          } else {
            // Usar LLM direto para perguntas genéricas
            console.log("💬 Usando LLM direto para pergunta genérica...");
            response = await this.llmService.generateResponse(message.trim());
          }
          break;
      }

      const chatResponse: ChatMessageResponse = {
        message: message.trim(),
        response: response,
        timestamp: new Date().toISOString(),
        intention: intentResult.intention,
        protocolNumber: protocolNumber,
        documentType: intentResult.documentType,
        downloadUrl: downloadUrlResponse,
        fileName: fileNameResponse,
        sources: sources,
      };

      return res.status(200).json(chatResponse);
    } catch (error: any) {
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
  }

  /**
   * Serve arquivos baixados do e-SAJ
   */
  async serveDownload(req: Request, res: Response): Promise<Response | void> {
    try {
      const { fileName } = req.params;

      if (!fileName) {
        return res.status(400).json({
          error: "Nome do arquivo não fornecido",
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
}
