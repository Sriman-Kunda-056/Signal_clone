"use client";

import type { Reaction } from "@/lib/types";

interface ReactionPillsProps {
  reactions: Reaction[];
  currentUserId: number;
  align: "left" | "right";
  onToggle: (emoji: string) => void;
}

/** Groups the flat reaction list by emoji, showing a count pill for each —
 * clicking a pill toggles *your own* reaction to that emoji. */
export function ReactionPills({ reactions, currentUserId, align, onToggle }: ReactionPillsProps) {
  if (reactions.length === 0) return null;

  const grouped = new Map<string, Reaction[]>();
  for (const r of reactions) {
    grouped.set(r.emoji, [...(grouped.get(r.emoji) ?? []), r]);
  }

  return (
    <div className={`mt-0.5 flex flex-wrap gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
      {Array.from(grouped.entries()).map(([emoji, group]) => {
        const mine = group.some((r) => r.user_id === currentUserId);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className="flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors"
            style={{
              borderColor: mine ? "var(--color-accent)" : "var(--color-border)",
              background: mine ? "var(--color-accent-soft)" : "var(--color-panel-bg)",
            }}
          >
            <span>{emoji}</span>
            <span style={{ color: "var(--color-text-secondary)" }}>{group.length}</span>
          </button>
        );
      })}
    </div>
  );
}
