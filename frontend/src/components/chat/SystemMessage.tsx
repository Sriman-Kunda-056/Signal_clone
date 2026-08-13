import type { LucideIcon } from "lucide-react";

interface SystemMessageProps {
  Icon: LucideIcon;
  text: string;
  action?: { label: string; onClick: () => void };
}

/**
 * Signal's inline thread notices — centred, icon + muted text, with an
 * optional pill action beneath ("Block or Report…", "Learn More").
 */
export function SystemMessage({ Icon, text, action }: SystemMessageProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-8 py-3">
      <p
        className="flex items-center justify-center gap-2 text-center text-[13px] leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {text}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-full px-4 py-1 text-[13px] font-semibold transition-colors"
          style={{ background: "var(--color-input-bg)", color: "var(--color-accent-hover)" }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
