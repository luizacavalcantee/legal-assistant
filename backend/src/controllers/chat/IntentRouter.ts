import { Request } from "express";
import * as fs from "fs";
import { LLMService } from "../../services/LLMService";
import { RAGChainService } from "../../services/RAGChainService";
import { eSAJService } from "../../services/eSAJService";
import { GoogleDriveService } from "../../services/GoogleDriveService";
import { DocumentService } from "../../services/DocumentService";
import {
  UserIntent,
  IntentDetectionResult,
} from "../../services/IntentDetectionService";
import { ResponseBuilder } from "./ResponseBuilder";

export interface IntentRouteResult {
  response: string;
  downloadUrl?: string;
  fileName?: string;
  sources?: any[];
}

/**
 * Roteia requisições baseado na intenção detectada
 */
export class IntentRouter {
  constructor(
    private llmService: LLMService,
    private esajService: eSAJService,
    private googleDriveService: GoogleDriveService,
    private ragChainService?: RAGChainService,
    private documentService?: DocumentService
  ) {}

  /**
   * Roteia para o handler apropriado baseado na intenção
   */
  async route(
    intentResult: IntentDetectionResult,
    message: string,
    req: Request,
    progressCallback?: (update: any) => void
  ): Promise<IntentRouteResult> {
    switch (intentResult.intention) {
      case UserIntent.RAG_QUERY:
        return this.handleRAGQuery(message);

      case UserIntent.QUERY_DOCUMENT:
      case UserIntent.DOWNLOAD_DOCUMENT:
      case UserIntent.SUMMARIZE_PROCESS:
      case UserIntent.SUMMARIZE_DOCUMENT:
        return this.handleESAJIntent(
          intentResult,
          message,
          req,
          progressCallback
        );

      case UserIntent.GENERAL_QUERY:
      default:
        return this.handleGeneralQuery(message, intentResult.protocolNumber);
    }
  }

  /**
   * Processa consulta RAG
   */
  private async handleRAGQuery(message: string): Promise<IntentRouteResult> {
    if (!this.ragChainService) {
      const response = await this.llmService.generateResponse(message);
      return { response };
    }

    try {
      const isAvailable = await this.ragChainService.isAvailable();

      if (isAvailable) {
        console.log("🔍 Usando RAG para responder...");
        const ragResult = await this.ragChainService.query(message);
        return {
          response: ragResult.answer,
          sources: ragResult.sources,
        };
      } else {
        console.log("⚠️  RAG não disponível. Usando LLM direto...");
        const response = await this.llmService.generateResponse(message);
        return { response };
      }
    } catch (error: any) {
      console.error("Erro ao usar RAG, usando LLM direto:", error);
      const response = await this.llmService.generateResponse(message);
      return { response };
    }
  }

  /**
   * Processa consulta genérica (tenta RAG primeiro)
   */
  private async handleGeneralQuery(
    message: string,
    protocolNumber?: string
  ): Promise<IntentRouteResult> {
    // Se não há protocolo e tem RAG, tentar RAG primeiro
    if (!protocolNumber && this.ragChainService) {
      try {
        const isAvailable = await this.ragChainService.isAvailable();

        if (isAvailable) {
          console.log("🔍 Tentando RAG para pergunta genérica...");
          const ragResult = await this.ragChainService.query(message);
          return {
            response: ragResult.answer,
            sources: ragResult.sources,
          };
        }
      } catch (error: any) {
        console.log("💬 Erro ao usar RAG:", error.message);
      }
    }

    console.log("💬 Usando LLM direto para pergunta genérica...");
    const response = await this.llmService.generateResponse(message);
    return { response };
  }

  /**
   * Processa intenções relacionadas ao e-SAJ
   */
  private async handleESAJIntent(
    intentResult: IntentDetectionResult,
    message: string,
    req: Request,
    progressCallback?: (update: any) => void
  ): Promise<IntentRouteResult> {
    const { intention, protocolNumber, documentType } = intentResult;

    // Verificar se há protocolo
    if (!protocolNumber) {
      return {
        response: ResponseBuilder.formatProtocolRequiredResponse(),
      };
    }

    // Buscar processo
    console.log(`🔍 Buscando processo ${protocolNumber} no e-SAJ...`);

    let processResult;
    try {
      processResult = await this.esajService.findProcess(
        protocolNumber,
        progressCallback
      );
    } catch (error: any) {
      console.error("❌ Erro ao acessar e-SAJ:", error.message);
      const isPuppeteerError = error.message?.includes("Puppeteer");
      return {
        response: ResponseBuilder.formatEsajErrorResponse(
          error.message,
          isPuppeteerError
        ),
      };
    }

    if (!processResult.found) {
      return {
        response: ResponseBuilder.formatProcessNotFoundResponse(
          protocolNumber,
          processResult.error
        ),
      };
    }

    // Processo encontrado - executar ação baseada na intenção
    switch (intention) {
      case UserIntent.DOWNLOAD_DOCUMENT:
        return this.handleDocumentDownload(
          protocolNumber,
          documentType,
          processResult,
          req
        );

      case UserIntent.QUERY_DOCUMENT:
        return this.handleDocumentQuery(
          protocolNumber,
          documentType,
          message,
          processResult
        );

      case UserIntent.SUMMARIZE_DOCUMENT:
        return this.handleDocumentSummary(
          protocolNumber,
          documentType,
          processResult
        );

      case UserIntent.SUMMARIZE_PROCESS:
      default:
        return this.handleProcessSummary(protocolNumber, processResult);
    }
  }

