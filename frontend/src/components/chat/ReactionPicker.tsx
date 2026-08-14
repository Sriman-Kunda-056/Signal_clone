"use client";

import { useRef } from "react";

import { useOnClickOutside } from "@/hooks/useOnClickOutside";

// Signal's real quick-react set is customizable; this fixed six covers the
// common cases without building a full emoji picker for this assignment.
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface ReactionPickerProps {
  align: "left" | "right";
  onPick: (emoji: string) => void;
  onClose: () => void;
}

export function ReactionPicker({ align, onPick, onClose }: ReactionPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useOnClickOutside(ref, onClose);

  return (
    <div
      ref={ref}
      className={`absolute -top-11 z-20 flex items-center gap-0.5 rounded-full border px-1.5 py-1 shadow-xl ${
        align === "right" ? "right-0" : "left-0"
      }`}
      style={{ background: "var(--color-panel-bg)", borderColor: "var(--color-border)" }}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => {
            onPick(emoji);
            onClose();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition-transform hover:scale-125"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
