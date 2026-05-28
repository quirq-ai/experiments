// Promotion engine. Two implementations:
//   - MockPromoter: deterministic, offline, used when ANTHROPIC_API_KEY is unset
//   - AnthropicPromoter: streams from Claude (Sonnet 4.6 by default)
// Both implement Promoter; callers don't care which.

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { Artifact, DiffMeta, Form } from './types';

export interface PromoteInput {
  parent: Artifact;
  /** raw content of the parent artifact (already read by the caller) */
  parentContent: string;
  targetForm: Form;
  /** optional user prompt; if missing, fall back to a sensible default */
  prompt?: string;
  /** called for each token of payload content; ignore the envelope */
  onChunk?: (delta: string) => void;
}

export interface PromoteOutput {
  /** raw text payload for the new artifact's entry file */
  payload: string;
  /** one-line summary of what the promotion produced */
  summary: string;
  /** the prompt the promoter actually used (filled in if caller omitted) */
  prompt: string;
  /** semantic diff vs parent */
  diff: DiffMeta;
  /** identifier of the promoter that produced this */
  source: 'mock' | 'anthropic';
}

export interface Promoter {
  promote(input: PromoteInput): Promise<PromoteOutput>;
}

/* -------------------------------------------------------------------------- */
/* MockPromoter                                                               */
/* -------------------------------------------------------------------------- */

export class MockPromoter implements Promoter {
  async promote(input: PromoteInput): Promise<PromoteOutput> {
    const { parent, parentContent, targetForm } = input;
    const prompt = input.prompt ?? defaultPromptFor(parent.form, targetForm);
    const payload = render(targetForm, parentContent, parent);
    // Stream the mocked payload in chunks so the UI feels alive even offline.
    if (input.onChunk) {
      for (const piece of chunked(payload, 18)) {
        await sleep(18);
        input.onChunk(piece);
      }
    }
    return {
      payload,
      summary: `Promoted ${parent.form} -> ${targetForm} (mock; set ANTHROPIC_API_KEY for real generation).`,
      prompt,
      diff: heuristicDiff(parentContent, payload),
      source: 'mock',
    };
  }
}

function defaultPromptFor(from: Form, to: Form): string {
  const table: Record<string, string> = {
    'terminal->md':     'Summarize this session into a one-pager I can share.',
    'md->deck':         'Make this into slides for a 10-minute leadership review.',
    'md->notebook':     'Turn this into a runnable notebook so we can poke at it.',
    'deck->notebook':   'Drop the slides into a notebook with the live data behind them.',
    'notebook->nextjs': 'Ship this analysis as a small internal dashboard.',
    'deck->nextjs':     'Turn this deck into a live dashboard.',
  };
  return table[`${from}->${to}`] ?? `Promote to ${to}.`;
}

function render(form: Form, parentContent: string, parent: Artifact): string {
  switch (form) {
    case 'terminal': return renderTerminal(parentContent);
    case 'md':       return renderMarkdown(parentContent, parent);
    case 'deck':     return renderDeck(parentContent, parent);
    case 'notebook': return renderNotebook(parentContent, parent);
    case 'nextjs':   return renderApp(parentContent, parent);
  }
}

function renderTerminal(parent: string): string {
  const lines = parent.split('\n').slice(0, 10);
  return [
    `$ claude "replay parent context"`,
    ...lines.map((l) => `> ${l}`),
    `$ claude "now what?"`,
  ].join('\n');
}

