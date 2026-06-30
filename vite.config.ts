import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { promises as fs } from 'node:fs'
import type { Stats } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'

interface SessionRecord {
  id: string
  project: string
  title: string
  messages: number
  bytes: number
  startedAt: number
  lastActiveAt: number
  cwd: string
}

const cache = new Map<string, { mtimeMs: number; size: number; value: SessionRecord }>()
let currentSessionId = ''
const promptedByApp = new Map<string, number>()

function countOccurrences(s: string, needle: string) {
  let c = 0
  let i = 0
  while ((i = s.indexOf(needle, i)) !== -1) {
    c++
    i += needle.length
  }
  return c
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === 'object' && (block as any).type === 'text' && typeof (block as any).text === 'string') {
        return (block as any).text
      }
    }
  }
  return ''
}

async function readSession(file: string, st: Stats): Promise<SessionRecord> {
  const cached = cache.get(file)
  if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) return cached.value

  const fh = await fs.open(file, 'r')
  let head = ''
  try {
    const buf = Buffer.alloc(Math.min(st.size, 65536))
    await fh.read(buf, 0, buf.length, 0)
    head = buf.toString('utf8')
  } finally {
    await fh.close()
  }

  let title = ''
  let cwd = ''
  let startedAt = 0
  for (const line of head.split('\n')) {
    if (!line.trim()) continue
    let obj: any
    try {
      obj = JSON.parse(line)
    } catch {
      continue
    }
    if (!cwd && typeof obj.cwd === 'string') cwd = obj.cwd
    if (!startedAt && typeof obj.timestamp === 'string') {
      const t = Date.parse(obj.timestamp)
      if (!Number.isNaN(t)) startedAt = t
    }
    if (!title && obj.type === 'summary' && typeof obj.summary === 'string') title = obj.summary
    if (!title && obj.type === 'user') {
      const text = extractText(obj.message?.content).trim()
      if (text && !text.startsWith('<') && !text.startsWith('Caveat:')) {
        title = text.replace(/\s+/g, ' ').slice(0, 110)
      }
    }
    if (title && cwd && startedAt) break
  }
  if (!startedAt) startedAt = st.birthtimeMs || st.mtimeMs

  let messages: number
  if (st.size <= 8 * 1024 * 1024) {
    const body = await fs.readFile(file, 'utf8')
    messages = countOccurrences(body, '"type":"user"') + countOccurrences(body, '"type":"assistant"')
  } else {
    messages = Math.round(st.size / 1500)
  }

  const dirName = path.basename(path.dirname(file))
  const value: SessionRecord = {
    id: path.basename(file, '.jsonl'),
    project: cwd ? path.basename(cwd) : dirName.split('-').filter(Boolean).pop() || 'unknown',
    title: title || 'Untitled session',
    messages,
    bytes: st.size,
    startedAt: Math.round(startedAt),
    lastActiveAt: Math.round(st.mtimeMs),
    cwd,
  }
  cache.set(file, { mtimeMs: st.mtimeMs, size: st.size, value })
  return value
}

