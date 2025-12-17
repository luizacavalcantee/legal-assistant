import { useEffect } from "react";
import { CreateDocumentDto, UpdateDocumentDto } from "../types/document.types";
import { DocumentTable } from "../components/DocumentTable";
import { DocumentForm } from "../components/DocumentForm";
import { Button } from "../components/ui/button";
import { Plus } from "lucide-react";
import { useDocuments } from "../hooks/useDocuments";
import { useDocumentPolling } from "../hooks/useDocumentPolling";
import { useDocumentForm } from "../hooks/useDocumentForm";

export function KnowledgeBasePage() {
  // Hook para gerenciar documentos (CRUD)
  const {
    documents,
    isLoading,
    loadDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    viewDocument,
  } = useDocuments();

  // Hook para gerenciar formulário
  const { showForm, editingDocument, openCreateForm, openEditForm, closeForm } =
    useDocumentForm();

  // Hook para polling automático
  useDocumentPolling(documents, () => loadDocuments(false));

  // Carregar documentos ao montar
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Handler para criar/atualizar documento
  const handleSubmit = async (
    data: CreateDocumentDto | UpdateDocumentDto,
    file?: File
  ) => {
    if (editingDocument) {
      await updateDocument(editingDocument.id, data as UpdateDocumentDto);
    } else {
      await createDocument(data as CreateDocumentDto, file);
    }
    closeForm();
  };

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="container mx-auto px-4 py-8 max-w-7xl h-full">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-normal tracking-tight text-foreground">
              Gestão da Base de Conhecimento
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os documentos cadastrados que servirão de base de
              conhecimento para o chatbot.
            </p>
          </div>
          <Button onClick={openCreateForm} disabled={showForm}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Documento
          </Button>
        </header>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Documentos Cadastrados</h2>
            <span className="text-sm text-muted-foreground">
              {documents.length}{" "}
              {documents.length === 1 ? "documento" : "documentos"}
            </span>
          </div>

          <DocumentTable
            documents={documents}
            onDelete={deleteDocument}
            onEdit={openEditForm}
            onView={viewDocument}
            isLoading={isLoading}
          />
        </div>

        <DocumentForm
          onSubmit={handleSubmit}
          onCancel={closeForm}
          initialData={
            editingDocument
              ? {
                  titulo: editingDocument.titulo,
                  caminho_arquivo: editingDocument.caminho_arquivo,
                  status_indexacao: editingDocument.status_indexacao,
                }
              : undefined
          }
          isEdit={!!editingDocument}
          open={showForm}
        />
      </div>
    </div>
  );
}
