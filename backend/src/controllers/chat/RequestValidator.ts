import { Request } from "express";
import { ChatMessageRequest } from "../../types/chat.types";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  statusCode?: number;
}

/**
 * Valida requisições do chat
 */
export class RequestValidator {
  private static readonly MAX_MESSAGE_LENGTH = 2000;

  /**
   * Valida requisição de mensagem do chat
   */
  static validateChatMessage(req: Request): ValidationResult {
    const { message }: ChatMessageRequest = req.body;

    // Verificar se a mensagem existe
    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return {
        isValid: false,
        error: "Campo 'message' é obrigatório e deve ser uma string não vazia",
        statusCode: 400,
      };
    }

    // Verificar tamanho da mensagem
    if (message.length > this.MAX_MESSAGE_LENGTH) {
      return {
        isValid: false,
        error: `Mensagem muito longa. Máximo de ${this.MAX_MESSAGE_LENGTH} caracteres permitido`,
        statusCode: 400,
      };
    }

    return { isValid: true };
  }

  /**
   * Valida parâmetros de download de arquivo
   */
  static validateFileDownload(fileName?: string): ValidationResult {
    if (!fileName) {
      return {
        isValid: false,
        error: "Nome do arquivo não fornecido",
        statusCode: 400,
      };
    }

    return { isValid: true };
  }
}
