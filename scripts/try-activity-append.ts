// Hand-edited JSONL remains readable when the recorder appends the next event:
//   pnpm tsx --conditions=react-server scripts/try-activity-append.ts
// All writes use an isolated temporary history folder, never the user's history.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function main() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "innernet-append-"));
  const previousHistory = process.env.INNERNET_HISTORY_DIR;
  process.env.INNERNET_HISTORY_DIR = path.join(temporary, "history");
  try {
    const { appendEvent, HISTORY_DIR, readSession } = await import("../lib/activity");
    const session = "2026-10-03T05-12-07Z_appendtest";
    const folder = path.join(HISTORY_DIR, session);
    const file = path.join(folder, "innernet.jsonl");
    fs.mkdirSync(folder, { recursive: true });
    const edited = { at: "2026-10-03T05:12:08.000Z", app: "innernet", kind: "visit", title: "Edited event" };
    const raw = JSON.stringify(edited);
    fs.writeFileSync(file, raw); // A valid last JSONL object without a line terminator.
    assert.equal(readSession(session)?.events.length, 1);

    assert.deepEqual(appendEvent(session, "innernet", { at: "2026-10-03T05:12:09Z", kind: "visit", title: "Next event" }), { ok: true });
    const repaired = fs.readFileSync(file, "utf8");
    assert.ok(repaired.startsWith(raw + "\n"), "the edited line is preserved byte for byte with a separator added");
    assert.ok(repaired.endsWith("\n"));
    assert.deepEqual(readSession(session)?.events.map((event) => event.title), ["Edited event", "Next event"]);

    assert.deepEqual(appendEvent(session, "innernet", { at: "2026-10-03T05:12:10Z", kind: "visit", title: "Normal append" }), { ok: true });
    assert.equal(fs.readFileSync(file, "utf8").split("\n").length, 4, "normal appends do not introduce blank lines");
    assert.deepEqual(readSession(session)?.events.map((event) => event.title), ["Edited event", "Next event", "Normal append"]);

    const emptySession = "2026-10-03T05-12-07Z_emptytest";
    assert.deepEqual(appendEvent(emptySession, "innernet", { kind: "visit", title: "First event" }), { ok: true });
    assert.ok(fs.readFileSync(path.join(HISTORY_DIR, emptySession, "innernet.jsonl"), "utf8").startsWith("{"));
    assert.equal(readSession(emptySession)?.events.length, 1);

    // Existing session-directory link protection remains in place, including Windows junctions.
    const linkedSession = "2026-10-03T05-12-07Z_linktest";
    const elsewhere = path.join(temporary, "elsewhere");
    fs.mkdirSync(elsewhere);
    const link = path.join(HISTORY_DIR, linkedSession);
    fs.symlinkSync(elsewhere, link, process.platform === "win32" ? "junction" : "dir");
    try {
      assert.deepEqual(appendEvent(linkedSession, "innernet", { kind: "visit" }), { ok: false, status: 409, error: "Session is not a folder." });
      assert.deepEqual(fs.readdirSync(elsewhere), [], "appending never follows the session link");
    } finally {
      fs.unlinkSync(link);
    }
    console.log("Activity append passed: edited final line, normal append, first event and linked-session rejection.");
  } finally {
    if (previousHistory === undefined) delete process.env.INNERNET_HISTORY_DIR;
    else process.env.INNERNET_HISTORY_DIR = previousHistory;
    const resolved = fs.realpathSync(temporary);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("innernet-append-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
