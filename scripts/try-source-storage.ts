// Sources inspection (input, generated data, storage) and opener boundaries:
//   node --import tsx --conditions=react-server scripts/try-source-storage.ts
// Every file is in an isolated fixture and every app-opening command is mocked.
import assert from "node:assert/strict";
import childProcess, { type ChildProcess, type SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";

type SpawnCall = { command: string; args: string[]; options: SpawnOptions };

async function main() {
  const fixtureParent = fs.realpathSync(process.cwd());
  const project = fs.mkdtempSync(path.join(fixtureParent, ".source-storage-test-"));
  const history = path.join(project, "history");
  const session = "2026-10-03T10-20-30Z_test12";
  const missingSession = "2026-10-03T10-20-30Z_absent";
  const envKeys = ["INNERNET_PROJECT_ROOT", "INNERNET_HISTORY_DIR", "INNERNET_DB", "INNERNET_DB_DIR", "INNERNET_HOME", "INNERNET_REMOTE", "INNERNET_REMOTE_DATABASE_URL", "INNERNET_ROOTS", "INNERNET_MAX_DEPTH"];
  const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
  const originalSpawn = childProcess.spawn;
  const calls: SpawnCall[] = [];
  let unrefs = 0;
  let failNextSpawn = false;

  try {
    process.env.INNERNET_PROJECT_ROOT = project;
    process.env.INNERNET_HISTORY_DIR = history;
    process.env.INNERNET_DB = "off";
    process.env.INNERNET_DB_DIR = path.join(project, "database");
    process.env.INNERNET_HOME = path.join(project, "home");
    for (const key of ["INNERNET_REMOTE", "INNERNET_REMOTE_DATABASE_URL", "INNERNET_ROOTS", "INNERNET_MAX_DEPTH"]) delete process.env[key];
    fs.mkdirSync(path.join(project, "data", "demo"), { recursive: true });
    fs.mkdirSync(path.join(history, session), { recursive: true });
    const configFile = path.join(project, "innernet.config.json");
    const writeConfig = (value: unknown) => fs.writeFileSync(configFile, JSON.stringify(value));
    const sessionFile = path.join(history, session, "innernet.jsonl");
    fs.writeFileSync(sessionFile, JSON.stringify({ at: "2026-10-03T10:20:30Z", app: "innernet", kind: "visit", url: "/" }) + "\n");
    fs.writeFileSync(path.join(project, "data", "index.json"), "{}");
    writeConfig({ roots: ["./projects", "../sibling", "~/notes"], maxDepth: 3 });

    // Patch before importing the opener so both CJS and ESM see the safe stub.
    childProcess.spawn = ((command: string, args: string[], options: SpawnOptions) => {
      calls.push({ command, args, options });
      const child = new EventEmitter() as EventEmitter & { unref(): void };
      child.unref = () => { unrefs++; };
      const shouldFail = failNextSpawn;
      failNextSpawn = false;
      queueMicrotask(() => child.emit(shouldFail ? "error" : "spawn", shouldFail ? new Error("Fixture opener unavailable") : undefined));
      return child as ChildProcess;
    }) as typeof childProcess.spawn;
    syncBuiltinESMExports();

    const { localSourceConfig, remoteOutputFile, writeSourceSelection } = await import("../lib/sources");
    const { sourceInfo, openStorageLocation } = await import("../lib/source-storage");
    assert.deepEqual(localSourceConfig(), {
      roots: [path.join(project, "projects"), path.resolve(project, "../sibling"), path.join(os.homedir(), "notes")],
      maxDepth: 3,
    }, "relative roots resolve from the configured project, independent of the process working directory");
    process.env.INNERNET_ROOTS = " ./override , ../other ";
    process.env.INNERNET_MAX_DEPTH = "2";
    assert.deepEqual(localSourceConfig(), { roots: [path.join(project, "override"), path.resolve(project, "../other")], maxDepth: 2 });
    delete process.env.INNERNET_ROOTS;
    delete process.env.INNERNET_MAX_DEPTH;

    const collection = { repositories: ["quirq-ai/innernet"] };
    writeSourceSelection({ local: false, remote: true }, collection);
    fs.writeFileSync(remoteOutputFile(collection)!, JSON.stringify({ meta: { generatedAt: "2026-10-01T00:00:00Z" } }));
    const initial = sourceInfo(session);
    assert.deepEqual(initial.selection, { local: false, remote: true });
    assert.deepEqual(initial.remote.repositories, ["quirq-ai/innernet"]);
    assert.equal(initial.remote.generatedAt, "2026-10-01T00:00:00Z");
    const row = (id: string, info = initial) => info.generated.find((entry) => entry.id === id);
    // Generated data is shown by relative paths only: the app folder's, or home's.
    assert.equal(row("session")?.path, `history/${session}/innernet.jsonl`);
    assert.equal(row("database")?.path, "database");
    assert.equal(row("local-index")?.path, "data/index.json");
    assert.ok(row("remote-index")?.path.startsWith("data/github-"));
    for (const item of initial.generated) assert.ok(!item.path.includes(project) && !item.path.startsWith(os.homedir()), `${item.id} shows no absolute path`);
    assert.equal(row("session")?.exists, true);
    assert.ok((row("session")?.bytes ?? 0) > 0, "sizes are measured");
    assert.equal(row("browser")?.kind, "browser");
    assert.equal(row("config"), undefined, "the folder settings are input, not generated data");
    assert.equal(initial.local.config, "innernet.config.json");
    assert.deepEqual(initial.storage.remote, { configured: false, connected: false, label: "Not set up" }, "no remote database until one is set up");

    // A remote database set up in INNERNET_HOME is offered by name, never by its URL.
    fs.mkdirSync(path.join(project, "home"), { recursive: true });
    fs.writeFileSync(path.join(project, "home", "remote.json"), JSON.stringify({ url: "postgresql://user:secret@ep-test-pooler.c-1.us-east-1.aws.neon.tech/db?sslmode=require", provider: "neon", name: "fixture-db" }));
    const withRemote = sourceInfo(session);
    assert.deepEqual(withRemote.storage.remote, { configured: true, connected: false, label: "fixture-db on Neon, us-east-1" }, "set up, but not connected until you connect it");
    assert.ok(!JSON.stringify(withRemote).includes("secret"), "the remote database's credentials never reach the page");

    fs.writeFileSync(configFile, "{ malformed");
    const malformed = sourceInfo(session);
    assert.ok(malformed.local.error?.includes("could not be read"));
    assert.deepEqual(malformed.local.roots, []);
    assert.equal(malformed.local.maxDepth, null);
    assert.equal(malformed.remote.generatedAt, initial.remote.generatedAt, "malformed local config does not hide GitHub details");
    assert.deepEqual(malformed.selection, { local: false, remote: true });
    fs.unlinkSync(configFile);
    assert.ok(sourceInfo(session).local.error);
    writeConfig({ roots: ["./projects"], maxDepth: 3 });
    assert.equal(sourceInfo(session).local.error, undefined, "repairing config restores local source details without restarting");

    await assert.rejects(openStorageLocation(session, configFile, "edit"), /Unknown storage location/);
    await assert.rejects(openStorageLocation(session, "../../other", "reveal"), /Unknown storage location/);
    await assert.rejects(openStorageLocation(session, "app-cache", "reveal"), /Unknown storage location/, "the build cache is no longer a location");
    await assert.rejects(openStorageLocation("../invalid", "history", "reveal"), /Bad session id/);
    await assert.rejects(openStorageLocation(session, "local-index", "edit"), /not available to edit/);
    await assert.rejects(openStorageLocation(session, "remote-index", "edit"), /not available to edit/);
    await assert.rejects(openStorageLocation(session, "history", "edit"), /not available to edit/);
    await assert.rejects(openStorageLocation(missingSession, "session", "edit"), /not available to edit/);
    assert.equal(calls.length, 0, "invalid targets and edits never launch an application");

    const expectedCommand = (action: "edit" | "reveal") => process.platform === "win32" ? action === "edit" ? "notepad.exe" : "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open";
    const expectedArgs = (destination: string, action: "edit" | "reveal") => process.platform === "darwin" && action === "edit" ? ["-t", destination] : [destination];
    await openStorageLocation(session, "config", "edit");
    assert.deepEqual(calls[0], { command: expectedCommand("edit"), args: expectedArgs(configFile, "edit"), options: { shell: false, stdio: "ignore", detached: true, windowsHide: false } });
    await openStorageLocation(session, "config", "reveal");
    assert.deepEqual(calls[1].args, expectedArgs(project, "reveal"));
    assert.equal(calls[1].command, expectedCommand("reveal"));
    await openStorageLocation(session, "session", "edit");
    assert.deepEqual(calls[2].args, expectedArgs(sessionFile, "edit"));
    await openStorageLocation(session, "history", "reveal");
    assert.deepEqual(calls[3].args, expectedArgs(history, "reveal"));
    await openStorageLocation(missingSession, "session", "reveal");
    assert.deepEqual(calls[4].args, expectedArgs(history, "reveal"), "a missing session reveals the nearest existing parent");
    await openStorageLocation(session, "remote-cache", "reveal");
    assert.deepEqual(calls[5].args, expectedArgs(project, "reveal"), "a clone cache not yet made reveals the project folder");
    assert.equal(unrefs, 6);

    failNextSpawn = true;
    await assert.rejects(openStorageLocation(session, "config", "edit"), /Fixture opener unavailable/);
    assert.equal(unrefs, 6, "a failed opener is not treated as an opened app");
    console.log("Source storage passed: relative roots, config repair, relative generated paths and sizes, remote database by name only, target whitelist, generated-file protection and mocked editor/folder commands. No real apps opened.");
  } finally {
    childProcess.spawn = originalSpawn;
    syncBuiltinESMExports();
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    const resolved = fs.realpathSync(project);
    assert.equal(path.dirname(resolved), fixtureParent);
    assert.ok(path.basename(resolved).startsWith(".source-storage-test-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
