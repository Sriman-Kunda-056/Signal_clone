import { Check, CheckCheck } from "lucide-react";

import { messageTimestamp, senderNameColor } from "@/lib/format";
import { aggregateStatus } from "@/lib/messageStatus";
import type { Conversation, Message } from "@/lib/types";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSender: boolean;
  conversation: Conversation;
}

export function MessageBubble({ message, isOwn, showSender, conversation }: MessageBubbleProps) {
  const status = isOwn ? aggregateStatus(message) : null;
  const metaColor = isOwn ? "var(--color-bubble-own-meta)" : "var(--color-bubble-other-meta)";

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[min(65%,32rem)] px-3 py-1.5 text-[14.5px] leading-snug"
        style={{
          background: isOwn ? "var(--color-bubble-own)" : "var(--color-bubble-other)",
          color: isOwn ? "var(--color-bubble-own-text)" : "var(--color-bubble-other-text)",
          borderRadius: 18,
        }}
      >
        {showSender && !isOwn && conversation.type === "group" && (
          <p className="mb-0.5 text-[13px] font-semibold" style={{ color: senderNameColor(message.sender_id) }}>
            {message.sender.display_name}
          </p>
        )}
        {/*
          Signal tucks the timestamp inside the bubble, trailing the text.
          `ml-auto` on the meta keeps it flush right whichever line it lands
          on: short messages share one line with a gap, long messages wrap
          and the meta drops to its own right-aligned line.
        */}
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="break-words whitespace-pre-wrap">{message.content}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1 pt-0.5">
            <span className="text-[11px]" style={{ color: metaColor }}>
              {messageTimestamp(message.created_at)}
            </span>
            {status === "read" && <CheckCheck className="h-3.5 w-3.5" style={{ color: metaColor }} />}
            {status === "delivered" && <CheckCheck className="h-3.5 w-3.5" style={{ color: metaColor }} />}
            {status === "sent" && <Check className="h-3.5 w-3.5" style={{ color: metaColor }} />}
          </span>
        </div>
      </div>
    </div>
  );
}
