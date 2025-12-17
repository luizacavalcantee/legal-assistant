import { Page } from "puppeteer";
import { eSAJBase } from "./eSAJBase";
import type { ProgressCallback } from "../../types/progress.types";

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
   * @param progressCallback - Callback opcional para reportar progresso
   * @returns Resultado da busca indicando se o processo foi encontrado
   */
  async findProcess(
    protocolNumber: string,
    progressCallback?: ProgressCallback
  ): Promise<ProcessSearchResult> {
    let page: Page | null = null;

    try {
      // Configurar callback de progresso temporariamente
      const originalCallback = this.progressCallback;
      if (progressCallback) {
        this.setProgressCallback(progressCallback);
      }

      await this.emitProgress({
        stage: "init",
        message: "Inicializando busca no e-SAJ...",
        progress: 0,
      });

      console.log(`🔍 Buscando processo ${protocolNumber} no e-SAJ...`);

      // Validar número do protocolo
      if (!protocolNumber || protocolNumber.trim().length === 0) {
        await this.emitProgress({
          stage: "error",
          message: "Número de protocolo não fornecido",
          error: "Número de protocolo não fornecido",
        });
        return {
          found: false,
          protocolNumber: protocolNumber,
          error: "Número de protocolo não fornecido",
        };
      }

      // Limpar e formatar número do protocolo (remover espaços, pontos, hífens)
      const cleanProtocol = protocolNumber.trim().replace(/[\s.\-]/g, "");

      // Inicializar navegador
      await this.emitProgress({
        stage: "connecting",
        message: "Conectando ao portal e-SAJ...",
        progress: 10,
      });

      const browser = await this.initBrowser();
      page = await browser.newPage();

      // Configurar timeout
      page.setDefaultTimeout(45000); // 45 segundos - e-SAJ pode ser lento

      // Navegar para a página de consulta pública
      await this.emitProgress({
        stage: "navigating",
        message: "Acessando portal e-SAJ...",
        progress: 20,
        details: "Carregando página de consulta pública",
      });

      console.log(`📄 Navegando para ${this.eSAJUrl}...`);
      await page.goto(this.eSAJUrl, {
        waitUntil: "networkidle2",
        timeout: 30000, // Reduzido de indefinido para 30s
      });

      // Aguardar o carregamento da página (reduzido de 2s para 1s)
      await this.wait(1000);

      // Ação 1: Trocar o tipo de consulta para "Outros" PRIMEIRO
      await this.emitProgress({
        stage: "searching",
        message: "Preparando formulário de busca...",
        progress: 30,
        details: "Selecionando tipo de consulta",
      });

      console.log(`🔄 Selecionando radio button "Outros"...`);
      try {
        const outrosRadio = await page.$('input[id="radioNumeroAntigo"]');
        if (outrosRadio) {
          await outrosRadio.click();
          await this.wait(500); // Reduzido de 1s para 500ms
          console.log(`✅ Radio button "Outros" selecionado`);
        } else {
          await this.emitProgress({
            stage: "error",
            message: "Erro: estrutura do portal pode ter mudado",
            error: "Radio button 'Outros' não encontrado",
          });
          return {
            found: false,
            protocolNumber: cleanProtocol,
            error:
              "Radio button 'Outros' não encontrado. A estrutura do portal pode ter mudado.",
          };
        }
      } catch (radioError: any) {
        await this.emitProgress({
          stage: "error",
          message: `Erro ao selecionar tipo de consulta: ${radioError.message}`,
          error: radioError.message,
        });
        return {
          found: false,
          protocolNumber: cleanProtocol,
          error: `Erro ao selecionar radio button "Outros": ${radioError.message}`,
        };
      }

      // Ação 2: Preencher o número do protocolo no campo que aparece após selecionar "Outros"
      await this.emitProgress({
        stage: "searching",
        message: "Preenchendo número do processo...",
        progress: 40,
        details: `Protocolo: ${cleanProtocol}`,
      });

      console.log(`📋 Preenchendo número do protocolo: ${cleanProtocol}`);
      try {
        const protocolInput = await page.$(
          'input[id="nuProcessoAntigoFormatado"]'
        );
        if (!protocolInput) {
          await this.emitProgress({
            stage: "error",
            message: "Campo de protocolo não encontrado",
            error: "Campo de protocolo não encontrado após selecionar 'Outros'",
          });
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
        await this.wait(300); // Reduzido de 500ms para 300ms
        console.log(`✅ Número do protocolo preenchido`);
      } catch (inputError: any) {
        await this.emitProgress({
          stage: "error",
          message: `Erro ao preencher protocolo: ${inputError.message}`,
          error: inputError.message,
        });
        return {
          found: false,
          protocolNumber: cleanProtocol,
          error: `Erro ao preencher número do protocolo: ${inputError.message}`,
        };
      }

      // Ação 3: Submeter o formulário
      await this.emitProgress({
        stage: "searching",
        message: "Buscando processo no e-SAJ...",
        progress: 50,
        details: "Aguardando resposta do portal",
      });

      console.log(`🔘 Clicando no botão de consulta...`);
      try {
        const consultButton = await page.$(
          'input[id="botaoConsultarProcessos"]'
        );
        if (!consultButton) {
          await this.emitProgress({
            stage: "error",
            message: "Botão de consulta não encontrado",
            error: "Botão de consulta não encontrado",
          });
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
        await this.wait(1000); // Reduzido de 2s para 1s
        console.log(`✅ Formulário submetido e página de detalhes carregada`);
      } catch (buttonError: any) {
        await this.emitProgress({
          stage: "error",
          message: `Erro ao buscar processo: ${buttonError.message}`,
          error: buttonError.message,
        });
        return {
          found: false,
          protocolNumber: cleanProtocol,
          error: `Erro ao submeter formulário: ${buttonError.message}`,
        };
      }

      // Aguardar o carregamento da página de resultados
      await this.emitProgress({
        stage: "searching",
        message: "Processando resultado da busca...",
        progress: 70,
        details: "Verificando se o processo foi encontrado",
      });

      await this.wait(1500); // Reduzido de 3s para 1.5s
      await page
        .waitForNavigation({ waitUntil: "networkidle2", timeout: 45000 })
        .catch(() => {
          // Ignorar erro de timeout - a página pode já ter carregado
        });

      // Verificar se o processo foi encontrado
      await this.emitProgress({
        stage: "searching",
        message: "Verificando resultado...",
        progress: 80,
        details: "Analisando página de resultados",
      });

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
        await this.emitProgress({
          stage: "error",
          message: "Processo não encontrado no e-SAJ",
          error: "Processo não encontrado no portal e-SAJ",
          progress: 100,
        });
        // Restaurar callback original
        if (progressCallback) {
          this.setProgressCallback(originalCallback);
        }
        return {
          found: false,
          protocolNumber: cleanProtocol,
          error: "Processo não encontrado no portal e-SAJ",
        };
      }

      if (hasSuccessIndicator || processElements.length > 0) {
        console.log(`✅ Processo ${cleanProtocol} encontrado no e-SAJ`);
        await this.emitProgress({
          stage: "complete",
          message: "✅ Processo encontrado!",
          progress: 100,
          details: `Processo ${cleanProtocol} localizado com sucesso`,
        });
        
        // Capturar a URL da página de detalhes do processo
        const processPageUrl = page.url();
        // Retornar a página para reutilização (não fechar no finally)
        const resultPage = page;
        page = null; // Evitar que seja fechada no finally
        
        // Restaurar callback original
        if (progressCallback) {
          this.setProgressCallback(originalCallback);
        }
        
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
      await this.emitProgress({
        stage: "error",
        message: "Não foi possível determinar se o processo foi encontrado",
        error: "Não foi possível determinar se o processo foi encontrado. A estrutura do portal pode ter mudado.",
        progress: 100,
      });
      
      // Restaurar callback original
      if (progressCallback) {
        this.setProgressCallback(originalCallback);
      }

      return {
        found: false,
        protocolNumber: cleanProtocol,
        error:
          "Não foi possível determinar se o processo foi encontrado. A estrutura do portal pode ter mudado.",
      };
    } catch (error: any) {
      console.error(`❌ Erro ao buscar processo ${protocolNumber}:`, error);
      await this.emitProgress({
        stage: "error",
        message: `Erro ao buscar processo: ${error.message}`,
        error: error.message,
        progress: 100,
      });
      
      // Restaurar callback original
      if (progressCallback) {
        this.setProgressCallback(originalCallback);
      }

      return {
        found: false,
        protocolNumber: protocolNumber,
        error: `Erro ao buscar processo: ${error.message}`,
      };
    } finally {
      // Restaurar callback original se ainda não foi restaurado
      if (progressCallback && this.progressCallback === progressCallback) {
        this.setProgressCallback(originalCallback);
      }
      // Fechar a página, mas manter o navegador aberto para reutilização
      if (page && !page.isClosed()) {
        await page.close();
      }
    }
  }
}
