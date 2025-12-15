import { Page } from "puppeteer";
import { eSAJBase } from "./eSAJBase";
import { eSAJProcessSearcher } from "./eSAJProcessSearcher";

export interface ProcessMovementsResult {
  success: boolean;
  protocolNumber: string;
  movements?: string; // Texto completo das movimentações
  error?: string;
}

/**
 * Responsável por extrair movimentações e informações do processo
 */
export class eSAJMovementsExtractor extends eSAJBase {
  private processSearcher: eSAJProcessSearcher;

  constructor(base?: eSAJBase) {
    super(base);
    // Compartilhar a mesma instância base para reutilizar navegador
    this.processSearcher = new eSAJProcessSearcher(base || this);
  }

  /**
   * Expande a seção de movimentações se necessário
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
   * Navega para a página de detalhes do processo
   * Reutiliza lógica do ProcessSearcher se necessário
   */
  private async navigateToProcessPage(
    page: Page,
    protocolNumber: string,
    processPageUrl?: string
  ): Promise<void> {
    if (processPageUrl) {
      console.log(
        `📄 Navegando diretamente para a página de detalhes: ${processPageUrl}`
      );
      await page.goto(processPageUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } else {
      // Se não temos a URL, fazer a busca completa usando ProcessSearcher
      const searchResult = await this.processSearcher.findProcess(protocolNumber);
      if (!searchResult.found || !searchResult.processPageUrl) {
        throw new Error(
          searchResult.error || "Processo não encontrado para extrair movimentações"
        );
      }
      await page.goto(searchResult.processPageUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
    let page: Page | null = null;

    try {
      console.log(
        `📋 Extraindo movimentações do processo ${protocolNumber}...`
      );

      // Validar parâmetros
      if (!protocolNumber || protocolNumber.trim().length === 0) {
        return {
          success: false,
          protocolNumber: protocolNumber,
          error: "Número de protocolo não fornecido",
        };
      }

      // Limpar e formatar número do protocolo
      const cleanProtocol = protocolNumber.trim().replace(/[\s.\-]/g, "");

      // Inicializar navegador
      const browser = await this.initBrowser();
      page = await browser.newPage();
      page.setDefaultTimeout(30000);

      // ETAPA 1: Navegação para a página de detalhes
      await this.navigateToProcessPage(page, cleanProtocol, processPageUrl);

      // ETAPA 2: Expandir seção de movimentações
      await this.expandMovementsSection(page);

      // ETAPA 3: Extrair informações do processo e movimentações
      console.log(`📋 Extraindo informações do processo e movimentações...`);
      const processData = await page.evaluate(() => {
        // Extrair informações básicas do processo
        const processInfo: {
          numero?: string;
          classe?: string;
          assunto?: string;
          foro?: string;
          vara?: string;
          juiz?: string;
          partes?: string[];
          movimentacoes: string[];
        } = {
          movimentacoes: [],
        };

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

        // Extrair movimentações
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

        if (tbody) {
          // @ts-ignore
          const rows = Array.from(
            tbody.querySelectorAll("tr.containerMovimentacao")
          );

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
                processInfo.movimentacoes.push(`${data} - ${descricao}`);
              }
            }
          }
        }

        return processInfo;
      });

      // Construir texto completo com informações do processo e movimentações
      let movementsText = "";

      // Adicionar informações básicas do processo
      if (processData.numero || processData.classe || processData.assunto) {
        movementsText += "=== INFORMAÇÕES DO PROCESSO ===\n\n";
        if (processData.numero) {
          movementsText += `Número: ${processData.numero}\n`;
        }
        if (processData.classe) {
          movementsText += `Classe: ${processData.classe}\n`;
        }
        if (processData.assunto) {
          movementsText += `Assunto: ${processData.assunto}\n`;
        }
        if (processData.foro) {
          movementsText += `Foro: ${processData.foro}\n`;
        }
        if (processData.vara) {
          movementsText += `Vara: ${processData.vara}\n`;
        }
        if (processData.juiz) {
          movementsText += `Juiz: ${processData.juiz}\n`;
        }
        if (processData.partes && processData.partes.length > 0) {
          movementsText += `\nPartes:\n${processData.partes.join("\n")}\n`;
        }
        movementsText += "\n=== MOVIMENTAÇÕES ===\n\n";
      }

      // Adicionar movimentações
      if (processData.movimentacoes && processData.movimentacoes.length > 0) {
        movementsText += processData.movimentacoes.join("\n\n");
      } else {
        // Se não encontrou movimentações na estrutura esperada, tentar extrair texto geral
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
        return {
          success: false,
          protocolNumber: cleanProtocol,
          error: "Nenhuma movimentação encontrada no processo.",
        };
      }

      console.log(
        `✅ Movimentações extraídas com sucesso (${movementsText.length} caracteres)`
      );

      return {
        success: true,
        protocolNumber: cleanProtocol,
        movements: movementsText,
      };
    } catch (error: any) {
      console.error(
        `❌ Erro ao extrair movimentações do processo ${protocolNumber}:`,
        error
      );
      return {
        success: false,
        protocolNumber: protocolNumber,
        error: `Erro ao extrair movimentações: ${error.message}`,
      };
    } finally {
      if (page && !page.isClosed()) {
        await page.close();
      }
    }
  }
}

