"use client";

import { Crown, UserMinus, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { conversationAvatarId, conversationDisplayName, otherParticipant } from "@/lib/conversation";
import { relativeLastSeen } from "@/lib/format";
import type { Conversation, User } from "@/lib/types";
import { useChatStore } from "@/store/chatStore";
import { useToastStore } from "@/store/toastStore";

interface GroupInfoPanelProps {
  conversation: Conversation;
  currentUser: User;
  onlineUserIds: Set<number>;
  onClose: () => void;
}

export function GroupInfoPanel({ conversation, currentUser, onlineUserIds, onClose }: GroupInfoPanelProps) {
  const contacts = useChatStore((s) => s.contacts);
  const loadContacts = useChatStore((s) => s.loadContacts);
  const addMembers = useChatStore((s) => s.addMembers);
  const removeMember = useChatStore((s) => s.removeMember);
  const setDisappearing = useChatStore((s) => s.setDisappearing);
  const pushToast = useToastStore((s) => s.push);

  const [showAddPicker, setShowAddPicker] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (conversation.type === "group") loadContacts();
  }, [conversation.type, loadContacts]);

  const myRole = conversation.participants.find((p) => p.user.id === currentUser.id)?.role;
  const isAdmin = myRole === "admin";
  const name = conversationDisplayName(conversation, currentUser.id);
  const avatarId = conversationAvatarId(conversation, currentUser.id);

  const memberIds = new Set(conversation.participants.map((p) => p.user.id));
  const addableContacts = contacts.filter((c) => !memberIds.has(c.contact.id));
  const other = conversation.type === "direct" ? otherParticipant(conversation, currentUser.id) : undefined;

  async function handleRemove(memberId: number) {
    setBusyId(memberId);
    try {
      await removeMember(conversation.id, memberId);
    } catch {
      pushToast("Couldn't remove member", "Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdd(memberId: number) {
    setBusyId(memberId);
    try {
      await addMembers(conversation.id, [memberId]);
    } catch {
      pushToast("Couldn't add member", "Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleTimer(seconds: number) {
    try {
      await setDisappearing(conversation.id, seconds);
    } catch {
      pushToast("Couldn't update timer", "Please try again.");
    }
  }

  return (
    // Below `lg` there's no room for a third column, so this becomes a
    // full-screen overlay instead of silently doing nothing when opened
    // (which is what happened before this responsive pass — `hidden lg:flex`
    // meant "Info" had no visible effect at all on tablet/mobile).
    <aside
      className="fixed inset-0 z-40 flex h-full w-full flex-col border-l lg:static lg:z-auto lg:w-[320px] lg:shrink-0"
      style={{ background: "var(--color-sidebar-bg)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {conversation.type === "group" ? "Group info" : "Contact info"}
        </h2>
        <button onClick={onClose} className="rounded p-1 hover:opacity-70">
          <X className="h-4 w-4" style={{ color: "var(--color-text-secondary)" }} />
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto p-4">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Avatar id={avatarId} name={name} size={72} isGroup={conversation.type === "group"} />
          <p className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {name}
          </p>
          {other && (
            <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              @{other.user.username} · {onlineUserIds.has(other.user.id) ? "Online" : relativeLastSeen(other.user.last_seen_at)}
            </p>
          )}
        </div>

        <div className="mb-5 rounded-lg border p-3" style={{ borderColor: "var(--color-border)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>Disappearing messages</p>
          <p className="mb-2 text-xs" style={{ color: "var(--color-text-muted)" }}>New messages disappear after the selected time.</p>
          <select value={conversation.disappearing_seconds} onChange={(event) => handleTimer(Number(event.target.value))} className="w-full rounded border px-2 py-1.5 text-sm" style={{ borderColor: "var(--color-border)", background: "var(--color-input-bg)", color: "var(--color-text-primary)" }}>
            <option value={0}>Off</option><option value={30}>30 seconds</option><option value={300}>5 minutes</option><option value={3600}>1 hour</option><option value={86400}>1 day</option><option value={604800}>1 week</option>
          </select>
        </div>

        {conversation.type === "group" && (
          <>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                {conversation.participants.length} members
              </p>
              {isAdmin && (
                <button
                  onClick={() => setShowAddPicker((v) => !v)}
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: "var(--color-accent)" }}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Add
                </button>
              )}
            </div>

            {showAddPicker && (
              <div className="mb-3 flex flex-col gap-1 rounded-lg border p-2" style={{ borderColor: "var(--color-border)" }}>
                {addableContacts.length === 0 ? (
                  <p className="px-1 py-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    All your contacts are already in this group.
                  </p>
                ) : (
                  addableContacts.map(({ contact }) => (
                    <button
                      key={contact.id}
                      onClick={() => handleAdd(contact.id)}
                      disabled={busyId === contact.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:opacity-80 disabled:opacity-50"
                    >
                      <Avatar id={contact.id} name={contact.display_name} size={28} />
                      <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>
                        {contact.display_name}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            <div className="flex flex-col gap-1">
              {conversation.participants.map((participant) => (
                <div key={participant.user.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <Avatar
                    id={participant.user.id}
                    name={participant.user.display_name}
                    size={36}
                    online={onlineUserIds.has(participant.user.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {participant.user.display_name}
                      {participant.user.id === currentUser.id && " (you)"}
                    </p>
                    {participant.role === "admin" && (
                      <p className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                        <Crown className="h-3 w-3" /> Admin
                      </p>
                    )}
                  </div>
                  {isAdmin && participant.user.id !== currentUser.id && (
                    <button
                      onClick={() => handleRemove(participant.user.id)}
                      disabled={busyId === participant.user.id}
                      className="rounded p-1.5 hover:opacity-70 disabled:opacity-50"
                      title="Remove from group"
                    >
                      <UserMinus className="h-4 w-4" style={{ color: "var(--color-danger)" }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
