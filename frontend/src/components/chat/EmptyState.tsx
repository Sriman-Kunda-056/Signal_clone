/**
 * Signal's no-conversation-selected pane: the chat area stays empty apart
 * from a single large, low-contrast logo watermark dead-centre — no card,
 * no heading, no call to action.
 */
export function EmptyState() {
  return (
    <div
      className="flex h-full w-full flex-1 items-center justify-center"
      style={{ background: "var(--color-chat-bg)" }}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-32 w-32"
        fill="none"
        stroke="var(--color-border-strong)"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
      <span className="sr-only">Select a chat to start messaging</span>
    </div>
  );
}
