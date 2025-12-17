import { useState, useCallback } from "react";
import { toast } from "react-toastify";
import {
  Document,
  CreateDocumentDto,
  UpdateDocumentDto,
} from "../types/document.types";
import { documentService } from "../services/api";

/**
 * Hook customizado para gerenciar operações CRUD de documentos
 */
export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar documentos
  const loadDocuments = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const data = await documentService.getAll();
      setDocuments(data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao carregar documentos");
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  // Criar documento
  const createDocument = useCallback(
    async (data: CreateDocumentDto, file?: File) => {
      try {
        await documentService.create(data, file);
        toast.success("Documento criado com sucesso! Aguardando indexação...");
        await loadDocuments();
      } catch (err: any) {
        toast.error(err.response?.data?.error || "Erro ao criar documento");
        throw err;
      }
    },
    [loadDocuments]
  );

  // Atualizar documento
  const updateDocument = useCallback(
    async (id: string, data: UpdateDocumentDto) => {
      try {
        await documentService.update(id, data);
        toast.success("Documento atualizado com sucesso!");
        await loadDocuments();
      } catch (err: any) {
        toast.error(err.response?.data?.error || "Erro ao atualizar documento");
        throw err;
      }
    },
    [loadDocuments]
  );

  // Deletar documento
  const deleteDocument = useCallback(
    async (id: string) => {
      try {
        await documentService.delete(id);
        toast.success("Documento removido com sucesso!");
        await loadDocuments();
      } catch (err: any) {
        toast.error(err.response?.data?.error || "Erro ao remover documento");
      }
    },
    [loadDocuments]
  );

  // Visualizar documento
  const viewDocument = useCallback((id: string) => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const fileUrl = `${apiUrl}/documents/${id}/file`;
    window.open(fileUrl, "_blank");
  }, []);

  return {
    documents,
    isLoading,
    loadDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    viewDocument,
  };
}
