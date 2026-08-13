"use client";

import { MoreVertical, Phone, Search, Video } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { conversationAvatarId, conversationDisplayName, otherParticipant } from "@/lib/conversation";
import type { Conversation, User } from "@/lib/types";
import { useToastStore } from "@/store/toastStore";

interface ChatHeaderProps {
  conversation: Conversation;
  currentUser: User;
  onlineUserIds: Set<number>;
  typingUserIds: number[];
  onOpenInfo: () => void;
}

export function ChatHeader({ conversation, currentUser, onlineUserIds, typingUserIds, onOpenInfo }: ChatHeaderProps) {
  const pushToast = useToastStore((s) => s.push);
  const name = conversationDisplayName(conversation, currentUser.id);
  const avatarId = conversationAvatarId(conversation, currentUser.id);
  const other = otherParticipant(conversation, currentUser.id);

  // Signal's header is just avatar + name most of the time; a second line
  // only appears when there's something worth saying.
  let subtitle: string | null = null;
  if (conversation.my_status === "pending") {
    subtitle = "Message Request";
  } else if (typingUserIds.length > 0) {
    if (conversation.type === "group") {
      const names = typingUserIds
        .map((id) => conversation.participants.find((p) => p.user.id === id)?.user.display_name.split(" ")[0])
        .filter(Boolean);
      subtitle = `${names.join(", ")} is typing…`;
    } else {
      subtitle = "typing…";
    }
  } else if (conversation.awaiting_their_response) {
    subtitle = "Awaiting response";
  } else if (conversation.type === "group") {
    subtitle = `${conversation.participants.length} members`;
  }

  function comingSoon(feature: string) {
    pushToast(feature, "This feature is coming soon.");
  }

  return (
    <header
      className="flex items-center gap-3 border-b px-4 py-2.5"
      style={{ borderColor: "var(--color-border)", background: "var(--color-chat-bg)" }}
    >
      <button onClick={onOpenInfo} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar
          id={avatarId}
          name={name}
          size={32}
          isGroup={conversation.type === "group"}
          online={conversation.type === "direct" && other ? onlineUserIds.has(other.user.id) : undefined}
        />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {name}
          </span>
          {subtitle && (
            <span className="block truncate text-xs" style={{ color: "var(--color-text-secondary)" }}>
              {subtitle}
            </span>
          )}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        <HeaderIcon label="Video call" onClick={() => comingSoon("Video calls")} Icon={Video} />
        <HeaderIcon label="Voice call" onClick={() => comingSoon("Voice calls")} Icon={Phone} />
        <HeaderIcon label="Search in conversation" onClick={() => comingSoon("Search in chat")} Icon={Search} />
        <HeaderIcon label="Conversation info" onClick={onOpenInfo} Icon={MoreVertical} />
      </div>
    </header>
  );
}

function HeaderIcon({ label, onClick, Icon }: { label: string; onClick: () => void; Icon: typeof Video }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-sidebar-hover)]"
    >
      <Icon className="h-[18px] w-[18px]" style={{ color: "var(--color-icon)" }} />
    </button>
  );
}
