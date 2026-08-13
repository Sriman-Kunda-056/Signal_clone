"use client";

import { X } from "lucide-react";
import { type MouseEvent, type ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
}

export function Modal({ title, onClose, children, widthClass = "max-w-md" }: ModalProps) {
  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className={`w-full ${widthClass} animate-fade-in-up rounded-xl border shadow-xl`}
        style={{ background: "var(--color-panel-bg)", borderColor: "var(--color-border)" }}
        onClick={stop}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--color-border)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {title}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:opacity-70">
            <X className="h-4 w-4" style={{ color: "var(--color-text-secondary)" }} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
