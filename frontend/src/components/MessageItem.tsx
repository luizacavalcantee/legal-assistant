import { ChatMessage } from "../types/chat.types";
import { MessageAvatar } from "./MessageAvatar";
import { MessageContent } from "./MessageContent";
import { MessageSources } from "./MessageSources";
import {
  formatMessageTime,
  getStatusMessage,
  isStatusMessage,
  isErrorMessage,
} from "../utils/messageUtils";

interface MessageItemProps {
  message: ChatMessage;
}

export function MessageItem({ message }: MessageItemProps) {
  const isStatus = isStatusMessage(message);
  const isError = isErrorMessage(message);
  const isUser = message.role === "user";

  const bubbleClasses = isUser
    ? "bg-primary text-primary-foreground"
    : isError
    ? "bg-destructive/10 border border-destructive/20 text-destructive"
    : isStatus
    ? "bg-muted/50 text-muted-foreground border border-muted"
    : "bg-muted text-foreground";

  const timestampClasses = isUser
    ? "text-primary-foreground/70"
    : isError
    ? "text-destructive/70"
    : "text-muted-foreground";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <MessageAvatar role="assistant" isError={isError} isStatus={isStatus} />
      )}

      <div className={`max-w-[80%] rounded-lg px-4 py-2 ${bubbleClasses}`}>
        {isStatus ? (
          <p
            className={`text-sm whitespace-pre-wrap break-words ${
              isError ? "text-destructive" : ""
            }`}
          >
            {getStatusMessage(message.status)}
          </p>
        ) : (
          <MessageContent content={message.content} isError={isError} />
        )}

        <MessageSources sources={message.sources} />

        <span className={`text-xs mt-1 block ${timestampClasses}`}>
          {formatMessageTime(message.timestamp)}
        </span>
      </div>

      {isUser && <MessageAvatar role="user" />}
    </div>
  );
}
