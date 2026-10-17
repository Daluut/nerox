import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Nerox", template: "%s · Nerox" },
  description: "Your projects, understood. Organise work and catch problems before they derail a project.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#0d0e12" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
