#!/usr/bin/env node
// Claude Messages: an iMessage-style window onto the Claude Code sessions running on this machine.
//
// Discovery  <config>/sessions/<pid>.json, the record every live Claude Code process keeps.
// History    each session's transcript, <config>/projects/<dir>/<sessionId>.jsonl, read from its tail.
// Sending    a session started here gets a user line on its stream-json stdin; any other session
//            gets one frame on its inbox socket (the record's messagingSocketPath).
// The browser talks only to this server, which listens on 127.0.0.1 and checks a per-launch token.
// No dependencies: Node 18 or later.

import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4417;
const HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
const ORIGINS = new Set([...HOSTS].map(h => `http://${h}`));
const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const SESSIONS_DIR = path.join(CONFIG_DIR, 'sessions');
const PROJECTS_DIR = path.join(CONFIG_DIR, 'projects');
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const DEFAULT_CWD = process.env.CLAUDE_MESSAGES_CWD || os.homedir();
const TOKEN = crypto.randomBytes(16).toString('hex');
const STATE_FILE = path.join(HERE, '.state.json');
const TAIL_BYTES = 1_500_000; // history read from the end of a transcript
const MAX_MESSAGES = 400;     // kept per thread
const MAX_TEXT = 100_000;     // one outgoing message
const MODELS = new Set(['opus', 'sonnet', 'haiku']);
const MODES = new Set(['default', 'acceptEdits', 'plan']);

// Variables a Claude Code host sets for its own session. A session started here must not inherit
// them, or it would take itself for that session's child or wait for a host to refresh its login.
const HOST_VARS = new Set([
  'CLAUDECODE', 'CLAUDE_PID', 'CLAUDE_EFFORT', 'CLAUDE_PREVIEW_CLASSIFIER_FLOOR',
  'CLAUDE_AGENT_SDK_VERSION', 'CLAUDE_AGENT_SDK_MCP_NO_PREFIX', 'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_HOST_SESSION_ID', 'CLAUDE_CODE_CHILD_SESSION',
  'CLAUDE_CODE_SESSION_ATTENDED', 'CLAUDE_CODE_MESSAGING_SOCKET', 'CLAUDE_CODE_MESSAGING_TOKEN',
  'CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH', 'CLAUDE_CODE_DESKTOP_APP_VERSION', 'CLAUDE_CODE_EXECPATH',
  'CLAUDE_CODE_TERMINAL_MCP_TOOLS', 'CLAUDE_CODE_REPORT_FINDINGS', 'CLAUDE_CODE_EMIT_TOOL_USE_SUMMARIES',
  'CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING', 'CLAUDE_CODE_ENABLE_ASK_USER_QUESTION_TOOL',
  'CLAUDE_CODE_SIMPLE', 'CLAUDE_CODE_OAUTH_SCOPES', 'CLAUDE_CODE_ACCOUNT_UUID',
  'CLAUDE_CODE_ORGANIZATION_UUID', 'CLAUDE_CODE_USER_EMAIL', 'CLAUDE_CODE_DISABLE_CRON',
  'CLAUDE_CODE_EAGER_FLUSH', 'CLAUDE_CODE_DISABLE_TERMINAL_TITLE',
]);

// A receiving session records the pid of whoever posted to its inbox (origin.verifiedPeerPid).
// Remembering this server's pids lets a thread show those messages as yours after a restart.
const ourPids = new Set();
try { for (const p of JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).pids || []) ourPids.add(p); } catch {}
ourPids.add(process.pid);
try { fs.writeFileSync(STATE_FILE, JSON.stringify({ pids: [...ourPids].slice(-100) })); } catch {}

