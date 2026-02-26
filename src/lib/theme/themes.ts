export type ThemeId = "editorial" | "midnight" | "forest";

export type ThemeInfo = {
  id: ThemeId;
  name: string;
  description: string;
};

export const THEMES: ThemeInfo[] = [
  {
    id: "editorial",
    name: "Editorial",
    description: "Warm off-white newsroom baseline with serif-forward hierarchy.",
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Dark editorial mode with luminous contrast for focused reading.",
  },
  {
    id: "forest",
    name: "Forest",
    description: "Earth-toned palette with grounded accent contrast.",
  },
];

export const DEFAULT_THEME: ThemeId = "editorial";

export const isThemeId = (value: string): value is ThemeId =>
  THEMES.some((theme) => theme.id === value);
