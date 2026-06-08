/**
 * Node.js bridge for @vercel/sandbox SDK.
 * Called by the Python backend via subprocess.
 *
 * Usage:
 *   node sandbox_runner.mjs <json-payload>
 *
 * The JSON payload should have: { code, language, port? }
 * Outputs a JSON result to stdout.
 */

import { Sandbox } from "@vercel/sandbox";

const input = JSON.parse(process.argv[2]);
const { code, language, port } = input;

async function run() {
  const runtime = language === "python" ? "python3.13" : "node22";
  const filename = language === "python" ? "app.py" : "app.js";

  // Create sandbox
  const sandbox = await Sandbox.create({
    runtime,
    timeout: 300,
    ...(port
      ? { ports: [{ port: Number(port), protocol: "http" }] }
      : {}),
  });

  // Write user code
  await sandbox.writeFiles([
    { path: filename, content: Buffer.from(code) },
  ]);

  // Auto-install Node packages
  if (language === "node") {
    const requireRe = /require\(['"]([^'"./][^'"]*)['"]\)/g;
    const importRe = /from\s+['"]([^'"./][^'"]*)['"]/g;
    const builtins = new Set([
      "http","https","fs","path","os","url","util","stream",
      "events","crypto","net","child_process","cluster","dns",
      "readline","zlib","buffer","querystring","assert",
    ]);
    const pkgs = new Set();
    for (const m of code.matchAll(requireRe)) pkgs.add(m[1].split("/")[0]);
    for (const m of code.matchAll(importRe)) pkgs.add(m[1].split("/")[0]);
    const toInstall = [...pkgs].filter((p) => !builtins.has(p));

    if (toInstall.length > 0) {
      const r = await sandbox.runCommand({ cmd: "npm", args: ["install", ...toInstall] });
      if (r.exitCode !== 0) {
        console.log(JSON.stringify({
          sandboxId: sandbox.id,
          status: "error",
          output: `npm install failed: ${r.stderr}`,
        }));
        return;
      }
    }
  }

  // Auto-install Python packages
  if (language === "python") {
    const stdlib = new Set([
      "os","sys","json","re","math","datetime","time","random",
      "collections","itertools","functools","io","pathlib","typing",
      "http","urllib","socket","threading","subprocess","hashlib",
      "base64","csv","sqlite3","unittest","logging","argparse",
      "abc","copy","enum","string","textwrap","struct","asyncio",
    ]);
    const pkgs = new Set();
    for (const m of code.matchAll(/^(?:from|import)\s+(\w+)/gm)) {
      if (!stdlib.has(m[1])) pkgs.add(m[1]);
    }
    if (pkgs.size > 0) {
      const r = await sandbox.runCommand({ cmd: "pip", args: ["install", ...pkgs] });
      if (r.exitCode !== 0) {
        console.log(JSON.stringify({
          sandboxId: sandbox.id,
          status: "error",
          output: `pip install failed: ${r.stderr}`,
        }));
        return;
      }
    }
  }

  const cmd = language === "python" ? "python3" : "node";

  if (port) {
    // Server mode — run detached, return URL
    await sandbox.runCommand({ cmd, args: [filename], detached: true });
    await new Promise((r) => setTimeout(r, 2000));
    const url = sandbox.domain(Number(port));

    console.log(JSON.stringify({
      sandboxId: sandbox.id,
      status: "running",
      url: `https://${url}`,
      output: `Server started on port ${port}`,
    }));
  } else {
    // Script mode — capture output
    let stdout = "";
    let stderr = "";
    const result = await sandbox.runCommand({
      cmd,
      args: [filename],
      stdout: (data) => { stdout += data; },
      stderr: (data) => { stderr += data; },
    });

    console.log(JSON.stringify({
      sandboxId: sandbox.id,
      status: result.exitCode === 0 ? "success" : "error",
      output: stdout || stderr || "(no output)",
      exitCode: result.exitCode,
    }));
  }
}

run().catch((err) => {
  console.log(JSON.stringify({
    status: "error",
    output: err.message || String(err),
  }));
  process.exit(1);
});
