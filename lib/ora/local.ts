/**
 * ORA local interpreter: rules + synonyms + numbers, Spanish and English.
 * Used offline, in demo mode and whenever the AI endpoint fails, so the daily check never
 * depends on the network. It only PROPOSES readings; nothing is written here.
 * Dictated text is data, never an instruction: it cannot toggle demo mode, switch crew
 * member or read another crew member's data.
 */
import { validateValue } from "../engine";
import { PARAM_BY_KEY } from "../parameters";
import type { L10n } from "../types";

export interface Proposal { parameter_key: string; value: number; unit: string }
export interface Rejection { label: string; reason: L10n }
export type OraView = "today" | "dashboard" | "body" | "entry" | "control" | "report";
export type OraAction =
  | { tool: "navigate"; view: OraView }
  | { tool: "start_test"; test_key: "pvt" }
  | { tool: "explain_metric"; parameter_key: string }
  | { tool: "get_astronaut_status" }
  | { tool: "get_active_alerts" }
  | { tool: "compare_to_baseline"; parameter_key: string }
  | { tool: "whats_missing" }
  | { tool: "help"; topic: string };

export interface OraResult {
  engine: "local" | "claude";
  proposals: Proposal[];
  rejected: Rejection[];
  clarifications: L10n[];
  actions: OraAction[];
  refused?: L10n;
  text?: string;
}

export const MAX_UTTERANCE = 500;

export const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/₂/g, "2").replace(/(\d),(\d)/g, "$1.$2").replace(/\s+/g, " ").trim();

// ── number words → digits ────────────────────────────────────────────────────
const UNITS: Record<string, number> = {
  cero: 0, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const DECIMAL = new Set(["coma", "punto", "point", "con"]);

export function wordsToDigits(text: string): string {
  const tokens = text.replace(/-/g, " ").split(" ");
  const out: string[] = [];
  const small = (t: string | undefined) => (t !== undefined && t in UNITS && UNITS[t] < 10 ? UNITS[t] : null);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i].replace(/[.,;:!?]+$/, "");
    const trail = tokens[i].slice(tok.length);
    let value: number | null = null;
    let used = 0;
    if (tok in TENS) {
      value = TENS[tok]; used = 1;
      const a = tokens[i + 1]?.replace(/[.,;:!?]+$/, "");
      const b = tokens[i + 2]?.replace(/[.,;:!?]+$/, "");
      if (!trail && (a === "y" || a === "and") && small(b) !== null && small(b)! > 0) { value += small(b)!; used = 3; }
      else if (!trail && small(a) !== null && small(a)! > 0) { value += small(a)!; used = 2; }
    } else if (tok in UNITS) { value = UNITS[tok]; used = 1; }
    if (value === null) { out.push(tokens[i]); continue; }
    // decimal part: "treinta y seis coma ocho" → 36.8
    const sep = tokens[i + used]?.replace(/[.,;:!?]+$/, "");
    const dec = tokens[i + used + 1]?.replace(/[.,;:!?]+$/, "");
    const lastTrail = tokens[i + used - 1].match(/[.,;:!?]+$/)?.[0] ?? "";
    if (!lastTrail && sep && DECIMAL.has(sep) && dec && (dec in UNITS || /^\d+$/.test(dec))) {
      const d = dec in UNITS ? String(UNITS[dec]) : dec;
      out.push(`${value}.${d}${tokens[i + used + 1].slice(dec.length)}`);
      i += used + 1;
      continue;
    }
    out.push(`${value}${lastTrail}`);
    i += used - 1;
  }
  return out.join(" ")
    // "6 horas y media" / "6 and a half hours" → 6.5
    .replace(/(\d+)(\s*(?:horas?|hours?|h|litros?|liters?|l)?)\s+(?:y media|and a half)/g, (_m, n, u) => `${Number(n) + 0.5}${u}`)
    .replace(/(\d+)(\s*(?:horas?|hours?|h|litros?|liters?|l)?)\s+(?:y cuarto|and a quarter)/g, (_m, n, u) => `${Number(n) + 0.25}${u}`);
}

