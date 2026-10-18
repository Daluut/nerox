import { SITE } from "@/config/site";
import { InstagramIcon, INSTAGRAM_GRADIENT } from "@/components/ui/instagram-icon";

/** Follow @neroxhq: a slim band rather than another full section. */
export function InstagramBand() {
  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:flex-row sm:items-center sm:p-7">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: INSTAGRAM_GRADIENT }}>
        <InstagramIcon className="size-7" />
      </span>
      <div className="flex-1">
        <p className="text-[18px] font-semibold">Follow us on Instagram</p>
        <p className="mt-1 text-[15px] text-muted">New features first, behind-the-scenes builds and launch news at @{SITE.instagram.handle}.</p>
      </div>
      <a href={SITE.instagram.url} target="_blank" rel="noopener noreferrer" className="mk-btn mk-btn-sm text-white hover:brightness-110" style={{ background: INSTAGRAM_GRADIENT }}>
        <InstagramIcon className="size-4" /> Follow @{SITE.instagram.handle}
      </a>
    </div>
  );
}
