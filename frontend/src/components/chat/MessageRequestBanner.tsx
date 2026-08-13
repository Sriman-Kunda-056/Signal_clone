"use client";

import { useState } from "react";

import { otherParticipant } from "@/lib/conversation";
import type { Conversation, User } from "@/lib/types";
import { useChatStore } from "@/store/chatStore";
import { useToastStore } from "@/store/toastStore";

interface MessageRequestBannerProps {
  conversation: Conversation;
  currentUser: User;
}

type Action = "accept" | "block" | "delete";

/**
 * Replaces the composer while `conversation.my_status === "pending"`.
 * Signal's real bar is a short prompt over three evenly-weighted text
 * buttons — Block / Delete / Accept, left to right.
 */
export function MessageRequestBanner({ conversation, currentUser }: MessageRequestBannerProps) {
  const respondToConversation = useChatStore((s) => s.respondToConversation);
  const pushToast = useToastStore((s) => s.push);
  const [busy, setBusy] = useState<Action | null>(null);

  const other = otherParticipant(conversation, currentUser.id);
  const name = other?.user.display_name ?? "This person";

  async function handle(action: Action) {
    setBusy(action);
    try {
      await respondToConversation(conversation.id, action);
    } catch {
      pushToast("Something went wrong", "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border-t px-4 py-4" style={{ borderColor: "var(--color-border)", background: "var(--color-chat-bg)" }}>
      <p className="mb-3 text-center text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
        Let <strong style={{ color: "var(--color-text-primary)" }}>{name}</strong> message you and share your name and
        photo with them? They won&apos;t know you&apos;ve seen their message until you accept.
      </p>
      <div className="flex items-center justify-center gap-2">
        <RequestButton onClick={() => handle("block")} disabled={busy !== null} tone="danger">
          {busy === "block" ? "Blocking…" : "Block"}
        </RequestButton>
        <RequestButton onClick={() => handle("delete")} disabled={busy !== null} tone="danger">
          {busy === "delete" ? "Deleting…" : "Delete"}
        </RequestButton>
        <RequestButton onClick={() => handle("accept")} disabled={busy !== null} tone="accent">
          {busy === "accept" ? "Accepting…" : "Accept"}
        </RequestButton>
      </div>
    </div>
  );
}

function RequestButton({
  onClick,
  disabled,
  tone,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  tone: "danger" | "accent";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="min-w-[104px] rounded-full px-5 py-2 text-[14px] font-semibold transition-colors disabled:opacity-50"
      style={{
        background: "var(--color-input-bg)",
        color: tone === "danger" ? "var(--color-danger)" : "var(--color-accent-hover)",
      }}
    >
      {children}
    </button>
  );
}
