import { create } from "zustand";
import { persist } from "zustand/middleware";

import { api, setAuthToken, setUnauthorizedHandler } from "@/lib/api";
import type { AuthResponse, User } from "@/lib/types";

interface AuthState {
  token: string | null;
  user: User | null;
  hydrated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (
    phoneNumber: string,
    username: string,
    displayName: string,
    password: string,
    otp: string,
  ) => Promise<void>;
  logout: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hydrated: false,

      async login(username, password) {
        const res = await api.post<AuthResponse>("/auth/login", { username, password });
        set({ token: res.access_token, user: res.user });
      },

      async register(phoneNumber, username, displayName, password, otp) {
        const res = await api.post<AuthResponse>("/auth/register", {
          phone_number: phoneNumber,
          username,
          display_name: displayName,
          password,
          otp,
        });
        set({ token: res.access_token, user: res.user });
      },

      logout() {
        set({ token: null, user: null });
      },

      setHydrated() {
        set({ hydrated: true });
      },
    }),
    {
      name: "signal-clone-auth",
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

useAuthStore.subscribe((state) => {
  setAuthToken(state.token);
});
setAuthToken(useAuthStore.getState().token);

setUnauthorizedHandler(() => {
  useAuthStore.getState().logout();
});
