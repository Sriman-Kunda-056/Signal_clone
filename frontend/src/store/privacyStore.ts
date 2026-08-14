import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PrivacyState {
  // Defaults on, matching Signal's own default for its (real, OS-backed)
  // screen security setting.
  screenPrivacyEnabled: boolean;
  toggle: () => void;
}

export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set, get) => ({
      screenPrivacyEnabled: true,
      toggle: () => set({ screenPrivacyEnabled: !get().screenPrivacyEnabled }),
    }),
    { name: "signal-clone-privacy" },
  ),
);
