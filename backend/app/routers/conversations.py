"""Conversation lifecycle: listing, creation, membership, read state, and
the message-request flow (accept / block / delete a new direct chat).

The message-request model, in one paragraph: every `ConversationParticipant`
row carries its own `request_status`. Starting a direct chat with someone you
don't already have an *accepted* relationship with always creates a brand
new conversation, with you as `accepted` and them as `pending` — it never
silently reuses a conversation that either side hasn't accepted yet. That
single rule is what produces Signal's real behavior: if two people message
each other before either accepts, they end up with two separate pending
threads, which only fold into one once somebody hits Accept (see `respond`).
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..ws import manager

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _get_participant(db: Session, conversation_id: int, user_id: int) -> Optional[models.ConversationParticipant]:
    return (
        db.query(models.ConversationParticipant)
        .filter(
            models.ConversationParticipant.conversation_id == conversation_id,
            models.ConversationParticipant.user_id == user_id,
        )
        .first()
    )


def _require_participant(db: Session, conversation_id: int, user_id: int) -> models.ConversationParticipant:
    """Raises if the user was never a participant, OR has soft-left/deleted
    their side of it (see ConversationParticipant.left_at) — either way they
    have no business reading or acting on this conversation anymore."""
    participant = _get_participant(db, conversation_id, user_id)
    if participant is None or participant.left_at is not None:
        raise HTTPException(status_code=403, detail="Not a participant of this conversation")
    return participant


def _direct_conversations_between(db: Session, user_a_id: int, user_b_id: int) -> list[models.Conversation]:
    """Every direct-type conversation with exactly these two people in it,
    regardless of request status. Two rows can legitimately exist here at
    once — that's the pending-on-both-sides case described above."""
    candidates = (
        db.query(models.Conversation)
        .join(models.ConversationParticipant)
        .filter(models.Conversation.type == models.ConversationType.direct)
        .filter(models.ConversationParticipant.user_id.in_([user_a_id, user_b_id]))
        .all()
    )
    return [c for c in candidates if {p.user_id for p in c.participants} == {user_a_id, user_b_id}]


def _ensure_mutual_contact(db: Session, user_a_id: int, user_b_id: int) -> None:
    """Contacts are only ever created here, once both sides of a direct
    conversation have accepted — never at the moment someone starts a chat.
    That keeps "Contacts" meaning "people I'm actually connected to", which
    is also what the New Group member picker draws from."""
    for owner_id, contact_id in ((user_a_id, user_b_id), (user_b_id, user_a_id)):
        already_contact = (
            db.query(models.Contact)
            .filter(models.Contact.owner_id == owner_id, models.Contact.contact_id == contact_id)
            .first()
        )
        if already_contact is None:
            db.add(models.Contact(owner_id=owner_id, contact_id=contact_id))


def _merge_duplicate_direct_conversations(
    db: Session, canonical: models.Conversation, user_a_id: int, user_b_id: int
) -> None:
    """Once a conversation between two people becomes mutually accepted,
    fold any other direct thread between them into it — this is the "two
    requests become one chat" merge. Messages are reassigned one-by-one
    through the ORM (not a bulk UPDATE) so SQLAlchemy's cascade delete
    correctly leaves them alone when the now-empty duplicate is deleted."""
    duplicates = [c for c in _direct_conversations_between(db, user_a_id, user_b_id) if c.id != canonical.id]
    for duplicate in duplicates:
        messages = db.query(models.Message).filter(models.Message.conversation_id == duplicate.id).all()
        for message in messages:
            message.conversation_id = canonical.id
        db.flush()  # persist the reassignment before the cascade-delete below runs
        db.delete(duplicate)
    if duplicates:
        db.flush()


def _serialize_conversation(db: Session, conversation: models.Conversation, current_user_id: int) -> schemas.ConversationOut:
    last_message = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conversation.id)
        .order_by(models.Message.created_at.desc())
        .first()
    )

    participant = _get_participant(db, conversation.id, current_user_id)
    unread_count = 0
    if participant is not None:
        q = db.query(func.count(models.Message.id)).filter(
            models.Message.conversation_id == conversation.id,
            models.Message.sender_id != current_user_id,
        )
        if participant.last_read_at is not None:
            q = q.filter(models.Message.created_at > participant.last_read_at)
        unread_count = q.scalar() or 0

    my_status = participant.request_status if participant else models.ParticipantRequestStatus.accepted

    # Only meaningful for direct chats: "I've accepted (or started) this,
    # but the other person hasn't responded yet." Never reveals a block.
    awaiting_their_response = False
    if (
        conversation.type == models.ConversationType.direct
        and my_status == models.ParticipantRequestStatus.accepted
    ):
        other = next((p for p in conversation.participants if p.user_id != current_user_id), None)
        if other is not None and other.request_status == models.ParticipantRequestStatus.pending:
            awaiting_their_response = True

    out = schemas.ConversationOut.model_validate(conversation)
    out.last_message = schemas.MessageOut.model_validate(last_message) if last_message else None
    out.unread_count = unread_count
    out.my_status = my_status
    out.awaiting_their_response = awaiting_their_response
    out.is_archived = participant.is_archived if participant else False

    if conversation.type == models.ConversationType.group:
        # Member list / admin controls should only show people still in the
        # group. (Direct conversations deliberately keep both rows even if
        # one side left — see the ConversationParticipant.left_at docstring
        # for why: it's the only place the other person's identity lives.)
        active = [p for p in conversation.participants if p.left_at is None]
        out.participants = [schemas.ParticipantOut.model_validate(p) for p in active]

    return out


