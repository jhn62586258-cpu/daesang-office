import { walls, seats, W, D } from './layout'
import { furniture } from './furniture'

export const RADIUS = 0.26

export function wallThickness(type) {
  return type === 'ext' || type === 'extSide' || type === 'extLow' ? 0.22 : type === 'solid' ? 0.12 : 0.07
}

export function deskRect(s) {
  const w = s.w ?? 1.6
  const d = s.d ?? 0.72
  const horiz = s.face === 'N' || s.face === 'S'
  return horiz ? { x1: s.x - w / 2, x2: s.x + w / 2, z1: s.z - d / 2, z2: s.z + d / 2 } : { x1: s.x - d / 2, x2: s.x + d / 2, z1: s.z - w / 2, z2: s.z + w / 2 }
}

// 축 정렬 장애물 사각형 목록
export const obstacles = []
for (const wl of walls) {
  const t = wallThickness(wl.type) / 2
  obstacles.push({
    x1: Math.min(wl.a[0], wl.b[0]) - t,
    x2: Math.max(wl.a[0], wl.b[0]) + t,
    z1: Math.min(wl.a[1], wl.b[1]) - t,
    z2: Math.max(wl.a[1], wl.b[1]) + t,
  })
}
for (const s of seats) obstacles.push(deskRect(s))
for (const f of furniture) {
  if (f.type === 'whiteboard') continue
  const shrink = f.type === 'plant' ? 0.08 : 0
  obstacles.push({ x1: f.x - f.w / 2 + shrink, x2: f.x + f.w / 2 - shrink, z1: f.z - f.d / 2 + shrink, z2: f.z + f.d / 2 - shrink })
}

export function isFree(x, z, r = RADIUS) {
  if (x < r || z < r || x > W - r || z > D - r) return false
  for (const o of obstacles) {
    // 원-사각형 충돌
    const cx = Math.max(o.x1, Math.min(x, o.x2))
    const cz = Math.max(o.z1, Math.min(z, o.z2))
    const dx = x - cx
    const dz = z - cz
    if (dx * dx + dz * dz < r * r) return false
  }
  return true
}

// ── A* 경로 탐색 그리드
const CELL = 0.15
const GW = Math.ceil(W / CELL)
const GD = Math.ceil(D / CELL)
const grid = new Uint8Array(GW * GD)
for (let j = 0; j < GD; j++)
  for (let i = 0; i < GW; i++) grid[j * GW + i] = isFree((i + 0.5) * CELL, (j + 0.5) * CELL, RADIUS + 0.03) ? 1 : 0

const toCell = (x, z) => [Math.min(GW - 1, Math.max(0, Math.floor(x / CELL))), Math.min(GD - 1, Math.max(0, Math.floor(z / CELL)))]
const center = (i, j) => [(i + 0.5) * CELL, (j + 0.5) * CELL]
const ok = (i, j) => i >= 0 && j >= 0 && i < GW && j < GD && grid[j * GW + i] === 1

function nearestFree(i, j) {
  if (ok(i, j)) return [i, j]
  for (let r = 1; r < 40; r++) {
    let best = null
    let bd = Infinity
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue
        if (ok(i + di, j + dj)) {
          const d = di * di + dj * dj
          if (d < bd) (bd = d), (best = [i + di, j + dj])
        }
      }
    if (best) return best
  }
  return null
}

function lineFree(ax, az, bx, bz) {
  const dist = Math.hypot(bx - ax, bz - az)
  const steps = Math.ceil(dist / (CELL * 0.5))
  for (let s = 1; s <= steps; s++) {
    const t = s / steps
    const [i, j] = toCell(ax + (bx - ax) * t, az + (bz - az) * t)
    if (!ok(i, j)) return false
  }
  return true
}

export function findPath(sx, sz, tx, tz) {
  const s = nearestFree(...toCell(sx, sz))
  const t = nearestFree(...toCell(tx, tz))
  if (!s || !t) return null
  const N = GW * GD
  const g = new Float32Array(N).fill(Infinity)
  const came = new Int32Array(N).fill(-1)
  const closed = new Uint8Array(N)
  const heap = [] // [f, idx]
  const push = (f, idx) => {
    heap.push([f, idx])
    let c = heap.length - 1
    while (c > 0) {
      const p = (c - 1) >> 1
      if (heap[p][0] <= heap[c][0]) break
      ;[heap[p], heap[c]] = [heap[c], heap[p]]
      c = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length) {
      heap[0] = last
      let c = 0
      for (;;) {
        const l = 2 * c + 1
        const r = l + 1
        let m = c
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === c) break
        ;[heap[m], heap[c]] = [heap[c], heap[m]]
        c = m
      }
    }
    return top
  }
  const h = (i, j) => Math.hypot(i - t[0], j - t[1])
  const si = s[1] * GW + s[0]
  const ti = t[1] * GW + t[0]
  g[si] = 0
  push(h(s[0], s[1]), si)
  const nb = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]
  while (heap.length) {
    const [, cur] = pop()
    if (cur === ti) break
    if (closed[cur]) continue
    closed[cur] = 1
    const ci = cur % GW
    const cj = (cur / GW) | 0
    for (const [di, dj, c] of nb) {
      const ni = ci + di
      const nj = cj + dj
      if (!ok(ni, nj)) continue
      if (di && dj && (!ok(ci + di, cj) || !ok(ci, cj + dj))) continue
      const n = nj * GW + ni
      const ng = g[cur] + c
      if (ng < g[n]) {
        g[n] = ng
        came[n] = cur
        push(ng + h(ni, nj), n)
      }
    }
  }
  if (came[ti] === -1 && ti !== si) return null
  const cells = []
  for (let c = ti; c !== -1; c = came[c]) cells.push(center(c % GW, (c / GW) | 0))
  cells.reverse()
  // 목적지가 갈 수 있는 곳이면 정확한 클릭 지점으로
  if (isFree(tx, tz)) cells[cells.length - 1] = [tx, tz]
  // 시야선 기반 경로 단순화
  const out = [[sx, sz]]
  let k = 0
  while (k < cells.length - 1) {
    let far = k + 1
    const [ax, az] = k === 0 ? [sx, sz] : cells[k]
    for (let m = cells.length - 1; m > k + 1; m--) {
      if (lineFree(ax, az, cells[m][0], cells[m][1])) {
        far = m
        break
      }
    }
    out.push(cells[far])
    k = far
  }
  return out.slice(1)
}