// ---------------------------------------------------------------- discovery

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function readRegistry() {
  const out = new Map();
  let files = [];
  try { files = fs.readdirSync(SESSIONS_DIR); } catch { return out; }
  for (const f of files) {
    if (!/^\d+\.json$/.test(f)) continue; // key files and anything else are never read
    const pid = Number(f.slice(0, -5));
    if (!alive(pid)) continue;
    try {
      const file = path.join(SESSIONS_DIR, f);
      if (fs.statSync(file).size > 262_144) continue;
      const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (rec.spare || rec.parkedJobId) continue;
      out.set(pid, rec);
    } catch {}
  }
  return out;
}

const transcripts = new Map(); // sessionId -> { file, lookedAt }

function transcriptFor(sessionId, cwd) {
  const hit = transcripts.get(sessionId);
  if (hit?.file) return hit.file;
  if (hit && Date.now() - hit.lookedAt < 5000) return null;
  let file = path.join(PROJECTS_DIR, (cwd || '').replace(/[^a-zA-Z0-9]/g, '-'), `${sessionId}.jsonl`);
  if (!fs.existsSync(file)) {
    file = null; // long paths are shortened with a hash, so look in every project folder
    try {
      for (const dir of fs.readdirSync(PROJECTS_DIR)) {
        const f = path.join(PROJECTS_DIR, dir, `${sessionId}.jsonl`);
        if (fs.existsSync(f)) { file = f; break; }
      }
    } catch {}
  }
  transcripts.set(sessionId, { file, lookedAt: Date.now() });
  return file;
}

// ---------------------------------------------------------------- transcripts -> messages

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter(b => b?.type === 'text').map(b => b.text).join('\n');
}

function promptText(raw) {
  const cmd = raw.match(/<command-name>([^<]*)<\/command-name>/);
  if (cmd) {
    const args = raw.match(/<command-args>([^<]*)<\/command-args>/);
    return `${cmd[1]} ${args?.[1] || ''}`.trim();
  }
  if (/^\s*<(local-command-|bash-|task-notification|system-reminder|command-message)/.test(raw)) return '';
  return raw.trim();
}

