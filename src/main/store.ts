// Local persistence: projects, thread index, and per-thread transcripts as JSON
// under Electron's userData directory.
import { mkdirSync, readFileSync, renameSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { emptyTranscript, type Transcript } from '../shared/transcript'
import type { Project, ThreadKey, ThreadMeta } from '../shared/types'

export class Store {
  private projects: Project[]
  private threads: ThreadMeta[]
  private transcripts = new Map<ThreadKey, Transcript>()
  private dirty = new Set<ThreadKey>()
  private timer?: NodeJS.Timeout

  constructor(private dir: string) {
    mkdirSync(join(dir, 'transcripts'), { recursive: true })
    this.projects = this.read('projects.json', [])
    this.threads = this.read('threads.json', [])
  }

  private read<T>(file: string, fallback: T): T {
    try {
      return JSON.parse(readFileSync(join(this.dir, file), 'utf8'))
    } catch {
      return fallback
    }
  }

  private write(file: string, data: unknown): void {
    const path = join(this.dir, file)
    writeFileSync(path + '.tmp', JSON.stringify(data))
    renameSync(path + '.tmp', path)
  }

  private transcriptFile(key: ThreadKey): string {
    return `transcripts/${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`
  }

  listProjects(): Project[] {
    return this.projects
  }

  addProject(p: Project): void {
    if (this.projects.some((x) => x.path === p.path)) return
    this.projects = [...this.projects, p]
    this.write('projects.json', this.projects)
  }

  removeProject(path: string): void {
    this.projects = this.projects.filter((p) => p.path !== path)
    this.write('projects.json', this.projects)
  }

  listThreads(cwd: string): ThreadMeta[] {
    return this.threads.filter((t) => t.cwd === cwd).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  getThread(key: ThreadKey): ThreadMeta | undefined {
    return this.threads.find((t) => t.key === key)
  }

  upsertThread(meta: ThreadMeta): void {
    this.threads = [...this.threads.filter((t) => t.key !== meta.key), meta]
    this.write('threads.json', this.threads)
  }

  deleteThread(key: ThreadKey): void {
    this.threads = this.threads.filter((t) => t.key !== key)
    this.write('threads.json', this.threads)
    this.transcripts.delete(key)
    rmSync(join(this.dir, this.transcriptFile(key)), { force: true })
  }

  getTranscript(key: ThreadKey): Transcript {
    let t = this.transcripts.get(key)
    if (!t) {
      t = { ...emptyTranscript(), ...this.read(this.transcriptFile(key), {}), activeTurnId: null }
      this.transcripts.set(key, t)
    }
    return t
  }

  setTranscript(key: ThreadKey, t: Transcript): void {
    this.transcripts.set(key, t)
    this.dirty.add(key)
    this.timer ??= setTimeout(() => this.flush(), 400)
  }

  flush(): void {
    this.timer = undefined
    for (const key of this.dirty) {
      const t = this.transcripts.get(key)
      if (t) this.write(this.transcriptFile(key), t)
    }
    this.dirty.clear()
  }
}
