from sqlalchemy.orm import Session

from . import models
from .core.security import hash_password

DEMO_PASSWORD = "password123"

DEMO_USERS = [
    ("rajini", "Rajinikanth", "+91 98765 43210"),
    ("kamal", "Kamal Haasan", "+91 98765 43211"),
    ("prabhas", "Prabhas", "+91 98765 43212"),
    ("vijay", "Vijay", "+91 98765 43213"),
    ("dhanush", "Dhanush", "+91 98765 43214"),
    ("allu", "Allu Arjun", "+91 98765 43215"),
]


def seed_if_empty(db: Session) -> None:
    if db.query(models.User).count() > 0:
        return

    users = {}
    for username, display_name, phone_number in DEMO_USERS:
        user = models.User(
            username=username,
            phone_number=phone_number,
            display_name=display_name,
            password_hash=hash_password(DEMO_PASSWORD),
        )
        db.add(user)
        users[username] = user
    db.flush()

    def make_direct(u1: str, u2: str, thread: list[tuple[str, str]]) -> None:
        conv = models.Conversation(type=models.ConversationType.direct, created_by=users[u1].id)
        db.add(conv)
        db.flush()
        # Seeded pairs are already-established relationships, not fresh
        # message requests — both sides start `accepted` (the column default,
        # spelled out here so the seed data's intent is obvious at a glance).
        db.add_all(
            [
                models.ConversationParticipant(
                    conversation_id=conv.id, user_id=users[u1].id, request_status=models.ParticipantRequestStatus.accepted
                ),
                models.ConversationParticipant(
                    conversation_id=conv.id, user_id=users[u2].id, request_status=models.ParticipantRequestStatus.accepted
                ),
            ]
        )
        for sender, content in thread:
            msg = models.Message(conversation_id=conv.id, sender_id=users[sender].id, content=content)
            db.add(msg)
            db.flush()
            recipient = u2 if sender == u1 else u1
            db.add(models.MessageStatus(message_id=msg.id, user_id=users[recipient].id, status=models.MessageStatusEnum.read))

    make_direct(
        "rajini",
        "kamal",
        [
            ("rajini", "Hey Kamal! Are we still on for tomorrow's shoot?"),
            ("kamal", "Yep, 10am works for me."),
            ("rajini", "Perfect, see you then 👍"),
        ],
    )
    make_direct(
        "rajini",
        "prabhas",
        [
            ("prabhas", "Loved the photos from the trip!"),
            ("rajini", "Thank you! It was such a good time."),
        ],
    )
    make_direct(
        "kamal",
        "vijay",
        [
            ("vijay", "Can you review my script draft when you get a chance?"),
            ("kamal", "On it."),
        ],
    )

    group = models.Conversation(type=models.ConversationType.group, name="Weekend Trip \U0001f3d4️", created_by=users["rajini"].id)
    db.add(group)
    db.flush()
    db.add_all(
        [
            models.ConversationParticipant(conversation_id=group.id, user_id=users["rajini"].id, role=models.ParticipantRole.admin),
            models.ConversationParticipant(conversation_id=group.id, user_id=users["kamal"].id),
            models.ConversationParticipant(conversation_id=group.id, user_id=users["prabhas"].id),
            models.ConversationParticipant(conversation_id=group.id, user_id=users["vijay"].id),
        ]
    )
    for sender, content in [
        ("rajini", "Excited for the trip this weekend!"),
        ("kamal", "Same! What time should we leave?"),
        ("prabhas", "I'm thinking 7am to beat traffic."),
        ("vijay", "Works for me \U0001f64c"),
    ]:
        db.add(models.Message(conversation_id=group.id, sender_id=users[sender].id, content=content))

    contact_pairs = [
        ("rajini", "kamal"), ("kamal", "rajini"),
        ("rajini", "prabhas"), ("prabhas", "rajini"),
        ("kamal", "vijay"), ("vijay", "kamal"),
        ("rajini", "vijay"), ("vijay", "rajini"),
        ("rajini", "dhanush"), ("dhanush", "rajini"),
        ("rajini", "allu"), ("allu", "rajini"),
    ]
    for owner, contact in contact_pairs:
        db.add(models.Contact(owner_id=users[owner].id, contact_id=users[contact].id))

    db.commit()
