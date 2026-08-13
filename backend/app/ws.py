"""The real-time layer: one `/ws` endpoint per connection, authenticated by
a JWT passed as a query param (browsers can't set custom headers on the
WebSocket handshake, so this is the standard workaround).

Messages themselves are never *created* here — REST endpoints
(routers/messages.py, routers/conversations.py) are the source of truth
and call into `manager` to push events after committing to the DB. This
file only owns the live socket bookkeeping and two purely-ephemeral,
never-persisted events: typing indicators and presence pings.
"""

import json
from typing import Dict, Set

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from . import models
from .core.security import decode_access_token
from .database import SessionLocal

router = APIRouter()


class ConnectionManager:
    """Tracks live WebSocket connections per user. A user can have more than
    one open connection (multiple tabs/devices), hence a set of sockets per
    user_id rather than a single one — every event fans out to all of them."""

    def __init__(self) -> None:
        self.active: Dict[int, Set[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        conns = self.active.get(user_id)
        if conns and websocket in conns:
            conns.remove(websocket)
            if not conns:
                del self.active[user_id]

    def is_online(self, user_id: int) -> bool:
        return bool(self.active.get(user_id))

    async def send_to_user(self, user_id: int, message: dict) -> None:
        # Best-effort: a socket can die between the online check and the
        # send (client closed the tab, network blip). Swallow and move on
        # rather than letting one dead connection break the whole broadcast.
        for connection in list(self.active.get(user_id, ())):
            try:
                await connection.send_json(message)
            except Exception:
                pass

    async def broadcast_to_users(self, user_ids, message: dict) -> None:
        for user_id in user_ids:
            await self.send_to_user(user_id, message)


# Process-wide singleton — fine for a single-instance deployment (which is
# what a free-tier host gives you anyway). Multiple backend instances would
# need a shared pub/sub layer (Redis, etc.) instead of this in-memory dict.
manager = ConnectionManager()


def _contact_owner_ids(db, user_id: int) -> list[int]:
    """Everyone who has *this* user in their contacts — i.e. who should be
    told when this user's online/offline status changes."""
    rows = db.query(models.Contact.owner_id).filter(models.Contact.contact_id == user_id).all()
    return [row[0] for row in rows]


def _participant_ids(db, conversation_id: int) -> list[int]:
    rows = (
        db.query(models.ConversationParticipant.user_id)
        .filter(models.ConversationParticipant.conversation_id == conversation_id)
        .all()
    )
    return [row[0] for row in rows]


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    user_id = decode_access_token(token)
    if user_id is None:
        await websocket.close(code=4401)
        return

    # This connection gets its own DB session for its whole lifetime rather
    # than the usual per-request `get_db()` dependency, since a WebSocket
    # isn't a single request/response — it's a long-lived loop.
    db = SessionLocal()
    user = db.get(models.User, user_id)
    if user is None:
        await websocket.close(code=4401)
        db.close()
        return

    await manager.connect(user_id, websocket)
    user.is_online = True
    db.commit()

    contact_owner_ids = _contact_owner_ids(db, user_id)
    await manager.broadcast_to_users(
        contact_owner_ids, {"type": "presence", "user_id": user_id, "is_online": True}
    )

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            event_type = data.get("type")

            if event_type == "typing":
                conversation_id = data.get("conversation_id")
                if conversation_id is None:
                    continue
                participant_ids = _participant_ids(db, conversation_id)
                await manager.broadcast_to_users(
                    [uid for uid in participant_ids if uid != user_id],
                    {
                        "type": "typing",
                        "conversation_id": conversation_id,
                        "user_id": user_id,
                        "is_typing": bool(data.get("is_typing")),
                    },
                )
            elif event_type == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        # Only flip to "offline" once ALL of this user's connections are
        # gone (they might still have another tab open).
        manager.disconnect(user_id, websocket)
        if not manager.is_online(user_id):
            user.is_online = False
            user.last_seen_at = models.utcnow()
            db.commit()
            await manager.broadcast_to_users(
                contact_owner_ids,
                {
                    "type": "presence",
                    "user_id": user_id,
                    "is_online": False,
                    "last_seen_at": user.last_seen_at.isoformat(),
                },
            )
        db.close()
