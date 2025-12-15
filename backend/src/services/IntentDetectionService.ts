import { LLMService } from "./LLMService";

export enum UserIntent {
  RAG_QUERY = "RAG_QUERY",
  DOWNLOAD_DOCUMENT = "DOWNLOAD_DOCUMENT",
  SUMMARIZE_PROCESS = "SUMMARIZE_PROCESS",
  QUERY_DOCUMENT = "QUERY_DOCUMENT", // Perguntas sobre conteúdo de documentos de processos
  GENERAL_QUERY = "GENERAL_QUERY",
}

export interface IntentDetectionResult {
  intention: UserIntent;
  protocolNumber?: string;
  documentType?: string; // Tipo de documento (ex: "sentença", "petição inicial")
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
  "intention": "RAG_QUERY" | "DOWNLOAD_DOCUMENT" | "SUMMARIZE_PROCESS" | "QUERY_DOCUMENT" | "GENERAL_QUERY",
  "protocolNumber": "número do protocolo se relevante, ou null",
  "documentType": "tipo de documento se relevante (ex: 'sentença', 'petição inicial'), ou null",
  "confidence": número entre 0 e 1
}

Intenções:
- RAG_QUERY: Pergunta sobre a base de conhecimento interna, documentos indexados, leis, normas, etc.
- DOWNLOAD_DOCUMENT: Solicitação de download de documento de um processo (ex: "Baixe a petição inicial do processo X", "Quero o documento Y do processo Z")
- SUMMARIZE_PROCESS: Solicitação de resumo de processo (ex: "Me traga um resumo do processo X", "Resuma o processo Y")
- QUERY_DOCUMENT: Pergunta específica sobre o CONTEÚDO de um documento de um processo (ex: "Qual é o teor da sentença do processo X?", "O que diz a petição inicial do processo Y?", "Quais são os pedidos na inicial do processo Z?")
- GENERAL_QUERY: Pergunta genérica que não se encaixa nas outras categorias

IMPORTANTE:
- Se a intenção for DOWNLOAD_DOCUMENT, SUMMARIZE_PROCESS ou QUERY_DOCUMENT, você DEVE extrair o número do protocolo da mensagem
- Para QUERY_DOCUMENT, também tente identificar o tipo de documento mencionado (sentença, petição inicial, etc.)
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

      // Validar tipo de documento (se presente)
      let documentType: string | undefined = undefined;
      if (parsed.documentType && parsed.documentType !== "null") {
        const cleanDocType = parsed.documentType.trim();
        if (cleanDocType.length > 0) {
          documentType = cleanDocType;
        }
      }

      return {
        intention: intention as UserIntent,
        protocolNumber: protocolNumber,
        documentType: documentType,
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

    // Padrões para perguntas sobre documentos
    const queryDocumentPatterns = [
      /qual.*teor/i,
      /o que diz/i,
      /quais.*pedidos/i,
      /conteúdo.*documento/i,
      /texto.*documento/i,
      /o que.*sentença/i,
      /o que.*petição/i,
      /o que.*inicial/i,
    ];

    // Padrões para número de protocolo (formato comum: NNNNNNN-DD.AAAA.J.TR.OOOO)
    const protocolPattern = /(\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4})/;

    const hasDownloadPattern = downloadPatterns.some((pattern) =>
      pattern.test(message)
    );
    const hasSummarizePattern = summarizePatterns.some((pattern) =>
      pattern.test(message)
    );
    const hasQueryDocumentPattern = queryDocumentPatterns.some((pattern) =>
      pattern.test(message)
    );
    const protocolMatch = message.match(protocolPattern);

    // Extrair tipo de documento se mencionado
    let documentType: string | undefined = undefined;
    const docTypePatterns = [
      /sentença/i,
      /petição.*inicial/i,
      /inicial/i,
      /decisão/i,
      /despacho/i,
      /acórdão/i,
    ];
    for (const pattern of docTypePatterns) {
      const match = message.match(pattern);
      if (match) {
        documentType = match[0].toLowerCase();
        break;
      }
    }

    let intention: UserIntent = UserIntent.GENERAL_QUERY;
    let protocolNumber: string | undefined = undefined;

    if (protocolMatch) {
      protocolNumber = protocolMatch[1];
    }

    if (hasQueryDocumentPattern && protocolNumber) {
      intention = UserIntent.QUERY_DOCUMENT;
    } else if (hasDownloadPattern && protocolNumber) {
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
      documentType,
      confidence: 0.5, // Baixa confiança no fallback
    };
  }
}

