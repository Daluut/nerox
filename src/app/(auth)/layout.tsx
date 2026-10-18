import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import pulseShot from "../../../public/product/pulse.webp";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mk grid min-h-dvh lg:grid-cols-[1fr_minmax(440px,560px)]">
      <aside className="relative hidden overflow-hidden border-r border-white/[0.07] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="mk-light pointer-events-none absolute inset-0" />
        <div aria-hidden className="mk-grid pointer-events-none absolute inset-0" />
        <Link href="/" aria-label="Nerox home" className="relative">
          <Logo />
        </Link>
        <div className="relative">
          <h1 className="mk-display max-w-[14ch] text-[48px]">Spot a slipping project while there&apos;s still time.</h1>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-muted">
            Nerox reads your team&apos;s tasks and tells you what&apos;s late, what&apos;s holding work up and whether the deadline still holds, with the reason for every warning.
          </p>
          <figure className="mk-frame mt-10 max-w-[620px] -rotate-1">
            <Image src={pulseShot} alt="A Nerox Pulse health report showing a score of 70 and the risks behind it." sizes="620px" placeholder="blur" className="h-auto w-full" />
          </figure>
        </div>
        <p className="relative text-[13px] text-faint">Built for student teams, start-ups and small companies.</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[380px]">
          <Link href="/" aria-label="Nerox home" className="mb-10 block lg:hidden">
            <Logo />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
