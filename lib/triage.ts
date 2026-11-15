/**
 * Triage adapted from the Interagency Integrated Triage Tool (IITT, age >= 12), developed by
 * WHO, ICRC and MSF. Same three steps and the same order:
 *   1. RED criteria    → high-acuity resuscitation area immediately
 *   2. YELLOW criteria → clinical treatment area
 *   3. High-risk vital signs → up-triage / immediate review by the supervising clinician
 *   none               → low acuity (GREEN)
 * Only criteria the app can actually observe are evaluated; each finding names the IITT
 * criterion it maps to. Spaceflight adaptations are marked as such. Decision support only:
 * it estimates acuity, it does not diagnose. To be validated by a flight surgeon.
 */
import type { L10n } from "./types";

export type TriageLevel = "red" | "yellow" | "orange" | "green";

export interface TriageFinding {
  step: 1 | 2 | 3;
  criterion: L10n;
  evidence: L10n;
  /** true when the criterion is a spaceflight adaptation, not a literal IITT item */
  adapted?: boolean;
}

export interface TriageResult {
  level: TriageLevel;
  findings: TriageFinding[];
  /** IITT criteria that cannot be measured on board with this prototype */
  notMeasured: L10n[];
}

/** Latest value of a parameter and its z-score against the personal baseline (if any). */
export type Getter = (key: string) => { value: number; z: number | null } | undefined;

export const TRIAGE_COLOR: Record<TriageLevel, string> = { red: "#EF4444", yellow: "#FACC15", orange: "#FB923C", green: "#22C55E" };

export const TRIAGE_LABEL: Record<TriageLevel, { title: L10n; disposition: L10n; space: L10n }> = {
  red: {
    title: { en: "RED · Emergency", es: "ROJO · Emergencia" },
    disposition: { en: "Move to high acuity resuscitation area immediately", es: "Trasladar de inmediato al área de reanimación de alta acuidad" },
    space: { en: "On board: stop all tasks, activate the medical emergency protocol, Crew Medical Officer at the side now and flight surgeon on the next possible link.", es: "A bordo: detener toda tarea, activar el protocolo de emergencia médica, Oficial Médico de la Tripulación (CMO) presente ya y médico de vuelo en el primer enlace posible." },
  },
  yellow: {
    title: { en: "YELLOW · Urgent", es: "AMARILLO · Urgente" },
    disposition: { en: "Move to clinical treatment area", es: "Trasladar al área de tratamiento clínico" },
    space: { en: "On board: medical assessment by the Crew Medical Officer today; no EVA or critical tasks until reviewed; report to the flight surgeon on the next link.", es: "A bordo: evaluación por el Oficial Médico (CMO) hoy; sin EVA ni tareas críticas hasta la revisión; informar al médico de vuelo en el próximo enlace." },
  },
  orange: {
    title: { en: "HIGH-RISK VITAL SIGNS · Up-triage", es: "SIGNOS VITALES DE ALTO RIESGO · Subir prioridad" },
    disposition: { en: "Up-triage or immediate review by supervising clinician", es: "Subir prioridad o revisión inmediata por el clínico supervisor" },
    space: { en: "On board: repeat the vital signs now and request immediate review by the Crew Medical Officer.", es: "A bordo: repetir los signos vitales ahora y pedir revisión inmediata al Oficial Médico (CMO)." },
  },
  green: {
    title: { en: "GREEN · Low acuity", es: "VERDE · Baja acuidad" },
    disposition: { en: "Move to low acuity or waiting area", es: "Área de baja acuidad o de espera" },
    space: { en: "On board: continue the planned schedule with routine monitoring.", es: "A bordo: continuar el cronograma con monitoreo de rutina." },
  },
};

const L = (en: string, es: string): L10n => ({ en, es });

