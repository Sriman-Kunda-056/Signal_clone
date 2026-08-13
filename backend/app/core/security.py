"""Password hashing and JWT issue/verify.

Auth model: stateless JWTs in the `Authorization: Bearer` header, not
cookies. The frontend is deployed on a different domain than the backend
(Vercel + Render/Fly), so cookie-based sessions would run into third-party
cookie blocking and SameSite restrictions — a bearer token sidesteps all
of that. "Session persistence" just means the frontend keeps this token in
localStorage and re-sends it on reload; there's no server-side session store.
"""

import datetime

import bcrypt
from jose import JWTError, jwt

from .config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: int) -> str:
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> int | None:
    """Returns the user id encoded in the token, or None if it's missing,
    expired, or tampered with — callers treat None as "not authenticated"
    rather than distinguishing why."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None
