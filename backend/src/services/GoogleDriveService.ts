import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import { Readable } from "stream";

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
}

export class GoogleDriveService {
  private drive: any;
  private folderId: string | null;

  constructor() {
    // Credenciais do Google Drive (Service Account ou OAuth2)
    const credentials = this.getCredentials();

    if (!credentials) {
      console.warn(
        "⚠️  Google Drive não configurado. Usando armazenamento local."
      );
      return;
    }

    // Configurar autenticação
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    this.drive = google.drive({ version: "v3", auth });
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
  }

  private getCredentials(): any {
    // Tentar usar Service Account (recomendado para produção)
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      try {
        return JSON.parse(serviceAccountKey);
      } catch (error) {
        console.error("❌ Erro ao parsear GOOGLE_SERVICE_ACCOUNT_KEY:", error);
        return null;
      }
    }

    // Fallback: tentar ler de arquivo (desenvolvimento local)
    const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      try {
        const content = fs.readFileSync(serviceAccountPath, "utf8");
        return JSON.parse(content);
      } catch (error) {
        console.error("❌ Erro ao ler arquivo de credenciais:", error);
        return null;
      }
    }

    return null;
  }

  /**
   * Criar ou obter pasta no Google Drive
   */
  private async getOrCreateFolder(
    folderName: string = "Assistente Juridico"
  ): Promise<string | null> {
    if (this.folderId) {
      return this.folderId;
    }

    if (!this.drive) {
      return null;
    }

    try {
      // Procurar pasta existente
      const response = await this.drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
        fields: "files(id, name)",
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      // Criar nova pasta
      const folderResponse = await this.drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
        },
        fields: "id",
      });

      return folderResponse.data.id || null;
    } catch (error: any) {
      console.error(
        "❌ Erro ao criar/obter pasta no Google Drive:",
        error.message
      );
      return null;
    }
  }

  /**
   * Upload de arquivo para o Google Drive
   */
  async uploadFile(
    filePath: string,
    fileName?: string
  ): Promise<{
    fileId: string;
    webViewLink: string;
    webContentLink: string;
  } | null> {
    if (!this.drive) {
      console.warn("⚠️  Google Drive não disponível. Retornando null.");
      return null;
    }

    try {
      const finalFileName = fileName || path.basename(filePath);
      const folderId = await this.getOrCreateFolder();

      // Ler arquivo
      const fileContent = fs.readFileSync(filePath);
      const mimeType = this.getMimeType(filePath);

      // Upload para Google Drive
      const fileMetadata: any = {
        name: finalFileName,
      };

      if (folderId) {
        fileMetadata.parents = [folderId];
      }

      const media = {
        mimeType: mimeType,
        body: Readable.from(fileContent),
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, name, webViewLink, webContentLink",
      });

      // Tornar arquivo público para visualização (opcional)
      if (response.data.id) {
        await this.drive.permissions.create({
          fileId: response.data.id,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
        });
      }

      return {
        fileId: response.data.id!,
        webViewLink: response.data.webViewLink || "",
        webContentLink: response.data.webContentLink || "",
      };
    } catch (error: any) {
      console.error(
        "❌ Erro ao fazer upload para Google Drive:",
        error.message
      );
      throw error;
    }
  }

  /**
   * Upload de arquivo a partir de buffer
   */
  async uploadFileFromBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<{
    fileId: string;
    webViewLink: string;
    webContentLink: string;
  } | null> {
    if (!this.drive) {
      console.warn("⚠️  Google Drive não disponível. Retornando null.");
      return null;
    }

    try {
      const folderId = await this.getOrCreateFolder();

      const fileMetadata: any = {
        name: fileName,
      };

      if (folderId) {
        fileMetadata.parents = [folderId];
      }

      const media = {
        mimeType: mimeType,
        body: Readable.from(buffer),
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, name, webViewLink, webContentLink",
      });

      // Tornar arquivo público para visualização
      if (response.data.id) {
        await this.drive.permissions.create({
          fileId: response.data.id,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
        });
      }

      return {
        fileId: response.data.id!,
        webViewLink: response.data.webViewLink || "",
        webContentLink: response.data.webContentLink || "",
      };
    } catch (error: any) {
      console.error(
        "❌ Erro ao fazer upload para Google Drive:",
        error.message
      );
      throw error;
    }
  }

  /**
   * Download de arquivo do Google Drive
   */
  async downloadFile(fileId: string): Promise<Buffer | null> {
    if (!this.drive) {
      console.warn("⚠️  Google Drive não disponível. Retornando null.");
      return null;
    }

    try {
      const response = await this.drive.files.get(
        {
          fileId: fileId,
          alt: "media",
        },
        { responseType: "arraybuffer" }
      );

      return Buffer.from(response.data);
    } catch (error: any) {
      console.error(
        "❌ Erro ao fazer download do Google Drive:",
        error.message
      );
      return null;
    }
  }

  /**
   * Obter conteúdo de arquivo do Google Drive como string (para RAG)
   * Suporta PDF e arquivos de texto
   */
  async getFileContent(fileId: string): Promise<string | null> {
    if (!this.drive) {
      console.warn("⚠️  Google Drive não disponível. Retornando null.");
      return null;
    }

    try {
      // Primeiro, obter metadados do arquivo para determinar o tipo
      const fileMetadata = await this.drive.files.get({
        fileId: fileId,
        fields: "mimeType, name",
      });

      const mimeType = fileMetadata.data.mimeType || "";
      const fileName = fileMetadata.data.name || "";

      // Baixar arquivo
      const fileBuffer = await this.downloadFile(fileId);
      if (!fileBuffer) {
        return null;
      }

      // Processar baseado no tipo MIME
      if (
        mimeType === "application/pdf" ||
        fileName.toLowerCase().endsWith(".pdf")
      ) {
        // Processar PDF usando pdf-parse
        const pdfParseModule = require("pdf-parse");
        const PDFParse = pdfParseModule.PDFParse;

        const parser = new PDFParse({
          data: fileBuffer,
          verbosity: 0,
        });

        await parser.load();
        const totalPages = parser.doc.numPages;

        const textParts: string[] = [];
        const pagesPerBatch = 5;

        for (
          let startPage = 1;
          startPage <= totalPages;
          startPage += pagesPerBatch
        ) {
          const endPage = Math.min(startPage + pagesPerBatch - 1, totalPages);
          const result = await parser.getText({
            first: startPage,
            last: endPage,
            parseHyperlinks: false,
            parsePageInfo: false,
            pageJoiner: "\n",
          });
          textParts.push(result.text);
        }

        const fullText = textParts.join("\n\n");

        if (parser && typeof parser.destroy === "function") {
          try {
            await parser.destroy();
          } catch (e) {
            // Ignorar erros
          }
        }

        return fullText;
      } else if (
        mimeType === "text/plain" ||
        mimeType === "text/markdown" ||
        fileName.toLowerCase().endsWith(".txt") ||
        fileName.toLowerCase().endsWith(".md")
      ) {
        // Arquivo de texto
        return fileBuffer.toString("utf-8");
      } else {
        console.warn(
          `⚠️  Tipo de arquivo não suportado para extração de texto: ${mimeType}`
        );
        return null;
      }
    } catch (error: any) {
      console.error(
        "❌ Erro ao obter conteúdo do arquivo do Google Drive:",
        error.message
      );
      return null;
    }
  }

  /**
   * Obter link de visualização do arquivo
   */
  async getFileViewLink(fileId: string): Promise<string | null> {
    if (!this.drive) {
      return null;
    }

    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: "webViewLink, webContentLink",
      });

      return response.data.webViewLink || response.data.webContentLink || null;
    } catch (error: any) {
      console.error("❌ Erro ao obter link do arquivo:", error.message);
      return null;
    }
  }

  /**
   * Deletar arquivo do Google Drive
   */
  async deleteFile(fileId: string): Promise<boolean> {
    if (!this.drive) {
      return false;
    }

    try {
      await this.drive.files.delete({
        fileId: fileId,
      });
      return true;
    } catch (error: any) {
      console.error(
        "❌ Erro ao deletar arquivo do Google Drive:",
        error.message
      );
      return false;
    }
  }

  /**
   * Obter tipo MIME baseado na extensão
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      ".pdf": "application/pdf",
      ".txt": "text/plain",
      ".md": "text/markdown",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }

  /**
   * Verificar se o Google Drive está configurado
   */
  isConfigured(): boolean {
    return this.drive !== undefined && this.drive !== null;
  }
}
