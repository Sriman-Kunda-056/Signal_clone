"use client";

import { Archive, Bell, FolderPlus, ListFilter, Menu, MoreHorizontal, Search, SquarePen, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { ConversationListItem } from "@/components/sidebar/ConversationListItem";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { conversationDisplayName } from "@/lib/conversation";
import type { Conversation, User } from "@/lib/types";
import { sortConversations } from "@/store/chatStore";
import { useToastStore } from "@/store/toastStore";

interface SidebarProps {
  currentUser: User;
  conversations: Conversation[];
  activeConversationId: number | null;
  onlineUserIds: Set<number>;
  onSelect: (id: number) => void;
  onNewChat: () => void;
  onOpenArchived: () => void;
  onArchive: (conversationId: number) => void;
  /** Toggles the left nav rail (Chats/Calls/Stories) open/collapsed — the
   * hamburger button that sits beside "Chats", mirroring Signal Desktop's
   * "Hide Tabs" control. */
  onToggleNavRail: () => void;
}

/**
 * The conversation list column — Signal's second panel, sitting between the
 * nav rail and the chat pane. Header is a plain "Chats" title with ghost
 * icon buttons; no filled FAB (that's Telegram's pattern, not Signal's).
 */
export function Sidebar({
  currentUser,
  conversations,
  activeConversationId,
  onlineUserIds,
  onSelect,
  onNewChat,
  onOpenArchived,
  onArchive,
  onToggleNavRail,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(overflowRef, () => setOverflowOpen(false));
  const pushToast = useToastStore((s) => s.push);

  const filtered = useMemo(() => {
    let list = sortConversations(conversations);
    if (unreadOnly) list = list.filter((c) => c.unread_count > 0);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((c) => conversationDisplayName(c, currentUser.id).toLowerCase().includes(q));
    return list;
  }, [conversations, query, unreadOnly, currentUser.id]);

  return (
    <aside
      className="flex h-full w-full flex-col border-r md:w-[340px]"
      style={{ background: "var(--color-sidebar-bg)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleNavRail}
            aria-label="Toggle navigation"
            title="Toggle navigation"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-sidebar-hover)] md:flex"
          >
            <Menu className="h-[20px] w-[20px]" style={{ color: "var(--color-icon)" }} />
          </button>
          <h1 className="text-[26px] leading-none font-bold" style={{ color: "var(--color-text-primary)" }}>
            Chats
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onNewChat}
            aria-label="New chat"
            title="New chat"
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-sidebar-hover)]"
          >
            <SquarePen className="h-[18px] w-[18px]" style={{ color: "var(--color-icon)" }} />
          </button>
          <div className="relative" ref={overflowRef}>
            <button
              onClick={() => setOverflowOpen((v) => !v)}
              aria-label="More options"
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-sidebar-hover)]"
            >
              <MoreHorizontal className="h-[18px] w-[18px]" style={{ color: "var(--color-icon)" }} />
            </button>
            {overflowOpen && (
              <div
                className="absolute top-10 right-0 z-30 w-56 overflow-hidden rounded-lg border py-1 shadow-xl"
                style={{ background: "var(--color-panel-bg)", borderColor: "var(--color-border)" }}
              >
                <button
                  onClick={() => {
                    setUnreadOnly((v) => !v);
                    setOverflowOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-sidebar-hover)]"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  <ListFilter className="h-4 w-4" style={{ color: "var(--color-icon)" }} />
                  {unreadOnly ? "Show all chats" : "Filter by unread"}
                </button>
                <button
                  onClick={() => {
                    setOverflowOpen(false);
                    onOpenArchived();
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-sidebar-hover)]"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  <Archive className="h-4 w-4" style={{ color: "var(--color-icon)" }} />
                  Archived Chats
                </button>
                <button
                  onClick={() => {
                    setOverflowOpen(false);
                    pushToast("Chat folders", "This feature is coming soon.");
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-sidebar-hover)]"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  <FolderPlus className="h-4 w-4" style={{ color: "var(--color-icon)" }} />
                  Add Chat Folder
                </button>
                <div className="my-1 border-t" style={{ borderColor: "var(--color-border)" }} />
                <Link
                  href="/settings"
                  onClick={() => setOverflowOpen(false)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-sidebar-hover)]"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  <Bell className="h-4 w-4" style={{ color: "var(--color-icon)" }} />
                  Notifications
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setOverflowOpen(false)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-sidebar-hover)]"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  <UserIcon className="h-4 w-4" style={{ color: "var(--color-icon)" }} />
                  Profile
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 pb-2">
        <div
          className="flex flex-1 items-center gap-2 rounded-full px-3 py-1.5"
          style={{ background: "var(--color-input-bg)" }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)]"
            style={{ color: "var(--color-text-primary)" }}
          />
        </div>
        <button
          onClick={() => setUnreadOnly((v) => !v)}
          aria-label="Filter by unread"
          title={unreadOnly ? "Showing unread only" : "Filter by unread"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-sidebar-hover)]"
        >
          <ListFilter
            className="h-[18px] w-[18px]"
            style={{ color: unreadOnly ? "var(--color-accent)" : "var(--color-icon)" }}
          />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
            {query
              ? "No chats match your search."
              : unreadOnly
                ? "No unread chats."
                : "No chats yet. Start a new one."}
          </p>
        ) : (
          filtered.map((conversation) => {
            const other = conversation.participants.find((p) => p.user.id !== currentUser.id);
            return (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                currentUserId={currentUser.id}
                isActive={conversation.id === activeConversationId}
                isOnline={other ? onlineUserIds.has(other.user.id) : false}
                onSelect={() => onSelect(conversation.id)}
                onArchive={() => onArchive(conversation.id)}
              />
            );
          })
        )}
      </div>
    </aside>
  );
}
