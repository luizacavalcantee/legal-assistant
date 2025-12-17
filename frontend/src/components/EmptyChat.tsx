import { Bot } from "lucide-react";

export function EmptyChat() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <Bot className="h-16 w-16 text-muted-foreground mb-4" strokeWidth={1.5} />
      <h3 className="text-lg font-semibold text-muted-foreground mb-2">
        Olá! Sou seu Assistente Jurídico
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">
        Faça uma pergunta sobre questões jurídicas e eu te ajudarei com
        informações precisas e úteis.
      </p>
    </div>
  );
}
