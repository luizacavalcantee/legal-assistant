/**
 * Tipos para sistema de progresso de operações e-SAJ
 */

export type ProgressStage =
  | "init"
  | "connecting"
  | "searching"
  | "navigating"
  | "finding_document"
  | "downloading"
  | "extracting"
  | "processing"
  | "complete"
  | "error";

export interface ProgressUpdate {
  stage: ProgressStage;
  message: string;
  progress?: number; // 0-100
  details?: string;
  error?: string;
}

export type ProgressCallback = (update: ProgressUpdate) => void | Promise<void>;

/**
 * Tipos para eventos SSE do chat
 */
export type ChatProgressStatus =
  | "intent_detection"
  | "rag"
  | "esaj_search"
  | "esaj_download"
  | "esaj_processing"
  | "llm_processing"
  | "loading"
  | "complete"
  | "error";

export interface ChatProgressEvent {
  type: "progress" | "complete" | "error";
  status: ChatProgressStatus;
  message: string;
  data?: any;
}

export type ChatProgressCallback = (event: ChatProgressEvent) => void;
