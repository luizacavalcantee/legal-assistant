import { Bot, Loader2 } from "lucide-react";

export function LoadingMessage() {
  return (
    <div className="flex gap-3 justify-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Bot className="h-5 w-5 text-primary" />
      </div>
      <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Pensando...</span>
      </div>
    </div>
  );
}
