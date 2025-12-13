import * as fs from "fs";
import * as path from "path";
import pdfParse from "pdf-parse";
import dotenv from "dotenv";

dotenv.config();

export interface Chunk {
  text: string;
  index: number;
  startChar: number;
  endChar: number;
}

export class DocumentProcessor {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor() {
    // Tamanho do chunk em caracteres (padrão: 1000)
    this.chunkSize = parseInt(process.env.CHUNK_SIZE || "1000");
    // Overlap entre chunks (padrão: 200 caracteres)
    this.chunkOverlap = parseInt(process.env.CHUNK_OVERLAP || "200");
  }

  /**
   * Lê o conteúdo de um arquivo baseado no caminho
   * @param filePath - Caminho do arquivo
   * @returns Conteúdo do arquivo como string
   */
  async readFileContent(filePath: string): Promise<string> {
    try {
      // Se o caminho é absoluto ou começa com ./ ou .., usar diretamente
      // Caso contrário, assumir que é relativo ao diretório de documentos
      let fullPath: string;
      
      if (path.isAbsolute(filePath)) {
        fullPath = filePath;
      } else if (filePath.startsWith("./") || filePath.startsWith("../")) {
        fullPath = path.join(process.cwd(), filePath);
      } else {
        const basePath = process.env.DOCUMENTS_BASE_PATH || "./documents";
        fullPath = path.join(basePath, path.basename(filePath));
      }

      // Verificar extensão do arquivo
      const ext = path.extname(fullPath).toLowerCase();

      if (ext === ".pdf") {
        return await this.readPDF(fullPath);
      } else if (ext === ".txt" || ext === ".md") {
        return await this.readTextFile(fullPath);
      } else {
        // Para outros formatos ou se não conseguir ler, retornar conteúdo mockado
        console.warn(
          `⚠️  Formato não suportado ou arquivo não encontrado: ${filePath}. Usando conteúdo mockado.`
        );
        return this.getMockContent(filePath);
      }
    } catch (error: any) {
      console.warn(
        `⚠️  Erro ao ler arquivo ${filePath}: ${error.message}. Usando conteúdo mockado.`
      );
      return this.getMockContent(filePath);
    }
  }

  /**
   * Lê conteúdo de um arquivo PDF
   */
  private async readPDF(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error: any) {
      throw new Error(`Erro ao ler PDF: ${error.message}`);
    }
  }

  /**
   * Lê conteúdo de um arquivo de texto
   */
  private async readTextFile(filePath: string): Promise<string> {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch (error: any) {
      throw new Error(`Erro ao ler arquivo de texto: ${error.message}`);
    }
  }

  /**
   * Retorna conteúdo mockado para testes
   */
  private getMockContent(filePath: string): string {
    // Conteúdo mockado baseado no título do arquivo
    const fileName = path.basename(filePath, path.extname(filePath));

    return `
Este é um documento jurídico de exemplo: ${fileName}

CAPÍTULO I - DISPOSIÇÕES GERAIS

Artigo 1º. Este documento estabelece as diretrizes e normas para o sistema jurídico.

Artigo 2º. As disposições aqui contidas aplicam-se a todos os casos previstos na legislação vigente.

CAPÍTULO II - DIREITOS E DEVERES

Artigo 3º. Todo cidadão tem direito à informação e ao acesso à justiça.

Artigo 4º. É dever do Estado garantir a efetivação dos direitos fundamentais.

CAPÍTULO III - PROCEDIMENTOS

Artigo 5º. Os procedimentos devem seguir os prazos estabelecidos em lei.

Artigo 6º. A não observância dos prazos pode resultar em prejuízos processuais.

Este documento serve como exemplo para demonstração do sistema de indexação vetorial.
O conteúdo real será processado quando os arquivos estiverem disponíveis no sistema.
    `.trim();
  }

  /**
   * Divide o texto em chunks (pedaços menores)
   * @param text - Texto completo
   * @returns Array de chunks
   */
  chunkText(text: string): Chunk[] {
    const chunks: Chunk[] = [];
    let startIndex = 0;
    let chunkIndex = 0;

    // Limpar e normalizar texto
    const cleanText = text
      .replace(/\s+/g, " ")
      .trim();

    while (startIndex < cleanText.length) {
      const endIndex = Math.min(
        startIndex + this.chunkSize,
        cleanText.length
      );

      // Tentar quebrar em ponto final, ponto e vírgula ou quebra de linha
      let actualEndIndex = endIndex;
      if (endIndex < cleanText.length) {
        const nextSentence = cleanText.slice(
          endIndex - 100,
          endIndex + 100
        );
        const sentenceEnd = nextSentence.search(/[.!?]\s/);
        if (sentenceEnd > 0) {
          actualEndIndex = endIndex - 100 + sentenceEnd + 1;
        }
      }

      const chunkText = cleanText.slice(startIndex, actualEndIndex).trim();

      if (chunkText.length > 0) {
        chunks.push({
          text: chunkText,
          index: chunkIndex,
          startChar: startIndex,
          endChar: actualEndIndex,
        });
        chunkIndex++;
      }

      // Avançar com overlap
      startIndex = actualEndIndex - this.chunkOverlap;
      if (startIndex < 0) startIndex = 0;
    }

    return chunks;
  }

  /**
   * Processa um documento completo: lê, chunking e retorna chunks
   * @param filePath - Caminho do arquivo
   * @returns Array de chunks processados
   */
  async processDocument(filePath: string): Promise<Chunk[]> {
    const content = await this.readFileContent(filePath);
    return this.chunkText(content);
  }
}

