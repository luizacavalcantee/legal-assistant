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
      try {
        // Tentar encontrar o executável do Chrome
        let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        
        if (!executablePath) {
          // Verificar se o Chrome está no cache padrão do Puppeteer
          const cacheDirs: string[] = [
            process.env.PUPPETEER_CACHE_DIR,
            process.env.HOME ? `${process.env.HOME}/.cache/puppeteer` : undefined,
            "/opt/render/.cache/puppeteer",
            "/root/.cache/puppeteer",
          ].filter((dir): dir is string => Boolean(dir));
          
          // Tentar encontrar o Chrome instalado pelo Puppeteer
          try {
            // Procurar o Chrome nos diretórios de cache
            for (const cacheDir of cacheDirs) {
              if (!fs.existsSync(cacheDir)) continue;
              
              try {
                // Listar diretórios chrome no cache
                const chromeDir = path.join(cacheDir, "chrome");
                if (fs.existsSync(chromeDir)) {
                  const entries = fs.readdirSync(chromeDir);
                  for (const entry of entries) {
                    const chromePath = path.join(chromeDir, entry, "chrome-linux64", "chrome");
                    if (fs.existsSync(chromePath) && fs.statSync(chromePath).isFile()) {
                      executablePath = chromePath;
                      console.log(`✅ Chrome encontrado em: ${executablePath}`);
                      break;
                    }
                  }
                  if (executablePath) break;
                }
              } catch (e) {
                // Continuar procurando
              }
            }
            
            // Fallback: tentar usar Chrome do sistema (se disponível)
            if (!executablePath) {
              const systemChromePaths = [
                "/usr/bin/google-chrome",
                "/usr/bin/chromium",
                "/usr/bin/chromium-browser",
                "/usr/local/bin/chrome",
              ];
              
              for (const chromePath of systemChromePaths) {
                if (fs.existsSync(chromePath)) {
                  executablePath = chromePath;
                  console.log(`✅ Chrome do sistema encontrado em: ${executablePath}`);
                  break;
                }
              }
            }
          } catch (e: any) {
            // Se não conseguir encontrar, deixar o Puppeteer tentar automaticamente
            console.log("⚠️  Não foi possível detectar o caminho do Chrome automaticamente");
            console.log(`   Cache dirs verificados: ${cacheDirs.join(", ")}`);
          }
        }
        
        if (executablePath) {
          console.log(`🔧 Usando Chrome em: ${executablePath}`);
        } else {
          console.log("🔧 Tentando usar Chrome padrão do Puppeteer...");
        }
        
        this.browser = await puppeteer.launch({
          headless: this.headless,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu",
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
          ],
          executablePath: executablePath || undefined,
        });

        // Handler para desconexão inesperada
        this.browser.on("disconnected", () => {
          console.log("⚠️  Navegador desconectado. Reinicializando...");
          this.browser = null;
        });
      } catch (error: any) {
        console.error("❌ Erro ao inicializar Puppeteer:", error.message);
        console.error("   Puppeteer requer Chrome instalado no sistema.");
        console.error("   No Render, você precisa configurar Chrome separadamente.");
        console.error("   Funcionalidades do e-SAJ não estarão disponíveis.");
        throw new Error(
          `Puppeteer não pode ser inicializado: ${error.message}. ` +
          `Funcionalidades do e-SAJ requerem Chrome instalado no sistema.`
        );
      }
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

