// Shared domain types. Kept free of React so they can be used in tests and Route Handlers.

export type Lang = "en" | "es";
export type L10n = { en: string; es: string };

export type Origin = "app_input" | "app_test" | "hardware" | "external" | "calculated";
export type Source = "manual" | "voice" | "test" | "sensor" | "external" | "calculated";
export type Phase = "pre" | "mission" | "post";
export type Level = "nominal" | "caution" | "critical";
export type Role = "astronaut" | "flight_surgeon" | "flight_psychologist" | "commander";
export type ScenarioId = "transit" | "iss" | "lunar" | "mars";
export type BodyNode = "neuro" | "musc" | "cardio" | "behav" | "rad";
export type System =
  | "acute" | "immune" | "sleep" | "physical" | "bone" | "quick" | "psych" | "profile"
  | "cognition" | "sensorimotor" | "vision" | "signals" | "quality"
  | "radiation" | "habitat" | "exercise" | "spaceweather" | "calc" | "blood";

export type ParamKind = "number" | "scale" | "bool" | "text";

/**
 * Safe band. Low side is exclusive (value < low), high side inclusive (value >= high).
 * `source` cites where the number comes from; `validate` means a specialist must confirm it.
 */
export interface Range {
  warnLow?: number;
  warnHigh?: number;
  critLow?: number;
  critHigh?: number;
  source: string;
  validate: boolean;
}

export interface SimSpec {
  mean: number;
  sd: number;
  /** amplitude of the 24 h rhythm added to live ticks */
  circadian?: number;
  /** value drifts upward by this much per day (e.g. radiation dose) */
  driftPerDay?: number;
  decimals?: number;
}

export interface Parameter {
  n: number; // number in the team's parameter document (1-66) and its extension (67-83)
  key: string;
  name: L10n;
  system: System;
  node: BodyNode | null;
  origin: Origin;
  sourceLabel: L10n;
  frequency: L10n;
  unit: string;
  kind: ParamKind;
  /** biologically / physically possible limits; values outside are rejected (RNF-05) */
  limits?: { min: number; max: number };
  range?: Range;
  /** direction in which deviation from personal baseline is bad */
  z?: "high" | "low" | "both";
  simulatedByDefault: boolean;
  voiceEnabled: boolean;
  featured?: number;
  phases: Phase[];
  psych?: boolean;
  /** immediate alert (fever, contagion, hypoxemia) instead of waiting for the next link */
  immediate?: boolean;
  /** per crew (default) or shared habitat value */
  scope?: "crew" | "habitat";
  sim?: SimSpec;
}

export interface Reading {
  id: string;
  subject: string; // astronaut id or "habitat"
  parameter: string;
  value: number;
  ts: number;
  phase: Phase;
  source: Source;
  isSimulated: boolean;
  voiceTranscript?: string;
  excludedFromBaseline?: boolean;
}

export interface Baseline {
  mean: number;
  sd: number;
  n: number;
}

export interface Alert {
  id: string;
  subject: string;
  parameter: string;
  level: Exclude<Level, "nominal">;
  value: number;
  ts: number;
  explanation: L10n;
  recipients: Role[];
  immediate: boolean;
  /** when the alert reaches Earth, given link window + light-time delay */
  earthArrivalTs: number;
  acknowledged: boolean;
}

export interface Astronaut {
  id: string;
  name: string;
  callsign: string;
  role: L10n;
  /** per-person offsets applied on top of each parameter's SimSpec mean */
  offsets: Record<string, number>;
  allergies: L10n;
  history: L10n;
}

export interface Scenario {
  id: ScenarioId;
  name: L10n;
  short: L10n;
  /** one-way light-time delay in seconds */
  delaySec: number;
  distanceKm: number;
  missionDay: number;
  missionLength: number;
  doseRatePerDay: number; // mSv/day, simulated
}

export interface Evaluation {
  level: Level;
  reasons: L10n[];
  z: number | null;
}
