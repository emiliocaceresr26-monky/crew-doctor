/**
 * PVT-B scoring (brief Psychomotor Vigilance Test, 3 min, 1-4 s inter-stimulus interval).
 * Reference: Basner, Mollicone & Dinges (2011), "Validity and sensitivity of a brief PVT
 * (PVT-B) to total and partial sleep deprivation", Acta Astronautica. Lapse threshold for
 * PVT-B is 355 ms; responses under 100 ms count as false starts.
 */
export const PVT_FULL_SEC = 180;
export const PVT_DEMO_SEC = 30;
export const PVT_LAPSE_MS = 355;
export const PVT_MIN_VALID_MS = 100;
export const PVT_ISI_MS: [number, number] = [1000, 4000];

export interface PvtSummary {
  trials: number;
  meanRt: number;
  medianRt: number;
  lapses: number;
  falseStarts: number;
  /** enough valid responses to trust the mean */
  valid: boolean;
}

export function summarizePvt(reactionTimes: number[], falseStarts: number): PvtSummary {
  const early = reactionTimes.filter((t) => t < PVT_MIN_VALID_MS).length;
  const rts = reactionTimes.filter((t) => t >= PVT_MIN_VALID_MS && Number.isFinite(t)).sort((a, b) => a - b);
  const n = rts.length;
  const mean = n ? rts.reduce((a, b) => a + b, 0) / n : 0;
  const median = n ? (n % 2 ? rts[(n - 1) / 2] : (rts[n / 2 - 1] + rts[n / 2]) / 2) : 0;
  return {
    trials: n, meanRt: Math.round(mean), medianRt: Math.round(median),
    lapses: rts.filter((t) => t >= PVT_LAPSE_MS).length,
    falseStarts: falseStarts + early,
    valid: n >= 3,
  };
}

export const nextIsi = (rnd: () => number = Math.random) => PVT_ISI_MS[0] + rnd() * (PVT_ISI_MS[1] - PVT_ISI_MS[0]);
