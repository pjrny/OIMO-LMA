/**
 * GPU / generation task router (ported from the Argon blueprint gpu_router.js,
 * extended with the project-decision "cloud_llm" target).
 *
 * Targets:
 *  - local_code : Argon local DeepSeek/Qwen node via MCP_LLM_CODE_LOCAL (env-gated)
 *  - local_media: Argon local Wan 2.2 / ComfyUI node via MCP_LLM_PICVIDEO_LOCAL (env-gated)
 *  - runpod     : RunPod cloud GPU via RUNPOD_API (env-gated)
 *  - vast       : Vast.ai GPU network via VAST_API (env-gated)
 *  - cloud_llm  : route the prompt through the shared cloud LLM abstraction
 *                 (Gemini / Kimi / Grok) — replaces the missing local LLM.
 */

import { runCloudLLM, type LLMEnv } from "./llm";

export interface GpuEnv extends LLMEnv {
  MCP_LLM_CODE_LOCAL?: string;
  MCP_LLM_PICVIDEO_LOCAL?: string;
  RUNPOD_API?: string;
  VAST_API?: string;
}

export interface GpuPayload {
  prompt?: string;
  target?: string; // local_code | local_media | runpod | vast | cloud_llm
  provider?: string; // for cloud_llm: gemini | kimi | grok
}

export async function dispatchGpuTask(
  payload: GpuPayload,
  env: GpuEnv
): Promise<Record<string, unknown>> {
  const { prompt, target = "cloud_llm", provider } = payload;
  if (!prompt) {
    throw new Error("Missing required field: prompt");
  }

  // Option 1: Argon Local DeepSeek / Qwen MCP node (optional, env-gated)
  if (target === "local_code") {
    if (!env.MCP_LLM_CODE_LOCAL) {
      return {
        status: "skipped",
        node: "Argon_Local_DeepSeek_Qwen",
        reason: "MCP_LLM_CODE_LOCAL is not configured on the worker.",
        hint: "Use target=cloud_llm to route through the cloud LLM instead.",
      };
    }
    const res = await fetch(`${env.MCP_LLM_CODE_LOCAL.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-coder",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    return { status: "completed", node: "Argon_Local_DeepSeek_Qwen", ...(await res.json()) };
  }

  // Option 2: Argon Local Wan 2.2 / ComfyUI node (optional, env-gated)
  if (target === "local_media") {
    if (!env.MCP_LLM_PICVIDEO_LOCAL) {
      return {
        status: "skipped",
        node: "Argon_Local_Wan_ComfyUI",
        reason: "MCP_LLM_PICVIDEO_LOCAL is not configured on the worker.",
      };
    }
    const res = await fetch(`${env.MCP_LLM_PICVIDEO_LOCAL.replace(/\/$/, "")}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: { "3": { inputs: { text: prompt } } } }),
    });
    return { status: "completed", node: "Argon_Local_Wan_ComfyUI", ...(await res.json()) };
  }

  // Option 3: RunPod cloud GPU fallback (env-gated)
  if (target === "runpod") {
    if (!env.RUNPOD_API) {
      return {
        status: "skipped",
        node: "RunPod",
        reason: "RUNPOD_API is not configured on the worker.",
      };
    }
    const res = await fetch("https://api.runpod.ai/v2/comfyui/run", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RUNPOD_API}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: { prompt } }),
    });
    return { status: "queued", node: "RunPod", ...(await res.json()) };
  }

  // Option 4: Vast.ai GPU network (env-gated)
  if (target === "vast") {
    if (!env.VAST_API) {
      return {
        status: "skipped",
        node: "Vast_ai",
        reason: "VAST_API is not configured on the worker.",
      };
    }
    // Submit a one-shot generation job to the Vast.ai console API.
    const res = await fetch("https://console.vast.ai/api/v0/jobs/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.VAST_API}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ job: { prompt, type: "generate" } }),
    });
    return { status: "queued", node: "Vast_ai", ...(await res.json()) };
  }

  // Option 5 (project decision): cloud LLM replaces the missing local LLM.
  if (target === "cloud_llm") {
    const result = await runCloudLLM(
      prompt,
      "You are the OIMO / LMA generation engine. Complete the user's generation request precisely and in character.",
      provider,
      env
    );
    return { status: "completed", node: "Cloud_LLM", ...result };
  }

  return { status: "queued", node: "Argon_Local_Default", prompt, target };
}
