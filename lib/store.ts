/**
 * Local-first application state (RNF-01). Everything the crew needs — readings, baselines,
 * alerts, verdict — lives here in the browser and works with no network. Supabase sync is
 * an optional subscriber (lib/sync.ts) and never blocks this store.
 */
import { DEFAULT_SCENARIO, SCENARIO_BY_ID } from "./crew";
import { alertFor, computeBaseline, computeVerdict, evaluate, newId, rank, validateValue, type ParamStatus, type Verdict } from "./engine";
import { isSimulated, PARAMETERS, PARAM_BY_KEY } from "./parameters";
import { DAY_MS, HABITAT, runDemoEvent, seedReadings, seriesKey, sourceFor, storyValue, tick, type DemoEventId, type Effect } from "./simulator";
import { triage, type TriageResult } from "./triage";
import type { Alert, Baseline, L10n, Lang, Parameter, Phase, Reading, Role, ScenarioId, Source } from "./types";

export interface MissionEvent {
  id: string;
  ts: number;
  kind: string;
  label: L10n;
}

export interface AppState {
  ready: boolean;
  lang: Lang;
  role: Role;
  scenarioId: ScenarioId;
  phase: Phase;
  astronautId: string;
  mode: "simple" | "expert";
  demoMode: boolean;
  readings: Record<string, Reading[]>;
  alerts: Alert[];
  effects: Record<string, Effect>;
  events: MissionEvent[];
  /** bumps on every change so memoised selectors can invalidate cheaply */
  rev: number;
}

const MAX_SERIES = 420;
const SETTINGS_KEY = "crewready_settings_v1";
const USER_READINGS_KEY = "crewready_user_readings_v1";

const initial: AppState = {
  ready: false, lang: "en", role: "astronaut", scenarioId: DEFAULT_SCENARIO, phase: "mission",
  astronautId: "a2", mode: "simple", demoMode: false, readings: {}, alerts: [], effects: {}, events: [], rev: 0,
};

type Listener = () => void;

export class Store {
  private state: AppState = initial;
  private listeners = new Set<Listener>();
  /** Outbox consumed by the optional Supabase sync. */
  onReading: ((r: Reading) => void) | null = null;
  onAlert: ((a: Alert) => void) | null = null;

