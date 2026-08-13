"use client";

import { Book, LogOut, MessageSquare, Phone, Settings } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import type { User } from "@/lib/types";

/** The three top-level destinations in Signal's left rail. */
export type NavView = "chats" | "calls" | "stories";

interface NavRailProps {
  currentUser: User;
  active: NavView;
  onChange: (view: NavView) => void;
  onLogout: () => void;
}

const NAV_ITEMS: { view: NavView; label: string; Icon: typeof MessageSquare }[] = [
  { view: "chats", label: "Chats", Icon: MessageSquare },
  { view: "calls", label: "Calls", Icon: Phone },
  { view: "stories", label: "Stories", Icon: Book },
];

/**
 * Signal's narrow vertical icon rail pinned to the far left of the window —
 * top-level navigation (Chats / Calls / Stories) with settings and the
 * account avatar anchored at the bottom.
 */
export function NavRail({ currentUser, active, onChange, onLogout }: NavRailProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(menuRef, () => setMenuOpen(false));

  return (
    <nav
      className="hidden w-[68px] shrink-0 flex-col items-center justify-between border-r py-3 md:flex"
      style={{ background: "var(--color-nav-rail)", borderColor: "var(--color-border)" }}
    >
      <div className="flex flex-col items-center gap-1">
        {NAV_ITEMS.map(({ view, label, Icon }) => {
          const isActive = active === view;
          return (
            <button
              key={view}
              onClick={() => onChange(view)}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              title={label}
              className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors"
              style={{ background: isActive ? "var(--color-sidebar-active)" : "transparent" }}
            >
              <Icon
                className="h-[22px] w-[22px]"
                style={{ color: isActive ? "var(--color-text-primary)" : "var(--color-icon)" }}
              />
            </button>
          );
        })}
      </div>

      <div className="relative flex flex-col items-center gap-2" ref={menuRef}>
        <Link
          href="/settings"
          aria-label="Settings"
          title="Settings"
          className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-sidebar-hover)]"
        >
          <Settings className="h-[22px] w-[22px]" style={{ color: "var(--color-icon)" }} />
        </Link>

        <button onClick={() => setMenuOpen((v) => !v)} aria-label="Account menu" className="rounded-full">
          <Avatar id={currentUser.id} name={currentUser.display_name} size={32} />
        </button>

        {menuOpen && (
          <div
            className="absolute bottom-12 left-12 z-40 w-52 overflow-hidden rounded-lg border shadow-xl"
            style={{ background: "var(--color-panel-bg)", borderColor: "var(--color-border)" }}
          >
            <div className="border-b px-3 py-2.5" style={{ borderColor: "var(--color-border)" }}>
              <p className="truncate text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {currentUser.display_name}
              </p>
              <p className="truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
                @{currentUser.username}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-sidebar-hover)]"
              style={{ color: "var(--color-danger)" }}
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
