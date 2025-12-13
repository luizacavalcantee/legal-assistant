import puppeteer, { Browser, Page } from "puppeteer";

export interface ProcessSearchResult {
  found: boolean;
  protocolNumber: string;
  error?: string;
}

/**
 * Serviço para interagir com o portal e-SAJ (consulta pública)
 */
export class eSAJService {
  private browser: Browser | null = null;
  private readonly eSAJUrl: string;
  private readonly headless: boolean;

  constructor() {
    // URL do e-SAJ - ajustar conforme necessário
    this.eSAJUrl =
      process.env.ESAJ_URL || "https://esaj.tjsp.jus.br/cpopg/open.do";
    this.headless = process.env.PUPPETEER_HEADLESS !== "false"; // headless por padrão
  }

  /**
   * Inicializa o navegador Puppeteer
   */
  private async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: this.headless,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
        ],
      });
    }
    return this.browser;
  }

  /**
   * Fecha o navegador
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Busca um processo no e-SAJ pelo número de protocolo
   * @param protocolNumber - Número do protocolo do processo
   * @returns Resultado da busca indicando se o processo foi encontrado
   */
  async findProcess(protocolNumber: string): Promise<ProcessSearchResult> {
    let page: Page | null = null;

    try {
      console.log(`🔍 Buscando processo ${protocolNumber} no e-SAJ...`);

      // Validar número do protocolo
      if (!protocolNumber || protocolNumber.trim().length === 0) {
        return {
          found: false,
          protocolNumber: protocolNumber,
          error: "Número de protocolo não fornecido",
        };
      }

      // Limpar e formatar número do protocolo (remover espaços, pontos, hífens)
      const cleanProtocol = protocolNumber.trim().replace(/[\s.\-]/g, "");

      // Inicializar navegador
      const browser = await this.initBrowser();
      page = await browser.newPage();

      // Configurar timeout
      page.setDefaultTimeout(30000); // 30 segundos

      // Navegar para a página de consulta pública
      console.log(`📄 Navegando para ${this.eSAJUrl}...`);
      await page.goto(this.eSAJUrl, {
        waitUntil: "networkidle2",
      });

      // Aguardar o carregamento da página
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Tentar encontrar o campo de busca do número do processo
      // Nota: Os seletores podem variar dependendo do portal específico
      // Este é um exemplo genérico que pode precisar ser ajustado
      const searchSelectors = [
        'input[name="numeroDigitoAnoUnificado"]',
        'input[name="numeroProcesso"]',
        'input[id="numeroDigitoAnoUnificado"]',
        'input[id="numeroProcesso"]',
        'input[type="text"]',
      ];

      let searchInput = null;
      for (const selector of searchSelectors) {
        try {
          searchInput = await page.$(selector);
          if (searchInput) {
            console.log(`✅ Campo de busca encontrado: ${selector}`);
            break;
          }
        } catch (e) {
          // Continuar tentando outros seletores
        }
      }

      if (!searchInput) {
        return {
          found: false,
          protocolNumber: cleanProtocol,
          error:
            "Campo de busca não encontrado. A estrutura do portal pode ter mudado.",
        };
      }

      // Inserir o número do protocolo
      await searchInput.type(cleanProtocol, { delay: 100 });

      // Tentar encontrar e clicar no botão de busca
      const searchButtonSelectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        'button:contains("Consultar")',
        'input[value*="Consultar"]',
        'button:contains("Buscar")',
      ];

      let searchButton = null;
      for (const selector of searchButtonSelectors) {
        try {
          searchButton = await page.$(selector);
          if (searchButton) {
            console.log(`✅ Botão de busca encontrado: ${selector}`);
            break;
          }
        } catch (e) {
          // Continuar tentando outros seletores
        }
      }

      if (!searchButton) {
        // Tentar pressionar Enter no campo de busca
        await searchInput.press("Enter");
      } else {
        await searchButton.click();
      }

      // Aguardar o carregamento da página de resultados
      await new Promise(resolve => setTimeout(resolve, 3000));
      await page
        .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
        .catch(() => {
          // Ignorar erro de timeout - a página pode já ter carregado
        });

      // Verificar se o processo foi encontrado
      // Procurar por indicadores de sucesso ou erro
      const pageContent = await page.content();
      const pageText = await page.evaluate(() => document.body.innerText);

      // Indicadores de que o processo foi encontrado
      const successIndicators = [
        "processo encontrado",
        "dados do processo",
        "número do processo",
        "classe",
        "assunto",
        "status",
        "andamentos",
      ];

      // Indicadores de que o processo não foi encontrado
      const errorIndicators = [
        "processo não encontrado",
        "não localizado",
        "não foi encontrado",
        "não existe",
        "inválido",
        "erro ao consultar",
      ];

      const hasSuccessIndicator = successIndicators.some((indicator) =>
        pageText.toLowerCase().includes(indicator.toLowerCase())
      );

      const hasErrorIndicator = errorIndicators.some((indicator) =>
        pageText.toLowerCase().includes(indicator.toLowerCase())
      );

      // Verificar se há elementos típicos de uma página de processo
      const processElements = await page.$$(
        'table, .processo, .dados-processo, [class*="processo"], [id*="processo"]'
      );

      if (hasErrorIndicator && !hasSuccessIndicator) {
        console.log(`❌ Processo ${cleanProtocol} não encontrado no e-SAJ`);
        return {
          found: false,
          protocolNumber: cleanProtocol,
          error: "Processo não encontrado no portal e-SAJ",
        };
      }

      if (hasSuccessIndicator || processElements.length > 0) {
        console.log(`✅ Processo ${cleanProtocol} encontrado no e-SAJ`);
        return {
          found: true,
          protocolNumber: cleanProtocol,
        };
      }

      // Se não houver indicadores claros, assumir que não foi encontrado
      // (mais seguro do que assumir sucesso)
      console.log(
        `⚠️  Não foi possível determinar se o processo ${cleanProtocol} foi encontrado`
      );
      return {
        found: false,
        protocolNumber: cleanProtocol,
        error:
          "Não foi possível determinar se o processo foi encontrado. A estrutura do portal pode ter mudado.",
      };
    } catch (error: any) {
      console.error(`❌ Erro ao buscar processo ${protocolNumber}:`, error);
      return {
        found: false,
        protocolNumber: protocolNumber,
        error: `Erro ao buscar processo: ${error.message}`,
      };
    } finally {
      // Fechar a página, mas manter o navegador aberto para reutilização
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Limpa recursos (fecha navegador)
   */
  async cleanup(): Promise<void> {
    await this.closeBrowser();
  }
}
