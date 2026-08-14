import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..ws import manager

router = APIRouter(prefix="/conversations", tags=["messages"])


def _message_out(message: models.Message) -> schemas.MessageOut:
    """Build the API shape in one place, including the small quoted preview."""
    out = schemas.MessageOut.model_validate(message)
    if message.reply_to is not None:
        out.reply_preview = schemas.ReplyPreview(
            id=message.reply_to.id,
            sender_name=message.reply_to.sender.display_name,
            content=message.reply_to.content,
            message_type=message.reply_to.message_type,
        )
    return out


def _require_participant(db: Session, conversation_id: int, user_id: int) -> models.ConversationParticipant:
    # left_at is set: they deleted this direct chat, or were removed from
    # this group — either way, no further reading or sending for them here.
    # (See ConversationParticipant.left_at in models.py.)
    participant = (
        db.query(models.ConversationParticipant)
        .filter(
            models.ConversationParticipant.conversation_id == conversation_id,
            models.ConversationParticipant.user_id == user_id,
            models.ConversationParticipant.left_at.is_(None),
        )
        .first()
    )
    if participant is None:
        raise HTTPException(status_code=403, detail="Not a participant of this conversation")
    return participant


@router.get("/{conversation_id}/messages", response_model=List[schemas.MessageOut])
def list_messages(
    conversation_id: int,
    before_id: Optional[int] = Query(default=None),
    limit: int = Query(default=50, le=200),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_participant(db, conversation_id, current_user.id)

    q = db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id,
        (models.Message.expires_at.is_(None)) | (models.Message.expires_at > datetime.datetime.utcnow()),
    )
    if before_id is not None:
        q = q.filter(models.Message.id < before_id)
    # Sort by (created_at, id) rather than just id: after two message-request
    # threads merge (see conversations.py), messages carried over from the
    # other thread keep their original ids, which are no longer guaranteed
    # to be chronological relative to this conversation's own id sequence.
    messages = q.order_by(models.Message.created_at.desc(), models.Message.id.desc()).limit(limit).all()
    return [_message_out(message) for message in reversed(messages)]


