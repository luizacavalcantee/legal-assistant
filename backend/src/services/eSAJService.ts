import puppeteer, { Browser, Page } from "puppeteer";
import * as fs from "fs";
import * as path from "path";

export interface ProcessSearchResult {
  found: boolean;
  protocolNumber: string;
  processPageUrl?: string; // URL da página de detalhes do processo (se encontrado)
  error?: string;
}

export interface DocumentDownloadResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  pdfUrl?: string; // URL direta do PDF extraída do iframe
  protocolNumber: string;
  documentType?: string;
  error?: string;
}

/**
 * Serviço para interagir com o portal e-SAJ (consulta pública)
 */
export class eSAJService {
  private browser: Browser | null = null;
  private readonly eSAJUrl: string;
  private readonly headless: boolean;
  private readonly downloadsDir: string;

  constructor() {
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
   * Configura uma página para downloads programáticos
   */
  private async setupPageForDownloads(page: Page): Promise<void> {
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
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Ação 1: Trocar o tipo de consulta para "Outros" PRIMEIRO
      console.log(`🔄 Selecionando radio button "Outros"...`);
      try {
        const outrosRadio = await page.$('input[id="radioNumeroAntigo"]');
        if (outrosRadio) {
          await outrosRadio.click();
          await new Promise((resolve) => setTimeout(resolve, 1000));
          console.log(`✅ Radio button "Outros" selecionado`);
        } else {
          return {
            found: false,
            protocolNumber: cleanProtocol,
            error:
              "Radio button 'Outros' não encontrado. A estrutura do portal pode ter mudado.",
          };
        }
      } catch (radioError: any) {
        return {
          found: false,
          protocolNumber: cleanProtocol,
          error: `Erro ao selecionar radio button "Outros": ${radioError.message}`,
        };
      }

      // Ação 2: Preencher o número do protocolo no campo que aparece após selecionar "Outros"
      console.log(`📋 Preenchendo número do protocolo: ${cleanProtocol}`);
      try {
        const protocolInput = await page.$(
          'input[id="nuProcessoAntigoFormatado"]'
        );
        if (!protocolInput) {
          return {
            found: false,
            protocolNumber: cleanProtocol,
            error:
              "Campo de protocolo não encontrado após selecionar 'Outros'.",
          };
        }

        // Limpar campo e preencher (colar o número completo)
        await protocolInput.click({ clickCount: 3 });
        await protocolInput.type(cleanProtocol, { delay: 50 });
        await new Promise((resolve) => setTimeout(resolve, 500));
        console.log(`✅ Número do protocolo preenchido`);
      } catch (inputError: any) {
        return {
          found: false,
          protocolNumber: cleanProtocol,
          error: `Erro ao preencher número do protocolo: ${inputError.message}`,
        };
      }

      // Ação 3: Submeter o formulário
      console.log(`🔘 Clicando no botão de consulta...`);
      try {
        const consultButton = await page.$(
          'input[id="botaoConsultarProcessos"]'
        );
        if (!consultButton) {
          return {
            found: false,
            protocolNumber: cleanProtocol,
            error: "Botão de consulta não encontrado.",
          };
        }

        // Aguardar navegação após clicar
        const navigationPromise = page.waitForNavigation({
          waitUntil: "networkidle2",
          timeout: 15000,
        });

        await consultButton.click();
        await navigationPromise;
        await new Promise((resolve) => setTimeout(resolve, 2000));
        console.log(`✅ Formulário submetido e página de detalhes carregada`);
      } catch (buttonError: any) {
        return {
          found: false,
          protocolNumber: cleanProtocol,
          error: `Erro ao submeter formulário: ${buttonError.message}`,
        };
      }

      // Aguardar o carregamento da página de resultados
      await new Promise((resolve) => setTimeout(resolve, 3000));
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
        // Capturar a URL da página de detalhes do processo
        const processPageUrl = page.url();
        return {
          found: true,
          protocolNumber: cleanProtocol,
          processPageUrl: processPageUrl,
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
   * Baixa um documento específico de um processo no e-SAJ
   * @param protocolNumber - Número do protocolo do processo
   * @param documentType - Tipo de documento solicitado (ex: "petição inicial", "sentença")
   * @param processPageUrl - URL opcional da página de detalhes do processo (para evitar buscar novamente)
   * @returns Resultado do download com caminho do arquivo
   */
  async downloadDocument(
    protocolNumber: string,
    documentType: string,
    processPageUrl?: string
  ): Promise<DocumentDownloadResult> {
    let page: Page | null = null;

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

      // Inicializar navegador e configurar para downloads
      const browser = await this.initBrowser();
      page = await browser.newPage();
      await this.setupPageForDownloads(page);

      // Configurar timeout
      page.setDefaultTimeout(30000);

      // ETAPA 1: Navegação e Busca Específica
      // Se já temos a URL da página de detalhes, navegar diretamente para ela
      if (processPageUrl) {
        console.log(
          `📄 Navegando diretamente para a página de detalhes do processo: ${processPageUrl}`
        );
        await page.goto(processPageUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
        console.log(`✅ Já na página de detalhes do processo`);
      } else {
        // Se não temos a URL, fazer a busca completa
        console.log(`📄 Navegando para ${this.eSAJUrl}...`);
        await page.goto(this.eSAJUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });

        // Aguardar carregamento da página
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Ação 1: Trocar o tipo de consulta para "Outros"
        console.log(`🔄 Selecionando radio button "Outros"...`);
        try {
          const outrosRadio = await page.$('input[id="radioNumeroAntigo"]');
          if (outrosRadio) {
            await outrosRadio.click();
            await new Promise((resolve) => setTimeout(resolve, 1000));
            console.log(`✅ Radio button "Outros" selecionado`);
          } else {
            return {
              success: false,
              protocolNumber: cleanProtocol,
              documentType: documentType,
              error:
                "Radio button 'Outros' não encontrado. A estrutura do portal pode ter mudado.",
            };
          }
        } catch (radioError: any) {
          return {
            success: false,
            protocolNumber: cleanProtocol,
            documentType: documentType,
            error: `Erro ao selecionar radio button "Outros": ${radioError.message}`,
          };
        }

        // Ação 2: Preencher o número do protocolo
        console.log(`📋 Preenchendo número do protocolo: ${cleanProtocol}`);
        try {
          const protocolInput = await page.$(
            'input[id="nuProcessoAntigoFormatado"]'
          );
          if (!protocolInput) {
            return {
              success: false,
              protocolNumber: cleanProtocol,
              documentType: documentType,
              error:
                "Campo de protocolo não encontrado após selecionar 'Outros'.",
            };
          }

          // Limpar campo e preencher
          await protocolInput.click({ clickCount: 3 });
          await protocolInput.type(cleanProtocol, { delay: 50 });
          await new Promise((resolve) => setTimeout(resolve, 500));
          console.log(`✅ Número do protocolo preenchido`);
        } catch (inputError: any) {
          return {
            success: false,
            protocolNumber: cleanProtocol,
            documentType: documentType,
            error: `Erro ao preencher número do protocolo: ${inputError.message}`,
          };
        }

        // Ação 3: Submeter o formulário
        console.log(`🔘 Clicando no botão de consulta...`);
        try {
          const consultButton = await page.$(
            'input[id="botaoConsultarProcessos"]'
          );
          if (!consultButton) {
            return {
              success: false,
              protocolNumber: cleanProtocol,
              documentType: documentType,
              error: "Botão de consulta não encontrado.",
            };
          }

          // Aguardar navegação após clicar
          const navigationPromise = page.waitForNavigation({
            waitUntil: "networkidle2",
            timeout: 15000,
          });

          await consultButton.click();
          await navigationPromise;
          await new Promise((resolve) => setTimeout(resolve, 2000));
          console.log(`✅ Formulário submetido e página de detalhes carregada`);
        } catch (buttonError: any) {
          return {
            success: false,
            protocolNumber: cleanProtocol,
            documentType: documentType,
            error: `Erro ao submeter formulário: ${buttonError.message}`,
          };
        }
      }

      // ETAPA 3: Seleção e Verificação do Documento
      console.log(
        `🔍 Buscando documento "${documentType}" na tabela de movimentações...`
      );

      // Expandir seção de movimentações se necessário
      try {
        const maisButton = await page.$("#linkmovimentacoes");
        if (maisButton) {
          const todasMovimentacoes = await page.$("#tabelaTodasMovimentacoes");
          const isExpanded = todasMovimentacoes
            ? await page.evaluate((el) => {
                // @ts-ignore
                const style = window.getComputedStyle(el);
                return style.display !== "none";
              }, todasMovimentacoes)
            : false;

          if (!isExpanded) {
            console.log(`🔘 Expandindo seção de movimentações...`);
            await maisButton.click();
            await new Promise((resolve) => setTimeout(resolve, 2000));
            console.log(`✅ Seção de movimentações expandida`);
          }
        }
      } catch (expandError: any) {
        console.log(
          `⚠️  Erro ao expandir movimentações: ${expandError.message}. Continuando...`
        );
      }

      // Buscar na tabela de movimentações
      const movimentacoes = await page.evaluate((docType) => {
        // @ts-ignore
        const todasMovimentacoes = document.querySelector(
          "#tabelaTodasMovimentacoes"
        );
        // @ts-ignore
        const ultimasMovimentacoes = document.querySelector(
          "#tabelaUltimasMovimentacoes"
        );

        // Usar a tabela expandida se disponível, senão usar a de últimas
        // @ts-ignore
        const tbody =
          todasMovimentacoes &&
          window.getComputedStyle(todasMovimentacoes).display !== "none"
            ? todasMovimentacoes
            : ultimasMovimentacoes;

        if (!tbody) return [];

        // @ts-ignore
        const rows = Array.from(
          tbody.querySelectorAll("tr.containerMovimentacao")
        );
        const results: Array<{
          movimentoText: string;
          linkHref: string;
          linkId: string;
          hasDocument: boolean;
          requiresPassword: boolean;
        }> = [];

        const searchTerms = docType.toLowerCase().split(/\s+/);

        for (const row of rows) {
          // @ts-ignore
          const descricaoCell = row.querySelector("td.descricaoMovimentacao");
          if (!descricaoCell) continue;

          const movimentoText = (descricaoCell.textContent || "").trim();
          const movimentoTextLower = movimentoText.toLowerCase();

          // Verificar se o texto contém os termos do documentType
          const matches = searchTerms.some((term) =>
            movimentoTextLower.includes(term)
          );

          if (matches) {
            // Buscar link de documento na linha
            let documentLink: any = null;

            // Estratégia 1: Buscar pelo ícone de documento
            // @ts-ignore
            const docImage = row.querySelector(
              'img[src*="doc.png"], img[src*="documento"], img[alt*="documento"]'
            );
            if (docImage) {
              // @ts-ignore
              const parentCell = docImage.closest("td");
              if (parentCell) {
                // @ts-ignore
                documentLink = parentCell.querySelector("a");
              }
            }

            // Estratégia 2: Buscar links com classe específica de documento
            if (!documentLink) {
              // @ts-ignore
              const docLinks = row.querySelectorAll(
                "a.linkMovVincProc, a[href*='abrirDocumento'], a[href*='liberarAutoPorSenha']"
              );
              if (docLinks.length > 0) {
                documentLink = docLinks[0];
              }
            }

            // Estratégia 3: Buscar qualquer link na linha que seja de documento
            if (!documentLink) {
              // @ts-ignore
              const links = row.querySelectorAll("a");
              for (const link of links) {
                const href = link.getAttribute("href") || "";
                const onclick = link.getAttribute("onclick") || "";
                if (
                  href.includes("abrirDocumento") ||
                  href.includes("liberarAutoPorSenha") ||
                  onclick.includes("abrirDocumento") ||
                  onclick.includes("cdDocumento")
                ) {
                  documentLink = link;
                  break;
                }
              }
            }

            if (documentLink) {
              const href = documentLink.getAttribute("href") || "";
              const requiresPassword = href.includes("#liberarAutoPorSenha");

              results.push({
                movimentoText,
                linkHref: href,
                linkId: documentLink.id || "",
                hasDocument: true,
                requiresPassword,
              });
            }
          }
        }

        return results;
      }, documentType);

      console.log(
        `📋 Encontradas ${movimentacoes.length} movimentação(ões) correspondente(s) ao tipo "${documentType}"`
      );

      if (movimentacoes.length === 0) {
        return {
          success: false,
          protocolNumber: cleanProtocol,
          documentType: documentType,
          error:
            "Documento solicitado não foi encontrado na movimentação do processo.",
        };
      }

      // ETAPA 4: Regra de Download (Checagem de Senha)
      // Priorizar documentos sem senha
      const documentosSemSenha = movimentacoes.filter(
        (mov) => !mov.requiresPassword
      );
      const documentosComSenha = movimentacoes.filter(
        (mov) => mov.requiresPassword
      );

      console.log(
        `📊 Análise: ${documentosSemSenha.length} documento(s) sem senha, ${documentosComSenha.length} documento(s) requerem senha`
      );

      if (documentosSemSenha.length === 0) {
        return {
          success: false,
          protocolNumber: cleanProtocol,
          documentType: documentType,
          error:
            "O documento solicitado está disponível, mas requer credenciais de acesso (senha/login) e não pode ser baixado publicamente.",
        };
      }

      // Tentar baixar o primeiro documento sem senha
      const targetDocument = documentosSemSenha[0];
      console.log(
        `📄 Tentando baixar: ${targetDocument.movimentoText.substring(0, 100)}`
      );

      // Encontrar e clicar no link do documento
      let documentLinkElement = null;

      if (targetDocument.linkId) {
        documentLinkElement = await page.$(`#${targetDocument.linkId}`);
      }

      if (!documentLinkElement && targetDocument.linkHref) {
        // Buscar link por href
        const links = await page.$$(`a[href*="${targetDocument.linkHref}"]`);
        if (links.length > 0) {
          documentLinkElement = links[0];
        }
      }

      if (!documentLinkElement) {
        // Buscar por texto do movimento
        const movimentoTextShort = targetDocument.movimentoText.substring(
          0,
          50
        );
        documentLinkElement = await page.evaluateHandle((text) => {
          // @ts-ignore
          const rows = Array.from(
            document.querySelectorAll("tr.containerMovimentacao")
          );
          for (const row of rows) {
            // @ts-ignore
            const descricaoCell = row.querySelector("td.descricaoMovimentacao");
            if (descricaoCell && descricaoCell.textContent?.includes(text)) {
              // @ts-ignore
              const link = row.querySelector("a");
              if (link) return link;
            }
          }
          return null;
        }, movimentoTextShort);

        if (documentLinkElement && documentLinkElement.asElement()) {
          documentLinkElement = documentLinkElement.asElement();
        } else {
          documentLinkElement = null;
        }
      }

      if (!documentLinkElement) {
        return {
          success: false,
          protocolNumber: cleanProtocol,
          documentType: documentType,
          error: "Link do documento não encontrado na página.",
        };
      }

      // Extrair a URL do link ANTES de clicar
      console.log(`🔍 Extraindo URL do link do documento...`);
      let pdfUrl: string | null = null;

      try {
        // Obter o href do link
        const linkHref = await page.evaluate((element) => {
          // @ts-ignore
          return element.getAttribute("href") || "";
        }, documentLinkElement);

        if (!linkHref) {
          return {
            success: false,
            protocolNumber: cleanProtocol,
            documentType: documentType,
            error: "Link do documento não possui href.",
          };
        }

        console.log(`📋 href do link: ${linkHref}`);

        // Construir URL completa do link
        const baseUrl = new URL(page.url()).origin; // Ex: https://esaj.tjsp.jus.br
        let fullLinkUrl = linkHref.startsWith("http")
          ? linkHref
          : linkHref.startsWith("/")
          ? `${baseUrl}${linkHref}`
          : `${baseUrl}/${linkHref}`;

        console.log(`📄 URL completa do link: ${fullLinkUrl}`);

        // Verificar se o link é direto para PDF ou se abre uma página com iframe
        if (
          fullLinkUrl.includes("getPDF.do") ||
          fullLinkUrl.includes(".pdf") ||
          fullLinkUrl.includes("abrirDocumento")
        ) {
          // Se o link contém getPDF.do, é um link direto para PDF
          if (fullLinkUrl.includes("getPDF.do")) {
            pdfUrl = fullLinkUrl;
            console.log(`✅ Link direto para PDF encontrado: ${pdfUrl}`);
          } else if (fullLinkUrl.includes("abrirDocumento")) {
            // Se é abrirDocumento, tentar construir URL do PDF diretamente a partir dos parâmetros
            console.log(
              `📄 Link abre página com iframe, tentando construir URL do PDF a partir dos parâmetros...`
            );

            const linkUrl = new URL(fullLinkUrl);
            const cdDocumento = linkUrl.searchParams.get("cdDocumento");
            const processoCodigo = linkUrl.searchParams.get("processo.codigo");

            if (cdDocumento) {
              // Construir URL do PDF diretamente a partir dos parâmetros
              const pdfUrlFromParams = `${baseUrl}/pastadigital/getPDF.do?cdDocumento=${cdDocumento}${
                processoCodigo ? `&processo.codigo=${processoCodigo}` : ""
              }`;
              console.log(
                `✅ URL do PDF construída a partir dos parâmetros: ${pdfUrlFromParams}`
              );
              pdfUrl = pdfUrlFromParams;
            } else {
              // Se não tem cdDocumento, tentar navegar e extrair do iframe
              console.log(
                `⚠️  Parâmetro cdDocumento não encontrado, tentando navegar e extrair do iframe...`
              );

              try {
                // Aguardar navegação para a página do documento (com timeout maior)
                const navigationPromise = page.waitForNavigation({
                  waitUntil: "domcontentloaded", // Mais rápido que networkidle2
                  timeout: 30000, // Aumentar timeout para 30 segundos
                });

                await documentLinkElement.click();

                // Aguardar navegação ou timeout
                try {
                  await navigationPromise;
                } catch (navError: any) {
                  // Se timeout, continuar mesmo assim - a página pode ter carregado parcialmente
                  console.log(
                    `⚠️  Timeout na navegação, continuando mesmo assim: ${navError.message}`
                  );
                }

                await new Promise((resolve) => setTimeout(resolve, 5000)); // Aguardar mais tempo para iframe carregar

                // Localizar o iframe que contém o visualizador de PDF
                // Tentar múltiplos seletores e aguardar o iframe aparecer
                let iframe = null;
                const iframeSelectors = [
                  "iframe#documento",
                  'iframe[src*="viewer"]',
                  'iframe[src*="getPDF"]',
                  "iframe",
                ];

                for (const selector of iframeSelectors) {
                  try {
                    iframe = await page.waitForSelector(selector, {
                      timeout: 10000,
                    });
                    if (iframe) {
                      console.log(
                        `✅ Iframe encontrado com seletor: ${selector}`
                      );
                      break;
                    }
                  } catch (e) {
                    // Tentar próximo seletor
                    continue;
                  }
                }

                if (!iframe) {
                  return {
                    success: false,
                    protocolNumber: cleanProtocol,
                    documentType: documentType,
                    error: "Iframe do documento não encontrado na página.",
                  };
                }

                // Se ainda não temos a URL do PDF, extrair do iframe
                if (!pdfUrl && iframe) {
                  // Obter o atributo src do iframe
                  const iframeSrc = await page.evaluate((iframeEl) => {
                    // @ts-ignore
                    return iframeEl.getAttribute("src");
                  }, iframe);

                  if (!iframeSrc) {
                    return {
                      success: false,
                      protocolNumber: cleanProtocol,
                      documentType: documentType,
                      error: "Atributo src do iframe não encontrado.",
                    };
                  }

                  console.log(`📋 URL do iframe: ${iframeSrc}`);

                  // Recuperação da URL do PDF (parâmetro file)
                  try {
                    const urlObj = new URL(iframeSrc, page.url());
                    const fileParam = urlObj.searchParams.get("file");

                    if (fileParam) {
                      // Decodificar a URL (URI decode)
                      const decodedFileUrl = decodeURIComponent(fileParam);
                      console.log(
                        `📄 URL decodificada do PDF: ${decodedFileUrl}`
                      );

                      // Reconstruir a URL completa do PDF
                      pdfUrl = decodedFileUrl.startsWith("http")
                        ? decodedFileUrl
                        : `${baseUrl}${decodedFileUrl}`;

                      console.log(
                        `✅ URL completa do PDF extraída do iframe: ${pdfUrl}`
                      );
                    } else {
                      // Se não tem parâmetro file, tentar usar a URL do iframe diretamente
                      console.log(
                        `⚠️  Parâmetro 'file' não encontrado, tentando usar URL do iframe diretamente`
                      );
                      pdfUrl = iframeSrc.startsWith("http")
                        ? iframeSrc
                        : `${baseUrl}${iframeSrc}`;
                    }
                  } catch (urlError: any) {
                    console.log(
                      `⚠️  Erro ao processar URL do iframe: ${urlError.message}`
                    );
                    // Tentar usar a URL do iframe diretamente
                    pdfUrl = iframeSrc.startsWith("http")
                      ? iframeSrc
                      : `${baseUrl}${iframeSrc}`;
                  }
                }
              } catch (iframeError: any) {
                // Se der erro ao processar iframe, retornar erro
                return {
                  success: false,
                  protocolNumber: cleanProtocol,
                  documentType: documentType,
                  error: `Erro ao processar iframe: ${iframeError.message}`,
                };
              }
            }
          } else {
            // Link direto para PDF (dentro do if abrirDocumento, mas não é getPDF.do)
            pdfUrl = fullLinkUrl;
            console.log(`✅ Link direto para PDF: ${pdfUrl}`);
          }
        } else {
          // Link não reconhecido, tentar usar como está
          pdfUrl = fullLinkUrl;
          console.log(`⚠️  Link não reconhecido, usando como está: ${pdfUrl}`);
        }
      } catch (extractError: any) {
        return {
          success: false,
          protocolNumber: cleanProtocol,
          documentType: documentType,
          error: `Erro ao extrair URL do link: ${extractError.message}`,
        };
      }

      // Retornar a URL do PDF para o usuário acessar diretamente
      if (!pdfUrl) {
        return {
          success: false,
          protocolNumber: cleanProtocol,
          documentType: documentType,
          error: "URL do PDF não pôde ser extraída.",
        };
      }

      console.log(`✅ URL do PDF extraída com sucesso: ${pdfUrl}`);

      // Retornar sucesso com a URL do PDF
      return {
        success: true,
        pdfUrl: pdfUrl,
        protocolNumber: cleanProtocol,
        documentType: documentType,
      };
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