// ── vocabulary ───────────────────────────────────────────────────────────────
const ALLOWED: Record<string, string[]> = {
  sleep_hours: ["dormi", "dormido", "horas de sueno", "horas sueno", "he dormido", "slept", "hours of sleep", "sleep hours", "sueno", "dormir"],
  kss: ["somnolencia", "sleepiness", "kss"],
  fatigue_sp: ["fatiga", "fatigue", "cansancio", "nivel de fatiga"],
  body_temp: ["temperatura", "temperature", "fiebre", "fever", "temp", "grados"],
  spo2: ["saturacion", "saturation", "spo2", "oximetro", "oxigeno en sangre", "blood oxygen", "oxigeno"],
  resting_hr: ["pulso", "pulse", "frecuencia cardiaca", "heart rate", "latidos", "frecuencia", "bpm", "ppm", "pulsaciones"],
  water_intake: ["agua", "water", "hidratacion", "litros de agua"],
  urine_color: ["orina", "urine", "color de orina"],
  bristol: ["bristol", "escala bristol"],
  exercise_minutes: ["ejercicio", "exercise", "entrene", "workout", "entrenamiento", "minutos de ejercicio"],
  mood: ["animo", "mood", "estado de animo"],
  headache: ["dolor de cabeza", "cefalea", "headache"],
  nausea: ["nauseas", "nausea", "mareo", "mareos"],
  cough: ["tos", "cough"],
  visual_symptoms: ["vision borrosa", "blurred vision", "blurry vision"],
  disorientation: ["desorientacion", "desorientado", "disorientation", "disoriented"],
};
const QUALITATIVE: { words: string[]; ask: L10n }[] = [
  { words: ["cansado", "cansada", "agotado", "agotada", "tired", "exhausted"], ask: { en: "You said you feel tired. What is your fatigue level, from 1 (fully alert) to 7 (exhausted)?", es: "Dijiste que te sientes cansado. ¿Qué nivel de fatiga tienes, de 1 (muy alerta) a 7 (agotado)?" } },
];
type Why = "external" | "calculated" | "test" | "sensor" | "psych";
const BLOCKED: { words: string[]; why: Why; label: string }[] = [
  { words: ["radiacion", "radiation", "dosis", "dose", "msv"], why: "external", label: "radiation" },
  { words: ["co2", "dioxido de carbono", "carbon dioxide"], why: "external", label: "CO₂" },
  { words: ["oxigeno de cabina", "cabin oxygen", "humedad", "humidity", "temperatura de cabina", "cabin temperature"], why: "external", label: "cabin" },
  { words: ["indice kp", "kp index", "tormenta solar", "solar storm", "clima espacial", "space weather"], why: "external", label: "space weather" },
  { words: ["pvt", "tiempo de reaccion", "reaction time", "dsst", "golpeteo", "tapping", "amsler", "contraste", "contrast"], why: "test", label: "on-screen test" },
  { words: ["hrv", "variabilidad", "variability", "eeg"], why: "sensor", label: "sensor" },
  { words: ["veredicto", "verdict", "linea base", "baseline", "racha", "streak", "xp"], why: "calculated", label: "calculated" },
  { words: ["estres", "stress", "soledad", "loneliness", "dass", "ucla", "ansiedad", "anxiety", "depresion", "depression"], why: "psych", label: "psychological" },
];
const WHY: Record<Why, L10n> = {
  external: { en: "comes from the spacecraft or public sources; I cannot set it.", es: "viene de la nave o de fuentes públicas; no puedo fijarlo." },
  calculated: { en: "is calculated by the app; I cannot set it.", es: "lo calcula la app; no puedo fijarlo." },
  test: { en: "is measured by an on-screen test; take the test instead.", es: "lo mide una prueba en pantalla; haz la prueba." },
  sensor: { en: "is measured by a sensor; I cannot set it by voice.", es: "lo mide un sensor; no puedo fijarlo por voz." },
  psych: { en: "is answered only on screen, never by voice, to keep it private.", es: "se responde solo en pantalla, nunca por voz, para mantenerlo privado." },
};
const SEVERITY: [RegExp, number][] = [[/\b(leve|ligero|ligera|mild|slight|poco)\b/, 1], [/\b(moderad[oa]|moderate)\b/, 2], [/\b(fuerte|intens[oa]|sever[oa]|severe|strong|mucho)\b/, 3]];
const SYMPTOM_SCALE = new Set(["headache", "nausea", "visual_symptoms", "disorientation"]);

