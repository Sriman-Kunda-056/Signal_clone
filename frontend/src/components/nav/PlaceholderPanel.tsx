"use client";

import { Book, Menu, Phone } from "lucide-react";

import type { NavView } from "@/components/nav/NavRail";

const COPY: Record<Exclude<NavView, "chats">, { title: string; body: string; Icon: typeof Phone }> = {
  calls: {
    title: "Calls",
    body: "Voice and video calling is a placeholder in this build — the call history and dialer live here in Signal.",
    Icon: Phone,
  },
  stories: {
    title: "Stories",
    body: "Stories are a placeholder in this build — disappearing photo and text updates from your contacts live here in Signal.",
    Icon: Book,
  },
};

interface PlaceholderPanelProps {
  view: Exclude<NavView, "chats">;
  onToggleNavRail: () => void;
}

/** Stand-in column for the nav destinations that are intentionally mocked. */
export function PlaceholderPanel({ view, onToggleNavRail }: PlaceholderPanelProps) {
  const { title, body, Icon } = COPY[view];

  return (
    <aside
      className="flex h-full w-full flex-col border-r md:w-[340px]"
      style={{ background: "var(--color-sidebar-bg)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <button
          onClick={onToggleNavRail}
          aria-label="Toggle navigation"
          title="Toggle navigation"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-sidebar-hover)]"
        >
          <Menu className="h-[20px] w-[20px]" style={{ color: "var(--color-icon)" }} />
        </button>
        <h1 className="text-[26px] leading-none font-bold" style={{ color: "var(--color-text-primary)" }}>
          {title}
        </h1>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "var(--color-input-bg)" }}
        >
          <Icon className="h-6 w-6" style={{ color: "var(--color-text-muted)" }} />
        </span>
        <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Coming soon
        </p>
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
          {body}
        </p>
      </div>
    </aside>
  );
}