@router.post("/{conversation_id}/messages", response_model=schemas.MessageOut, status_code=201)
async def send_message(
    conversation_id: int,
    payload: schemas.MessageCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    participant = _require_participant(db, conversation_id, current_user.id)
    # A pending recipient must Accept before they can reply — the frontend
    # swaps the composer for a request banner, but this is the real guard.
    if participant.request_status != models.ParticipantRequestStatus.accepted:
        raise HTTPException(status_code=403, detail="Accept this conversation before replying")

    if payload.reply_to_message_id is not None:
        replied_to = db.get(models.Message, payload.reply_to_message_id)
        if replied_to is None or replied_to.conversation_id != conversation_id:
            raise HTTPException(status_code=400, detail="Reply target is not in this conversation")

    conversation = db.get(models.Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    expires_at = None
    if conversation.disappearing_seconds:
        expires_at = datetime.datetime.utcnow() + datetime.timedelta(seconds=conversation.disappearing_seconds)

    message = models.Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=payload.content,
        message_type=payload.message_type,
        reply_to_message_id=payload.reply_to_message_id,
        is_forwarded=payload.is_forwarded,
        expires_at=expires_at,
    )
    db.add(message)
    db.flush()

    # Only people still actively in the conversation get a status row / WS
    # push — someone who deleted the chat or was removed from the group
    # shouldn't be notified of new messages they can no longer see.
    participant_ids = [
        row[0]
        for row in db.query(models.ConversationParticipant.user_id)
        .filter(
            models.ConversationParticipant.conversation_id == conversation_id,
            models.ConversationParticipant.left_at.is_(None),
        )
        .all()
    ]
    recipient_ids = [uid for uid in participant_ids if uid != current_user.id]

    for recipient_id in recipient_ids:
        initial_status = (
            models.MessageStatusEnum.delivered if manager.is_online(recipient_id) else models.MessageStatusEnum.sent
        )
        db.add(models.MessageStatus(message_id=message.id, user_id=recipient_id, status=initial_status))

    db.commit()
    db.refresh(message)

    out = _message_out(message)
    payload_json = out.model_dump(mode="json")
    for recipient_id in recipient_ids:
        await manager.send_to_user(recipient_id, {"type": "new_message", "message": payload_json})

    return out


@router.delete("/{conversation_id}/messages/{message_id}", status_code=204)
async def delete_message(
    conversation_id: int, message_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    _require_participant(db, conversation_id, current_user.id)
    message = db.get(models.Message, message_id)
    if message is None or message.conversation_id != conversation_id:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")
    message.deleted_at = datetime.datetime.utcnow()
    message.content = ""
    db.commit()
    for user_id in _active_participant_ids(db, conversation_id):
        await manager.send_to_user(user_id, {"type": "conversation_updated"})


@router.post("/{conversation_id}/messages/{message_id}/pin", response_model=schemas.MessageOut)
async def toggle_pin(
    conversation_id: int, message_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    _require_participant(db, conversation_id, current_user.id)
    message = db.get(models.Message, message_id)
    if message is None or message.conversation_id != conversation_id:
        raise HTTPException(status_code=404, detail="Message not found")
    message.is_pinned = not message.is_pinned
    db.commit()
    db.refresh(message)
    return _message_out(message)


@router.post("/{conversation_id}/messages/forward", response_model=List[schemas.MessageOut], status_code=201)
async def forward_messages(
    conversation_id: int, payload: schemas.ForwardRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    _require_participant(db, conversation_id, current_user.id)
    originals = db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id, models.Message.id.in_(payload.message_ids), models.Message.deleted_at.is_(None)
    ).all()
    if len(originals) != len(set(payload.message_ids)):
        raise HTTPException(status_code=400, detail="One or more messages cannot be forwarded")
    created: list[models.Message] = []
    for target_id in set(payload.target_conversation_ids):
        target_participant = _require_participant(db, target_id, current_user.id)
        if target_participant.request_status != models.ParticipantRequestStatus.accepted:
            raise HTTPException(status_code=403, detail="Accept this conversation before forwarding")
        target = db.get(models.Conversation, target_id)
        for original in originals:
            expiry = (datetime.datetime.utcnow() + datetime.timedelta(seconds=target.disappearing_seconds)) if target.disappearing_seconds else None
            copied = models.Message(conversation_id=target_id, sender_id=current_user.id, content=original.content, message_type=original.message_type, is_forwarded=True, expires_at=expiry)
            db.add(copied)
            created.append(copied)
    db.commit()
    for message in created:
        db.refresh(message)
        for user_id in _active_participant_ids(db, message.conversation_id):
            if user_id != current_user.id:
                await manager.send_to_user(user_id, {"type": "new_message", "message": _message_out(message).model_dump(mode="json")})
    return [_message_out(message) for message in created]


def _active_participant_ids(db: Session, conversation_id: int) -> list[int]:
    return [
        row[0]
        for row in db.query(models.ConversationParticipant.user_id)
        .filter(
            models.ConversationParticipant.conversation_id == conversation_id,
            models.ConversationParticipant.left_at.is_(None),
        )
        .all()
    ]


async def _broadcast_reactions(db: Session, conversation_id: int, message: models.Message, actor_id: int) -> None:
    reactions = [{"user_id": r.user_id, "emoji": r.emoji} for r in message.reactions]
    payload = {
        "type": "message_reaction",
        "conversation_id": conversation_id,
        "message_id": message.id,
        "reactions": reactions,
    }
    for participant_id in _active_participant_ids(db, conversation_id):
        if participant_id != actor_id:
            await manager.send_to_user(participant_id, payload)


@router.post("/{conversation_id}/messages/{message_id}/reactions", status_code=204)
async def add_reaction(
    conversation_id: int,
    message_id: int,
    payload: schemas.ReactionCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_participant(db, conversation_id, current_user.id)
    message = db.get(models.Message, message_id)
    if message is None or message.conversation_id != conversation_id:
        raise HTTPException(status_code=404, detail="Message not found")

    # One reaction per person per message — reacting again (even with a
    # different emoji) replaces the old one rather than stacking, matching
    # Signal's real behavior. The unique constraint on (message_id, user_id)
    # is what makes "delete then insert" safe here.
    existing = (
        db.query(models.MessageReaction)
        .filter(models.MessageReaction.message_id == message_id, models.MessageReaction.user_id == current_user.id)
        .first()
    )
    if existing is not None:
        existing.emoji = payload.emoji
    else:
        db.add(models.MessageReaction(message_id=message_id, user_id=current_user.id, emoji=payload.emoji))
    db.commit()
    db.refresh(message)

    await _broadcast_reactions(db, conversation_id, message, current_user.id)
    return None


@router.delete("/{conversation_id}/messages/{message_id}/reactions", status_code=204)
async def remove_reaction(
    conversation_id: int,
    message_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_participant(db, conversation_id, current_user.id)
    message = db.get(models.Message, message_id)
    if message is None or message.conversation_id != conversation_id:
        raise HTTPException(status_code=404, detail="Message not found")

    existing = (
        db.query(models.MessageReaction)
        .filter(models.MessageReaction.message_id == message_id, models.MessageReaction.user_id == current_user.id)
        .first()
    )
    if existing is not None:
        db.delete(existing)
        db.commit()
        db.refresh(message)

    await _broadcast_reactions(db, conversation_id, message, current_user.id)
    return None
