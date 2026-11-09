// Provider Expansion — ElevenLabs / CivitAI / RunPod / Vertex / Vast
// Thin, env-gated provider clients. Each exposes:
//   GET  /api/providers            — availability matrix
//   POST /api/providers/elevenlabs/tts        {text, voice_id?} -> base64 mp3
//   GET  /api/providers/elevenlabs/voices     -> voice list
//   GET  /api/providers/civitai/search?q=...  -> model search (key-authed)
//   GET  /api/providers/runpod/gpus           -> GPU catalog (key health check)
//   POST /api/providers/vertex/generate       {prompt} -> text (Vertex Express)
// Vast: no secret configured yet — documented as blocked.

export interface ProvidersEnv {
  ELEVENLABS_API_XOXO?: string;
  // Dashboard has a typo'd variant ELEVANLABS_API_XOXO — accept both.
  ELEVANLABS_API_XOXO?: string;
  CIVITAI_API_XOXO?: string;
  RUNPOD_API_ATX_XOXO_2?: string;
  RUNPOD_API_META_XOXO?: string;
  RUNPOD_API?: string;
  VERTEX_GOOGLE_API_KEY?: string;
  GOOGLE_PROJECT_NAME_VORTEX_GEMINI?: string;
  VAST_API?: string;
  GEMINI_GOOGLE_API_KEY?: string;
}

function elevenKey(env: ProvidersEnv): string | undefined {
  return env.ELEVENLABS_API_XOXO || env.ELEVANLABS_API_XOXO;
}

export function providerMatrix(env: ProvidersEnv) {
  return {
    elevenlabs: Boolean(elevenKey(env)),
    civitai: Boolean(env.CIVITAI_API_XOXO),
    runpod: Boolean(env.RUNPOD_API_ATX_XOXO_2 || env.RUNPOD_API_META_XOXO || env.RUNPOD_API),
    vertex: Boolean(env.VERTEX_GOOGLE_API_KEY),
    vast: Boolean(env.VAST_API), // documented blocked if false
    gemini_secondary: Boolean(env.GEMINI_GOOGLE_API_KEY),
  };
}

function runpodKey(env: ProvidersEnv): string | undefined {
  return env.RUNPOD_API_ATX_XOXO_2 || env.RUNPOD_API_META_XOXO || env.RUNPOD_API;
}

const elevenBase = "https://api.elevenlabs.io/v1";

/** Text-to-speech; returns base64 mp3. Defaults to the first available voice. */
export async function elevenTts(text: string, voiceId: string | undefined, env: ProvidersEnv) {
  const key = elevenKey(env);
  if (!key) throw new Error("ELEVENLABS_API_XOXO secret not configured");
  if (!text || text.length > 5000) throw new Error("text required (max 5000 chars)");
  let vid = voiceId;
  if (!vid) {
    const voicesRes = await fetch(`${elevenBase}/voices`, {
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(20_000),
    });
    const voices: any = await voicesRes.json();
    vid = voices?.voices?.[0]?.voice_id;
    if (!vid) throw new Error("No ElevenLabs voices available on this account");
  }
  const res = await fetch(`${elevenBase}/text-to-speech/${encodeURIComponent(vid)}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS error (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i += 0x8000) binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { voice_id: vid, audio_base64: btoa(binary), format: "audio/mpeg" };
}

export async function elevenVoices(env: ProvidersEnv) {
  const key = elevenKey(env);
  if (!key) throw new Error("ELEVENLABS_API_XOXO secret not configured");
  const res = await fetch(`${elevenBase}/voices`, {
    headers: { "xi-api-key": key },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs voices error (${res.status})`);
  const data: any = await res.json();
  return (data.voices || []).map((v: any) => ({ voice_id: v.voice_id, name: v.name, category: v.category }));
}

export async function civitaiSearch(query: string, env: ProvidersEnv) {
  const key = env.CIVITAI_API_XOXO;
  if (!key) throw new Error("CIVITAI_API_XOXO secret not configured");
  const res = await fetch(`https://civitai.com/api/v1/models?limit=5&query=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`CivitAI error (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data: any = await res.json();
  return (data.items || []).map((m: any) => ({
    id: m.id, name: m.name, type: m.type, nsfw: m.nsfw,
    creator: m.creator?.username,
  }));
}

/** RunPod account health check: list pods (read-scoped keys allowed). */
export async function runpodGpus(env: ProvidersEnv) {
  const key = runpodKey(env);
  if (!key) throw new Error("No RunPod secret configured");
  const res = await fetch("https://api.runpod.io/v2/pods", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`RunPod error (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data: any = await res.json();
  const pods = Array.isArray(data) ? data : [];
  return {
    account_reachable: true,
    pod_count: pods.length,
    pods: pods.slice(0, 10).map((p: any) => ({ id: p.id, name: p.name, gpu: p.gpu, status: p.desiredStatus })),
  };
}

/** Vertex AI Express (API-key auth) generateContent on gemini-2.5-flash.
 *  Falls back to the Developer API (generativelanguage) when the Vertex
 *  project isn't model-enabled — the key works either way, we report which. */
export async function vertexGenerate(prompt: string, env: ProvidersEnv) {
  const key = env.VERTEX_GOOGLE_API_KEY;
  if (!key) throw new Error("VERTEX_GOOGLE_API_KEY secret not configured");
  const project = env.GOOGLE_PROJECT_NAME_VORTEX_GEMINI || "gen-lang-client-0639692631";
  const model = "gemini-2.5-flash";
  const res = await fetch(
    `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(30_000),
    }
  );
  const data: any = await res.json().catch(() => ({}));
  if (res.ok) {
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
    return { project, model, via: "vertex-ai", reply };
  }
  // Vertex path blocked (project not model-enabled / model not found) —
  // retry through the Developer API with the same key.
  const fallback = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(30_000),
    }
  );
  const fdata: any = await fallback.json().catch(() => ({}));
  if (!fallback.ok) {
    throw new Error(
      `Vertex error (${res.status}) and Developer-API fallback (${fallback.status}): ${JSON.stringify(fdata).slice(0, 250)}`
    );
  }
  const reply = fdata?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
  return {
    project, model, via: "developer-api-fallback",
    note: "Vertex project lacks model access; key works via generativelanguage. Enable Vertex AI on the project for the native path.",
    reply,
  };
}
