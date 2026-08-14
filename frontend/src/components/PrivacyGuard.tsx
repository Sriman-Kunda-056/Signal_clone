"use client";

import { ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { usePrivacyStore } from "@/store/privacyStore";

const PRINTSCREEN_DISMISS_MS = 2500;

/**
 * Best-effort, NOT a guarantee. A website has no API to see or block
 * PrintScreen / Snipping Tool / OS screen recording, and no API to minimize
 * its own window — those are OS/native-app-only capabilities (this is the
 * same limitation discussed in Settings). What this *can* do: react to the
 * PrintScreen keydown (a real DOM event on Windows) and to the window
 * losing focus/visibility, and throw a covering overlay up immediately
 * after. It reduces exposure; it does not guarantee the capture is empty —
 * the OS's own screenshot timing is not something a page can race reliably.
 */
export function PrivacyGuard() {
  const enabled = usePrivacyStore((s) => s.screenPrivacyEnabled);
  const [visible, setVisible] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Skip attaching listeners entirely when disabled, rather than setting
    // state synchronously in the effect body to force-hide — the render
    // below already guards on `enabled` too.
    if (!enabled) return;

    function showTransient() {
      setVisible(true);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => setVisible(false), PRINTSCREEN_DISMISS_MS);
    }

    function showUntilFocused() {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      setVisible(true);
    }

    function hide() {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      setVisible(false);
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === "PrintScreen") showTransient();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") showUntilFocused();
      else hide();
    }

    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", showUntilFocused);
    window.addEventListener("focus", hide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", showUntilFocused);
      window.removeEventListener("focus", hide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [enabled]);

  if (!visible || !enabled) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 backdrop-blur-2xl"
      style={{ background: "color-mix(in srgb, var(--color-chat-bg) 92%, transparent)" }}
      onClick={() => setVisible(false)}
    >
      <ShieldAlert className="h-10 w-10" style={{ color: "var(--color-accent)" }} />
      <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
        Screen privacy is on
      </p>
      <p className="max-w-xs px-6 text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
        Click anywhere to continue. Turn this off in Settings → Privacy.
      </p>
    </div>
  );
}
