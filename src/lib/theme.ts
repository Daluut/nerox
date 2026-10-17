export const THEMES = [
  { id: "light", name: "Light", description: "Bright and clear", swatch: ["#ffffff", "#6b46ff", "#0fb39c"] },
  { id: "dark", name: "Dark", description: "Easy on the eyes", swatch: ["#18191f", "#8b6cf6", "#2fd0b6"] },
  { id: "nerox", name: "Nerox", description: "Our deep blue-purple", swatch: ["#16174a", "#8f6bff", "#4dd8ff"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const THEME_COOKIE = "nerox_theme";
export const DEFAULT_THEME: ThemeId = "light";

export const isTheme = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);
