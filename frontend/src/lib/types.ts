export type ConversationType = "direct" | "group";
export type ParticipantRole = "admin" | "member";
export type MessageType = "text" | "image" | "file";
export type MessageStatusValue = "sent" | "delivered" | "read";
// Mirrors backend ParticipantRequestStatus — drives the message-request UI
// (Accept/Block/Delete banner vs. a normal composer).
export type RequestStatus = "accepted" | "pending" | "blocked";

export interface User {
  id: number;
  username: string;
  phone_number: string;
  display_name: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen_at: string;
}

export interface MessageStatus {
  user_id: number;
  status: MessageStatusValue;
}

export interface Reaction {
  user_id: number;
  emoji: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  // Resolved from the message's own sender FK, not from the conversation's
  // *current* participant list — so it stays correct even after the sender
  // deletes a direct chat or is removed from a group.
  sender: User;
  // For message_type "image"/"file" this is a base64 data URL rather than
  // plain text — see lib/attachments.ts for why (no external storage
  // account, so attachments live in SQLite like everything else).
  content: string;
  message_type: MessageType;
  reply_to_message_id: number | null;
  created_at: string;
  statuses: MessageStatus[];
  reactions: Reaction[];
}

export interface Participant {
  user: User;
  role: ParticipantRole;
  joined_at: string;
}

export interface Conversation {
  id: number;
  type: ConversationType;
  name: string | null;
  avatar_url: string | null;
  // Who opened the thread — drives which inline notice we show at the top
  // ("You started this chat" vs "You accepted X's message request").
  created_by: number;
  created_at: string;
  participants: Participant[];
  last_message: Message | null;
  unread_count: number;
  // The current user's own state for this conversation. "pending" means a
  // message request awaiting Accept/Block/Delete; always "accepted" for groups.
  my_status: RequestStatus;
  // True only when I've accepted (or started) a direct chat and the other
  // person hasn't responded yet — never reveals a block.
  awaiting_their_response: boolean;
  // Per-user archive shelf — independent of my_status/awaiting_their_response.
  is_archived: boolean;
}

export interface Contact {
  id: number;
  contact: User;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}
