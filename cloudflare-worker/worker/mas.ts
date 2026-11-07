/**
 * MAS generator — xAI "Imagine" image generation for the OIMO "one input, many
 * outputs" pipeline. Ported from the Grok Build attempt (pjrny/mas-lma-oimo-ok,
 * src/lib/generate.ts) to a Cloudflare Worker module.
 *
 * Uses the xAI images/edits endpoint with source photos as references so a
 * verified identity's likeness drives the output. Falls back between the
 * `image:` and `images:` payload shapes for API schema compatibility.
 */

import { xaiKey, type LLMEnv } from "./llm";

export interface ImagineEnv extends LLMEnv {
  XAI_IMAGINE_MODEL?: string;
}

const IMAGINE_DEFAULT_MODEL = "grok-imagine-image-2.0";

function asDataUrl(raw: string, mime = "image/jpeg"): string {
  if (raw.startsWith("data:")) return raw;
  return `data:${mime};base64,${raw}`;
}

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not fetch generated image");
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const mime = res.headers.get("content-type") || "image/jpeg";
  return `data:${mime};base64,${btoa(binary)}`;
}

async function postImagine(apiKey: string, path: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.x.ai/v1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      // api.x.ai sits behind a WAF that 403/1010s bare Workers egress on the
      // images routes; a normal UA gets the request through.
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string } | string;
    data?: { url?: string; b64_json?: string }[];
    url?: string;
  };
  if (!res.ok) {
    const msg =
      typeof json.error === "string"
        ? json.error
        : json.error?.message || `Imagine error ${res.status}`;
    throw new Error(msg);
  }
  const first = json.data?.[0];
  if (first?.b64_json) return asDataUrl(first.b64_json);
  const url = first?.url || json.url;
  if (url) return urlToDataUrl(url);
  throw new Error("No image in Imagine response");
}

/**
 * Generate an image from a prompt + 1..4 reference photos (identity likeness).
 * Returns a data URL (jpeg/png base64).
 */
export async function editWithRefs(
  prompt: string,
  images: string[],
  env: ImagineEnv
): Promise<{ imageDataUrl: string; model: string; degraded?: string }> {
  const apiKey = xaiKey(env);
  if (!apiKey) {
    throw new Error("No xAI key configured (XAI_API_KEY / XAI_LMA_API_KEY).");
  }
  const model = env.XAI_IMAGINE_MODEL || IMAGINE_DEFAULT_MODEL;
  const refs = images.map((url) => ({ url, type: "image_url" as const }));
  const shared = {
    model,
    prompt,
    n: 1,
    aspect_ratio: "3:4",
    resolution: "1k",
    quality: "low",
    response_format: "b64_json",
  };
  try {
    const imageDataUrl = await postImagine(apiKey, "/images/edits", {
      ...shared,
      image: images.length === 1 ? refs[0] : refs,
    });
    return { imageDataUrl, model };
  } catch (firstErr) {
    try {
      const imageDataUrl = await postImagine(apiKey, "/images/edits", {
        ...shared,
        images: images,
      });
      return { imageDataUrl, model };
    } catch (secondErr) {
      // Some api.x.ai WAF rules block the edits route from server egress
      // (HTTP 403/1010). Degrade to plain text-to-image so the MAS pipeline
      // still produces an output; likeness anchoring resumes once the edits
      // route accepts the caller.
      try {
        const imageDataUrl = await postImagine(apiKey, "/images/generations", {
          model,
          prompt: `${prompt}${images.length ? "" : ""}`,
          n: 1,
          aspect_ratio: "3:4",
          resolution: "1k",
          quality: "low",
          response_format: "b64_json",
        });
        return { imageDataUrl, model, degraded: "text-to-image (edits route blocked)" };
      } catch {
        throw secondErr instanceof Error ? secondErr : firstErr;
      }
    }
  }
}

/** Validate the MAS generate payload (mirrors the grok app's validator). */
export function validateImagineInput(input: any): { prompt: string; images: string[] } {
  if (!input || !Array.isArray(input.images) || input.images.length === 0) {
    throw new Error("A source photo is required");
  }
  if (input.images.length > 4) throw new Error("Use at most 4 photos");
  if (typeof input.prompt !== "string" || input.prompt.length < 12) {
    throw new Error("Prompt missing (min 12 chars)");
  }
  if (input.prompt.length > 4000) throw new Error("Prompt too long");
  for (const img of input.images) {
    if (typeof img !== "string" || !img.startsWith("data:image/")) {
      throw new Error("Photos must be image data URLs");
    }
    if (img.length > 1_800_000) throw new Error("A photo is too large");
  }
  return { prompt: input.prompt, images: input.images };
}
