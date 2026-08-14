"use client";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageInput } from "@/components/chat/MessageInput";
import { MessageList } from "@/components/chat/MessageList";
import { MessageRequestBanner } from "@/components/chat/MessageRequestBanner";
import type { Conversation, Message, User } from "@/lib/types";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useChatStore } from "@/store/chatStore";

interface ChatPaneProps {
  conversation: Conversation;
  messages: Message[];
  currentUser: User;
  loadingMessages: boolean;
  onlineUserIds: Set<number>;
  typingUserIds: number[];
  onSend: (content: string, replyToMessageId?: number) => void;
  onSendAttachment: (dataUrl: string, type: "image" | "file") => void;
  onTyping: (isTyping: boolean) => void;
  onOpenInfo: () => void;
  conversations: Conversation[];
}

export function ChatPane({
  conversation,
  messages,
  currentUser,
  loadingMessages,
  onlineUserIds,
  typingUserIds,
  onSend,
  onSendAttachment,
  onTyping,
  onOpenInfo,
  conversations,
}: ChatPaneProps) {
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [forwardTarget, setForwardTarget] = useState("");
  const deleteMessage = useChatStore((s) => s.deleteMessage);
  const togglePin = useChatStore((s) => s.togglePin);
  const forwardMessages = useChatStore((s) => s.forwardMessages);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSelectedIds(new Set()); setReplyingTo(null); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") { event.preventDefault(); setSelectedIds(new Set(messages.filter((m) => !m.deleted_at).map((m) => m.id))); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [messages]);

  function toggleSelected(id: number) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function forwardSelected() {
    if (!forwardTarget || selectedIds.size === 0) return;
    await forwardMessages(conversation.id, [...selectedIds], [Number(forwardTarget)]);
    setSelectedIds(new Set());
    setForwardTarget("");
  }

  return (
    <div className="flex h-full flex-1 flex-col" style={{ background: "var(--color-chat-bg)" }}>
      <ChatHeader
        conversation={conversation}
        currentUser={currentUser}
        onlineUserIds={onlineUserIds}
        typingUserIds={typingUserIds}
        onOpenInfo={onOpenInfo}
      />
      <MessageList
        conversation={conversation}
        messages={messages}
        currentUser={currentUser}
        loading={loadingMessages}
        onOpenInfo={onOpenInfo}
        selectedIds={selectedIds}
        onSelectMessage={toggleSelected}
        onReply={setReplyingTo}
        onDelete={(id) => deleteMessage(conversation.id, id)}
        onPin={(id) => togglePin(conversation.id, id)}
      />
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 border-t px-4 py-2" style={{ borderColor: "var(--color-border)", background: "var(--color-panel-bg)" }}>
          <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>{selectedIds.size} selected</span>
          <select value={forwardTarget} onChange={(e) => setForwardTarget(e.target.value)} className="min-w-0 flex-1 rounded border px-2 py-1 text-sm" style={{ borderColor: "var(--color-border)", background: "var(--color-input-bg)", color: "var(--color-text-primary)" }}>
            <option value="">Forward to…</option>
            {conversations.filter((item) => item.id !== conversation.id && item.my_status === "accepted").map((item) => <option key={item.id} value={item.id}>{item.name ?? item.participants.find((p) => p.user.id !== currentUser.id)?.user.display_name ?? "Conversation"}</option>)}
          </select>
          <button onClick={forwardSelected} disabled={!forwardTarget} className="rounded px-3 py-1 text-sm text-white disabled:opacity-50" style={{ background: "var(--color-accent)" }}>Forward</button>
          <button onClick={() => setSelectedIds(new Set())} aria-label="Clear selection"><X className="h-5 w-5" /></button>
        </div>
      )}
      {replyingTo && <div className="flex items-center justify-between border-t px-4 py-2 text-sm" style={{ borderColor: "var(--color-border)", background: "var(--color-input-bg)", color: "var(--color-text-secondary)" }}><span>Replying to <strong>{replyingTo.sender.display_name}</strong>: {replyingTo.content.slice(0, 80)}</span><button onClick={() => setReplyingTo(null)} aria-label="Cancel reply"><X className="h-4 w-4" /></button></div>}
      {/* A thread we haven't accepted yet swaps the composer for the
          Accept/Block/Delete bar — the messages above stay readable. */}
      {conversation.my_status === "pending" ? (
        <MessageRequestBanner conversation={conversation} currentUser={currentUser} />
      ) : (
        <MessageInput onSend={(content) => { onSend(content, replyingTo?.id); setReplyingTo(null); }} onSendAttachment={onSendAttachment} onTyping={onTyping} />
      )}
    </div>
  );
}
