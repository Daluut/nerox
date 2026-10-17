import Link from "next/link";
import { LinkedinIcon } from "@/components/ui/linkedin-icon";
import { Mail } from "lucide-react";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/shell/logo";
import { ButtonLink } from "@/components/ui/primitives";
import { ThemePicker } from "@/components/ui/theme-picker";

/** Shared header and footer for the public pages: home, About and Contact. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  let signedIn = false;
  try {
    const supabase = await createClient();
    signedIn = !!(await supabase.auth.getUser()).data.user;
  } catch {
    // No Supabase configured: the pages still render, sign-in buttons lead to the setup page.
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-6 px-5">
          <Link href="/" aria-label={`${SITE.name} home`}>
            <Logo />
          </Link>
          <nav aria-label="Site" className="hidden flex-1 items-center gap-1 text-[15px] font-medium sm:flex">
            <Link href="/" className="rounded-lg px-3 py-2 text-muted hover:bg-hover hover:text-fg">
              Home
            </Link>
            <Link href="/about" className="rounded-lg px-3 py-2 text-muted hover:bg-hover hover:text-fg">
              About us
            </Link>
            <Link href="/contact" className="rounded-lg px-3 py-2 text-muted hover:bg-hover hover:text-fg">
              Contact
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {signedIn ? (
              <ButtonLink href="/overview" variant="primary" size="sm">
                Open Nerox
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost" size="sm">
                  Sign in
                </ButtonLink>
                <ButtonLink href="/signup" variant="primary" size="sm">
                  Get started free
                </ButtonLink>
              </>
            )}
          </div>
        </div>
        <nav aria-label="Site (mobile)" className="flex gap-1 border-t border-line px-3 py-1.5 text-[14px] font-medium sm:hidden">
          <Link href="/" className="rounded-lg px-3 py-1.5 text-muted">
            Home
          </Link>
          <Link href="/about" className="rounded-lg px-3 py-1.5 text-muted">
            About us
          </Link>
          <Link href="/contact" className="rounded-lg px-3 py-1.5 text-muted">
            Contact
          </Link>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line bg-sidebar">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-[14px] text-muted">{SITE.tagline} A simple project workspace for teams that want to finish on time.</p>
            <div className="mt-5 max-w-[300px]">
              <ThemePicker compact />
            </div>
          </div>
          <div>
            <p className="text-[14px] font-semibold">Nerox</p>
            <ul className="mt-3 space-y-2 text-[14px] text-muted">
              <li>
                <Link href="/about" className="hover:text-fg">
                  About us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-fg">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-fg">
                  Create an account
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[14px] font-semibold">Connect</p>
            <ul className="mt-3 space-y-2 text-[14px] text-muted">
              {SITE.owner.linkedin && (
                <li>
                  <a href={SITE.owner.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-fg">
                    <LinkedinIcon className="size-4" /> LinkedIn
                  </a>
                </li>
              )}
              {SITE.contact.email && (
                <li>
                  <a href={`mailto:${SITE.contact.email}`} className="inline-flex items-center gap-2 hover:text-fg">
                    <Mail className="size-4" /> {SITE.contact.email}
                  </a>
                </li>
              )}
              {!SITE.owner.linkedin && !SITE.contact.email && (
                <li>
                  <Link href="/contact" className="hover:text-fg">
                    Get in touch
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
        <p className="border-t border-line px-5 py-5 text-center text-[13px] text-faint">
          © {new Date().getFullYear()} {SITE.name}
          {SITE.owner.name ? `, ${SITE.owner.name}` : ""}
        </p>
      </footer>
    </div>
  );
}
