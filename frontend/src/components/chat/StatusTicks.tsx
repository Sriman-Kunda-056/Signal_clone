/**
 * Signal's read-receipt ticks are small circular badges, not bare checkmark
 * glyphs (which is what lucide's Check/CheckCheck render). Each tick is a
 * circle-check that's either outlined (not yet read) or solid white with a
 * blue check (read) — the empty-to-filled transition is the visual cue.
 * The filled state always uses white + accent-blue regardless of context
 * (message bubble vs. conversation list) so it reads clearly against any
 * background, rather than depending on what's behind it.
 */

interface TickProps {
  filled: boolean;
  outlineColor: string;
}

function CircleTick({ filled, outlineColor }: TickProps) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle
        cx="6.5"
        cy="6.5"
        r="5.5"
        fill={filled ? "#ffffff" : "none"}
        stroke={filled ? "#ffffff" : outlineColor}
        strokeWidth="1.1"
      />
      <path
        d="M4 6.6L5.7 8.3L9.2 4.7"
        stroke={filled ? "var(--color-accent)" : outlineColor}
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface StatusTicksProps {
  status: "sent" | "delivered" | "read";
  /** Outline stroke color when not yet read — dial per context (muted grey
   * in the sidebar, translucent white on the accent-colored own bubble). */
  outlineColor: string;
}

export function StatusTicks({ status, outlineColor }: StatusTicksProps) {
  if (status === "sent") {
    return (
      <span className="inline-flex">
        <CircleTick filled={false} outlineColor={outlineColor} />
      </span>
    );
  }
  const filled = status === "read";
  return (
    <span className="inline-flex -space-x-1.5">
      <CircleTick filled={filled} outlineColor={outlineColor} />
      <CircleTick filled={filled} outlineColor={outlineColor} />
    </span>
  );
}
