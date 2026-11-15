"use client";

import { useMemo, useRef, useState } from "react";
import { CREW_BY_ID } from "@/lib/crew";
import { PARAM_BY_KEY } from "@/lib/parameters";
import { baselineOf, crewTimelines, PERIOD_COLOR, PERIOD_LABEL, PERIODS, summarize, vitalTimeline, type TimelinePoint } from "@/lib/timeline";
import type { Lang, Phase } from "@/lib/types";
import { VITAL_KEYS } from "./health";
import { Glass, LEVEL_COLOR, LevelBadge, Segmented, StatusIcon, useApp, useT } from "./ui";

const S = (lang: Lang, en: string, es: string) => (lang === "es" ? es : en);
type Filter = "all" | Phase;

// Chart geometry (SVG user units; the SVG scales to the card width).
const W = 960, H = 300, ML = 52, MR = 18, MT = 30, MB = 34;
const GAP = 1.4; // empty slots between two periods

/**
 * Ground view: interactive timeline of one crew member's vital signs across the mission
 * periods. Pick a vital sign and a period, hover or use the arrow keys to read each day,
 * click a day to see every vital sign on that same day.
 */
export function VitalsTimeline() {
  const app = useApp();
  const { tr, n, lang } = useT();
  const [key, setKey] = useState(VITAL_KEYS[0]);
  const [filter, setFilter] = useState<Filter>("all");
  const [compare, setCompare] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<{ phase: Phase; day: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const subject = app.astronautId;
  const param = PARAM_BY_KEY[key];
  const dec = param.sim?.decimals ?? 1;
  const base = baselineOf(app, subject, key);
  // app.rev changes on every new reading, so the timeline follows the live ticks.
  const all = useMemo(() => vitalTimeline(app, subject, key), [app, subject, key]);
  const summary = useMemo(() => summarize(all, base), [all, base]);
  const points = filter === "all" ? all : all.filter((p) => p.phase === filter);
  const others = useMemo(() => (compare ? crewTimelines(app, key, subject) : []), [compare, app, key, subject]);

  // ── x positions: points evenly spaced, with a gap between periods ─────────────
  const xs: number[] = [];
  let slot = 0;
  points.forEach((p, i) => { if (i > 0 && p.phase !== points[i - 1].phase) slot += GAP; xs.push(slot); slot += 1; });
  const slots = Math.max(1, slot - 1);
  const X = (s: number) => ML + (s / slots) * (W - ML - MR);
  const posOf = (p: { phase: Phase; day: number }) => points.findIndex((q) => q.phase === p.phase && q.day === p.day);

  // ── y domain: data, personal band and the nearby safety thresholds ───────────
  const r = param.range;
  const vals = points.map((p) => p.value);
  const overlay = others.flatMap((o) => o.points.filter((p) => filter === "all" || p.phase === filter).map((p) => p.value));
  const dmin = Math.min(...vals, ...overlay), dmax = Math.max(...vals, ...overlay);
  const span = Math.max(dmax - dmin, Math.abs(dmax) * 0.02, 0.5);
  const near = (t?: number) => t !== undefined && t >= dmin - span && t <= dmax + span;
  const thresholds = ([
    ["critLow", r?.critLow, "critical"], ["warnLow", r?.warnLow, "caution"],
    ["warnHigh", r?.warnHigh, "caution"], ["critHigh", r?.critHigh, "critical"],
  ] as const).filter(([, v]) => near(v)) as unknown as [string, number, "caution" | "critical"][];
  const band = base ? [base.mean - 2 * base.sd, base.mean + 2 * base.sd] : null;
  const ext = [...vals, ...overlay, ...thresholds.map((t) => t[1]), ...(band ?? [])];
  let lo = Math.min(...ext), hi = Math.max(...ext);
  const pad = (hi - lo || 1) * 0.08; lo -= pad; hi += pad;
  const Y = (v: number) => MT + (1 - (v - lo) / (hi - lo)) * (H - MT - MB);
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);

  const sel = picked ? posOf(picked) : -1;
  const active = hover ?? (sel >= 0 ? sel : points.length - 1);
  const cur: TimelinePoint | undefined = points[active];

  const fromPointer = (clientX: number) => {
    const el = svgRef.current;
    if (!el || !points.length) return null;
    const rect = el.getBoundingClientRect();
    const ux = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    xs.forEach((s, i) => { if (Math.abs(X(s) - ux) < Math.abs(X(xs[best]) - ux)) best = i; });
    return best;
  };
  const pick = (i: number) => { const p = points[i]; if (p) setPicked({ phase: p.phase, day: p.day }); };
  const onKey = (e: React.KeyboardEvent) => {
    const i = sel >= 0 ? sel : points.length - 1;
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? points.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setHover(null);
    pick(Math.max(0, Math.min(points.length - 1, next)));
  };

  // Period bands behind the points.
  const bands = PERIODS.map((ph) => {
    const idx = points.map((p, i) => (p.phase === ph ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return null;
    const half = (W - ML - MR) / slots / 2;
    const x0 = Math.max(ML - 6, X(xs[idx[0]]) - half), x1 = Math.min(W - MR + 6, X(xs[idx[idx.length - 1]]) + half);
    return { ph, x0, x1 };
  }).filter(Boolean) as { ph: Phase; x0: number; x1: number }[];

  const path = (pts: TimelinePoint[]) => {
    // Lines never cross the gap between two periods.
    let d = "";
    pts.forEach((p, i) => {
      const k = posOf(p);
      if (k < 0) return;
      const brk = i === 0 || pts[i - 1].phase !== p.phase || posOf(pts[i - 1]) < 0;
      d += `${brk ? "M" : "L"}${X(xs[k]).toFixed(1)},${Y(p.value).toFixed(1)} `;
    });
    return d;
  };

  const tooltipLeft = cur ? (X(xs[active]) / W) * 100 : 0;
  const snapshotAt = cur ? { phase: cur.phase, day: cur.day } : null;

  return (
    <div className="flex flex-col gap-3" data-testid="vitals-timeline">
      <Glass aria-label={S(lang, "Vital-sign timeline", "Línea de tiempo de signos vitales")}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="eyebrow">{S(lang, "Vital-sign timeline", "Línea de tiempo de signos vitales")} · {CREW_BY_ID[subject]?.name}</h1>
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-soft">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} data-testid="tl-compare" />
            {S(lang, "Compare with the rest of the crew", "Comparar con el resto de la tripulación")}
          </label>
        </div>

        <div role="tablist" aria-label={S(lang, "Vital sign", "Signo vital")} className="mt-3 flex flex-wrap gap-1.5" data-testid="tl-vital">
          {VITAL_KEYS.map((k) => {
            const on = k === key;
            const worst = summarize(vitalTimeline(app, subject, k), null).reduce((w, s) => (s.worst === "critical" || (s.worst === "caution" && w === "nominal") ? s.worst : w), "nominal" as TimelinePoint["level"]);
            return (
              <button key={k} type="button" role="tab" aria-selected={on} data-value={k} onClick={() => { setKey(k); setHover(null); }}
                className={`flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12.5px] ${on ? "border-accent/60 bg-accent/20 font-semibold" : "border-line text-muted hover:text-fg"}`}>
                <StatusIcon level={worst} size={10} />{tr(PARAM_BY_KEY[k].name)}
              </button>
            );
          })}
        </div>

        <div className="mt-3">
          <Segmented<Filter> label={S(lang, "Period", "Periodo")} testId="tl-period" value={filter} onChange={(f) => { setFilter(f); setHover(null); }}
            options={[{ value: "all", label: S(lang, "Whole mission", "Toda la misión") }, ...PERIODS.map((p) => ({ value: p as Filter, label: tr(PERIOD_LABEL[p]) }))]} />
        </div>

        {/* Chart */}
        <div className="mt-3">
          {/* Below ~640 px the chart scrolls sideways instead of shrinking its text. */}
          <div className="overflow-x-auto"><div className="relative min-w-[640px] pt-9">
          {cur && (
            <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-[10px] border border-line bg-[rgba(14,21,40,0.95)] px-2.5 py-1.5 text-[12px] shadow-lg"
              style={{ left: `clamp(70px, ${tooltipLeft}%, calc(100% - 70px))` }} data-testid="tl-tooltip">
              <span className="font-semibold" style={{ color: PERIOD_COLOR[cur.phase] }}>{tr(PERIOD_LABEL[cur.phase])} · {tr(cur.label)}</span>
              <span className="ml-2 font-semibold" style={{ color: cur.level === "nominal" ? undefined : LEVEL_COLOR[cur.level] }}>{n(cur.value, dec)} {param.unit}</span>
            </div>
          )}
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full select-none outline-none focus-visible:ring-2 focus-visible:ring-accent" role="img" tabIndex={0}
            aria-label={`${tr(param.name)}: ${points.length} ${S(lang, "days. Use the arrow keys to move between days.", "días. Usa las flechas para moverte entre días.")}`}
            onPointerMove={(e) => setHover(fromPointer(e.clientX))} onPointerLeave={() => setHover(null)}
            onPointerDown={(e) => { const i = fromPointer(e.clientX); if (i !== null) pick(i); }} onKeyDown={onKey} data-testid="tl-chart">
            {bands.map((b) => (
              <g key={b.ph}>
                <rect x={b.x0} y={MT - 6} width={b.x1 - b.x0} height={H - MT - MB + 12} rx={8} fill={PERIOD_COLOR[b.ph]} fillOpacity={0.07} />
                <text x={(b.x0 + b.x1) / 2} y={MT - 12} textAnchor="middle" fontSize={12} fontWeight={700} fill={PERIOD_COLOR[b.ph]}>{tr(PERIOD_LABEL[b.ph])}</text>
              </g>
            ))}
            {ticks.map((t, i) => (
              <g key={i}>
                <line x1={ML} x2={W - MR} y1={Y(t)} y2={Y(t)} stroke="currentColor" strokeOpacity={0.08} />
                <text x={ML - 8} y={Y(t) + 4} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.55}>{n(t, dec)}</text>
              </g>
            ))}
            {band && (
              <rect x={ML} width={W - ML - MR} y={Y(band[1])} height={Math.max(1, Y(band[0]) - Y(band[1]))} fill="#7DB4FF" fillOpacity={0.1}>
                <title>{S(lang, "Personal baseline ± 2 SD", "Línea base personal ± 2 DE")}</title>
              </rect>
            )}
            {thresholds.map(([name, v, lvl]) => (
              <g key={name}>
                <line x1={ML} x2={W - MR} y1={Y(v)} y2={Y(v)} stroke={LEVEL_COLOR[lvl]} strokeOpacity={0.75} strokeDasharray="5 5" />
                <text x={W - MR} y={Y(v) - 4} textAnchor="end" fontSize={10.5} fill={LEVEL_COLOR[lvl]}>{n(v, dec)}</text>
              </g>
            ))}
            {others.map((o) => <path key={o.id} d={path(o.points)} fill="none" stroke="currentColor" strokeOpacity={0.22} strokeWidth={1.5} />)}
            <path d={path(points)} fill="none" stroke="#C7D2FE" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
            {cur && <line x1={X(xs[active])} x2={X(xs[active])} y1={MT - 6} y2={H - MB + 6} stroke="currentColor" strokeOpacity={0.3} />}
            {points.map((p, i) => {
              const x = X(xs[i]), y = Y(p.value), big = i === active;
              const c = LEVEL_COLOR[p.level];
              return (
                <g key={`${p.phase}-${p.day}`} data-level={p.level}>
                  {p.level === "critical" ? <rect x={x - (big ? 6 : 4.5)} y={y - (big ? 6 : 4.5)} width={big ? 12 : 9} height={big ? 12 : 9} rx={2} fill={c} />
                    : p.level === "caution" ? <path d={`M${x},${y - (big ? 7 : 5.5)} L${x + (big ? 7 : 5.5)},${y + (big ? 5 : 4)} L${x - (big ? 7 : 5.5)},${y + (big ? 5 : 4)}Z`} fill={c} />
                    : <circle cx={x} cy={y} r={big ? 5.5 : 3.8} fill={c} />}
                  {big && <circle cx={x} cy={y} r={10} fill="none" stroke={c} strokeOpacity={0.6} />}
                </g>
              );
            })}
            {points.map((p, i) => {
              // Thin the x labels by position inside each period so they never collide.
              const every = Math.ceil(points.length / 14);
              const j = points.slice(0, i).filter((q) => q.phase === p.phase).length;
              const last = points[i + 1]?.phase !== p.phase;
              if (j % every !== 0 && !(last && j % every >= every / 2)) return null;
              return <text key={`l${i}`} x={X(xs[i])} y={H - MB + 20} textAnchor="middle" fontSize={10.5} fill="currentColor" fillOpacity={0.55}>{tr(p.label)}</text>;
            })}
          </svg>
          </div></div>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
            <span><span className="mr-1 inline-block h-2 w-4 rounded-sm bg-[#7DB4FF]/25 align-middle" />{S(lang, "personal baseline ± 2 SD", "línea base personal ± 2 DE")}</span>
            <span><span className="mr-1 inline-block w-4 border-t border-dashed border-warn align-middle" />{S(lang, "safety threshold", "umbral de seguridad")}</span>
            {compare && <span><span className="mr-1 inline-block w-4 border-t border-white/30 align-middle" />{S(lang, "rest of the crew", "resto de la tripulación")}</span>}
            <span>S = {S(lang, "baseline session", "sesión de línea base")} · D = {S(lang, "mission day", "día de misión")} · R+ = {S(lang, "recovery day", "día de recuperación")}</span>
          </p>
        </div>
      </Glass>

      {/* Period summary for the chosen vital sign */}
      <div className="grid gap-3 md:grid-cols-3" data-testid="tl-summary">
        {summary.map((s) => (
          <button key={s.phase} type="button" onClick={() => { setFilter(filter === s.phase ? "all" : s.phase); setHover(null); }} aria-pressed={filter === s.phase}
            className={`glass cursor-pointer p-4 text-left transition hover:border-accent/50 ${filter === s.phase ? "ring-2 ring-accent/60" : ""}`} data-testid={`tl-summary-${s.phase}`} data-level={s.worst}>
            <span className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-bold uppercase tracking-wide" style={{ color: PERIOD_COLOR[s.phase] }}>{tr(PERIOD_LABEL[s.phase])}</span>
              <LevelBadge level={s.worst} />
            </span>
            <span className="display mt-1 block text-[24px] font-semibold">{n(s.mean, dec)} <span className="text-[13px] font-normal text-muted">{param.unit} · {S(lang, "mean", "promedio")}</span></span>
            <span className="mt-1 grid grid-cols-3 gap-2 text-[12px]">
              <span><span className="block text-muted">{S(lang, "Min", "Mín")}</span>{n(s.min, dec)}</span>
              <span><span className="block text-muted">{S(lang, "Max", "Máx")}</span>{n(s.max, dec)}</span>
              <span><span className="block text-muted">{S(lang, "vs baseline", "vs base")}</span>{s.deltaPct === null ? "—" : `${s.deltaPct > 0 ? "+" : ""}${n(s.deltaPct, 1)} %`}</span>
            </span>
            <span className="mt-2 block text-[12px] text-soft">
              {s.outOfRange === 0 ? S(lang, `${s.n} days, all in range`, `${s.n} días, todos en rango`) : S(lang, `${s.outOfRange} of ${s.n} days out of range`, `${s.outOfRange} de ${s.n} días fuera de rango`)}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Every vital sign on the selected day */}
        <Glass aria-label={S(lang, "Selected day", "Día seleccionado")} data-testid="tl-snapshot">
          <h2 className="eyebrow">{S(lang, "All vital signs on", "Todos los signos vitales el")} {cur ? `${tr(PERIOD_LABEL[cur.phase])} · ${tr(cur.label)}` : "—"}</h2>
          <p className="mt-1 text-[12px] text-muted">{S(lang, "Click a day on the chart (or use ← →) to change it.", "Haz clic en un día del gráfico (o usa ← →) para cambiarlo.")}</p>
          <ul className="mt-2 flex flex-col divide-y divide-white/10">
            {VITAL_KEYS.map((k) => {
              const p = PARAM_BY_KEY[k];
              const pt = snapshotAt ? vitalTimeline(app, subject, k).find((x) => x.phase === snapshotAt.phase && x.day === snapshotAt.day) : undefined;
              return (
                <li key={k} className="flex items-center justify-between gap-2 py-1.5 text-[13px]">
                  <button type="button" onClick={() => setKey(k)} className={`cursor-pointer text-left hover:text-accent ${k === key ? "font-semibold text-accent" : ""}`}>{tr(p.name)}</button>
                  {pt ? (
                    <span className="flex items-center gap-1.5 font-semibold" style={{ color: pt.level === "nominal" ? undefined : LEVEL_COLOR[pt.level] }}>
                      <StatusIcon level={pt.level} size={11} />{n(pt.value, p.sim?.decimals)} <span className="text-[11px] font-normal text-muted">{p.unit}</span>
                    </span>
                  ) : <span className="text-muted">—</span>}
                </li>
              );
            })}
          </ul>
        </Glass>

        {/* Matrix: every vital sign × period (mean and worst status) */}
        <Glass aria-label={S(lang, "Summary by period", "Resumen por periodo")} data-testid="tl-matrix">
          <h2 className="eyebrow mb-2">{S(lang, "Summary by period · mean (worst status)", "Resumen por periodo · promedio (peor estado)")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] text-left text-[13px]">
              <thead className="text-muted">
                <tr>
                  <th className="py-1.5 pr-2 font-medium">{S(lang, "Vital sign", "Signo vital")}</th>
                  {PERIODS.map((ph) => <th key={ph} className="pr-2 font-medium" style={{ color: PERIOD_COLOR[ph] }}>{tr(PERIOD_LABEL[ph])}</th>)}
                </tr>
              </thead>
              <tbody>
                {VITAL_KEYS.map((k) => {
                  const p = PARAM_BY_KEY[k];
                  const sm = summarize(vitalTimeline(app, subject, k), baselineOf(app, subject, k));
                  return (
                    <tr key={k} className={`border-t border-white/10 ${k === key ? "bg-accent/10" : ""}`}>
                      <td className="py-1.5 pr-2">{tr(p.name)} <span className="text-[11px] text-muted">{p.unit}</span></td>
                      {PERIODS.map((ph) => {
                        const s = sm.find((x) => x.phase === ph);
                        return (
                          <td key={ph} className="pr-2" data-level={s?.worst}>
                            {s ? (
                              <button type="button" onClick={() => { setKey(k); setFilter(ph); setHover(null); }} className="flex cursor-pointer items-center gap-1.5 font-semibold hover:underline"
                                style={{ color: s.worst === "nominal" ? undefined : LEVEL_COLOR[s.worst] }}>
                                <StatusIcon level={s.worst} size={10} />{n(s.mean, p.sim?.decimals)}
                              </button>
                            ) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Glass>
      </div>
    </div>
  );
}
