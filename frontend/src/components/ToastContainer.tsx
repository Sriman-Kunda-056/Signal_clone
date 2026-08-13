"use client";

import { useToastStore } from "@/store/toastStore";

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className="animate-toast-in pointer-events-auto rounded-lg border p-3 text-left shadow-lg"
          style={{ background: "var(--color-panel-bg)", borderColor: "var(--color-border)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {toast.title}
          </p>
          <p className="truncate text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {toast.body}
          </p>
        </button>
      ))}
    </div>
  );
}
