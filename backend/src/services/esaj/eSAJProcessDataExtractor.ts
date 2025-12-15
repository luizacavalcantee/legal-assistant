import { Page } from "puppeteer";
import { eSAJBase } from "./eSAJBase";

/**
 * Responsável por extrair dados do processo (movimentações e informações)
 * Componente focado em scraping de dados não-documentais
 */
export class eSAJProcessDataExtractor extends eSAJBase {
  constructor(base?: eSAJBase) {
    super(base);
  }

  /**
   * Expande a seção de movimentações se necessário
   * Garante acesso a #tabelaTodasMovimentacoes
   */
  private async expandMovementsSection(page: Page): Promise<void> {
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
   * Extrai o texto completo de todas as movimentações e seus detalhes
   * @param page - Página do Puppeteer já na página de detalhes do processo
   * @returns Texto completo das movimentações (limpo e otimizado)
   */
  async extractMovementsText(page: Page): Promise<string> {
    try {
      console.log(`📋 Extraindo movimentações do processo...`);

      // ETAPA 1: Expandir seção de movimentações
      await this.expandMovementsSection(page);

      // ETAPA 2: Extrair movimentações usando seletores CSS robustos
      const movementsData = await page.evaluate(() => {
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

        if (!tbody) {
          return {
            movimentacoes: [],
            informacoesProcesso: {},
          };
        }

        // Extrair informações básicas do processo
        const processInfo: {
          numero?: string;
          classe?: string;
          assunto?: string;
          foro?: string;
          vara?: string;
          juiz?: string;
          partes?: string[];
        } = {};

        // Tentar extrair número do processo
        // @ts-ignore
        const numeroElement = document.querySelector(
          '[id*="numeroProcesso"], .numero-processo, h2, h3'
        );
        if (numeroElement) {
          // @ts-ignore
          const numeroText = numeroElement.textContent || "";
          const numeroMatch = numeroText.match(
            /\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}/
          );
          if (numeroMatch) {
            processInfo.numero = numeroMatch[0];
          }
        }

        // Extrair informações de tabelas de dados do processo
        // @ts-ignore
        const infoRows = document.querySelectorAll("table tr");
        // @ts-ignore
        for (const row of infoRows) {
          // @ts-ignore
          const cells = row.querySelectorAll("td");
          if (cells.length >= 2) {
            // @ts-ignore
            const label = (cells[0].textContent || "").toLowerCase().trim();
            // @ts-ignore
            const value = (cells[1].textContent || "").trim();

            if (label.includes("classe") && value) {
              processInfo.classe = value;
            } else if (label.includes("assunto") && value) {
              processInfo.assunto = value;
            } else if (label.includes("foro") && value) {
              processInfo.foro = value;
            } else if (label.includes("vara") && value) {
              processInfo.vara = value;
            } else if (label.includes("juiz") && value) {
              processInfo.juiz = value;
            }
          }
        }

        // Extrair partes do processo
        // @ts-ignore
        const partesSection = document.querySelector(
          '[id*="parte"], .partes, [class*="parte"]'
        );
        if (partesSection) {
          // @ts-ignore
          const partesText = partesSection.textContent || "";
          // Extrair linhas que parecem ser partes (Reqte, Reqdo, etc.)
          const partesLines = partesText.split("\n").filter((line: string) => {
            const lower = line.toLowerCase().trim();
            return (
              lower.includes("reqte") ||
              lower.includes("reqdo") ||
              lower.includes("autor") ||
              lower.includes("réu") ||
              lower.includes("advogado")
            );
          });
          if (partesLines.length > 0) {
            processInfo.partes = partesLines;
          }
        }

        // Extrair movimentações usando seletores robustos
        // @ts-ignore
        const rows = Array.from(
          tbody.querySelectorAll("tr.containerMovimentacao")
        );

        const movimentacoes: string[] = [];

        for (const row of rows) {
          // @ts-ignore
          const dataCell = row.querySelector("td.dataMovimentacao");
          // @ts-ignore
          const descricaoCell = row.querySelector("td.descricaoMovimentacao");

          if (dataCell && descricaoCell) {
            // @ts-ignore
            const data = (dataCell.textContent || "").trim();
            // @ts-ignore
            const descricao = (descricaoCell.textContent || "").trim();

            if (data && descricao) {
              movimentacoes.push(`${data} - ${descricao}`);
            }
          }
        }

        return {
          movimentacoes,
          informacoesProcesso: processInfo,
        };
      });

      // ETAPA 3: Construir texto completo com informações do processo e movimentações
      let movementsText = "";

      // Adicionar informações básicas do processo
      const info = movementsData.informacoesProcesso;
      if (info.numero || info.classe || info.assunto) {
        movementsText += "=== INFORMAÇÕES DO PROCESSO ===\n\n";
        if (info.numero) {
          movementsText += `Número: ${info.numero}\n`;
        }
        if (info.classe) {
          movementsText += `Classe: ${info.classe}\n`;
        }
        if (info.assunto) {
          movementsText += `Assunto: ${info.assunto}\n`;
        }
        if (info.foro) {
          movementsText += `Foro: ${info.foro}\n`;
        }
        if (info.vara) {
          movementsText += `Vara: ${info.vara}\n`;
        }
        if (info.juiz) {
          movementsText += `Juiz: ${info.juiz}\n`;
        }
        if (info.partes && info.partes.length > 0) {
          movementsText += `\nPartes:\n${info.partes.join("\n")}\n`;
        }
        movementsText += "\n=== MOVIMENTAÇÕES ===\n\n";
      }

      // Adicionar movimentações
      if (
        movementsData.movimentacoes &&
        movementsData.movimentacoes.length > 0
      ) {
        movementsText += movementsData.movimentacoes.join("\n\n");
      } else {
        // Fallback: tentar extrair texto geral se não encontrou na estrutura esperada
        const fallbackText = await page.evaluate(() => {
          // @ts-ignore
          const movimentacoesSection = document.querySelector(
            '[id*="moviment"], [class*="moviment"], #tabelaUltimasMovimentacoes'
          );
          if (movimentacoesSection) {
            // @ts-ignore
            return movimentacoesSection.textContent || "";
          }
          return "";
        });
        if (fallbackText) {
          movementsText += fallbackText;
        }
      }

      if (!movementsText || movementsText.trim().length === 0) {
        throw new Error("Nenhuma movimentação encontrada no processo.");
      }

      // ETAPA 4: Limpeza básica do texto para otimizar consumo do LLM
      const cleanedText = this.cleanMovementsText(movementsText);

      console.log(
        `✅ Movimentações extraídas: ${cleanedText.length} caracteres (${movementsText.length} antes da limpeza)`
      );

      return cleanedText;
    } catch (error: any) {
      console.error(`❌ Erro ao extrair movimentações:`, error);
      throw error;
    }
  }

  /**
   * Limpa o texto das movimentações removendo quebras de linha excessivas e espaços duplicados
   * @param text - Texto bruto das movimentações
   * @returns Texto limpo e otimizado para consumo do LLM
   */
  private cleanMovementsText(text: string): string {
    if (!text) return "";

    // Remover quebras de linha excessivas (mais de 2 consecutivas)
    let cleaned = text.replace(/\n{3,}/g, "\n\n");

    // Remover espaços em branco excessivos (mais de 2 consecutivos)
    cleaned = cleaned.replace(/[ \t]{3,}/g, "  ");

    // Remover espaços no início e fim de cada linha
    cleaned = cleaned
      .split("\n")
      .map((line) => line.trim())
      .join("\n");

    // Remover linhas vazias no início e fim
    cleaned = cleaned.trim();

    // Garantir que há pelo menos uma quebra de linha entre seções
    cleaned = cleaned.replace(/\n([A-Z])/g, "\n\n$1");

    return cleaned;
  }
}

