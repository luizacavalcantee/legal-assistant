import puppeteer, { Browser, Page } from "puppeteer";
import * as fs from "fs";
import * as path from "path";
import type {
  ProgressCallback,
  ProgressUpdate,
} from "../../types/progress.types";

/**
 * Classe base para serviços e-SAJ
 * Gerencia navegador Puppeteer e configurações compartilhadas
 */
export class eSAJBase {
  protected browser: Browser | null = null;
  protected readonly eSAJUrl: string;
  protected readonly headless: boolean;
  protected readonly downloadsDir: string;

  /**
   * Callback opcional para reportar progresso
   */
  protected progressCallback?: ProgressCallback;

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
          // Priorizar diretório do projeto (persiste entre builds) e depois cache do sistema
          const cacheDirs: string[] = [
            process.env.PUPPETEER_CACHE_DIR,
            path.join(process.cwd(), ".cache", "puppeteer"), // Diretório dentro do projeto (persiste)
            process.env.HOME
              ? `${process.env.HOME}/.cache/puppeteer`
              : undefined,
            "/opt/render/.cache/puppeteer",
            "/root/.cache/puppeteer",
          ].filter((dir): dir is string => Boolean(dir));

          console.log(
            `🔍 Procurando Chrome nos diretórios: ${cacheDirs.join(", ")}`
          );

          // Função recursiva para encontrar o executável do Chrome
          const findChromeRecursive = (
            dir: string,
            depth: number = 0
          ): string | null => {
            if (depth > 6) return null; // Limitar profundidade

            try {
              if (!fs.existsSync(dir)) return null;

              const stat = fs.statSync(dir);
              if (stat.isFile()) {
                // Verificar se é o executável do Chrome (nome e permissões de execução)
                const basename = path.basename(dir);
                if (basename === "chrome" || basename === "chrome-linux64") {
                  // Verificar se tem permissão de execução ou se é um arquivo executável
                  try {
                    const mode = fs.statSync(dir).mode;
                    if (mode & 0o111 || mode & 0o100) {
                      return dir;
                    }
                  } catch {
                    // Se não conseguir verificar permissões, assumir que é o arquivo correto
                    if (basename === "chrome") {
                      return dir;
                    }
                  }
                }
                return null;
              }

              if (stat.isDirectory()) {
                const entries = fs.readdirSync(dir);
                // Priorizar diretórios que podem conter o Chrome
                const priorityEntries = entries.filter(
                  (e) =>
                    e.includes("chrome") ||
                    e.includes("linux") ||
                    e.includes("143")
                );
                const otherEntries = entries.filter(
                  (e) => !priorityEntries.includes(e)
                );

                // Procurar primeiro nos diretórios prioritários
                for (const entry of [...priorityEntries, ...otherEntries]) {
                  const fullPath = path.join(dir, entry);
                  const result = findChromeRecursive(fullPath, depth + 1);
                  if (result) return result;
                }
              }
            } catch (e) {
              // Ignorar erros e continuar
            }
            return null;
          };