@router.get("", response_model=List[schemas.ConversationOut])
def list_conversations(
    archived: bool = Query(False),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversations = (
        db.query(models.Conversation)
        .join(models.ConversationParticipant)
        .filter(models.ConversationParticipant.user_id == current_user.id)
        # Blocked conversations are hidden from the blocker's own list —
        # the other person is never told, they just stop hearing back.
        .filter(models.ConversationParticipant.request_status != models.ParticipantRequestStatus.blocked)
        # And conversations this user has deleted/left don't show up either.
        .filter(models.ConversationParticipant.left_at.is_(None))
        # Main list vs. Archived Chats view — same query, different filter.
        .filter(models.ConversationParticipant.is_archived == archived)
        .options(joinedload(models.Conversation.participants).joinedload(models.ConversationParticipant.user))
        .all()
    )
    serialized = [_serialize_conversation(db, c, current_user.id) for c in conversations]
    serialized.sort(
        key=lambda c: c.last_message.created_at if c.last_message else c.created_at,
        reverse=True,
    )
    return serialized


@router.post("", response_model=schemas.ConversationOut, status_code=201)
def create_conversation(
    payload: schemas.ConversationCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member_ids = set(payload.member_ids)
    member_ids.discard(current_user.id)

    if payload.type == models.ConversationType.direct:
        if len(member_ids) != 1:
            raise HTTPException(status_code=400, detail="Direct conversations need exactly one other member")
        other_id = next(iter(member_ids))
        other = db.get(models.User, other_id)
        if other is None:
            raise HTTPException(status_code=404, detail="User not found")

        existing = _direct_conversations_between(db, current_user.id, other_id)

        # Reuse any existing thread where *I've* already said yes to it —
        # whether that's because it's mutually accepted already, or because
        # I started it myself and I'm just messaging again while I wait for
        # them to respond. Either way, that's still "my" conversation with
        # them and repeated "New message" clicks should land back in it.
        #
        # The one case that does NOT reuse anything: the only conversation(s)
        # with this person are ones where *my own* status is still `pending`
        # — i.e. they messaged me first and I haven't accepted. Starting a
        # message there instead of accepting deliberately creates a second,
        # independent thread — that's Signal's real "two message requests
        # until someone accepts" behavior.
        for conv in existing:
            my_status = next((p.request_status for p in conv.participants if p.user_id == current_user.id), None)
            if my_status == models.ParticipantRequestStatus.accepted:
                return _serialize_conversation(db, conv, current_user.id)

        # If the other person has blocked any existing thread with us,
        # fail generically — real Signal never tells the blocked sender why.
        blocked_by_target = any(
            p.user_id == other_id and p.request_status == models.ParticipantRequestStatus.blocked
            for conv in existing
            for p in conv.participants
        )
        if blocked_by_target:
            raise HTTPException(status_code=403, detail="Couldn't start this conversation")

        conversation = models.Conversation(type=models.ConversationType.direct, created_by=current_user.id)
        db.add(conversation)
        db.flush()
        db.add_all(
            [
                models.ConversationParticipant(
                    conversation_id=conversation.id,
                    user_id=current_user.id,
                    request_status=models.ParticipantRequestStatus.accepted,
                ),
                models.ConversationParticipant(
                    conversation_id=conversation.id,
                    user_id=other_id,
                    request_status=models.ParticipantRequestStatus.pending,
                ),
            ]
        )
    else:
        if not payload.name:
            raise HTTPException(status_code=400, detail="Group name is required")
        if len(member_ids) < 1:
            raise HTTPException(status_code=400, detail="Group needs at least one other member")

        conversation = models.Conversation(
            type=models.ConversationType.group, name=payload.name, created_by=current_user.id
        )
        db.add(conversation)
        db.flush()
        db.add(
            models.ConversationParticipant(
                conversation_id=conversation.id, user_id=current_user.id, role=models.ParticipantRole.admin
            )
        )
        db.add_all(
            [
                models.ConversationParticipant(conversation_id=conversation.id, user_id=member_id)
                for member_id in member_ids
            ]
        )

    db.commit()
    db.refresh(conversation)
    return _serialize_conversation(db, conversation, current_user.id)


@router.get("/{conversation_id}", response_model=schemas.ConversationOut)
def get_conversation(
    conversation_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    _require_participant(db, conversation_id, current_user.id)
    conversation = db.get(models.Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return _serialize_conversation(db, conversation, current_user.id)


@router.post("/{conversation_id}/respond", status_code=204)
async def respond_to_conversation(
    conversation_id: int,
    payload: schemas.RespondToConversationRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accept, block, or delete a message request. Only ever touches the
    caller's own participant row — the other person's side of the
    conversation is never modified directly by this endpoint."""
    participant = _require_participant(db, conversation_id, current_user.id)
    conversation = db.get(models.Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    other = next((p for p in conversation.participants if p.user_id != current_user.id), None)

    if payload.action == "accept":
        participant.request_status = models.ParticipantRequestStatus.accepted
        db.flush()

        if (
            conversation.type == models.ConversationType.direct
            and other is not None
            and other.request_status == models.ParticipantRequestStatus.accepted
        ):
            # Both sides have now said yes: this is a real contact, and any
            # duplicate thread the two of them started independently while
            # pending gets folded into this one.
            _ensure_mutual_contact(db, current_user.id, other.user_id)
            _merge_duplicate_direct_conversations(db, conversation, current_user.id, other.user_id)

    elif payload.action == "block":
        participant.request_status = models.ParticipantRequestStatus.blocked

    elif payload.action == "delete":
        # Soft-delete: see ConversationParticipant.left_at. The other
        # person's copy (and their view of who I am) is untouched.
        participant.left_at = datetime.utcnow()

    else:
        raise HTTPException(status_code=400, detail="Unknown action")

    db.commit()

    # Let the other person's client know something changed on their thread
    # too (a merge may have just removed one of their conversations, or
    # their "awaiting response" state just flipped).
    if other is not None:
        await manager.send_to_user(other.user_id, {"type": "conversation_updated"})

    return None


@router.post("/{conversation_id}/archive", status_code=204)
def set_archived(
    conversation_id: int,
    payload: schemas.ArchiveRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Archiving is purely a per-user shelf, unrelated to request_status or
    left_at — the conversation stays fully active for everyone, it's just
    hidden from this one person's main list until they unarchive it."""
    participant = _require_participant(db, conversation_id, current_user.id)
    participant.is_archived = payload.archived
    db.commit()
    return None


@router.post("/{conversation_id}/members", response_model=schemas.ConversationOut)
def add_members(
    conversation_id: int,
    payload: schemas.AddMembersRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    participant = _require_participant(db, conversation_id, current_user.id)
    conversation = db.get(models.Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conversation.type != models.ConversationType.group:
        raise HTTPException(status_code=400, detail="Can only add members to group conversations")
    if participant.role != models.ParticipantRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can add members")

    # A previously-removed member still has a (soft-deleted) row here, so
    # re-adding them must reactivate it rather than insert a second row —
    # the (conversation_id, user_id) pair has a uniqueness constraint.
    existing_by_user = {p.user_id: p for p in conversation.participants}
    for member_id in payload.member_ids:
        existing = existing_by_user.get(member_id)
        if existing is None:
            db.add(models.ConversationParticipant(conversation_id=conversation_id, user_id=member_id))
        elif existing.left_at is not None:
            existing.left_at = None

    db.commit()
    db.refresh(conversation)
    return _serialize_conversation(db, conversation, current_user.id)


@router.delete("/{conversation_id}/members/{member_id}", response_model=schemas.ConversationOut)
def remove_member(
    conversation_id: int,
    member_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    participant = _require_participant(db, conversation_id, current_user.id)
    conversation = db.get(models.Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conversation.type != models.ConversationType.group:
        raise HTTPException(status_code=400, detail="Can only remove members from group conversations")
    if participant.role != models.ParticipantRole.admin and current_user.id != member_id:
        raise HTTPException(status_code=403, detail="Only admins can remove other members")

    target = _get_participant(db, conversation_id, member_id)
    if target is not None and target.left_at is None:
        # Soft-delete (see ConversationParticipant.left_at) so their name
        # still resolves correctly on messages they already sent.
        target.left_at = datetime.utcnow()
        db.commit()

    db.refresh(conversation)
    return _serialize_conversation(db, conversation, current_user.id)


@router.post("/{conversation_id}/read", status_code=204)
async def mark_read(
    conversation_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    participant = _require_participant(db, conversation_id, current_user.id)
    participant.last_read_at = datetime.utcnow()

    unread = (
        db.query(models.MessageStatus)
        .join(models.Message)
        .filter(
            models.Message.conversation_id == conversation_id,
            models.MessageStatus.user_id == current_user.id,
            models.MessageStatus.status != models.MessageStatusEnum.read,
        )
        .all()
    )

    # Group unread rows by sender so each sender gets a single WS event
    # listing every message of theirs that just got read, instead of one
    # event per message.
    notify: dict[int, list[int]] = {}
    for status_row in unread:
        status_row.status = models.MessageStatusEnum.read
        status_row.updated_at = datetime.utcnow()
        notify.setdefault(status_row.message.sender_id, []).append(status_row.message_id)
    db.commit()

    for sender_id, message_ids in notify.items():
        await manager.send_to_user(
            sender_id,
            {
                "type": "message_status",
                "conversation_id": conversation_id,
                "message_ids": message_ids,
                "user_id": current_user.id,
                "status": "read",
            },
        )
    return None
