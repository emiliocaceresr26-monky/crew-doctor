/**
 * "What does it mean?" guide (RF-06). Local content: works offline and never depends on AI.
 * Educational text only — it explains a metric and lists general countermeasures.
 * It does not diagnose and does not recommend medication.
 * References: NASA Human Research Program risk pages, NASA Standard Measures, NASA-STD-3001.
 * All content must be reviewed by a flight surgeon before operational use.
 */
import type { L10n } from "@/lib/types";

export interface GuideEntry {
  meaning: L10n;
  whyInSpace: L10n;
  actions: L10n[];
  hrpRisk: L10n;
}

const g = (meaningEn: string, meaningEs: string, whyEn: string, whyEs: string, actions: [string, string][], riskEn: string, riskEs: string): GuideEntry => ({
  meaning: { en: meaningEn, es: meaningEs },
  whyInSpace: { en: whyEn, es: whyEs },
  actions: actions.map(([en, es]) => ({ en, es })),
  hrpRisk: { en: riskEn, es: riskEs },
});

export const GUIDE: Record<string, GuideEntry> = {
  sleep_hours: g(
    "How many hours you slept last night. Short sleep lowers attention and reaction speed the next day.",
    "Cuántas horas dormiste anoche. Dormir poco baja la atención y la velocidad de reacción al día siguiente.",
    "There is no natural day and night on board: light, noise, workload and schedule shifts disturb the body clock, so crews often sleep less than planned.",
    "A bordo no hay día y noche naturales: la luz, el ruido, la carga de trabajo y los cambios de horario alteran el reloj biológico, y las tripulaciones suelen dormir menos de lo planificado.",
    [["Sleep more than 6 h tonight: protect a fixed bedtime", "Duerme más de 6 h esta noche: protege un horario fijo"], ["Dim the lights and avoid bright screens in the last hour", "Baja la luz y evita pantallas brillantes en la última hora"], ["Avoid caffeine in the 6 h before sleep", "Evita cafeína en las 6 h previas a dormir"]],
    "HRP risk: Sleep loss, circadian desynchronisation and work overload", "Riesgo HRP: pérdida de sueño, desincronización circadiana y sobrecarga de trabajo",
  ),
  resting_hr: g(
    "Heartbeats per minute while you are calm and seated. It is compared with your own usual value.",
    "Latidos por minuto estando tranquilo y sentado. Se compara con tu propio valor habitual.",
    "In microgravity body fluids shift toward the head and blood volume drops, so the heart adapts. Fatigue, dehydration, fever or stress can also raise resting heart rate.",
    "En microgravedad los líquidos se desplazan hacia la cabeza y baja el volumen de sangre, así que el corazón se adapta. La fatiga, la deshidratación, la fiebre o el estrés también pueden subir el pulso en reposo.",
    [["Repeat the measurement after 5 min of quiet rest", "Repite la medición tras 5 min de reposo tranquilo"], ["Drink water and log your urine colour", "Toma agua y registra el color de tu orina"], ["Check temperature and how you slept", "Revisa tu temperatura y cómo dormiste"]],
    "HRP risk: Cardiovascular adaptations", "Riesgo HRP: adaptaciones cardiovasculares",
  ),
  hrv: g(
    "The small beat-to-beat variation of your heart. A higher value than your usual generally reflects good recovery; a drop suggests load, stress or poor sleep.",
    "La pequeña variación entre latido y latido. Un valor mayor al habitual suele reflejar buena recuperación; una caída sugiere carga, estrés o mal sueño.",
    "Sleep loss, heavy workload and isolation load the autonomic nervous system. HRV is personal, so it is only read against your own baseline.",
    "La falta de sueño, la carga de trabajo y el aislamiento cargan el sistema nervioso autónomo. La HRV es personal: solo se interpreta contra tu propia línea base.",
    [["Prioritise sleep tonight", "Prioriza el sueño esta noche"], ["Lower exercise intensity tomorrow", "Baja la intensidad del ejercicio mañana"], ["Do 10 min of guided breathing", "Haz 10 min de respiración guiada"]],
    "HRP risk: Cardiovascular adaptations; Behavioural health", "Riesgo HRP: adaptaciones cardiovasculares; salud conductual",
  ),
  spo2: g(
    "The percentage of oxygen carried by your blood, read with a fingertip oximeter.",
    "El porcentaje de oxígeno que lleva tu sangre, leído con un oxímetro de dedo.",
    "Cabin atmosphere is artificial. A fault in oxygen supply or a local pocket of CO₂ can lower oxygen saturation before you notice symptoms.",
    "La atmósfera de la cabina es artificial. Una falla en el suministro de oxígeno o una bolsa local de CO₂ puede bajar la saturación antes de que notes síntomas.",
    [["Repeat the reading with warm, still hands", "Repite la medición con la mano tibia y quieta"], ["Move to a well-ventilated area and check cabin O₂ and CO₂", "Ve a una zona bien ventilada y revisa O₂ y CO₂ de cabina"], ["Contact the flight surgeon now if it stays low or you feel short of breath", "Contacta al médico de vuelo ahora si sigue baja o te falta el aire"]],
    "HRP risk: Hypoxia (monitored manually today; automatic with the Mark 2 console)", "Riesgo HRP: hipoxia (hoy por medición manual; automática con la consola Mark 2)",
  ),
  body_temp: g(
    "Your body temperature measured with a thermometer.",
    "Tu temperatura corporal medida con termómetro.",
    "The immune system changes in spaceflight and latent viruses can reactivate. In a closed habitat an infection spreads easily, so fever is treated as an immediate alert.",
    "El sistema inmune cambia en el vuelo espacial y pueden reactivarse virus latentes. En un hábitat cerrado una infección se propaga con facilidad; por eso la fiebre es alerta inmediata.",
    [["Repeat the measurement in 15 min", "Repite la medición en 15 min"], ["Rest, drink fluids and limit contact with the crew", "Descansa, hidrátate y limita el contacto con la tripulación"], ["Report to the flight surgeon and log any other symptom", "Informa al médico de vuelo y registra cualquier otro síntoma"]],
    "HRP risk: Immune response; Host-microorganism interactions", "Riesgo HRP: respuesta inmune; interacciones huésped-microorganismo",
  ),
  radiation_dose: g(
    "The radiation dose your suit dosimeter has accumulated during the mission, compared with the 600 mSv career limit.",
    "La dosis de radiación acumulada por el dosímetro de tu traje durante la misión, comparada con el límite de carrera de 600 mSv.",
    "Beyond Earth's magnetic field the crew is exposed to galactic cosmic rays and solar particle events. Dose only accumulates; it never goes down.",
    "Fuera del campo magnético de la Tierra la tripulación recibe rayos cósmicos galácticos y eventos de partículas solares. La dosis solo se acumula; nunca baja.",
    [["Check the space-weather forecast before any EVA", "Revisa el pronóstico de clima espacial antes de una EVA"], ["During a solar storm, move to the most shielded area", "Durante una tormenta solar, ve a la zona más blindada"], ["Keep the dosimeter on your suit 24/7", "Mantén el dosímetro en tu traje 24/7"]],
    "HRP risk: Space radiation exposure", "Riesgo HRP: exposición a la radiación espacial",
  ),
  cabin_co2: g(
    "The concentration of carbon dioxide in the cabin air.",
    "La concentración de dióxido de carbono en el aire de la cabina.",
    "Without gravity warm air does not rise, so exhaled CO₂ can pool around the crew when ventilation is poor. High CO₂ causes headache and lowers concentration.",
    "Sin gravedad el aire caliente no sube, así que el CO₂ exhalado puede acumularse alrededor de la tripulación si la ventilación es mala. El CO₂ alto causa cefalea y baja la concentración.",
    [["Increase ventilation and check the CO₂ scrubber", "Aumenta la ventilación y revisa el depurador de CO₂"], ["Leave poorly ventilated spots such as sleep stations", "Sal de zonas mal ventiladas, como los puestos de sueño"], ["Log headache or drowsiness in your check", "Registra cefalea o somnolencia en tu chequeo"]],
    "HRP risk: Hostile closed environment", "Riesgo HRP: entorno cerrado hostil",
  ),
  pvt_rt: g(
    "Your mean reaction time in the 3-minute vigilance test (PVT-B). Slower than your own usual means lower alertness.",
    "Tu tiempo de reacción promedio en la prueba de vigilancia de 3 minutos (PVT-B). Más lento que tu habitual indica menor alerta.",
    "Sleep loss, CO₂ and workload reduce alertness. NASA uses this kind of test on the ISS (Reaction Self-Test) because it is brief and sensitive to fatigue.",
    "La falta de sueño, el CO₂ y la carga de trabajo reducen la alerta. NASA usa este tipo de prueba en la EEI (Reaction Self-Test) porque es breve y sensible a la fatiga.",
    [["Postpone critical tasks if you can, or ask for a cross-check", "Posterga las tareas críticas si puedes, o pide verificación cruzada"], ["Take a 20-min nap or a bright-light break", "Toma una siesta de 20 min o una pausa con luz brillante"], ["Repeat the test after resting", "Repite la prueba después de descansar"]],
    "HRP risk: Sleep loss; Cognitive or behavioural conditions", "Riesgo HRP: pérdida de sueño; condiciones cognitivas o conductuales",
  ),
};

