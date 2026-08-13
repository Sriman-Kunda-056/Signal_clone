import type { Message } from "./types";

export type AggregateStatus = "sent" | "delivered" | "read";

export function aggregateStatus(message: Message): AggregateStatus {
  if (message.statuses.length === 0) return "sent";
  if (message.statuses.every((s) => s.status === "read")) return "read";
  if (message.statuses.some((s) => s.status === "delivered" || s.status === "read")) return "delivered";
  return "sent";
}
