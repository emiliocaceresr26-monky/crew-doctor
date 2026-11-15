/**
 * Risk-estimation and alert engine (RF-04, RF-09, RF-12, RNF-05).
 * Pure functions: run in the browser (local-first), in Route Handlers and in tests.
 * It ESTIMATES RISK. It never diagnoses.
 */
import { PARAM_BY_KEY } from "./parameters";
import type { Alert, Baseline, Evaluation, L10n, Level, Parameter, Reading, Role, Scenario } from "./types";

// ── Validation (RNF-05) ──────────────────────────────────────────────────────
export type ValidationResult = { ok: true; value: number } | { ok: false; error: L10n };

export function validateValue(paramKey: string, raw: unknown): ValidationResult {
  const param = PARAM_BY_KEY[paramKey];
  if (!param) return { ok: false, error: { en: `Unknown parameter "${String(paramKey).slice(0, 40)}".`, es: `Parámetro desconocido "${String(paramKey).slice(0, 40)}".` } };
  if (param.origin === "calculated") return { ok: false, error: { en: `${param.name.en} is calculated by the app and cannot be entered.`, es: `${param.name.es} lo calcula la app y no se puede ingresar.` } };
  if (param.kind === "text") return { ok: false, error: { en: `${param.name.en} is not a numeric value.`, es: `${param.name.es} no es un valor numérico.` } };
  const value = typeof raw === "string" ? Number(raw.replace(",", ".")) : Number(raw);
  if (raw === "" || raw === null || raw === undefined || !Number.isFinite(value)) {
    return { ok: false, error: { en: `Enter a number for ${param.name.en}.`, es: `Ingresa un número para ${param.name.es}.` } };
  }
  if (param.limits && (value < param.limits.min || value > param.limits.max)) {
    return {
      ok: false,
      error: {
        en: `${value} ${param.unit} is outside what is physically possible for ${param.name.en} (${param.limits.min}–${param.limits.max}). Nothing was saved; check the reading and try again.`,
        es: `${value} ${param.unit} está fuera de lo físicamente posible para ${param.name.es} (${param.limits.min}–${param.limits.max}). No se guardó nada; revisa la medición e inténtalo de nuevo.`,
      },
    };
  }
  if ((param.kind === "scale" || param.kind === "bool") && !Number.isInteger(value)) {
    return { ok: false, error: { en: `${param.name.en} takes whole numbers only.`, es: `${param.name.es} solo acepta números enteros.` } };
  }
  return { ok: true, value };
}

// ── Personal baseline (RF-09) ────────────────────────────────────────────────
export const BASELINE_SESSIONS = 3;

/** Baseline = mean and SD of the pre-mission sessions. One-off events never count. */
export function computeBaseline(readings: Reading[]): Baseline | null {
  const xs = readings.filter((r) => r.phase === "pre" && !r.excludedFromBaseline).map((r) => r.value);
  if (xs.length < BASELINE_SESSIONS) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
  return { mean, sd: Math.sqrt(variance), n: xs.length };
}

/** z-score with a floor on SD so a very flat baseline does not explode into false alerts. */
export function zScore(value: number, base: Baseline, param: Parameter): number {
  const floor = Math.max(Math.abs(base.mean) * 0.03, (param.sim?.sd ?? 0) * 0.5, 1e-6);
  return (value - base.mean) / Math.max(base.sd, floor);
}

export const Z_CAUTION = 2;
export const Z_CRITICAL = 3;

const worst = (a: Level, b: Level): Level => (rank(a) >= rank(b) ? a : b);
export const rank = (l: Level): number => (l === "critical" ? 2 : l === "caution" ? 1 : 0);

