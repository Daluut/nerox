import type { Snapshot } from "@/lib/data/types";
import { formatDate } from "@/lib/domain/dates";
import { scoreColor } from "./health";

/**
 * Health over time from stored daily snapshots only. Days without a snapshot are
 * gaps, not interpolated values, and nothing is drawn until two snapshots exist.
 */
export function HealthTrend({ snapshots, today }: { snapshots: Snapshot[]; today: string }) {
  const scored = snapshots.filter((s) => s.score !== null);
  if (scored.length < 2) {
    return (
      <p className="text-[13px] text-muted">
        Pulse stores one snapshot a day when the project is viewed. A trend appears once there are at least two scored days
        {scored.length === 1 ? ` — the first was recorded ${formatDate(scored[0].snapshotDate, today)}` : ""}.
      </p>
    );
  }
  const W = 560;
  const H = 120;
  const pad = { l: 28, r: 8, t: 8, b: 20 };
  const first = scored[0].snapshotDate;
  const last = scored[scored.length - 1].snapshotDate;
  const span = Math.max(1, (Date.parse(last) - Date.parse(first)) / 86_400_000);
  const x = (d: string) => pad.l + ((Date.parse(d) - Date.parse(first)) / 86_400_000 / span) * (W - pad.l - pad.r);
  const y = (s: number) => pad.t + (1 - s / 100) * (H - pad.t - pad.b);
  // Break the line where consecutive snapshots are more than a day apart.
  const segments: Snapshot[][] = [];
  for (const s of scored) {
    const prev = segments.at(-1)?.at(-1);
    if (prev && (Date.parse(s.snapshotDate) - Date.parse(prev.snapshotDate)) / 86_400_000 <= 1) segments.at(-1)!.push(s);
    else segments.push([s]);
  }
  const change = scored[scored.length - 1].score! - scored[0].score!;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Health score from ${formatDate(first, today)} to ${formatDate(last, today)}, ${change >= 0 ? "up" : "down"} ${Math.abs(change)} points`}>
        {[0, 40, 60, 80, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray={v === 0 || v === 100 ? undefined : "2 4"} />
            <text x={pad.l - 6} y={y(v) + 3} fontSize="9" textAnchor="end" fill="var(--faint)" className="num">
              {v}
            </text>
          </g>
        ))}
        {segments.map((seg, i) => (
          <polyline key={i} points={seg.map((s) => `${x(s.snapshotDate)},${y(s.score!)}`).join(" ")} fill="none" stroke="var(--violet-strong)" strokeWidth="1.75" strokeLinejoin="round" />
        ))}
        {scored.map((s) => (
          <circle key={s.snapshotDate} cx={x(s.snapshotDate)} cy={y(s.score!)} r="2.5" fill={scoreColor(s.score)}>
            <title>{`${formatDate(s.snapshotDate, today)}: ${s.score}`}</title>
          </circle>
        ))}
        <text x={pad.l} y={H - 4} fontSize="9" fill="var(--faint)">
          {formatDate(first, today)}
        </text>
        <text x={W - pad.r} y={H - 4} fontSize="9" textAnchor="end" fill="var(--faint)">
          {formatDate(last, today)}
        </text>
      </svg>
      <figcaption className="mt-1 text-[12px] text-faint">
        {scored.length} daily snapshots. Days without a recorded snapshot are left as gaps, not filled in.
      </figcaption>
    </figure>
  );
}