function attr(s, name) {
  const m = s.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function peerMessage(id, raw, origin, ts) {
  if (origin.handback || origin.senderTaskId) return []; // a subagent reporting to its own session
  let text = typeof origin.body === 'string' ? origin.body : raw || '';
  let name = origin.fromName || null;
  // Rendered form: a header line, the body (or an envelope around it), then a guidance paragraph.
  const env = text.match(/<cross-session-message([^>]*)>\n?([\s\S]*?)\n?<\/cross-session-message>/);
  if (env) { name = attr(env[1], 'from-name') || name; text = env[2]; }
  else {
    text = text.replace(/^Another Claude session sent a message[^\n]*\n/, '');
    const cut = text.lastIndexOf('\n\nThis came from another Claude session');
    if (cut >= 0) text = text.slice(0, cut);
  }
  text = text.replace(/<\\(?=\/)/g, '<').trim(); // undo the receiver's closing-tag escape
  if (!text) return [];
  const from = name || (origin.from && origin.from !== 'unknown' ? origin.from : 'another session');
  return [{ id, kind: ourPids.has(origin.verifiedPeerPid) ? 'me' : 'peer', text, from, ts }];
}

function toMessages(rec) {
  if (!rec || rec.isSidechain) return [];
  const ts = Date.parse(rec.timestamp) || Date.now();
  if (rec.type === 'user') {
    if (rec.isCompactSummary || rec.isVisibleInTranscriptOnly) return [];
    const origin = rec.origin || {};
    if (origin.kind === 'peer') return peerMessage(rec.uuid, textOf(rec.message?.content), origin, ts);
    if ((origin.kind && origin.kind !== 'human') || rec.isMeta) return [];
    const text = promptText(textOf(rec.message?.content));
    return text ? [{ id: rec.uuid, kind: 'me', text, ts }] : [];
  }
  if (rec.type === 'attachment' && rec.attachment?.type === 'queued_command') {
    const a = rec.attachment, origin = a.origin || {};
    if (a.commandMode && a.commandMode !== 'prompt') return [];
    if (origin.kind === 'peer') return peerMessage(rec.uuid, textOf(a.prompt), origin, ts);
    if (origin.kind && origin.kind !== 'human') return [];
    const text = promptText(textOf(a.prompt));
    return text ? [{ id: rec.uuid, kind: 'me', text, ts }] : [];
  }
  if (rec.type === 'queue-operation' && rec.operation === 'enqueue' && typeof rec.content === 'string') {
    return [{ id: `q:${rec.timestamp}`, kind: 'queued', text: rec.content.trim(), ts }]; // a receipt, never shown
  }
  if (rec.type === 'assistant') {
    const out = [];
    (rec.message?.content || []).forEach((b, i) => {
      const id = `${rec.uuid}:${i}`;
      if (b.type === 'text' && b.text?.trim()) {
        out.push({ id, kind: rec.isApiErrorMessage ? 'note' : 'claude', text: b.text.trim(), ts });
      } else if (b.type === 'tool_use' && b.name === 'SendMessage' && typeof b.input?.message === 'string') {
        out.push({ id, kind: 'claude', text: b.input.message.trim(), to: String(b.input.to || ''), ts });
      } else if (b.type === 'tool_use') {
        out.push({ id, kind: 'tool', text: b.name, ts });
      }
    });
    return out;
  }
  return [];
}

class Thread {
  constructor(sessionId, file) {
    this.sessionId = sessionId;
    this.file = file;
    this.load();
  }

  load() {
    const size = fs.statSync(this.file).size;
    this.offset = Math.max(0, size - TAIL_BYTES);
    this.skipFirst = this.offset > 0; // the first line read from mid-file is partial
    this.rest = Buffer.alloc(0);
    this.messages = [];
    this.read(size);
  }

  read(size) {
    if (size <= this.offset) return [];
    const buf = Buffer.alloc(size - this.offset);
    const fd = fs.openSync(this.file, 'r');
    try { fs.readSync(fd, buf, 0, buf.length, this.offset); } finally { fs.closeSync(fd); }
    this.offset = size;
    let data = this.rest.length ? Buffer.concat([this.rest, buf]) : buf;
    const added = [];
    for (let nl = data.indexOf(10); nl !== -1; nl = data.indexOf(10)) {
      const line = data.subarray(0, nl).toString('utf8');
      data = data.subarray(nl + 1);
      if (this.skipFirst) { this.skipFirst = false; continue; }
      let rec;
      try { rec = JSON.parse(line); } catch { continue; }
      added.push(...toMessages(rec));
    }
    this.rest = Buffer.from(data);
    this.messages.push(...added.filter(m => m.kind !== 'queued'));
    if (this.messages.length > MAX_MESSAGES) this.messages.splice(0, this.messages.length - MAX_MESSAGES);
    return added;
  }

  poll() {
    let size;
    try { size = fs.statSync(this.file).size; } catch { return null; }
    if (size < this.offset) { this.load(); return 'reset'; }
    return this.read(size);
  }
}

const threads = new Map(); // sessionId -> Thread

function threadFor(sessionId, cwd) {
  if (!sessionId) return null;
  let t = threads.get(sessionId);
  if (t) return t;
  const file = transcriptFor(sessionId, cwd);
  if (!file) return null;
  try { t = new Thread(sessionId, file); } catch { return null; }
  threads.set(sessionId, t);
  broadcast('thread', { sessionId, messages: t.messages });
  return t;
}

// ---------------------------------------------------------------- sessions started here

const owned = new Map(); // pid -> session this server started and drives over stdin

function childEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!HOST_VARS.has(k)) env[k] = v;
  return env;
}

