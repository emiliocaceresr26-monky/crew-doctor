"use client";

import { useSyncExternalStore } from "react";
import { LEVEL_LABEL } from "@/lib/engine";
import { fmt, t, tr, type DictKey } from "@/lib/i18n";
import { store, type AppState } from "@/lib/store";
import type { L10n, Level } from "@/lib/types";

export function useApp(): AppState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useT() {
  const lang = useApp().lang;
  return {
    lang,
    t: (k: DictKey) => t(k, lang),
    tr: (x: L10n) => tr(x, lang),
    n: (v: number, d?: number) => fmt(v, lang, d),
  };
}

export const LEVEL_COLOR: Record<Level, string> = { nominal: "#4ADE80", caution: "#FBBF24", critical: "#F87171" };

/** Status mark: circle = nominal, triangle = caution, square = critical (never colour alone). */
export function StatusIcon({ level, size = 14, label }: { level: Level; size?: number; label?: string }) {
  const c = LEVEL_COLOR[level];
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="shrink-0" data-level={level}>
      {level === "nominal" && <circle cx="7" cy="7" r="5" fill={c} />}
      {level === "caution" && <path d="M7 1.5l6 10.5H1z" fill={c} />}
      {level === "critical" && <rect x="2" y="2" width="10" height="10" rx="1.5" fill={c} />}
    </svg>
  );
}

export function LevelBadge({ level, kind = "status" }: { level: Level; kind?: "status" | "verdict" }) {
  const { tr } = useT();
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: LEVEL_COLOR[level] }} data-testid="level-badge" data-level={level}>
      <StatusIcon level={level} size={12} />
      {tr(LEVEL_LABEL[level][kind])}
    </span>
  );
}

export function SimBadge({ simulated }: { simulated: boolean }) {
  const { t } = useT();
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold tracking-wide ${simulated ? "border-accent/50 text-accent" : "border-line text-soft"}`}
      data-simulated={simulated ? "true" : "false"}
    >
      {simulated ? t("simulated") : t("crewEntered")}
    </span>
  );
}

export function Glass({ children, className = "", ...rest }: React.HTMLAttributes<HTMLElement> & { children: React.ReactNode }) {
  return (
    <section className={`glass p-4 ${className}`} {...rest}>
      {children}
    </section>
  );
}

/** Tiny inline trend line for the parameter cards. */
export function Sparkline({ values, color = "#7DB4FF", width = 120, height = 36 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 4 - ((v - min) / span) * (height - 8) + 2).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="max-w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Segmented control used for scenario, phase and mode pickers. */
export function Segmented<T extends string>({ value, options, onChange, label, testId }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; testId?: string }) {
  return (
    <div role="tablist" aria-label={label} data-testid={testId} className="grid gap-0.5 rounded-[14px] border border-line bg-glass p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value} type="button" role="tab" aria-selected={on} data-value={o.value}
            onClick={() => onChange(o.value)}
            className={`min-h-10 cursor-pointer rounded-[10px] border px-2 text-[12.5px] ${on ? "border-accent/50 bg-accent/20 font-semibold text-fg" : "border-transparent font-medium text-muted hover:text-fg"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Dimmed backdrop with friendly violet/indigo tones. Decorative only. */
export function Backdrop() {
  return (
    <div aria-hidden="true" className="no-print pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      {/* Main glow — warm indigo/violet */}
      <svg className="absolute -right-32 -top-32 h-[720px] w-[720px] opacity-70 blur-[12px]" viewBox="0 0 720 720">
        <defs>
          <radialGradient id="pl" cx="38%" cy="32%" r="80%">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="0.45" stopColor="#312e81" />
            <stop offset="1" stopColor="#0f1623" />
          </radialGradient>
          <radialGradient id="gl" cx="50%" cy="50%" r="50%">
            <stop offset="0.6" stopColor="#818cf8" stopOpacity="0.30" />
            <stop offset="1" stopColor="#818cf8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="380" cy="320" r="270" fill="url(#gl)" />
        <circle cx="380" cy="320" r="220" fill="url(#pl)" />
        <ellipse cx="380" cy="320" rx="330" ry="66" fill="none" stroke="#a5b4fc" strokeOpacity="0.35" strokeWidth="1.8" transform="rotate(-16 380 320)" />
        <ellipse cx="320" cy="370" rx="400" ry="120" fill="none" stroke="#c7d2fe" strokeOpacity="0.14" strokeWidth="1.4" transform="rotate(10 380 320)" />
      </svg>
      {/* Secondary accent — teal glow bottom-left */}
      <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full opacity-20 blur-[60px]" style={{ background: "radial-gradient(circle, #34d399 0%, transparent 70%)" }} />
      {/* Space station outline */}
      <svg className="absolute bottom-10 left-6 h-40 w-96 opacity-40 blur-[5px]" viewBox="-100 0 340 120" fill="none" stroke="#a5b4fc" strokeWidth="1.5">
        <rect x="0" y="40" width="74" height="32" rx="6" /><rect x="74" y="47" width="46" height="18" /><line x1="-90" y1="56" x2="230" y2="56" />
        <rect x="-90" y="6" width="60" height="100" /><line x1="-90" y1="56" x2="-30" y2="56" /><line x1="-60" y1="6" x2="-60" y2="106" />
        <rect x="170" y="6" width="60" height="100" /><line x1="170" y1="56" x2="230" y2="56" /><line x1="200" y1="6" x2="200" y2="106" />
      </svg>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(15,22,35,0.40) 0%, rgba(15,22,35,0.68) 45%, rgba(15,22,35,0.93) 100%)" }} />
    </div>
  );
}
