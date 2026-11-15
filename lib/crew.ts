import type { Astronaut, Scenario, ScenarioId } from "./types";

/** Four fictional crew members. No real person's data is used anywhere in this app. */
export const CREW: Astronaut[] = [
  {
    id: "a1", name: "Valentina Rojas", callsign: "VALE",
    role: { en: "Commander", es: "Comandante" },
    offsets: { sleep_hours: 0.2, resting_hr: -4, hrv: 8, pvt_rt: -12 },
    allergies: { en: "Penicillin", es: "Penicilina" },
    history: { en: "No relevant history. Corrective lenses.", es: "Sin antecedentes relevantes. Usa lentes correctivos." },
  },
  {
    id: "a2", name: "Mateo Fuentes", callsign: "TEO",
    role: { en: "Flight engineer", es: "Ingeniero de vuelo" },
    offsets: { sleep_hours: -0.5, resting_hr: 5, hrv: -9, pvt_rt: 14 },
    allergies: { en: "None known", es: "Sin alergias conocidas" },
    history: { en: "Kidney stone (2021), resolved.", es: "Cálculo renal (2021), resuelto." },
  },
  {
    id: "a3", name: "Aiko Tanaka", callsign: "AIKO",
    role: { en: "Mission scientist", es: "Científica de misión" },
    offsets: { sleep_hours: 0.5, resting_hr: -1, hrv: 3, pvt_rt: -4 },
    allergies: { en: "Latex", es: "Látex" },
    history: { en: "Mild seasonal migraine.", es: "Migraña estacional leve." },
  },
  {
    id: "a4", name: "Samuel Okoye", callsign: "SAM",
    role: { en: "Medical officer", es: "Oficial médico" },
    offsets: { sleep_hours: -0.1, resting_hr: 2, hrv: -3, pvt_rt: 6 },
    allergies: { en: "Sulfonamides", es: "Sulfonamidas" },
    history: { en: "Knee surgery (2019), full recovery.", es: "Cirugía de rodilla (2019), recuperación completa." },
  },
];

export const CREW_BY_ID: Record<string, Astronaut> = Object.fromEntries(CREW.map((a) => [a.id, a]));

/**
 * The four scenarios of RF-01. Delay values follow the team report (0.5 s in orbit,
 * up to 12 min one-way on Mars); the transit value is an illustrative mid-cruise point.
 */
export const SCENARIOS: Scenario[] = [
  { id: "transit", name: { en: "Spacecraft in transit", es: "Nave en tránsito" }, short: { en: "Transit", es: "En tránsito" }, delaySec: 240, distanceKm: 72_000_000, missionDay: 96, missionLength: 210, doseRatePerDay: 1.8 },
  { id: "iss", name: { en: "ISS (low Earth orbit)", es: "EEI (órbita baja)" }, short: { en: "ISS", es: "EEI" }, delaySec: 0.5, distanceKm: 408, missionDay: 64, missionLength: 180, doseRatePerDay: 0.5 },
  { id: "lunar", name: { en: "Artemis lunar base", es: "Base Lunar Artemis" }, short: { en: "Lunar base", es: "Base lunar" }, delaySec: 1.3, distanceKm: 384_400, missionDay: 21, missionLength: 60, doseRatePerDay: 1.1 },
  { id: "mars", name: { en: "Mars habitat", es: "Hábitat Marciano" }, short: { en: "Mars", es: "Marte" }, delaySec: 720, distanceKm: 216_000_000, missionDay: 214, missionLength: 520, doseRatePerDay: 0.7 },
];

export const SCENARIO_BY_ID = Object.fromEntries(SCENARIOS.map((s) => [s.id, s])) as Record<ScenarioId, Scenario>;
export const DEFAULT_SCENARIO: ScenarioId = "mars";

export function formatDelay(sec: number, lang: "en" | "es" = "en"): string {
  if (sec < 60) return `${sec.toLocaleString(lang, { maximumFractionDigits: 1 })} s`;
  return `${Math.round(sec / 60)} min`;
}
