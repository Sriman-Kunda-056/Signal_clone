"use client";

import { FileText, MoreVertical, Pin, Reply, Smile } from "lucide-react";
import { useState } from "react";

import { ImageLightbox } from "@/components/chat/ImageLightbox";
import { ReactionPicker } from "@/components/chat/ReactionPicker";
import { ReactionPills } from "@/components/chat/ReactionPills";
import { StatusTicks } from "@/components/chat/StatusTicks";
import { messageTimestamp, senderNameColor } from "@/lib/format";
import { aggregateStatus } from "@/lib/messageStatus";
import type { Conversation, Message } from "@/lib/types";
import { useChatStore } from "@/store/chatStore";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSender: boolean;
  conversation: Conversation;
  currentUserId: number;
  selected?: boolean;
  selecting?: boolean;
  onSelect?: () => void;
  onReply?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onCopy?: () => void;
}

/** "file"-type messages stash "<filename>|<data URL>" in content — see
 * lib/attachments.ts, which avoided adding a dedicated filename column. */
function parseFileAttachment(content: string): { filename: string; dataUrl: string } {
  const sep = content.indexOf("|");
  if (sep === -1) return { filename: "Attachment", dataUrl: content };
  return { filename: content.slice(0, sep), dataUrl: content.slice(sep + 1) };
}

