"use client";

import { ArchiveRestore, ChevronLeft } from "lucide-react";
import { useEffect } from "react";

import { Avatar } from "@/components/Avatar";
import { conversationAvatarId, conversationDisplayName } from "@/lib/conversation";
import { conversationTimestamp, messagePreviewText } from "@/lib/format";
import type { User } from "@/lib/types";
import { useChatStore } from "@/store/chatStore";

interface ArchivedChatsPanelProps {
  currentUser: User;
  onClose: () => void;
  onOpenConversation: (conversationId: number) => void;
}

/** Replaces the main chat list column, same pattern as NewChatPanel.tsx. */
export function ArchivedChatsPanel({ currentUser, onClose, onOpenConversation }: ArchivedChatsPanelProps) {
  const archivedConversations = useChatStore((s) => s.archivedConversations);
  const loadArchivedConversations = useChatStore((s) => s.loadArchivedConversations);
  const setArchived = useChatStore((s) => s.setArchived);

  useEffect(() => {
    loadArchivedConversations();
  }, [loadArchivedConversations]);

  return (
    <aside
      className="flex h-full w-full flex-col border-r md:w-[340px]"
      style={{ background: "var(--color-sidebar-bg)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center gap-2 px-3 pt-4 pb-3">
        <button
          onClick={onClose}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-sidebar-hover)]"
        >
          <ChevronLeft className="h-5 w-5" style={{ color: "var(--color-icon)" }} />
        </button>
        <h2 className="flex-1 text-center text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Archived Chats
        </h2>
        <span className="h-9 w-9" aria-hidden />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {archivedConversations.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
            No archived chats.
          </p>
        ) : (
          archivedConversations.map((conversation) => {
            const name = conversationDisplayName(conversation, currentUser.id);
            const avatarId = conversationAvatarId(conversation, currentUser.id);
            return (
              <div
                key={conversation.id}
                className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--color-sidebar-hover)]"
              >
                <button
                  onClick={() => onOpenConversation(conversation.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Avatar id={avatarId} name={name} size={44} isGroup={conversation.type === "group"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {name}
                    </p>
                    <p className="truncate text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                      {conversation.last_message ? messagePreviewText(conversation.last_message) : "No messages yet"}
                    </p>
                  </div>
                </button>
                <span className="shrink-0 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {conversation.last_message && conversationTimestamp(conversation.last_message.created_at)}
                </span>
                <button
                  onClick={() => setArchived(conversation.id, false)}
                  aria-label="Unarchive"
                  title="Unarchive"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-sidebar-active)]"
                >
                  <ArchiveRestore className="h-4 w-4" style={{ color: "var(--color-icon)" }} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
