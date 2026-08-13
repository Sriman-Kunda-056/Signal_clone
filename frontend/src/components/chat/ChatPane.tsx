"use client";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageInput } from "@/components/chat/MessageInput";
import { MessageList } from "@/components/chat/MessageList";
import { MessageRequestBanner } from "@/components/chat/MessageRequestBanner";
import type { Conversation, Message, User } from "@/lib/types";

interface ChatPaneProps {
  conversation: Conversation;
  messages: Message[];
  currentUser: User;
  loadingMessages: boolean;
  onlineUserIds: Set<number>;
  typingUserIds: number[];
  onSend: (content: string) => void;
  onTyping: (isTyping: boolean) => void;
  onOpenInfo: () => void;
}

export function ChatPane({
  conversation,
  messages,
  currentUser,
  loadingMessages,
  onlineUserIds,
  typingUserIds,
  onSend,
  onTyping,
  onOpenInfo,
}: ChatPaneProps) {
  return (
    <div className="flex h-full flex-1 flex-col" style={{ background: "var(--color-chat-bg)" }}>
      <ChatHeader
        conversation={conversation}
        currentUser={currentUser}
        onlineUserIds={onlineUserIds}
        typingUserIds={typingUserIds}
        onOpenInfo={onOpenInfo}
      />
      <MessageList
        conversation={conversation}
        messages={messages}
        currentUser={currentUser}
        loading={loadingMessages}
        onOpenInfo={onOpenInfo}
      />
      {/* A thread we haven't accepted yet swaps the composer for the
          Accept/Block/Delete bar — the messages above stay readable. */}
      {conversation.my_status === "pending" ? (
        <MessageRequestBanner conversation={conversation} currentUser={currentUser} />
      ) : (
        <MessageInput onSend={onSend} onTyping={onTyping} />
      )}
    </div>
  );
}
