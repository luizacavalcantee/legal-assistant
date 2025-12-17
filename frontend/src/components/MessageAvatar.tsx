import { Bot, User, AlertCircle, Loader2 } from "lucide-react";
import { ChatMessage } from "../types/chat.types";

interface MessageAvatarProps {
  role: ChatMessage["role"];
  isError?: boolean;
  isStatus?: boolean;
}

export function MessageAvatar({ role, isError, isStatus }: MessageAvatarProps) {
  if (role === "user") {
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
        <User className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  const bgColor = isError
    ? "bg-destructive/10"
    : isStatus
    ? "bg-primary/10"
    : "bg-primary/10";

  const icon = isError ? (
    <AlertCircle className="h-5 w-5 text-destructive" />
  ) : isStatus ? (
    <Loader2 className="h-5 w-5 text-primary animate-spin" />
  ) : (
    <Bot className="h-5 w-5 text-primary" />
  );

  return (
    <div
      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${bgColor}`}
    >
      {icon}
    </div>
  );
}