  getState = () => this.state;
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  private set(patch: Partial<AppState>) {
    this.state = { ...this.state, ...patch, rev: this.state.rev + 1 };
    this.listeners.forEach((l) => l());
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────
  init(now = Date.now()) {
    if (this.state.ready) return;
    let settings: Partial<AppState> = {};
    let user: Reading[] = [];
    try {
      settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      user = JSON.parse(localStorage.getItem(USER_READINGS_KEY) || "[]");
    } catch { /* storage unavailable: run from seed only */ }
    const scenarioId = settings.scenarioId && SCENARIO_BY_ID[settings.scenarioId] ? settings.scenarioId : DEFAULT_SCENARIO;
    const readings = seedReadings(SCENARIO_BY_ID[scenarioId], now);
    for (const r of Array.isArray(user) ? user : []) {
      if (PARAM_BY_KEY[r?.parameter] && validateValue(r.parameter, r.value).ok) (readings[seriesKey(r.subject, r.parameter)] ||= []).push(r);
    }
    for (const k of Object.keys(readings)) readings[k].sort((a, b) => a.ts - b.ts);
    this.set({
      ready: true, readings, scenarioId,
      lang: settings.lang === "es" ? "es" : "en",
      mode: settings.mode === "expert" ? "expert" : "simple",
      role: (["astronaut", "flight_surgeon", "flight_psychologist", "commander"] as Role[]).includes(settings.role as Role) ? settings.role as Role : "astronaut",
      astronautId: typeof settings.astronautId === "string" && /^a[1-4]$/.test(settings.astronautId) ? settings.astronautId : "a2",
    });
    this.recomputeSeedAlerts();
  }

  private persistSettings() {
    const { lang, scenarioId, mode, astronautId, role } = this.state;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ lang, scenarioId, mode, astronautId, role })); } catch { /* ignore */ }
  }
  private persistUserReadings() {
    const user = Object.values(this.state.readings).flat().filter((r) => !r.isSimulated && (r.source === "manual" || r.source === "voice" || r.source === "test"));
    try { localStorage.setItem(USER_READINGS_KEY, JSON.stringify(user.slice(-500))); } catch { /* ignore */ }
  }

  // ── settings ───────────────────────────────────────────────────────────────
  setLang(lang: Lang) { this.set({ lang }); this.persistSettings(); }
  setRole(role: Role) { this.set({ role }); this.persistSettings(); }
  setPhase(phase: Phase) { this.set({ phase }); }
  setMode(mode: "simple" | "expert") { this.set({ mode }); this.persistSettings(); }
  setAstronaut(astronautId: string) { this.set({ astronautId }); this.persistSettings(); }
  setScenario(scenarioId: ScenarioId) {
    // Scenario changes distance, delay and dose rate: reseed external series, keep user data.
    const seeded = seedReadings(SCENARIO_BY_ID[scenarioId]);
    const readings = { ...this.state.readings };
    for (const p of PARAMETERS) {
      if (p.origin !== "external") continue;
      for (const k of Object.keys(seeded)) if (k.endsWith(`:${p.key}`)) readings[k] = seeded[k];
    }
    this.set({ scenarioId, readings, effects: {}, alerts: this.state.alerts.filter((a) => PARAM_BY_KEY[a.parameter]?.origin !== "external") });
    this.logEvent("scenario", { en: `Scenario: ${SCENARIO_BY_ID[scenarioId].name.en}`, es: `Escenario: ${SCENARIO_BY_ID[scenarioId].name.es}` });
    this.persistSettings();
  }
  toggleDemo() {
    const demoMode = !this.state.demoMode;
    this.set({ demoMode });
    this.logEvent("demo", demoMode ? { en: "Demo mode on: 40 parameters simulated", es: "Modo demo activado: 40 parámetros simulados" } : { en: "Demo mode off: back to real hardware", es: "Modo demo desactivado: vuelve el equipo real" });
  }
  private logEvent(kind: string, label: L10n, ts = Date.now()) {
    this.set({ events: [{ id: newId("ev"), ts, kind, label }, ...this.state.events].slice(0, 50) });
  }

  // ── readings ───────────────────────────────────────────────────────────────
  latest(subject: string, param: string, phase: Phase = "mission"): Reading | undefined {
    const s = this.state.readings[seriesKey(subject, param)];
    if (!s) return undefined;
    for (let i = s.length - 1; i >= 0; i--) if (s[i].phase === phase) return s[i];
    return undefined;
  }
  baseline(subject: string, param: string): Baseline | null {
    return computeBaseline(this.state.readings[seriesKey(subject, param)] ?? []);
  }

  /** Appends validated readings, raises alerts. The single write path for every source. */
  private append(list: Reading[]) {
    if (!list.length) return;
    const readings = { ...this.state.readings };
    const alerts = [...this.state.alerts];
    const scenario = SCENARIO_BY_ID[this.state.scenarioId];
    for (const r of list) {
      const k = seriesKey(r.subject, r.parameter);
      const series = [...(readings[k] ?? []), r];
      readings[k] = series.length > MAX_SERIES ? series.slice(series.length - MAX_SERIES) : series;
      this.onReading?.(r);
      const al = alertFor(r, computeBaseline(readings[k]), scenario);
      const open = alerts.find((a) => a.subject === r.subject && a.parameter === r.parameter && !a.acknowledged);
      if (al && (!open || rank(al.level) > rank(open.level))) {
        if (open) open.acknowledged = true; // superseded by a more severe alert
        alerts.unshift(al);
        this.onAlert?.(al);
      }
    }
    this.set({ readings, alerts: alerts.slice(0, 200) });
  }

  /** Crew-entered reading (manual, voice or on-screen test). Returns a validation error or null. */
  submit(input: { parameter: string; value: unknown; source: Source; subject?: string; voiceTranscript?: string; excludedFromBaseline?: boolean }): L10n | null {
    const param: Parameter | undefined = PARAM_BY_KEY[input.parameter];
    const v = validateValue(input.parameter, input.value);
    if (!v.ok) return v.error;
    if (input.source === "voice" && !param.voiceEnabled) {
      return { en: `${param.name.en} cannot be set by voice.`, es: `${param.name.es} no se puede fijar por voz.` };
    }
    const subject = param.scope === "habitat" ? HABITAT : input.subject ?? this.state.astronautId;
    this.append([{
      id: newId("r"), subject, parameter: param.key, value: v.value, ts: Date.now(), phase: this.state.phase,
      source: input.source, isSimulated: false,
      voiceTranscript: input.source === "voice" ? input.voiceTranscript?.slice(0, 300) : undefined,
      excludedFromBaseline: input.excludedFromBaseline,
    }]);
    this.persistUserReadings();
    return null;
  }

  /** "Sync sensors" quick button (RF-03): one simulated hardware sample for the selected crew member. */
  syncSensors() {
    const now = Date.now();
    const { astronautId, scenarioId, demoMode } = this.state;
    const keys = ["resting_hr", "hrv", "signal_quality", "body_temp", "spo2"];
    const rs = tick({ scenario: SCENARIO_BY_ID[scenarioId], demoMode: true, now, latest: () => undefined, effects: this.state.effects })
      .filter((r) => r.subject === astronautId && keys.includes(r.parameter));
    for (const key of ["body_temp", "spo2"]) {
      const p = PARAM_BY_KEY[key];
      rs.push({ id: newId("r"), subject: astronautId, parameter: key, value: storyValue(astronautId, key) ?? p.sim!.mean, ts: now, phase: this.state.phase, source: sourceFor(p), isSimulated: true });
    }
    // Outside demo mode these are still synthetic: the real devices live in the legacy check.
    this.append(rs.map((r) => ({ ...r, phase: this.state.phase, isSimulated: demoMode || true })));
    this.logEvent("sync", { en: "Sensor telemetry synced (simulated)", es: "Telemetría de sensores sincronizada (simulada)" });
  }

  tick(now = Date.now()) {
    if (!this.state.ready) return;
    const { scenarioId, demoMode, effects } = this.state;
    this.append(tick({ scenario: SCENARIO_BY_ID[scenarioId], demoMode, now, latest: (s, p) => this.latest(s, p)?.value, effects }));
  }

  simulateEvent(id: DemoEventId, label: L10n) {
    const now = Date.now();
    const res = runDemoEvent(id, this.state.astronautId, now);
    if (res.replaceLast) {
      const series = [...(this.state.readings[res.replaceLast.key] ?? [])];
      const idx = series.map((r, i) => (r.phase === "mission" ? i : -1)).filter((i) => i >= 0).slice(-res.replaceLast.values.length);
      idx.forEach((i, n) => (series[i] = { ...series[i], value: res.replaceLast!.values[n], isSimulated: true }));
      this.set({ readings: { ...this.state.readings, [res.replaceLast.key]: series } });
      const last = series[idx[idx.length - 1]];
      if (last) this.append([{ ...last, id: newId("r"), ts: now }]);
    }
    this.set({ effects: { ...this.state.effects, ...res.effects } });
    this.append(res.readings);
    this.logEvent("event", { en: `Simulated event: ${label.en}`, es: `Evento simulado: ${label.es}` }, now);
  }

  resetEvents() {
    const seeded = seedReadings(SCENARIO_BY_ID[this.state.scenarioId]);
    const readings = { ...this.state.readings };
    for (const k of Object.keys(seeded)) {
      const user = (readings[k] ?? []).filter((r) => !r.isSimulated);
      readings[k] = [...seeded[k], ...user].sort((a, b) => a.ts - b.ts);
    }
    this.set({ readings, effects: {}, alerts: [] });
    this.recomputeSeedAlerts();
    this.logEvent("reset", { en: "Simulation reset", es: "Simulación reiniciada" });
  }

  acknowledge(id: string) {
    this.set({ alerts: this.state.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)) });
  }

  /** Raises alerts for the latest seeded value of every series, so the app starts populated. */
  private recomputeSeedAlerts() {
    const scenario = SCENARIO_BY_ID[this.state.scenarioId];
    const alerts: Alert[] = [...this.state.alerts];
    for (const series of Object.values(this.state.readings)) {
      const last = [...series].reverse().find((r) => r.phase === "mission");
      if (!last || alerts.some((a) => a.subject === last.subject && a.parameter === last.parameter && !a.acknowledged)) continue;
      const al = alertFor(last, computeBaseline(series), scenario);
      if (al) alerts.push(al);
    }
    this.set({ alerts: alerts.sort((a, b) => b.ts - a.ts) });
  }
}

