import { create } from "zustand";

export type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  hydrate: () => void;
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "dark",

  toggle: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("signal-clone-theme", next);
    }
    set({ theme: next });
  },

  hydrate: () => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("signal-clone-theme") as Theme | null;
    const theme = stored === "light" ? "light" : "dark";
    applyTheme(theme);
    set({ theme });
  },
}));
