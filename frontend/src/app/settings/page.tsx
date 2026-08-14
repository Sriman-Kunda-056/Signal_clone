"use client";

import { ArrowLeft, Bell, Lock, Moon, Palette, ShieldAlert, Sun } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/Avatar";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { usePrivacyStore } from "@/store/privacyStore";
import { useThemeStore } from "@/store/themeStore";

export default function SettingsPage() {
  const { user, ready } = useRequireAuth();
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const screenPrivacyEnabled = usePrivacyStore((s) => s.screenPrivacyEnabled);
  const togglePrivacy = usePrivacyStore((s) => s.toggle);

  if (!ready || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ background: "var(--color-app-bg)" }}>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Loading…
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--color-app-bg)" }}>
      <div className="mx-auto max-w-xl px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/" className="rounded-full p-2 hover:opacity-70">
            <ArrowLeft className="h-5 w-5" style={{ color: "var(--color-text-secondary)" }} />
          </Link>
          <h1 className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Settings
          </h1>
        </div>

        <div
          className="mb-6 flex items-center gap-4 rounded-xl border p-4"
          style={{ borderColor: "var(--color-border)", background: "var(--color-panel-bg)" }}
        >
          <Avatar id={user.id} name={user.display_name} size={56} />
          <div>
            <p className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {user.display_name}
            </p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              @{user.username}
            </p>
          </div>
        </div>

        <SettingsSection icon={<Palette className="h-4 w-4" />} title="Appearance">
          <div className="flex items-center justify-between px-1 py-2">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                Theme
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Switch between dark and light mode
              </p>
            </div>
            <button
              onClick={toggle}
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
            >
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              {theme === "dark" ? "Dark" : "Light"}
            </button>
          </div>
        </SettingsSection>

        <SettingsSection icon={<Lock className="h-4 w-4" />} title="Privacy">
          <ComingSoonRow label="Blocked contacts" />
          <ComingSoonRow label="Read receipts" />
          <ComingSoonRow label="Disappearing messages" />
          <div className="border-b px-4 py-3 last:border-b-0" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-primary)" }}>
                <ShieldAlert className="h-4 w-4" />
                Screen privacy
              </span>
              <button
                onClick={togglePrivacy}
                className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
              >
                {screenPrivacyEnabled ? "On" : "Off"}
              </button>
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
              When on, the app covers itself when you press PrintScreen or switch away. This is a best-effort
              reaction, not a guarantee — a website has no access to the OS-level APIs (Android FLAG_SECURE, iOS
              capture detection) that make Signal&apos;s real screenshot protection actually reliable.
            </p>
          </div>
        </SettingsSection>

        <SettingsSection icon={<Bell className="h-4 w-4" />} title="Notifications">
          <ComingSoonRow label="Message notifications" />
          <ComingSoonRow label="Sound" />
        </SettingsSection>
      </div>
    </main>
  );
}

function SettingsSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-2 px-1" style={{ color: "var(--color-text-secondary)" }}>
        {icon}
        <h2 className="text-xs font-semibold tracking-wide uppercase">{title}</h2>
      </div>
      <div className="rounded-xl border" style={{ borderColor: "var(--color-border)", background: "var(--color-panel-bg)" }}>
        {children}
      </div>
    </div>
  );
}

function ComingSoonRow({ label, note }: { label: string; note?: string }) {
  return (
    <div className="border-b px-4 py-3 last:border-b-0" style={{ borderColor: "var(--color-border)" }}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>
          {label}
        </span>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ background: "var(--color-input-bg)", color: "var(--color-text-muted)" }}
        >
          Coming soon
        </span>
      </div>
      {note && (
        <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
          {note}
        </p>
      )}
    </div>
  );
}
