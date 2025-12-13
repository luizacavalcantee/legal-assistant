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
import { Upload } from "lucide-react";

interface DocumentFormProps {
  onSubmit: (data: CreateDocumentDto | UpdateDocumentDto, file?: File) => Promise<void>;
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validação: título obrigatório
    if (!formData.titulo.trim()) {
      setError("Título é obrigatório");
      return;
    }

    // Validação: arquivo obrigatório ao criar (não ao editar)
    if (!isEdit && !selectedFile && !formData.caminho_arquivo.trim()) {
      setError("É necessário enviar um arquivo ou fornecer um caminho");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData, selectedFile || undefined);
      // Reset form if not editing
      if (!isEdit) {
        setFormData({
          titulo: "",
          caminho_arquivo: "",
          status_indexacao: StatusIndexacao.PENDENTE,
        });
        setSelectedFile(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Erro ao salvar documento");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Atualizar caminho_arquivo com o nome do arquivo (opcional)
      if (!isEdit) {
        setFormData({ ...formData, caminho_arquivo: file.name });
      }
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

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="arquivo">Arquivo *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="arquivo"
                  type="file"
                  accept=".pdf,.txt,.md,.docx"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                  className="cursor-pointer"
                />
                {selectedFile && (
                  <span className="text-sm text-muted-foreground">
                    {selectedFile.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Formatos permitidos: PDF, TXT, MD, DOCX (máx. 10MB)
              </p>
            </div>
          )}

          {isEdit && (
            <div className="space-y-2">
              <Label htmlFor="caminho_arquivo">Caminho do Arquivo</Label>
              <Input
                id="caminho_arquivo"
                value={formData.caminho_arquivo}
                onChange={(e) =>
                  setFormData({ ...formData, caminho_arquivo: e.target.value })
                }
                placeholder="Ex: /documentos/lei-13105-2015.pdf"
                disabled={isSubmitting}
              />
            </div>
          )}

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
