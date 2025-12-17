import OpenAI from "openai";
import { LLMConfigService } from "./llm/LLMConfigService";
import { LLMErrorHandler } from "./llm/LLMErrorHandler";
import { LLMPromptsService } from "./llm/LLMPromptsService";

export class LLMService {
  private openai: OpenAI;
  private configService: LLMConfigService;
  private errorHandler: LLMErrorHandler;
  private model: string;

  constructor() {
    this.configService = new LLMConfigService();
    this.openai = this.configService.createClient();
    this.model = this.configService.getModel();
    this.errorHandler = new LLMErrorHandler(this.configService.getProvider());
  }

  /**
   * Gera um resumo de processo judicial a partir das movimentações extraídas
   * @param movementsText - Texto completo das movimentações/andamentos do processo
   * @returns Resumo gerado pelo LLM
   */
  async summarizeProcess(movementsText: string): Promise<string> {
    try {
      const prompt = LLMPromptsService.buildProcessSummaryPrompt(movementsText);

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: LLMPromptsService.SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const summary = completion.choices[0]?.message?.content || "";

      if (!summary || summary.trim().length === 0) {
        throw new Error("Resposta vazia do LLM ao gerar resumo");
      }

      return summary.trim();
    } catch (error: any) {
      this.errorHandler.handleError(error, "gerar resumo do processo");
    }
  }

  /**
   * Gera um resumo estruturado de um documento específico de um processo
   * @param documentText - Texto completo do documento
   * @param documentType - Tipo do documento (ex: "sentença", "petição inicial")
   * @param protocolNumber - Número do protocolo do processo
   * @returns Resumo estruturado do documento
   */
  async summarizeDocument(
    documentText: string,
    documentType?: string,
    protocolNumber?: string
  ): Promise<string> {
    try {
      const prompt = LLMPromptsService.buildDocumentSummaryPrompt(
        documentText,
        documentType,
        protocolNumber
      );

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: LLMPromptsService.SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const summary = completion.choices[0]?.message?.content || "";

      if (!summary || summary.trim().length === 0) {
        throw new Error("Resposta vazia do LLM ao gerar resumo do documento");
      }

      return summary.trim();
    } catch (error: any) {
      this.errorHandler.handleError(error, "gerar resumo do documento");
    }
  }

  /**
   * Responde uma pergunta específica sobre o conteúdo de um documento
   * @param question - Pergunta do usuário sobre o documento
   * @param documentText - Texto completo do documento
   * @param documentType - Tipo do documento (ex: "sentença", "petição inicial")
   * @param protocolNumber - Número do protocolo do processo
   * @returns Resposta gerada pelo LLM baseada no conteúdo do documento
   */
  async answerDocumentQuestion(
    question: string,
    documentText: string,
    documentType?: string,
    protocolNumber?: string
  ): Promise<string> {
    try {
      const prompt = LLMPromptsService.buildDocumentQuestionPrompt(
        question,
        documentText,
        documentType,
        protocolNumber
      );

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: LLMPromptsService.SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const answer = completion.choices[0]?.message?.content || "";

      if (!answer || answer.trim().length === 0) {
        throw new Error(
          "Resposta vazia do LLM ao responder pergunta sobre documento"
        );
      }

      return answer.trim();
    } catch (error: any) {
      this.errorHandler.handleError(
        error,
        "responder pergunta sobre documento"
      );
    }
  }

  /**
   * Gera uma resposta do LLM baseada na mensagem do usuário
   * @param message - Mensagem do usuário
   * @returns Resposta gerada pelo LLM
   */
  async generateResponse(message: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: LLMPromptsService.SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: message,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const response = completion.choices[0]?.message?.content;

      if (!response) {
        throw new Error("Resposta vazia do modelo de linguagem");
      }

      return response;
    } catch (error: any) {
      this.errorHandler.handleError(error, "gerar resposta do LLM");
    }
  }
}
