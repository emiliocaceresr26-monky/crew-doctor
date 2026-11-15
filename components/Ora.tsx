"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Radio, Send, X } from "lucide-react";
import { guideFor } from "@/content/guide";
import { LEVEL_LABEL, validateValue } from "@/lib/engine";
import { confirmationIntent, interpretLocal, MAX_UTTERANCE, type OraAction, type OraResult, type OraView, type Proposal } from "@/lib/ora/local";
import { PARAM_BY_KEY } from "@/lib/parameters";
import { seriesKey } from "@/lib/simulator";
import { statusOf, store, verdictOf, visibleAlerts } from "@/lib/store";
import type { L10n, Lang } from "@/lib/types";
import { useApp, useT } from "./ui";

const ROUTES: Record<OraView, string> = { today: "/", dashboard: "/dashboard", body: "/body", entry: "/entry", control: "/control", report: "/report" };
const DAILY = ["sleep_hours", "kss", "fatigue_sp", "body_temp", "spo2", "water_intake", "urine_color"];

type Msg = { who: "you" | "buzz"; text: string };
type Card = { items: (Proposal & { text: string; error?: string })[]; transcript: string };

// Minimal typing for the Web Speech API (not in lib.dom for all browsers).
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

const getRecognition = (): (new () => Recognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const S = (lang: Lang, en: string, es: string) => (lang === "es" ? es : en);

/** BUZZ: voice + text assistant. It proposes; the crew member confirms; only then data is saved. */
export function Ora() {
  const app = useApp();
  const { lang, tr, n } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [card, setCard] = useState<Card | null>(null);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [activeMode, setActiveMode] = useState(false); // escucha activa continua
  const [busy, setBusy] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "prompt" | "unknown">("unknown");
  const recRef = useRef<Recognition | null>(null);
  const activeModeRef = useRef(false);
  const cardRef = useRef<Card | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speakSeqRef = useRef(0);
  const startMicRef = useRef<(() => void) | null>(null);
  cardRef.current = card;
  activeModeRef.current = activeMode;

  useEffect(() => {
    setVoiceOk(!!getRecognition());
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((status) => {
          setMicPermission(status.state as "granted" | "denied" | "prompt");
          status.onchange = () => {
            setMicPermission(status.state as "granted" | "denied" | "prompt");
          };
        })
        .catch(() => {
          setMicPermission("unknown");
        });
    }
  }, []);

  const requestMicAccess = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setMicPermission("granted");
        setMicError(null);
        return true;
      } catch (err: unknown) {
        const error = err as { name?: string };
        if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
          setMicPermission("denied");
          setMicError(
            S(
              lang,
              "Microphone permission blocked. Please enable microphone permissions in your browser address bar (lock/tune icon next to localhost:3000).",
              "Permiso de micrófono bloqueado. Por favor habilítalo en la barra de direcciones (icono de candado o configuración junto a localhost:3000)."
            )
          );
        } else {
          setMicError(S(lang, "Could not access microphone.", "No se pudo acceder al micrófono."));
        }
        return false;
      }
    }
    return false;
  }, [lang]);

  // Cleanup on unmount
  useEffect(() => () => {
    recRef.current?.abort();
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  const stopVoice = useCallback(() => {
    speakSeqRef.current++;
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    const a = audioRef.current;
    if (a) { a.onended = null; a.onerror = null; a.pause(); audioRef.current = null; }
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
  }, []);

  const speak = useCallback(async (text: string) => {
    // Pausar reconocimiento mientras el asistente habla para evitar eco
    const onStart = () => {
      if (recRef.current) { try { recRef.current.abort(); } catch { /* ignore */ } }
    };
    const onEnd = () => {
      if (activeModeRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (activeModeRef.current) startMicRef.current?.();
        }, 350);
      }
    };
    const browserVoice = () => {
      try {
        if (!("speechSynthesis" in window)) return onEnd();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === "es" ? "es-CL" : "en-US";
        u.onstart = onStart;
        u.onend = onEnd;
        window.speechSynthesis.speak(u);
      } catch { /* speech output is optional */ }
    };

    stopVoice();
    const seq = speakSeqRef.current;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return browserVoice();

    // 1. Voz de Gemini (servidor). 2. Respaldo: voz del navegador.
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 600), lang }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error("tts_unavailable");
      const blob = await res.blob();
      if (seq !== speakSeqRef.current) return; // a newer reply (or the mic) took over
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audioUrlRef.current = url;
      audio.onplay = onStart;
      audio.onended = () => { stopVoice(); onEnd(); };
      audio.onerror = () => { stopVoice(); browserVoice(); };
      await audio.play();
    } catch {
      if (seq === speakSeqRef.current) browserVoice();
    }
  }, [lang, stopVoice]);

  const say = useCallback((text: string, aloud = true) => {
    setMsgs((m) => [...m, { who: "buzz" as const, text }].slice(-12));
    if (aloud) void speak(text);
  }, [speak]);

  const runAction = useCallback((a: OraAction): string => {
    const st = store.getState();
    const me = st.astronautId;
    switch (a.tool) {
      case "navigate": router.push(ROUTES[a.view]); return S(lang, `Opening ${a.view}.`, "Abriendo la vista.");
      case "start_test": router.push("/tests/pvt"); return S(lang, "Opening the vigilance test. Tap as soon as the counter appears.", "Abriendo la prueba de vigilancia. Toca apenas aparezca el contador.");
      case "explain_metric": { const p = PARAM_BY_KEY[a.parameter_key]; const g = guideFor(p.key); return `${tr(p.name)}: ${tr(g.meaning)} ${tr(g.whyInSpace)}`; }
      case "compare_to_baseline": {
        const p = PARAM_BY_KEY[a.parameter_key];
        if (p.psych) return S(lang, "That is shown on screen only.", "Eso se muestra solo en pantalla.");
        const s = statusOf(st, me, p); const b = store.baseline(p.scope === "habitat" ? "habitat" : me, p.key);
        if (!s) return S(lang, `I have no ${p.name.en} reading yet.`, `Aún no tengo una lectura de ${p.name.es}.`);
        return b ? S(lang, `${p.name.en}: ${n(s.value)} ${p.unit}; your baseline is ${n(b.mean, 1)}.`, `${p.name.es}: ${n(s.value)} ${p.unit}; tu línea base es ${n(b.mean, 1)}.`)
          : S(lang, `${p.name.en}: ${n(s.value)} ${p.unit}. No baseline yet.`, `${p.name.es}: ${n(s.value)} ${p.unit}. Aún sin línea base.`);
      }
      case "get_astronaut_status": {
        const v = verdictOf(st, me, { includePsych: false });
        const why = v.drivers.slice(0, 3).map((d) => tr(d.param.name)).join(", ");
        return S(lang, `Today's verdict: ${LEVEL_LABEL[v.level].verdict.en}.${why ? ` Watch: ${why}.` : ""}`, `Veredicto de hoy: ${LEVEL_LABEL[v.level].verdict.es}.${why ? ` Atención a: ${why}.` : ""}`);
      }
      case "get_active_alerts": {
        const mine = visibleAlerts({ ...st, role: "astronaut" }).filter((x) => !x.acknowledged && !PARAM_BY_KEY[x.parameter]?.psych);
        if (!mine.length) return S(lang, "You have no active alerts.", "No tienes alertas activas.");
        return S(lang, `You have ${mine.length} active alert(s): `, `Tienes ${mine.length} alerta(s) activa(s): `) + mine.slice(0, 3).map((x) => tr(PARAM_BY_KEY[x.parameter].name)).join(", ") + ".";
      }
      case "whats_missing": {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const missing = DAILY.filter((k) => !(st.readings[seriesKey(me, k)] ?? []).some((r) => !r.isSimulated && r.ts >= start.getTime()));
        if (!missing.length) return S(lang, "Your daily log is complete. The vigilance test is next.", "Tu registro diario está completo. Sigue la prueba de vigilancia.");
        return S(lang, "Still to log today: ", "Te falta registrar hoy: ") + missing.map((k) => tr(PARAM_BY_KEY[k].name)).join(", ") + ".";
      }
      case "help":
        if (a.topic === "pvt") return S(lang, 'Vigilance test: watch the screen and tap or press space the moment the counter starts. It takes 3 minutes. Say "start the vigilance test".', "Prueba de vigilancia: mira la pantalla y toca o pulsa espacio apenas empiece el contador. Dura 3 minutos. Di «inicia la prueba de vigilancia».");
        return S(lang, 'Tell me your readings, for example: "I slept 7 hours, temperature 36.6, saturation 98". You can also ask "what am I missing today?" or "take me to the body map".', "Dime tus mediciones, por ejemplo: «dormí 7 horas, temperatura 36,6, saturación 98». También puedes preguntar «¿qué me falta hoy?» o «llévame al mapa corporal».");
    }
  }, [lang, n, router, tr]);

  const present = useCallback((r: OraResult, transcript: string) => {
    const parts: string[] = [];
    if (r.refused) { say(tr(r.refused)); return; }

    // Aplicar directamente los parámetros indicados al store en tiempo real
    if (r.proposals.length) {
      const st = store.getState();
      const updatedList: string[] = [];
      for (const p of r.proposals) {
        store.submit({ parameter: p.parameter_key, value: p.value, source: "voice", voiceTranscript: transcript });
        const param = PARAM_BY_KEY[p.parameter_key];
        if (param) {
          updatedList.push(`${tr(param.name)} → ${n(p.value)} ${param.unit}`);
        }
      }

      fetch("/api/readings", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ astronautId: st.astronautId, phase: st.phase, source: "voice", transcript, items: r.proposals.map((p) => ({ parameter_key: p.parameter_key, value: p.value })) }),
      }).catch(() => { /* offline: stays local */ });

      parts.push(
        S(
          lang,
          `Updated parameter(s): ${updatedList.join(", ")}.`,
          `Actualicé: ${updatedList.join(", ")}.`
        )
      );
    }

    for (const x of r.rejected) parts.push(x.label ? `${x.label}: ${tr(x.reason)}` : tr(x.reason));
    for (const c of r.clarifications) parts.push(tr(c));
    for (const a of r.actions) parts.push(runAction(a));
    if (!parts.length && r.text) parts.push(r.text);
    if (!parts.length) parts.push(runAction({ tool: "help", topic: "general" }));
    say(parts.join(" "));
  }, [lang, n, runAction, say, tr]);

  const confirm = useCallback(() => {
    const c = cardRef.current;
    if (!c) return;
    const checked = c.items.map((it) => { const v = validateValue(it.parameter_key, it.text); return v.ok ? { ...it, value: v.value, error: undefined } : { ...it, error: v.error[lang] }; });
    if (checked.some((it) => it.error)) { setCard({ ...c, items: checked }); say(S(lang, "One value is not possible. Please correct it.", "Un valor no es posible. Corrígelo, por favor."), false); return; }
    const st = store.getState();
    for (const it of checked) store.submit({ parameter: it.parameter_key, value: it.value, source: "voice", voiceTranscript: c.transcript });
    fetch("/api/readings", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ astronautId: st.astronautId, phase: st.phase, source: "voice", transcript: c.transcript, items: checked.map((it) => ({ parameter_key: it.parameter_key, value: it.value })) }),
    }).catch(() => { /* offline: stays local */ });
    setCard(null);
    say(S(lang, `Saved ${checked.length} reading(s).`, `Guardé ${checked.length} lectura(s).`));
  }, [lang, say]);

  const cancel = useCallback(() => {
    if (!cardRef.current) return;
    setCard(null);
    say(S(lang, "Cancelled. Nothing was saved.", "Cancelado. No se guardó nada."));
  }, [lang, say]);

  const handle = useCallback(async (raw: string) => {
    const text = raw.trim().slice(0, MAX_UTTERANCE);
    if (!text) return;
    setMsgs((m) => [...m, { who: "you" as const, text }].slice(-12));

    // Si hay una tarjeta abierta, verificar intención de confirmación
    if (cardRef.current) {
      const intent = confirmationIntent(text);
      if (intent === "confirm") return confirm();
      if (intent === "cancel") return cancel();
    }

    // 1. Interpretar localmente
    const local = interpretLocal(text);
    if (local.refused) return present(local, text);

    // 2. Si el intérprete local ya reconoció el cambio de parámetros o una acción, ejecutar de inmediato sin espera
    if (local.proposals.length > 0 || (local.actions.length > 0 && local.actions[0].tool !== "help")) {
      return present(local, text);
    }

    const st = store.getState();
    if (st.demoMode || (typeof navigator !== "undefined" && navigator.onLine === false)) return present(local, text);

    setBusy(true);
    try {
      const res = await fetch("/api/ora", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, lang }),
        signal: AbortSignal.timeout(3000), // Máximo 3s de espera en la red
      });
      if (!res.ok) throw new Error("bad_status");
      const data = (await res.json()) as OraResult;
      if (!Array.isArray(data.proposals)) throw new Error("bad_shape");
      present(data, text);
    } catch {
      present(local, text);
    } finally {
      setBusy(false);
    }
  }, [cancel, confirm, lang, present]);

  // ── Microphone core ──────────────────────────────────────────────────────────
  const stopMic = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
    recRef.current = null;
    setListening(false);
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
  }, []);

  const startMic = useCallback(async () => {
    const Rec = getRecognition();
    if (!Rec) {
      setMicError(S(lang, "Your browser does not support voice input. Try Chrome or Edge.", "Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge."));
      return;
    }

    setMicError(null);

    // Solicitar permiso de micrófono explícitamente para asegurar que el navegador muestre el diálogo si aún no está otorgado
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setMicPermission("granted");
      } catch (err: unknown) {
        const error = err as { name?: string };
        if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
          setMicPermission("denied");
          setMicError(S(lang, "Microphone access denied. Allow it in your browser settings.", "Acceso al micrófono denegado. Permítelo en la configuración del navegador."));
          setActiveMode(false);
          activeModeRef.current = false;
          return;
        }
      }
    }

    try {
      // Abort any existing instance first
      try { recRef.current?.abort(); } catch { /* ignore */ }

      const rec = new Rec();
      rec.lang = lang === "es" ? "es-CL" : "en-US";
      rec.interimResults = false;
      // continuous=true only in active mode (browser handles silence detection)
      rec.continuous = activeModeRef.current;

      rec.onresult = (e) => {
        const t = Array.from(e.results).map((r) => r[0].transcript).join(" ").trim();
        if (t) void handle(t);
      };

      rec.onend = () => {
        setListening(false);
        recRef.current = null;
        // In active listening mode, restart automatically after a short pause
        if (activeModeRef.current) {
          restartTimerRef.current = setTimeout(() => {
            if (activeModeRef.current) startMicRef.current?.();
          }, 400);
        }
      };

      rec.onerror = (e) => {
        setListening(false);
        recRef.current = null;
        // "no-speech" and "aborted" are normal — don't show error
        if (e.error === "no-speech" || e.error === "aborted") {
          if (activeModeRef.current) {
            restartTimerRef.current = setTimeout(() => {
              if (activeModeRef.current) startMicRef.current?.();
            }, 600);
          }
          return;
        }
        if (e.error === "not-allowed") {
          setMicError(S(lang, "Microphone access denied. Allow it in your browser settings.", "Acceso al micrófono denegado. Permítelo en la configuración del navegador."));
          setActiveMode(false);
          activeModeRef.current = false;
        } else {
          setMicError(S(lang, `Microphone error: ${e.error}.`, `Error de micrófono: ${e.error}.`));
        }
      };

      stopVoice();
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setMicError(S(lang, "Could not start the microphone. Try again.", "No se pudo iniciar el micrófono. Intenta de nuevo."));
      setListening(false);
    }
  }, [handle, lang, stopVoice]);

  useEffect(() => { startMicRef.current = () => void startMic(); }, [startMic]);

  // Toggle single-shot mic
  const toggleMic = useCallback(() => {
    if (listening) {
      stopMic();
    } else {
      startMic();
    }
  }, [listening, startMic, stopMic]);

  // Toggle active (continuous) listening mode
  const toggleActive = useCallback(() => {
    const next = !activeMode;
    setActiveMode(next);
    activeModeRef.current = next;
    if (next) {
      // Start active mode
      if (!listening) startMic();
    } else {
      // Stop active mode
      stopMic();
    }
  }, [activeMode, listening, startMic, stopMic]);

  // Test hook for end-to-end runs only
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E !== "1") return;
    (window as unknown as { __oraHeard?: (t: string) => void }).__oraHeard = (t: string) => { setOpen(true); void handle(String(t)); };
    return () => { delete (window as unknown as { __oraHeard?: unknown }).__oraHeard; };
  }, [handle]);

  const viaLocal = app.demoMode;

  return (
    <>
      {/* FAB button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="buzz-panel"
        data-testid="ora-open"
        className={`no-print fixed bottom-24 right-4 z-40 flex min-h-14 cursor-pointer items-center gap-2 rounded-full border px-4 text-[14px] font-semibold shadow-lg lg:bottom-6 transition-all ${
          activeMode && listening
            ? "border-ok/70 bg-ok/15 text-ok animate-pulse"
            : "border-accent/50 bg-[rgba(22,32,60,0.95)] text-fg"
        }`}
      >
        {activeMode && listening
          ? <Radio size={18} aria-hidden="true" className="text-ok" />
          : <Mic size={18} aria-hidden="true" className="text-accent" />
        }
        BUZZ
        {activeMode && <span className="ml-1 h-2 w-2 rounded-full bg-ok animate-ping" />}
      </button>

      {open && (
        <aside
          id="buzz-panel"
          aria-label={S(lang, "BUZZ voice assistant", "Asistente de voz BUZZ")}
          data-testid="ora-panel"
          className="no-print fixed inset-x-2 bottom-2 z-50 flex max-h-[82dvh] flex-col gap-3 rounded-[22px] border border-accent/30 bg-[#121a2d] p-4 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-4 sm:w-[430px] lg:bottom-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="display text-lg font-bold text-accent">BUZZ</p>
              <span className="text-[11px] font-medium text-muted">
                {viaLocal
                  ? S(lang, "· local rules (demo)", "· reglas locales (demo)")
                  : S(lang, "· AI with local fallback", "· IA con respaldo local")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setOpen(false); if (activeMode) toggleActive(); }}
              aria-label={S(lang, "Close assistant", "Cerrar asistente")}
              className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-line"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {/* Mic permission prompt / blocked warning */}
          {voiceOk && micPermission === "prompt" && (
            <div className="flex items-center justify-between gap-2 rounded-[12px] border border-accent/40 bg-accent/10 p-2.5 text-[12.5px]">
              <span className="text-soft">
                {S(lang, "Allow microphone to talk to BUZZ.", "Permite el micrófono para hablar con BUZZ.")}
              </span>
              <button
                type="button"
                onClick={() => void requestMicAccess()}
                className="shrink-0 cursor-pointer rounded-[8px] bg-accent px-3 py-1 text-[12px] font-semibold text-bg hover:opacity-90"
              >
                {S(lang, "Allow mic", "Permitir")}
              </button>
            </div>
          )}

          {micPermission === "denied" && (
            <div className="flex flex-col gap-1 rounded-[12px] border border-warn/40 bg-warn/10 p-2.5 text-[12px] text-warn">
              <span className="font-semibold">
                {S(lang, "Microphone is blocked in browser", "El micrófono está bloqueado en el navegador")}
              </span>
              <span className="text-[11px] text-soft">
                {S(
                  lang,
                  "Click the lock/settings icon in your browser URL bar (next to localhost:3000), set Microphone to 'Allow', and reload.",
                  "Haz clic en el candado o icono de configuración en la barra de URL (al lado de localhost:3000), cambia Micrófono a 'Permitir' y recarga la página."
                )}
              </span>
            </div>
          )}

          {/* Active listening banner */}
          {activeMode && (
            <div className={`flex items-center gap-2 rounded-[12px] border px-3 py-2 text-[12.5px] font-semibold ${
              listening ? "border-ok/50 bg-ok/10 text-ok" : "border-accent/40 bg-accent/10 text-accent"
            }`}>
              <Radio size={14} aria-hidden="true" />
              {listening
                ? S(lang, "● Active listening — speak any time", "● Escucha activa — habla cuando quieras")
                : S(lang, "○ Active mode on — restarting…", "○ Modo activo — reiniciando…")}
            </div>
          )}

          {/* Mic error */}
          {micError && (
            <p className="rounded-[10px] border border-crit/40 bg-crit/10 px-3 py-2 text-[12px] text-crit">
              {micError}
            </p>
          )}

          {/* Hint */}
          {!activeMode && (
            <p className="text-[12px] leading-snug text-muted">
              {voiceOk
                ? S(lang, "Tap the microphone to speak, or enable Active Listening to stay always on.", "Toca el micrófono para hablar, o activa la Escucha Activa para mantenerte siempre encendido.")
                : S(lang, "This browser has no speech recognition: use the text box. (Chrome and Edge support voice.)", "Este navegador no tiene reconocimiento de voz: usa el cuadro de texto. (Chrome y Edge sí lo soportan.)")}
            </p>
          )}

          {/* Message log */}
          <div className="flex min-h-24 flex-col gap-2 overflow-y-auto" aria-live="polite" data-testid="ora-log">
            {msgs.length === 0 && (
              <p className="text-[13.5px] text-soft">
                {S(lang, 'Try: "I slept 6 and a half hours, temperature 36.8, saturation 97".', "Prueba: «dormí seis horas y media, temperatura 36,8, saturación 97».")}
              </p>
            )}
            {msgs.map((m, i) => (
              <p
                key={i}
                data-who={m.who}
                className={`max-w-[92%] rounded-[14px] px-3 py-2 text-[13.5px] leading-snug ${
                  m.who === "you"
                    ? "self-end bg-accent/20"
                    : "self-start border border-line text-soft"
                }`}
              >
                {m.who === "buzz" && <span className="mr-1 font-bold text-accent">BUZZ</span>}
                {m.text}
              </p>
            ))}
            {busy && <p className="text-[12.5px] text-muted">…</p>}
          </div>

          {/* Confirm card */}
          {card && (
            <div className="rounded-[16px] border border-accent/50 p-3" data-testid="ora-card" role="group" aria-label={S(lang, "Confirm readings", "Confirmar lecturas")}>
              <p className="eyebrow">{S(lang, "Confirm before saving", "Confirma antes de guardar")}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {card.items.map((it, i) => {
                  const p = PARAM_BY_KEY[it.parameter_key];
                  return (
                    <li key={it.parameter_key} className="flex flex-col gap-1">
                      <label className="flex items-center justify-between gap-3 text-[13.5px]">
                        <span>{tr(p.name)}</span>
                        <span className="flex items-center gap-2">
                          <input
                            inputMode="decimal"
                            value={it.text}
                            data-testid={`ora-value-${it.parameter_key}`}
                            aria-invalid={!!it.error}
                            className="w-24 text-right"
                            onChange={(e) => setCard({ ...card, items: card.items.map((x, j) => (j === i ? { ...x, text: e.target.value.slice(0, 10), error: undefined } : x)) })}
                          />
                          <span className="w-12 text-[12px] text-muted">{p.unit}</span>
                        </span>
                      </label>
                      {it.error && <span role="alert" className="text-[12px] text-crit">{it.error}</span>}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={confirm} data-testid="ora-confirm" className="min-h-11 flex-1 cursor-pointer rounded-[12px] bg-accent px-4 text-[14px] font-semibold text-bg">{S(lang, "Confirm", "Confirmar")}</button>
                <button type="button" onClick={cancel} data-testid="ora-cancel" className="min-h-11 cursor-pointer rounded-[12px] border border-line px-4 text-[14px] font-medium">{S(lang, "Cancel", "Cancelar")}</button>
              </div>
            </div>
          )}

          {/* Input row */}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); const text = draft; setDraft(""); void handle(text); }}
          >
            {voiceOk && (
              <>
                {/* Single-shot mic button */}
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={activeMode}
                  aria-pressed={listening && !activeMode}
                  data-testid="ora-mic"
                  aria-label={
                    activeMode
                      ? S(lang, "Mic managed by active mode", "Micrófono gestionado por modo activo")
                      : listening
                      ? S(lang, "Stop listening", "Dejar de escuchar")
                      : S(lang, "Push to talk", "Pulsar para hablar")
                  }
                  title={activeMode ? S(lang, "Active listening is on", "Escucha activa activada") : undefined}
                  className={`flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-full border transition-colors ${
                    activeMode
                      ? "border-line opacity-40 cursor-not-allowed"
                      : listening
                      ? "border-crit bg-crit/20 text-crit"
                      : "border-line hover:border-accent hover:text-accent"
                  }`}
                >
                  {listening && !activeMode ? <MicOff size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
                </button>

                {/* Active listening toggle */}
                <button
                  type="button"
                  onClick={toggleActive}
                  aria-pressed={activeMode}
                  data-testid="buzz-active"
                  aria-label={activeMode ? S(lang, "Disable active listening", "Desactivar escucha activa") : S(lang, "Enable active listening", "Activar escucha activa")}
                  title={S(lang, "Active listening (always on)", "Escucha activa (siempre encendida)")}
                  className={`flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-full border transition-colors ${
                    activeMode
                      ? "border-ok/70 bg-ok/15 text-ok"
                      : "border-line hover:border-ok hover:text-ok"
                  }`}
                >
                  <Radio size={20} aria-hidden="true" />
                </button>
              </>
            )}

            <label className="sr-only" htmlFor="buzz-text">{S(lang, "Message to BUZZ", "Mensaje para BUZZ")}</label>
            <input
              id="buzz-text"
              data-testid="ora-text"
              value={draft}
              maxLength={MAX_UTTERANCE}
              onChange={(e) => setDraft(e.target.value)}
              autoComplete="off"
              className="min-w-0 flex-1"
              placeholder={S(lang, "Type or dictate…", "Escribe o dicta…")}
            />
            <button
              type="submit"
              data-testid="ora-send"
              aria-label={S(lang, "Send", "Enviar")}
              className="flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-full bg-accent text-bg"
            >
              <Send size={18} aria-hidden="true" />
            </button>
          </form>

          {/* Status line */}
          {listening && (
            <p role="status" className={`text-[12.5px] font-semibold ${activeMode ? "text-ok" : "text-crit"}`} data-testid="ora-listening">
              ● {activeMode
                ? S(lang, "Active listening…", "Escucha activa…")
                : S(lang, "Listening…", "Escuchando…")}
            </p>
          )}
        </aside>
      )}
    </>
  );
}

export type { L10n };
