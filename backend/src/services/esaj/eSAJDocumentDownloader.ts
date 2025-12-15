import { Page } from "puppeteer";
import * as fs from "fs";
import * as path from "path";
import { eSAJBase } from "./eSAJBase";
import { DocumentCandidate } from "./eSAJDocumentFinder";

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
 * Responsável por baixar documentos do e-SAJ
 * Extrai a URL do PDF a partir do link ou iframe
 */
export class eSAJDocumentDownloader extends eSAJBase {
  constructor(base?: eSAJBase) {
    super(base);
  }

  /**
   * Extrai a URL do PDF de um documento específico
   * @param page - Página do Puppeteer já na página de detalhes do processo
   * @param documentCandidate - Documento escolhido para download
   * @param protocolNumber - Número do protocolo do processo
   * @param documentType - Tipo de documento
   * @returns URL do PDF extraída
   */
  async extractPDFUrl(
    page: Page,
    documentCandidate: DocumentCandidate,
    protocolNumber: string,
    documentType: string
  ): Promise<string | null> {
    try {
      console.log(
        `📄 Tentando extrair URL do documento: ${documentCandidate.movimentoText.substring(
          0,
          100
        )}`
      );

      // Encontrar e clicar no link do documento
      let documentLinkElement = null;

      if (documentCandidate.linkId) {
        documentLinkElement = await page.$(`#${documentCandidate.linkId}`);
      }

      if (!documentLinkElement && documentCandidate.linkHref) {
        // Buscar link por href
        const links = await page.$$(`a[href*="${documentCandidate.linkHref}"]`);
        if (links.length > 0) {
          documentLinkElement = links[0];
        }
      }

      if (!documentLinkElement) {
        // Buscar por texto do movimento
        const movimentoTextShort = documentCandidate.movimentoText.substring(
          0,
          50
        );
        documentLinkElement = await page.evaluateHandle((text) => {
          // @ts-ignore - document está disponível no contexto do navegador via page.evaluateHandle()
          const rows = Array.from(
            // @ts-ignore
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
        throw new Error("Link do documento não encontrado na página.");
      }

      // Extrair a URL do link ANTES de clicar
      console.log(`🔍 Extraindo URL do link do documento...`);
      let pdfUrl: string | null = null;

      // Obter o href do link
      const linkHref = await page.evaluate((element) => {
        // @ts-ignore
        return element.getAttribute("href") || "";
      }, documentLinkElement);

      if (!linkHref) {
        throw new Error("Link do documento não possui href.");
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
                throw new Error(
                  "Iframe do documento não encontrado na página."
                );
              }

              // Se ainda não temos a URL do PDF, extrair do iframe
              if (!pdfUrl && iframe) {
                // Obter o atributo src do iframe
                const iframeSrc = await page.evaluate((iframeEl) => {
                  // @ts-ignore
                  return iframeEl.getAttribute("src");
                }, iframe);

                if (!iframeSrc) {
                  throw new Error("Atributo src do iframe não encontrado.");
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
              throw new Error(
                `Erro ao processar iframe: ${iframeError.message}`
              );
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

      return pdfUrl;
    } catch (error: any) {
      console.error(`❌ Erro ao extrair URL do PDF:`, error);
      throw error;
    }
  }

  /**
   * Navega para a página da pasta digital do documento e expande a sidebar
   * @param page - Página do Puppeteer já na página de detalhes do processo
   * @param documentCandidate - Documento escolhido para download
   * @returns true se a navegação e expansão foram bem-sucedidas
   */
  async navigateToDocumentPage(
    page: Page,
    documentCandidate: DocumentCandidate
  ): Promise<boolean> {
    try {
      console.log(
        `📄 Navegando para a página da pasta digital do documento...`
      );

      // Encontrar e clicar no link do documento
      let documentLinkElement = null;

      if (documentCandidate.linkId) {
        documentLinkElement = await page.$(`#${documentCandidate.linkId}`);
      }

      if (!documentLinkElement && documentCandidate.linkHref) {
        // Buscar link por href
        const links = await page.$$(`a[href*="${documentCandidate.linkHref}"]`);
        if (links.length > 0) {
          documentLinkElement = links[0];
        }
      }

      if (!documentLinkElement) {
        // Buscar por texto do movimento
        const movimentoTextShort = documentCandidate.movimentoText.substring(
          0,
          50
        );
        documentLinkElement = await page.evaluateHandle((text) => {
          // @ts-ignore - document está disponível no contexto do navegador via page.evaluateHandle()
          const rows = Array.from(
            // @ts-ignore
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
        throw new Error("Link do documento não encontrado na página.");
      }

      // Verificar se o elemento está visível e clicável
      const isVisible = await page.evaluate((element) => {
        // @ts-ignore
        if (!element) return false;
        // @ts-ignore
        const style = window.getComputedStyle(element);
        // @ts-ignore
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          !element.disabled
        );
      }, documentLinkElement);

      console.log(`🔍 Link está visível e clicável: ${isVisible}`);

      if (!isVisible) {
        console.log(`⚠️  Link não está visível, tentando scroll até ele...`);
        await page.evaluate((element) => {
          // @ts-ignore
          if (element) {
            // @ts-ignore
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, documentLinkElement);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Clicar no link do documento para abrir na pasta digital
      console.log(`🔘 Clicando no link do documento...`);

      // Obter URL antes do clique para verificar mudança
      const urlBeforeClick = page.url();
      console.log(`🔍 URL antes do clique: ${urlBeforeClick}`);

      // Obter informações do link (href, onclick, etc.)
      const linkInfo = await page.evaluate((element) => {
        // @ts-ignore
        return {
          href: element.getAttribute("href") || "",
          onclick: element.getAttribute("onclick") || "",
          id: element.getAttribute("id") || "",
          className: element.getAttribute("class") || "",
        };
      }, documentLinkElement);

      console.log(`🔍 Informações do link:`, JSON.stringify(linkInfo, null, 2));

      // Estratégia: Se o link tem href, navegar diretamente pela URL (mais confiável)
      // Se não tem href mas tem onclick, tentar executar o onclick
      if (linkInfo.href) {
        console.log(`🔍 Link tem href. Navegando diretamente pela URL...`);
        try {
          const baseUrl = new URL(page.url()).origin;
          const fullUrl = linkInfo.href.startsWith("http")
            ? linkInfo.href
            : linkInfo.href.startsWith("/")
            ? `${baseUrl}${linkInfo.href}`
            : `${baseUrl}/${linkInfo.href}`;

          console.log(`📄 Navegando para: ${fullUrl}`);

          // Aguardar navegação usando Promise.race para múltiplas condições
          const navigationPromise = Promise.race([
            page.waitForNavigation({
              waitUntil: ["domcontentloaded", "networkidle0"],
              timeout: 30000,
            }),
            page.waitForFunction(
              (oldUrl) => {
                // @ts-ignore
                return window.location.href !== oldUrl;
              },
              { timeout: 30000 },
              urlBeforeClick
            ),
          ]);

          await page.goto(fullUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });

          try {
            await navigationPromise;
            console.log(`✅ Navegação detectada`);
          } catch (navError: any) {
            // Continuar mesmo se a navegação não for detectada
            console.log(`⚠️  Navegação não detectada, mas continuando...`);
          }

          console.log(`✅ Navegação direta concluída`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } catch (navError: any) {
          console.log(`⚠️  Erro na navegação direta: ${navError.message}`);
          // Se falhar, tentar clique normal
          console.log(`🔍 Tentando clique normal como fallback...`);
          try {
            await documentLinkElement.click();
          } catch (clickError: any) {
            console.log(`⚠️  Erro no clique normal: ${clickError.message}`);
          }
        }
      } else if (linkInfo.onclick && linkInfo.onclick.trim().length > 0) {
        console.log(
          `🔍 Link tem onclick mas não tem href. Tentando executar onclick...`
        );

        // Tentar executar o onclick com evento real
        try {
          const onclickExecuted = await page.evaluate(
            (linkId, linkHref, onclickCode) => {
              // @ts-ignore - document está disponível no contexto do navegador
              let element = null;

              if (linkId) {
                // @ts-ignore
                element =
                  // @ts-ignore
                  document.getElementById(linkId) ||
                  // @ts-ignore
                  document.querySelector(`[id="${linkId}"]`);
              }

              if (!element && linkHref) {
                // @ts-ignore
                const links = document.querySelectorAll("a"); // @ts-ignore
                for (let i = 0; i < links.length; i++) {
                  // @ts-ignore
                  if (links[i].getAttribute("href") === linkHref) {
                    element = links[i];
                    break;
                  }
                }
              }

              if (element && onclickCode) {
                try {
                  // Limpar o código onclick (remover "javascript:" se presente)
                  const cleanCode = onclickCode
                    .replace(/^javascript:/i, "")
                    .trim();

                  // Criar um evento MouseEvent real
                  // @ts-ignore
                  const event = new MouseEvent("click", {
                    bubbles: true,
                    cancelable: true,
                    // @ts-ignore
                    view: window,
                    detail: 1,
                  });

                  // Tentar executar a função onclick com o evento e this corretos
                  // A função parece ser: jQuery.saj.validarAberturaIntimacaoNaoRecebida(event, this, ...)
                  // Vamos tentar executar diretamente chamando a função com os parâmetros

                  // Extrair os parâmetros da função do código onclick
                  const match = cleanCode.match(
                    /jQuery\.saj\.validarAberturaIntimacaoNaoRecebida\(([^)]+)\)/
                  );

                  if (match && match[1]) {
                    // Os parâmetros são: event, this, 'CJ000VN2E0000', 36, '/cpopg/...'
                    // Vamos executar a função diretamente
                    // @ts-ignore
                    if (
                      window.jQuery &&
                      window.jQuery.saj &&
                      window.jQuery.saj.validarAberturaIntimacaoNaoRecebida
                    ) {
                      // @ts-ignore
                      const params = match[1]
                        .split(",")
                        .map((p: string) => p.trim());
                      // Substituir 'event' e 'this' pelos valores reais
                      const processedParams = params.map(
                        (p: string, _index: number) => {
                          if (p === "event") return "event";
                          if (p === "this") return "element";
                          return p;
                        }
                      );

                      // Executar a função
                      // @ts-ignore
                      window.jQuery.saj.validarAberturaIntimacaoNaoRecebida(
                        event,
                        element,
                        ...processedParams.slice(2).map((p: string) => {
                          // Remover aspas e processar
                          return p.replace(/^['"]|['"]$/g, "");
                        })
                      );
                      return true;
                    } else {
                      // Se a função não estiver disponível, tentar executar o código diretamente
                      // @ts-ignore
                      const func = new Function(
                        "event",
                        "element",
                        `
                        const this = element;
                        ${cleanCode.replace(/this/g, "element")}
                      `
                      );
                      func(event, element);
                      return true;
                    }
                  } else {
                    // Se não conseguir extrair, tentar executar o código diretamente
                    // @ts-ignore
                    const func = new Function(
                      "event",
                      "element",
                      `
                      const this = element;
                      ${cleanCode.replace(/this/g, "element")}
                    `
                    );
                    func(event, element);
                    return true;
                  }
                } catch (e: any) {
                  console.error("Erro ao executar onclick:", e.message);
                  return false;
                }
              }
              return false;
            },
            linkInfo.id || "",
            linkInfo.href || "",
            linkInfo.onclick
          );

          if (onclickExecuted) {
            console.log(`✅ JavaScript do onclick executado`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } else {
            throw new Error("Não foi possível executar o onclick");
          }
        } catch (jsError: any) {
          console.log(`⚠️  Erro ao executar onclick: ${jsError.message}`);

          // FALLBACK 1: Navegar diretamente pela URL do href
          if (linkInfo.href) {
            console.log(`🔍 Tentando navegar diretamente pela URL do href...`);
            try {
              const baseUrl = new URL(page.url()).origin;
              const fullUrl = linkInfo.href.startsWith("http")
                ? linkInfo.href
                : linkInfo.href.startsWith("/")
                ? `${baseUrl}${linkInfo.href}`
                : `${baseUrl}/${linkInfo.href}`;

              console.log(`📄 Navegando para: ${fullUrl}`);
              await page.goto(fullUrl, {
                waitUntil: "domcontentloaded",
                timeout: 30000,
              });
              console.log(`✅ Navegação direta concluída`);
              await new Promise((resolve) => setTimeout(resolve, 2000));
            } catch (navError: any) {
              console.log(`⚠️  Erro na navegação direta: ${navError.message}`);

              // FALLBACK 2: Tentar clique normal
              console.log(`🔍 Tentando clique normal como último recurso...`);
              try {
                await documentLinkElement.click();
              } catch (clickError: any) {
                console.log(`⚠️  Erro no clique normal: ${clickError.message}`);
                // Última tentativa: clicar via JavaScript
                console.log(`🔍 Tentando clique via JavaScript...`);
                await page.evaluate((element) => {
                  // @ts-ignore
                  if (element) {
                    // @ts-ignore
                    element.click();
                  }
                }, documentLinkElement);
              }
            }
          } else {
            // Se não tem href, tentar clique normal
            console.log(`🔍 Tentando clique normal...`);
            try {
              await documentLinkElement.click();
            } catch (clickError: any) {
              console.log(`⚠️  Erro no clique normal: ${clickError.message}`);
            }
          }
        }
      } else {
        // Se não tem onclick, fazer clique normal
        console.log(`🔍 Fazendo clique normal no link...`);
        try {
          await documentLinkElement.click();
        } catch (clickError: any) {
          console.log(`⚠️  Erro no clique normal: ${clickError.message}`);
          // Tentar clicar via JavaScript
          console.log(`🔍 Tentando clique via JavaScript...`);
          await page.evaluate((element) => {
            // @ts-ignore
            if (element) {
              // @ts-ignore
              element.click();
            }
          }, documentLinkElement);
        }
      }

      // Aguardar navegação usando múltiplas estratégias
      console.log(`⏳ Aguardando navegação...`);

      try {
        // Usar Promise.race para aguardar qualquer uma das condições
        await Promise.race([
          // Aguardar mudança de URL
          page.waitForFunction(
            (oldUrl) => {
              // @ts-ignore
              return window.location.href !== oldUrl;
            },
            { timeout: 30000 },
            urlBeforeClick
          ),
          // Aguardar elementos da pasta digital aparecerem
          page.waitForSelector(
            "#divArvore, .pastaDigitalTitulo, #myMenu, iframe#documento",
            {
              timeout: 30000,
            }
          ),
          // Aguardar navegação padrão
          page.waitForNavigation({
            waitUntil: ["domcontentloaded", "networkidle0"],
            timeout: 30000,
          }),
        ]);
        console.log(`✅ Navegação detectada`);
      } catch (navError: any) {
        console.log(`⚠️  Timeout na navegação: ${navError.message}`);
        // Continuar mesmo assim - a página pode ter carregado parcialmente
      }

      // Aguardar um pouco para a página carregar completamente
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verificar se chegou na página da pasta digital
      const urlAfterClick = page.url();
      console.log(`🔍 URL após clique: ${urlAfterClick}`);

      // Verificar se elementos da pasta digital estão presentes
      const pastaDigitalElements = await page.evaluate(() => {
        // @ts-ignore - document está disponível no contexto do navegador via page.evaluate()
        return {
          // @ts-ignore
          hasDivArvore: !!document.querySelector("#divArvore"),
          // @ts-ignore
          hasEsticarButton: !!document.querySelector("#esticarButton"),
          // @ts-ignore
          hasMyMenu: !!document.querySelector("#myMenu"),
          // @ts-ignore
          hasPastaDigitalTitulo: !!document.querySelector(
            ".pastaDigitalTitulo"
          ),
          // @ts-ignore
          hasIframe: !!document.querySelector("iframe#documento"),
        };
      });

      console.log(
        `🔍 Elementos da pasta digital:`,
        JSON.stringify(pastaDigitalElements, null, 2)
      );

      // Verificar se pelo menos alguns elementos da pasta digital estão presentes
      if (
        pastaDigitalElements.hasDivArvore ||
        pastaDigitalElements.hasEsticarButton ||
        pastaDigitalElements.hasIframe
      ) {
        console.log(`✅ Página da pasta digital carregada com sucesso`);

        // Se o iframe está presente, clicar no botão de download dentro dele
        if (pastaDigitalElements.hasIframe) {
          console.log(`🔍 Procurando iframe #documento...`);

          // Aguardar o iframe aparecer e carregar
          const iframe = await page.waitForSelector("iframe#documento", {
            timeout: 10000,
          });

          if (iframe) {
            console.log(`✅ Iframe #documento encontrado`);

            // Obter o frame do iframe
            const iframeFrame = await iframe.contentFrame();

            if (iframeFrame) {
              console.log(`✅ Frame do iframe obtido`);

              // Aguardar o botão de download aparecer dentro do iframe
              console.log(`🔍 Aguardando botão #download dentro do iframe...`);

              try {
                const downloadButton = await iframeFrame.waitForSelector(
                  "#download",
                  {
                    timeout: 15000,
                    visible: true,
                  }
                );

                if (downloadButton) {
                  console.log(`✅ Botão #download encontrado dentro do iframe`);

                  // Clicar no botão de download
                  await downloadButton.click();
                  console.log(`✅ Botão de download clicado`);

                  // Aguardar um pouco para o download iniciar
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                  console.log(`✅ Download iniciado`);
                } else {
                  console.log(
                    `⚠️  Botão #download não encontrado dentro do iframe`
                  );
                }
              } catch (buttonError: any) {
                console.log(
                  `⚠️  Erro ao encontrar/clicar no botão de download: ${buttonError.message}`
                );
              }
            } else {
              console.log(`⚠️  Não foi possível obter o frame do iframe`);
            }
          } else {
            console.log(`⚠️  Iframe #documento não encontrado`);
          }
        }

        return true;
      } else {
        console.log(
          `⚠️  Elementos da pasta digital não encontrados. URL atual: ${urlAfterClick}`
        );
        return false;
      }
    } catch (error: any) {
      console.error(`❌ Erro ao navegar para página do documento:`, error);
      return false;
    }
  }

  /**
   * Baixa um documento específico de um processo no e-SAJ
   * @param page - Página do Puppeteer já na página de detalhes do processo
   * @param documentCandidate - Documento escolhido para download
   * @param protocolNumber - Número do protocolo do processo
   * @param documentType - Tipo de documento solicitado
   * @returns Resultado com informações do download
   */
  async downloadDocument(
    page: Page,
    documentCandidate: DocumentCandidate,
    protocolNumber: string,
    documentType: string
  ): Promise<DocumentDownloadResult> {
    try {
      const cleanProtocol = protocolNumber.trim().replace(/[\s.\-]/g, "");

      // Configurar página para downloads
      await this.setupPageForDownloads(page);

      // Obter lista de arquivos antes do download
      const filesBefore = fs.existsSync(this.downloadsDir)
        ? fs.readdirSync(this.downloadsDir)
        : [];

      // ETAPA 1: Navegar para a página da pasta digital e clicar no botão de download
      const navigationSuccess = await this.navigateToDocumentPage(
        page,
        documentCandidate
      );

      if (!navigationSuccess) {
        return {
          success: false,
          protocolNumber: cleanProtocol,
          documentType: documentType,
          error:
            "Não foi possível navegar para a página da pasta digital ou clicar no botão de download.",
        };
      }

      // Aguardar o download completar e encontrar o arquivo baixado
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
          protocolNumber: cleanProtocol,
          documentType: documentType,
          error: "Timeout aguardando download completar (60 segundos)",
        };
      }

      const filePath = path.join(this.downloadsDir, downloadedFile);
      const fileName = downloadedFile;

      console.log(`✅ Download concluído: ${fileName}`);

      return {
        success: true,
        protocolNumber: cleanProtocol,
        documentType: documentType,
        filePath: filePath,
        fileName: fileName,
      };
    } catch (error: any) {
      console.error(`❌ Erro ao baixar documento:`, error);
      return {
        success: false,
        protocolNumber: protocolNumber.trim().replace(/[\s.\-]/g, ""),
        documentType: documentType,
        error: error.message || "Erro desconhecido ao baixar documento",
      };
    }
  }
}
