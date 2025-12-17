import { useEffect, useRef } from "react";
import { Document, StatusIndexacao } from "../types/document.types";

/**
 * Hook customizado para gerenciar polling automático de documentos pendentes
 */
export function useDocumentPolling(
  documents: Document[],
  onPoll: () => void,
  interval = 3000
) {
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  useEffect(() => {
    // Verificar se há documentos pendentes
    const hasPending = documents.some(
      (doc) => doc.status_indexacao === StatusIndexacao.PENDENTE
    );

    if (hasPending) {
      // Iniciar polling se não estiver ativo
      if (!pollingIntervalRef.current) {
        pollingIntervalRef.current = setInterval(() => {
          onPoll();
        }, interval);
      }
    } else {
      // Parar polling se não houver documentos pendentes
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    // Limpar polling ao desmontar
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [documents, onPoll, interval]);
}
