import { SITE } from "@/config/site";
import { INSTAGRAM_GRADIENT, InstagramIcon } from "@/components/ui/instagram-icon";
import { cn } from "@/components/ui/cn";

/** "Follow us on Instagram" call to action, used on public pages. */
export function FollowInstagram({ className }: { className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-3xl p-8 text-white md:p-10", className)} style={{ background: INSTAGRAM_GRADIENT }}>
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <InstagramIcon className="size-8" />
          </span>
          <div>
            <p className="text-[24px] font-bold leading-tight">Follow us on Instagram</p>
            <p className="mt-1 text-[16px] text-white/90">See what we&apos;re building, new features first and behind-the-scenes updates at @{SITE.instagram.handle}.</p>
          </div>
        </div>
        <a
          href={SITE.instagram.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-6 text-[16px] font-bold text-[#c1215f] hover:bg-white/90"
        >
          <InstagramIcon className="size-5" /> Follow @{SITE.instagram.handle}
        </a>
      </div>
    </section>
  );
}
