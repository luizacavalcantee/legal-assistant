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