function startSession({ cwd, name, model, mode } = {}) {
  const dir = path.resolve(String(cwd || DEFAULT_CWD).trim().replace(/^~(?=$|\/)/, os.homedir()));
  if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`No such folder: ${dir}`);
  const sessionId = crypto.randomUUID();
  const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
    '--permission-prompt-tool', 'stdio', '--session-id', sessionId];
  name = String(name || '').trim().slice(0, 80);
  if (name) args.push('--name', name);
  if (MODELS.has(model)) args.push('--model', model);
  if (MODES.has(mode)) args.push('--permission-mode', mode);
  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, args, { cwd: dir, env: childEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
    child.once('error', e => reject(new Error(e.code === 'ENOENT'
      ? `Could not run "${CLAUDE_BIN}". Set CLAUDE_BIN to the claude executable.` : e.message)));
    child.once('spawn', () => {
      const s = { child, pid: child.pid, sessionId, cwd: dir, name: name || path.basename(dir),
        busy: false, ended: false, perms: new Map(), startedAt: Date.now(), out: Buffer.alloc(0), err: '', error: null };
      owned.set(s.pid, s);
      child.stdout.on('data', d => onStdout(s, d));
      child.stderr.on('data', d => { s.err = (s.err + d).slice(-2000); });
      child.stdin.on('error', () => {});
      child.on('exit', code => {
        s.ended = true;
        s.busy = false;
        s.perms.clear();
        if (code && !s.error) s.error = s.err.trim().split('\n').pop() || `claude exited with code ${code}`;
        tick();
      });
      write(s, { type: 'control_request', request_id: 'init', request: { subtype: 'initialize' } });
      resolve(s);
    });
  });
}

function write(s, msg) {
  if (!s.ended && s.child.stdin.writable) s.child.stdin.write(JSON.stringify(msg) + '\n');
}

function onStdout(s, chunk) {
  let data = s.out.length ? Buffer.concat([s.out, chunk]) : chunk;
  for (let nl = data.indexOf(10); nl !== -1; nl = data.indexOf(10)) {
    const line = data.subarray(0, nl).toString('utf8');
    data = data.subarray(nl + 1);
    try { handle(s, JSON.parse(line)); } catch {}
  }
  s.out = Buffer.from(data);
}

function describeTool(tool, input = {}) {
  const home = p => String(p).replace(os.homedir(), '~');
  if (typeof input.command === 'string') return input.command.slice(0, 600);
  if (input.file_path && typeof input.content === 'string') return `${home(input.file_path)}\n\n${input.content.slice(0, 400)}`;
  if (input.file_path && typeof input.new_string === 'string') return `${home(input.file_path)}\n\n${input.new_string.slice(0, 400)}`;
  const v = input.file_path ?? input.notebook_path ?? input.url ?? input.pattern ?? input.query;
  return v != null ? home(v).slice(0, 600) : JSON.stringify(input).slice(0, 600);
}

function handle(s, m) {
  if (m.type === 'control_request' && m.request?.subtype === 'can_use_tool') {
    const { tool_name: tool, input } = m.request;
    s.perms.set(m.request_id, { requestId: m.request_id, tool, input, summary: describeTool(tool, input) });
  } else if (m.type === 'control_cancel_request') {
    s.perms.delete(m.request_id);
  } else if (m.type === 'control_request') {
    write(s, { type: 'control_response',
      response: { subtype: 'error', request_id: m.request_id, error: 'Claude Messages does not handle this request' } });
    return;
  } else if (m.type === 'result') {
    s.busy = false;
    s.error = m.is_error ? String(m.result || m.subtype || 'The turn failed') : null;
  } else if (m.type === 'control_response' && m.response?.subtype === 'error') {
    s.error = String(m.response.error);
  } else {
    return;
  }
  tick();
}

function sendOwned(s, text) {
  if (s.ended) throw new Error('This session has ended');
  write(s, { type: 'user', message: { role: 'user', content: text } });
  s.busy = true;
  s.error = null;
}

function answerPermission(s, requestId, allow) {
  const p = s.perms.get(requestId);
  if (!p) throw new Error('That request is no longer open');
  s.perms.delete(requestId);
  write(s, { type: 'control_response', response: { subtype: 'success', request_id: requestId,
    response: allow ? { behavior: 'allow', updatedInput: p.input }
      : { behavior: 'deny', message: 'The user declined this in Claude Messages.' } } });
}

