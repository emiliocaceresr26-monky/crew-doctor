import type { BodyNode, L10n, Origin, Parameter, ParamKind, Phase, Range, SimSpec, System } from "./types";

/**
 * The 66 parameters of the team document "Parámetros medidos vs. fuentes externas", plus
 * 67-83: the extension with NASA thresholds (acute radiation, bone density, SANS,
 * hematology, aerobic capacity, sleep/behaviour and 24-h cabin ppCO₂).
 * This file is the single configuration source: adding a parameter = adding a row.
 * The SQL seed for the `parameters` table is generated from it (scripts/gen-seed.mjs).
 *
 * CLINICAL RANGES: every range carries its source. All are flagged `validate: true`
 * (to be confirmed by a flight surgeon). Where no citable source exists the range is
 * omitted and only the personal-baseline comparison applies.
 */

const ALL: Phase[] = ["pre", "mission", "post"];
const MISSION: Phase[] = ["mission"];

const SRC = {
  rf04: "Team requirement RF-04 (example threshold)",
  std3001v1: "NASA-STD-3001 Vol. 1 (career space-radiation limit, 600 mSv)",
  std3001v2: "NASA-STD-3001 Vol. 2 (habitable-atmosphere limits)",
  cdcFever: "CDC fever definition (>= 38.0 °C / 100.4 °F); hypothermia < 35.0 °C",
  whoSpo2: "WHO Pulse Oximetry Training Manual (95-100 % normal, < 90 % emergency)",
  ahaHr: "American Heart Association (adult resting HR 60-100 bpm; trained adults lower)",
  osha: "OSHA 29 CFR 1910.134 (oxygen-deficient < 19.5 %, enriched > 23.5 %)",
  noaa: "NOAA Space Weather Scales (G1 at Kp 5, G3 at Kp 7)",
  kss: "Karolinska Sleepiness Scale (Åkerstedt & Gillberg 1990); >= 7 = sleepy",
  sp: "Samn-Perelli fatigue scale (1982); >= 5 = moderate fatigue",
  urine: "Armstrong urine colour chart (1994)",
  team: "Team proposal — no official source yet",
  self: "Team rule for self-reported severity (0-3)",
  acuteRad: "NASA-STD-3001 Vol. 1 (30-day short-term limits: BFO 250 mGy-Eq, CNS 500 mGy, skin 1,500 mGy-Eq); 75 % caution is a team proposal",
  bone: "NASA HRP: bone mineral density loss of 1.0-1.5 %/month in 4-6-month missions without countermeasures; thresholds are a team proposal",
  sans: "Team document (SANS): optic nerve basal diameter threshold 3.56 mm, sheath cross-sectional area threshold 28.08 mm²",
  iop: "Normal intraocular pressure 10-21 mmHg (American Academy of Ophthalmology)",
  hb: "WHO haemoglobin anaemia threshold (< 12 g/dL women, < 13 g/dL men)",
  glucose: "American Diabetes Association (fasting 70-99 mg/dL; >= 126 diabetes range; < 54 significant hypoglycaemia)",
  hemolysis: "Trudel et al. 2022, Nature Medicine: 54 % increase in red-cell destruction in space (space anaemia)",
  vo2: "Team document: minimum required VO₂max 36.5 mL/kg/min",
  orbitSleep: "Team document: real on-orbit sleep is 6.0-6.5 h/night; < 6 h caution (RF-04)",
  ppco2: "NASA-STD-3001 Vol. 2: 24-h mean ppCO₂ <= 3 mmHg (~3,900 ppm); 2.5 mmHg caution is a team proposal",
} as const;

const r = (source: string, t: Omit<Range, "source" | "validate">): Range => ({ ...t, source, validate: true });

interface Opts {
  kind?: ParamKind;
  limits?: [number, number];
  range?: Range;
  z?: "high" | "low" | "both";
  voice?: boolean;
  featured?: number;
  phases?: Phase[];
  psych?: boolean;
  immediate?: boolean;
  scope?: "crew" | "habitat";
  sim?: SimSpec;
  node?: BodyNode | null;
  src?: L10n;
  freq?: L10n;
}

const NODE_BY_SYSTEM: Partial<Record<System, BodyNode>> = {
  cognition: "neuro", sensorimotor: "neuro", vision: "neuro",
  bone: "musc", exercise: "musc",
  immune: "cardio", physical: "cardio", acute: "cardio",
  sleep: "behav", psych: "behav",
  radiation: "rad", spaceweather: "rad",
  blood: "cardio",
};

