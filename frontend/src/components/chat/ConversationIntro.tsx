"use client";

import { ChevronRight, UsersRound } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { conversationAvatarId, conversationDisplayName, otherParticipant } from "@/lib/conversation";
import type { Conversation, User } from "@/lib/types";

interface ConversationIntroProps {
  conversation: Conversation;
  currentUser: User;
  onOpenInfo: () => void;
}

/**
 * The "hero" card Signal shows at the very top of a thread: large avatar,
 * the contact/group name as a tappable row, and a one-line context subtitle.
 */
export function ConversationIntro({ conversation, currentUser, onOpenInfo }: ConversationIntroProps) {
  const name = conversationDisplayName(conversation, currentUser.id);
  const avatarId = conversationAvatarId(conversation, currentUser.id);
  const other = otherParticipant(conversation, currentUser.id);
  const isGroup = conversation.type === "group";

  return (
    <div className="flex justify-center px-4 pt-6 pb-2">
      <button
        onClick={onOpenInfo}
        className="flex flex-col items-center gap-2 rounded-2xl border px-10 py-5 transition-colors hover:bg-[var(--color-sidebar-hover)]"
        style={{ borderColor: "var(--color-border)" }}
      >
        <Avatar id={avatarId} name={name} size={80} isGroup={isGroup} />
        <span className="flex items-center gap-1 text-[19px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {name}
          <ChevronRight className="h-4 w-4" style={{ color: "var(--color-text-secondary)" }} />
        </span>
        <span className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
          {isGroup ? (
            <>
              <UsersRound className="h-3.5 w-3.5" />
              {conversation.participants.length} members
            </>
          ) : (
            other && `@${other.user.username}`
          )}
        </span>
      </button>
    </div>
  );
}
