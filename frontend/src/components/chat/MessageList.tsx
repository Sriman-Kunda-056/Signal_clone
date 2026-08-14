"use client";

import { MessageSquare, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";

import { ConversationIntro } from "@/components/chat/ConversationIntro";
import { DateSeparator } from "@/components/chat/DateSeparator";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { SystemMessage } from "@/components/chat/SystemMessage";
import { otherParticipant } from "@/lib/conversation";
import type { Conversation, Message, User } from "@/lib/types";

interface MessageListProps {
  conversation: Conversation;
  messages: Message[];
  currentUser: User;
  loading: boolean;
  onOpenInfo: () => void;
  selectedIds: Set<number>;
  onSelectMessage: (id: number) => void;
  onReply: (message: Message) => void;
  onDelete: (id: number) => void;
  onPin: (id: number) => void;
}

export function MessageList({ conversation, messages, currentUser, loading, onOpenInfo, selectedIds, onSelectMessage, onReply, onDelete, onPin }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, conversation.id]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center" style={{ background: "var(--color-chat-bg)" }}>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Loading messages…
        </p>
      </div>
    );
  }

  const grouped = messages.map((message, idx) => {
    const prevMessage = messages[idx - 1];
    const day = new Date(message.created_at).toDateString();
    const prevDay = prevMessage ? new Date(prevMessage.created_at).toDateString() : null;
    const showDate = day !== prevDay;
    return {
      message,
      showDate,
      showSender: !prevMessage || prevMessage.sender_id !== message.sender_id || showDate,
    };
  });

  const other = otherParticipant(conversation, currentUser.id);
  const otherName = other?.user.display_name ?? "this person";
  const iStartedIt = conversation.created_by === currentUser.id;
  const isDirect = conversation.type === "direct";
  const isPending = conversation.my_status === "pending";

  return (
    <div className="flex-1 overflow-y-auto pb-3" style={{ background: "var(--color-chat-bg)" }}>
      <ConversationIntro conversation={conversation} currentUser={currentUser} onOpenInfo={onOpenInfo} />

      {/* Signal's thread notices sit between the intro card and the messages. */}
      {isDirect && !isPending && (
        <SystemMessage
          Icon={MessageSquare}
          text={iStartedIt ? `You started this chat with ${otherName}` : `You accepted ${otherName}'s message request`}
        />
      )}
      <SystemMessage
        Icon={ShieldCheck}
        text="Messages in this chat are simulated end-to-end encrypted. Encryption is mocked for this demo."
      />

      <div className="flex flex-col gap-[3px] px-4">
        {grouped.map(({ message, showDate, showSender }) => (
          <div key={message.id}>
            {showDate && <DateSeparator iso={message.created_at} />}
            <MessageBubble
              message={message}
              isOwn={message.sender_id === currentUser.id}
              showSender={showSender}
              conversation={conversation}
              currentUserId={currentUser.id}
              selected={selectedIds.has(message.id)}
              selecting={selectedIds.size > 0}
              onSelect={() => onSelectMessage(message.id)}
              onReply={() => onReply(message)}
              onDelete={() => onDelete(message.id)}
              onPin={() => onPin(message.id)}
              onCopy={() => navigator.clipboard?.writeText(message.content)}
            />
          </div>
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
