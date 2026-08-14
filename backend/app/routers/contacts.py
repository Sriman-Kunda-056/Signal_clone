"""Contacts are read-only from the API's perspective — the only place a
Contact row gets *created* is server-side, in routers/conversations.py, when
a direct conversation becomes mutually accepted. There's deliberately no
"POST /contacts" here: adding someone by hand would bypass the message-request
flow (see models.py `ParticipantRequestStatus`), so starting a chat via
search (POST /conversations) is the only path in.
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
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
    term = q.strip()

    # The UI renders usernames as "@kamal", so people naturally type the "@"
    # back when searching — but it isn't part of the stored username, and a
    # literal "%@kamal%" LIKE matches nothing. Strip it before querying.
    # Same idea for phone numbers, which are stored with spaces/"+" but get
    # typed inconsistently: compare digits-only on both sides.
    if term.startswith("@"):
        term = term[1:].strip()
    if not term:
        return []

    digits = "".join(ch for ch in term if ch.isdigit())

    conditions = [
        models.User.username.ilike(f"%{term}%"),
        models.User.display_name.ilike(f"%{term}%"),
    ]
    if digits:
        # SQLite has no regex/translate, so normalize the stored value by
        # nesting replace() calls over the characters we actually allow in
        # seeded/entered phone numbers.
        normalized_phone = func.replace(
            func.replace(func.replace(models.User.phone_number, " ", ""), "-", ""), "+", ""
        )
        conditions.append(normalized_phone.like(f"%{digits}%"))

    return (
        db.query(models.User)
        .filter(models.User.id != current_user.id)
        .filter(or_(*conditions))
        .limit(20)
        .all()
    )
