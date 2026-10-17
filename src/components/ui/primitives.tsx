import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-violet text-white hover:bg-violet-strong border border-transparent shadow-[0_2px_10px_var(--violet-soft)]",
  secondary: "bg-panel text-fg border border-line-strong hover:bg-hover",
  ghost: "text-muted hover:text-fg hover:bg-hover border border-transparent",
  danger: "bg-danger/90 text-white hover:bg-danger border border-transparent",
};
const SIZE: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[14px] gap-1.5 rounded-lg",
  md: "h-11 px-5 text-[15px] gap-2 rounded-xl",
  lg: "h-13 px-7 text-[16px] gap-2.5 rounded-xl",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none select-none",
    VARIANT[variant],
    SIZE[size],
    extra,
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, size, className)}>
      {loading && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "secondary", size = "md", className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...rest} className={buttonClass(variant, size, className)} />;
}

export function Field({ label, error, hint, children, htmlFor, className }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[14px] font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? <p className="text-[13px] text-danger">{error}</p> : hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
  accent,
  icon,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  accent?: string; // a CSS colour, e.g. "var(--c-tasks)"
  icon?: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-panel shadow-card", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
          {title && (
            <h2 className="flex items-center gap-2.5 text-[16px] font-semibold text-fg">
              {icon && (
                <span className="flex size-7 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${accent ?? "var(--violet)"} 15%, transparent)`, color: accent ?? "var(--violet)" }}>
                  {icon}
                </span>
              )}
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Coloured square icon used to give each section its own identity. */
export function IconBadge({ color, children, size = 36 }: { color: string; children: ReactNode; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
    >
      {children}
    </span>
  );
}

/** Page heading used at the top of every screen. */
export function PageHeader({ title, description, action, icon, color }: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode; color?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        {icon && color && (
          <IconBadge color={color} size={48}>
            {icon}
          </IconBadge>
        )}
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-[15px] text-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-2 py-8", className)}>
      {icon && <div className="mb-1 text-violet">{icon}</div>}
      <p className="text-[16px] font-semibold">{title}</p>
      {children && <div className="max-w-md text-[14px] text-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  // Stable hue per name so the same person always looks the same.
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span
      title={name}
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white/90", className)}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4), background: `hsl(${h} 32% 34%)` }}
    >
      {initials || "?"}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4", className)} />;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-[14px] text-fg">
      {children}
    </p>
  );
}
