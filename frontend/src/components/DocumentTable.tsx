import { Document, StatusIndexacao } from "../types/document.types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Loader2, Edit, Trash2, FileText, Download } from "lucide-react";

interface DocumentTableProps {
  documents: Document[];
  onDelete: (id: string) => void;
  onEdit: (document: Document) => void;
  onView?: (id: string) => void;
  isLoading?: boolean;
}

export function DocumentTable({
  documents,
  onDelete,
  onEdit,
  onView,
  isLoading = false,
}: DocumentTableProps) {
  const getStatusBadge = (status: StatusIndexacao) => {
    switch (status) {
      case StatusIndexacao.INDEXADO:
        return <Badge variant="success">Indexado</Badge>;
      case StatusIndexacao.PENDENTE:
        return <Badge variant="warning">Pendente</Badge>;
      case StatusIndexacao.ERRO:
        return <Badge variant="error">Erro</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">
          Carregando documentos...
        </p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Nenhum documento cadastrado ainda.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Clique em "Novo Documento" para começar.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Caminho do Arquivo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell className="font-medium">{doc.titulo}</TableCell>
              <TableCell className="text-muted-foreground">
                {doc.caminho_arquivo}
              </TableCell>
              <TableCell>{getStatusBadge(doc.status_indexacao)}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(doc.criado_em)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {onView && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView(doc.id)}
                      title="Abrir documento"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(doc)}
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Tem certeza que deseja remover o documento "${doc.titulo}"?`
                        )
                      ) {
                        onDelete(doc.id);
                      }
                    }}
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
