from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..ws import manager

router = APIRouter(prefix="/conversations", tags=["messages"])


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

    q = db.query(models.Message).filter(models.Message.conversation_id == conversation_id)
    if before_id is not None:
        q = q.filter(models.Message.id < before_id)
    # Sort by (created_at, id) rather than just id: after two message-request
    # threads merge (see conversations.py), messages carried over from the
    # other thread keep their original ids, which are no longer guaranteed
    # to be chronological relative to this conversation's own id sequence.
    messages = q.order_by(models.Message.created_at.desc(), models.Message.id.desc()).limit(limit).all()
    return list(reversed(messages))


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

    message = models.Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=payload.content,
        message_type=payload.message_type,
        reply_to_message_id=payload.reply_to_message_id,
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

    out = schemas.MessageOut.model_validate(message)
    payload_json = out.model_dump(mode="json")
    for recipient_id in recipient_ids:
        await manager.send_to_user(recipient_id, {"type": "new_message", "message": payload_json})

    return out


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