const DAILY: L10n = { en: "Daily", es: "Diaria" };
const SRC_LABEL: Record<Origin, L10n> = {
  app_input: { en: "Crew entry", es: "Ingreso del astronauta" },
  app_test: { en: "On-screen test", es: "Prueba en pantalla" },
  hardware: { en: "Team hardware", es: "Hardware del equipo" },
  external: { en: "Spacecraft (simulated)", es: "Nave (simulado)" },
  calculated: { en: "Calculated by the app", es: "Calculado por la app" },
};

function p(n: number, key: string, en: string, es: string, system: System, origin: Origin, unit: string, o: Opts = {}): Parameter {
  return {
    n, key, name: { en, es }, system,
    node: o.node !== undefined ? o.node : NODE_BY_SYSTEM[system] ?? null,
    origin,
    sourceLabel: o.src ?? SRC_LABEL[origin],
    frequency: o.freq ?? DAILY,
    unit,
    kind: o.kind ?? "number",
    limits: o.limits ? { min: o.limits[0], max: o.limits[1] } : undefined,
    range: o.range,
    z: o.z,
    // Team rule: everything the app does not measure by itself is simulated.
    simulatedByDefault: origin === "external" || key === "grip_strength",
    voiceEnabled: o.voice ?? false,
    featured: o.featured,
    phases: o.phases ?? ALL,
    psych: o.psych,
    immediate: o.immediate,
    scope: o.scope ?? "crew",
    sim: o.sim,
  };
}

// Self-reported symptom: 0 none, 1 mild, 2 moderate, 3 severe.
const sym = (n: number, key: string, en: string, es: string, system: System = "acute") =>
  p(n, key, en, es, system, "app_input", "0-3", {
    kind: "scale", limits: [0, 3], voice: true,
    range: r(SRC.self, { warnHigh: 2, critHigh: 3 }),
    sim: { mean: 0.15, sd: 0.35, decimals: 0 },
  });
const flag = (n: number, key: string, en: string, es: string, o: Opts = {}) =>
  p(n, key, en, es, "immune", "app_input", "yes/no", {
    kind: "bool", limits: [0, 1], voice: true,
    range: r(SRC.self, { warnHigh: 1 }), sim: { mean: 0.02, sd: 0.1, decimals: 0 }, ...o,
  });

const WK = (en: string, es: string): L10n => ({ en, es });

