export type PresetId = 'trio' | 'collision' | 'binary' | 'cluster' | 'solo'
export type SimMode = 'sandbox' | 'sessions'

export interface SessionInfo {
  id: string
  project: string
  title: string
  messages: number
  bytes: number
  startedAt: number
  lastActiveAt: number
  isCurrent: boolean
}

export interface SimStats {
  stars: number
  cores: number
  fps: number
}

export interface SimOptions {
  onStats?: (s: SimStats) => void
  onThrow?: () => void
  onSelect?: (s: SessionInfo | null) => void
  startPaused?: boolean
}

export interface SimHandle {
  destroy(): void
  setPaused(p: boolean): void
  loadPreset(id: PresetId): void
  loadSessions(list: SessionInfo[]): void
  select(id: string | null): void
  setActivity(ids: string[]): void
  reset(): void
  addRandomGalaxy(): void
  setTimeScale(v: number): void
  setGravity(v: number): void
  setTrails(v: number): void
}

// Units: world pixels, velocities in px per tick where one tick is a 60fps frame.
const G0 = 0.25
const SOFT2 = 300
const TAU = Math.PI * 2
const MAX_PARTICLES = 20000
const MAX_GALAXIES = 12
const WORLD_CULL2 = 4500 * 4500
const PALETTE = [205, 28, 286, 160, 330, 48, 195]
const SESSION_HUES = [208, 28, 286, 330, 195, 48, 160, 248, 12]
const CURRENT_HUE = 92

interface Galaxy {
  x: number
  y: number
  vx: number
  vy: number
  m: number
  hue: number
  R: number
  n: number
  px: Float32Array
  py: Float32Array
  pvx: Float32Array
  pvy: Float32Array
  br: Uint8Array
  colDim: string
  colBright: string
  colCore: string
  meta?: SessionInfo
  orbitRad: number
  orbitAng: number
  orbitW: number
  orbitCx: number
  orbitCy: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function hueFor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return SESSION_HUES[h % SESSION_HUES.length]
}

