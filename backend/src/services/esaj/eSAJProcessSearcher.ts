import { Page } from "puppeteer";
import { eSAJBase } from "./eSAJBase";

export interface ProcessSearchResult {
  found: boolean;
  protocolNumber: string;
  processPageUrl?: string; // URL da página de detalhes do processo (se encontrado)
  page?: Page; // Página já aberta na página de detalhes (para reutilização)
  error?: string;
}

/**
 * Responsável por buscar processos no e-SAJ
 */
export class eSAJProcessSearcher extends eSAJBase {
  constructor(base?: eSAJBase) {
    super(base);
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
      page.setDefaultTimeout(45000); // 45 segundos - e-SAJ pode ser lento

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
          timeout: 45000, // 45 segundos - e-SAJ pode ser lento
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
        .waitForNavigation({ waitUntil: "networkidle2", timeout: 45000 }) // 45 segundos - e-SAJ pode ser lento
        .catch(() => {
          // Ignorar erro de timeout - a página pode já ter carregado
        });

      // Verificar se o processo foi encontrado
      // Procurar por indicadores de sucesso ou erro
      // @ts-ignore - document está disponível no contexto do navegador via page.evaluate()
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
        // Retornar a página para reutilização (não fechar no finally)
        const resultPage = page;
        page = null; // Evitar que seja fechada no finally
        return {
          found: true,
          protocolNumber: cleanProtocol,
          processPageUrl: processPageUrl,
          page: resultPage, // Página já aberta na página de detalhes
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
      if (page && !page.isClosed()) {
        await page.close();
      }
    }
  }
}
