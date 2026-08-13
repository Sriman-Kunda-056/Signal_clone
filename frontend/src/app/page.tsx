"use client";

import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { ChatPane } from "@/components/chat/ChatPane";
import { EmptyState } from "@/components/chat/EmptyState";
import { GroupInfoPanel } from "@/components/GroupInfoPanel";
import { NewGroupModal } from "@/components/modals/NewGroupModal";
import { NavRail, type NavView } from "@/components/nav/NavRail";
import { PlaceholderPanel } from "@/components/nav/PlaceholderPanel";
import { NewChatPanel } from "@/components/sidebar/NewChatPanel";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { wsClient } from "@/lib/ws";
import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { useToastStore } from "@/store/toastStore";

export default function HomePage() {
  const { user, ready } = useRequireAuth();
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  const conversations = useChatStore((s) => s.conversations);
  const messagesByConversation = useChatStore((s) => s.messagesByConversation);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const typingByConversation = useChatStore((s) => s.typingByConversation);
  const onlineUserIds = useChatStore((s) => s.onlineUserIds);
  const loadingMessages = useChatStore((s) => s.loadingMessages);

  const init = useChatStore((s) => s.init);
  const teardown = useChatStore((s) => s.teardown);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const loadContacts = useChatStore((s) => s.loadContacts);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const setTyping = useChatStore((s) => s.setTyping);

  const pushToast = useToastStore((s) => s.push);

  const [navView, setNavView] = useState<NavView>("chats");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  // Signal Desktop's "Hide Tabs" — the hamburger button beside "Chats"
  // collapses the left icon rail (Chats/Calls/Stories) entirely.
  const [navRailVisible, setNavRailVisible] = useState(true);

  useEffect(() => {
    if (!ready || !token) return;
    wsClient.connect(token);
    init();
    loadConversations();
    loadContacts();
    return () => {
      wsClient.disconnect();
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  // Toast for messages arriving in a conversation the user isn't looking at.
  useEffect(() => {
    const unsubscribe = wsClient.subscribe((event) => {
      if (event.type !== "new_message") return;
      const state = useChatStore.getState();
      const currentUserId = useAuthStore.getState().user?.id;
      if (event.message.sender_id === currentUserId) return;
      if (state.activeConversationId === event.message.conversation_id) return;
      pushToast(event.message.sender.display_name, event.message.content);
    });
    return unsubscribe;
  }, [pushToast]);

  if (!ready || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ background: "var(--color-chat-bg)" }}>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Loading…
        </p>
      </main>
    );
  }

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;
  const activeMessages = activeConversationId ? (messagesByConversation[activeConversationId] ?? []) : [];
  const typingUserIds = activeConversationId ? (typingByConversation[activeConversationId] ?? []) : [];

  function handleSelect(id: number) {
    selectConversation(id);
    setShowInfo(false);
    setMobileShowChat(true);
  }

  function handleLogout() {
    wsClient.disconnect();
    teardown();
    logout();
  }

  return (
    <main className="flex h-screen w-full overflow-hidden" style={{ background: "var(--color-chat-bg)" }}>
      {navRailVisible && (
        <NavRail currentUser={user} active={navView} onChange={setNavView} onLogout={handleLogout} />
      )}

      {/* Second column: chat list, the New chat panel that replaces it, or a
          placeholder for the mocked nav destinations. */}
      <div className={`h-full w-full md:w-auto ${mobileShowChat ? "hidden md:flex" : "flex"}`}>
        {navView !== "chats" ? (
          <PlaceholderPanel view={navView} onToggleNavRail={() => setNavRailVisible((v) => !v)} />
        ) : showNewChat ? (
          <NewChatPanel
            conversations={conversations}
            onClose={() => setShowNewChat(false)}
            onOpenConversation={handleSelect}
            onNewGroup={() => {
              setShowNewChat(false);
              setShowNewGroup(true);
            }}
          />
        ) : (
          <Sidebar
            currentUser={user}
            conversations={conversations}
            activeConversationId={activeConversationId}
            onlineUserIds={onlineUserIds}
            onSelect={handleSelect}
            onNewChat={() => setShowNewChat(true)}
            onToggleNavRail={() => setNavRailVisible((v) => !v)}
          />
        )}
      </div>

      <div className={`h-full flex-1 ${mobileShowChat ? "flex" : "hidden md:flex"}`}>
        {activeConversation && navView === "chats" ? (
          <>
            <div className="flex h-full flex-1 flex-col">
              <button
                onClick={() => setMobileShowChat(false)}
                className="flex items-center gap-1 border-b px-3 py-2 text-sm md:hidden"
                style={{ borderColor: "var(--color-border)", color: "var(--color-accent)" }}
              >
                <ChevronLeft className="h-4 w-4" /> Chats
              </button>
              <ChatPane
                conversation={activeConversation}
                messages={activeMessages}
                currentUser={user}
                loadingMessages={loadingMessages}
                onlineUserIds={onlineUserIds}
                typingUserIds={typingUserIds}
                onSend={(content) => sendMessage(activeConversation.id, content)}
                onTyping={(isTyping) => setTyping(activeConversation.id, isTyping)}
                onOpenInfo={() => setShowInfo((v) => !v)}
              />
            </div>
            {showInfo && (
              <GroupInfoPanel
                conversation={activeConversation}
                currentUser={user}
                onlineUserIds={onlineUserIds}
                onClose={() => setShowInfo(false)}
              />
            )}
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {showNewGroup && (
        <NewGroupModal onClose={() => setShowNewGroup(false)} onOpenConversation={handleSelect} />
      )}
    </main>
  );
}