export function MessageBubble({ message, isOwn, showSender, conversation, currentUserId, selected, selecting, onSelect, onReply, onDelete, onPin, onCopy }: MessageBubbleProps) {
  const toggleReaction = useChatStore((s) => s.toggleReaction);
  const status = isOwn ? aggregateStatus(message) : null;
  const metaColor = isOwn ? "var(--color-bubble-own-meta)" : "var(--color-bubble-other-meta)";
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const align = isOwn ? "right" : "left";

  function handleReact(emoji: string) {
    toggleReaction(conversation.id, message.id, emoji);
  }

  const meta = (
    <span className="flex shrink-0 items-center gap-1 pt-0.5">
      <span className="text-[11px]" style={{ color: metaColor }}>
        {messageTimestamp(message.created_at)}
      </span>
      {message.client_status === "sending" ? <span className="text-[10px]" style={{ color: metaColor }}>Sending…</span> : message.client_status === "failed" ? <span className="text-[10px]" style={{ color: "var(--color-danger)" }}>Failed</span> : status && <StatusTicks status={status} outlineColor={metaColor} />}
    </span>
  );

  const senderLabel = showSender && !isOwn && conversation.type === "group" && (
    <p className="mb-0.5 text-[13px] font-semibold" style={{ color: senderNameColor(message.sender_id) }}>
      {message.sender.display_name}
    </p>
  );

  if (message.deleted_at) {
    return <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}><div className="rounded-[18px] px-3 py-2 text-sm italic" style={{ background: "var(--color-input-bg)", color: "var(--color-text-muted)" }}>This message was deleted</div></div>;
  }

  let bubble: React.ReactNode;

  if (message.message_type === "image") {
    bubble = (
      <>
        <div
          className="max-w-[min(65%,24rem)] overflow-hidden rounded-[18px]"
          style={{ background: "var(--color-bubble-other)" }}
        >
          {senderLabel && <div className="px-3 pt-1.5">{senderLabel}</div>}
          {/* eslint-disable-next-line @next/next/no-img-element -- data-URL image */}
          <img
            src={message.content}
            alt="Image attachment"
            onClick={() => setLightboxOpen(true)}
            className="max-h-80 w-full cursor-pointer object-cover"
          />
          <div className="flex justify-end px-2 py-1">{meta}</div>
        </div>
        {lightboxOpen && <ImageLightbox src={message.content} onClose={() => setLightboxOpen(false)} />}
      </>
    );
  } else if (message.message_type === "file") {
    const { filename, dataUrl } = parseFileAttachment(message.content);
    bubble = (
      <div
        className="max-w-[min(65%,24rem)] rounded-[18px] px-3 py-2"
        style={{
          background: isOwn ? "var(--color-bubble-own)" : "var(--color-bubble-other)",
          color: isOwn ? "var(--color-bubble-own-text)" : "var(--color-bubble-other-text)",
        }}
      >
        {senderLabel}
        <a href={dataUrl} download={filename} className="flex items-center gap-2.5 rounded-lg bg-black/10 px-2.5 py-2">
          <FileText className="h-6 w-6 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{filename}</span>
        </a>
        <div className="mt-1 flex justify-end">{meta}</div>
      </div>
    );
  } else {
    bubble = (
      <div
        className="max-w-[min(65%,32rem)] px-3 py-1.5 text-[14.5px] leading-snug"
        style={{
          background: isOwn ? "var(--color-bubble-own)" : "var(--color-bubble-other)",
          color: isOwn ? "var(--color-bubble-own-text)" : "var(--color-bubble-other-text)",
          borderRadius: 18,
        }}
      >
        {senderLabel}
        {message.is_forwarded && <p className="mb-1 text-[11px] italic opacity-70">Forwarded</p>}
        {message.is_pinned && <p className="mb-1 flex items-center gap-1 text-[11px] opacity-70"><Pin className="h-3 w-3" /> Pinned</p>}
        {message.reply_preview && <div className="mb-1.5 border-l-2 pl-2 text-xs opacity-75" style={{ borderColor: "var(--color-accent)" }}><strong>{message.reply_preview.sender_name}</strong><p className="truncate">{message.reply_preview.content || "Deleted message"}</p></div>}
        {/*
          Signal tucks the timestamp inside the bubble, trailing the text.
          `ml-auto` on the meta keeps it flush right whichever line it lands
          on: short messages share one line with a gap, long messages wrap
          and the meta drops to its own right-aligned line.
        */}
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="break-words whitespace-pre-wrap">{message.content}</span>
          <span className="ml-auto">{meta}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className="flex max-w-[80%] flex-col">
        <div className={`group/bubble relative flex items-center gap-1 ${isOwn ? "flex-row-reverse" : "flex-row"} ${selected ? "rounded-xl ring-2 ring-[var(--color-accent)]" : ""}`}>
          {bubble}
          {/* Hover-revealed react trigger — sits just outside the bubble on
              whichever side faces the edge of the column. */}
          <div className="relative shrink-0 self-end pb-1">
            <button
              onClick={() => setPickerOpen((v) => !v)}
              aria-label="React"
              className="flex h-7 w-7 items-center justify-center rounded-full opacity-0 transition-opacity group-hover/bubble:opacity-100"
              style={{ background: "var(--color-input-bg)" }}
            >
              <Smile className="h-4 w-4" style={{ color: "var(--color-icon)" }} />
            </button>
            {pickerOpen && <ReactionPicker align={align} onPick={handleReact} onClose={() => setPickerOpen(false)} />}
          </div>
          <div className="relative shrink-0 self-end pb-1">
            <button onClick={() => setMenuOpen((v) => !v)} aria-label="Message actions" className="flex h-7 w-7 items-center justify-center rounded-full opacity-0 transition-opacity group-hover/bubble:opacity-100" style={{ background: "var(--color-input-bg)" }}>
              <MoreVertical className="h-4 w-4" style={{ color: "var(--color-icon)" }} />
            </button>
            {menuOpen && <div className={`absolute z-20 w-36 rounded-lg border py-1 shadow-lg ${isOwn ? "right-0" : "left-0"}`} style={{ background: "var(--color-panel-bg)", borderColor: "var(--color-border)" }}>
              <MenuButton label="Reply" onClick={() => { onReply?.(); setMenuOpen(false); }} icon={<Reply className="h-3.5 w-3.5" />} />
              <MenuButton label="Copy" onClick={() => { onCopy?.(); setMenuOpen(false); }} />
              <MenuButton label={message.is_pinned ? "Unpin" : "Pin"} onClick={() => { onPin?.(); setMenuOpen(false); }} icon={<Pin className="h-3.5 w-3.5" />} />
              <MenuButton label={selecting ? "Unselect" : "Select"} onClick={() => { onSelect?.(); setMenuOpen(false); }} />
              {isOwn && <MenuButton label="Delete" danger onClick={() => { onDelete?.(); setMenuOpen(false); }} />}
            </div>}
          </div>
        </div>
        <ReactionPills reactions={message.reactions} currentUserId={currentUserId} align={align} onToggle={handleReact} />
      </div>
    </div>
  );
}

function MenuButton({ label, onClick, icon, danger }: { label: string; onClick: () => void; icon?: React.ReactNode; danger?: boolean }) {
  return <button onClick={onClick} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--color-sidebar-hover)]" style={{ color: danger ? "var(--color-danger)" : "var(--color-text-primary)" }}>{icon}{label}</button>;
}
