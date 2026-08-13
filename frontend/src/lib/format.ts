import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";

export function conversationTimestamp(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d");
}

export function messageTimestamp(iso: string): string {
  return format(new Date(iso), "h:mm a");
}

export function dateSeparatorLabel(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

export function relativeLastSeen(iso: string): string {
  return `last seen ${formatDistanceToNowStrict(new Date(iso), { addSuffix: true })}`;
}

const AVATAR_COLORS = [
  "#2C6BED",
  "#5C6BC0",
  "#00897B",
  "#7CB342",
  "#F4511E",
  "#8E24AA",
  "#039BE5",
  "#D81B60",
  "#6D4C41",
  "#546E7A",
];

export function colorForId(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

/**
 * Lighter, higher-chroma variants used for the sender's name inside group
 * message bubbles. The avatar colors above are tuned as *backgrounds* behind
 * white text, so several of them (the browns and blue-greys) fail contrast
 * when used as text on a dark bubble — these are picked to stay legible on
 * both the dark and light bubble fills.
 */
const SENDER_NAME_COLORS = [
  "#7FA9FF",
  "#9BA7FF",
  "#4FD0C0",
  "#A5D65C",
  "#FF9270",
  "#D48CF0",
  "#5FC6FF",
  "#FF8FB1",
  "#D2A679",
  "#9FB4C2",
];

export function senderNameColor(id: number): string {
  return SENDER_NAME_COLORS[id % SENDER_NAME_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