const REFUSALS: { re: RegExp; msg: L10n }[] = [
  { re: /(modo demo|demo mode)/, msg: { en: "I cannot change demo mode. Use the D key or the button in Advanced settings.", es: "No puedo cambiar el modo demo. Usa la tecla D o el botón en Configuración avanzada." } },
  { re: /(cambia|cambiar|switch|change) (de |to )?(astronauta|tripulante|astronaut|crew)/, msg: { en: "I cannot switch crew member. Use the crew selector.", es: "No puedo cambiar de tripulante. Usa el selector de tripulación." } },
  { re: /(datos|data|estado|status|lecturas|readings) (de|of|for) (valentina|aiko|samuel|mateo|otro|otra|another|the other)/, msg: { en: "I can only show your own data.", es: "Solo puedo mostrar tus propios datos." } },
  { re: /(ignora|ignore|olvida|forget).{0,30}(instrucciones|instructions|reglas|rules)|system prompt|api key|clave/, msg: { en: "I cannot do that. I only help with your health check.", es: "No puedo hacer eso. Solo ayudo con tu chequeo de salud." } },
];

const VIEWS: [RegExp, OraView][] = [
  [/(mapa corporal|cuerpo|body map|body)/, "body"],
  [/(panel|dashboard|tendencias|trends)/, "dashboard"],
  [/(centro de control|mission control|tierra|earth)/, "control"],
  [/(reporte|informe|report)/, "report"],
  [/(ingreso|registro|log data|entry|registrar)/, "entry"],
  [/(hoy|today|inicio|home|volver|atras|regresar)/, "today"],
];

const wordAt = (text: string, w: string, from = 0) => {
  const m = new RegExp(`(?:^|[^a-z0-9])(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![a-z0-9])`, "g");
  m.lastIndex = from;
  const r = m.exec(text);
  return r ? { index: r.index + r[0].indexOf(r[1]), end: r.index + r[0].length } : null;
};

interface Mention { key: string | null; blocked?: (typeof BLOCKED)[number]; index: number; end: number }

function findMentions(text: string): Mention[] {
  const out: Mention[] = [];
  const scan = (words: string[], make: (i: number, e: number) => Mention) => {
    for (const w of words) {
      let from = 0;
      for (let hit = wordAt(text, w, from); hit; hit = wordAt(text, w, from)) { out.push(make(hit.index, hit.end)); from = hit.end; }
    }
  };
  for (const [key, words] of Object.entries(ALLOWED)) scan(words, (index, end) => ({ key, index, end }));
  for (const b of BLOCKED) scan(b.words, (index, end) => ({ key: null, blocked: b, index, end }));
  out.sort((a, b) => a.index - b.index || b.end - a.end);
  // drop mentions fully contained in a longer one ("temperatura de cabina" beats "temperatura")
  return out.filter((m, i) => !out.some((o, j) => j !== i && o.index <= m.index && o.end >= m.end && o.end - o.index > m.end - m.index));
}

