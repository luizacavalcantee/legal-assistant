import { Page } from "puppeteer";
import { eSAJBase } from "./esaj/eSAJBase";
import {
  eSAJProcessSearcher,
  ProcessSearchResult,
} from "./esaj/eSAJProcessSearcher";
import {
  eSAJDocumentFinder,
  DocumentCandidate,
} from "./esaj/eSAJDocumentFinder";
import {
  eSAJDocumentDownloader,
  DocumentDownloadResult,
} from "./esaj/eSAJDocumentDownloader";
import {
  eSAJMovementsExtractor,
  ProcessMovementsResult,
} from "./esaj/eSAJMovementsExtractor";
import {
  eSAJDocumentTextExtractor,
  DocumentTextResult,
} from "./esaj/eSAJDocumentTextExtractor";

// Re-exportar interfaces para manter compatibilidade
export type {
  ProcessSearchResult,
  DocumentDownloadResult,
  ProcessMovementsResult,
  DocumentTextResult,
};

/**
 * Serviço principal para interagir com o portal e-SAJ (consulta pública)
 *
 * Este serviço orquestra os módulos especializados:
 * - eSAJProcessSearcher: Busca de processos
 * - eSAJDocumentFinder: Encontrar documentos na lista
 * - eSAJDocumentDownloader: Baixar documentos (extrair URL)
 * - eSAJMovementsExtractor: Extrair movimentações
 * - eSAJDocumentTextExtractor: Extrair texto de PDFs
 */
export class eSAJService extends eSAJBase {
  private processSearcher: eSAJProcessSearcher;
  private documentFinder: eSAJDocumentFinder;
  private documentDownloader: eSAJDocumentDownloader;
  private movementsExtractor: eSAJMovementsExtractor;
  private documentTextExtractor: eSAJDocumentTextExtractor;

  constructor() {
    super();
    // Todos os módulos compartilham a mesma instância base (mesmo navegador)
    // Isso evita criar múltiplas instâncias do Puppeteer
    this.processSearcher = new eSAJProcessSearcher(this);
    this.documentFinder = new eSAJDocumentFinder(this);
    this.documentDownloader = new eSAJDocumentDownloader(this);
    this.movementsExtractor = new eSAJMovementsExtractor(this);
    this.documentTextExtractor = new eSAJDocumentTextExtractor(this);
  }

  /**
   * Busca um processo no e-SAJ pelo número de protocolo
   * @param protocolNumber - Número do protocolo do processo
   * @returns Resultado da busca indicando se o processo foi encontrado
   */
  async findProcess(protocolNumber: string): Promise<ProcessSearchResult> {
    return this.processSearcher.findProcess(protocolNumber);
  }