          // Tentar encontrar o Chrome instalado pelo Puppeteer
          try {
            // Procurar o Chrome nos diretórios de cache
            for (const cacheDir of cacheDirs) {
              console.log(`🔍 Verificando diretório: ${cacheDir}`);

              // Tentar criar o diretório se não existir (apenas para diretórios dentro do projeto)
              if (!fs.existsSync(cacheDir)) {
                if (cacheDir.includes(process.cwd())) {
                  try {
                    fs.mkdirSync(cacheDir, { recursive: true });
                    console.log(`   📁 Diretório criado: ${cacheDir}`);
                  } catch (mkdirError: any) {
                    console.log(
                      `   ⚠️  Não foi possível criar diretório: ${cacheDir} - ${mkdirError.message}`
                    );
                  }
                } else {
                  console.log(`   ⚠️  Diretório não existe: ${cacheDir}`);
                  continue;
                }
              }

              try {
                // Busca recursiva no diretório chrome
                const chromeDir = path.join(cacheDir, "chrome");
                if (fs.existsSync(chromeDir)) {
                  console.log(
                    `   📁 Diretório chrome encontrado: ${chromeDir}`
                  );
                  const foundChrome = findChromeRecursive(chromeDir);
                  if (foundChrome) {
                    executablePath = foundChrome;
                    console.log(`✅ Chrome encontrado em: ${executablePath}`);
                    break;
                  }
                }

                // Também procurar diretamente no cacheDir (caso o Chrome esteja em outro lugar)
                const foundChrome = findChromeRecursive(cacheDir);
                if (foundChrome) {
                  executablePath = foundChrome;
                  console.log(`✅ Chrome encontrado em: ${executablePath}`);
                  break;
                }
              } catch (e: any) {
                console.log(
                  `   ⚠️  Erro ao procurar em ${cacheDir}: ${e.message}`
                );
                // Continuar procurando
              }
            }

            // Fallback: tentar usar Chrome do sistema (se disponível)
            if (!executablePath) {
              console.log("🔍 Procurando Chrome do sistema...");
              const systemChromePaths = [
                "/usr/bin/google-chrome",
                "/usr/bin/chromium",
                "/usr/bin/chromium-browser",
                "/usr/local/bin/chrome",
              ];

              for (const chromePath of systemChromePaths) {
                if (fs.existsSync(chromePath)) {
                  executablePath = chromePath;
                  console.log(
                    `✅ Chrome do sistema encontrado em: ${executablePath}`
                  );
                  break;
                }
              }
            }
          } catch (e: any) {
            // Se não conseguir encontrar, deixar o Puppeteer tentar automaticamente
            console.log(
              "⚠️  Não foi possível detectar o caminho do Chrome automaticamente"
            );
            console.log(`   Erro: ${e.message}`);
            console.log(`   Cache dirs verificados: ${cacheDirs.join(", ")}`);
          }
        }

        // Se ainda não encontrou, tentar usar a API do Puppeteer
        if (!executablePath) {
          try {
            // Configurar cache directory antes de chamar executablePath
            const cacheDir =
              process.env.PUPPETEER_CACHE_DIR || "/opt/render/.cache/puppeteer";
            if (!process.env.PUPPETEER_CACHE_DIR) {
              process.env.PUPPETEER_CACHE_DIR = cacheDir;
            }

            // Garantir que o diretório existe
            if (!fs.existsSync(cacheDir)) {
              fs.mkdirSync(cacheDir, { recursive: true });
              console.log(`📁 Diretório de cache criado: ${cacheDir}`);
            }

            const puppeteerPath = puppeteer.executablePath();
            if (puppeteerPath && fs.existsSync(puppeteerPath)) {
              executablePath = puppeteerPath;
              console.log(
                `✅ Chrome encontrado via Puppeteer API: ${executablePath}`
              );
            } else {
              console.log(
                `⚠️  Puppeteer.executablePath() retornou: ${puppeteerPath}, mas arquivo não existe`
              );
              console.log(`   Tentando instalar Chrome programaticamente...`);

              // Tentar instalar Chrome programaticamente
              try {
                const { execSync } = require("child_process");
                console.log(
                  `   Executando: PUPPETEER_CACHE_DIR=${cacheDir} npx puppeteer browsers install chrome`
                );
                execSync(
                  `PUPPETEER_CACHE_DIR=${cacheDir} npx puppeteer browsers install chrome`,
                  {
                    stdio: "inherit",
                    env: { ...process.env, PUPPETEER_CACHE_DIR: cacheDir },
                  }
                );

                // Tentar novamente após instalação
                const newPuppeteerPath = puppeteer.executablePath();
                if (newPuppeteerPath && fs.existsSync(newPuppeteerPath)) {
                  executablePath = newPuppeteerPath;
                  console.log(
                    `✅ Chrome instalado e encontrado: ${executablePath}`
                  );
                }
              } catch (installError: any) {
                console.log(
                  `   ⚠️  Erro ao instalar Chrome: ${installError.message}`
                );
              }
            }
          } catch (e: any) {
            console.log(`⚠️  Puppeteer.executablePath() falhou: ${e.message}`);
          }
        }

        // Configurar cache directory para Puppeteer se ainda não estiver configurado
        if (!process.env.PUPPETEER_CACHE_DIR) {
          process.env.PUPPETEER_CACHE_DIR = "/opt/render/.cache/puppeteer";
        }

        if (executablePath) {
          console.log(`🔧 Usando Chrome em: ${executablePath}`);
        } else {
          console.log(
            "🔧 Tentando usar Chrome padrão do Puppeteer (sem executablePath)..."
          );
          console.log(
            `   PUPPETEER_CACHE_DIR: ${process.env.PUPPETEER_CACHE_DIR}`
          );
        }

        const launchOptions: any = {
          headless: this.headless,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu",
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
            "--disable-extensions",
            "--disable-background-networking",
            "--disable-default-apps",
            "--disable-sync",
            "--disable-translate",
            "--hide-scrollbars",
            "--metrics-recording-only",
            "--mute-audio",
            "--no-first-run",
            "--safebrowsing-disable-auto-update",
            "--disable-blink-features=AutomationControlled",
          ],
          defaultViewport: {
            width: 1280,
            height: 720,
          },
          timeout: 60000, // 60 segundos para inicialização
          protocolTimeout: 60000,
        };

        // Adicionar executablePath apenas se definido
        if (executablePath) {
          launchOptions.executablePath = executablePath;
        }

        this.browser = await puppeteer.launch(launchOptions);

        // Handler para desconexão inesperada
        this.browser.on("disconnected", () => {
          console.log("⚠️  Navegador desconectado. Reinicializando...");
          this.browser = null;
        });

        console.log("✅ Navegador Puppeteer inicializado com sucesso");
      } catch (error: any) {
        console.error("❌ Erro ao inicializar Puppeteer:", error.message);
        console.error("   Stack:", error.stack);

        // Mensagens de diagnóstico detalhadas
        const errorMsg = error.message || "";
        let detailedError = "Erro ao inicializar o navegador Chrome. ";

        if (
          errorMsg.includes("Target closed") ||
          errorMsg.includes("Protocol error")
        ) {
          detailedError +=
            "O navegador foi fechado inesperadamente durante a inicialização. " +
            "Isso pode ocorrer por falta de memória ou recursos do sistema.";
        } else if (
          errorMsg.includes("Failed to launch") ||
          errorMsg.includes("Could not find")
        ) {
          detailedError += "Chrome/Chromium não foi encontrado no sistema.";
        } else {
          detailedError += errorMsg;
        }

        console.error(`\n⚠️  DIAGNÓSTICO:`);
        console.error(`   ${detailedError}`);
        console.error(`\n💡 SOLUÇÕES:`);
        console.error(`   1. Em ambiente Windows: Instale o Google Chrome`);
        console.error(`   2. Em ambiente Linux/Docker: Instale chromium`);
        console.error(`      apt-get install -y chromium-browser`);
        console.error(`   3. No Render.com: Adicione buildpack do Chrome`);
        console.error(
          `      https://github.com/heroku/heroku-buildpack-google-chrome`
        );
        console.error(`   4. Defina PUPPETEER_EXECUTABLE_PATH no .env`);
        console.error(`   5. Aumente a memória disponível para o processo\n`);

        throw new Error(
          `Não foi possível inicializar o navegador para acessar o e-SAJ. ${detailedError}`
        );
      }
    }
    return this.browser;
  }

  /**
   * Fecha uma página específica com tratamento de erro
   */
  async closePage(page: Page | null): Promise<void> {
    if (page && !page.isClosed()) {
      try {
        await page.close();
      } catch (error: any) {
        console.warn(`⚠️  Erro ao fechar página: ${error.message}`);
      }
    }
  }

  /**
   * Fecha o navegador
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        const pages = await this.browser.pages();
        console.log(`🔍 Fechando ${pages.length} página(s) abertas...`);

        // Fechar todas as páginas antes de fechar o navegador
        await Promise.all(
          pages.map(async (page) => {
            try {
              if (!page.isClosed()) {
                await page.close();
              }
            } catch (error) {
              // Ignorar erros ao fechar páginas individuais
            }
          })
        );

        await this.browser.close();
        this.browser = null;
      } catch (error: any) {
        console.warn(`⚠️  Erro ao fechar navegador: ${error.message}`);
        this.browser = null;
      }
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

  /**
   * Define o callback de progresso
   */
  setProgressCallback(callback: ProgressCallback | undefined): void {
    this.progressCallback = callback;
  }

  /**
   * Emite uma atualização de progresso
   */
  protected async emitProgress(update: ProgressUpdate): Promise<void> {
    if (this.progressCallback) {
      try {
        await this.progressCallback(update);
      } catch (error) {
        // Não quebrar o fluxo se o callback falhar
        console.warn("⚠️  Erro ao emitir progresso:", error);
      }
    }
  }

  /**
   * Aguarda com timeout otimizado (reduzido de 2s para 1s quando possível)
   */
  protected async wait(ms: number = 1000): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
