import { Page } from "puppeteer";
import axios from "axios";
import { eSAJBase } from "./eSAJBase";
import { eSAJDocumentFinder } from "./eSAJDocumentFinder";
import { eSAJDocumentDownloader } from "./eSAJDocumentDownloader";

// pdf-parse versão 2.4.5 exporta PDFParse como classe
const pdfParseModule = require("pdf-parse");
const PDFParse = pdfParseModule.PDFParse;

export interface DocumentTextResult {
  success: boolean;
  protocolNumber: string;
  documentType?: string;
  text?: string; // Texto extraído do PDF
  error?: string;
}

/**
 * Responsável por extrair texto de documentos PDF do e-SAJ
 */
export class eSAJDocumentTextExtractor extends eSAJBase {
  private documentFinder: eSAJDocumentFinder;
  private documentDownloader: eSAJDocumentDownloader;

  constructor(base?: eSAJBase) {
    super(base);
    // Compartilhar a mesma instância base para reutilizar navegador
    this.documentFinder = new eSAJDocumentFinder(base || this);
    this.documentDownloader = new eSAJDocumentDownloader(base || this);
  }

  /**
   * Baixa um documento do e-SAJ e extrai seu texto
   * @param page - Página do Puppeteer já na página de detalhes do processo
   * @param protocolNumber - Número do protocolo do processo
   * @param documentType - Tipo de documento solicitado (ex: "petição inicial", "sentença")
   * @returns Resultado com texto extraído do PDF
   */
  async extractText(
    page: Page,
    protocolNumber: string,
    documentType: string
  ): Promise<DocumentTextResult> {
    try {
      console.log(
        `📄 Extraindo texto do documento "${documentType}" do processo ${protocolNumber}...`
      );

      // 1. Encontrar documento na lista
      const candidates = await this.documentFinder.findDocuments(
        page,
        documentType
      );

      if (candidates.length === 0) {
        return {
          success: false,
          protocolNumber: protocolNumber,
          documentType: documentType,
          error:
            "Documento solicitado não foi encontrado na movimentação do processo.",
        };
      }

      // 2. Selecionar melhor candidato (sem senha)
      const selectedDocument = this.documentFinder.selectBestDocument(
        candidates
      );

      if (!selectedDocument) {
        return {
          success: false,
          protocolNumber: protocolNumber,
          documentType: documentType,
          error:
            "O documento solicitado está disponível, mas requer credenciais de acesso (senha/login) e não pode ser baixado publicamente.",
        };
      }

      // 3. Extrair URL do PDF
      const downloadResult = await this.documentDownloader.downloadDocument(
        page,
        selectedDocument,
        protocolNumber,
        documentType
      );

      if (!downloadResult.success || !downloadResult.pdfUrl) {
        return {
          success: false,
          protocolNumber: protocolNumber,
          documentType: documentType,
          error:
            downloadResult.error ||
            "Não foi possível obter a URL do documento.",
        };
      }

      const pdfUrl = downloadResult.pdfUrl;
      console.log(`✅ URL do PDF obtida: ${pdfUrl}`);

      // 4. Obter cookies da sessão
      const cookies = await page.cookies();
      const cookieString = cookies
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");

      console.log(`🍪 Cookies da sessão obtidos (${cookies.length} cookies)`);

      // 5. Baixar o PDF usando axios
      console.log(`📥 Baixando PDF para extrair texto...`);
      const response = await axios({
        method: "GET",
        url: pdfUrl,
        headers: {
          Cookie: cookieString,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: page.url(),
          Accept: "application/pdf,application/octet-stream,*/*",
        },
        responseType: "arraybuffer",
        timeout: 60000,
      });

      const pdfBuffer = Buffer.from(response.data);
      console.log(
        `✅ PDF baixado (${(pdfBuffer.length / 1024).toFixed(
          2
        )} KB). Extraindo texto...`
      );

      // 6. Extrair texto do PDF usando pdf-parse
      console.log(`🔍 Tentando extrair texto do PDF...`);
      let pdfData: any;
      let extractedText: string = "";

      try {
        // Criar instância do parser
        pdfData = new PDFParse({ 
          data: pdfBuffer,
          verbosity: 0 // Reduzir verbosidade
        });
        
        // Aguardar o carregamento completo do PDF
        await pdfData.load();
        
        const numPages = pdfData.doc?.numPages || 0;
        console.log(`📄 PDF carregado: ${numPages} página(s)`);
        
        // Extrair texto usando getText() - método recomendado do pdf-parse
        try {
          const textResult = await pdfData.getText({
            parseHyperlinks: false,
            parsePageInfo: false,
            pageJoiner: "\n"
          });
          extractedText = textResult.text || "";
        } catch (getTextError: any) {
          console.log(`⚠️  Erro ao usar getText(), tentando método alternativo: ${getTextError.message}`);
          // Fallback: tentar acessar text diretamente
          extractedText = pdfData.text || "";
        }
        
        // Se ainda não tem texto, tentar extrair página por página
        if (!extractedText || extractedText.trim().length === 0) {
          console.log(`⚠️  Texto não encontrado. Tentando extrair página por página...`);
          
          // Tentar extrair de cada página individualmente
          const textParts: string[] = [];
          for (let i = 1; i <= numPages; i++) {
            try {
              const pageResult = await pdfData.getText({
                first: i,
                last: i,
                parseHyperlinks: false,
                parsePageInfo: false
              });
              if (pageResult.text && pageResult.text.trim()) {
                textParts.push(pageResult.text.trim());
              }
            } catch (pageError: any) {
              console.log(`⚠️  Erro ao extrair texto da página ${i}: ${pageError.message}`);
            }
          }
          
          extractedText = textParts.join("\n\n");
        }
        
        // Se ainda não conseguiu extrair texto
        if (!extractedText || extractedText.trim().length === 0) {
          console.log(`⚠️  PDF processado mas sem texto extraível. Páginas: ${numPages}`);
          
          // Verificar se há indicações de que é uma imagem escaneada
          const isScanned = numPages > 0 && !extractedText;
          
          if (isScanned) {
            console.log(`📸 PDF parece ser uma imagem escaneada (sem texto extraível)`);
            return {
              success: false,
              protocolNumber: protocolNumber,
              documentType: documentType,
              error: "O PDF é uma imagem escaneada e não contém texto extraível. PDFs escaneados requerem OCR (reconhecimento óptico de caracteres) que não está disponível no momento. O documento foi baixado com sucesso, mas não é possível extrair o texto automaticamente.",
            };
          }
          
          return {
            success: false,
            protocolNumber: protocolNumber,
            documentType: documentType,
            error: `O PDF não contém texto extraível. O documento pode estar protegido, corrompido ou ser uma imagem escaneada. Tamanho do PDF: ${(pdfBuffer.length / 1024).toFixed(2)} KB, Páginas: ${numPages}. O arquivo foi baixado com sucesso, mas não foi possível extrair o texto.`,
          };
        }
      } catch (parseError: any) {
        console.error(`❌ Erro ao processar PDF com pdf-parse:`, parseError);
        
        // Verificar se é um erro específico de PDF
        if (parseError.message?.includes("Invalid PDF") || parseError.message?.includes("corrupted")) {
          return {
            success: false,
            protocolNumber: protocolNumber,
            documentType: documentType,
            error: `O PDF está corrompido ou em formato inválido: ${parseError.message}`,
          };
        }
        
        // Se o PDF foi baixado mas não pode ser processado, informar
        return {
          success: false,
          protocolNumber: protocolNumber,
          documentType: documentType,
          error: `Erro ao processar PDF: ${parseError.message || "Erro desconhecido"}. O PDF foi baixado com sucesso (${(pdfBuffer.length / 1024).toFixed(2)} KB), mas não foi possível extrair o texto.`,
        };
      }

      console.log(
        `✅ Texto extraído com sucesso (${extractedText.length} caracteres)`
      );

      // Limpar parser
      if (pdfData && typeof pdfData.destroy === "function") {
        try {
          await pdfData.destroy();
        } catch (e) {
          // Ignorar erros na limpeza
        }
      }

      return {
        success: true,
        protocolNumber: protocolNumber,
        documentType: documentType,
        text: extractedText.trim(),
      };
    } catch (error: any) {
      console.error(
        `❌ Erro ao extrair texto do documento do processo ${protocolNumber}:`,
        error
      );
      return {
        success: false,
        protocolNumber: protocolNumber,
        documentType: documentType,
        error: `Erro ao extrair texto: ${error.message}`,
      };
    }
  }
}

