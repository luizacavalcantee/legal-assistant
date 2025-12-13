import { LLMService } from "./LLMService";

export enum UserIntent {
  RAG_QUERY = "RAG_QUERY",
  DOWNLOAD_DOCUMENT = "DOWNLOAD_DOCUMENT",
  SUMMARIZE_PROCESS = "SUMMARIZE_PROCESS",
  GENERAL_QUERY = "GENERAL_QUERY",
}

export interface IntentDetectionResult {
  intention: UserIntent;
  protocolNumber?: string;
  confidence?: number;
}

/**
 * Serviço para identificar a intenção do usuário usando LLM
 */
export class IntentDetectionService {
  private llmService: LLMService;

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  /**
   * Detecta a intenção do usuário e extrai informações relevantes (como número de protocolo)
   * @param message - Mensagem do usuário
   * @returns Resultado da detecção de intenção
   */
  async detectIntent(message: string): Promise<IntentDetectionResult> {
    try {
      const prompt = `Analise a seguinte mensagem do usuário e identifique a intenção. Responda APENAS com um JSON válido no formato:
{
  "intention": "RAG_QUERY" | "DOWNLOAD_DOCUMENT" | "SUMMARIZE_PROCESS" | "GENERAL_QUERY",
  "protocolNumber": "número do protocolo se relevante, ou null",
  "confidence": número entre 0 e 1
}

Intenções:
- RAG_QUERY: Pergunta sobre a base de conhecimento interna, documentos indexados, leis, normas, etc.
- DOWNLOAD_DOCUMENT: Solicitação de download de documento de um processo (ex: "Baixe a petição inicial do processo X", "Quero o documento Y do processo Z")
- SUMMARIZE_PROCESS: Solicitação de resumo de processo (ex: "Me traga um resumo do processo X", "Resuma o processo Y")
- GENERAL_QUERY: Pergunta genérica que não se encaixa nas outras categorias

IMPORTANTE:
- Se a intenção for DOWNLOAD_DOCUMENT ou SUMMARIZE_PROCESS, você DEVE extrair o número do protocolo da mensagem
- Números de protocolo geralmente seguem o formato: NNNNNNN-DD.AAAA.J.TR.OOOO (ex: 1234567-89.2024.8.26.0100)
- Se não conseguir identificar claramente a intenção, use GENERAL_QUERY
- Retorne APENAS o JSON, sem texto adicional

Mensagem do usuário: "${message}"`;

      const response = await this.llmService.generateResponse(prompt);

      // Tentar extrair JSON da resposta
      let jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Se não encontrar JSON, tentar parse direto
        jsonMatch = [response.trim()];
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validar intenção
      const validIntents = Object.values(UserIntent);
      const intention = validIntents.includes(parsed.intention)
        ? parsed.intention
        : UserIntent.GENERAL_QUERY;

      // Validar número de protocolo (se presente)
      let protocolNumber: string | undefined = undefined;
      if (parsed.protocolNumber && parsed.protocolNumber !== "null") {
        // Limpar e validar formato básico
        const cleanProtocol = parsed.protocolNumber
          .trim()
          .replace(/[\s.\-]/g, "");
        if (cleanProtocol.length > 0) {
          protocolNumber = cleanProtocol;
        }
      }

      return {
        intention: intention as UserIntent,
        protocolNumber: protocolNumber,
        confidence: parsed.confidence || 0.5,
      };
    } catch (error: any) {
      console.error("Erro ao detectar intenção:", error);
      // Fallback: tentar detectar manualmente padrões básicos
      return this.fallbackIntentDetection(message);
    }
  }

  /**
   * Detecção de intenção por fallback usando padrões básicos
   */
  private fallbackIntentDetection(
    message: string
  ): IntentDetectionResult {
    const lowerMessage = message.toLowerCase();

    // Padrões para download de documento
    const downloadPatterns = [
      /baix(e|ar|ando)/i,
      /download/i,
      /obter.*documento/i,
      /pegar.*documento/i,
      /quero.*documento/i,
    ];

    // Padrões para resumo de processo
    const summarizePatterns = [
      /resum(o|ar|e)/i,
      /resumo.*processo/i,
      /me traga.*resumo/i,
      /mostre.*resumo/i,
    ];

    // Padrões para número de protocolo (formato comum: NNNNNNN-DD.AAAA.J.TR.OOOO)
    const protocolPattern = /(\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4})/;

    const hasDownloadPattern = downloadPatterns.some((pattern) =>
      pattern.test(message)
    );
    const hasSummarizePattern = summarizePatterns.some((pattern) =>
      pattern.test(message)
    );
    const protocolMatch = message.match(protocolPattern);

    let intention: UserIntent = UserIntent.GENERAL_QUERY;
    let protocolNumber: string | undefined = undefined;

    if (protocolMatch) {
      protocolNumber = protocolMatch[1];
    }

    if (hasDownloadPattern && protocolNumber) {
      intention = UserIntent.DOWNLOAD_DOCUMENT;
    } else if (hasSummarizePattern && protocolNumber) {
      intention = UserIntent.SUMMARIZE_PROCESS;
    } else if (protocolNumber) {
      // Se tem número de protocolo mas não padrão claro, assumir resumo
      intention = UserIntent.SUMMARIZE_PROCESS;
    }

    return {
      intention,
      protocolNumber,
      confidence: 0.5, // Baixa confiança no fallback
    };
  }
}

