"use client";

import { Book, MessageSquare, Phone, Settings } from "lucide-react";
import Link from "next/link";

import type { NavView } from "@/components/nav/NavRail";

interface MobileTabBarProps {
  active: NavView;
  onChange: (view: NavView) => void;
}

const TAB_ITEMS: { view: NavView; label: string; Icon: typeof MessageSquare }[] = [
  { view: "chats", label: "Chats", Icon: MessageSquare },
  { view: "calls", label: "Calls", Icon: Phone },
  { view: "stories", label: "Stories", Icon: Book },
];

/**
 * `NavRail` is `hidden` below `md` (no room for a side rail on a phone),
 * which meant Calls/Stories were completely unreachable on mobile — this is
 * the fix, and it's also more accurate to Signal's real mobile app, which
 * uses bottom tabs rather than a side rail in the first place.
 */
export function MobileTabBar({ active, onChange }: MobileTabBarProps) {
  return (
    <nav
      className="flex shrink-0 items-center justify-around border-t py-1.5 md:hidden"
      style={{ background: "var(--color-nav-rail)", borderColor: "var(--color-border)" }}
    >
      {TAB_ITEMS.map(({ view, label, Icon }) => {
        const isActive = active === view;
        return (
          <button
            key={view}
            onClick={() => onChange(view)}
            className="flex flex-col items-center gap-0.5 px-4 py-1"
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon
              className="h-6 w-6"
              style={{ color: isActive ? "var(--color-accent)" : "var(--color-icon)" }}
              strokeWidth={isActive ? 2.4 : 2}
            />
            <span
              className="text-[11px]"
              style={{ color: isActive ? "var(--color-accent)" : "var(--color-text-muted)" }}
            >
              {label}
            </span>
          </button>
        );
      })}
      <Link href="/settings" className="flex flex-col items-center gap-0.5 px-4 py-1" aria-label="Settings">
        <Settings className="h-6 w-6" style={{ color: "var(--color-icon)" }} />
        <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          Settings
        </span>
      </Link>
    </nav>
  );
}