async function collectSessions() {
  const root = path.join(os.homedir(), '.claude', 'projects')
  let dirents
  try {
    dirents = await fs.readdir(root, { withFileTypes: true })
  } catch {
    return []
  }
  const files: Array<{ file: string; st: Stats }> = []
  for (const d of dirents) {
    if (!d.isDirectory()) continue
    const dir = path.join(root, d.name)
    let names: string[] = []
    try {
      names = await fs.readdir(dir)
    } catch {
      continue
    }
    for (const nm of names) {
      if (!nm.endsWith('.jsonl') || nm.startsWith('agent-')) continue
      const fp = path.join(dir, nm)
      try {
        const st = await fs.stat(fp)
        if (st.size > 400) files.push({ file: fp, st })
      } catch {
        continue
      }
    }
  }
  files.sort((a, b) => b.st.mtimeMs - a.st.mtimeMs)
  const out: Array<SessionRecord & { isCurrent: boolean }> = []
  for (const f of files.slice(0, 60)) {
    try {
      const rec = await readSession(f.file, f.st)
      out.push({ ...rec, isCurrent: false })
    } catch {
      continue
    }
  }
  const valid = out.filter(s => s.messages >= 2)
  if (valid.length) {
    // The dev server inherits the spawning session's env when launched from
    // inside a Claude Code session; otherwise fall back to most recently active.
    const envId = process.env.CLAUDE_CODE_SESSION_ID
    let current = envId ? valid.find(s => s.id === envId) : undefined
    if (!current) {
      current = valid[0]
      for (const s of valid) if (s.lastActiveAt > current.lastActiveAt) current = s
    }
    current.isCurrent = true
    currentSessionId = current.id
  }
  return valid
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c: any) => {
      data += c
      if (data.length > 100000) reject(new Error('body too large'))
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

async function handlePrompt(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'POST only' }))
    return
  }
  try {
    const body = JSON.parse((await readBody(req)) || '{}')
    const id = typeof body.id === 'string' ? body.id : ''
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    if (!id || !prompt || prompt.length > 4000) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'id and a prompt up to 4000 chars are required' }))
      return
    }
    // Refresh stats so the current-session id and mtimes are up to date.
    const list = await collectSessions()
    const rec = list.find(s => s.id === id)
    if (!rec) {
      res.statusCode = 404
      res.end(JSON.stringify({ error: 'Unknown session' }))
      return
    }
    if (id === process.env.CLAUDE_CODE_SESSION_ID || id === currentSessionId) {
      res.statusCode = 409
      res.end(JSON.stringify({ error: 'This session is already live, talk to it directly' }))
      return
    }
    // A transcript written to seconds ago is probably an interactive session in
    // another window; resuming it concurrently risks interleaved writes.
    const now = Date.now()
    const promptedAt = promptedByApp.get(id) ?? 0
    if (now - rec.lastActiveAt < 20000 && now - promptedAt > 600000) {
      res.statusCode = 423
      res.end(JSON.stringify({ error: 'Session looks live right now, try when it idles' }))
      return
    }
    // Resume the target session headlessly; it keeps writing to the same
    // transcript, which is what the activity poller watches.
    const env = { ...process.env }
    delete env.CLAUDECODE
    delete env.CLAUDE_CODE_SESSION_ID
    delete env.CLAUDE_CODE_ENTRYPOINT
    const child = spawn('claude', ['--resume', id, '-p', prompt], {
      cwd: rec.cwd || os.homedir(),
      detached: true,
      stdio: 'ignore',
      env,
    })
    const failure = await new Promise<string>(resolve => {
      child.once('spawn', () => resolve(''))
      child.once('error', err => resolve(String(err)))
    })
    if (failure) {
      res.statusCode = 500
      res.end(JSON.stringify({ error: failure }))
      return
    }
    child.unref()
    promptedByApp.set(id, now)
    res.statusCode = 202
    res.end(JSON.stringify({ ok: true }))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: String(err) }))
  }
}

function sessionsApi(): Plugin {
  const handle = async (res: any) => {
    try {
      const sessions = await collectSessions()
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ sessions }))
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ error: String(err) }))
    }
  }
  const wire = (server: { middlewares: any }) => {
    server.middlewares.use('/api/sessions', (_req: any, res: any) => void handle(res))
    server.middlewares.use('/api/prompt', (req: any, res: any) => void handlePrompt(req, res))
  }
  return {
    name: 'claude-sessions-api',
    configureServer(server) {
      wire(server)
    },
    configurePreviewServer(server) {
      wire(server)
    },
  }
}

export default defineConfig({
  plugins: [react(), sessionsApi()],
  server: {
    // Honor the port assigned by the harness (Vite ignores PORT by default).
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
