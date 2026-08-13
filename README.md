# Signal Clone

A functional clone of Signal's messaging app — real-time one-on-one and group chat, message requests (Accept/Block/Delete), typing indicators, read receipts, and presence — built for the Scaler SDE Fullstack assignment.

**Live demo:** _deploying — link goes here_
**Repo:** https://github.com/Sriman-Kunda-056/Signal_clone

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript), Tailwind CSS v4, Zustand |
| Backend | FastAPI (Python), SQLAlchemy |
| Database | SQLite |
| Real-time | Native WebSockets (one connection per client, JWT-authenticated) |
| Auth | JWT bearer tokens (not cookies — see [Architecture](#architecture)) |

## Features

- **Auth** — register with a mocked OTP flow (code is always `123456`), login/logout, session persisted client-side via JWT.
- **Contacts & conversation list** — search, unread badges, last-message preview, online/last-seen, sorted by recent activity.
- **1:1 messaging** — real-time delivery, typing indicators, delivery/read receipts (sent → delivered → read), all persisted.
- **Message requests** — starting a chat with someone you don't already have an accepted relationship with opens as a request on their side (Accept/Block/Delete), matching Signal's real behavior — including the quirk where two people messaging each other independently before either accepts get two separate threads that merge into one once somebody accepts. See [Assumptions](#assumptions--design-notes).
- **Group messaging** — create groups, add/remove members (admin-only), member list, persisted history.
- **Signal-accurate UI** — left icon rail (Chats/Calls/Stories, collapsible), Signal's actual color tokens, timestamp-in-bubble layout, dark/light theme.
- **Placeholders** — voice/video calls, Stories, linked devices, and (necessarily) screenshot security are all present as "Coming soon" rather than silently missing — see below for why screenshot security specifically can't be real.

## Architecture

```
frontend/  Next.js client — REST for CRUD, one WebSocket for everything live
backend/   FastAPI — routers/ (REST), ws.py (the WebSocket endpoint + connection manager)
```

- **Auth is JWT-in-header, not cookies.** The frontend and backend are deployed on different domains (Vercel + Fly.io), which rules out cookie sessions (third-party cookie blocking, SameSite). The frontend stores the token client-side and sends `Authorization: Bearer <token>`.
- **REST is the source of truth; WebSocket is the delivery mechanism.** Sending a message is a `POST`, which persists to the DB first and then pushes a `new_message` event over the socket to whoever's online. Typing indicators and presence are WebSocket-only and never persisted.
- **One `/ws` connection per client**, authenticated via a `token` query param (the browser WebSocket API can't set custom headers on the handshake). A user can have multiple sockets open (multiple tabs) — the connection manager fans events out to all of them and only marks a user offline once every socket has closed.

## Database schema

- **users** — `id, username, display_name, avatar_url, password_hash, is_online, last_seen_at, created_at`
- **contacts** — `id, owner_id → users, contact_id → users, created_at`. Self-referential; only ever created server-side when a direct conversation becomes mutually accepted (never by directly "adding" someone).
- **conversations** — `id, type (direct|group), name, avatar_url, created_by, created_at`
- **conversation_participants** — `id, conversation_id, user_id, role (admin|member), request_status (accepted|pending|blocked), joined_at, last_read_at, left_at`. The join table between users and conversations; `request_status` drives the message-request UI, `left_at` is a soft-delete marker (see [Assumptions](#assumptions--design-notes)).
- **messages** — `id, conversation_id, sender_id, content, message_type, reply_to_message_id, created_at`
- **message_status** — `id, message_id, user_id, status (sent|delivered|read), updated_at`. One row per (message, recipient) pair, so read receipts work correctly in groups.

Relationships: `users` 1—N `contacts` (self-referential), `users` N—N `conversations` via `conversation_participants`, `conversations` 1—N `messages`, `messages` 1—N `message_status`.

## API overview

All routes except `/auth/register` and `/auth/login` require `Authorization: Bearer <token>`.

**Auth** — `POST /auth/register`, `POST /auth/login`, `GET /auth/me`

**Contacts** — `GET /contacts`, `GET /contacts/search?q=`

**Conversations**
- `GET /conversations` — list, sorted by last activity
- `POST /conversations` — create/open a direct or group conversation
- `GET /conversations/{id}`
- `POST /conversations/{id}/respond` — `{action: accept|block|delete}` on a message request
- `POST /conversations/{id}/members`, `DELETE /conversations/{id}/members/{member_id}` — group admin only
- `POST /conversations/{id}/read` — mark read, triggers read-receipt push

**Messages** — `GET /conversations/{id}/messages`, `POST /conversations/{id}/messages`

**WebSocket** — `GET /ws?token=<jwt>` — events: `new_message`, `typing`, `presence`, `message_status`, `conversation_updated`

## Setup

**Backend**

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate   # .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env     # adjust JWT_SECRET, CORS_ORIGINS
uvicorn app.main:app --reload --port 8000
```

The SQLite DB auto-creates and seeds demo data (six users, existing conversations, a group) on first run if empty.

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL / NEXT_PUBLIC_WS_URL
npm run dev
```

Visit `http://localhost:3000`.

**Demo accounts** (seeded, password `password123` for all): `rajini`, `kamal`, `prabhas`, `vijay`, `dhanush`, `allu`.

## Assumptions & design notes

- **Message requests fully implemented, including the duplicate-thread edge case.** A brand-new direct chat is never silently merged into an existing unaccepted one — so if two people message each other independently before either accepts, they get two separate threads, which fold into one (messages merged in chronological order, mutual contact created) the moment either side accepts.
- **Soft delete, not hard delete.** Deleting a message request or removing a group member sets a `left_at` timestamp rather than deleting the row — a hard delete would erase that person's name/avatar from the remaining participant's copy of the conversation (their identity was only ever resolved through that row). Message sender identity is resolved from the message's own `sender` field, independent of current group membership, for the same reason.
- **Screenshot/screen-security is a "Coming soon" placeholder, not a real feature — and can't be one.** Signal's screenshot blocking (Android `FLAG_SECURE`, iOS capture detection) is an OS capability with no web equivalent; no browser API can see or block PrintScreen/Snipping Tool. Faking it with a blur-on-blur trick would be misleading, so it's an honest placeholder in Settings instead.
- **Group conversations don't have request/accept semantics** — only direct chats do, matching the assignment's core requirements. Group join-requests are a separate, more complex system in real Signal and out of scope here.
- **Real end-to-end encryption is mocked**, as explicitly permitted by the assignment — the UI shows a notice that encryption is simulated.
- **Contacts are derived, not manually managed.** There's no standalone "add contact" action; contacts are created automatically once a direct conversation becomes mutually accepted, which is also what populates the "New Group" member picker.

## Deployment

- **Frontend:** Vercel, auto-deploys from this repo.
- **Backend:** Fly.io (FastAPI + WebSockets, Docker), with a persistent volume backing the SQLite file so data survives redeploys.
- CORS on the backend allow-lists only the deployed frontend origin; `allow_credentials=False` since auth is header-based.
