import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitDiff } from '../shared/types'

const run = promisify(execFile)
const MAX_PATCH = 400_000

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd, maxBuffer: 20 * 1024 * 1024 })
  return stdout
}

/** Working-tree changes against HEAD, including untracked files. Same for both engines. */
export async function gitDiff(cwd: string): Promise<GitDiff> {
  try {
    await git(cwd, ['rev-parse', '--is-inside-work-tree'])
  } catch {
    return { isRepo: false, files: [], patch: '' }
  }
  const [branch, status, tracked] = await Promise.all([
    git(cwd, ['branch', '--show-current']).catch(() => ''),
    git(cwd, ['status', '--porcelain=v1', '--untracked-files=all']),
    git(cwd, ['diff', 'HEAD', '--no-color', '--no-ext-diff']).catch(() => git(cwd, ['diff', '--no-color']))
  ])
  const files = status
    .split('\n')
    .filter(Boolean)
    .map((l) => ({ status: l.slice(0, 2).trim() || 'M', path: l.slice(3) }))

  let patch = tracked
  for (const f of files.filter((f) => f.status === '??').slice(0, 50)) {
    const add = await run('git', ['diff', '--no-index', '--no-color', '/dev/null', f.path], { cwd }).catch(
      (e: { stdout?: string }) => ({ stdout: e.stdout ?? '' })
    )
    patch += add.stdout
  }
  if (patch.length > MAX_PATCH) patch = patch.slice(0, MAX_PATCH) + '\n… diff truncated …\n'
  return { isRepo: true, branch: branch.trim() || undefined, files, patch }
}
