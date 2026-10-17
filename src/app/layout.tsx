import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ToastProvider } from "@/components/ui/toast";
import { DEFAULT_THEME, THEME_COOKIE, isTheme } from "@/lib/theme";
import { SITE } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${SITE.name} | ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The theme is read on the server so the page never flashes the wrong colours.
  const saved = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(saved) ? saved : DEFAULT_THEME;
  return (
    <html lang="en-GB" data-theme={theme}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