  /**
   * Extrai a URL do PDF de um documento específico de um processo no e-SAJ
   *
   * ⚠️ NOTA: Este método NÃO realiza download direto do arquivo. Ele apenas extrai e retorna
   * a URL do PDF, que pode expirar devido a limitações de sessão do e-SAJ.
   *
   * @param protocolNumber - Número do protocolo do processo
   * @param documentType - Tipo de documento solicitado (ex: "petição inicial", "sentença")
   * @param processPageUrl - URL opcional da página de detalhes do processo (para evitar buscar novamente)
   * @returns Resultado com URL do PDF (não realiza download direto)
   */
  async downloadDocument(
    protocolNumber: string,
    documentType: string,
    processPageUrl?: string,
    existingPage?: Page
  ): Promise<DocumentDownloadResult> {
    let page: Page | null = null;
    let shouldClosePage = true; // Flag para controlar se devemos fechar a página

    try {
      console.log(
        `📥 Iniciando download de documento "${documentType}" do processo ${protocolNumber}...`
      );

      // Validar parâmetros
      if (!protocolNumber || protocolNumber.trim().length === 0) {
        return {
          success: false,
          protocolNumber: protocolNumber,
          documentType: documentType,
          error: "Número de protocolo não fornecido",
        };
      }

      if (!documentType || documentType.trim().length === 0) {
        return {
          success: false,
          protocolNumber: protocolNumber,
          documentType: documentType,
          error: "Tipo de documento não fornecido",
        };
      }

      // Limpar e formatar número do protocolo
      const cleanProtocol = protocolNumber.trim().replace(/[\s.\-]/g, "");

      // ETAPA 1: Navegação para a página de detalhes
      if (existingPage && !existingPage.isClosed()) {
        // Reutilizar página existente
        console.log(`♻️  Reutilizando página já aberta na página de detalhes`);
        page = existingPage;
        shouldClosePage = false; // Não fechar página reutilizada
        await this.setupPageForDownloads(page);
        page.setDefaultTimeout(30000);
      } else if (processPageUrl) {
        // Navegar para URL fornecida
        console.log(
          `📄 Navegando diretamente para a página de detalhes: ${processPageUrl}`
        );
        const browser = await this.initBrowser();
        page = await browser.newPage();
        await this.setupPageForDownloads(page);
        page.setDefaultTimeout(30000);
        await page.goto(processPageUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        // Se não temos a URL, fazer a busca completa
        const searchResult = await this.processSearcher.findProcess(
          cleanProtocol
        );
        if (!searchResult.found || !searchResult.processPageUrl) {
          return {
            success: false,
            protocolNumber: cleanProtocol,
            documentType: documentType,
            error: searchResult.error || "Processo não encontrado",
          };
        }

        // Se a busca retornou uma página, reutilizá-la
        if (searchResult.page && !searchResult.page.isClosed()) {
          console.log(`♻️  Reutilizando página da busca do processo`);
          page = searchResult.page;
          shouldClosePage = false; // Não fechar página reutilizada
          await this.setupPageForDownloads(page);
          page.setDefaultTimeout(30000);
        } else {
          // Caso contrário, navegar para a URL
          const browser = await this.initBrowser();
          page = await browser.newPage();
          await this.setupPageForDownloads(page);
          page.setDefaultTimeout(30000);
          await page.goto(searchResult.processPageUrl!, {
            waitUntil: "networkidle2",
            timeout: 30000,
          });
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      // ETAPA 2: Encontrar documento na lista
      const candidates = await this.documentFinder.findDocuments(
        page,
        documentType
      );

      if (candidates.length === 0) {
        return {
          success: false,
          protocolNumber: cleanProtocol,
          documentType: documentType,
          error:
            "Documento solicitado não foi encontrado na movimentação do processo.",
        };
      }

      // ETAPA 3: Selecionar melhor candidato (sem senha)
      const selectedDocument =
        this.documentFinder.selectBestDocument(candidates);

      if (!selectedDocument) {
        return {
          success: false,
          protocolNumber: cleanProtocol,
          documentType: documentType,
          error:
            "O documento solicitado está disponível, mas requer credenciais de acesso (senha/login) e não pode ser baixado publicamente.",
        };
      }

      // ETAPA 4: Extrair URL do PDF
      return await this.documentDownloader.downloadDocument(
        page,
        selectedDocument,
        cleanProtocol,
        documentType
      );
    } catch (error: any) {
      console.error(
        `❌ Erro ao baixar documento do processo ${protocolNumber}:`,
        error
      );
      return {
        success: false,
        protocolNumber: protocolNumber,
        documentType: documentType,
        error: `Erro ao baixar documento: ${error.message}`,
      };
    } finally {
      // Só fechar a página se não foi reutilizada
      if (page && shouldClosePage && !page.isClosed()) {
        await page.close();
      }
    }
  }

  /**
   * Extrai todas as movimentações de um processo
   * @param protocolNumber - Número do protocolo do processo
   * @param processPageUrl - URL opcional da página de detalhes do processo (para evitar buscar novamente)
   * @returns Resultado com texto completo das movimentações
   */
  async extractMovements(
    protocolNumber: string,
    processPageUrl?: string
  ): Promise<ProcessMovementsResult> {
    return this.movementsExtractor.extractMovements(
      protocolNumber,
      processPageUrl
    );
  }

  /**
   * Baixa um documento do e-SAJ e extrai seu texto
   * @param protocolNumber - Número do protocolo do processo
   * @param documentType - Tipo de documento solicitado (ex: "petição inicial", "sentença")
   * @param processPageUrl - URL opcional da página de detalhes do processo
   * @returns Resultado com texto extraído do PDF
   */
  async extractDocumentText(
    protocolNumber: string,
    documentType: string,
    processPageUrl?: string
  ): Promise<DocumentTextResult> {
    let page: Page | null = null;

    try {
      console.log(
        `📄 Extraindo texto do documento "${documentType}" do processo ${protocolNumber}...`
      );

      // Validar parâmetros
      if (!protocolNumber || protocolNumber.trim().length === 0) {
        return {
          success: false,
          protocolNumber: protocolNumber,
          documentType: documentType,
          error: "Número de protocolo não fornecido",
        };
      }

      if (!documentType || documentType.trim().length === 0) {
        return {
          success: false,
          protocolNumber: protocolNumber,
          documentType: documentType,
          error: "Tipo de documento não fornecido",
        };
      }

      // Limpar e formatar número do protocolo
      const cleanProtocol = protocolNumber.trim().replace(/[\s.\-]/g, "");

      // Inicializar navegador
      const browser = await this.initBrowser();
      page = await browser.newPage();
      page.setDefaultTimeout(30000);

      // Navegar para a página de detalhes
      if (processPageUrl) {
        await page.goto(processPageUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        // Se não temos a URL, fazer a busca completa
        const searchResult = await this.processSearcher.findProcess(
          cleanProtocol
        );
        if (!searchResult.found || !searchResult.processPageUrl) {
          return {
            success: false,
            protocolNumber: cleanProtocol,
            documentType: documentType,
            error: searchResult.error || "Processo não encontrado",
          };
        }
        await page.goto(searchResult.processPageUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Usar o extrator de texto
      return await this.documentTextExtractor.extractText(
        page,
        cleanProtocol,
        documentType
      );
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
    } finally {
      if (page && !page.isClosed()) {
        await page.close();
      }
    }
  }
}
