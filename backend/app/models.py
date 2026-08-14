"""SQLAlchemy ORM models — the full DB schema for the app.

Table relationships at a glance:
    users 1---N contacts            (self-referential: owner_id -> contact_id)
    users N---N conversations       (through conversation_participants)
    conversations 1---N messages
    messages 1---N message_status   (one row per *recipient*, so read receipts
                                      can be tracked per-person even in groups)
"""

import datetime
import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from .database import Base


def utcnow() -> datetime.datetime:
    return datetime.datetime.utcnow()


class ConversationType(str, enum.Enum):
    direct = "direct"
    group = "group"


class ParticipantRole(str, enum.Enum):
    admin = "admin"
    member = "member"


class ParticipantRequestStatus(str, enum.Enum):
    """Per-participant "message request" state for direct conversations.

    Signal shows a new, non-mutual conversation as a request: the recipient
    sees the message but gets Accept/Block/Delete instead of a composer until
    they respond. This is tracked per participant (not per conversation)
    because the two sides of a brand-new direct chat start in different
    states — the person who started it is auto-`accepted`, the other person
    starts `pending`. Group participants and anyone in an already-mutual
    relationship are always `accepted` (see seed.py and create_conversation).
    """

    accepted = "accepted"
    pending = "pending"
    blocked = "blocked"


class MessageType(str, enum.Enum):
    text = "text"
    image = "image"
    file = "file"


class MessageStatusEnum(str, enum.Enum):
    sent = "sent"
    delivered = "delivered"
    read = "read"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    # Collected as the *first* step of registration (matching Signal's real
    # phone-first flow) even though login is still by username — see
    # routers/auth.py.
    phone_number = Column(String(20), unique=True, nullable=False)
    display_name = Column(String(64), nullable=False)
    avatar_url = Column(String(512), nullable=True)
    password_hash = Column(String(128), nullable=False)
    is_online = Column(Boolean, default=False, nullable=False)
    last_seen_at = Column(DateTime, default=utcnow, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    sent_messages = relationship("Message", back_populates="sender")


class Contact(Base):
    """An accepted, mutual relationship between two users.

    Rows are only ever created by the backend itself, when both sides of a
    direct conversation reach `accepted` status (see respond() in
    routers/conversations.py) — never directly by the "start a new chat"
    flow. This keeps Contacts meaning what it says: people you're actually
    connected with, which is also the pool the "new group" member picker
    draws from.
    """

    __tablename__ = "contacts"
    __table_args__ = (UniqueConstraint("owner_id", "contact_id", name="uq_owner_contact"),)

    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    contact_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    owner = relationship("User", foreign_keys=[owner_id])
    contact = relationship("User", foreign_keys=[contact_id])


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True)
    type = Column(Enum(ConversationType), nullable=False)
    name = Column(String(128), nullable=True)  # group only
    avatar_url = Column(String(512), nullable=True)  # group only
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    # Disappearing-messages timer in seconds, applied to newly sent messages
    # only (changing it never retroactively expires existing ones — same as
    # Signal). 0 = off.
    disappearing_seconds = Column(Integer, default=0, nullable=False)

    participants = relationship(
        "ConversationParticipant", back_populates="conversation", cascade="all, delete-orphan"
    )
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"
    __table_args__ = (UniqueConstraint("conversation_id", "user_id", name="uq_conversation_user"),)

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(Enum(ParticipantRole), default=ParticipantRole.member, nullable=False)
    # See ParticipantRequestStatus docstring — drives the message-request UI.
    request_status = Column(Enum(ParticipantRequestStatus), default=ParticipantRequestStatus.accepted, nullable=False)
    joined_at = Column(DateTime, default=utcnow, nullable=False)
    last_read_at = Column(DateTime, nullable=True)
    # Soft-delete marker for "deleted this request" / "left this group".
    # NOT a hard row delete: a direct conversation only ever has two
    # participant rows, and hard-deleting one erases the other person's
    # name/avatar from the remaining side's copy of the chat (their identity
    # was only ever looked up through this row). Soft-deleting keeps the row
    # — and the identity info on it — around, just excluded from this
    # person's own conversation list and from the active member list.
    left_at = Column(DateTime, nullable=True)
    # Per-user archive state — independent of request_status (an accepted,
    # perfectly normal conversation can still be archived) and independent
    # of left_at (archiving isn't leaving; the conversation stays fully
    # active, just tucked away in a separate list).
    is_archived = Column(Boolean, default=False, nullable=False)

    conversation = relationship("Conversation", back_populates="participants")
    user = relationship("User")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    message_type = Column(Enum(MessageType), default=MessageType.text, nullable=False)
    reply_to_message_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)
    # Soft delete ("Delete for everyone"): the row stays so the tombstone can
    # render in-place for all participants, exactly like Signal, rather than
    # a message silently vanishing mid-thread.
    deleted_at = Column(DateTime, nullable=True)
    is_pinned = Column(Boolean, default=False, nullable=False)
    # Set when the message was forwarded from another chat — Signal shows a
    # small "Forwarded" label rather than passing it off as original.
    is_forwarded = Column(Boolean, default=False, nullable=False)
    # Disappearing messages: absolute expiry stamped at send time from the
    # conversation's timer. Null = never expires. Filtered server-side on
    # read so an expired message can't be fetched even via direct API call.
    expires_at = Column(DateTime, nullable=True)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages")
    statuses = relationship("MessageStatus", back_populates="message", cascade="all, delete-orphan")
    reactions = relationship("MessageReaction", back_populates="message", cascade="all, delete-orphan")
    reply_to = relationship("Message", remote_side=[id])


class MessageStatus(Base):
    """One row per (message, recipient) pair — lets read receipts work in
    groups, where a single message can be delivered to one person and read
    by another at different times."""

    __tablename__ = "message_status"
    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_message_user_status"),)

    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(Enum(MessageStatusEnum), default=MessageStatusEnum.sent, nullable=False)
    updated_at = Column(DateTime, default=utcnow, nullable=False)

    message = relationship("Message", back_populates="statuses")
    user = relationship("User")


class MessageReaction(Base):
    """One emoji reaction per (message, user) — unique constraint means
    reacting again with a different emoji *replaces* the old one rather than
    stacking, matching Signal's real behavior."""

    __tablename__ = "message_reactions"
    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_message_user_reaction"),)

    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    emoji = Column(String(8), nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    message = relationship("Message", back_populates="reactions")
    user = relationship("User")