const GENERIC: GuideEntry = g(
  "This value is compared with safe limits and with your own baseline.",
  "Este valor se compara con límites seguros y con tu propia línea base.",
  "Spaceflight changes how the body works: microgravity, radiation, isolation, distance and a closed habitat all add load.",
  "El vuelo espacial cambia cómo funciona el cuerpo: microgravedad, radiación, aislamiento, distancia y un hábitat cerrado suman carga.",
  [["Repeat the measurement to confirm it", "Repite la medición para confirmarla"], ["Look at the 14-day trend, not a single value", "Mira la tendencia de 14 días, no un valor aislado"], ["Consult the flight surgeon if it persists", "Consulta al médico de vuelo si persiste"]],
  "NASA HRP human system risks", "Riesgos del sistema humano de NASA HRP",
);

export const guideFor = (key: string): GuideEntry => GUIDE[key] ?? GENERIC;

/** Shown when everything is in range: maintenance actions tied to Standard Measures. */
export const MAINTENANCE_ACTIONS: { text: L10n; system: L10n }[] = [
  { text: { en: "Complete your ARED session", es: "Completa tu sesión de ARED" }, system: { en: "Exercise and bone", es: "Ejercicio y hueso" } },
  { text: { en: "Log your urine colour", es: "Registra el color de tu orina" }, system: { en: "Hydration", es: "Hidratación" } },
  { text: { en: "Keep your fixed bedtime tonight", es: "Mantén tu horario fijo de sueño esta noche" }, system: { en: "Sleep and rhythm", es: "Sueño y ritmo" } },
];