function renderMarkdown(parent: string, p: Artifact): string {
  return `# Auto-promoted one-pager

> Promoted from \`${p.id}\` (${p.form}) on ${new Date().toISOString()}.

## Thesis

${firstNonEmptyLine(parent) || 'Synthesized from the parent artifact.'}

## Evidence

${parent.split('\n').filter((l) => l.trim().length).slice(0, 6).map((l) => `- ${l.replace(/^[#>\-\*]\s*/, '')}`).join('\n')}

## Ask

Decide the next form to promote into: \`deck\` for sharing, \`notebook\` for digging in.
`;
}

function renderDeck(parent: string, p: Artifact): string {
  const points = parent.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).slice(0, 4);
  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>Auto deck</title>
<style>
:root{--bg:#0a0d09;--xo:#83d63a;--text:#e7ecdf;--muted:#8a937a;--line:#1e2419;}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font:14px/1.55 ui-sans-serif,system-ui;height:100%}
.deck{padding:18px;display:grid;gap:14px}
.slide{background:linear-gradient(135deg,#131811,#0d100c);border:1px solid var(--line);border-radius:10px;padding:28px;min-height:220px;position:relative}
.slide h2{color:var(--xo);margin:0 0 10px;font-size:22px}.slide p,.slide li{color:#d6dccb}
.pageno{position:absolute;right:16px;bottom:12px;color:var(--muted);font:11px ui-monospace,monospace}
</style></head><body><div class="deck">
<section class="slide"><h2>Auto-promoted deck</h2><p>From <code>${p.id}</code> (${p.form}) on ${new Date().toISOString().slice(0, 10)}.</p><span class="pageno">1 / 2</span></section>
<section class="slide"><h2>Key points</h2><ul>
${points.map((pt) => `  <li>${escapeHtml(pt)}</li>`).join('\n')}
</ul><span class="pageno">2 / 2</span></section>
</div></body></html>`;
}

function renderNotebook(parent: string, p: Artifact): string {
  const nb = {
    cells: [
      { cell_type: 'markdown', metadata: {}, source: [`# Auto-promoted notebook\n`, `From \`${p.id}\` (${p.form}).\n`] },
      { cell_type: 'code', execution_count: 1, metadata: {},
        source: [`parent_content = """\n${parent.slice(0, 800)}\n"""\n`, `print(len(parent_content), 'chars')`],
        outputs: [{ output_type: 'stream', name: 'stdout', text: [`${Math.min(parent.length, 800)} chars\n`] }] },
      { cell_type: 'markdown', metadata: {}, source: [`## Next steps\n`, `Replace this cell with real analysis.`] },
    ],
    metadata: { kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
                language_info: { name: 'python', version: '3.11.6' } },
    nbformat: 4, nbformat_minor: 5,
  };
  return JSON.stringify(nb, null, 2);
}

function renderApp(parent: string, p: Artifact): string {
  const snippet = escapeHtml(parent.slice(0, 600));
  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>Auto app preview</title>
<style>
:root{--bg:#0a0d09;--xo:#83d63a;--text:#e7ecdf;--muted:#8a937a;--line:#1e2419;--panel:#11140f}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font:14px/1.55 ui-sans-serif,system-ui}
.topbar{height:36px;background:#11140f;border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 14px;gap:10px}
.pill{background:#07090b;border:1px solid var(--line);color:var(--muted);font:11px ui-monospace,monospace;padding:4px 10px;border-radius:999px;flex:1}
.app{padding:22px 26px}.app h1{margin:0 0 18px;font-size:20px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px}
.card pre{white-space:pre-wrap;margin:0;font:12px ui-monospace,monospace;color:#d6dccb}
</style></head><body>
<div class="topbar"><span style="color:#5a8f2a">●</span><span style="color:#d6a93a">●</span><span style="color:#e07a5f">●</span>
<span class="pill"><b>auto.xo-sandbox.run</b> / dashboard</span></div>
<div class="app">
<h1>Auto-promoted dashboard</h1>
<div class="card"><pre>${snippet}</pre></div>
</div></body></html>`;
}

function heuristicDiff(parent: string, child: string): DiffMeta {
  // Tiny token-bag heuristic so the diff panel has something to show even
  // without semantic metadata from the model.
  const parentTokens = new Set(tokenize(parent));
  const childTokens  = new Set(tokenize(child));
  const carryover = [...parentTokens].filter((t) => childTokens.has(t)).slice(0, 5);
  const added     = [...childTokens].filter((t) => !parentTokens.has(t)).slice(0, 5);
  const dropped   = [...parentTokens].filter((t) => !childTokens.has(t)).slice(0, 5);
  return { carryover, added, dropped };
}

function tokenize(s: string): string[] {
  const stop = new Set(['the', 'and', 'a', 'of', 'to', 'in', 'is', 'on', 'for', 'with']);
  return [...new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9 \-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stop.has(w)),
  )];
}

function firstNonEmptyLine(s: string): string | null {
  for (const l of s.split('\n')) {
    const t = l.trim();
    if (t && !t.startsWith('#')) return t.replace(/^[\-\*>]\s*/, '');
  }
  return null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  } as Record<string, string>)[c]!);
}

function chunked(s: string, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/* -------------------------------------------------------------------------- */
/* AnthropicPromoter                                                          */
/* -------------------------------------------------------------------------- */

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

export class AnthropicPromoter implements Promoter {
  private client: Anthropic;
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async promote(input: PromoteInput): Promise<PromoteOutput> {
    const { parent, parentContent, targetForm } = input;
    const prompt = input.prompt ?? defaultPromptFor(parent.form, targetForm);

    const system = buildSystem(targetForm);
    const userMsg = buildUser(parent.form, parentContent, prompt, targetForm);

    let raw = '';
    const stream = this.client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: userMsg }],
    });

    let inPayload = false;
    let emitted = '';
    stream.on('text', (delta: string) => {
      raw += delta;
      // Find the payload window in `raw` and emit only the inside.
      if (!inPayload) {
        const open = raw.indexOf('<payload>');
        if (open >= 0) {
          inPayload = true;
          // emit anything that's already past the opening tag
          const after = raw.slice(open + '<payload>'.length);
          const close = after.indexOf('</payload>');
          if (close >= 0) {
            const inside = after.slice(0, close);
            const fresh = inside.slice(emitted.length);
            if (fresh && input.onChunk) input.onChunk(fresh);
            emitted = inside;
            inPayload = false;
          } else {
            if (after && input.onChunk) input.onChunk(after);
            emitted = after;
          }
        }
        return;
      }
      // already inside payload
      const open = raw.indexOf('<payload>');
      const after = raw.slice(open + '<payload>'.length);
      const close = after.indexOf('</payload>');
      const inside = close >= 0 ? after.slice(0, close) : after;
      const fresh = inside.slice(emitted.length);
      if (fresh && input.onChunk) input.onChunk(fresh);
      emitted = inside;
      if (close >= 0) inPayload = false;
    });

    await stream.finalMessage();

    const { payload, diff, summary } = parseEnvelope(raw, targetForm);
    return {
      payload,
      summary: summary || `Promoted ${parent.form} -> ${targetForm} (Sonnet 4.6).`,
      prompt,
      diff,
      source: 'anthropic',
    };
  }
}

function buildSystem(target: Form): string {
  const guidance: Record<Form, string> = {
    terminal: 'Emit a plain-text shell session (lines starting with "$ " for commands).',
    md: 'Emit clean Markdown: H1 title, H2 sections (Thesis / Evidence / Ask), short bullets.',
    deck: 'Emit a self-contained HTML reveal-style deck. Use <section class="slide"> blocks. Inline CSS. Dark theme; primary color #83d63a. 5-7 slides.',
    notebook: 'Emit a valid Jupyter notebook JSON (nbformat 4). Mix of markdown + code cells. Code can be Python pseudocode if real execution is not possible.',
    nextjs: 'Emit a self-contained HTML page that mimics a small Next.js dashboard: top bar with traffic-light dots and a URL pill, then a grid of KPI cards and one chart card. Inline CSS, dark theme, primary color #83d63a.',
  };
  return `You are promoting an artifact into a new form: ${target}.

${guidance[target]}

Output exactly this envelope and nothing else:

<payload>
[the artifact content here, in the format described above]
</payload>
<meta>
{"summary": "one-line summary of what the new artifact is", "carryover": ["concept from parent that survived", ...], "added": ["new substance this form introduces", ...], "dropped": ["material that did not survive", ...]}
</meta>

The carryover, added, dropped lists must each contain 2-5 short phrases (under 60 chars each). Do not emit anything outside the envelope.`;
}

function buildUser(parentForm: Form, parentContent: string, prompt: string, target: Form): string {
  return `Parent artifact (form: ${parentForm}):

<parent>
${parentContent.slice(0, 8000)}
</parent>

User intent for this promotion:
"${prompt}"

Produce the ${target} version following the envelope format from the system prompt.`;
}

function parseEnvelope(raw: string, target: Form): { payload: string; diff: DiffMeta; summary: string } {
  const payloadMatch = /<payload>([\s\S]*?)<\/payload>/.exec(raw);
  const metaMatch = /<meta>([\s\S]*?)<\/meta>/.exec(raw);
  const payload = payloadMatch ? payloadMatch[1].trim() : raw.trim();
  let diff: DiffMeta = { carryover: [], added: [], dropped: [] };
  let summary = '';
  if (metaMatch) {
    try {
      const meta = JSON.parse(metaMatch[1].trim());
      if (Array.isArray(meta.carryover)) diff.carryover = meta.carryover.slice(0, 6).map(String);
      if (Array.isArray(meta.added))     diff.added     = meta.added.slice(0, 6).map(String);
      if (Array.isArray(meta.dropped))   diff.dropped   = meta.dropped.slice(0, 6).map(String);
      if (typeof meta.summary === 'string') summary = meta.summary;
    } catch {
      // ignore; leave diff empty
    }
  }
  // If model forgot the wrapper for deck/nextjs and emitted bare HTML,
  // payload still works because we fall back to raw.
  return { payload, diff, summary };
}

/* -------------------------------------------------------------------------- */
/* Default singleton                                                           */
/* -------------------------------------------------------------------------- */

let _booted = false;

export function getDefaultPromoter(): Promoter {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key && key.startsWith('sk-')) {
    if (!_booted) {
      console.log(`[promote] AnthropicPromoter ready (model: ${MODEL})`);
      _booted = true;
    }
    return new AnthropicPromoter(key);
  }
  if (!_booted) {
    console.warn('[promote] ANTHROPIC_API_KEY missing or invalid; using MockPromoter.');
    _booted = true;
  }
  return new MockPromoter();
}
