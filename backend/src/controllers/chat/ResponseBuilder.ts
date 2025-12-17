import { Request } from "express";
import { ChatMessageResponse } from "../../types/chat.types";
import { UserIntent } from "../../services/IntentDetectionService";

/**
 * Constrói respostas do chat
 */
export class ResponseBuilder {
  /**
   * Constrói URL de download baseado na requisição
   */
  static buildDownloadUrl(
    req: Request,
    fileName: string,
    googleDriveLink?: string
  ): string {
    // Se tiver link do Google Drive, usar diretamente
    if (googleDriveLink) {
      return googleDriveLink;
    }

    // Construir URL local
    const host = req.get("host") || "";
    const isProduction = process.env.NODE_ENV === "production";
    const isLocalhost =
      host.includes("localhost") || host.includes("127.0.0.1");
    const forwardedProto = req.get("x-forwarded-proto");

    let protocol = req.protocol;
    if (
      forwardedProto === "https" ||
      process.env.FORCE_HTTPS === "true" ||
      (isProduction && !isLocalhost)
    ) {
      protocol = "https";
    }

    const baseUrl = `${protocol}://${host}`;
    const url = `${baseUrl}/chat/download/${encodeURIComponent(fileName)}`;

    console.log(
      `🔗 URL de download gerada: ${url} (protocol: ${protocol}, forwarded-proto: ${forwardedProto})`
    );

    return url;
  }

  /**
   * Formata resposta de download bem-sucedido
   */
  static formatDownloadResponse(
    fileName: string,
    downloadUrl: string,
    documentType?: string,
    isGoogleDrive: boolean = false
  ): string {
    if (isGoogleDrive) {
      return (
        `✅ Documento baixado e enviado para Google Drive com sucesso!\n\n` +
        `📄 Visualize o documento clicando no link abaixo:\n` +
        `${downloadUrl}\n\n` +
        `📋 Nome do arquivo: ${fileName}\n` +
        `☁️  O documento foi salvo na nuvem e será indexado para uso no RAG.`
      );
    } else {
      return (
        `✅ Documento baixado com sucesso!\n\n` +
        `📄 [Clique aqui para baixar o documento](${downloadUrl})\n\n` +
        `📋 Nome do arquivo: ${fileName}`
      );
    }
  }

  /**
   * Formata resposta de URL temporária do PDF
   */
  static formatTemporaryPdfResponse(pdfUrl: string): string {
    return (
      `✅ Documento encontrado!\n\n` +
      `📄 Veja o documento clicando no link abaixo:\n` +
      `${pdfUrl}\n\n` +
      `⚠️ **Atenção:** Esta URL pode expirar após alguns minutos devido à sessão do e-SAJ. ` +
      `Acesse o link o mais rápido possível.`
    );
  }

  /**
   * Formata resposta de erro de processo não encontrado
   */
  static formatProcessNotFoundResponse(
    protocolNumber: string,
    error?: string
  ): string {
    return (
      `Processo ${protocolNumber} não foi encontrado no portal e-SAJ. ` +
      (error
        ? `Erro: ${error}`
        : "Verifique se o número do protocolo está correto.")
    );
  }

  /**
   * Formata resposta de erro do e-SAJ
   */
  static formatEsajErrorResponse(
    error: string,
    isPuppeteerError: boolean = false
  ): string {
    if (isPuppeteerError) {
      return (
        "⚠️ Funcionalidade do e-SAJ temporariamente indisponível. " +
        "O serviço de web scraping requer configurações adicionais no servidor. " +
        "Por favor, tente novamente mais tarde ou entre em contato com o suporte."
      );
    }

    return `❌ Erro ao buscar processo no e-SAJ: ${error}. Por favor, tente novamente mais tarde.`;
  }

  /**
   * Formata resposta solicitando protocolo
   */
  static formatProtocolRequiredResponse(): string {
    return (
      "Não foi possível identificar o número do protocolo na sua mensagem. " +
      "Por favor, forneça o número do processo no formato: NNNNNNN-DD.AAAA.J.TR.OOOO"
    );
  }

  /**
   * Cria resposta completa do chat
   */
  static createChatResponse(
    message: string,
    response: string,
    intention: UserIntent,
    protocolNumber?: string,
    documentType?: string,
    downloadUrl?: string,
    fileName?: string,
    sources?: ChatMessageResponse["sources"]
  ): ChatMessageResponse {
    return {
      message: message.trim(),
      response: response,
      timestamp: new Date().toISOString(),
      intention: intention,
      protocolNumber: protocolNumber,
      documentType: documentType,
      downloadUrl: downloadUrl,
      fileName: fileName,
      sources: sources,
    };
  }

  /**
   * Formata resposta de resumo de processo
   */
  static formatProcessSummaryResponse(
    protocolNumber: string,
    summary: string
  ): string {
    return `📋 Resumo do Processo ${protocolNumber}\n\n${summary}`;
  }

  /**
   * Formata resposta de resumo de documento
   */
  static formatDocumentSummaryResponse(
    protocolNumber: string,
    documentType: string | undefined,
    summary: string
  ): string {
    return (
      `📄 Resumo do Documento${documentType ? ` (${documentType})` : ""} ` +
      `do Processo ${protocolNumber}\n\n${summary}`
    );
  }

  /**
   * Formata resposta de pergunta sobre documento
   */
  static formatDocumentAnswerResponse(
    protocolNumber: string,
    documentType: string | undefined,
    answer: string
  ): string {
    return (
      `📄 Resposta sobre o documento${
        documentType ? ` (${documentType})` : ""
      } ` + `do processo ${protocolNumber}\n\n${answer}`
    );
  }
}
