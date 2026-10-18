import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ToastProvider } from "@/components/ui/toast";
import { DEFAULT_THEME, THEME_COOKIE, isTheme } from "@/lib/theme";
import { SITE } from "@/config/site";
import { publicSiteUrl } from "@/lib/site-url";
import "./globals.css";

const DESCRIPTION = "Nerox is the project workspace that tells you which work is slipping, and why, while there's still time to fix it. Health scores, What If? simulations and lessons from past projects.";

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl()),
  title: { default: `${SITE.name}: spot a slipping project while there's still time`, template: `%s | ${SITE.name}` },
  description: DESCRIPTION,
  applicationName: SITE.name,
  icons: { icon: "/icon.svg" },
  openGraph: { type: "website", siteName: SITE.name, title: `${SITE.name}: ${SITE.tagline}`, description: DESCRIPTION, locale: "en_GB" },
  twitter: { card: "summary_large_image", title: `${SITE.name}: ${SITE.tagline}`, description: DESCRIPTION },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#070820" };

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
