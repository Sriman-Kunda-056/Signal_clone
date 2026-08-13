"""Contacts are read-only from the API's perspective — the only place a
Contact row gets *created* is server-side, in routers/conversations.py, when
a direct conversation becomes mutually accepted. There's deliberately no
"POST /contacts" here: adding someone by hand would bypass the message-request
flow (see models.py `ParticipantRequestStatus`), so starting a chat via
search (POST /conversations) is the only path in.
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=List[schemas.ContactOut])
def list_contacts(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(models.Contact)
        .filter(models.Contact.owner_id == current_user.id)
        .order_by(models.Contact.created_at.desc())
        .all()
    )


@router.get("/search", response_model=List[schemas.UserOut])
def search_users(q: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not q:
        return []
    return (
        db.query(models.User)
        .filter(models.User.id != current_user.id)
        .filter(or_(models.User.username.ilike(f"%{q}%"), models.User.display_name.ilike(f"%{q}%")))
        .limit(20)
        .all()
    )