  /**
   * Processa download de documento
   */
  private async handleDocumentDownload(
    protocolNumber: string,
    documentType: string | undefined,
    processResult: any,
    req: Request
  ): Promise<IntentRouteResult> {
    console.log(
      `📥 Iniciando download de documento${
        documentType ? ` (${documentType})` : ""
      }...`
    );

    const downloadResult = await this.esajService.downloadDocument(
      protocolNumber,
      documentType || "documento",
      processResult.processPageUrl,
      processResult.page
    );

    if (!downloadResult.success) {
      return {
        response: `❌ Erro ao localizar documento: ${
          downloadResult.error || "Erro desconhecido"
        }`,
      };
    }

    // Verificar se o arquivo foi baixado com sucesso
    if (downloadResult.filePath && downloadResult.fileName) {
      return this.handleSuccessfulDownload(downloadResult, protocolNumber, req);
    } else if (downloadResult.pdfUrl) {
      // Fallback: URL temporária do PDF
      return {
        response: ResponseBuilder.formatTemporaryPdfResponse(
          downloadResult.pdfUrl
        ),
        downloadUrl: downloadResult.pdfUrl,
        fileName: `${downloadResult.documentType || "documento"}.pdf`,
      };
    }

    return {
      response: `❌ Erro ao baixar documento: ${
        downloadResult.error || "Erro desconhecido"
      }`,
    };
  }

  /**
   * Processa download bem-sucedido (upload para Google Drive e criação de documento)
   */
  private async handleSuccessfulDownload(
    downloadResult: any,
    protocolNumber: string,
    req: Request
  ): Promise<IntentRouteResult> {
    let googleDriveFileId: string | undefined;
    let googleDriveViewLink: string | undefined;
    let finalFilePath = downloadResult.filePath;

    // Upload para Google Drive se configurado
    if (this.googleDriveService.isConfigured()) {
      try {
        console.log(`📤 Fazendo upload para Google Drive...`);
        const driveResult = await this.googleDriveService.uploadFile(
          downloadResult.filePath,
          downloadResult.fileName
        );

        if (driveResult) {
          googleDriveFileId = driveResult.fileId;
          googleDriveViewLink = driveResult.webViewLink;
          console.log(
            `✅ Arquivo enviado para Google Drive: ${driveResult.fileId}`
          );
          console.log(`   Link de visualização: ${driveResult.webViewLink}`);

          // Limpar arquivo local
          try {
            if (fs.existsSync(downloadResult.filePath)) {
              fs.unlinkSync(downloadResult.filePath);
              console.log(`🗑️  Arquivo local removido`);
            }
          } catch (unlinkError: any) {
            console.warn(
              `⚠️  Erro ao remover arquivo local: ${unlinkError.message}`
            );
          }

          finalFilePath = `gdrive:${driveResult.fileId}`;
        }
      } catch (driveError: any) {
        console.error(`❌ Erro ao fazer upload para Google Drive:`, driveError);
        console.log(`   Mantendo arquivo local como fallback`);
      }
    }

    // Criar documento na base de conhecimento
    if (this.documentService) {
      await this.createKnowledgeBaseDocument(
        downloadResult,
        protocolNumber,
        finalFilePath,
        googleDriveFileId,
        googleDriveViewLink
      );
    }

    // Construir resposta
    const downloadUrl = ResponseBuilder.buildDownloadUrl(
      req,
      downloadResult.fileName,
      googleDriveViewLink
    );

    const response = ResponseBuilder.formatDownloadResponse(
      downloadResult.fileName,
      downloadUrl,
      downloadResult.documentType,
      !!googleDriveViewLink
    );

    return {
      response,
      downloadUrl,
      fileName: downloadResult.fileName,
    };
  }

