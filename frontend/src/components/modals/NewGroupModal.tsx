"use client";

import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { inputClass, inputStyle } from "@/lib/ui";
import { useChatStore } from "@/store/chatStore";

interface NewGroupModalProps {
  onClose: () => void;
  onOpenConversation: (conversationId: number) => void;
}

export function NewGroupModal({ onClose, onOpenConversation }: NewGroupModalProps) {
  const contacts = useChatStore((s) => s.contacts);
  const loadContacts = useChatStore((s) => s.loadContacts);
  const createGroupConversation = useChatStore((s) => s.createGroupConversation);

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!name.trim() || selected.size === 0) return;
    setCreating(true);
    try {
      const conversation = await createGroupConversation(name.trim(), Array.from(selected));
      onOpenConversation(conversation.id);
      onClose();
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal title="New group" onClose={onClose}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Group name"
        autoFocus
        className={inputClass}
        style={inputStyle}
      />

      <p className="mt-4 mb-2 text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
        Add members ({selected.size} selected)
      </p>
      <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {contacts.length === 0 && (
          <p className="py-4 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
            You don&apos;t have any contacts yet. Start a direct chat first.
          </p>
        )}
        {contacts.map(({ contact }) => (
          <label key={contact.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:opacity-80">
            <input type="checkbox" checked={selected.has(contact.id)} onChange={() => toggle(contact.id)} className="h-4 w-4" />
            <Avatar id={contact.id} name={contact.display_name} size={32} />
            <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>
              {contact.display_name}
            </span>
          </label>
        ))}
      </div>

      <button
        onClick={handleCreate}
        disabled={!name.trim() || selected.size === 0 || creating}
        className="mt-4 w-full rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--color-accent)" }}
      >
        {creating ? "Creating…" : "Create group"}
      </button>
    </Modal>
  );
}
