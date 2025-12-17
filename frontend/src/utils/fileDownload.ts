import { toast } from "react-toastify";
import api from "../services/api";

/**
 * Detecta e extrai link de download da resposta
 */
export function extractDownloadLink(text: string): string | null {
  // Procurar por URL completa
  const downloadPattern = /https?:\/\/[^\s\n]+\/download\/file\/([^\s\n\)]+)/;
  const match = text.match(downloadPattern);
  if (match) {
    return match[0];
  }

  // Procurar por URL relativa
  const relativePattern = /\/download\/file\/([^\s\n\)]+)/;
  const relativeMatch = text.match(relativePattern);
  if (relativeMatch) {
    const apiUrl =
      import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";
    return `${apiUrl}${relativeMatch[0]}`;
  }

  return null;
}

/**
 * Faz download automático do arquivo
 */
export async function downloadFile(
  url: string,
  fileName: string
): Promise<void> {
  try {
    console.log("📥 Iniciando download:", url);

    let fullUrl = url;
    if (url.startsWith("/")) {
      const apiUrl =
        import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
        "http://localhost:3000";
      fullUrl = `${apiUrl}${url}`;
    }

    // Garantir HTTPS se necessário
    if (
      window.location.protocol === "https:" &&
      fullUrl.startsWith("http://")
    ) {
      fullUrl = fullUrl.replace("http://", "https://");
    }

    // Tentar download com axios
    const response = await api.get(fullUrl, {
      responseType: "blob",
    });

    const blob = response.data;
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    }, 200);

    console.log("✅ Download concluído:", fileName);
  } catch (error: any) {
    console.error("❌ Erro ao fazer download:", error);

    // Fallback com fetch
    try {
      let fullUrl = url;
      if (url.startsWith("/")) {
        const apiUrl =
          import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
          "http://localhost:3000";
        fullUrl = `${apiUrl}${url}`;
      }

      if (
        window.location.protocol === "https:" &&
        fullUrl.startsWith("http://")
      ) {
        fullUrl = fullUrl.replace("http://", "https://");
      }

      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Erro ao baixar arquivo: ${response.statusText}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      }, 200);

      console.log("✅ Download concluído via fallback:", fileName);
    } catch (fallbackError: any) {
      console.error("❌ Erro no fallback:", fallbackError);
      toast.error(
        `Erro ao baixar arquivo: ${
          fallbackError.message || "Não foi possível baixar o arquivo."
        }`
      );
    }
  }
}

/**
 * Limpa mensagem de download removendo link
 */
export function cleanDownloadMessage(text: string): string {
  const fileNameMatch = text.match(/📋 Nome do arquivo: ([^\n]+)/);
  const fileName = fileNameMatch ? fileNameMatch[1] : null;

  if (fileName) {
    return `✅ Documento baixado com sucesso!\n\n📋 Nome do arquivo: ${fileName}`;
  }

  const successMatch = text.match(/✅[^\n]+/);
  return successMatch ? successMatch[0] : text;
}
