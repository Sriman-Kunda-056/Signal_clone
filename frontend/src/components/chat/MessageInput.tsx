"use client";

import { Loader2, Mic, Plus, SendHorizontal, Smile } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";

import { AttachmentTooLargeError, prepareAttachment } from "@/lib/attachments";
import { useToastStore } from "@/store/toastStore";

interface MessageInputProps {
  onSend: (content: string) => void;
  onSendAttachment: (dataUrl: string, type: "image" | "file") => void;
  onTyping: (isTyping: boolean) => void;
}

export function MessageInput({ onSend, onSendAttachment, onTyping }: MessageInputProps) {
  const [value, setValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pushToast = useToastStore((s) => s.push);

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, []);

  // Grow the textarea with its content, up to the max-height set in CSS.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [value]);

  function handleChange(next: string) {
    setValue(next);
    // Emit "started typing" once, then let a 2s idle timer emit the stop —
    // otherwise every keystroke would flood the socket.
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTyping(true);
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      isTypingRef.current = false;
      onTyping(false);
    }, 2000);
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    isTypingRef.current = false;
    onTyping(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;

    setUploading(true);
    try {
      const { dataUrl, type } = await prepareAttachment(file);
      onSendAttachment(dataUrl, type);
    } catch (err) {
      const message = err instanceof AttachmentTooLargeError ? err.message : "Couldn't send that attachment.";
      pushToast("Attachment failed", message);
    } finally {
      setUploading(false);
    }
  }

  const hasText = value.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 px-4 py-3"
      style={{ background: "var(--color-chat-bg)" }}
    >
      <button
        type="button"
        onClick={() => pushToast("Emoji picker", "This feature is coming soon.")}
        aria-label="Emoji"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-sidebar-hover)]"
      >
        <Smile className="h-[22px] w-[22px]" style={{ color: "var(--color-icon)" }} />
      </button>

      <div
        className="flex flex-1 items-end gap-1 rounded-[20px] px-4 py-1.5"
        style={{ background: "var(--color-input-bg)" }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Message"
          aria-label="Message"
          className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-[14.5px] outline-none placeholder:text-[var(--color-text-muted)]"
          style={{ color: "var(--color-text-primary)" }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt,.zip"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Add attachment"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-sidebar-hover)] disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" style={{ color: "var(--color-icon)" }} />
          ) : (
            <Plus className="h-[18px] w-[18px]" style={{ color: "var(--color-icon)" }} />
          )}
        </button>
      </div>

      {hasText ? (
        <button
          type="submit"
          aria-label="Send message"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
          style={{ background: "var(--color-accent)" }}
        >
          <SendHorizontal className="h-[18px] w-[18px] text-white" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => pushToast("Voice messages", "This feature is coming soon.")}
          aria-label="Record voice message"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-sidebar-hover)]"
        >
          <Mic className="h-[20px] w-[20px]" style={{ color: "var(--color-icon)" }} />
        </button>
      )}
    </form>
  );
}
