/**
 * Mapeamento centralizado de erros
 */
export function getErrorMessage(err: any): {
  errorContent: string;
  errorDetails: string;
} {
  let errorContent = "Desculpe, ocorreu um erro ao processar sua mensagem.";
  let errorDetails = "";

  if (err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
    errorContent = "Não foi possível conectar ao servidor.";
    errorDetails = "Verifique sua conexão com a internet e tente novamente.";
  } else if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
    errorContent = "⏳ Tempo de espera esgotado";
    errorDetails =
      "A operação está demorando mais que o esperado. Isso pode acontecer com buscas no e-SAJ. Por favor, tente novamente.";
  } else if (err.response?.status === 500) {
    errorContent = "⚠️ Erro no servidor";
    errorDetails =
      err.response?.data?.error ||
      err.response?.data?.message ||
      "O servidor encontrou um erro ao processar sua solicitação. Tente novamente em alguns instantes.";
  } else if (err.response?.status === 404) {
    errorContent = "🔍 Recurso não encontrado";
    errorDetails =
      "O endpoint solicitado não foi encontrado. Isso pode indicar um problema de configuração.";
  } else if (err.response?.status === 403) {
    errorContent = "🔒 Acesso negado";
    errorDetails = "Você não tem permissão para realizar esta operação.";
  } else if (err.response?.data?.error) {
    errorContent = "❌ Erro";
    errorDetails = err.response.data.error;
  } else if (err.response?.data?.message) {
    errorContent = "❌ Erro";
    errorDetails = err.response.data.message;
  } else if (err.message) {
    errorContent = "❌ Erro";
    errorDetails = err.message;
  } else {
    errorDetails =
      "Por favor, tente novamente. Se o problema persistir, entre em contato com o suporte.";
  }

  return { errorContent, errorDetails };
}
