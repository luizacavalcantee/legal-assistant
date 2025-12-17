import { ChatMessage } from "../types/chat.types";
import { MessageItem } from "./MessageItem";
import { EmptyChat } from "./EmptyChat";
import { LoadingMessage } from "./LoadingMessage";
import { isStatusMessage } from "../utils/messageUtils";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const hasStatusMessage = messages.some((msg) => isStatusMessage(msg));
  const shouldShowLoadingMessage = isLoading && !hasStatusMessage;

  if (messages.length === 0 && !isLoading) {
    return <EmptyChat />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
      {shouldShowLoadingMessage && <LoadingMessage />}
    </div>
  );
}
