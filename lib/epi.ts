/**
 * PPE (EPI) and actions to take when a symptom or reading could harm the crew member AND the
 * rest of the crew. Each protocol is triggered by parameters that left their safe range
 * (caution or critical). Local content: works offline and never depends on AI.
 * General guidance only — no diagnosis, no medication. To be validated by a flight surgeon.
 */
import type { L10n, Level } from "./types";

export interface EpiProtocol {
  id: string;
  title: L10n;
  /** parameters that trigger this protocol when they are not nominal */
  triggers: string[];
  /** risk to the rest of the crew (contagion, shared atmosphere…) */
  crewRisk: boolean;
  ppe: L10n[];
  actions: L10n[];
  protectCrew: L10n[];
}

const L = (en: string, es: string): L10n => ({ en, es });

export const EPI_PROTOCOLS: EpiProtocol[] = [
  {
    id: "infection", crewRisk: true,
    title: L("Possible infection / contagion", "Posible infección / contagio"),
    triggers: ["body_temp", "infection", "cough", "crew_contagion", "cold_sore", "rash"],
    ppe: [L("N95/FFP2 respirator", "Mascarilla N95/FFP2"), L("Nitrile gloves", "Guantes de nitrilo"), L("Eye protection if coughing", "Protección ocular si hay tos"), L("Hand sanitiser", "Alcohol gel")],
    actions: [L("Rest in your own sleep station and repeat the temperature in 15 min", "Reposa en tu estación de sueño y repite la temperatura en 15 min"), L("Log every symptom in your daily check", "Registra cada síntoma en tu chequeo diario"), L("Report to the Crew Medical Officer now", "Informa ahora al Oficial Médico (CMO)")],
    protectCrew: [L("Keep 2 m from the crew; no shared meals or utensils", "Mantén 2 m de la tripulación; no compartas comidas ni utensilios"), L("Disinfect handrails, keyboards and shared surfaces", "Desinfecta pasamanos, teclados y superficies compartidas"), L("Crew wears a mask when approaching you", "La tripulación usa mascarilla al acercarse")],
  },
  {
    id: "vomit", crewRisk: true,
    title: L("Nausea / vomiting", "Náuseas / vómitos"),
    triggers: ["nausea", "disorientation"],
    ppe: [L("Emesis bag within reach", "Bolsa de emesis a mano"), L("Gloves and absorbent wipes", "Guantes y paños absorbentes")],
    actions: [L("In microgravity vomit floats: keep the bag sealed at your mouth", "En microgravedad el vómito flota: mantén la bolsa sellada en la boca"), L("Small sips of water; avoid head movements", "Sorbos pequeños de agua; evita mover la cabeza"), L("No EVA or critical tasks today", "Sin EVA ni tareas críticas hoy")],
    protectCrew: [L("Contain and clean any floating fluid at once (airborne contamination)", "Contén y limpia de inmediato cualquier líquido flotante (contaminación aérea)"), L("Check the air filters after an episode", "Revisa los filtros de aire tras un episodio")],
  },
  {
    id: "hypoxia", crewRisk: true,
    title: L("Low oxygen / cabin atmosphere", "Oxígeno bajo / atmósfera de cabina"),
    triggers: ["spo2", "cabin_o2", "cabin_co2", "cabin_ppco2_24h"],
    ppe: [L("Portable breathing apparatus (oxygen mask)", "Aparato de respiración portátil (mascarilla de oxígeno)")],
    actions: [L("Put the mask on and move to a well-ventilated module", "Ponte la mascarilla y ve a un módulo bien ventilado"), L("Repeat SpO₂ with a warm, still hand", "Repite la SpO₂ con la mano tibia y quieta"), L("Stop exercise until values recover", "Suspende el ejercicio hasta que los valores se recuperen")],
    protectCrew: [L("The atmosphere is shared: alert the whole crew", "La atmósfera es compartida: alerta a toda la tripulación"), L("Check the CO₂ scrubber and ventilation fans", "Revisa el depurador de CO₂ y los ventiladores")],
  },
  {
    id: "radiation", crewRisk: true,
    title: L("Radiation exposure", "Exposición a radiación"),
    triggers: ["radiation_dose", "dose_30d_bfo", "dose_30d_cns", "dose_30d_skin", "dose_rate_daily"],
    ppe: [L("Personal dosimeter on, 24/7", "Dosímetro personal puesto 24/7"), L("Wearable shielding vest if available", "Chaleco de blindaje si está disponible")],
    actions: [L("Go to the storm shelter (most shielded area)", "Ve al refugio de tormenta (zona más blindada)"), L("Cancel any EVA", "Cancela cualquier EVA"), L("Report your dosimeter reading to the flight surgeon", "Informa la lectura del dosímetro al médico de vuelo")],
    protectCrew: [L("A solar event affects everyone: the whole crew shelters together", "Un evento solar afecta a todos: toda la tripulación se refugia"), L("Rotate tasks to cut individual exposure", "Rota tareas para reducir la exposición individual")],
  },
  {
    id: "decompression", crewRisk: false,
    title: L("Decompression symptoms", "Síntomas de descompresión"),
    triggers: ["pre_eva_decompression"],
    ppe: [L("100 % oxygen mask", "Mascarilla de oxígeno al 100 %")],
    actions: [L("Abort the EVA preparation", "Aborta la preparación de la EVA"), L("Breathe 100 % oxygen and stay still", "Respira oxígeno al 100 % y mantente quieto"), L("Flight surgeon now", "Médico de vuelo ahora")],
    protectCrew: [L("EVA partner also stops and is checked", "El compañero de EVA también se detiene y es evaluado")],
  },
  {
    id: "wound", crewRisk: true,
    title: L("Wound / bleeding", "Herida / sangrado"),
    triggers: ["wounds"],
    ppe: [L("Nitrile gloves", "Guantes de nitrilo"), L("Sterile gauze and first-aid kit", "Gasas estériles y botiquín")],
    actions: [L("Apply pressure with absorbent gauze", "Presiona con gasa absorbente"), L("Clean and cover the wound", "Limpia y cubre la herida")],
    protectCrew: [L("Capture any blood droplet: fluids float in microgravity", "Captura cualquier gota de sangre: los fluidos flotan en microgravedad"), L("Dispose of material in the biohazard bag", "Desecha el material en la bolsa de riesgo biológico")],
  },
  {
    id: "glucose", crewRisk: false,
    title: L("Abnormal blood glucose", "Glucosa alterada"),
    triggers: ["glucose"],
    ppe: [],
    actions: [L("If low: take 15 g of fast carbohydrate and recheck in 15 min", "Si está baja: toma 15 g de carbohidrato rápido y repite en 15 min"), L("Do not operate critical systems until it recovers", "No operes sistemas críticos hasta recuperarte")],
    protectCrew: [L("A crewmate stays with you until the value is normal", "Un compañero se queda contigo hasta normalizar el valor")],
  },
  {
    id: "vision", crewRisk: false,
    title: L("Vision changes (SANS)", "Cambios visuales (SANS)"),
    triggers: ["visual_symptoms", "visual_acuity", "optic_nerve_diameter", "optic_sheath_area", "intraocular_pressure", "amsler", "contrast"],
    ppe: [L("Corrective spaceflight glasses", "Lentes correctivos de vuelo")],
    actions: [L("Avoid straining (Valsalva) and heavy resistive exercise until reviewed", "Evita pujar (Valsalva) y el ejercicio resistido intenso hasta la revisión"), L("Schedule ocular ultrasound / OCT", "Programa ultrasonido ocular / OCT")],
    protectCrew: [L("Cross-check readings of displays and procedures", "Verificación cruzada de pantallas y procedimientos")],
  },
  {
    id: "fatigue", crewRisk: true,
    title: L("Fatigue / low alertness", "Fatiga / baja alerta"),
    triggers: ["sleep_hours", "effective_sleep", "kss", "fatigue_sp", "pvt_rt", "dsst", "circadian_misalignment", "cognitive_load"],
    ppe: [],
    actions: [L("Postpone critical tasks or ask for a cross-check", "Posterga tareas críticas o pide verificación cruzada"), L("20-min nap or bright-light break", "Siesta de 20 min o pausa con luz brillante"), L("Protect a fixed bedtime tonight", "Protege un horario fijo de sueño esta noche")],
    protectCrew: [L("Do not operate robotics, docking or EVA alone", "No operes robótica, acoplamiento ni EVA solo")],
  },
  {
    id: "cardio", crewRisk: false,
    title: L("Heart rate / fitness out of range", "Frecuencia cardíaca / capacidad física fuera de rango"),
    triggers: ["resting_hr", "hrv", "vo2max", "hemoglobin", "hemolysis_increase"],
    ppe: [],
    actions: [L("Rest 5 min and repeat the measurement", "Reposa 5 min y repite la medición"), L("Lower exercise intensity until reviewed", "Baja la intensidad del ejercicio hasta la revisión"), L("Hydrate and log urine colour", "Hidrátate y registra el color de orina")],
    protectCrew: [L("Tell a crewmate where you are if you feel dizzy", "Avisa a un compañero dónde estás si sientes mareo")],
  },
  {
    id: "dehydration", crewRisk: false,
    title: L("Dehydration", "Deshidratación"),
    triggers: ["water_intake", "urine_color"],
    ppe: [],
    actions: [L("Drink 500 mL of water now", "Toma 500 mL de agua ahora"), L("Recheck urine colour in 2 h", "Revisa el color de orina en 2 h")],
    protectCrew: [],
  },
  {
    id: "bone", crewRisk: false,
    title: L("Bone loss", "Pérdida ósea"),
    triggers: ["bmd_vs_baseline", "bone_loss_estimate", "exercise_minutes"],
    ppe: [],
    actions: [L("Complete the daily ARED resistive session", "Completa la sesión diaria de ARED"), L("Check calcium and vitamin D intake", "Revisa calcio y vitamina D"), L("Avoid impact or high-risk loads until reviewed", "Evita impactos o cargas de riesgo hasta la revisión")],
    protectCrew: [],
  },
];

/** Protocols triggered by the parameters that are not nominal, critical first. */
export function epiFor(altered: { key: string; level: Level }[]): (EpiProtocol & { level: Level; causes: string[] })[] {
  const out: (EpiProtocol & { level: Level; causes: string[] })[] = [];
  for (const p of EPI_PROTOCOLS) {
    const hits = altered.filter((a) => a.level !== "nominal" && p.triggers.includes(a.key));
    if (!hits.length) continue;
    out.push({ ...p, level: hits.some((h) => h.level === "critical") ? "critical" : "caution", causes: hits.map((h) => h.key) });
  }
  return out.sort((a, b) => (a.level === b.level ? Number(b.crewRisk) - Number(a.crewRisk) : a.level === "critical" ? -1 : 1));
}
