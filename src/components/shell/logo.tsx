/** Nerox mark: four task nodes joined into an N — work connected and moving forward. The final node is the "signal". */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 19V5l14 14V5" stroke="var(--violet)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="5" cy="5" r="2.3" fill="var(--text)" />
      <circle cx="5" cy="19" r="2.3" fill="var(--text)" />
      <circle cx="19" cy="19" r="2.3" fill="var(--text)" />
      <circle cx="19" cy="5" r="2.7" fill="var(--cyan)" />
    </svg>
  );
}

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && <span className="text-[15px] font-semibold tracking-[0.18em]">NEROX</span>}
    </span>
  );
}