export const PARAMETERS: Parameter[] = [
  // ── 1-34 · crew entry and on-screen tests ────────────────────────────────
  sym(1, "nausea", "Nausea", "Náuseas"),
  sym(2, "headache", "Headache", "Cefalea"),
  sym(3, "visual_symptoms", "Visual symptoms", "Síntomas visuales"),
  sym(4, "disorientation", "Disorientation", "Desorientación"),
  p(5, "pre_eva_decompression", "Pre-EVA decompression symptoms", "Descompresión pre-EVA", "acute", "app_input", "0-3", {
    kind: "scale", limits: [0, 3], voice: true, phases: MISSION, range: r(SRC.self, { warnHigh: 1, critHigh: 2 }),
    freq: WK("Before each EVA", "Antes de cada EVA"), sim: { mean: 0, sd: 0.1, decimals: 0 },
  }),
  flag(6, "cold_sore", "Cold sore", "Herpes labial"),
  flag(7, "rash", "Rash", "Sarpullido"),
  flag(8, "wounds", "Wounds", "Heridas"),
  flag(9, "cough", "Cough or shortness of breath", "Tos o falta de aire"),
  flag(10, "infection", "Signs of infection", "Infección"),
  flag(11, "crew_contagion", "Contagion in the crew", "Contagio en la tripulación", {
    immediate: true, range: r("Team requirement RF-24 (contagion protocol)", { critHigh: 1 }), sim: { mean: 0, sd: 0, decimals: 0 },
  }),
  p(12, "sleep_hours", "Sleep hours", "Horas de sueño", "sleep", "app_input", "h", {
    limits: [0, 24], voice: true, featured: 1, z: "low",
    range: r(SRC.rf04, { warnLow: 6 }), sim: { mean: 7.2, sd: 0.55, decimals: 1 },
  }),
  p(13, "sleep_onset", "Sleep schedule (bedtime)", "Horario de sueño (hora de dormir)", "sleep", "app_input", "h", {
    limits: [0, 24], voice: true, sim: { mean: 22.5, sd: 0.5, decimals: 1 },
  }),
  p(14, "kss", "Sleepiness (KSS)", "Somnolencia (KSS)", "sleep", "app_input", "1-9", {
    kind: "scale", limits: [1, 9], voice: true, z: "high",
    range: r(SRC.kss, { warnHigh: 7, critHigh: 9 }), sim: { mean: 3.4, sd: 1, decimals: 0 },
  }),
  p(15, "fatigue_sp", "Fatigue (Samn-Perelli)", "Fatiga (Samn-Perelli)", "sleep", "app_input", "1-7", {
    kind: "scale", limits: [1, 7], voice: true, z: "high",
    range: r(SRC.sp, { warnHigh: 5, critHigh: 7 }), sim: { mean: 2.6, sd: 0.8, decimals: 0 },
  }),
  p(16, "water_intake", "Water intake", "Agua ingerida", "physical", "app_input", "L", {
    limits: [0, 10], voice: true, z: "low", range: r(SRC.team, { warnLow: 2 }), sim: { mean: 2.6, sd: 0.3, decimals: 1 },
  }),
  p(17, "urine_color", "Urine colour", "Color de orina", "physical", "app_input", "1-8", {
    kind: "scale", limits: [1, 8], voice: true, range: r(SRC.urine, { warnHigh: 5, critHigh: 7 }), sim: { mean: 2.8, sd: 0.8, decimals: 0 },
  }),
  p(18, "bristol", "Bristol scale (digestion)", "Escala de Bristol (digestión)", "physical", "app_input", "1-7", {
    kind: "scale", limits: [1, 7], voice: true, sim: { mean: 4, sd: 0.6, decimals: 0 },
  }),
  p(19, "vitamin_d", "Vitamin D taken", "Vitamina D", "bone", "app_input", "yes/no", {
    kind: "bool", limits: [0, 1], voice: true, sim: { mean: 0.95, sd: 0.1, decimals: 0 },
  }),
  p(20, "high_sodium", "High-salt day", "Sal (día alto en sodio)", "bone", "app_input", "yes/no", {
    kind: "bool", limits: [0, 1], voice: true, sim: { mean: 0.2, sd: 0.3, decimals: 0 },
  }),
  p(21, "calcium", "Calcium intake met", "Calcio", "bone", "app_input", "yes/no", {
    kind: "bool", limits: [0, 1], voice: true, sim: { mean: 0.9, sd: 0.2, decimals: 0 },
  }),
  p(22, "one_off_event", "One-off event", "Evento puntual", "quick", "app_input", "text", {
    kind: "text", voice: true, freq: WK("When it happens", "Cuando ocurre"),
  }),
  p(23, "mood", "Mood", "Ánimo", "psych", "app_input", "0-10", {
    kind: "scale", limits: [0, 10], voice: true, psych: true, z: "low",
    range: r(SRC.team, { warnLow: 4 }), sim: { mean: 7.2, sd: 0.9, decimals: 0 },
  }),
  p(24, "stress", "Stress", "Estrés", "psych", "app_input", "0-10", {
    kind: "scale", limits: [0, 10], voice: false, psych: true, z: "high",
    range: r(SRC.team, { warnHigh: 7 }), sim: { mean: 3.2, sd: 1, decimals: 0 },
  }),
  p(25, "loneliness", "Loneliness", "Soledad", "psych", "app_input", "0-10", {
    kind: "scale", limits: [0, 10], voice: false, psych: true, z: "high",
    range: r(SRC.team, { warnHigh: 7 }), sim: { mean: 2.8, sd: 1, decimals: 0 },
  }),
  p(26, "dass21", "DASS-21", "DASS-21", "psych", "app_input", "score", {
    limits: [0, 126], psych: true, freq: WK("Weekly", "Semanal"), sim: { mean: 14, sd: 5, decimals: 0 },
  }),
  p(27, "ucla3", "UCLA-3 loneliness", "UCLA-3", "psych", "app_input", "3-9", {
    limits: [3, 9], psych: true, freq: WK("Weekly", "Semanal"), sim: { mean: 4, sd: 0.8, decimals: 0 },
  }),
  p(28, "clinical_history", "Clinical history", "Historial clínico", "profile", "app_input", "text", { kind: "text", freq: WK("Once", "Una vez") }),
  p(29, "allergies", "Allergies", "Alergias", "profile", "app_input", "text", { kind: "text", freq: WK("Once", "Una vez") }),
  p(30, "pvt_rt", "Vigilance PVT-B (reaction time)", "Vigilancia PVT-B (tiempo de reacción)", "cognition", "app_test", "ms", {
    limits: [100, 2000], featured: 8, z: "high", freq: WK("Daily (core)", "Diaria (núcleo)"),
    sim: { mean: 265, sd: 14, decimals: 0 },
  }),
  p(31, "dsst", "Processing speed (DSST)", "Velocidad de procesamiento (DSST)", "cognition", "app_test", "correct/90 s", {
    limits: [0, 150], z: "low", freq: WK("Mon & Fri", "Lunes y viernes"), sim: { mean: 62, sd: 4, decimals: 0 },
  }),
  p(32, "tapping", "Finger tapping", "Golpeteo", "sensorimotor", "app_test", "taps/10 s", {
    limits: [0, 150], z: "low", freq: WK("Tue & Fri", "Martes y viernes"), sim: { mean: 61, sd: 3, decimals: 0 },
  }),
  p(33, "amsler", "Amsler grid (distorted cells, per eye)", "Grilla de Amsler (por ojo)", "vision", "app_test", "cells", {
    limits: [0, 400], z: "high", freq: WK("Thursday", "Jueves"), sim: { mean: 0.2, sd: 0.4, decimals: 0 },
  }),
  p(34, "contrast", "Contrast sensitivity", "Sensibilidad al contraste", "vision", "app_test", "logCS", {
    limits: [0, 2.5], z: "low", freq: WK("Thursday", "Jueves"), sim: { mean: 1.8, sd: 0.06, decimals: 2 },
  }),

  // ── 35-47 · team hardware (real device; demo mode simulates) ─────────────
  p(35, "eeg_alpha", "EEG signal (relative alpha)", "Señal EEG (alfa relativa)", "signals", "hardware", "%", {
    limits: [0, 100], src: WK("Muse", "Muse"), freq: WK("At rest and during tests", "En reposo y en pruebas"), sim: { mean: 32, sd: 3, decimals: 1 },
  }),
  p(36, "resting_hr", "Resting heart rate", "Pulso en reposo", "physical", "hardware", "bpm", {
    limits: [25, 250], voice: true, featured: 2, z: "high", src: WK("Muse", "Muse"), freq: WK("At rest", "Reposo"),
    range: r(SRC.ahaHr, { warnLow: 40, warnHigh: 101 }), sim: { mean: 58, sd: 2.5, circadian: 3, decimals: 0 },
  }),
  p(37, "hrv", "Heart-rate variability (RMSSD)", "Variabilidad cardíaca (HRV)", "physical", "hardware", "ms", {
    limits: [1, 300], featured: 3, z: "low", src: WK("Muse", "Muse"), freq: WK("At rest", "Reposo"),
    sim: { mean: 62, sd: 5, circadian: 4, decimals: 0 },
  }),
  p(38, "signal_quality", "Signal quality", "Calidad de señal", "quality", "hardware", "%", {
    limits: [0, 100], src: WK("Muse", "Muse"), freq: WK("Every measurement", "En cada medición"), sim: { mean: 93, sd: 3, decimals: 0 },
  }),
  p(39, "blink_rate", "Blink rate", "Parpadeo", "vision", "hardware", "/min", {
    limits: [0, 80], z: "both", src: WK("Camera", "Cámara"), freq: WK("Thursday", "Jueves"), sim: { mean: 16, sd: 2.5, decimals: 0 },
  }),
  p(40, "hand_steadiness", "Hand steadiness (tremor)", "Firmeza de la mano", "sensorimotor", "hardware", "mm RMS", {
    limits: [0, 50], z: "high", src: WK("Camera", "Cámara"), freq: WK("During tests", "En pruebas"), sim: { mean: 2.1, sd: 0.3, decimals: 1 },
  }),
  p(41, "posture", "Postural sway", "Postura", "sensorimotor", "hardware", "°", {
    limits: [0, 45], z: "high", src: WK("Camera", "Cámara"), freq: WK("During tests", "En pruebas"), sim: { mean: 3.2, sd: 0.5, decimals: 1 },
  }),
  p(42, "speech_during_tests", "Speech during tests", "Habla durante las pruebas", "cognition", "hardware", "% time", {
    limits: [0, 100], src: WK("Microphone", "Micrófono"), freq: WK("During tests", "Durante las pruebas"), sim: { mean: 2, sd: 1.5, decimals: 0 },
  }),
  p(43, "balance", "Balance", "Equilibrio", "sensorimotor", "hardware", "score", {
    limits: [0, 100], z: "low", src: WK("PS4 controller (motion sensor)", "Control PS4 (sensor de movimiento)"),
    freq: WK("Tue & Sat", "Martes y sábado"), sim: { mean: 86, sd: 3, decimals: 0 },
  }),
  p(44, "docking_3d", "3D docking", "Acoplamiento 3D", "sensorimotor", "hardware", "score", {
    limits: [0, 100], z: "low", src: WK("PS4 controller", "Control PS4"), freq: WK("During tests", "En pruebas"), sim: { mean: 82, sd: 4, decimals: 0 },
  }),
  p(45, "body_temp", "Body temperature", "Temperatura corporal", "immune", "hardware", "°C", {
    limits: [30, 45], voice: true, featured: 5, immediate: true, z: "both",
    src: WK("Thermometer (manual entry)", "Termómetro (entrada manual)"),
    range: r(SRC.cdcFever, { warnLow: 35.5, critLow: 35, warnHigh: 37.5, critHigh: 38 }), sim: { mean: 36.6, sd: 0.15, circadian: 0.25, decimals: 1 },
  }),
  p(46, "spo2", "SpO₂", "SpO₂", "acute", "hardware", "%", {
    limits: [50, 100], voice: true, featured: 4, immediate: true,
    src: WK("Pulse oximeter (manual entry)", "Oxímetro (entrada manual)"), freq: WK("Quick log", "Registro rápido"),
    range: r(SRC.whoSpo2, { warnLow: 95, critLow: 90 }), sim: { mean: 97.5, sd: 0.6, decimals: 0 },
  }),
  p(47, "grip_strength", "Grip strength", "Fuerza de agarre", "physical", "hardware", "kgf", {
    limits: [0, 120], z: "low", node: "musc", src: WK("Always simulated (dynamometer is Mark 2)", "Siempre simulada (dinamómetro es de Mark 2)"),
    freq: WK("Wednesday", "Miércoles"), sim: { mean: 44, sd: 2, decimals: 0 },
  }),

  // ── 48-58 · external sources (always simulated in the prototype) ─────────
  p(48, "radiation_dose", "Cumulative radiation dose", "Dosis de radiación acumulada", "radiation", "external", "mSv", {
    limits: [0, 5000], featured: 6, phases: MISSION, src: WK("Suit dosimeter (simulated)", "Dosímetro del traje (simulado)"),
    freq: WK("Continuous, 24/7", "Continua, 24/7"),
    range: { warnHigh: 450, critHigh: 600, source: `${SRC.std3001v1}; 450 mSv (75 %) intermediate threshold is a team proposal`, validate: true },
    sim: { mean: 120, sd: 0.02, driftPerDay: 0.7, decimals: 1 },
  }),
  p(49, "cabin_o2", "Cabin O₂", "O₂ de cabina", "habitat", "external", "%", {
    limits: [0, 100], scope: "habitat", phases: MISSION, freq: WK("Continuous", "Continua"),
    range: r(SRC.osha, { warnLow: 19.5, warnHigh: 23.5 }), sim: { mean: 20.9, sd: 0.08, decimals: 1 },
  }),
  p(50, "cabin_co2", "Cabin CO₂", "CO₂ de cabina", "habitat", "external", "ppm", {
    limits: [0, 50000], scope: "habitat", featured: 7, phases: MISSION, freq: WK("Continuous", "Continua"),
    range: { warnHigh: 2600, critHigh: 3950, source: `${SRC.std3001v2}: 1-h average ppCO2 <= 3 mmHg (~3950 ppm at 760 mmHg); 2600 ppm (~2 mmHg) caution is a team proposal`, validate: true },
    sim: { mean: 1800, sd: 60, circadian: 120, decimals: 0 },
  }),
  p(51, "cabin_temp", "Cabin temperature", "Temperatura de cabina", "habitat", "external", "°C", {
    limits: [-20, 60], scope: "habitat", phases: MISSION, freq: WK("Continuous", "Continua"),
    range: r(SRC.std3001v2 + ": 18-27 °C", { warnLow: 18, warnHigh: 27 }), sim: { mean: 22.5, sd: 0.2, circadian: 0.6, decimals: 1 },
  }),
  p(52, "cabin_humidity", "Cabin humidity", "Humedad de cabina", "habitat", "external", "% RH", {
    limits: [0, 100], scope: "habitat", phases: MISSION, freq: WK("Continuous", "Continua"),
    range: r(SRC.std3001v2 + ": 25-75 % RH", { warnLow: 25, warnHigh: 75 }), sim: { mean: 45, sd: 1.2, decimals: 0 },
  }),
  p(53, "exercise_minutes", "Exercise minutes (CEVIS, ARED, iRED)", "Minutos de ejercicio (CEVIS, ARED, iRED)", "exercise", "external", "min", {
    limits: [0, 600], voice: true, z: "low", freq: WK("Per session", "Por sesión"),
    src: WK("Spacecraft exercise logs (simulated)", "Registros de ejercicio de la nave (simulado)"),
    range: r(SRC.team, { warnLow: 60 }), sim: { mean: 125, sd: 12, decimals: 0 },
  }),
  p(54, "exercise_load", "Exercise load (ARED)", "Carga de ejercicio (ARED)", "exercise", "external", "kg", {
    limits: [0, 300], z: "low", freq: WK("Per session", "Por sesión"),
    src: WK("Spacecraft exercise logs (simulated)", "Registros de ejercicio de la nave (simulado)"), sim: { mean: 95, sd: 5, decimals: 0 },
  }),
  p(55, "spacecraft_position", "Spacecraft position (distance to Earth)", "Posición de la nave (distancia a la Tierra)", "habitat", "external", "million km", {
    limits: [0, 500], scope: "habitat", phases: MISSION, freq: WK("Continuous", "Continua"), node: null,
    src: WK("Spacecraft telemetry (simulated)", "Telemetría de la nave (simulado)"),
  }),
  p(56, "solar_storm_prob", "Solar radiation storm probability (S1+)", "Probabilidad de tormenta de radiación solar (S1+)", "spaceweather", "external", "%", {
    limits: [0, 100], scope: "habitat", phases: MISSION, freq: WK("Every 12 h", "Cada 12 h"),
    src: WK("NOAA SWPC 3-day forecast (simulated)", "NOAA SWPC pronóstico de 3 días (simulado)"),
    range: r(SRC.team, { warnHigh: 30, critHigh: 60 }), sim: { mean: 5, sd: 2, decimals: 0 },
  }),
  p(57, "kp_index", "Geomagnetic activity (Kp)", "Actividad geomagnética (Kp)", "spaceweather", "external", "Kp", {
    limits: [0, 9], scope: "habitat", phases: MISSION, freq: WK("Every 12 h", "Cada 12 h"),
    src: WK("NOAA SWPC 3-day forecast (simulated)", "NOAA SWPC pronóstico de 3 días (simulado)"),
    range: r(SRC.noaa, { warnHigh: 5, critHigh: 7 }), sim: { mean: 2, sd: 0.6, decimals: 0 },
  }),
  p(58, "solar_events", "Solar events (flares, CMEs) in 24 h", "Eventos solares (llamaradas y CME) en 24 h", "spaceweather", "external", "events", {
    limits: [0, 50], scope: "habitat", phases: MISSION, freq: WK("Per event", "Por evento"),
    src: WK("NASA DONKI (simulated)", "NASA DONKI (simulado)"), range: r(SRC.team, { warnHigh: 1, critHigh: 3 }), sim: { mean: 0, sd: 0, decimals: 0 },
  }),

  // ── 59-66 · calculated by the app (never entered, never simulated) ───────
  p(59, "personal_baseline", "Personal baseline", "Línea base personal", "calc", "calculated", "—", { kind: "text" }),
  p(60, "verdict", "Verdict of the day", "Veredicto del día", "calc", "calculated", "—", { kind: "text" }),
  p(61, "bone_loss_estimate", "Estimated bone loss", "Pérdida ósea estimada", "bone", "calculated", "%/month", {
    limits: [0, 5], range: r(SRC.bone, { warnHigh: 1, critHigh: 1.5 }),
  }),
  p(62, "dose_vs_career_limit", "Dose vs. career limit", "Dosis acumulada frente al límite de carrera", "radiation", "calculated", "% of 600 mSv", { limits: [0, 1000], phases: MISSION }),
  p(63, "distance_to_earth", "Distance to Earth", "Distancia a la Tierra", "calc", "calculated", "km", { scope: "habitat" }),
  p(64, "comm_delay", "Communication delay", "Retraso de comunicación", "calc", "calculated", "s", { scope: "habitat" }),
  p(65, "ridge_status", "RIDGE hazard status", "Estado de cada peligro RIDGE", "calc", "calculated", "—", { kind: "text", scope: "habitat" }),
  p(66, "progress", "Streak, XP and missions", "Racha, XP y misiones", "calc", "calculated", "—", { kind: "text" }),

  // ── 67-83 · extension: NASA thresholds (external sources, simulated) ─────
  // Radiation: daily rate + 30-day acute limits (career limit is #48, 600 mSv).
  p(67, "dose_rate_daily", "Daily radiation dose rate", "Tasa diaria de radiación", "radiation", "external", "mSv/d", {
    limits: [0, 100], phases: MISSION, src: WK("Suit dosimeter (simulated)", "Dosímetro del traje (simulado)"),
    sim: { mean: 0.7, sd: 0.03, decimals: 2 },
  }),
  p(68, "dose_30d_bfo", "30-day dose — bone marrow & circulatory (BFO)", "Dosis 30 días — médula ósea y sistema circulatorio (BFO)", "radiation", "external", "mGy-Eq", {
    limits: [0, 10000], phases: MISSION, src: WK("Suit dosimeter (simulated)", "Dosímetro del traje (simulado)"),
    range: { warnHigh: 187.5, critHigh: 250, source: SRC.acuteRad, validate: true }, sim: { mean: 10, sd: 0.8, decimals: 1 },
  }),
  p(69, "dose_30d_cns", "30-day dose — central nervous system", "Dosis 30 días — sistema nervioso central", "radiation", "external", "mGy", {
    limits: [0, 10000], phases: MISSION, src: WK("Suit dosimeter (simulated)", "Dosímetro del traje (simulado)"),
    range: { warnHigh: 375, critHigh: 500, source: SRC.acuteRad, validate: true }, sim: { mean: 8, sd: 0.7, decimals: 1 },
  }),
  p(70, "dose_30d_skin", "30-day dose — skin", "Dosis 30 días — piel", "radiation", "external", "mGy-Eq", {
    limits: [0, 20000], phases: MISSION, src: WK("Suit dosimeter (simulated)", "Dosímetro del traje (simulado)"),
    range: { warnHigh: 1125, critHigh: 1500, source: SRC.acuteRad, validate: true }, sim: { mean: 13, sd: 1, decimals: 1 },
  }),
  // Musculoskeletal.
  p(71, "bmd_vs_baseline", "Bone mineral density vs. baseline", "Densidad mineral ósea vs. línea base", "bone", "external", "% of baseline", {
    limits: [50, 120], z: "low", src: WK("DXA / QCT scan (simulated)", "Densitometría DXA / QCT (simulado)"), freq: WK("Monthly", "Mensual"),
    range: r(SRC.bone, { warnLow: 97, critLow: 94 }), sim: { mean: 99.6, sd: 0.25, decimals: 1 },
  }),
  // Neuro-ocular (SANS).
  p(72, "optic_nerve_diameter", "Optic nerve basal diameter", "Diámetro basal del nervio óptico", "vision", "external", "mm", {
    limits: [1, 8], z: "high", src: WK("Ocular ultrasound (simulated)", "Ultrasonido ocular (simulado)"), freq: WK("Monthly", "Mensual"),
    range: r(SRC.sans, { warnHigh: 3.56 }), sim: { mean: 3.2, sd: 0.06, decimals: 2 },
  }),
  p(73, "optic_sheath_area", "Optic nerve sheath cross-sectional area", "Área transversal de la vaina del nervio óptico", "vision", "external", "mm²", {
    limits: [5, 80], z: "high", src: WK("Ocular ultrasound (simulated)", "Ultrasonido ocular (simulado)"), freq: WK("Monthly", "Mensual"),
    range: r(SRC.sans, { warnHigh: 28.08 }), sim: { mean: 24.5, sd: 0.6, decimals: 2 },
  }),
  p(74, "intraocular_pressure", "Intraocular pressure", "Presión intraocular", "vision", "external", "mmHg", {
    limits: [0, 80], z: "both", src: WK("Tonometer (simulated)", "Tonómetro (simulado)"), freq: WK("Weekly", "Semanal"),
    range: r(SRC.iop, { warnLow: 10, warnHigh: 22 }), sim: { mean: 15, sd: 1.2, decimals: 0 },
  }),
  p(75, "visual_acuity", "Visual acuity", "Agudeza visual", "vision", "external", "logMAR", {
    limits: [-0.3, 1.5], z: "high", src: WK("Eye chart (simulated)", "Cartilla visual (simulado)"), freq: WK("Weekly", "Semanal"),
    range: r(SRC.team + " (logMAR 0.2 ≈ 20/32)", { warnHigh: 0.2 }), sim: { mean: 0, sd: 0.03, decimals: 2 },
  }),
  // Hematology ("space anaemia").
  p(76, "hemoglobin", "Haemoglobin", "Hemoglobina", "blood", "external", "g/dL", {
    limits: [3, 25], z: "low", src: WK("Blood analyser (simulated)", "Analizador de sangre (simulado)"), freq: WK("Monthly", "Mensual"),
    range: r(SRC.hb, { warnLow: 12 }), sim: { mean: 14.5, sd: 0.35, decimals: 1 },
  }),
  p(77, "glucose", "Blood glucose", "Glucosa", "blood", "external", "mg/dL", {
    limits: [20, 600], z: "both", src: WK("Blood analyser (simulated)", "Analizador de sangre (simulado)"), freq: WK("Monthly", "Mensual"),
    range: r(SRC.glucose, { warnLow: 70, critLow: 54, warnHigh: 100, critHigh: 126 }), sim: { mean: 88, sd: 3.5, decimals: 0 },
  }),
  p(78, "hemolysis_increase", "Red-cell destruction vs. pre-flight", "Destrucción de glóbulos rojos vs. pre-vuelo", "blood", "external", "% increase", {
    limits: [-50, 300], phases: MISSION, src: WK("Breath CO analysis (simulated)", "Análisis de CO exhalado (simulado)"), freq: WK("Monthly", "Mensual"),
    range: r(SRC.hemolysis + "; caution at or above that reference is a team proposal", { warnHigh: 54 }), sim: { mean: 45, sd: 3, decimals: 0 },
  }),
  // Cardiovascular / aerobic capacity (resting HR #36 and HRV #37 already exist).
  p(79, "vo2max", "Aerobic capacity (VO₂max)", "Capacidad aeróbica (VO₂max)", "exercise", "external", "mL/kg/min", {
    limits: [10, 90], z: "low", node: "cardio", src: WK("CEVIS fitness test (simulated)", "Prueba de esfuerzo CEVIS (simulado)"), freq: WK("Monthly", "Mensual"),
    range: r(SRC.vo2, { warnLow: 36.5 }), sim: { mean: 43, sd: 1, decimals: 1 },
  }),
  // Sleep and behaviour (sleep hours #12 already exists).
  p(80, "effective_sleep", "Effective sleep", "Sueño efectivo", "sleep", "external", "h", {
    limits: [0, 24], z: "low", src: WK("Actigraphy (simulated)", "Actigrafía (simulado)"),
    range: r(SRC.orbitSleep, { warnLow: 6 }), sim: { mean: 6.7, sd: 0.15, decimals: 1 },
  }),
  p(81, "circadian_misalignment", "Circadian misalignment", "Desfase circadiano", "sleep", "external", "h", {
    limits: [0, 12], z: "high", src: WK("Actigraphy + schedule (simulated)", "Actigrafía + horario (simulado)"),
    range: r(SRC.team, { warnHigh: 2, critHigh: 4 }), sim: { mean: 0.5, sd: 0.2, decimals: 1 },
  }),
  p(82, "cognitive_load", "Cognitive load (NASA-TLX)", "Carga cognitiva (NASA-TLX)", "psych", "app_input", "0-100", {
    kind: "scale", limits: [0, 100], z: "high", node: "behav",
    range: r(SRC.team, { warnHigh: 70 }), sim: { mean: 40, sd: 5, decimals: 0 },
  }),
  // Habitat atmosphere (instantaneous CO₂ in ppm is #50).
  p(83, "cabin_ppco2_24h", "Cabin ppCO₂ (24-h mean)", "ppCO₂ de cabina (media 24 h)", "habitat", "external", "mmHg", {
    limits: [0, 40], scope: "habitat", phases: MISSION, freq: WK("Rolling 24 h", "Móvil 24 h"),
    range: r(SRC.ppco2, { warnHigh: 2.5, critHigh: 3 }), sim: { mean: 1.4, sd: 0.08, decimals: 2 },
  }),
];

export const PARAM_BY_KEY: Record<string, Parameter> = Object.fromEntries(PARAMETERS.map((x) => [x.key, x]));
export const FEATURED: Parameter[] = PARAMETERS.filter((x) => x.featured).sort((a, b) => a.featured! - b.featured!);
export const CAREER_DOSE_LIMIT_MSV = 600;

/** The 27 external + 13 hardware parameters that demo mode marks as simulated (40 in total). */
export const DEMO_SIMULATED: Parameter[] = PARAMETERS.filter((x) => x.origin === "external" || x.origin === "hardware");

/** True when a reading of this parameter must be stored with is_simulated = true. */
export function isSimulated(param: Parameter, demoMode: boolean): boolean {
  if (param.simulatedByDefault) return true; // externals + grip strength: always
  if (param.origin === "hardware") return demoMode; // real device unless demo mode
  return false; // crew entry, on-screen tests and calculated values are never simulated
}
