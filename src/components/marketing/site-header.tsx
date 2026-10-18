"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/shell/logo";
import { cn } from "@/components/ui/cn";

const LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About us" },
  { href: "/security", label: "Security" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 px-3 pt-3">
      <div
        className={cn(
          "mx-auto flex h-14 max-w-[1180px] items-center gap-6 rounded-2xl border px-3 pl-4 transition-[background-color,border-color,box-shadow] duration-300",
          scrolled || open ? "border-white/10 bg-[#0b0c2a]/80 shadow-[0_10px_40px_-10px_rgb(0_0_0/0.6)] backdrop-blur-xl" : "border-transparent",
        )}
      >
        <Link href="/" aria-label="Nerox home" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Site" className="hidden flex-1 items-center justify-center gap-1 text-[14px] font-medium md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={pathname === l.href ? "page" : undefined} className="mk-nav-link rounded-lg px-3 py-2">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {signedIn ? (
            <Link href="/overview" className="mk-btn mk-btn-primary mk-btn-sm">
              Open Nerox
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-lg px-3 py-2 text-[14px] font-medium text-muted hover:text-fg sm:block">
                Sign in
              </Link>
              <Link href="/signup" className="mk-btn mk-btn-primary mk-btn-sm">
                Start free
              </Link>
            </>
          )}
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-xl text-muted hover:bg-white/5 hover:text-fg md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mk-mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mk-mobile-nav" aria-label="Site (mobile)" className="anim-pop mx-auto mt-2 max-w-[1180px] rounded-2xl border border-white/10 bg-[#0b0c2a]/95 p-2 backdrop-blur-xl md:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="block rounded-xl px-4 py-3 text-[16px] font-medium text-muted hover:bg-white/5 hover:text-fg">
              {l.label}
            </Link>
          ))}
          {!signedIn && (
            <Link href="/login" className="block rounded-xl px-4 py-3 text-[16px] font-medium text-muted hover:bg-white/5 hover:text-fg">
              Sign in
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
