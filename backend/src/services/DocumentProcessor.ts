import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { GoogleDriveService } from "./GoogleDriveService";

// pdf-parse versão 2.4.5 exporta PDFParse como classe
const pdfParseModule = require("pdf-parse");
const PDFParse = pdfParseModule.PDFParse;

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
  private googleDriveService: GoogleDriveService;

  constructor() {
    // Tamanho do chunk em caracteres (padrão: 1000)
    this.chunkSize = parseInt(process.env.CHUNK_SIZE || "1000");
    // Overlap entre chunks (padrão: 200 caracteres)
    this.chunkOverlap = parseInt(process.env.CHUNK_OVERLAP || "200");
    this.googleDriveService = new GoogleDriveService();
  }

  /**
   * Lê o conteúdo de um arquivo baseado no caminho
   * Suporta arquivos locais e arquivos do Google Drive (formato: gdrive:FILE_ID)
   * @param filePath - Caminho do arquivo ou ID do Google Drive (gdrive:FILE_ID)
   * @returns Conteúdo do arquivo como string
   */
  async readFileContent(filePath: string): Promise<string> {
    try {
      // Verificar se é um arquivo do Google Drive
      if (filePath.startsWith("gdrive:")) {
        const fileId = filePath.replace("gdrive:", "");
        console.log(`📁 Lendo arquivo do Google Drive: ${fileId}`);
        
        if (!this.googleDriveService.isConfigured()) {
          throw new Error("Google Drive não está configurado");
        }

        const content = await this.googleDriveService.getFileContent(fileId);
        if (!content) {
          throw new Error(`Não foi possível ler conteúdo do arquivo ${fileId} do Google Drive`);
        }

        console.log(`✅ Conteúdo lido do Google Drive: ${(content.length / 1024).toFixed(2)}KB`);
        return content;
      }

      // Arquivo local - processar normalmente
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
   * Processa página por página para economizar memória
   */
  private async readPDF(filePath: string): Promise<string> {
    let parser: any = null;
    try {
      const dataBuffer = fs.readFileSync(filePath);
      
      // Verificar tamanho do arquivo (limite reduzido para 30MB)
      const fileSizeMB = dataBuffer.length / (1024 * 1024);
      if (fileSizeMB > 30) {
        throw new Error(`PDF muito grande (${fileSizeMB.toFixed(2)}MB). Limite: 30MB. Considere dividir o documento em partes menores.`);
      }

      console.log(`📄 Processando PDF de ${fileSizeMB.toFixed(2)}MB...`);

      // PDFParse é uma classe, precisa ser instanciada
      parser = new PDFParse({ 
        data: dataBuffer,
        verbosity: 0 // Reduzir verbosidade para economizar memória
      });
      
      // Carregar documento primeiro para obter número de páginas
      await parser.load();
      const totalPages = parser.doc.numPages;
      console.log(`📄 PDF tem ${totalPages} páginas. Processando página por página...`);
      
      // Processar página por página para economizar memória
      const textParts: string[] = [];
      const pagesPerBatch = 5; // Processar 5 páginas por vez
      
      for (let startPage = 1; startPage <= totalPages; startPage += pagesPerBatch) {
        const endPage = Math.min(startPage + pagesPerBatch - 1, totalPages);
        
        console.log(`📄 Processando páginas ${startPage}-${endPage} de ${totalPages}...`);
        
        // Processar lote de páginas
        const result = await parser.getText({
          first: startPage,
          last: endPage,
          parseHyperlinks: false,
          parsePageInfo: false,
          pageJoiner: "\n"
        });
        
        textParts.push(result.text);
        
        // Limpar memória entre lotes
        if (global.gc && startPage % 10 === 0) {
          global.gc();
        }
      }
      
      const fullText = textParts.join("\n\n");
      
      // Limpar parser
      if (parser && typeof parser.destroy === 'function') {
        try {
          await parser.destroy();
        } catch (e) {
          // Ignorar erros na limpeza
        }
      }
      parser = null;
      
      // Limpar arrays intermediários
      textParts.length = 0;
      
      // Forçar garbage collection final
      if (global.gc) {
        global.gc();
      }
      
      console.log(`✅ PDF processado com sucesso. Texto extraído: ${(fullText.length / 1024).toFixed(2)}KB`);
      
      return fullText;
    } catch (error: any) {
      // Garantir limpeza mesmo em caso de erro
      if (parser && typeof parser.destroy === 'function') {
        try {
          await parser.destroy();
        } catch (e) {
          // Ignorar erros na limpeza
        }
      }
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
    try {
      console.log(`   🔧 Iniciando chunking do texto (${(text.length / 1024).toFixed(2)}KB)...`);
      const chunks: Chunk[] = [];
      let startIndex = 0;
      let chunkIndex = 0;

      // Limpar e normalizar texto
      console.log(`   🧹 Limpando e normalizando texto...`);
      const cleanText = text
        .replace(/\s+/g, " ")
        .trim();
      console.log(`   ✅ Texto limpo: ${(cleanText.length / 1024).toFixed(2)}KB`);

      console.log(`   ✂️  Dividindo em chunks de ${this.chunkSize} caracteres...`);
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

      // Só adicionar chunk se tiver conteúdo e se avançou do índice anterior
      if (chunkText.length > 0 && actualEndIndex > startIndex) {
        chunks.push({
          text: chunkText,
          index: chunkIndex,
          startChar: startIndex,
          endChar: actualEndIndex,
        });
        chunkIndex++;
      }

      // Avançar com overlap - SEMPRE garantir que avança
      const previousStart = startIndex;
      
      // Calcular próximo índice com overlap
      let nextStart = actualEndIndex - this.chunkOverlap;
      
      // Se o próximo índice não avançou (ou voltou), avançar pelo menos metade do chunk
      if (nextStart <= previousStart) {
        nextStart = previousStart + Math.max(1, Math.floor(this.chunkSize / 2));
      }
      
      startIndex = nextStart;
      
      // Proteção: se não avançou nada, forçar avanço mínimo
      if (startIndex <= previousStart) {
        startIndex = actualEndIndex;
      }
      
      // Proteção adicional: garantir que não ultrapasse o tamanho do texto
      if (startIndex >= cleanText.length) {
        break;
      }
      
      // Log de progresso a cada 50 chunks
      if (chunkIndex % 50 === 0 && chunkIndex > 0) {
        console.log(`   📊 Progresso: ${chunkIndex} chunks criados...`);
      }
      
      // Proteção contra loop infinito: se criar mais de 10000 chunks, parar
      if (chunkIndex > 10000) {
        console.warn(`   ⚠️  Limite de 10000 chunks atingido. Parando chunking.`);
        break;
      }
      
      // Proteção adicional: se o startIndex não mudou após 2 iterações, forçar avanço
      if (chunks.length >= 2 && 
          chunks[chunks.length - 1].startChar === chunks[chunks.length - 2].startChar) {
        startIndex = chunks[chunks.length - 1].endChar + 1;
        if (startIndex >= cleanText.length) {
          break;
        }
      }
    }

    console.log(`   ✅ Chunking concluído: ${chunks.length} chunks criados`);
    return chunks;
    } catch (error: any) {
      console.error(`   ❌ Erro no chunking: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      throw error;
    }
  }

  /**
   * Processa um documento completo: lê, chunking e retorna chunks
   * @param filePath - Caminho do arquivo
   * @returns Array de chunks processados
   */
  async processDocument(filePath: string): Promise<Chunk[]> {
    try {
      console.log(`   📖 Lendo conteúdo do arquivo...`);
      const content = await this.readFileContent(filePath);
      console.log(`   ✅ Conteúdo lido: ${(content.length / 1024).toFixed(2)}KB`);
      console.log(`   ✂️  Dividindo em chunks...`);
      const chunks = this.chunkText(content);
      console.log(`   ✅ ${chunks.length} chunks gerados`);
      return chunks;
    } catch (error: any) {
      console.error(`   ❌ Erro ao processar documento: ${error.message}`);
      throw error;
    }
  }
}

