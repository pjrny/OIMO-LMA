/**
 * Terminal-style front-facing UI for the OIMO / LMA edge gateway.
 * Ported from the Argon blueprint renderTerminalUI(), with the GPU engine
 * select updated to the project's targets.
 */

export function renderTerminalUI(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OIMO/LMA :: EDGE SYSTEM TERMINAL</title>
    <style>
        body { background-color: #0d1117; color: #58a6ff; font-family: 'Courier New', Courier, monospace; margin: 0; padding: 20px; line-height: 1.4; }
        h1 { color: #3fb950; font-size: 1.2rem; border-bottom: 1px solid #30363d; padding-bottom: 5px; }
        h3 { margin-top: 0; font-size: 0.95rem; color: #3fb950; }
        .box { border: 1px solid #30363d; background: #161b22; padding: 15px; margin-bottom: 15px; border-radius: 4px; }
        label { color: #8b949e; display: block; margin-bottom: 5px; font-size: 0.85rem; }
        input, select, textarea, button { background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; font-family: inherit; padding: 8px; width: 100%; box-sizing: border-box; margin-bottom: 10px; }
        button { background: #238636; color: #ffffff; font-weight: bold; cursor: pointer; border: none; }
        button:hover { background: #2ea043; }
        pre { background: #000000; color: #3fb950; padding: 10px; overflow-x: auto; border: 1px solid #21262d; font-size: 0.8rem; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        @media(max-width: 768px) { .grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <h1>[OIMO-LMA :: OSINT-GPU CORE ENGINE]</h1>
    <div class="grid">
        <div class="box">
            <h3>&gt; OSINT FOOTPRINT DISCOVERY</h3>
            <label>TARGET QUERY (Email / Username / Phone):</label>
            <input type="text" id="osintTarget" placeholder="user@example.com or username">
            <button onclick="runOsint()">EXECUTE MULTI-SOURCE SCAN</button>
        </div>
        <div class="box">
            <h3>&gt; GPU DISPATCHER (LOCAL + CLOUD)</h3>
            <label>PROMPT / COMMAND:</label>
            <input type="text" id="gpuPrompt" placeholder="DeepSeek code or Wan video prompt...">
            <label>ENGINE TARGET:</label>
            <select id="gpuTarget">
                <option value="local_code">local DeepSeek/Qwen (optional, env-gated)</option>
                <option value="runpod">RunPod</option>
                <option value="vast">Vast.ai</option>
                <option value="cloud_llm">Cloud LLM (Gemini/Kimi/Grok)</option>
            </select>
            <button onclick="runGpu()">DISPATCH COMPUTE TASK</button>
        </div>
    </div>
    <div class="box">
        <h3>&gt; SYSTEM CONSOLE OUTPUT</h3>
        <pre id="consoleOutput">&gt; SYSTEM READY. AWAITING COMMAND ARGUMENTS...</pre>
    </div>

    <script>
        async function runOsint() {
            const target = document.getElementById('osintTarget').value;
            const out = document.getElementById('consoleOutput');
            out.innerText = '> SCANNING HIBP, HUDSONROCK, EPIEOS, WHATSMYNAME...';
            try {
                const res = await fetch('/api/osint/scan', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ target })
                });
                const data = await res.json();
                out.innerText = JSON.stringify(data, null, 2);
            } catch(e) { out.innerText = '> ERROR: ' + e.message; }
        }

        async function runGpu() {
            const prompt = document.getElementById('gpuPrompt').value;
            const target = document.getElementById('gpuTarget').value;
            const out = document.getElementById('consoleOutput');
            out.innerText = '> DISPATCHING JOB TO ' + target.toUpperCase() + '...';
            try {
                const res = await fetch('/api/gpu/generate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ prompt, target })
                });
                const data = await res.json();
                out.innerText = JSON.stringify(data, null, 2);
            } catch(e) { out.innerText = '> ERROR: ' + e.message; }
        }
    </script>
</body>
</html>`;
}
