import { Sandbox } from "@vercel/sandbox";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, language, port } = body;

    if (!code || !language) {
      return NextResponse.json(
        { error: "Missing required fields: code, language" },
        { status: 400 }
      );
    }

    const runtime = language === "python" ? "python3.13" : "node22";
    const filename = language === "python" ? "app.py" : "app.js";

    // Create the sandbox
    const sandbox = await Sandbox.create({
      runtime,
      timeout: 300, // 5 minutes
      ...(port ? { ports: [{ port: Number(port), protocol: "http" as const }] } : {}),
    });

    // Write the user's code to the sandbox
    await sandbox.writeFiles([
      {
        path: filename,
        content: Buffer.from(code),
      },
    ]);

    // If we need npm packages, install them first
    if (language === "node" && code.includes("require(") || code.includes("import ")) {
      // Extract package names from require/import statements
      const requireMatches = code.matchAll(/require\(['"]([^'"./][^'"]*)['"]\)/g);
      const importMatches = code.matchAll(/from\s+['"]([^'"./][^'"]*)['"]/g);
      const packages = new Set<string>();

      for (const match of requireMatches) {
        packages.add(match[1].split("/")[0]);
      }
      for (const match of importMatches) {
        packages.add(match[1].split("/")[0]);
      }

      // Filter out Node.js built-in modules
      const builtins = new Set([
        "http", "https", "fs", "path", "os", "url", "util", "stream",
        "events", "crypto", "net", "child_process", "cluster", "dns",
        "readline", "zlib", "buffer", "querystring", "assert",
      ]);
      const toInstall = [...packages].filter((p) => !builtins.has(p));

      if (toInstall.length > 0) {
        const installResult = await sandbox.runCommand({
          cmd: "npm",
          args: ["install", ...toInstall],
        });

        if (installResult.exitCode !== 0) {
          return NextResponse.json({
            sandboxId: sandbox.id,
            status: "error",
            output: `Failed to install packages: ${installResult.stderr}`,
          });
        }
      }
    }

    // For Python, install pip packages if needed
    if (language === "python" && code.includes("import ")) {
      const importMatches = code.matchAll(/^(?:from|import)\s+(\w+)/gm);
      const stdlibModules = new Set([
        "os", "sys", "json", "re", "math", "datetime", "time", "random",
        "collections", "itertools", "functools", "io", "pathlib", "typing",
        "http", "urllib", "socket", "threading", "subprocess", "hashlib",
        "base64", "csv", "sqlite3", "unittest", "logging", "argparse",
        "abc", "copy", "enum", "string", "textwrap", "struct", "asyncio",
      ]);
      const packages = new Set<string>();

      for (const match of importMatches) {
        if (!stdlibModules.has(match[1])) {
          packages.add(match[1]);
        }
      }

      if (packages.size > 0) {
        const installResult = await sandbox.runCommand({
          cmd: "pip",
          args: ["install", ...packages],
        });

        if (installResult.exitCode !== 0) {
          return NextResponse.json({
            sandboxId: sandbox.id,
            status: "error",
            output: `Failed to install packages: ${installResult.stderr}`,
          });
        }
      }
    }

    // Run the code
    const cmd = language === "python" ? "python3" : "node";
    let url: string | null = null;

    if (port) {
      // For server apps, run detached and return the URL
      await sandbox.runCommand({
        cmd,
        args: [filename],
        detached: true,
      });

      // Give the server a moment to start
      await new Promise((r) => setTimeout(r, 2000));

      url = sandbox.domain(Number(port));

      return NextResponse.json({
        sandboxId: sandbox.id,
        status: "running",
        url: `https://${url}`,
        output: `Server started on port ${port}`,
      });
    } else {
      // For scripts, run and capture output
      let stdout = "";
      let stderr = "";

      const result = await sandbox.runCommand({
        cmd,
        args: [filename],
        stdout: (data: string) => {
          stdout += data;
        },
        stderr: (data: string) => {
          stderr += data;
        },
      });

      return NextResponse.json({
        sandboxId: sandbox.id,
        status: result.exitCode === 0 ? "success" : "error",
        output: stdout || stderr || "(no output)",
        exitCode: result.exitCode,
      });
    }
  } catch (error: unknown) {
    console.error("Sandbox error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
