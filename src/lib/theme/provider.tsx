"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  isThemeId,
  THEMES,
  type ThemeId,
  type ThemeInfo,
} from "@/lib/theme/themes";

const STORAGE_KEY = "press-vault-theme";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (nextTheme: ThemeId) => void;
  themes: ThemeInfo[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const applyThemeAttribute = (theme: ThemeId) => {
  document.documentElement.setAttribute("data-theme", theme);
};

const getInitialTheme = (): ThemeId => {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY);
  return storedTheme && isThemeId(storedTheme) ? storedTheme : DEFAULT_THEME;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(getInitialTheme);

  useEffect(() => {
    applyThemeAttribute(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: ThemeId) => {
    setThemeState(nextTheme);
  }, []);

  const contextValue = useMemo(
    () => ({ theme, setTheme, themes: THEMES }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};
