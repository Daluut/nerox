import { Logo } from "@/components/shell/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(440px,560px)]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo />
        <div className="max-w-md">
          <h1 className="text-[34px] font-semibold leading-[1.15]">Your projects, understood.</h1>
          <p className="mt-4 text-[15px] text-muted">
            Nerox organises your team&apos;s work and reads its health — what&apos;s overdue, what&apos;s blocking what, and whether the deadline still holds — so you can act before a project slips.
          </p>
        </div>
        <svg className="pointer-events-none absolute bottom-20 right-12 opacity-[0.06]" width="320" height="320" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 19V5l14 14V5" stroke="var(--violet)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-[12px] text-faint">Built for student teams, developers and small companies.</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
