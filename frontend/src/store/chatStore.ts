import { create } from "zustand";

import { api } from "@/lib/api";
import type { Contact, Conversation, Message, Reaction } from "@/lib/types";
import { wsClient } from "@/lib/ws";
import { useAuthStore } from "@/store/authStore";

function upsertConversation(list: Conversation[], updated: Conversation): Conversation[] {
  const idx = list.findIndex((c) => c.id === updated.id);
  if (idx === -1) return [updated, ...list];
  const copy = [...list];
  copy[idx] = updated;
  return copy;
}

export function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    const aTime = a.last_message?.created_at ?? a.created_at;
    const bTime = b.last_message?.created_at ?? b.created_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

interface ChatState {
  conversations: Conversation[];
  archivedConversations: Conversation[];
  messagesByConversation: Record<number, Message[]>;
  activeConversationId: number | null;
  typingByConversation: Record<number, number[]>;
  onlineUserIds: Set<number>;
  contacts: Contact[];
  loadingConversations: boolean;
  loadingMessages: boolean;
  wsUnsubscribe: (() => void) | null;

  init: () => void;
  teardown: () => void;
  loadConversations: () => Promise<void>;
  loadArchivedConversations: () => Promise<void>;
  loadContacts: () => Promise<void>;
  selectConversation: (id: number | null) => Promise<void>;
  sendMessage: (conversationId: number, content: string, messageType?: "text" | "image" | "file") => Promise<void>;
  setTyping: (conversationId: number, isTyping: boolean) => void;
  createDirectConversation: (otherUserId: number) => Promise<Conversation>;
  createGroupConversation: (name: string, memberIds: number[]) => Promise<Conversation>;
  addMembers: (conversationId: number, memberIds: number[]) => Promise<void>;
  removeMember: (conversationId: number, memberId: number) => Promise<void>;
  /** Accept / block / delete a message request (see `my_status` on Conversation). */
  respondToConversation: (conversationId: number, action: "accept" | "block" | "delete") => Promise<void>;
  /** Moves a conversation between the main list and the Archived Chats view. */
  setArchived: (conversationId: number, archived: boolean) => Promise<void>;
  toggleReaction: (conversationId: number, messageId: number, emoji: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  archivedConversations: [],
  messagesByConversation: {},
  activeConversationId: null,
  typingByConversation: {},
  onlineUserIds: new Set(),
  contacts: [],
  loadingConversations: false,
  loadingMessages: false,
  wsUnsubscribe: null,

  // Wires up the single shared WS connection (lib/ws.ts) to this store's
  // state. Called once per login from app/page.tsx; `wsUnsubscribe` lets
  // teardown() cleanly detach the listener on logout instead of leaking it.
  init: () => {
    get().wsUnsubscribe?.();
    const unsubscribe = wsClient.subscribe((event) => {
      const state = get();
      const currentUserId = useAuthStore.getState().user?.id;

      switch (event.type) {
        case "new_message": {
          const { message } = event;
          const existing = state.messagesByConversation[message.conversation_id] ?? [];
          if (existing.some((m) => m.id === message.id)) return;

          set({
            messagesByConversation: {
              ...state.messagesByConversation,
              [message.conversation_id]: [...existing, message],
            },
          });

          const isActive = state.activeConversationId === message.conversation_id;
          const conv = state.conversations.find((c) => c.id === message.conversation_id);
          if (conv) {
            const shouldCountUnread = !isActive && message.sender_id !== currentUserId;
            set({
              conversations: upsertConversation(get().conversations, {
                ...conv,
                last_message: message,
                unread_count: shouldCountUnread ? conv.unread_count + 1 : conv.unread_count,
              }),
            });
          } else {
            // A message arrived for a conversation we don't have locally yet
            // (e.g. someone just sent us a fresh message request) — simplest
            // correct fix is to refetch the whole list rather than try to
            // reconstruct one conversation's shape from a single WS event.
            get().loadConversations();
          }

          if (isActive && message.sender_id !== currentUserId) {
            api.post(`/conversations/${message.conversation_id}/read`).catch(() => {});
          }
          break;
        }

        case "typing": {
          const current = state.typingByConversation[event.conversation_id] ?? [];
          const next = event.is_typing
            ? Array.from(new Set([...current, event.user_id]))
            : current.filter((id) => id !== event.user_id);
          set({ typingByConversation: { ...state.typingByConversation, [event.conversation_id]: next } });
          break;
        }

        case "presence": {
          const next = new Set(state.onlineUserIds);
          if (event.is_online) next.add(event.user_id);
          else next.delete(event.user_id);
          set({ onlineUserIds: next });
          break;
        }

        case "message_status": {
          const existing = state.messagesByConversation[event.conversation_id] ?? [];
          const messageIds = new Set(event.message_ids);
          const updated = existing.map((m) => {
            if (!messageIds.has(m.id)) return m;
            const hasStatus = m.statuses.some((s) => s.user_id === event.user_id);
            return {
              ...m,
              statuses: hasStatus
                ? m.statuses.map((s) => (s.user_id === event.user_id ? { ...s, status: event.status } : s))
                : [...m.statuses, { user_id: event.user_id, status: event.status }],
            };
          });
          set({
            messagesByConversation: { ...state.messagesByConversation, [event.conversation_id]: updated },
          });
          break;
        }

        case "conversation_updated": {
          // The other side of one of our conversations just accepted,
          // blocked, or deleted a request — a merge may have removed one of
          // our own duplicate threads, or a new mutual contact may exist.
          // Rather than guess at the diff, just refetch both lists.
          get().loadConversations();
          get().loadContacts();
          break;
        }

        case "message_reaction": {
          const existing = state.messagesByConversation[event.conversation_id] ?? [];
          const updated = existing.map((m) => (m.id === event.message_id ? { ...m, reactions: event.reactions } : m));
          set({
            messagesByConversation: { ...state.messagesByConversation, [event.conversation_id]: updated },
          });
          break;
        }
      }
    });
    set({ wsUnsubscribe: unsubscribe });
  },

  teardown: () => {
    get().wsUnsubscribe?.();
    set({
      conversations: [],
      archivedConversations: [],
      messagesByConversation: {},
      activeConversationId: null,
      typingByConversation: {},
      onlineUserIds: new Set(),
      contacts: [],
      wsUnsubscribe: null,
    });
  },

  loadConversations: async () => {
    set({ loadingConversations: true });
    try {
      const conversations = await api.get<Conversation[]>("/conversations");
      set({ conversations });
    } finally {
      set({ loadingConversations: false });
    }
  },

  loadArchivedConversations: async () => {
    const archivedConversations = await api.get<Conversation[]>("/conversations?archived=true");
    set({ archivedConversations });
  },

  loadContacts: async () => {
    const contacts = await api.get<Contact[]>("/contacts");
    set({ contacts });
  },

  selectConversation: async (id) => {
    set({ activeConversationId: id });
    if (id === null) return;

    if (!get().messagesByConversation[id]) {
      set({ loadingMessages: true });
      try {
        const messages = await api.get<Message[]>(`/conversations/${id}/messages`);
        set({ messagesByConversation: { ...get().messagesByConversation, [id]: messages } });
      } finally {
        set({ loadingMessages: false });
      }
    }

    const conv = get().conversations.find((c) => c.id === id);
    if (conv && conv.unread_count > 0) {
      set({ conversations: upsertConversation(get().conversations, { ...conv, unread_count: 0 }) });
    }
    api.post(`/conversations/${id}/read`).catch(() => {});
  },

  sendMessage: async (conversationId, content, messageType = "text") => {
    const message = await api.post<Message>(`/conversations/${conversationId}/messages`, {
      content,
      message_type: messageType,
    });
    const state = get();
    const existing = state.messagesByConversation[conversationId] ?? [];
    if (!existing.some((m) => m.id === message.id)) {
      set({
        messagesByConversation: { ...state.messagesByConversation, [conversationId]: [...existing, message] },
      });
    }
    const conv = state.conversations.find((c) => c.id === conversationId);
    if (conv) {
      set({ conversations: upsertConversation(get().conversations, { ...conv, last_message: message }) });
    }
  },

  setTyping: (conversationId, isTyping) => {
    wsClient.sendTyping(conversationId, isTyping);
  },

  // Note: this never adds a Contact directly. If there's no existing
  // *mutually accepted* thread with this user, the backend creates a brand
  // new conversation with them as `pending` — a message request on their
  // side. Contacts only appear once they (or we) accept it.
  createDirectConversation: async (otherUserId) => {
    const conversation = await api.post<Conversation>("/conversations", {
      type: "direct",
      member_ids: [otherUserId],
    });
    set({ conversations: upsertConversation(get().conversations, conversation) });
    return conversation;
  },

  createGroupConversation: async (name, memberIds) => {
    const conversation = await api.post<Conversation>("/conversations", {
      type: "group",
      name,
      member_ids: memberIds,
    });
    set({ conversations: upsertConversation(get().conversations, conversation) });
    return conversation;
  },

  addMembers: async (conversationId, memberIds) => {
    const conversation = await api.post<Conversation>(`/conversations/${conversationId}/members`, {
      member_ids: memberIds,
    });
    set({ conversations: upsertConversation(get().conversations, conversation) });
  },

  removeMember: async (conversationId, memberId) => {
    const conversation = await api.delete<Conversation>(`/conversations/${conversationId}/members/${memberId}`);
    set({ conversations: upsertConversation(get().conversations, conversation) });
  },

  respondToConversation: async (conversationId, action) => {
    await api.post(`/conversations/${conversationId}/respond`, { action });
    // The backend may have merged a duplicate thread into this one (on
    // accept) or removed it entirely (on delete) — refetch rather than try
    // to patch local state, since the shape of the list itself can change.
    await get().loadConversations();
    await get().loadContacts();
    if (action === "delete" && get().activeConversationId === conversationId) {
      set({ activeConversationId: null });
    }
  },

  setArchived: async (conversationId, archived) => {
    await api.post(`/conversations/${conversationId}/archive`, { archived });
    // A conversation moves wholesale between the two lists rather than just
    // flipping a flag in place, so both views stay accurate without a
    // second round-trip to figure out which list it belongs in now.
    const state = get();
    if (archived) {
      const conv = state.conversations.find((c) => c.id === conversationId);
      set({
        conversations: state.conversations.filter((c) => c.id !== conversationId),
        archivedConversations: conv
          ? upsertConversation(state.archivedConversations, { ...conv, is_archived: true })
          : state.archivedConversations,
      });
      if (state.activeConversationId === conversationId) set({ activeConversationId: null });
    } else {
      const conv = state.archivedConversations.find((c) => c.id === conversationId);
      set({
        archivedConversations: state.archivedConversations.filter((c) => c.id !== conversationId),
        conversations: conv ? upsertConversation(state.conversations, { ...conv, is_archived: false }) : state.conversations,
      });
    }
  },

  toggleReaction: async (conversationId, messageId, emoji) => {
    const currentUserId = useAuthStore.getState().user?.id;
    const existing = get()
      .messagesByConversation[conversationId]
      ?.find((m) => m.id === messageId)
      ?.reactions.find((r) => r.user_id === currentUserId);

    // Optimistic update: the WS event will confirm/correct this shortly,
    // but reacting should feel instant rather than waiting on a round-trip.
    const applyLocal = (reactions: Reaction[]) => {
      const existingMsgs = get().messagesByConversation[conversationId] ?? [];
      set({
        messagesByConversation: {
          ...get().messagesByConversation,
          [conversationId]: existingMsgs.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
        },
      });
    };

    const message = get().messagesByConversation[conversationId]?.find((m) => m.id === messageId);
    const others = (message?.reactions ?? []).filter((r) => r.user_id !== currentUserId);

    if (existing?.emoji === emoji) {
      applyLocal(others);
      await api.delete(`/conversations/${conversationId}/messages/${messageId}/reactions`);
    } else {
      applyLocal(currentUserId ? [...others, { user_id: currentUserId, emoji }] : others);
      await api.post(`/conversations/${conversationId}/messages/${messageId}/reactions`, { emoji });
    }
  },
}));