function endSession(s) {
  if (s.ended) { owned.delete(s.pid); return; }
  s.child.stdin.end(); // finishes the current turn, then exits
  setTimeout(() => { if (!s.ended) s.child.kill('SIGTERM'); }, 3000).unref();
}

// ---------------------------------------------------------------- sending to any other session

// One user frame on the session's inbox socket. Without an auth line the receiver treats the
// sender as unauthenticated (allowed on macOS and Linux, where the socket is 0600 in a 0700
// folder), and without a `from` address there is no reply path and no receipt: replies are
// read from the session's transcript instead.
function postToInbox(socketPath, text) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(socketPath);
    sock.setTimeout(5000, () => sock.destroy(new Error('The session did not answer in time')));
    sock.once('error', e => reject(new Error(['ENOENT', 'ECONNREFUSED'].includes(e.code)
      ? 'That session is no longer listening' : e.message)));
    sock.once('connect', () => {
      sock.setTimeout(0);
      const frame = { type: 'user', message: { role: 'user', content: text }, priority: 'next' };
      sock.end(JSON.stringify(frame) + '\n', () => resolve());
    });
  });
}

// ---------------------------------------------------------------- the session list

function preview(m) {
  const t = m.text.replace(/```[\s\S]*?```/g, '[code]').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
  return (m.kind === 'peer' ? `${m.from}: ` : '') + t.slice(0, 160);
}

function describe(pid, rec, s) {
  const sessionId = rec?.sessionId || s?.sessionId;
  const cwd = rec?.cwd || s?.cwd || '';
  const thread = threadFor(sessionId, cwd);
  const last = thread?.messages.findLast(m => m.kind !== 'tool' && m.kind !== 'note');
  let status = rec?.status || 'idle';
  if (s) status = s.ended ? 'ended' : s.perms.size ? 'waiting' : s.busy ? 'busy' : 'idle';
  return {
    id: String(pid), pid, sessionId, cwd,
    folder: path.basename(cwd) || cwd,
    name: String(rec?.name || s?.name || path.basename(cwd) || 'Claude').trim(),
    status, owned: !!s, desktop: !!rec?.hostSessionId, version: rec?.version || null,
    canSend: s ? !s.ended : !!rec?.messagingSocketPath,
    preview: last ? preview(last) : '',
    lastTs: last?.ts || s?.startedAt || rec?.startedAt || 0,
    error: s?.error || null,
    permissions: s ? [...s.perms.values()].map(({ requestId, tool, summary }) => ({ requestId, tool, summary })) : [],
  };
}

function sessionList() {
  const reg = readRegistry();
  const out = [];
  for (const [pid, rec] of reg) {
    if (rec.messagingSocketPath || owned.has(pid)) out.push(describe(pid, rec, owned.get(pid)));
  }
  for (const [pid, s] of owned) if (!reg.has(pid)) out.push(describe(pid, null, s));
  return out.sort((a, b) => b.lastTs - a.lastTs);
}

function findSession(id) {
  const pid = Number(id);
  const s = owned.get(pid);
  const rec = readRegistry().get(pid);
  if (!s && !rec) throw new Error('No such session');
  return { pid, s, rec };
}

// ---------------------------------------------------------------- live updates

const clients = new Set();
let lastList = '';

function broadcast(event, data) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(frame);
}

function tick() {
  for (const t of threads.values()) {
    const added = t.poll();
    if (added === 'reset') broadcast('thread', { sessionId: t.sessionId, messages: t.messages });
    else if (added?.length) broadcast('messages', { sessionId: t.sessionId, messages: added });
  }
  const list = sessionList();
  const live = new Set(list.map(x => x.sessionId));
  for (const id of threads.keys()) if (!live.has(id)) threads.delete(id);
  const json = JSON.stringify(list);
  if (json !== lastList) { lastList = json; broadcast('sessions', list); }
}

