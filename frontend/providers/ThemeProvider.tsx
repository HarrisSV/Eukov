"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/store/themeStore";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return <>{children}</>;
}
