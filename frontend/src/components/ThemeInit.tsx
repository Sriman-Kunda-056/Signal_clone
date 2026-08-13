"use client";

import { useEffect } from "react";

import { useThemeStore } from "@/store/themeStore";

export function ThemeInit() {
  const hydrate = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return null;
}
