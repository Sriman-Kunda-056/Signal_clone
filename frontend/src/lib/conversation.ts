import type { Conversation, Participant } from "./types";

export function otherParticipant(conversation: Conversation, currentUserId: number): Participant | undefined {
  return conversation.participants.find((p) => p.user.id !== currentUserId);
}

export function conversationDisplayName(conversation: Conversation, currentUserId: number): string {
  if (conversation.type === "group") return conversation.name ?? "Group";
  return otherParticipant(conversation, currentUserId)?.user.display_name ?? "Unknown";
}

export function conversationAvatarId(conversation: Conversation, currentUserId: number): number {
  if (conversation.type === "group") return conversation.id;
  return otherParticipant(conversation, currentUserId)?.user.id ?? conversation.id;
}
