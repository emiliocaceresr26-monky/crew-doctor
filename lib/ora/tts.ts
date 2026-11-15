/**
 * BUZZ voice (server only). Gemini text-to-speech returns raw 16-bit PCM; we wrap it in a
 * WAV header so any browser can play it. Throws on any failure so the client can fall back
 * to the browser's own speechSynthesis voice. The key never leaves the server.
 */
export const MAX_TTS_CHARS = 600;
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export function ttsConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY?.trim();
}

/** Wraps mono 16-bit little-endian PCM in a WAV container. */
export function pcmToWav(pcm: Buffer, sampleRate = 24_000, channels = 1, bits = 16): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bits) / 8;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE((channels * bits) / 8, 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function synthesize(text: string, lang: "en" | "es"): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("no_key");
  const model = process.env.GEMINI_TTS_MODEL?.trim() || "gemini-2.5-flash-preview-tts";
  const voiceName = process.env.GEMINI_TTS_VOICE?.trim() || "Puck";
  const style = lang === "es"
    ? "Lee en español latinoamericano, con voz clara, cálida y tranquila de asistente de a bordo:"
    : "Read in a clear, warm and calm onboard-assistant voice:";

  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${style}\n${text.slice(0, MAX_TTS_CHARS)}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`gemini_${res.status}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
  };
  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!part?.data) throw new Error("no_audio");
  const rate = Number(/rate=(\d+)/.exec(part.mimeType ?? "")?.[1] ?? 24_000);
  return pcmToWav(Buffer.from(part.data, "base64"), rate);
}
