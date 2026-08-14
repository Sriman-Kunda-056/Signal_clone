import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from .models import ConversationType, MessageStatusEnum, MessageType, ParticipantRequestStatus, ParticipantRole


# ---------- Auth ----------

class RegisterRequest(BaseModel):
    # Collected first in the frontend's 3-step flow (phone -> OTP -> profile),
    # matching Signal's real registration order.
    phone_number: str
    username: str
    display_name: str
    password: str
    otp: str
    # Optional base64 data URL, same storage approach as attachments (see
    # lib/attachments.ts) — compressed to a small square client-side.
    avatar_url: Optional[str] = Field(default=None, max_length=1_500_000)


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = Field(default=None, max_length=1_500_000)


class LoginRequest(BaseModel):
    username: str
    password: str


# ---------- User ----------

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    phone_number: str
    display_name: str
    avatar_url: Optional[str] = None
    is_online: bool
    last_seen_at: datetime.datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Contacts ----------
# No ContactCreate — contacts are only ever created server-side on mutual
# acceptance of a conversation (see routers/conversations.py `respond`).

class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    contact: UserOut
    created_at: datetime.datetime


# ---------- Messages ----------

class MessageCreate(BaseModel):
    # ~2MB of binary once base64-inflated — bounds attachment size (see
    # lib/attachments.ts on the frontend, which compresses/rejects before
    # ever reaching this). Plain text messages are nowhere near this limit.
    content: str = Field(max_length=3_000_000)
    message_type: MessageType = MessageType.text
    reply_to_message_id: Optional[int] = None
    is_forwarded: bool = False


class ForwardRequest(BaseModel):
    """Copies existing messages into other conversations. Sends ids rather
    than raw content so the server re-reads the originals — a client can't
    use this to inject arbitrary content attributed to a forward."""

    message_ids: List[int]
    target_conversation_ids: List[int]


class DisappearingRequest(BaseModel):
    # 0 disables; otherwise seconds until a newly sent message expires.
    seconds: int = Field(ge=0, le=60 * 60 * 24 * 7)


class MessageStatusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    status: MessageStatusEnum


class ReactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    emoji: str


class ReactionCreate(BaseModel):
    emoji: str = Field(max_length=8)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    sender_id: int
    # The sender's identity is resolved from the message's own `sender`
    # relationship (a plain FK to users, which never goes away) rather than
    # by looking the sender up in the conversation's *current* participant
    # list — that list changes (someone leaves a group, deletes a direct
    # chat) but past messages should still show who actually sent them.
    sender: UserOut
    content: str
    message_type: MessageType
    reply_to_message_id: Optional[int]
    created_at: datetime.datetime
    statuses: List[MessageStatusOut] = []
    reactions: List[ReactionOut] = []
    # Tombstone marker for "Delete for everyone" — the row survives so the
    # client can render "This message was deleted" in place.
    deleted_at: Optional[datetime.datetime] = None
    is_pinned: bool = False
    is_forwarded: bool = False
    expires_at: Optional[datetime.datetime] = None
    # Minimal preview of the message being replied to, denormalized here so
    # the client can render the quote without a second fetch or holding the
    # entire (possibly paged-out) parent message in memory.
    reply_preview: Optional["ReplyPreview"] = None


class ReplyPreview(BaseModel):
    id: int
    sender_name: str
    content: str
    message_type: MessageType


# ---------- Conversations ----------

class ConversationCreate(BaseModel):
    type: ConversationType
    member_ids: List[int]
    name: Optional[str] = None  # required for group


class ParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: UserOut
    role: ParticipantRole
    joined_at: datetime.datetime


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: ConversationType
    name: Optional[str]
    avatar_url: Optional[str]
    # Who opened this thread. Lets the client render Signal's inline notices
    # ("You started this chat" vs "You accepted X's message request")
    # without needing a separate persisted system-message type.
    created_by: int
    created_at: datetime.datetime
    participants: List[ParticipantOut]
    last_message: Optional[MessageOut] = None
    unread_count: int = 0
    # The current user's own request state for this conversation — drives
    # whether the frontend shows a normal composer or an Accept/Block/Delete
    # banner. Always "accepted" for group chats.
    my_status: ParticipantRequestStatus = ParticipantRequestStatus.accepted
    # True only for direct conversations the caller started (or already
    # accepted) where the other person hasn't responded yet — lets the
    # frontend show a subtle "awaiting response" hint on their own outgoing
    # request, without exposing anything about a block.
    awaiting_their_response: bool = False
    # The caller's own archive state for this conversation — independent of
    # my_status/awaiting_their_response above.
    is_archived: bool = False
    # Disappearing-messages timer in seconds; 0 = off.
    disappearing_seconds: int = 0


class AddMembersRequest(BaseModel):
    member_ids: List[int]


class RespondToConversationRequest(BaseModel):
    action: str  # "accept" | "block" | "delete" — validated in the router


class ArchiveRequest(BaseModel):
    archived: bool
