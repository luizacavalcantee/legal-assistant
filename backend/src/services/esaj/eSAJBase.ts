import puppeteer, { Browser, Page } from "puppeteer";
import * as fs from "fs";
import * as path from "path";

/**
 * Classe base para serviços e-SAJ
 * Gerencia navegador Puppeteer e configurações compartilhadas
 */
export class eSAJBase {
  protected browser: Browser | null = null;
  protected readonly eSAJUrl: string;
  protected readonly headless: boolean;
  protected readonly downloadsDir: string;

  constructor(base?: eSAJBase) {
    // Se uma instância base for fornecida, reutilizar navegador e configurações
    if (base) {
      // @ts-ignore - Compartilhar navegador entre instâncias
      this.browser = base.browser;
      // @ts-ignore - Compartilhar configurações
      this.eSAJUrl = base.eSAJUrl;
      this.headless = base.headless;
      this.downloadsDir = base.downloadsDir;
      return; // Não inicializar novamente
    }
    // URL do e-SAJ - ajustar conforme necessário
    this.eSAJUrl =
      process.env.ESAJ_URL || "https://esaj.tjsp.jus.br/cpopg/open.do";
    this.headless = process.env.PUPPETEER_HEADLESS !== "false"; // headless por padrão

    // Diretório para downloads temporários
    this.downloadsDir =
      process.env.DOWNLOADS_DIR || path.join(process.cwd(), "downloads_esaj");

    // Criar diretório se não existir
    if (!fs.existsSync(this.downloadsDir)) {
      fs.mkdirSync(this.downloadsDir, { recursive: true });
    }
  }

  /**
   * Inicializa o navegador Puppeteer
   */
  protected async initBrowser(): Promise<Browser> {
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

      // Handler para desconexão inesperada
      this.browser.on("disconnected", () => {
        console.log("⚠️  Navegador desconectado. Reinicializando...");
        this.browser = null;
      });
    }
    return this.browser;
  }

  /**
   * Fecha o navegador
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      const pages = await this.browser.pages();
      // Fechar todas as páginas antes de fechar o navegador
      await Promise.all(pages.map((page) => page.close()));
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Configura uma página para downloads programáticos
   */
  protected async setupPageForDownloads(page: Page): Promise<void> {
    try {
      // Configurar cliente CDP para interceptar downloads
      const client = await page.target().createCDPSession();

      // Configurar comportamento de download
      await client.send("Page.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: this.downloadsDir,
      });

      console.log(`✅ Configuração de downloads aplicada na página`);
    } catch (error: any) {
      console.log(
        `⚠️  Erro ao configurar downloads: ${error.message}. Continuando...`
      );
    }
  }

  /**
   * Limpa recursos (fecha navegador)
   */
  async cleanup(): Promise<void> {
    await this.closeBrowser();
  }
}