export function interpretLocal(raw: string): OraResult {
  const res: OraResult = { engine: "local", proposals: [], rejected: [], clarifications: [], actions: [] };
  const text = wordsToDigits(normalize(String(raw).slice(0, MAX_UTTERANCE)));
  if (!text) return res;

  for (const r of REFUSALS) if (r.re.test(text)) return { ...res, refused: r.msg };

  const mentions = findMentions(text);
  const numbers = [...text.matchAll(/\d+(?:\.\d+)?/g)].map((m) => ({ value: Number(m[0]), index: m.index!, end: m.index! + m[0].length, used: false }))
    // digits that are part of a keyword (spo2, co2, bristol…) are not values
    .filter((n) => !mentions.some((m) => n.index >= m.index && n.end <= m.end));
  const seen = new Set<string>();
  // A question or command with no numbers is a request for help, not a reading.
  const isQuestion = numbers.length === 0 &&
    /(que significa|what does|what is|explica|explain|como (hago|se hace|funciona)|how do i|how does|inicia|iniciar|empieza|empezar|start|begin|llevame|take me|go to|ir a|abre|open|que me falta|what am i missing|what.?s left|compar)/.test(text);

  (isQuestion ? [] : mentions).forEach((m, i) => {
    const next = mentions[i + 1];
    const prev = mentions[i - 1];
    // nearest unused number after the mention, before the next mention
    let num = numbers.find((n) => !n.used && n.index >= m.end && n.index - m.end <= 35 && (!next || n.index < next.index));
    // or just before it ("6.5 horas de sueño", "a 37 la temperatura")
    if (!num) num = [...numbers].reverse().find((n) => !n.used && n.end <= m.index && m.index - n.end <= 30 && (!prev || n.index >= prev.end));

    if (m.blocked) {
      if (num) num.used = true;
      if (!seen.has(m.blocked.label)) { seen.add(m.blocked.label); res.rejected.push({ label: m.blocked.label, reason: WHY[m.blocked.why] }); }
      return;
    }
    const key = m.key!;
    if (seen.has(key)) return;
    const param = PARAM_BY_KEY[key];
    let value: number | undefined = num?.value;
    if (value === undefined && SYMPTOM_SCALE.has(key)) {
      const around = text.slice(Math.max(0, m.index - 20), m.end + 20);
      value = SEVERITY.find(([re]) => re.test(around))?.[1];
      if (value === undefined) {
        seen.add(key);
        res.clarifications.push({ en: `How strong is the ${param.name.en.toLowerCase()}: mild, moderate or severe?`, es: `¿Qué tan fuerte es (${param.name.es.toLowerCase()}): leve, moderado o fuerte?` });
        return;
      }
    }
    if (value === undefined && param.kind === "bool") value = /\b(no|sin|not|without|ninguna?)\b/.test(text.slice(Math.max(0, m.index - 14), m.index)) ? 0 : 1;
    if (value === undefined) {
      seen.add(key);
      res.clarifications.push({ en: `I did not catch a value for ${param.name.en}. What is it (${param.unit})?`, es: `No escuché un valor para ${param.name.es}. ¿Cuál es (${param.unit})?` });
      return;
    }
    if (num) num.used = true;
    seen.add(key);
    const v = validateValue(key, value);
    if (!v.ok) res.rejected.push({ label: "", reason: v.error });
    else res.proposals.push({ parameter_key: key, value: v.value, unit: param.unit });
  });

  for (const q of isQuestion ? [] : QUALITATIVE) {
    if (q.words.some((w) => wordAt(text, w)) && !seen.has("fatigue_sp")) res.clarifications.push(q.ask);
  }

  // No readings: maybe it is a question or a navigation request (read-only tools).
  if (!res.proposals.length && !res.rejected.length && !res.clarifications.length) {
    const firstParam = mentions.find((m) => m.key)?.key;
    if (/(que me falta|que falta|pendiente|what.?s left|what am i missing|what is missing|still need)/.test(text)) res.actions.push({ tool: "whats_missing" });
    else if (/(que significa|significa|what does|what is|explica|explain|meaning)/.test(text) && firstParam) res.actions.push({ tool: "explain_metric", parameter_key: firstParam });
    else if (/(linea base|baseline|comparad|compare)/.test(text) && firstParam) res.actions.push({ tool: "compare_to_baseline", parameter_key: firstParam });
    else if (/(inicia|iniciar|empieza|empezar|comenzar|start|begin|haz|hacer|take).{0,30}(pvt|vigilancia|vigilance|reaccion|reaction)/.test(text)) res.actions.push({ tool: "start_test", test_key: "pvt" });
    else if (/(alertas?|alerts?)/.test(text)) res.actions.push({ tool: "get_active_alerts" });
    else if (/(como estoy|mi estado|how am i|my status|estoy apto|am i fit)/.test(text)) res.actions.push({ tool: "get_astronaut_status" });
    else if (/(llevame|ir a|ve a|abre|abrir|muestra|mostrar|take me|go to|open|show)/.test(text)) {
      const v = VIEWS.find(([re]) => re.test(text));
      if (v) res.actions.push({ tool: "navigate", view: v[1] });
    } else if (/(como (hago|se hace|funciona)|how do i|how does)/.test(text) && /(pvt|vigilancia|vigilance|reaccion|reaction)/.test(text)) res.actions.push({ tool: "help", topic: "pvt" });
    if (!res.actions.length) res.actions.push({ tool: "help", topic: /(ayuda|help)/.test(text) ? "general" : "unknown" });
  } else if (mentions.some((m) => m.blocked) && !res.proposals.length && !res.clarifications.length && /(que significa|what does|explica|explain)/.test(text)) {
    res.rejected = [];
    res.actions.push({ tool: "help", topic: "general" });
  }
  return res;
}

/** Local confirmation words. The confirmation is always a user gesture, never model output. */
export function confirmationIntent(raw: string): "confirm" | "cancel" | null {
  const t = normalize(raw);
  if (/^(no\b|cancel|cancela|cancelar|descarta|discard|borra)/.test(t)) return "cancel";
  if (/^(si\b|yes\b|confirm|confirmo|confirma|confirmar|correcto|correct|guardar|save)/.test(t)) return "confirm";
  return null;
}
