"use client";

import { AtSign, ChevronLeft, Hash, NotebookPen, Search, UsersRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { api } from "@/lib/api";
import type { Conversation, User } from "@/lib/types";
import { useChatStore } from "@/store/chatStore";
import { useToastStore } from "@/store/toastStore";

interface NewChatPanelProps {
  onClose: () => void;
  onOpenConversation: (conversationId: number) => void;
  onNewGroup: () => void;
  conversations: Conversation[];
}

/**
 * Signal opens "New chat" as a full replacement for the conversation list
 * column (not a floating modal) — back arrow, search, quick actions, then
 * Contacts and Groups sections.
 */
export function NewChatPanel({ onClose, onOpenConversation, onNewGroup, conversations }: NewChatPanelProps) {
  const contacts = useChatStore((s) => s.contacts);
  const loadContacts = useChatStore((s) => s.loadContacts);
  const createDirectConversation = useChatStore((s) => s.createDirectConversation);
  const pushToast = useToastStore((s) => s.push);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [startingId, setStartingId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await api.get<User[]>(`/contacts/search?q=${encodeURIComponent(trimmed)}`));
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const trimmedQuery = query.trim();
  const groups = conversations.filter((c) => c.type === "group");

  async function handleStart(user: User) {
    // Doesn't add a contact directly — with no existing mutual thread, the
    // backend opens this as a pending message request on their side.
    setStartingId(user.id);
    try {
      const conversation = await createDirectConversation(user.id);
      onOpenConversation(conversation.id);
      onClose();
    } catch {
      pushToast("Couldn't start this chat", "Please try again.");
    } finally {
      setStartingId(null);
    }
  }

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
          New chat
        </h2>
        <span className="h-9 w-9" aria-hidden />
      </div>

      <div className="px-4 pb-3">
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{ background: "var(--color-input-bg)" }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, username, or number"
            autoFocus
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)]"
            style={{ color: "var(--color-text-primary)" }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {trimmedQuery ? (
          <>
            {searching && (
              <p className="px-3 py-6 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
                Searching…
              </p>
            )}
            {!searching && results.length === 0 && (
              <p className="px-3 py-6 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
                No results for “{trimmedQuery}”.
              </p>
            )}
            {!searching &&
              results.map((user) => (
                <PersonRow
                  key={user.id}
                  user={user}
                  disabled={startingId !== null}
                  onClick={() => handleStart(user)}
                />
              ))}
          </>
        ) : (
          <>
            <ActionRow Icon={UsersRound} label="New group" onClick={onNewGroup} />
            <ActionRow Icon={AtSign} label="Find by username" onClick={() => searchRef.current?.focus()} />
            <ActionRow Icon={Hash} label="Find by phone number" onClick={() => searchRef.current?.focus()} />
            <ActionRow
              Icon={NotebookPen}
              label="Note to Self"
              onClick={() => pushToast("Note to Self", "This feature is coming soon.")}
            />

            <SectionLabel>Contacts</SectionLabel>
            {contacts.length === 0 ? (
              <p className="px-3 py-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
                No contacts yet. Search above to message someone new.
              </p>
            ) : (
              contacts.map(({ contact }) => (
                <PersonRow
                  key={contact.id}
                  user={contact}
                  disabled={startingId !== null}
                  onClick={() => handleStart(contact)}
                />
              ))
            )}

            {groups.length > 0 && (
              <>
                <SectionLabel>Groups</SectionLabel>
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => {
                      onOpenConversation(group.id);
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--color-sidebar-hover)]"
                  >
                    <Avatar id={group.id} name={group.name ?? "Group"} size={36} isGroup />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                        {group.name}
                      </p>
                      <p className="truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {group.participants.length} members
                      </p>
                    </div>
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-4 pb-1 text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
      {children}
    </p>
  );
}

function ActionRow({
  Icon,
  label,
  onClick,
}: {
  Icon: typeof UsersRound;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--color-sidebar-hover)]"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--color-input-bg)" }}
      >
        <Icon className="h-[18px] w-[18px]" style={{ color: "var(--color-icon)" }} />
      </span>
      <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>
        {label}
      </span>
    </button>
  );
}

function PersonRow({ user, disabled, onClick }: { user: User; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--color-sidebar-hover)] disabled:opacity-50"
    >
      <Avatar id={user.id} name={user.display_name} size={36} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
          {user.display_name}
        </p>
        <p className="truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
          @{user.username}
        </p>
      </div>
    </button>
  );
}
