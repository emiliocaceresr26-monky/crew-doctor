"use client";

import { useState } from "react";
import { Bone, Brain, ChevronRight, HeartPulse, MoonStar, Radiation, ScanLine, ShieldCheck } from "lucide-react";
import { PLAIN } from "@/components/health";
import { ParamDetail } from "@/components/ParamDetail";
import { canSeePsych } from "@/components/panels";
import { LEVEL_COLOR, StatusIcon, useApp, useT } from "@/components/ui";
import { CREW_BY_ID } from "@/lib/crew";
import { HRP_MONITORED, HRP_TOTAL, NODES, nodeStatus, RIDGE, ridgeStatus } from "@/lib/derived";
import { rank } from "@/lib/engine";
import { verdictOf } from "@/lib/store";
import type { BodyNode, L10n, Lang, Level } from "@/lib/types";

const S = (lang: Lang, en: string, es: string) => (lang === "es" ? es : en);

/** Plain-language copy and look for each body system (the crew member is not a clinician). */
const SYSTEM: Record<BodyNode, { icon: typeof Brain; short: L10n; what: L10n; hue: string; side: "left" | "right" }> = {
  neuro: { icon: Brain, hue: "#A78BFA", side: "right", short: { en: "Brain & eyes", es: "Cerebro y ojos" },
    what: { en: "Your brain, eyes and balance. In microgravity, fluid shifts toward the head and can affect your vision.", es: "Tu cerebro, tus ojos y tu equilibrio. En microgravedad los líquidos suben a la cabeza y pueden afectar tu visión." } },
  behav: { icon: MoonStar, hue: "#60A5FA", side: "left", short: { en: "Sleep & mood", es: "Sueño y ánimo" },
    what: { en: "How you sleep and how you feel. Rest and mood shape how well you work.", es: "Cómo duermes y cómo te sientes. El descanso y el ánimo influyen en cómo trabajas." } },
  cardio: { icon: HeartPulse, hue: "#F472B6", side: "right", short: { en: "Heart & defences", es: "Corazón y defensas" },
    what: { en: "Your heart, blood and immune system: pulse, oxygen, temperature and hydration.", es: "Tu corazón, tu sangre y tus defensas: pulso, oxígeno, temperatura e hidratación." } },
  musc: { icon: Bone, hue: "#2DD4BF", side: "left", short: { en: "Bones & muscles", es: "Huesos y músculos" },
    what: { en: "Your bones and muscles. Without gravity they lose strength unless you exercise.", es: "Tus huesos y músculos. Sin gravedad pierden fuerza si no haces ejercicio." } },
  rad: { icon: Radiation, hue: "#FBBF24", side: "right", short: { en: "Radiation", es: "Radiación" },
    what: { en: "The radiation your body receives during the mission.", es: "La radiación que recibe tu cuerpo durante la misión." } },
};

const ADVICE: Record<Level, L10n> = {
  nominal: { en: "Everything in order in this system. Keep your routine.", es: "Todo en orden en este sistema. Sigue con tu rutina." },
  caution: { en: "Some readings are drifting from your normal. Measure again and rest.", es: "Algunos datos se alejan de lo normal para ti. Vuelve a medir y descansa." },
  critical: { en: "Tell the Crew Medical Officer now.", es: "Avisa ahora al Oficial Médico de la tripulación." },
};

const RIDGE_HELP: Record<string, L10n> = {
  radiation: { en: "Space radiation", es: "Radiación espacial" },
  isolation: { en: "Isolation & confinement", es: "Aislamiento y encierro" },
  distance: { en: "Far from Earth", es: "Lejos de la Tierra" },
  gravity: { en: "Changes in gravity", es: "Cambios de gravedad" },
  environment: { en: "Closed habitat", es: "Hábitat cerrado" },
};

// Figure frame: the body is drawn in a 200×350 box, padded so labels fit on both sides.
const VB = { x: -80, y: -12, w: 360, h: 376 };
const pct = (x: number, y: number) => ({ left: `${((x - VB.x) / VB.w) * 100}%`, top: `${((y - VB.y) / VB.h) * 100}%` });

