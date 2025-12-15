import { Page } from "puppeteer";
import * as fs from "fs";
import * as path from "path";
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
   * Clica no botão de download dentro do iframe da Pasta Digital e inicia o download
   * 
   * Este método assume que a página já está na "Pasta Digital" e o iframe#documento está carregado.
   * 
   * @param page - Página do Puppeteer já na página da Pasta Digital
   * @returns Resultado com informações do download (caminho do arquivo, nome, etc.)
   */
  async downloadFromIframe(page: Page): Promise<{
    success: boolean;
    filePath?: string;
    fileName?: string;
    error?: string;
  }> {
    try {
      console.log(`📥 Iniciando download do documento via iframe...`);

      // ETAPA 1: Configurar página para downloads
      console.log(`⚙️  Configurando página para downloads...`);
      await this.setupPageForDownloads(page);

      // ETAPA 2: Localizar o iframe #documento
      console.log(`🔍 Procurando iframe #documento...`);
      
      // Aguardar o iframe aparecer na página
      const iframe = await page.waitForSelector("iframe#documento", {
        timeout: 30000,
        visible: true,
      });

      if (!iframe) {
        return {
          success: false,
          error: "Iframe #documento não encontrado na página",
        };
      }

      console.log(`✅ Iframe #documento encontrado`);

      // ETAPA 3: Acessar o contexto do iframe
      console.log(`🔍 Acessando contexto do iframe...`);
      
      // Obter o frame do iframe usando contentFrame()
      const iframeFrame = await iframe.contentFrame();

      if (!iframeFrame) {
        return {
          success: false,
          error: "Não foi possível acessar o contexto do iframe (contentFrame retornou null)",
        };
      }

      console.log(`✅ Contexto do iframe acessado`);

      // Aguardar o conteúdo do iframe carregar completamente
      console.log(`⏳ Aguardando conteúdo do iframe carregar...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // ETAPA 4: Localizar e clicar no botão de download
      console.log(`🔍 Procurando botão #download dentro do iframe...`);
      
      // Aguardar o botão aparecer dentro do iframe
      const downloadButton = await iframeFrame.waitForSelector("#download", {
        timeout: 15000,
        visible: true,
      });

      if (!downloadButton) {
        return {
          success: false,
          error: "Botão #download não encontrado dentro do iframe",
        };
      }

      console.log(`✅ Botão #download encontrado dentro do iframe`);

      // Obter lista de arquivos antes do download
      const filesBefore = fs.existsSync(this.downloadsDir)
        ? fs.readdirSync(this.downloadsDir)
        : [];

      console.log(`📋 Arquivos antes do download: ${filesBefore.length}`);

      // ETAPA 5: Clicar no botão de download
      console.log(`🔘 Clicando no botão de download...`);
      await downloadButton.click();
      console.log(`✅ Botão de download clicado`);

      // Aguardar um pouco para o download iniciar
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // ETAPA 6: Aguardar a conclusão do download
      console.log(`⏳ Aguardando download completar...`);
      
      let downloadedFile: string | null = null;
      const maxWaitTime = 60000; // 60 segundos
      const checkInterval = 1000; // Verificar a cada 1 segundo
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval));

        if (fs.existsSync(this.downloadsDir)) {
          const filesAfter = fs.readdirSync(this.downloadsDir);
          
          // Encontrar arquivo novo (não estava na lista antes)
          const newFiles = filesAfter.filter(
            (file) => !filesBefore.includes(file)
          );

          // Filtrar arquivos temporários (.crdownload, .tmp, etc.)
          const completedFiles = newFiles.filter(
            (file) =>
              !file.endsWith(".crdownload") &&
              !file.endsWith(".tmp") &&
              !file.endsWith(".part")
          );

          if (completedFiles.length > 0) {
            // Pegar o primeiro arquivo completo
            downloadedFile = completedFiles[0];
            console.log(`✅ Arquivo baixado encontrado: ${downloadedFile}`);
            break;
          }

          // Verificar se ainda há arquivos sendo baixados
          const downloadingFiles = newFiles.filter(
            (file) =>
              file.endsWith(".crdownload") ||
              file.endsWith(".tmp") ||
              file.endsWith(".part")
          );

          if (downloadingFiles.length === 0 && newFiles.length > 0) {
            // Se não há mais arquivos sendo baixados, mas há arquivos novos, considerar completo
            downloadedFile = newFiles[0];
            console.log(`✅ Arquivo baixado encontrado: ${downloadedFile}`);
            break;
          }
        }
      }

      if (!downloadedFile) {
        return {
          success: false,
          error: "Timeout aguardando download completar (60 segundos). Nenhum arquivo novo foi encontrado no diretório de downloads.",
        };
      }

      const filePath = path.join(this.downloadsDir, downloadedFile);
      const fileName = downloadedFile;

      // Verificar se o arquivo realmente existe e tem tamanho > 0
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
          return {
            success: false,
            error: "Arquivo baixado está vazio (0 bytes)",
          };
        }
        console.log(`✅ Download concluído: ${fileName} (${stats.size} bytes)`);
      } else {
        return {
          success: false,
          error: `Arquivo baixado não encontrado no caminho esperado: ${filePath}`,
        };
      }

      return {
        success: true,
        filePath: filePath,
        fileName: fileName,
      };
    } catch (error: any) {
      console.error(`❌ Erro ao baixar documento via iframe:`, error);
      return {
        success: false,
        error: `Erro ao baixar documento: ${error.message}`,
      };
    }
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
