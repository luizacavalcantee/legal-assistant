import { useState } from "react";
import { Document } from "../types/document.types";

/**
 * Hook customizado para gerenciar estado do formulário de documento
 */
export function useDocumentForm() {
  const [showForm, setShowForm] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);

  // Abrir formulário para criar novo documento
  const openCreateForm = () => {
    setEditingDocument(null);
    setShowForm(true);
  };

  // Abrir formulário para editar documento
  const openEditForm = (document: Document) => {
    setEditingDocument(document);
    setShowForm(true);
  };

  // Fechar formulário
  const closeForm = () => {
    setShowForm(false);
    setEditingDocument(null);
  };

  return {
    showForm,
    editingDocument,
    openCreateForm,
    openEditForm,
    closeForm,
  };
}
