import { useState, FormEvent } from "react";
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  StatusIndexacao,
} from "../types/document.types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface DocumentFormProps {
  onSubmit: (data: CreateDocumentDto | UpdateDocumentDto) => Promise<void>;
  onCancel: () => void;
  initialData?: {
    titulo: string;
    caminho_arquivo: string;
    status_indexacao?: StatusIndexacao;
  };
  isEdit?: boolean;
  open: boolean;
}

export function DocumentForm({
  onSubmit,
  onCancel,
  initialData,
  isEdit = false,
  open,
}: DocumentFormProps) {
  const [formData, setFormData] = useState({
    titulo: initialData?.titulo || "",
    caminho_arquivo: initialData?.caminho_arquivo || "",
    status_indexacao: initialData?.status_indexacao || StatusIndexacao.PENDENTE,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.titulo.trim() || !formData.caminho_arquivo.trim()) {
      setError("Título e caminho do arquivo são obrigatórios");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // Reset form if not editing
      if (!isEdit) {
        setFormData({
          titulo: "",
          caminho_arquivo: "",
          status_indexacao: StatusIndexacao.PENDENTE,
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Erro ao salvar documento");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Documento" : "Novo Documento"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize as informações do documento."
              : "Preencha os dados para criar um novo documento."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) =>
                setFormData({ ...formData, titulo: e.target.value })
              }
              placeholder="Ex: Lei 13.105/2015"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="caminho_arquivo">Caminho do Arquivo *</Label>
            <Input
              id="caminho_arquivo"
              value={formData.caminho_arquivo}
              onChange={(e) =>
                setFormData({ ...formData, caminho_arquivo: e.target.value })
              }
              placeholder="Ex: /documentos/lei-13105-2015.pdf"
              required
              disabled={isSubmitting}
            />
          </div>

          {isEdit && (
            <div className="space-y-2">
              <Label htmlFor="status_indexacao">Status de Indexação</Label>
              <Select
                value={formData.status_indexacao}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    status_indexacao: value as StatusIndexacao,
                  })
                }
                disabled={isSubmitting}
              >
                <SelectTrigger id="status_indexacao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={StatusIndexacao.PENDENTE}>
                    Pendente
                  </SelectItem>
                  <SelectItem value={StatusIndexacao.INDEXADO}>
                    Indexado
                  </SelectItem>
                  <SelectItem value={StatusIndexacao.ERRO}>Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : isEdit ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
