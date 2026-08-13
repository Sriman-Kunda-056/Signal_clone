import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from .models import ConversationType, MessageStatusEnum, MessageType, ParticipantRequestStatus, ParticipantRole


# ---------- Auth ----------

class RegisterRequest(BaseModel):
    username: str
    display_name: str
    password: str
    otp: str


class LoginRequest(BaseModel):
    username: str
    password: str


# ---------- User ----------

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
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
    content: str
    message_type: MessageType = MessageType.text
    reply_to_message_id: Optional[int] = None


class MessageStatusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    status: MessageStatusEnum


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


class AddMembersRequest(BaseModel):
    member_ids: List[int]


class RespondToConversationRequest(BaseModel):
    action: str  # "accept" | "block" | "delete" — validated in the router
