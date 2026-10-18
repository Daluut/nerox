import Link from "next/link";
import { Mail } from "lucide-react";
import { SITE } from "@/config/site";
import { InstagramIcon } from "@/components/ui/instagram-icon";
import { LinkedinIcon } from "@/components/ui/linkedin-icon";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/shell/logo";
import { SiteHeader } from "@/components/marketing/site-header";

/** Shared header and footer for the public pages. Always in the dark "Nerox night" look. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  let signedIn = false;
  try {
    const supabase = await createClient();
    signedIn = !!(await supabase.auth.getUser()).data.user;
  } catch {
    // No Supabase configured: the pages still render, sign-in buttons lead to the setup page.
  }

  return (
    <div className="mk flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-[60] rounded-lg bg-violet px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <SiteHeader signedIn={signedIn} />

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="relative mt-10 border-t border-white/[0.07]">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-muted">
              {SITE.tagline} The project workspace that tells you which work is slipping, and why, while there&apos;s still time to fix it.
            </p>
            <div className="mt-6 flex gap-2">
              <a href={SITE.instagram.url} target="_blank" rel="noopener noreferrer" aria-label={`Nerox on Instagram, @${SITE.instagram.handle}`} className="flex size-10 items-center justify-center rounded-xl border border-white/10 text-muted transition-colors hover:border-white/25 hover:text-fg">
                <InstagramIcon className="size-[18px]" />
              </a>
              <a href={SITE.owner.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${SITE.owner.name} on LinkedIn`} className="flex size-10 items-center justify-center rounded-xl border border-white/10 text-muted transition-colors hover:border-white/25 hover:text-fg">
                <LinkedinIcon className="size-[18px]" />
              </a>
              <a href={`mailto:${SITE.contact.email}`} aria-label={`Email ${SITE.contact.email}`} className="flex size-10 items-center justify-center rounded-xl border border-white/10 text-muted transition-colors hover:border-white/25 hover:text-fg">
                <Mail className="size-[18px]" />
              </a>
            </div>
          </div>
          <FooterCol
            title="Product"
            links={[
              ["/#product", "Features"],
              ["/pricing", "Pricing"],
              ["/security", "Security and privacy"],
              ["/signup", "Create an account"],
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              ["/about", "About us"],
              ["/about#founder", "Our founder"],
              ["/contact", "Contact"],
            ]}
          />
          <FooterCol
            title="Follow"
            links={[
              [SITE.instagram.url, `Instagram @${SITE.instagram.handle}`],
              [SITE.owner.linkedin, "LinkedIn"],
              [`mailto:${SITE.contact.email}`, SITE.contact.email],
            ]}
          />
        </div>
        <div className="mx-auto flex max-w-[1180px] flex-wrap justify-between gap-3 border-t border-white/[0.07] px-5 py-6 text-[13px] text-faint">
          <p>
            © {new Date().getFullYear()} {SITE.name}. Founded by {SITE.owner.name}.
          </p>
          <p>Made for teams that want to finish on time.</p>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-[14px] font-semibold">{title}</p>
      <ul className="mt-4 space-y-2.5 text-[14px] text-muted">
        {links.map(([href, label]) => {
          const external = href.startsWith("http") || href.startsWith("mailto:");
          return (
            <li key={href}>
              {external ? (
                <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined} className="break-all transition-colors hover:text-fg">
                  {label}
                </a>
              ) : (
                <Link href={href} className="transition-colors hover:text-fg">
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