// ── Evaluation: fixed safety thresholds AND deviation from personal baseline ─
export function evaluate(param: Parameter, value: number, base: Baseline | null): Evaluation {
  let level: Level = "nominal";
  const reasons: L10n[] = [];
  const u = param.unit;
  const rg = param.range;
  if (rg) {
    const src = { en: ` Source: ${rg.source}.`, es: ` Fuente: ${rg.source}.` };
    if (rg.critHigh !== undefined && value >= rg.critHigh) {
      level = "critical";
      reasons.push({ en: `${value} ${u} is at or above the critical limit of ${rg.critHigh} ${u}.${src.en}`, es: `${value} ${u} alcanza o supera el límite crítico de ${rg.critHigh} ${u}.${src.es}` });
    } else if (rg.critLow !== undefined && value < rg.critLow) {
      level = "critical";
      reasons.push({ en: `${value} ${u} is below the critical limit of ${rg.critLow} ${u}.${src.en}`, es: `${value} ${u} está bajo el límite crítico de ${rg.critLow} ${u}.${src.es}` });
    } else if (rg.warnHigh !== undefined && value >= rg.warnHigh) {
      level = "caution";
      reasons.push({ en: `${value} ${u} is at or above the caution threshold of ${rg.warnHigh} ${u}.${src.en}`, es: `${value} ${u} alcanza o supera el umbral de precaución de ${rg.warnHigh} ${u}.${src.es}` });
    } else if (rg.warnLow !== undefined && value < rg.warnLow) {
      level = "caution";
      reasons.push({ en: `${value} ${u} is below the caution threshold of ${rg.warnLow} ${u}.${src.en}`, es: `${value} ${u} está bajo el umbral de precaución de ${rg.warnLow} ${u}.${src.es}` });
    }
  }
  let z: number | null = null;
  if (base && param.z) {
    z = zScore(value, base, param);
    const bad = param.z === "high" ? z : param.z === "low" ? -z : Math.abs(z);
    if (bad >= Z_CAUTION) {
      const zl: Level = bad >= Z_CRITICAL ? "critical" : "caution";
      level = worst(level, zl);
      const dir = z > 0 ? { en: "above", es: "sobre" } : { en: "below", es: "bajo" };
      reasons.push({
        en: `${Math.abs(z).toFixed(1)} standard deviations ${dir.en} your personal baseline (${base.mean.toFixed(1)} ${u}).`,
        es: `${Math.abs(z).toFixed(1)} desviaciones estándar ${dir.es} tu línea base personal (${base.mean.toFixed(1)} ${u}).`,
      });
    }
  }
  return { level, reasons, z };
}

// ── Alerts (RF-04, RF-20, RF-21, RNF-08) ─────────────────────────────────────
export function recipientsFor(param: Parameter): Role[] {
  // Psychological findings alert the flight psychologist only (RNF-08).
  if (param.psych) return ["flight_psychologist"];
  return ["astronaut", "flight_surgeon", "commander"];
}

/** Seconds until the next scheduled link window. Demo: a window opens every 5 minutes. */
export const LINK_WINDOW_SEC = 300;

export function earthArrival(ts: number, immediate: boolean, scenario: Scenario): number {
  const sendTs = immediate ? ts : Math.ceil(ts / (LINK_WINDOW_SEC * 1000)) * LINK_WINDOW_SEC * 1000;
  return sendTs + scenario.delaySec * 1000;
}

let seq = 0;
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** Builds the alert for a reading, or null when the reading is nominal. */
export function alertFor(reading: Reading, base: Baseline | null, scenario: Scenario): Alert | null {
  const param = PARAM_BY_KEY[reading.parameter];
  if (!param) return null;
  const ev = evaluate(param, reading.value, base);
  if (ev.level === "nominal") return null;
  const immediate = !!param.immediate && ev.level === "critical";
  const tail = {
    en: " A single reading does not confirm a condition: check the trend and consult the flight surgeon.",
    es: " Una medición aislada no confirma una condición: revisa la tendencia y consulta al médico de vuelo.",
  };
  return {
    id: newId("al"),
    subject: reading.subject,
    parameter: param.key,
    level: ev.level,
    value: reading.value,
    ts: reading.ts,
    explanation: {
      en: `${param.name.en}: ${ev.reasons.map((r) => r.en).join(" ")}${tail.en}`,
      es: `${param.name.es}: ${ev.reasons.map((r) => r.es).join(" ")}${tail.es}`,
    },
    recipients: recipientsFor(param),
    immediate,
    earthArrivalTs: earthArrival(reading.ts, immediate, scenario),
    acknowledged: false,
  };
}

// ── Verdict (RF-12): in range / watch / consult ──────────────────────────────
export interface ParamStatus {
  param: Parameter;
  value: number;
  ts: number;
  evaluation: Evaluation;
  isSimulated: boolean;
}

export interface Verdict {
  level: Level;
  drivers: ParamStatus[];
  /** rule: three consecutive nights under 6 h of sleep → at least "watch" */
  sleepDebt: boolean;
}

export function sleepDebt(sleepByDay: number[]): boolean {
  const last3 = sleepByDay.slice(-3);
  return last3.length === 3 && last3.every((h) => h < 6);
}

export function computeVerdict(statuses: ParamStatus[], sleepByDay: number[] = []): Verdict {
  let level: Level = "nominal";
  for (const s of statuses) level = worst(level, s.evaluation.level);
  const debt = sleepDebt(sleepByDay);
  if (debt) level = worst(level, "caution");
  const drivers = statuses.filter((s) => s.evaluation.level !== "nominal").sort((a, b) => rank(b.evaluation.level) - rank(a.evaluation.level));
  return { level, drivers, sleepDebt: debt };
}

export const LEVEL_LABEL: Record<Level, { status: L10n; verdict: L10n }> = {
  nominal: { status: { en: "Nominal", es: "Nominal" }, verdict: { en: "In range", es: "En rango" } },
  caution: { status: { en: "Caution", es: "Precaución" }, verdict: { en: "Watch", es: "Vigilar" } },
  critical: { status: { en: "Critical alert", es: "Alerta crítica" }, verdict: { en: "Consult", es: "Consultar" } },
};