export const store = new Store();

// ── Selectors (pure; take state so they are trivially testable) ───────────────
export function statusOf(state: AppState, subject: string, param: Parameter, phase: Phase = state.phase): ParamStatus | null {
  const series = state.readings[seriesKey(param.scope === "habitat" ? HABITAT : subject, param.key)];
  if (!series) return null;
  let last: Reading | undefined;
  for (let i = series.length - 1; i >= 0; i--) if (series[i].phase === phase) { last = series[i]; break; }
  if (!last) return null;
  return { param, value: last.value, ts: last.ts, evaluation: evaluate(param, last.value, computeBaseline(series)), isSimulated: last.isSimulated || isSimulated(param, state.demoMode) };
}

/** One value per calendar day (mean), most recent `days` days of the given phase. */
export function dailySeries(state: AppState, subject: string, param: Parameter, phase: Phase, days = 14): { day: number; value: number }[] {
  const series = state.readings[seriesKey(param.scope === "habitat" ? HABITAT : subject, param.key)] ?? [];
  const buckets = new Map<number, number[]>();
  for (const r of series) {
    if (r.phase !== phase) continue;
    const d = new Date(r.ts); d.setHours(0, 0, 0, 0);
    const k = d.getTime();
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(r.value);
  }
  const cumulative = param.key === "radiation_dose";
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).slice(-days)
    .map(([day, xs]) => ({ day, value: cumulative ? xs[xs.length - 1] : xs.reduce((a, b) => a + b, 0) / xs.length }));
}

