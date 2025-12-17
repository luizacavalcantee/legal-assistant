import { FileText } from "lucide-react";
import { ChatMessage } from "../types/chat.types";

interface MessageSourcesProps {
  sources: ChatMessage["sources"];
}

export function MessageSources({ sources }: MessageSourcesProps) {
  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Fontes usadas:
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {sources.map((source, index) => (
          <span
            key={`${source.document_id}-${source.chunk_index}`}
            className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-md"
            title={`Score: ${source.score.toFixed(2)}`}
          >
            {source.titulo || `Documento ${index + 1}`}
          </span>
        ))}
      </div>
    </div>
  );
}
