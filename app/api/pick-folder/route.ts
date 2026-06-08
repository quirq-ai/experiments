import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { platform } from "node:process";
import { promisify } from "node:util";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const run = promisify(execFile);

/**
 * Opens the host operating system's native folder chooser and returns the
 * selected absolute path. This only works when the server runs on the same
 * machine as the user (the visualizer is a local-first tool), which is why the
 * dialog is invoked server-side: the route handler shells out to the OS picker
 * via execFile (no shell, so nothing is interpolated into a command string).
 *
 * Returns { path } on selection, { canceled: true } if the user dismisses the
 * dialog, or { error } when no native picker is available.
 */
async function pickDarwin(): Promise<string | null> {
  // `choose folder` returns an alias; coerce to a POSIX path. On cancel,
  // osascript exits non-zero with "User canceled. (-128)".
  const script =
    'POSIX path of (choose folder with prompt "Select a local git repository")';
  const { stdout } = await run("osascript", ["-e", script]);
  return stdout.trim() || null;
}

async function pickLinux(): Promise<string | null> {
  // Prefer zenity, fall back to kdialog. Both exit non-zero on cancel.
  try {
    const { stdout } = await run("zenity", [
      "--file-selection",
      "--directory",
      "--title=Select a local git repository",
    ]);
    return stdout.trim() || null;
  } catch {
    const { stdout } = await run("kdialog", [
      "--getexistingdirectory",
      process.env.HOME || ".",
    ]);
    return stdout.trim() || null;
  }
}

async function pickWindows(): Promise<string | null> {
  const ps = [
    "Add-Type -AssemblyName System.Windows.Forms;",
    "$d = New-Object System.Windows.Forms.FolderBrowserDialog;",
    "$d.Description = 'Select a local git repository';",
    "if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }",
  ].join(" ");
  const { stdout } = await run("powershell", [
    "-NoProfile",
    "-Command",
    ps,
  ]);
  return stdout.trim() || null;
}

function isCancel(err: unknown): boolean {
  const msg = (err as Error)?.message ?? "";
  // macOS: "User canceled. (-128)". zenity/kdialog/powershell: empty stdout
  // with a non-zero exit, surfaced as an execFile error.
  return /(-128|User canceled|canceled|cancelled)/i.test(msg);
}

export async function GET() {
  try {
    let path: string | null = null;
    if (platform === "darwin") path = await pickDarwin();
    else if (platform === "linux") path = await pickLinux();
    else if (platform === "win32") path = await pickWindows();
    else {
      return NextResponse.json(
        { error: `No native folder picker for platform: ${platform}` },
        { status: 501 },
      );
    }

    if (!path) return NextResponse.json({ canceled: true });

    // Normalize a trailing slash from the macOS POSIX coercion.
    const normalized =
      path.length > 1 && path.endsWith("/") ? path.replace(/\/+$/, "") : path;
    return NextResponse.json({ path: normalized });
  } catch (e) {
    if (isCancel(e)) return NextResponse.json({ canceled: true });
    return NextResponse.json(
      { error: `Folder picker failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
