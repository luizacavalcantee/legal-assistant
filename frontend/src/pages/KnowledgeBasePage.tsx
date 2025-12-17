import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import {
  Document,
  CreateDocumentDto,
  UpdateDocumentDto,
  StatusIndexacao,
} from "../types/document.types";
import { documentService } from "../services/api";
import { DocumentTable } from "../components/DocumentTable";
import { DocumentForm } from "../components/DocumentForm";
import { Button } from "../components/ui/button";
import { Plus } from "lucide-react";

export function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  // Carregar documentos (sem mostrar loading se já tiver documentos)
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

  // Carregar documentos iniciais
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Polling automático quando há documentos pendentes
  useEffect(() => {
    // Verificar se há documentos pendentes
    const hasPending = documents.some(
      (doc) => doc.status_indexacao === StatusIndexacao.PENDENTE
    );

    if (hasPending) {
      // Iniciar polling a cada 3 segundos
      if (!pollingIntervalRef.current) {
        pollingIntervalRef.current = setInterval(() => {
          loadDocuments(false); // Não mostrar loading durante polling
        }, 3000);
      }
    } else {
      // Parar polling se não houver documentos pendentes
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    // Limpar polling ao desmontar componente ou quando documents mudar
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [documents, loadDocuments]);

  // Criar novo documento
  const handleCreate = async (
    data: CreateDocumentDto | UpdateDocumentDto,
    file?: File
  ) => {
    try {
      await documentService.create(data as CreateDocumentDto, file);
      toast.success("Documento criado com sucesso! Aguardando indexação...");
      setShowForm(false);
      await loadDocuments();
      // O polling será iniciado automaticamente pelo useEffect se houver documentos pendentes
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao criar documento");
      throw err;
    }
  };

  // Atualizar documento
  const handleUpdate = async (data: CreateDocumentDto | UpdateDocumentDto) => {
    if (!editingDocument) return;

    try {
      await documentService.update(
        editingDocument.id,
        data as UpdateDocumentDto
      );
      toast.success("Documento atualizado com sucesso!");
      setShowForm(false);
      setEditingDocument(null);
      await loadDocuments();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao atualizar documento");
      throw err;
    }
  };

  // Remover documento
  const handleDelete = async (id: string) => {
    try {
      await documentService.delete(id);
      toast.success("Documento removido com sucesso!");
      await loadDocuments();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao remover documento");
    }
  };

  // Editar documento
  const handleEdit = (document: Document) => {
    setEditingDocument(document);
    setShowForm(true);
  };

  // Visualizar/Abrir documento
  const handleView = (id: string) => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const fileUrl = `${apiUrl}/documents/${id}/file`;
    // Abrir em nova aba
    window.open(fileUrl, "_blank");
  };

  // Cancelar formulário
  const handleCancelForm = () => {
    setShowForm(false);
    setEditingDocument(null);
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
              Gerencie os metadados dos documentos cadastrados
            </p>
          </div>
          <div className="flex gap-2">
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
            onDelete={handleDelete}
            onEdit={handleEdit}
            onView={handleView}
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
