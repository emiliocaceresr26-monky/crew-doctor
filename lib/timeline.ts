/**
 * Vital-sign timeline across the mission periods (pre-flight baseline, in mission, post-flight
 * recovery). Pure functions over the store state so they can be tested without React.
 * One point per calendar day and period (the daily mean), each evaluated against the fixed
 * safety thresholds and the crew member's own baseline.
 */
import { CREW, SCENARIO_BY_ID } from "./crew";
import { computeBaseline, evaluate, rank } from "./engine";
import { PARAM_BY_KEY } from "./parameters";
import { HABITAT, seriesKey } from "./simulator";
import { dailySeries, type AppState } from "./store";
import type { Baseline, L10n, Level, Phase } from "./types";

export const PERIODS: Phase[] = ["pre", "mission", "post"];
export const PERIOD_LABEL: Record<Phase, L10n> = {
  pre: { en: "Pre-flight", es: "Pre-vuelo" },
  mission: { en: "In mission", es: "En misión" },
  post: { en: "Post-flight", es: "Post-vuelo" },
};
export const PERIOD_COLOR: Record<Phase, string> = { pre: "#60A5FA", mission: "#A78BFA", post: "#2DD4BF" };

export interface TimelinePoint {
  phase: Phase;
  /** start of the calendar day (ms) */
  day: number;
  /** short label for the x axis (e.g. "S1", "D214", "R+3") */
  label: L10n;
  value: number;
  level: Level;
}

export interface PeriodSummary {
  phase: Phase;
  n: number;
  mean: number;
  min: number;
  max: number;
  /** points outside the safe band or the personal baseline */
  outOfRange: number;
  worst: Level;
  /** change of the period mean against the pre-flight baseline, in % */
  deltaPct: number | null;
}

export function baselineOf(state: AppState, subject: string, key: string): Baseline | null {
  const p = PARAM_BY_KEY[key];
  return computeBaseline(state.readings[seriesKey(p.scope === "habitat" ? HABITAT : subject, key)] ?? []);
}

/** Every daily point of one vital sign for one crew member, in period order. */
export function vitalTimeline(state: AppState, subject: string, key: string): TimelinePoint[] {
  const p = PARAM_BY_KEY[key];
  if (!p) return [];
  const base = baselineOf(state, subject, key);
  const missionDay = SCENARIO_BY_ID[state.scenarioId].missionDay;
  const out: TimelinePoint[] = [];
  for (const phase of PERIODS) {
    if (!p.phases.includes(phase)) continue;
    const pts = dailySeries(state, subject, p, phase, 60);
    pts.forEach((d, i) => {
      const label: L10n =
        phase === "pre" ? { en: `S${i + 1}`, es: `S${i + 1}` }
        : phase === "mission" ? { en: `D${missionDay - (pts.length - 1 - i)}`, es: `D${missionDay - (pts.length - 1 - i)}` }
        : { en: `R+${i + 1}`, es: `R+${i + 1}` };
      const value = Math.round(d.value * 100) / 100;
      out.push({ phase, day: d.day, label, value, level: evaluate(p, value, base).level });
    });
  }
  return out;
}

export function summarize(points: TimelinePoint[], base: Baseline | null): PeriodSummary[] {
  return PERIODS.flatMap((phase) => {
    const xs = points.filter((x) => x.phase === phase);
    if (!xs.length) return [];
    const vals = xs.map((x) => x.value);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const worst = xs.reduce<Level>((w, x) => (rank(x.level) > rank(w) ? x.level : w), "nominal");
    return [{
      phase, n: xs.length, mean, min: Math.min(...vals), max: Math.max(...vals),
      outOfRange: xs.filter((x) => x.level !== "nominal").length, worst,
      deltaPct: base && base.mean !== 0 ? ((mean - base.mean) / Math.abs(base.mean)) * 100 : null,
    }];
  });
}

/** Same vital sign for the rest of the crew, for an optional comparison overlay. */
export function crewTimelines(state: AppState, key: string, except: string) {
  return CREW.filter((a) => a.id !== except).map((a) => ({ id: a.id, name: a.name, points: vitalTimeline(state, a.id, key) }));
}
