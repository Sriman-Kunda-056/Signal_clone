import { create } from "zustand";

export interface Toast {
  id: number;
  title: string;
  body: string;
}

interface ToastState {
  toasts: Toast[];
  push: (title: string, body: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (title, body) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, title, body }] });
    setTimeout(() => get().dismiss(id), 4000);
  },

  dismiss: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));
