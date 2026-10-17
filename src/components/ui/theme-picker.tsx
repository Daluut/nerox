"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { DEFAULT_THEME, THEMES, THEME_COOKIE, isTheme, type ThemeId } from "@/lib/theme";
import { cn } from "./cn";

function currentTheme(): ThemeId {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const t = document.documentElement.dataset.theme;
  return isTheme(t) ? t : DEFAULT_THEME;
}

export function applyTheme(t: ThemeId) {
  document.documentElement.dataset.theme = t;
  document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
}

/** Light / Dark / Nerox. Saved on this device and applied instantly. */
export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  if (compact) {
    return (
      <div role="radiogroup" aria-label="Colour theme" className="flex gap-1.5" data-tour="theme">
        {THEMES.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={theme === t.id}
            title={`${t.name} theme`}
            onClick={() => {
              applyTheme(t.id);
              setTheme(t.id);
            }}
            className={cn(
              "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border text-[12px] font-medium transition-colors",
              theme === t.id ? "border-violet bg-violet-soft text-fg" : "border-line text-muted hover:text-fg",
            )}
          >
            <span className="size-3 rounded-full border border-line-strong" style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)` }} />
            {t.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label="Colour theme" className="grid gap-3 sm:grid-cols-3">
      {THEMES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={theme === t.id}
          onClick={() => {
            applyTheme(t.id);
            setTheme(t.id);
          }}
          className={cn(
            "relative overflow-hidden rounded-xl border-2 text-left transition-colors",
            theme === t.id ? "border-violet" : "border-line hover:border-line-strong",
          )}
        >
          <span className="flex h-20 items-end gap-2 p-3" style={{ background: t.swatch[0] }}>
            <span className="h-8 w-14 rounded-md" style={{ background: t.swatch[1] }} />
            <span className="h-5 w-8 rounded-md" style={{ background: t.swatch[2] }} />
          </span>
          <span className="block px-3 py-2.5">
            <span className="block text-[15px] font-semibold">{t.name}</span>
            <span className="block text-[13px] text-muted">{t.description}</span>
          </span>
          {theme === t.id && (
            <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-violet text-white">
              <Check className="size-3.5" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