/** Body map with five interactive systems (RF-02) and the RIDGE / HRP risk row (RF-19). */
export default function BodyPage() {
  const app = useApp();
  const { t, tr, n, lang } = useT();
  const [detail, setDetail] = useState<string | null>(null);
  const psych = canSeePsych(app.role);
  const verdict = verdictOf(app, app.astronautId, { includePsych: psych });
  const ridge = ridgeStatus(app, app.astronautId, psych, verdict.sleepDebt);
  const statuses = Object.fromEntries(NODES.map((x) => [x.id, nodeStatus(app, app.astronautId, x.id, psych)])) as Record<BodyNode, ReturnType<typeof nodeStatus>>;
  // Open on the system that most needs attention.
  const worstNode = [...NODES].sort((a, b) => rank(statuses[b.id].level) - rank(statuses[a.id].level))[0].id;
  const [picked, setPicked] = useState<BodyNode | null>(null);
  const node = picked ?? worstNode;
  const current = NODES.find((x) => x.id === node)!;
  const sys = SYSTEM[node];
  const lvl = statuses[node].level;
  const okCount = NODES.filter((x) => statuses[x.id].level === "nominal").length;
  const first = CREW_BY_ID[app.astronautId]?.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-3" data-testid="body">
      {/* Hero: overall picture in one sentence */}
      <section className="glass relative overflow-hidden p-5">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full opacity-40 blur-3xl" style={{ background: `radial-gradient(circle, ${LEVEL_COLOR[verdict.level]} 0%, transparent 70%)` }} />
        <p className="eyebrow flex items-center gap-1.5"><ScanLine size={14} aria-hidden="true" />{S(lang, "Body scan", "Escaneo corporal")}</p>
        <h1 className="display mt-1 text-[26px] font-bold leading-tight sm:text-[30px]">
          {S(lang, `${first}, ${okCount} of 5 systems are in order`, `${first}, ${okCount} de 5 sistemas están en orden`)}
        </h1>
        <p className="mt-1 text-[14px] text-soft">{S(lang, "Tap a part of the body to see what it checks and how you are doing.", "Toca una parte del cuerpo para ver qué revisa y cómo estás.")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["nominal", "caution", "critical"] as Level[]).map((l) => {
            const c = NODES.filter((x) => statuses[x.id].level === l).length;
            if (!c) return null;
            return (
              <span key={l} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold" style={{ borderColor: `${LEVEL_COLOR[l]}55`, background: `${LEVEL_COLOR[l]}14`, color: LEVEL_COLOR[l] }}>
                <StatusIcon level={l} size={11} />{c} · {tr(PLAIN[l])}
              </span>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Interactive figure */}
        <section className="glass relative overflow-hidden p-3 lg:sticky lg:top-4 lg:self-start" aria-label={S(lang, "Body map", "Mapa corporal")}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#a5b4fc 1px, transparent 1px), linear-gradient(90deg, #a5b4fc 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="relative mx-auto w-full max-w-[400px]" style={{ aspectRatio: `${VB.w} / ${VB.h}` }}>
            <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
              <defs>
                <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#818cf8" stopOpacity="0.45" />
                  <stop offset="1" stopColor="#2dd4bf" stopOpacity="0.18" />
                </linearGradient>
                <radialGradient id="aura" cx="50%" cy="45%" r="55%">
                  <stop offset="0" stopColor={sys.hue} stopOpacity="0.28" />
                  <stop offset="1" stopColor={sys.hue} stopOpacity="0" />
                </radialGradient>
                <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              <ellipse cx="100" cy="175" rx="120" ry="180" fill="url(#aura)" />
              <ellipse cx="100" cy="338" rx="58" ry="7" fill="#818cf8" opacity="0.18" />
              <g filter="url(#glow)" stroke="#c7d2fe" strokeOpacity="0.75" strokeWidth="1.6" strokeLinejoin="round" fill="url(#skin)">
                <circle cx="100" cy="34" r="22" />
                <path d="M90 55 L90 64 C72 66 61 71 57 84 L45 160 C43 169 52 172 55 164 L64 104 L67 176 L64 322 C64 331 81 331 82 322 L96 200 L104 200 L118 322 C119 331 136 331 136 322 L133 176 L136 104 L145 164 C148 172 157 169 155 160 L143 84 C139 71 128 66 110 64 L110 55 Z" />
              </g>
              {/* Spine and ribs, faint */}
              <g stroke="#c7d2fe" strokeOpacity="0.18" strokeWidth="1.2" fill="none">
                <path d="M100 68 V196" />
                <path d="M84 96 Q100 104 116 96 M82 110 Q100 119 118 110 M83 124 Q100 133 117 124" />
              </g>
            </svg>
            {/* Scanner sweep */}
            <div aria-hidden="true" className="body-scan pointer-events-none absolute inset-x-[18%] top-0 h-[10%]" style={{ background: "linear-gradient(180deg, transparent, rgba(129,140,248,0.22) 60%, rgba(165,180,252,0.6) 100%)", borderBottom: "1px solid rgba(199,210,254,0.7)" }} />

            {NODES.map((x) => {
              const lv = statuses[x.id].level;
              const on = x.id === node;
              const meta = SYSTEM[x.id];
              const Icon = meta.icon;
              const pos = pct(x.x, x.y);
              return (
                <div key={x.id} className="absolute" style={pos}>
                  <button type="button" onClick={() => setPicked(x.id)} aria-pressed={on} data-testid={`node-${x.id}`} data-level={lv}
                    aria-label={`${tr(x.name)}: ${tr(PLAIN[lv])}`}
                    className={`group absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 transition-transform hover:scale-110 ${on ? "size-14" : "size-11"}`}
                    style={{ borderColor: LEVEL_COLOR[lv], background: on ? `${meta.hue}` : "rgba(15,22,35,0.85)", boxShadow: `0 0 ${on ? 26 : 14}px ${LEVEL_COLOR[lv]}${on ? "aa" : "66"}` }}>
                    {lv !== "nominal" && <span aria-hidden="true" className="node-halo absolute inset-0 rounded-full border-2" style={{ borderColor: LEVEL_COLOR[lv] }} />}
                    <Icon size={on ? 24 : 19} aria-hidden="true" color={on ? "#0f1623" : meta.hue} strokeWidth={2.2} />
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-bg p-[2px]"><StatusIcon level={lv} size={11} /></span>
                  </button>
                  <span aria-hidden="true"
                    className={`pointer-events-none absolute top-0 hidden -translate-y-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold sm:block ${meta.side === "right" ? "left-8" : "right-8"}`}
                    style={{ borderColor: on ? meta.hue : "rgba(160,185,255,0.25)", background: "rgba(15,22,35,0.85)", color: on ? meta.hue : "#c7d2f0" }}>
                    {tr(meta.short)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Selected system */}
        <section className="glass relative overflow-hidden p-5" data-testid="node-panel" aria-live="polite" style={{ borderTop: `4px solid ${sys.hue}` }}>
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full opacity-30 blur-3xl" style={{ background: sys.hue }} />
          <div className="relative flex items-start gap-3">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-[18px]" style={{ background: `${sys.hue}26`, color: sys.hue }}>
              <sys.icon size={30} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="display text-[22px] font-bold leading-tight">{tr(sys.short)}</h2>
              <p className="text-[12px] text-muted">{tr(current.name)}</p>
            </div>
          </div>
          <p className="relative mt-3 text-[14px] leading-snug text-soft">{tr(sys.what)}</p>

          <div className="relative mt-3 flex items-center gap-3 rounded-[16px] border px-4 py-3" style={{ borderColor: `${LEVEL_COLOR[lvl]}55`, background: `${LEVEL_COLOR[lvl]}12` }} data-level={lvl}>
            <StatusIcon level={lvl} size={22} />
            <div>
              <p className="text-[17px] font-bold" style={{ color: LEVEL_COLOR[lvl] }}>{tr(PLAIN[lvl])}</p>
              <p className="text-[13px] text-soft">{tr(ADVICE[lvl])}</p>
            </div>
          </div>

          <ul className="relative mt-3 flex flex-col gap-1.5">
            {statuses[node].statuses.map((s) => {
              const l = s.evaluation.level;
              return (
                <li key={s.param.key}>
                  <button type="button" onClick={() => setDetail(s.param.key)}
                    className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-white/5 bg-white/[0.03] px-3 py-2 text-left transition hover:border-white/15 hover:bg-white/[0.07]">
                    <span className="flex min-w-0 items-center gap-2.5 text-[14px]"><StatusIcon level={l} /><span className="truncate">{tr(s.param.name)}</span></span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="flex flex-col items-end leading-tight">
                        <span className="text-[12.5px] font-semibold" style={{ color: LEVEL_COLOR[l] }}>{tr(PLAIN[l])}</span>
                        <span className="text-[11.5px] text-muted">{n(s.value, s.param.sim?.decimals)} {s.param.unit}</span>
                      </span>
                      <ChevronRight size={16} className="text-muted" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="relative mt-2 text-[12px] text-muted">{S(lang, "Tap any item to see what it means.", "Toca un dato para ver qué significa.")}</p>
          {node === "behav" && <p className="relative mt-1 text-[12px] text-muted">{psych ? t("privatePsych") : t("hiddenPsych")}</p>}
        </section>
      </div>

      {/* System picker (also the main control on small screens) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label={S(lang, "Body systems", "Sistemas del cuerpo")}>
        {NODES.map((x) => {
          const lv = statuses[x.id].level;
          const meta = SYSTEM[x.id];
          const on = x.id === node;
          return (
            <button key={x.id} type="button" onClick={() => setPicked(x.id)} aria-pressed={on} data-testid={`system-${x.id}`}
              className="glass flex cursor-pointer flex-col items-start gap-2 p-3 text-left transition hover:-translate-y-0.5"
              style={{ borderBottom: `3px solid ${LEVEL_COLOR[lv]}`, boxShadow: on ? `0 0 0 2px ${meta.hue}, 0 8px 28px ${meta.hue}33` : undefined }}>
              <span className="flex size-9 items-center justify-center rounded-[12px]" style={{ background: `${meta.hue}22`, color: meta.hue }}><meta.icon size={19} aria-hidden="true" /></span>
              <span className="text-[13px] font-semibold leading-tight">{tr(meta.short)}</span>
              <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: LEVEL_COLOR[lv] }}><StatusIcon level={lv} size={10} />{tr(PLAIN[lv])}</span>
            </button>
          );
        })}
      </div>

      {/* RIDGE: the five hazards of spaceflight */}
      <section className="glass p-4" aria-label={t("ridge")} data-testid="ridge">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <span className="eyebrow flex items-center gap-1.5"><ShieldCheck size={14} aria-hidden="true" />{S(lang, "The 5 hazards of spaceflight (NASA RIDGE)", "Los 5 peligros del vuelo espacial (NASA RIDGE)")}</span>
          <span className="text-[11.5px] text-muted" data-testid="hrp-count">
            {S(lang, `HRP risks monitored: ${HRP_MONITORED} of ${HRP_TOTAL}`, `Riesgos HRP vigilados: ${HRP_MONITORED} de ${HRP_TOTAL}`)}
          </span>
        </div>
        <ul className="grid grid-cols-5 gap-1.5 sm:gap-3">
          {ridge.map((h) => {
            const letter = RIDGE.find((r) => r.id === h.id)?.letter ?? "?";
            return (
              <li key={h.id} className="flex flex-col items-center gap-1.5 text-center" data-testid={`ridge-${h.id}`} data-level={h.level}>
                <span className="display relative flex size-12 items-center justify-center rounded-[16px] text-[22px] font-bold sm:size-14 sm:text-[26px]"
                  style={{ background: `linear-gradient(145deg, ${LEVEL_COLOR[h.level]}33, ${LEVEL_COLOR[h.level]}0d)`, border: `1.5px solid ${LEVEL_COLOR[h.level]}88`, color: LEVEL_COLOR[h.level] }}
                  role="img" aria-label={`${tr(h.name)}: ${tr(PLAIN[h.level])}`}>
                  {letter}
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-bg p-[2px]"><StatusIcon level={h.level} size={11} /></span>
                </span>
                <span className="text-[11px] font-semibold leading-tight sm:text-[13px]">{tr(h.name)}</span>
                <span className="hidden text-[11px] leading-tight text-muted sm:block">{tr(RIDGE_HELP[h.id])}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <ParamDetail paramKey={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