export function crewStatuses(state: AppState, subject: string, phase: Phase = state.phase): ParamStatus[] {
  const out: ParamStatus[] = [];
  for (const p of PARAMETERS) {
    if (p.kind === "text" || p.origin === "calculated" || !p.phases.includes(phase)) continue;
    const s = statusOf(state, subject, p, phase);
    if (s) out.push(s);
  }
  return out;
}

export function verdictOf(state: AppState, subject: string, opts: { includePsych?: boolean } = {}): Verdict {
  // Psychological readings never drive what other roles see (RNF-08).
  const statuses = crewStatuses(state, subject).filter((s) => opts.includePsych || !s.param.psych);
  const sleep = dailySeries(state, subject, PARAM_BY_KEY.sleep_hours, state.phase).map((d) => d.value);
  return computeVerdict(statuses, state.phase === "mission" ? sleep : []);
}

/** Two views: the crew member's own view, and the ground (administrator) monitoring view. */
export type View = "crew" | "ground";
export const viewOf = (role: Role): View => (role === "astronaut" ? "crew" : "ground");

/** IITT triage of one crew member from the latest value of every parameter (incl. habitat). */
export function triageOf(state: AppState, subject: string): TriageResult {
  return triage((key) => {
    const p = PARAM_BY_KEY[key];
    if (!p || !p.phases.includes(state.phase)) return undefined;
    const s = statusOf(state, subject, p);
    return s ? { value: s.value, z: s.evaluation.z } : undefined;
  });
}

/** Parameters out of their safe range or personal baseline (what the crew member monitors). */
export function alteredOf(state: AppState, subject: string, opts: { includePsych?: boolean } = {}): ParamStatus[] {
  return crewStatuses(state, subject)
    .filter((s) => s.evaluation.level !== "nominal" && (opts.includePsych || !s.param.psych))
    .sort((a, b) => rank(b.evaluation.level) - rank(a.evaluation.level));
}

export function visibleAlerts(state: AppState): Alert[] {
  const { role, astronautId } = state;
  return state.alerts.filter((a) => {
    if (!a.recipients.includes(role)) return false;
    if (role === "astronaut") return a.subject === astronautId || a.subject === HABITAT;
    return true;
  });
}

export { DAY_MS };
