import { Page } from "puppeteer";
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
        `📄 Tentando extrair URL do documento: ${documentCandidate.movimentoText.substring(0, 100)}`
      );

      // Encontrar e clicar no link do documento
      let documentLinkElement = null;

      if (documentCandidate.linkId) {
        documentLinkElement = await page.$(`#${documentCandidate.linkId}`);
      }

      if (!documentLinkElement && documentCandidate.linkHref) {
        // Buscar link por href
        const links = await page.$$(
          `a[href*="${documentCandidate.linkHref}"]`
        );
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
   * Baixa um documento específico de um processo no e-SAJ
   * @param page - Página do Puppeteer já na página de detalhes do processo
   * @param documentCandidate - Documento escolhido para download
   * @param protocolNumber - Número do protocolo do processo
   * @param documentType - Tipo de documento solicitado
   * @returns Resultado com URL do PDF
   */
  async downloadDocument(
    page: Page,
    documentCandidate: DocumentCandidate,
    protocolNumber: string,
    documentType: string
  ): Promise<DocumentDownloadResult> {
    try {
      const cleanProtocol = protocolNumber.trim().replace(/[\s.\-]/g, "");

      const pdfUrl = await this.extractPDFUrl(
        page,
        documentCandidate,
        cleanProtocol,
        documentType
      );

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
    }
  }
}

