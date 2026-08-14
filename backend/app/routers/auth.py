from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..core.config import settings
from ..core.security import create_access_token, hash_password, verify_password
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    if payload.otp != settings.MOCK_OTP:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    if db.query(models.User).filter(models.User.phone_number == payload.phone_number).first():
        raise HTTPException(status_code=400, detail="Phone number already registered")

    user = models.User(
        username=payload.username,
        phone_number=payload.phone_number,
        display_name=payload.display_name,
        avatar_url=payload.avatar_url,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return schemas.TokenResponse(access_token=token, user=schemas.UserOut.model_validate(user))


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(user.id)
    return schemas.TokenResponse(access_token=token, user=schemas.UserOut.model_validate(user))


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=schemas.UserOut)
def update_profile(
    payload: schemas.ProfileUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Partial update — only fields actually present in the request body are
    touched, so sending just an avatar doesn't blank out the display name."""
    fields = payload.model_dump(exclude_unset=True)
    if "display_name" in fields and fields["display_name"]:
        current_user.display_name = fields["display_name"]
    if "avatar_url" in fields:
        current_user.avatar_url = fields["avatar_url"]
    db.commit()
    db.refresh(current_user)
    return current_user
