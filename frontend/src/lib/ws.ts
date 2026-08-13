import type { Message, MessageStatusValue } from "./types";

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";

export type WsEvent =
  | { type: "new_message"; message: Message }
  | { type: "typing"; conversation_id: number; user_id: number; is_typing: boolean }
  | { type: "presence"; user_id: number; is_online: boolean; last_seen_at?: string }
  | {
      type: "message_status";
      conversation_id: number;
      message_ids: number[];
      user_id: number;
      status: MessageStatusValue;
    }
  // Fired at the *other* participant when someone accepts/blocks/deletes a
  // message request (see routers/conversations.py `respond`). Carries no
  // payload beyond the type — it's just a "go re-fetch your conversation
  // list" nudge, since a merge on the sender's side can also change what
  // the recipient's own list looks like.
  | { type: "conversation_updated" }
  | { type: "pong" };

type Listener = (event: WsEvent) => void;

/**
 * Thin wrapper around a single WebSocket connection with auto-reconnect.
 *
 * One instance is shared for the whole app (see the singleton export at the
 * bottom) rather than one-per-component, because the socket needs to stay
 * alive across navigation between pages/conversations — components just
 * subscribe/unsubscribe to it.
 */
class WsClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private token: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // Backs off exponentially (1s, 2s, 4s, ... capped at 15s) so a server
  // outage doesn't turn into a hammering reconnect loop.
  private reconnectDelay = 1000;
  // Distinguishes "we closed this on purpose" (logout) from "the connection
  // dropped" (network blip, server restart) — only the latter should
  // trigger a reconnect attempt.
  private manualClose = true;

  connect(token: string) {
    this.token = token;
    this.manualClose = false;
    this.open();
  }

  private open() {
    if (!this.token || typeof window === "undefined") return;
    // The browser WebSocket API can't set custom headers on the handshake,
    // so the JWT rides along as a query param instead; the backend reads it
    // the same way it'd read an Authorization header.
    this.socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(this.token)}`);

    this.socket.onopen = () => {
      this.reconnectDelay = 1000;
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsEvent;
        this.listeners.forEach((listener) => listener(data));
      } catch {
        // ignore malformed payloads
      }
    };

    this.socket.onclose = () => {
      if (!this.manualClose) this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 15000);
      this.open();
    }, this.reconnectDelay);
  }

  send(data: Record<string, unknown>) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  sendTyping(conversationId: number, isTyping: boolean) {
    this.send({ type: "typing", conversation_id: conversationId, is_typing: isTyping });
  }

  /** Returns an unsubscribe function — call it in a `useEffect` cleanup. */
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  disconnect() {
    this.manualClose = true;
    this.token = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }
}

export const wsClient = new WsClient();
