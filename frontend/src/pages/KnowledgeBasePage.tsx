import { useState, useEffect } from "react";
import { Document, CreateDocumentDto, UpdateDocumentDto } from "../types/document.types";
import { documentService } from "../services/api";
import { DocumentTable } from "../components/DocumentTable";
import { DocumentForm } from "../components/DocumentForm";
import { Button } from "../components/ui/button";
import { Plus, CheckCircle2, AlertCircle, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function KnowledgeBasePage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Carregar documentos
  const loadDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await documentService.getAll();
      setDocuments(data);
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Erro ao carregar documentos"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // Criar novo documento
  const handleCreate = async (data: CreateDocumentDto) => {
    try {
      await documentService.create(data);
      setSuccessMessage("Documento criado com sucesso!");
      setShowForm(false);
      await loadDocuments();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      throw err;
    }
  };

  // Atualizar documento
  const handleUpdate = async (data: UpdateDocumentDto) => {
    if (!editingDocument) return;

    try {
      await documentService.update(editingDocument.id, data);
      setSuccessMessage("Documento atualizado com sucesso!");
      setShowForm(false);
      setEditingDocument(null);
      await loadDocuments();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      throw err;
    }
  };

  // Remover documento
  const handleDelete = async (id: string) => {
    try {
      await documentService.delete(id);
      setSuccessMessage("Documento removido com sucesso!");
      await loadDocuments();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Erro ao remover documento");
      setTimeout(() => setError(null), 5000);
    }
  };

  // Editar documento
  const handleEdit = (document: Document) => {
    setEditingDocument(document);
    setShowForm(true);
  };

  // Cancelar formulário
  const handleCancelForm = () => {
    setShowForm(false);
    setEditingDocument(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestão da Base de Conhecimento</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os metadados dos documentos cadastrados
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/chat")}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat
            </Button>
            <Button
              onClick={() => {
                setEditingDocument(null);
                setShowForm(true);
              }}
              disabled={showForm}
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo Documento
            </Button>
          </div>
        </header>

        {successMessage && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 flex items-center gap-2 text-green-800">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Documentos Cadastrados</h2>
            <span className="text-sm text-muted-foreground">
              {documents.length} {documents.length === 1 ? "documento" : "documentos"}
            </span>
          </div>

          <DocumentTable
            documents={documents}
            onDelete={handleDelete}
            onEdit={handleEdit}
            isLoading={isLoading}
          />
        </div>

        <DocumentForm
          onSubmit={editingDocument ? handleUpdate : handleCreate}
          onCancel={handleCancelForm}
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