setInterval(tick, 1000);

// ---------------------------------------------------------------- http

function reply(res, code, data) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

function sameToken(a) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(TOKEN);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function readJson(req) {
  if (!String(req.headers['content-type']).startsWith('application/json')) {
    return Promise.reject(new Error('Expected JSON'));
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', d => { body += d; if (body.length > 1_000_000) req.destroy(new Error('Too large')); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Bad JSON')); } });
    req.on('error', reject);
  });
}

function messageText(body) {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) throw new Error('Nothing to send');
  if (text.length > MAX_TEXT) throw new Error('That message is too long');
  return text;
}

async function route(req, res, url) {
  const p = url.pathname;
  if (req.method === 'GET' && p === '/api/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(`retry: 2000\nevent: sessions\ndata: ${lastList || '[]'}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    return;
  }
  if (req.method === 'GET' && p === '/api/sessions') return reply(res, 200, sessionList());
  if (req.method === 'POST' && p === '/api/sessions') {
    const body = await readJson(req);
    const s = await startSession(body);
    if (typeof body.text === 'string' && body.text.trim()) sendOwned(s, messageText(body));
    tick();
    return reply(res, 200, { id: String(s.pid), sessionId: s.sessionId });
  }
  const m = p.match(/^\/api\/sessions\/(\d+)\/(messages|send|permission|end)$/);
  if (!m) return reply(res, 404, { error: 'Not found' });
  const { pid, s, rec } = findSession(m[1]);
  if (req.method === 'GET' && m[2] === 'messages') {
    const sessionId = rec?.sessionId || s?.sessionId;
    const thread = threadFor(sessionId, rec?.cwd || s?.cwd);
    return reply(res, 200, { sessionId, messages: thread?.messages || [] });
  }
  if (req.method !== 'POST') return reply(res, 405, { error: 'Method not allowed' });
  const body = await readJson(req);
  if (m[2] === 'send') {
    const text = messageText(body);
    if (s && body.via !== 'inbox') sendOwned(s, text);
    else if (rec?.messagingSocketPath) await postToInbox(rec.messagingSocketPath, text);
    else throw new Error('This session has no inbox to post to');
    tick();
    return reply(res, 200, { ok: true });
  }
  if (!s) throw new Error('Only sessions started here can do that');
  if (m[2] === 'permission') answerPermission(s, String(body.requestId), body.allow === true);
  else endSession(s);
  tick();
  return reply(res, 200, { ok: true, pid });
}

const server = http.createServer(async (req, res) => {
  try {
    // Refuse other hosts (DNS rebinding) and other origins (a web page posting to localhost).
    if (!HOSTS.has(req.headers.host)) return reply(res, 421, { error: 'Unexpected host' });
    if (req.headers.origin && !ORIGINS.has(req.headers.origin)) return reply(res, 403, { error: 'Cross-origin request refused' });
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'GET' && url.pathname === '/') {
      const config = JSON.stringify({ token: TOKEN, cwd: DEFAULT_CWD }).replace(/</g, '\\u003c');
      const html = fs.readFileSync(path.join(HERE, 'public', 'index.html'), 'utf8').replace('__CONFIG__', config);
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY',
        'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'none'",
      });
      return res.end(html);
    }
    if (!url.pathname.startsWith('/api/')) return reply(res, 404, { error: 'Not found' });
    if (!sameToken(req.headers['x-token'] || url.searchParams.get('token'))) return reply(res, 401, { error: 'Bad token' });
    await route(req, res, url);
  } catch (e) {
    if (!res.headersSent) reply(res, 400, { error: e.message });
  }
});

function shutdown() {
  for (const s of owned.values()) if (!s.ended) s.child.kill('SIGTERM');
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, '127.0.0.1', () => {
  tick();
  console.log(`Claude Messages is running at http://127.0.0.1:${PORT}`);
});
