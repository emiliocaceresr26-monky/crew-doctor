/** Derived views: body-map nodes (RF-02), RIDGE hazards (RF-19), three actions (RF-12), progress (RF-07). */
import { guideFor, MAINTENANCE_ACTIONS } from "@/content/guide";
import { rank, type ParamStatus, type Verdict } from "./engine";
import { PARAM_BY_KEY } from "./parameters";
import { crewStatuses, dailySeries, type AppState } from "./store";
import type { BodyNode, L10n, Level } from "./types";

const worstOf = (xs: ParamStatus[]): Level => xs.reduce<Level>((l, s) => (rank(s.evaluation.level) > rank(l) ? s.evaluation.level : l), "nominal");

export const NODES: { id: BodyNode; name: L10n; systems: L10n; x: number; y: number }[] = [
  { id: "neuro", name: { en: "Neuro-ocular", es: "Neuro-Ocular" }, systems: { en: "Cognition, sensorimotor, vision (SANS)", es: "Cognición, sensoriomotor, visión (SANS)" }, x: 100, y: 34 },
  { id: "cardio", name: { en: "Cardiovascular / Immune", es: "Cardiovascular / Inmunitario" }, systems: { en: "Immune, pulse, HRV, hydration, acute symptoms", es: "Inmune, pulso, HRV, hidratación, síntomas agudos" }, x: 100, y: 112 },
  { id: "behav", name: { en: "Behavioural / Sleep", es: "Conductual / Sueño" }, systems: { en: "Sleep and rhythm, psychological", es: "Sueño y ritmo, psicológico" }, x: 60, y: 70 },
  { id: "musc", name: { en: "Musculoskeletal", es: "Musculoesquelético" }, systems: { en: "Bone, strength, exercise", es: "Hueso, fuerza, ejercicio" }, x: 78, y: 250 },
  { id: "rad", name: { en: "Radiation", es: "Radiación" }, systems: { en: "Cumulative dose, space weather", es: "Dosis acumulada, clima espacial" }, x: 150, y: 170 },
];

export interface NodeStatus { level: Level; statuses: ParamStatus[] }

export function nodeStatus(state: AppState, subject: string, node: BodyNode, includePsych: boolean): NodeStatus {
  const statuses = crewStatuses(state, subject).filter((s) => s.param.node === node && (includePsych || !s.param.psych));
  return { level: worstOf(statuses), statuses: statuses.sort((a, b) => rank(b.evaluation.level) - rank(a.evaluation.level)) };
}

export const RIDGE: { id: string; letter: string; name: L10n; params: string[] }[] = [
  { id: "radiation", letter: "R", name: { en: "Radiation", es: "Radiación" }, params: ["radiation_dose", "solar_storm_prob", "kp_index", "solar_events"] },
  { id: "isolation", letter: "I", name: { en: "Isolation", es: "Aislamiento" }, params: ["sleep_hours", "kss", "fatigue_sp", "mood", "stress", "loneliness"] },
  { id: "distance", letter: "D", name: { en: "Distance", es: "Distancia" }, params: [] },
  { id: "gravity", letter: "G", name: { en: "Gravity", es: "Gravedad" }, params: ["balance", "grip_strength", "exercise_minutes", "exercise_load", "posture", "tapping"] },
  { id: "environment", letter: "E", name: { en: "Environments", es: "Entornos" }, params: ["cabin_o2", "cabin_co2", "cabin_temp", "cabin_humidity"] },
];

export function ridgeStatus(state: AppState, subject: string, includePsych: boolean, sleepDebt = false): { id: string; name: L10n; level: Level }[] {
  const all = crewStatuses(state, subject);
  return RIDGE.map((h) => {
    const xs = all.filter((s) => h.params.includes(s.param.key) && (includePsych || !s.param.psych));
    let level = worstOf(xs);
    if (h.id === "isolation" && sleepDebt && level === "nominal") level = "caution";
    return { id: h.id, name: h.name, level };
  });
}

/** 15 of the 17 HRP risks are monitored; hypoxia and dynamic loads wait for the Mark 2 console. */
export const HRP_MONITORED = 15;
export const HRP_TOTAL = 17;

export interface Action { text: L10n; system: L10n }

/** Three concrete actions: first from what drifted, then maintenance actions. */
export function threeActions(verdict: Verdict): Action[] {
  const out: Action[] = [];
  const seen = new Set<string>();
  const add = (a: Action) => { if (!seen.has(a.text.en) && out.length < 3) { seen.add(a.text.en); out.push(a); } };
  if (verdict.sleepDebt) add({ text: guideFor("sleep_hours").actions[0], system: PARAM_BY_KEY.sleep_hours.name });
  for (const d of verdict.drivers) add({ text: guideFor(d.param.key).actions[0], system: d.param.name });
  for (const d of verdict.drivers.slice(0, 1)) add({ text: guideFor(d.param.key).actions[1], system: d.param.name });
  for (const m of MAINTENANCE_ACTIONS) add(m);
  return out;
}

/** Streak = consecutive days (ending today or yesterday) with at least one sleep log. */
export function streakDays(state: AppState, subject: string): number {
  const days = dailySeries(state, subject, PARAM_BY_KEY.sleep_hours, "mission", 60).map((d) => d.day);
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (i < days.length - 1 && days[i + 1] - days[i] > 86_400_000 * 1.5) break;
    streak++;
  }
  return streak;
}

export interface WeeklyMission { name: L10n; done: boolean }

export function weeklyMissions(state: AppState, subject: string): WeeklyMission[] {
  const last7 = (key: string) => dailySeries(state, subject, PARAM_BY_KEY[key], "mission", 7).map((d) => d.value);
  const sleep = last7("sleep_hours");
  const exercise = last7("exercise_minutes");
  const water = last7("water_intake");
  return [
    { name: { en: "7 daily checks in a row", es: "7 chequeos diarios seguidos" }, done: streakDays(state, subject) >= 7 },
    { name: { en: "Exercise 5 days this week", es: "Ejercicio 5 días esta semana" }, done: exercise.filter((m) => m >= 60).length >= 5 },
    { name: { en: "5 nights with 7 h of sleep", es: "5 noches con 7 h de sueño" }, done: sleep.filter((h) => h >= 7).length >= 5 },
    { name: { en: "Hydration on target all week", es: "Hidratación en meta toda la semana" }, done: water.length >= 7 && water.every((l) => l >= 2) },
  ].slice(0, 3);
}

export const XP_PER_CHECK = 50;
export function progress(state: AppState, subject: string) {
  const checks = dailySeries(state, subject, PARAM_BY_KEY.sleep_hours, "mission", 60).length;
  const missions = weeklyMissions(state, subject);
  const xp = checks * XP_PER_CHECK + missions.filter((m) => m.done).length * 100;
  return { xp, level: Math.floor(xp / 300) + 1, streak: streakDays(state, subject), missions };
}
