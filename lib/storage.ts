// File-backed storage. All runs live under <repo>/runs/<run_id>/manifest.json.
// Each artifact's payload lives in <repo>/runs/<run_id>/<artifact_dir>/.
// This module is server-only.

import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Artifact, DiffMeta, Form, Run, RunSummary } from './types';
import { FORM_META } from './types';

const ROOT = path.resolve(process.cwd(), 'runs');

async function ensureRoot() {
  await fs.mkdir(ROOT, { recursive: true });
}

function runDir(runId: string) {
  return path.join(ROOT, runId);
}

function manifestPath(runId: string) {
  return path.join(runDir(runId), 'manifest.json');
}

async function readJson<T>(p: string): Promise<T> {
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw) as T;
}

async function writeJsonAtomic(p: string, data: unknown) {
  const tmp = `${p}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, p);
}

export async function listRuns(): Promise<RunSummary[]> {
  await ensureRoot();
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  const runs: RunSummary[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    try {
      const run = await readJson<Run>(manifestPath(e.name));
      runs.push({
        id: run.id,
        title: run.title,
        created_at: run.created_at,
        artifacts: run.artifacts.map((a) => ({ id: a.id, form: a.form })),
      });
    } catch {
      // skip malformed
    }
  }
  runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return runs;
}

export async function getRun(runId: string): Promise<Run | null> {
  try {
    return await readJson<Run>(manifestPath(runId));
  } catch (e: any) {
    if (e?.code === 'ENOENT') return null;
    throw e;
  }
}

export async function createRun(input: { title: string; firstPrompt?: string }): Promise<Run> {
  await ensureRoot();
  const id = `r_${shortId()}`;
  const created_at = new Date().toISOString();
  const run: Run = {
    id,
    title: input.title,
    head: '',
    artifacts: [],
    created_at,
  };
  await fs.mkdir(runDir(id), { recursive: true });
  await writeJsonAtomic(manifestPath(id), run);
  return run;
}

export async function readArtifactContent(
  runId: string,
  artifactId: string,
): Promise<{ content: string; mime: string; artifact: Artifact } | null> {
  const run = await getRun(runId);
  if (!run) return null;
  const artifact = run.artifacts.find((a) => a.id === artifactId);
  if (!artifact) return null;
  const full = path.join(runDir(runId), artifact.content_ref);
  const content = await fs.readFile(full, 'utf8');
  return { content, mime: mimeFor(artifact.form), artifact };
}

export interface AppendInput {
  run_id: string;
  parent_id: string | null;
  form: Form;
  prompt: string;
  summary: string;
  /** raw text payload written to the artifact dir's entry file */
  payload: string;
  /** optional override of the artifact directory + entry filename */
  contentRefOverride?: string;
  /** optional semantic diff vs parent */
  diff?: DiffMeta;
  /** which promoter produced this */
  source?: string;
}

export async function appendArtifact(input: AppendInput): Promise<Artifact> {
  const run = await getRun(input.run_id);
  if (!run) throw new Error(`run not found: ${input.run_id}`);

  const nextNum = run.artifacts.length + 1;
  const id = `v${String(nextNum).padStart(2, '0')}`;
  const meta = FORM_META[input.form];
  const dirName = `${id}-${input.form}`;
  const fullDir = path.join(runDir(run.id), dirName);
  await fs.mkdir(fullDir, { recursive: true });

  const contentRef = input.contentRefOverride ?? `${dirName}/${meta.entry}`;
  const fullEntry = path.join(runDir(run.id), contentRef);
  await fs.mkdir(path.dirname(fullEntry), { recursive: true });
  await fs.writeFile(fullEntry, input.payload, 'utf8');

  const artifact: Artifact = {
    id,
    parent_id: input.parent_id,
    run_id: run.id,
    form: input.form,
    content_ref: contentRef,
    prompt: input.prompt,
    summary: input.summary,
    created_at: new Date().toISOString(),
    ...(input.diff ? { diff: input.diff } : {}),
    ...(input.source ? { source: input.source } : {}),
  };
  run.artifacts.push(artifact);
  run.head = id;
  await writeJsonAtomic(manifestPath(run.id), run);
  return artifact;
}

export async function moveHead(runId: string, artifactId: string): Promise<Run> {
  const run = await getRun(runId);
  if (!run) throw new Error(`run not found: ${runId}`);
  if (!run.artifacts.find((a) => a.id === artifactId)) {
    throw new Error(`artifact not in run: ${artifactId}`);
  }
  run.head = artifactId;
  await writeJsonAtomic(manifestPath(runId), run);
  return run;
}

function shortId(): string {
  // 8 hex chars from random uuid, good enough for local runs
  return randomUUID().replace(/-/g, '').slice(0, 8);
}

function mimeFor(form: Form): string {
  switch (form) {
    case 'terminal': return 'text/plain';
    case 'md':       return 'text/markdown';
    case 'deck':     return 'text/html';
    case 'notebook': return 'application/x-ipynb+json';
    case 'nextjs':   return 'text/html';
  }
}
