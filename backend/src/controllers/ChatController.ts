import { Request, Response } from "express";
import { LLMService } from "../services/LLMService";
import { ChatMessageRequest, ChatMessageResponse } from "../types/chat.types";

export class ChatController {
  private llmService: LLMService;

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  /**
   * @swagger
   * /chat/message:
   *   post:
   *     summary: Enviar mensagem para o assistente jurídico (LLM)
   *     tags: [Chat]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ChatMessageRequest'
   *     responses:
   *       200:
   *         description: Resposta gerada pelo LLM com sucesso
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
   *         description: Erro interno do servidor ou na comunicação com o LLM
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

      // Gerar resposta do LLM
      const response = await this.llmService.generateResponse(message.trim());

      const chatResponse: ChatMessageResponse = {
        message: message.trim(),
        response: response,
        timestamp: new Date().toISOString(),
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
}