export function createSim(canvas: HTMLCanvasElement, opts: SimOptions = {}): SimHandle {
  const maybeCtx = canvas.getContext('2d')
  if (!maybeCtx) throw new Error('Canvas 2D context unavailable')
  const ctx: CanvasRenderingContext2D = maybeCtx

  let W = 0
  let H = 0
  let dpr = 1
  const cam = { x: 0, y: 0, zoom: 1 }
  let stars: Array<{ x: number; y: number; s: number; a: number; tw: number; p: number }> = []
  let galaxies: Galaxy[] = []
  let preset: PresetId = 'trio'
  let mode: SimMode = 'sandbox'
  let selectedId: string | null = null
  let activeIds = new Set<string>()
  let simTime = 0
  let sceneRadius = 600
  // Folder clusters for the Sessions scene: one entry per project, used to draw
  // the cluster label and (via each galaxy's orbitCx/Cy) to orbit sessions
  // around their own folder rather than the global origin.
  let sessionClusters: Array<{ name: string; x: number; y: number; hue: number; count: number; radius: number }> = []
  let timeScale = 1
  let gravMul = 1
  let fade = 0.284
  let paused = !!opts.startPaused
  let frameCount = 0
  let fps = 60
  let last = 0
  let raf = 0
  let destroyed = false
  let lastCamX = 0
  let lastCamY = 0
  let lastZoom = 1

  const ac = new AbortController()
  const sig: AddEventListenerOptions = { signal: ac.signal }

  const pointers = new Map<number, { x: number; y: number }>()
  let throwDrag: { sx: number; sy: number; x: number; y: number; hue: number; id: number } | null = null
  let panLast: { x: number; y: number; id: number } | null = null
  let clickStart: { x: number; y: number; id: number; moved: boolean } | null = null
  let pinchD = 0
  // Once the user zooms or pans, resizes stop re-fitting the camera.
  let userCam = false

  function fit() {
    const r = canvas.getBoundingClientRect()
    W = Math.max(r.width, 50)
    H = Math.max(r.height, 50)
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    stars = []
    const count = Math.round((W * H) / 6500)
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: Math.random() < 0.85 ? 1 : 2,
        a: 0.16 + Math.random() * 0.45,
        tw: Math.random() * TAU,
        p: i % 2 === 0 ? 0.18 : 0.38,
      })
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#05060c'
    ctx.fillRect(0, 0, W, H)
  }

  function fitCamera() {
    cam.x = 0
    cam.y = 0
    if (mode === 'sessions') {
      cam.zoom = clamp((Math.min(W, H) * 0.5) / (sceneRadius + 320), 0.14, 1.0)
    } else {
      cam.zoom = clamp(Math.min(W / 1400, H / 900), 0.35, 1.5)
    }
  }

  function clearStage() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#05060c'
    ctx.fillRect(0, 0, W, H)
  }

  function makeGalaxy(
    x: number, y: number, vx: number, vy: number,
    m: number, hue: number, count: number, R: number, dir: number,
  ): Galaxy {
    const g: Galaxy = {
      x, y, vx, vy, m, hue, R, n: count,
      px: new Float32Array(count),
      py: new Float32Array(count),
      pvx: new Float32Array(count),
      pvy: new Float32Array(count),
      br: new Uint8Array(count),
      colDim: `hsla(${hue}, 70%, 72%, 0.5)`,
      colBright: `hsla(${hue}, 85%, 86%, 0.95)`,
      colCore: `hsla(${hue}, 90%, 75%, 0.6)`,
      orbitRad: 0,
      orbitAng: 0,
      orbitW: 0,
      orbitCx: 0,
      orbitCy: 0,
    }
    const arms = Math.random() < 0.4 ? 3 : 2
    const twist = (4.2 / R) * dir
    const Gm = G0 * gravMul * m
    for (let i = 0; i < count; i++) {
      const r = 3 + Math.pow(Math.random(), 0.62) * R
      const ang = Math.random() < 0.22
        ? Math.random() * TAU
        : (i % arms) * (TAU / arms) + r * twist + (Math.random() + Math.random() - 1) * 0.42
      const c = Math.cos(ang)
      const s = Math.sin(ang)
      // Circular orbital speed for the softened potential, so disks start in equilibrium.
      const acc = (Gm * r) / Math.pow(r * r + SOFT2, 1.5)
      const v = Math.sqrt(Math.max(acc * r, 0)) * (0.94 + Math.random() * 0.12)
      g.px[i] = x + c * r
      g.py[i] = y + s * r
      g.pvx[i] = vx - s * v * dir
      g.pvy[i] = vy + c * v * dir
      g.br[i] = Math.random() < 0.1 ? 1 : 0
    }
    return g
  }

  function orbitVel(x: number, y: number, Mtot: number, f: number): [number, number] {
    const d = Math.hypot(x, y) || 1
    const v = Math.sqrt((G0 * gravMul * Mtot) / d) * f
    return [(-y / d) * v, (x / d) * v]
  }

  function setPreset(id: PresetId) {
    preset = id
    mode = 'sandbox'
    selectedId = null
    galaxies = []
    if (id === 'trio') {
      const specs = [
        { x: -300, y: 40, m: 1600, hue: 208, n: 2400, R: 250, dir: 1 },
        { x: 300, y: -140, m: 950, hue: 28, n: 1500, R: 185, dir: -1 },
        { x: 150, y: 260, m: 480, hue: 286, n: 800, R: 115, dir: 1 },
      ]
      let Mt = 0
      for (const s of specs) Mt += s.m
      for (const s of specs) {
        const [vx, vy] = orbitVel(s.x, s.y, Mt, 0.62)
        galaxies.push(makeGalaxy(s.x, s.y, vx, vy, s.m, s.hue, s.n, s.R, s.dir))
      }
    } else if (id === 'collision') {
      galaxies.push(makeGalaxy(-430, -70, 1.35, 0.22, 1200, 200, 2100, 215, 1))
      galaxies.push(makeGalaxy(430, 70, -1.35, -0.22, 1200, 22, 2100, 215, -1))
    } else if (id === 'binary') {
      const d = 380
      const M = 2300
      const v = Math.sqrt((G0 * gravMul * M) / d) * 0.5 * 0.95
      galaxies.push(makeGalaxy(-d / 2, 0, 0, -v, M / 2, 195, 1900, 190, 1))
      galaxies.push(makeGalaxy(d / 2, 0, 0, v, M / 2, 322, 1900, 190, -1))
    } else if (id === 'cluster') {
      const nG = 6
      const ring = 330
      const ms: number[] = []
      let Mt = 0
      for (let i = 0; i < nG; i++) {
        const m = 320 + Math.random() * 240
        ms.push(m)
        Mt += m
      }
      for (let i = 0; i < nG; i++) {
        const a = (i / nG) * TAU + Math.random() * 0.3
        const x = Math.cos(a) * ring * (0.8 + Math.random() * 0.4)
        const y = Math.sin(a) * ring * (0.8 + Math.random() * 0.4) * 0.72
        const [vx, vy] = orbitVel(x, y, Mt, 0.72)
        galaxies.push(makeGalaxy(x, y, vx, vy, ms[i], PALETTE[i % PALETTE.length], 560, 95, i % 2 === 0 ? 1 : -1))
      }
    } else {
      galaxies.push(makeGalaxy(0, 0, 0, 0, 2200, 210, 4500, 300, 1))
    }
    userCam = false
    fitCamera()
    clearStage()
  }

  // Spacing of folder clusters on the golden-angle sunflower. Larger = clusters
  // sit further apart (and the whole scene zooms out more).
  const CLUSTER_STEP = 340

  function loadSessionsScene(list: SessionInfo[]) {
    mode = 'sessions'
    selectedId = null
    galaxies = []
    sessionClusters = []
    if (!list.length) {
      sceneRadius = 600
      userCam = false
      fitCamera()
      clearStage()
      return
    }

    // Group every session under its project folder.
    const byProject = new Map<string, SessionInfo[]>()
    for (const s of list) {
      const arr = byProject.get(s.project)
      if (arr) arr.push(s)
      else byProject.set(s.project, [s])
    }

    type Folder = { project: string; sessions: SessionInfo[]; recent: number; hasCurrent: boolean }
    const folders: Folder[] = []
    for (const [project, sessions] of byProject) {
      sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      const ci = sessions.findIndex(s => s.isCurrent)
      // The live session anchors the centre of its own cluster.
      if (ci > 0) sessions.unshift(sessions.splice(ci, 1)[0])
      folders.push({ project, sessions, recent: sessions[0].lastActiveAt, hasCurrent: ci >= 0 })
    }
    // Current folder first (placed at the origin), then most-recently-active folders.
    folders.sort((a, b) => Number(b.hasCurrent) - Number(a.hasCurrent) || b.recent - a.recent)

    // Particle budget shared across all sessions on screen.
    let total = 0
    const desired = new Map<string, number>()
    for (const f of folders) {
      for (const s of f.sessions) {
        const d = clamp(Math.round(50 + Math.sqrt(s.messages) * 56), 80, 1800)
        desired.set(s.id, d)
        total += d
      }
    }
    const scale = total > 16000 ? 16000 / total : 1

    let maxRad = 360
    folders.forEach((folder, k) => {
      // Cluster centre: current folder at the origin, the rest spread far apart
      // on a golden-angle sunflower so no two folders overlap.
      let cx = 0
      let cy = 0
      if (k > 0) {
        const ang = k * 2.39996
        const rad = CLUSTER_STEP * Math.sqrt(k)
        cx = Math.cos(ang) * rad
        cy = Math.sin(ang) * rad * 0.82
      }
      const hue = hueFor(folder.project)
      let clusterExtent = 0

      folder.sessions.forEach((s, j) => {
        const n = Math.max(50, Math.round((desired.get(s.id) ?? 80) * scale))
        const m = Math.max(160, n * 0.67)
        const R = 30 + Math.sqrt(n) * 3.4
        const gh = s.isCurrent ? CURRENT_HUE : hue
        // Within a cluster, the most recent session sits at the core; the rest
        // spiral outward around it.
        let srad = 0
        let sang = 0
        if (j > 0) {
          sang = j * 2.39996
          srad = 24 + 26 * Math.sqrt(j)
        }
        const x = cx + Math.cos(sang) * srad
        const y = cy + Math.sin(sang) * srad * 0.8
        const g = makeGalaxy(x, y, 0, 0, m, gh, n, R, j % 2 === 0 ? 1 : -1)
        g.meta = s
        g.orbitCx = cx
        g.orbitCy = cy
        g.orbitRad = srad
        g.orbitAng = sang
        g.orbitW = srad > 0 ? 0.001 / Math.pow(j + 1, 0.3) : 0
        galaxies.push(g)
        clusterExtent = Math.max(clusterExtent, srad + R)
        maxRad = Math.max(maxRad, Math.hypot(x, y) + R)
      })

      sessionClusters.push({
        name: folder.project,
        x: cx,
        y: cy,
        hue,
        count: folder.sessions.length,
        radius: clusterExtent,
      })
    })

    sceneRadius = maxRad
    userCam = false
    fitCamera()
    clearStage()
  }

  function totalParticles() {
    let t = 0
    for (const g of galaxies) t += g.n
    return t
  }

  function trim() {
    while (galaxies.length > MAX_GALAXIES || totalParticles() > MAX_PARTICLES) {
      let idx = -1
      let best = Infinity
      for (let i = 0; i < galaxies.length - 1; i++) {
        if (galaxies[i].m < best) {
          best = galaxies[i].m
          idx = i
        }
      }
      if (idx < 0) break
      galaxies.splice(idx, 1)
    }
  }

  function spawnGalaxy(x: number, y: number, vx: number, vy: number, hue?: number) {
    const m = 520 + Math.random() * 760
    const h = hue ?? PALETTE[Math.floor(Math.random() * PALETTE.length)]
    galaxies.push(makeGalaxy(x, y, vx, vy, m, h, Math.round(m * 0.9), 60 + m * 0.07, Math.random() < 0.5 ? 1 : -1))
    trim()
  }

  function addRandomGalaxy() {
    if (mode === 'sessions') return
    const a = Math.random() * TAU
    const r = (Math.min(W, H) / cam.zoom) * 0.6
    const x = cam.x + Math.cos(a) * r
    const y = cam.y + Math.sin(a) * r
    const tx = cam.x + (Math.random() - 0.5) * 200
    const ty = cam.y + (Math.random() - 0.5) * 200
    const d = Math.hypot(tx - x, ty - y) || 1
    const sp = 0.9 + Math.random() * 1.3
    spawnGalaxy(x, y, ((tx - x) / d) * sp, ((ty - y) / d) * sp)
  }

  const isActive = (g: Galaxy) => g.meta !== undefined && activeIds.has(g.meta.id)

  function stepOnce(h: number) {
    const Geff = G0 * gravMul
    if (mode === 'sessions') {
      simTime += h
      // Cores ride prescribed orbits: stable and calm no matter how many sessions.
      // Each star only feels its own core, so 48 galaxies stay cheap.
      for (const g of galaxies) {
        const act = isActive(g)
        if (g.orbitW !== 0 && g.orbitRad > 0) {
          // Orbit around the folder's cluster centre, not the global origin.
          // Active sessions sprint along their orbit; idle ones drift.
          g.orbitAng += g.orbitW * (act ? 6 : 1) * h
          g.x = g.orbitCx + Math.cos(g.orbitAng) * g.orbitRad
          g.y = g.orbitCy + Math.sin(g.orbitAng) * g.orbitRad * 0.8
        } else if (act) {
          const a = simTime * 0.012
          g.x = g.orbitCx + Math.cos(a) * 16
          g.y = g.orbitCy + Math.sin(a * 1.3) * 12
        } else {
          // Cluster-core session: ease back toward its folder centre.
          g.x += (g.orbitCx - g.x) * 0.05
          g.y += (g.orbitCy - g.y) * 0.05
        }
        // A breathing core mass makes an active disk shimmer and swirl.
        const pulse = act ? 1 + 0.16 * Math.sin(simTime * 0.11) : 1
        const Gm = Geff * g.m * pulse
        const cx = g.x
        const cy = g.y
        const { px, py, pvx, pvy, n } = g
        for (let i = 0; i < n; i++) {
          const dx = cx - px[i]
          const dy = cy - py[i]
          const d2 = dx * dx + dy * dy + SOFT2
          const w = Gm / (d2 * Math.sqrt(d2))
          pvx[i] += dx * w * h
          pvy[i] += dy * w * h
          px[i] += pvx[i] * h
          py[i] += pvy[i] * h
        }
      }
      return
    }
    const cs = galaxies.filter(g => g.m > 0)
    for (const a of cs) {
      // Faint spring toward the origin keeps the whole show from drifting away.
      let ax = -a.x * 2.4e-6
      let ay = -a.y * 2.4e-6
      for (const b of cs) {
        if (b === a) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d2 = dx * dx + dy * dy + 600
        const w = (Geff * b.m) / (d2 * Math.sqrt(d2))
        ax += dx * w
        ay += dy * w
      }
      a.vx += ax * h
      a.vy += ay * h
    }
    for (const a of cs) {
      a.x += a.vx * h
      a.y += a.vy * h
    }
    outer: for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        const a = cs[i]
        const b = cs[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const rvx = b.vx - a.vx
        const rvy = b.vy - a.vy
        if (dx * dx + dy * dy < 170 && rvx * rvx + rvy * rvy < 7) {
          // Slow close pass: merge cores, conserve momentum. The lighter galaxy
          // keeps its particles (and color) as a coreless remnant.
          const big = a.m >= b.m ? a : b
          const sm = big === a ? b : a
          const M = a.m + b.m
          big.x = (a.x * a.m + b.x * b.m) / M
          big.y = (a.y * a.m + b.y * b.m) / M
          big.vx = (a.vx * a.m + b.vx * b.m) / M
          big.vy = (a.vy * a.m + b.vy * b.m) / M
          big.m = M
          sm.m = 0
          break outer
        }
      }
    }
    const ats: Array<{ x: number; y: number; Gm: number }> = []
    for (const g of galaxies) if (g.m > 0) ats.push({ x: g.x, y: g.y, Gm: Geff * g.m })
    const na = ats.length
    for (const g of galaxies) {
      const { px, py, pvx, pvy, n } = g
      for (let i = 0; i < n; i++) {
        let ax = 0
        let ay = 0
        const x = px[i]
        const y = py[i]
        for (let k = 0; k < na; k++) {
          const c = ats[k]
          const dx = c.x - x
          const dy = c.y - y
          const d2 = dx * dx + dy * dy + SOFT2
          const w = c.Gm / (d2 * Math.sqrt(d2))
          ax += dx * w
          ay += dy * w
        }
        pvx[i] += ax * h
        pvy[i] += ay * h
        px[i] += pvx[i] * h
        py[i] += pvy[i] * h
      }
    }
  }

  function step(dt: number) {
    const n = Math.min(4, Math.max(1, Math.ceil(dt / 1.1)))
    const h = dt / n
    for (let k = 0; k < n; k++) stepOnce(h)
    if (frameCount % 90 === 0) {
      for (const g of galaxies) {
        let i = 0
        while (i < g.n) {
          const dx = g.px[i]
          const dy = g.py[i]
          if (dx * dx + dy * dy > WORLD_CULL2) {
            g.n--
            g.px[i] = g.px[g.n]
            g.py[i] = g.py[g.n]
            g.pvx[i] = g.pvx[g.n]
            g.pvy[i] = g.pvy[g.n]
            g.br[i] = g.br[g.n]
          } else {
            i++
          }
        }
      }
      galaxies = galaxies.filter(g => g.m > 0 || g.n > 0)
    }
  }

  function render(now: number) {
    const z = cam.zoom
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const moved = cam.x !== lastCamX || cam.y !== lastCamY || z !== lastZoom
    lastCamX = cam.x
    lastCamY = cam.y
    lastZoom = z
    ctx.globalCompositeOperation = 'source-over'
    // Trails come from fading the previous frame instead of clearing it.
    ctx.fillStyle = `rgba(5, 6, 12, ${moved ? Math.max(fade, 0.5) : fade})`
    ctx.fillRect(0, 0, W, H)
    const t = now * 0.001
    ctx.fillStyle = '#c9d6f0'
    for (const s of stars) {
      const ox = (((s.x - cam.x * z * s.p) % W) + W) % W
      const oy = (((s.y - cam.y * z * s.p) % H) + H) % H
      ctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(t * 1.6 + s.tw))
      ctx.fillRect(ox, oy, s.s, s.s)
    }
    ctx.globalAlpha = 1
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z), dpr * (H / 2 - cam.y * z))
    ctx.globalCompositeOperation = 'lighter'
    const dotA = Math.max(1.8 / Math.sqrt(z), 1.4 / z)
    const dotB = Math.max(2.6 / Math.sqrt(z), 2 / z)
    const hA = dotA / 2
    const hB = dotB / 2
    for (const g of galaxies) {
      const { px, py, br, n } = g
      ctx.fillStyle = g.colDim
      for (let i = 0; i < n; i++) if (!br[i]) ctx.fillRect(px[i] - hA, py[i] - hA, dotA, dotA)
      ctx.fillStyle = g.colBright
      for (let i = 0; i < n; i++) if (br[i]) ctx.fillRect(px[i] - hB, py[i] - hB, dotB, dotB)
    }
    for (const g of galaxies) {
      if (g.m <= 0) continue
      const act = mode === 'sessions' && isActive(g)
      let R = 9 + Math.sqrt(g.m) * 0.34
      if (act) R *= 1.12 + 0.1 * Math.sin(now * 0.004)
      const gr = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, R)
      gr.addColorStop(0, 'rgba(255,255,255,0.9)')
      gr.addColorStop(0.3, g.colCore)
      gr.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gr
      ctx.beginPath()
      ctx.arc(g.x, g.y, R, 0, TAU)
      ctx.fill()
      if (act) {
        ctx.strokeStyle = `hsla(${g.hue}, 90%, 70%, ${0.32 + 0.16 * Math.sin(now * 0.004)})`
        ctx.lineWidth = 1.4 / z
        ctx.beginPath()
        ctx.arc(g.x, g.y, R + 7 + 2 * Math.sin(now * 0.004), 0, TAU)
        ctx.stroke()
      }
    }
    if (throwDrag) {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = `hsla(${throwDrag.hue}, 80%, 75%, 0.9)`
      ctx.lineWidth = 1.5 / z
      ctx.setLineDash([6 / z, 6 / z])
      ctx.beginPath()
      ctx.moveTo(throwDrag.sx, throwDrag.sy)
      ctx.lineTo(throwDrag.x, throwDrag.y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(throwDrag.sx, throwDrag.sy, 18 / z, 0, TAU)
      ctx.stroke()
    }
    if (mode === 'sessions') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.textBaseline = 'middle'

      // Folder labels: one per cluster, centred above the cluster.
      ctx.textAlign = 'center'
      for (const c of sessionClusters) {
        const sx = (c.x - cam.x) * z + W / 2
        const sy = (c.y - cam.y) * z + H / 2
        if (sx < -200 || sx > W + 200 || sy < -160 || sy > H + 160) continue
        // lift the label clear of the cluster's actual spread so it never sits on a galaxy
        const lift = clamp((c.radius + 26) * z, 22, 120)
        ctx.font = '600 13px Inter, system-ui, sans-serif'
        ctx.fillStyle = `hsla(${c.hue}, 72%, 80%, 0.95)`
        ctx.fillText(c.name, sx, sy - lift)
        ctx.font = '500 10px Inter, system-ui, sans-serif'
        ctx.fillStyle = 'rgba(170, 180, 207, 0.6)'
        ctx.fillText(`${c.count} session${c.count === 1 ? '' : 's'}`, sx, sy - lift + 13)
      }

      // Session labels: only for the live, active, or selected galaxies.
      ctx.textAlign = 'left'
      ctx.font = '500 11px Inter, system-ui, sans-serif'
      for (const g of galaxies) {
        if (!g.meta || g.m <= 0) continue
        const isSel = g.meta.id === selectedId
        const act = isActive(g)
        if (!isSel && !act && !g.meta.isCurrent) continue
        const sx = (g.x - cam.x) * z + W / 2
        const sy = (g.y - cam.y) * z + H / 2
        if (sx < -160 || sx > W + 160 || sy < -50 || sy > H + 50) continue
        const coreR = (9 + Math.sqrt(g.m) * 0.34) * z
        if (isSel) {
          ctx.strokeStyle = 'rgba(232, 236, 246, 0.7)'
          ctx.lineWidth = 1
          ctx.setLineDash([4, 4])
          ctx.beginPath()
          ctx.arc(sx, sy, Math.max(coreR + 8, 16), 0, TAU)
          ctx.stroke()
          ctx.setLineDash([])
        }
        let tx = sx + Math.max(coreR, 8) + 8
        if (act) {
          ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now * 0.006)
          ctx.fillStyle = '#7ee787'
          ctx.beginPath()
          ctx.arc(tx + 3, sy, 3, 0, TAU)
          ctx.fill()
          tx += 11
        }
        ctx.globalAlpha = 0.95
        ctx.fillStyle = g.meta.isCurrent ? '#b8f17e' : '#dbe2f2'
        const title = g.meta.title.length > 42 ? g.meta.title.slice(0, 40) + '…' : g.meta.title
        ctx.fillText(g.meta.isCurrent ? 'this session' : title, tx, sy)
      }
      ctx.globalAlpha = 1
      ctx.textAlign = 'left'
    }
  }

  function frame(now: number) {
    if (destroyed) return
    const ms = Math.min(now - last, 34)
    last = now
    if (ms > 0) fps += (1000 / ms - fps) * 0.05
    if (!paused) step((ms / 16.667) * timeScale)
    render(now)
    frameCount++
    raf = requestAnimationFrame(frame)
  }

  function screenToWorld(sx: number, sy: number) {
    return {
      x: cam.x + (sx - W / 2) / cam.zoom,
      y: cam.y + (sy - H / 2) / cam.zoom,
    }
  }

  // offsetX is unreliable for synthetic and emulated-viewport events; derive from clientX.
  function evPos(e: { clientX: number; clientY: number }) {
    const r = canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function applyZoom(f: number, sx: number, sy: number) {
    userCam = true
    const nz = clamp(cam.zoom * f, 0.12, 4)
    const wx = cam.x + (sx - W / 2) / cam.zoom
    const wy = cam.y + (sy - H / 2) / cam.zoom
    cam.zoom = nz
    cam.x = wx - (sx - W / 2) / nz
    cam.y = wy - (sy - H / 2) / nz
  }

  function doSelect(sx: number, sy: number) {
    const wpt = screenToWorld(sx, sy)
    let best: Galaxy | null = null
    let bestD = Infinity
    for (const g of galaxies) {
      if (!g.meta) continue
      const d = Math.hypot(g.x - wpt.x, g.y - wpt.y)
      if (d < bestD) {
        bestD = d
        best = g
      }
    }
    if (best && best.meta && bestD <= Math.max(34 / cam.zoom, best.R * 0.55)) {
      selectedId = best.meta.id
      opts.onSelect?.(best.meta)
    } else {
      selectedId = null
      opts.onSelect?.(null)
    }
  }

  canvas.addEventListener('pointerdown', e => {
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      // Synthetic events have no active pointer to capture; dragging still works.
    }
    const pos = evPos(e)
    pointers.set(e.pointerId, { x: pos.x, y: pos.y })
    if (e.pointerType === 'touch' && pointers.size === 2) {
      throwDrag = null
      clickStart = null
      const [p1, p2] = [...pointers.values()]
      pinchD = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      panLast = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, id: -1 }
      return
    }
    if (e.button === 0) {
      if (mode === 'sessions') {
        // Sessions are a viewer: left-drag pans, a still click selects.
        panLast = { x: pos.x, y: pos.y, id: e.pointerId }
        clickStart = { x: pos.x, y: pos.y, id: e.pointerId, moved: false }
      } else {
        const w = screenToWorld(pos.x, pos.y)
        throwDrag = {
          sx: w.x, sy: w.y, x: w.x, y: w.y,
          hue: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          id: e.pointerId,
        }
      }
    } else {
      panLast = { x: pos.x, y: pos.y, id: e.pointerId }
    }
  }, sig)

  canvas.addEventListener('pointermove', e => {
    const pos = evPos(e)
    const p = pointers.get(e.pointerId)
    if (p) {
      p.x = pos.x
      p.y = pos.y
    }
    if (clickStart && clickStart.id === e.pointerId) {
      if (Math.hypot(pos.x - clickStart.x, pos.y - clickStart.y) > 6) clickStart.moved = true
    }
    if (pointers.size === 2 && panLast && panLast.id === -1) {
      const [p1, p2] = [...pointers.values()]
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
      if (pinchD > 0) applyZoom(d / pinchD, mid.x, mid.y)
      pinchD = d
      cam.x -= (mid.x - panLast.x) / cam.zoom
      cam.y -= (mid.y - panLast.y) / cam.zoom
      panLast.x = mid.x
      panLast.y = mid.y
      return
    }
    if (panLast && panLast.id === e.pointerId) {
      if (!clickStart || clickStart.moved) userCam = true
      cam.x -= (pos.x - panLast.x) / cam.zoom
      cam.y -= (pos.y - panLast.y) / cam.zoom
      panLast.x = pos.x
      panLast.y = pos.y
      return
    }
    if (throwDrag && throwDrag.id === e.pointerId) {
      const w = screenToWorld(pos.x, pos.y)
      throwDrag.x = w.x
      throwDrag.y = w.y
    }
  }, sig)

  function endPointer(e: PointerEvent) {
    pointers.delete(e.pointerId)
    if (panLast && (panLast.id === e.pointerId || (panLast.id === -1 && pointers.size < 2))) {
      panLast = null
    }
    if (clickStart && clickStart.id === e.pointerId) {
      if (!clickStart.moved && e.type === 'pointerup' && mode === 'sessions') {
        const pos = evPos(e)
        doSelect(pos.x, pos.y)
      }
      clickStart = null
    }
    if (throwDrag && throwDrag.id === e.pointerId) {
      if (e.type === 'pointerup') {
        let vx = (throwDrag.x - throwDrag.sx) * 0.016
        let vy = (throwDrag.y - throwDrag.sy) * 0.016
        const sp = Math.hypot(vx, vy)
        if (sp > 4) {
          vx = (vx / sp) * 4
          vy = (vy / sp) * 4
        }
        spawnGalaxy(throwDrag.sx, throwDrag.sy, vx, vy, throwDrag.hue)
        opts.onThrow?.()
      }
      throwDrag = null
    }
  }
  canvas.addEventListener('pointerup', endPointer, sig)
  canvas.addEventListener('pointercancel', endPointer, sig)
  canvas.addEventListener('contextmenu', e => e.preventDefault(), sig)
  canvas.addEventListener('wheel', e => {
    e.preventDefault()
    const pos = evPos(e)
    applyZoom(Math.exp(-e.deltaY * 0.0012), pos.x, pos.y)
  }, { signal: ac.signal, passive: false })

  const ro = new ResizeObserver(() => {
    if (W > 0) {
      fit()
      if (!userCam) fitCamera()
    }
  })
  ro.observe(canvas)

  function boot() {
    if (destroyed) return
    const r = canvas.getBoundingClientRect()
    if (r.width < 100 || r.height < 100) {
      raf = requestAnimationFrame(boot)
      return
    }
    fit()
    setPreset(preset)
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
  boot()

  const statsTimer = window.setInterval(() => {
    let cores = 0
    for (const g of galaxies) if (g.m > 0) cores++
    opts.onStats?.({ stars: totalParticles(), cores, fps: Math.round(fps) })
  }, 500)

  return {
    destroy() {
      destroyed = true
      cancelAnimationFrame(raf)
      window.clearInterval(statsTimer)
      ro.disconnect()
      ac.abort()
    },
    setPaused(p) {
      paused = p
    },
    loadPreset(id) {
      setPreset(id)
    },
    loadSessions(list) {
      loadSessionsScene(list)
    },
    select(id) {
      selectedId = id
    },
    setActivity(ids) {
      activeIds = new Set(ids)
    },
    reset() {
      setPreset(preset)
    },
    addRandomGalaxy,
    setTimeScale(v) {
      timeScale = v
    },
    setGravity(v) {
      gravMul = v
    },
    setTrails(v) {
      fade = 0.62 - 0.56 * v
    },
  }
}
