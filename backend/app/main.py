import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import inspect, text
from fastapi.middleware.cors import CORSMiddleware

from . import ws
from .core.config import settings
from .database import Base, SessionLocal, engine
from .routers import auth, contacts, conversations, messages
from .seed import seed_if_empty


def _apply_additive_schema_updates() -> None:
    """This project intentionally has no migration dependency. Add columns
    safely for an existing SQLite demo database before new features query
    them; fresh deployments simply find the columns already present."""
    additions = {
        "conversations": {"disappearing_seconds": "INTEGER NOT NULL DEFAULT 0"},
        "messages": {
            "deleted_at": "DATETIME",
            "is_pinned": "BOOLEAN NOT NULL DEFAULT 0",
            "is_forwarded": "BOOLEAN NOT NULL DEFAULT 0",
            "expires_at": "DATETIME",
        },
    }
    inspector = inspect(engine)
    with engine.begin() as connection:
        for table, columns in additions.items():
            existing = {column["name"] for column in inspector.get_columns(table)}
            for name, definition in columns.items():
                if name not in existing:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("data", exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _apply_additive_schema_updates()
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Signal Clone API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(contacts.router)
app.include_router(conversations.router)
app.include_router(messages.router)
app.include_router(ws.router)


@app.get("/health")
def health():
    return {"status": "ok"}