  /**
   * Cria documento na base de conhecimento
   */
  private async createKnowledgeBaseDocument(
    downloadResult: any,
    protocolNumber: string,
    finalFilePath: string,
    googleDriveFileId?: string,
    googleDriveViewLink?: string
  ): Promise<void> {
    try {
      const documentTitle = `${
        downloadResult.documentType || "Documento"
      } - Processo ${protocolNumber}`;

      const document = await this.documentService!.createDocument(
        {
          titulo: documentTitle,
          caminho_arquivo: finalFilePath,
        },
        googleDriveFileId ? undefined : downloadResult.filePath
      );

      // Atualizar com metadados do Google Drive
      if (googleDriveFileId && googleDriveViewLink) {
        const {
          DocumentRepository,
        } = require("../../repositories/DocumentRepository");
        const repository = new DocumentRepository();
        await repository.update(document.id, {
          google_drive_file_id: googleDriveFileId,
          google_drive_view_link: googleDriveViewLink,
        });
        console.log(
          `✅ Documento criado na base de conhecimento com ID: ${document.id}`
        );
        console.log(`   Google Drive ID: ${googleDriveFileId}`);
      } else {
        console.log(
          `✅ Documento criado na base de conhecimento com ID: ${document.id}`
        );
      }
    } catch (docError: any) {
      console.error(
        `❌ Erro ao criar documento na base de conhecimento:`,
        docError
      );
    }
  }

  /**
   * Processa pergunta sobre documento
   */
  private async handleDocumentQuery(
    protocolNumber: string,
    documentType: string | undefined,
    message: string,
    processResult: any
  ): Promise<IntentRouteResult> {
    console.log(
      `📄 Iniciando extração de texto do documento${
        documentType ? ` (${documentType})` : ""
      }...`
    );

    const textResult = await this.esajService.extractDocumentText(
      protocolNumber,
      documentType || "documento",
      processResult.processPageUrl
    );

    if (!textResult.success || !textResult.text) {
      return {
        response: `❌ Erro ao extrair texto do documento: ${
          textResult.error || "Erro desconhecido"
        }`,
      };
    }

    console.log(
      `✅ Texto extraído (${textResult.text.length} caracteres). Respondendo pergunta...`
    );

    try {
      const answer = await this.llmService.answerDocumentQuestion(
        message,
        textResult.text,
        textResult.documentType,
        protocolNumber
      );

      const response = ResponseBuilder.formatDocumentAnswerResponse(
        protocolNumber,
        textResult.documentType,
        answer
      );

      return { response };
    } catch (error: any) {
      console.error(`❌ Erro ao responder pergunta:`, error);
      return {
        response: `❌ Erro ao responder pergunta sobre o documento: ${
          error.message || "Erro desconhecido"
        }`,
      };
    }
  }

  /**
   * Processa resumo de documento
   */
  private async handleDocumentSummary(
    protocolNumber: string,
    documentType: string | undefined,
    processResult: any
  ): Promise<IntentRouteResult> {
    console.log(
      `📄 Iniciando extração e resumo do documento${
        documentType ? ` (${documentType})` : ""
      }...`
    );

    const textResult = await this.esajService.extractDocumentText(
      protocolNumber,
      documentType || "documento",
      processResult.processPageUrl
    );

    if (!textResult.success || !textResult.text) {
      return {
        response: `❌ Erro ao extrair texto do documento: ${
          textResult.error || "Erro desconhecido"
        }`,
      };
    }

    console.log(
      `✅ Texto extraído (${textResult.text.length} caracteres). Gerando resumo...`
    );

    try {
      const summary = await this.llmService.summarizeDocument(
        textResult.text,
        textResult.documentType || documentType,
        protocolNumber
      );

      const response = ResponseBuilder.formatDocumentSummaryResponse(
        protocolNumber,
        textResult.documentType,
        summary
      );

      return { response };
    } catch (error: any) {
      console.error(`❌ Erro ao gerar resumo do documento:`, error);
      return {
        response: `❌ Erro ao gerar resumo do documento: ${
          error.message || "Erro desconhecido"
        }`,
      };
    }
  }

  /**
   * Processa resumo de processo
   */
  private async handleProcessSummary(
    protocolNumber: string,
    processResult: any
  ): Promise<IntentRouteResult> {
    console.log(`📋 Iniciando extração de movimentações do processo...`);

    try {
      const movementsText =
        await this.esajService.getProcessMovementsForSummary(
          protocolNumber,
          processResult.processPageUrl,
          processResult.page
        );

      if (!movementsText || movementsText.trim().length === 0) {
        return {
          response: `❌ Erro ao extrair movimentações do processo: Nenhuma movimentação encontrada.`,
        };
      }

      console.log(
        `✅ Movimentações extraídas (${movementsText.length} caracteres). Gerando resumo...`
      );

      const summary = await this.llmService.summarizeProcess(movementsText);
      const response = ResponseBuilder.formatProcessSummaryResponse(
        protocolNumber,
        summary
      );

      return { response };
    } catch (error: any) {
      console.error(`❌ Erro ao processar resumo do processo:`, error);
      return {
        response: `❌ Erro ao gerar resumo do processo: ${
          error.message || "Erro desconhecido"
        }`,
      };
    }
  }
}