export function triage(get: Getter): TriageResult {
  const f: TriageFinding[] = [];
  const v = (k: string) => get(k)?.value;
  const has = (k: string, min: number) => { const x = v(k); return x !== undefined && x >= min; };
  const add = (step: 1 | 2 | 3, criterion: L10n, evidence: L10n, adapted?: boolean) => f.push({ step, criterion, evidence, adapted });

  const hr = v("resting_hr"), temp = v("body_temp"), spo2 = v("spo2"), glu = v("glucose");
  const feverOrHypo = temp !== undefined && (temp >= 38 || temp < 35);
  const altered = has("disorientation", 2);
  const headache = has("headache", 2);

  // ── Step 1 · RED ───────────────────────────────────────────────────────────
  if (hr !== undefined && (hr < 50 || hr > 150)) add(1, L("Circulation: HR < 50 or > 150", "Circulación: FC < 50 o > 150"), L(`Heart rate ${hr} bpm`, `Frecuencia cardíaca ${hr} lpm`));
  if (glu !== undefined && glu < 54) add(1, L("Disability: hypoglycaemia", "Discapacidad: hipoglucemia"), L(`Glucose ${glu} mg/dL (< 54)`, `Glucosa ${glu} mg/dL (< 54)`));
  const two = [altered, feverOrHypo, headache].filter(Boolean).length;
  if (two >= 2) {
    const parts = [altered && L("altered mental status", "estado mental alterado"), feverOrHypo && L("hypothermia or fever", "hipotermia o fiebre"), headache && L("headache", "cefalea")].filter(Boolean) as L10n[];
    add(1, L("Disability: any two of altered mental status, stiff neck, hypothermia/fever, headache", "Discapacidad: dos de estado mental alterado, rigidez de nuca, hipotermia/fiebre, cefalea"),
      L(parts.map((p) => p.en).join(" + "), parts.map((p) => p.es).join(" + ")));
  }
  if (has("cabin_ppco2_24h", 3) || has("cabin_co2", 3950) || (v("cabin_o2") !== undefined && v("cabin_o2")! < 19.5)) {
    add(1, L("Dangerous chemical exposure (cabin atmosphere)", "Exposición química peligrosa (atmósfera de cabina)"), L("Cabin CO₂ / O₂ beyond the NASA limit", "CO₂ / O₂ de cabina fuera del límite NASA"), true);
  }
  const acute: [string, number][] = [["dose_30d_bfo", 250], ["dose_30d_cns", 500], ["dose_30d_skin", 1500]];
  if (acute.some(([k, lim]) => has(k, lim))) add(1, L("Dangerous exposure (acute radiation, 30-day limit exceeded)", "Exposición peligrosa (radiación aguda, límite de 30 días superado)"), L("Radiation received in the last 30 days is over the limit (NASA-STD-3001)", "La radiación recibida en los últimos 30 días supera el límite (NASA-STD-3001)"), true);

  // ── Step 2 · YELLOW (only when no red criterion explains it) ──────────────
  if (has("nausea", 3)) add(2, L("Circulation: vomits everything", "Circulación: vomita todo"), L("Nausea / vomiting rated severe", "Náuseas / vómitos severos"));
  if (v("water_intake") !== undefined && v("water_intake")! < 1) add(2, L("Circulation: unable to drink", "Circulación: no puede beber"), L(`Water intake ${v("water_intake")} L`, `Agua ingerida ${v("water_intake")} L`));
  if (altered && two < 2) add(2, L("Disability: altered mental status (no red criteria)", "Discapacidad: estado mental alterado (sin criterios rojos)"), L("Disorientation moderate or severe", "Desorientación moderada o severa"));
  if (has("visual_symptoms", 2) || has("visual_acuity", 0.3)) add(2, L("Disability: acute visual disturbance", "Discapacidad: alteración visual aguda"), L("Visual symptoms or visual-acuity loss", "Síntomas visuales o pérdida de agudeza visual"));
  if (has("headache", 3) && two < 2) add(2, L("Disability: severe pain (no red criteria)", "Discapacidad: dolor severo (sin criterios rojos)"), L("Severe headache", "Cefalea severa"));
  if (has("fatigue_sp", 7)) add(2, L("Disability: acute general weakness", "Discapacidad: debilidad general aguda"), L("Samn-Perelli fatigue 7/7", "Fatiga Samn-Perelli 7/7"));
  if (has("pre_eva_decompression", 2)) add(2, L("Disability: acute focal neurologic complaint / severe pain", "Discapacidad: síntoma neurológico focal agudo / dolor severo"), L("Decompression symptoms before EVA", "Síntomas de descompresión antes de EVA"), true);
  if (has("rash", 1)) add(2, L("Other: new rash (no red criteria)", "Otro: erupción nueva (sin criterios rojos)"), L("Rash reported", "Sarpullido reportado"));
  if (has("wounds", 1)) add(2, L("Other: trauma / burns (no red criteria)", "Otro: trauma / quemaduras (sin criterios rojos)"), L("Wound reported", "Herida reportada"));
  if (has("crew_contagion", 1)) add(2, L("Other: exposure requiring time-sensitive prophylaxis", "Otro: exposición que requiere profilaxis urgente"), L("Contagion reported in the crew", "Contagio reportado en la tripulación"), true);

  // ── Step 3 · high-risk vital signs ─────────────────────────────────────────
  // Trained astronauts often rest below 60 bpm: low HR counts only if it is also far below their own baseline.
  const hrZ = get("resting_hr")?.z ?? null;
  if (hr !== undefined && (hr > 130 || (hr < 60 && hrZ !== null && hrZ <= -2))) add(3, L("HR < 60 or > 130", "FC < 60 o > 130"), L(`Heart rate ${hr} bpm`, `Frecuencia cardíaca ${hr} lpm`));
  if (temp !== undefined && (temp < 36 || temp > 39)) add(3, L("Temp < 36° or > 39°", "Temp < 36° o > 39°"), L(`Temperature ${temp} °C`, `Temperatura ${temp} °C`));
  if (spo2 !== undefined && spo2 < 92) add(3, L("SpO₂ < 92 %", "SpO₂ < 92 %"), L(`SpO₂ ${spo2} %`, `SpO₂ ${spo2} %`));
  if (altered) add(3, L("AVPU other than A", "AVPU distinto de A"), L("Not fully alert (disorientation)", "No plenamente alerta (desorientación)"), true);

  const level: TriageLevel = f.some((x) => x.step === 1) ? "red" : f.some((x) => x.step === 2) ? "yellow" : f.some((x) => x.step === 3) ? "orange" : "green";
  return {
    level,
    findings: f,
    notMeasured: [L("Respiratory rate (RR < 10 or > 30)", "Frecuencia respiratoria (FR < 10 o > 30)"), L("Capillary refill, stridor, bleeding", "Llenado capilar, estridor, sangrado"), L("Stiff neck, convulsions", "Rigidez de nuca, convulsiones")],
  };
}
