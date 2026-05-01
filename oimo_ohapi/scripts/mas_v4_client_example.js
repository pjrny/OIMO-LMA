// Drop-in client used by the MAS V4 Cloudflare Worker.
// Only the BASE_URL changes vs the old OhAPI integration.

const BASE_URL = process.env.OHAPI_BASE || "https://ohapi.your-server.com/api/v1";
const TOKEN = process.env.OIMO_TOKEN;

async function api(path, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

export async function createCharacter(name, base64Selfies) {
  return api("/characters/create", {
    method: "POST",
    body: JSON.stringify({ name, images: base64Selfies }),
  });
}

export async function generateScene({ character_id, scene_id, prompt }) {
  const { job_id } = await api("/images/generate", {
    method: "POST",
    body: JSON.stringify({ character_id, scene_id, prompt }),
  });

  // Poll
  for (let i = 0; i < 60; i++) {
    const j = await api(`/jobs/${job_id}/status`);
    if (j.status === "succeeded") return j.url;       // presigned image URL
    if (j.status === "failed") throw new Error(j.error || "generation failed");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("timeout");
}
