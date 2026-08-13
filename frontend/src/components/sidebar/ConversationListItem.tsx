"use client";

import { Check, CheckCheck } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { conversationAvatarId, conversationDisplayName } from "@/lib/conversation";
import { conversationTimestamp } from "@/lib/format";
import { aggregateStatus } from "@/lib/messageStatus";
import type { Conversation } from "@/lib/types";

interface ConversationListItemProps {
  conversation: Conversation;
  currentUserId: number;
  isActive: boolean;
  isOnline: boolean;
  onSelect: () => void;
}

export function ConversationListItem({
  conversation,
  currentUserId,
  isActive,
  isOnline,
  onSelect,
}: ConversationListItemProps) {
  const name = conversationDisplayName(conversation, currentUserId);
  const avatarId = conversationAvatarId(conversation, currentUserId);
  const lastMessage = conversation.last_message;
  const isPendingRequest = conversation.my_status === "pending";
  const lastIsOwn = lastMessage?.sender_id === currentUserId;

  let preview = "No messages yet";
  if (isPendingRequest) {
    // Signal labels an unaccepted thread in place of the usual preview.
    preview = "Message Request";
  } else if (lastMessage) {
    // Sender's name comes from the message itself (see Message.sender), so it
    // stays correct even if that person has since left the group.
    const prefix =
      conversation.type === "group" && !lastIsOwn ? `${lastMessage.sender.display_name.split(" ")[0]}: ` : "";
    preview = `${prefix}${lastMessage.content}`;
  }

  const ownStatus = !isPendingRequest && lastMessage && lastIsOwn ? aggregateStatus(lastMessage) : null;

  return (
    <button
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
      style={{ background: isActive ? "var(--color-sidebar-active)" : "transparent" }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = "var(--color-sidebar-hover)";
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = "transparent";
      }}
    >
      <Avatar
        id={avatarId}
        name={name}
        size={44}
        isGroup={conversation.type === "group"}
        online={conversation.type === "direct" ? isOnline : undefined}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {name}
          </span>
          {lastMessage && (
            <span className="shrink-0 text-xs" style={{ color: "var(--color-text-muted)" }}>
              {conversationTimestamp(lastMessage.created_at)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
            {preview}
            {conversation.awaiting_their_response && " · Awaiting response"}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {ownStatus === "read" && <CheckCheck className="h-3.5 w-3.5" style={{ color: "var(--color-accent)" }} />}
            {ownStatus === "delivered" && (
              <CheckCheck className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
            )}
            {ownStatus === "sent" && <Check className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />}
            {conversation.unread_count > 0 && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-white"
                style={{ background: "var(--color-unread-badge)" }}
              >
                {conversation.unread_count}
              </span>
            )}
          </span>
        </div>
      </div>
    </button>
  );
}
