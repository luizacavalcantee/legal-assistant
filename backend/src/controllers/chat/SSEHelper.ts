import { Response } from "express";

export type SSEEventType = "progress" | "complete" | "error";
export type SSEStatus =
  | "intent_detection"
  | "rag"
  | "esaj_search"
  | "esaj_processing"
  | "esaj_download"
  | "llm_processing"
  | "loading"
  | "complete"
  | "error";

export interface SSEEvent {
  type: SSEEventType;
  status: SSEStatus;
  message: string;
  progress?: number;
  data?: any;
  error?: string;
}

/**
 * Helper para gerenciar Server-Sent Events (SSE)
 */
export class SSEHelper {
  /**
   * Configura headers SSE na resposta
   */
  static setupHeaders(res: Response): void {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Desabilitar buffering do nginx
    res.flushHeaders();
  }

  /**
   * Envia evento SSE
   */
  static sendEvent(res: Response, event: SSEEvent): void {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  /**
   * Envia evento de progresso
   */
  static sendProgress(
    res: Response,
    status: SSEStatus,
    message: string,
    progress?: number
  ): void {
    this.sendEvent(res, {
      type: "progress",
      status,
      message,
      progress,
    });
  }

  /**
   * Envia evento de conclusão com dados
   */
  static sendComplete(res: Response, data: any): void {
    this.sendEvent(res, {
      type: "complete",
      status: "complete",
      message: "✅ Concluído!",
      data,
    });
  }

  /**
   * Envia evento de erro
   */
  static sendError(res: Response, errorMessage: string): void {
    this.sendEvent(res, {
      type: "error",
      status: "error",
      message: "❌ Erro ao processar sua solicitação",
      error: errorMessage,
    });
  }

  /**
   * Mapeia stage do e-SAJ para status SSE
   */
  static mapESAJStageToStatus(stage: string): SSEStatus {
    const statusMap: Record<string, SSEStatus> = {
      init: "esaj_search",
      connecting: "esaj_search",
      searching: "esaj_search",
      navigating: "esaj_processing",
      finding_document: "esaj_processing",
      downloading: "esaj_download",
      extracting: "esaj_processing",
      processing: "esaj_processing",
    };

    return statusMap[stage] || "loading";
  }

  /**
   * Cria callback de progresso para e-SAJ que envia eventos SSE
   */
  static createESAJProgressCallback(res: Response) {
    return (update: any) => {
      const status = this.mapESAJStageToStatus(update.stage);
      this.sendProgress(res, status, update.message, update.progress);
    };
  }
}
