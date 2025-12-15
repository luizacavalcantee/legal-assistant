import { Page } from "puppeteer";
import { eSAJBase } from "./eSAJBase";

export interface DocumentCandidate {
  movimentoText: string;
  linkHref: string;
  linkId: string;
  hasDocument: boolean;
  requiresPassword: boolean;
}

/**
 * Responsável por encontrar documentos na lista de movimentações
 */
export class eSAJDocumentFinder extends eSAJBase {
  constructor(base?: eSAJBase) {
    super(base);
  }

  /**
   * Expande a seção de movimentações se necessário
   */
  async expandMovementsSection(page: Page): Promise<void> {
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
        } else {
          console.log(`✅ Seção de movimentações já estava expandida`);
        }
      }
    } catch (expandError: any) {
      console.log(
        `⚠️  Erro ao expandir movimentações: ${expandError.message}. Continuando...`
      );
    }
  }

  /**
   * Busca documentos na tabela de movimentações que correspondem ao tipo solicitado
   * @param page - Página do Puppeteer já na página de detalhes do processo
   * @param documentType - Tipo de documento solicitado (ex: "petição inicial", "sentença")
   * @returns Lista de candidatos de documentos encontrados
   */
  async findDocuments(
    page: Page,
    documentType: string
  ): Promise<DocumentCandidate[]> {
    // Expandir seção de movimentações se necessário
    await this.expandMovementsSection(page);

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

    return movimentacoes;
  }

  /**
   * Prioriza documentos sem senha e retorna o melhor candidato
   * @param candidates - Lista de candidatos encontrados
   * @returns Documento escolhido ou null se nenhum disponível
   */
  selectBestDocument(
    candidates: DocumentCandidate[]
  ): DocumentCandidate | null {
    if (candidates.length === 0) {
      return null;
    }

    // Priorizar documentos sem senha
    const documentosSemSenha = candidates.filter(
      (mov) => !mov.requiresPassword
    );
    const documentosComSenha = candidates.filter(
      (mov) => mov.requiresPassword
    );

    console.log(
      `📊 Análise: ${documentosSemSenha.length} documento(s) sem senha, ${documentosComSenha.length} documento(s) requerem senha`
    );

    // Retornar o primeiro documento sem senha, ou null se todos requerem senha
    return documentosSemSenha.length > 0 ? documentosSemSenha[0] : null;
  }
}

