import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { walls, seats, roomLabels, W, D, WALL_H } from './layout'
import { Board3D, Roulette3D, DeskNotes3D, VoteBox3D, XmasTree, StoryFrame } from './Extras'
import { STORIES, todayStoryIndex } from './stories'
import { lampMats, glowMat } from './Ambience'
import { furniture } from './furniture'
import { wallThickness } from './nav'
import { live, useStore } from './store'
import {
  woodTexture,
  carpetTexture,
  tileTexture,
  concreteTexture,
  labelTexture,
  nameTagTexture,
  deskPlateTexture,
  screenTexture,
} from './textures'

const C = {
  wall: '#f2ede5',
  ext: '#e6dfd3',
  frame: '#8d969c',
  fabric: '#a9bab3',
  cap: '#d8cbb6',
  deskTop: '#e9d8bd',
  deskLeg: '#f4f3ef',
  exec: '#7a5236',
  chair: '#3d4448',
  chairExec: '#5b3a29',
  metal: '#b9bfc4',
  dark: '#2f3437',
}

const FACE_ROT = { N: 0, S: Math.PI, E: -Math.PI / 2, W: Math.PI / 2 }
const faceTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z))

// 공용 지오메트리 박스
function Box({ p, s, c, r, cast = true, recv = true, mat, ...rest }) {
  return (
    <mesh position={p} rotation={r} castShadow={cast} receiveShadow={recv} {...rest}>
      <boxGeometry args={s} />
      {mat || <meshStandardMaterial color={c} roughness={0.75} />}
    </mesh>
  )
}

/* ───────────────────────── 바닥 ───────────────────────── */
function FloorPatch({ x1, z1, x2, z2, map, y = 0.002, color = '#fff', rough = 0.85 }) {
  const w = x2 - x1
  const d = z2 - z1
  return (
    <mesh position={[(x1 + x2) / 2, y, (z1 + z2) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial map={map} color={color} roughness={rough} />
    </mesh>
  )
}

function Floors() {
  const t = useMemo(
    () => ({
      woodL: woodTexture(4.7 / 2, D / 2),
      carpet: carpetTexture(15.5 / 2, D / 2),
      woodR: woodTexture(8.35 / 2, D / 2),
      tile: tileTexture(2.95 / 0.8, 1.9 / 0.8),
      conc: concreteTexture(2, 1),
    }),
    []
  )
  return (
    <group>
      <FloorPatch x1={0} z1={0} x2={4.7} z2={D} map={t.woodL} />
      <FloorPatch x1={4.7} z1={0} x2={20.2} z2={D} map={t.carpet} />
      <FloorPatch x1={4.7} z1={0} x2={10.0} z2={2.6} map={t.conc} y={0.004} />
      <FloorPatch x1={20.2} z1={0} x2={W} z2={D} map={t.woodR} />
      <FloorPatch x1={25.6} z1={7.7} x2={W} z2={D} map={t.tile} y={0.004} rough={0.5} />
      {/* 출입구 매트 */}
      <FloorPatch x1={22.5} z1={8.7} x2={23.9} z2={D - 0.12} color="#5d6b6f" y={0.006} />
      <FloorPatch x1={6.35} z1={8.85} x2={7.25} z2={D - 0.12} color="#5d6b6f" y={0.006} />
      {/* 접견실 러그 */}
      <mesh position={[1.65, 0.006, 7.0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.45, 48]} />
        <meshStandardMaterial color="#c9b79c" roughness={1} />
      </mesh>
    </group>
  )
}

function ClickFloor() {
  // 클릭 이동용 투명 바닥 (실내 전체)
  return (
    <mesh
      position={[W / 2, 0.01, D / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(e) => {
        e.stopPropagation()
        if (!useStore.getState().joined) return
        if (e.delta > 6) return
        window.dispatchEvent(new CustomEvent('floor-click', { detail: { x: e.point.x, z: e.point.z } }))
      }}
    >
      <planeGeometry args={[W, D]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

/* ───────────────────────── 벽 ───────────────────────── */
function Wall({ wl }) {
  const horiz = wl.a[1] === wl.b[1]
  const len = horiz ? Math.abs(wl.b[0] - wl.a[0]) : Math.abs(wl.b[1] - wl.a[1])
  const t = wallThickness(wl.type)
  const cx = (wl.a[0] + wl.b[0]) / 2
  const cz = (wl.a[1] + wl.b[1]) / 2
  const fade = useRef(1)
  const mats = useMemo(() => {
    const m = (color, opacity = 1, extra = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.8, transparent: true, opacity, ...extra })
    return {
      wall: m(wl.type === 'solid' ? C.wall : C.ext),
      frame: m(C.frame, 1, { metalness: 0.4, roughness: 0.4 }),
      glass: m('#cfe6f0', 0.22, { roughness: 0.05, metalness: 0.1, depthWrite: false }),
      fabric: m(C.fabric, 1, { roughness: 1 }),
      cap: m(C.cap, 1, { roughness: 0.6 }),
    }
  }, [wl.type])
  const base = useMemo(() => Object.fromEntries(Object.entries(mats).map(([k, v]) => [k, v.opacity])), [mats])

  useFrame((_, dt) => {
    if (!horiz) return
    const p = live.player
    let target = 1
    if (!live.overview && cz > p.z + 0.05 && cz - p.z < 4.2) {
      const minX = Math.min(wl.a[0], wl.b[0]) - 1.2
      const maxX = Math.max(wl.a[0], wl.b[0]) + 1.2
      if (p.x > minX && p.x < maxX) target = wl.type === 'low' ? 0.35 : 0.12
    }
    const f = THREE.MathUtils.damp(fade.current, target, 8, dt)
    if (Math.abs(f - fade.current) < 1e-4) return
    fade.current = f
    for (const k in mats) {
      mats[k].opacity = base[k] * f
      if (k !== 'glass') mats[k].depthWrite = f > 0.95
    }
  })

  const S = (w, h, extra = 0) => (horiz ? [len + extra, h, w] : [w, h, len + extra])
  const P = (y, off = 0) => (horiz ? [cx + off, y, cz] : [cx, y, cz + off])

  // 일정 간격의 세로 프레임
  const posts = (spacing, h, w, yBase) => {
    const n = Math.max(1, Math.round(len / spacing))
    const out = []
    for (let i = 0; i <= n; i++) {
      const off = -len / 2 + (len * i) / n
      out.push(
        <mesh key={i} position={P(yBase + h / 2, off)} material={mats.frame} castShadow>
          <boxGeometry args={horiz ? [w, h, t * 0.8] : [t * 0.8, h, w]} />
        </mesh>
      )
    }
    return out
  }

  if (wl.type === 'solid' || wl.type === 'extSide') {
    return (
      <group>
        <mesh position={P(WALL_H / 2)} material={mats.wall} castShadow receiveShadow>
          <boxGeometry args={S(t, WALL_H, t)} />
        </mesh>
        <mesh position={P(0.05)} material={mats.cap}>
          <boxGeometry args={S(t + 0.02, 0.1, t)} />
        </mesh>
      </group>
    )
  }
  if (wl.type === 'ext' || wl.type === 'extLow') {
    const sill = 0.9
    const top = wl.type === 'ext' ? 2.35 : 2.4
    return (
      <group>
        <mesh position={P(sill / 2)} material={mats.wall} castShadow receiveShadow>
          <boxGeometry args={S(t, sill, t)} />
        </mesh>
        <mesh position={P(sill + 0.03)} material={mats.cap}>
          <boxGeometry args={S(t + 0.06, 0.06, t)} />
        </mesh>
        <mesh position={P((sill + top) / 2)} material={mats.glass}>
          <boxGeometry args={S(0.02, top - sill, 0)} />
        </mesh>
        {posts(1.6, top - sill, 0.06, sill)}
        {wl.type === 'ext' ? (
          <mesh position={P((top + WALL_H) / 2)} material={mats.wall} castShadow>
            <boxGeometry args={S(t, WALL_H - top, t)} />
          </mesh>
        ) : (
          <mesh position={P(top)} material={mats.frame}>
            <boxGeometry args={S(0.08, 0.06, 0)} />
          </mesh>
        )}
      </group>
    )
  }
  if (wl.type === 'glass') {
    const h = 2.4
    return (
      <group>
        <mesh position={P(0.05)} material={mats.frame}>
          <boxGeometry args={S(0.08, 0.1, 0)} />
        </mesh>
        <mesh position={P(h / 2)} material={mats.glass}>
          <boxGeometry args={S(0.02, h, 0)} />
        </mesh>
        <mesh position={P(h)} material={mats.frame}>
          <boxGeometry args={S(0.08, 0.05, 0)} />
        </mesh>
        <mesh position={P(1.05)} material={mats.frame}>
          <boxGeometry args={S(0.03, 0.12, 0)} />
        </mesh>
        {posts(1.2, h, 0.05, 0)}
      </group>
    )
  }
  // low partition
  const h = wl.h ?? 1.35
  return (
    <group>
      <mesh position={P(h / 2)} material={mats.fabric} castShadow receiveShadow>
        <boxGeometry args={S(t, h, 0)} />
      </mesh>
      <mesh position={P(h + 0.015)} material={mats.cap}>
        <boxGeometry args={S(t + 0.02, 0.03, 0.02)} />
      </mesh>
    </group>
  )
}

/* ───────────────────────── 가구 파츠 ───────────────────────── */
export function Chair({ x, z, rot = 0, color = C.chair, exec = false }) {
  const s = exec ? 1.12 : 1
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]} scale={s}>
      <Box p={[0, 0.46, 0]} s={[0.48, 0.08, 0.46]} c={color} />
      <Box p={[0, 0.82, 0.22]} s={[0.46, exec ? 0.7 : 0.56, 0.07]} c={color} />
      <Box p={[0, 0.6, 0.24]} s={[0.06, 0.24, 0.04]} c={C.dark} />
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.4]} />
        <meshStandardMaterial color={C.metal} metalness={0.6} roughness={0.3} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <Box key={i} p={[Math.sin((i * 2 * Math.PI) / 5) * 0.16, 0.05, Math.cos((i * 2 * Math.PI) / 5) * 0.16]} r={[0, (i * 2 * Math.PI) / 5, 0]} s={[0.04, 0.04, 0.32]} c={C.dark} />
      ))}
    </group>
  )
}

function Monitor({ p, seed }) {
  const map = useMemo(() => screenTexture(seed), [seed])
  return (
    <group position={p}>
      <Box p={[0, 0.015, 0]} s={[0.22, 0.03, 0.16]} c={C.dark} />
      <Box p={[0, 0.17, 0.02]} s={[0.05, 0.3, 0.03]} c={C.dark} />
      <Box p={[0, 0.38, 0]} s={[0.62, 0.38, 0.035]} c="#1e2124" />
      <mesh position={[0, 0.38, 0.019]}>
        <planeGeometry args={[0.58, 0.34]} />
        <meshStandardMaterial map={map} emissive="#ffffff" emissiveMap={map} emissiveIntensity={0.55} roughness={0.3} />
      </mesh>
    </group>
  )
}

function FloatingTag({ x, z, y = 2.05, name, title }) {
  const meName = useStore((s) => (s.me ? s.me.name : null))
  const count = useStore((s) => s.deskNotes.reduce((n, d) => n + (d.seat === name ? 1 : 0), 0))
  const mine = meName === name
  const map = useMemo(() => nameTagTexture(name, title, mine, count), [name, title, mine, count])
  useEffect(() => () => map.dispose(), [map])
  const ref = useRef()
  const phase = useMemo(() => Math.random() * 6, [])
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = y + Math.sin(clock.elapsedTime * 1.6 + phase) * 0.04
  })
  return (
    <sprite ref={ref} position={[x, y, z]} scale={mine ? [1.55, 0.53, 1] : [1.3, 0.45, 1]} renderOrder={20}>
      <spriteMaterial map={map} depthTest={false} transparent />
    </sprite>
  )
}

function Seat({ s, idx }) {
  const rot = FACE_ROT[s.face]
  const w = s.w ?? 1.6
  const d = s.d ?? 0.72
  const plate = useMemo(() => deskPlateTexture(s.name, s.title), [s.name, s.title])
  const top = s.exec ? C.exec : C.deskTop
  const dir = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[s.face]
  // 이름표는 책상과 의자 사이 위쪽에 띄움
  const tagX = s.x - dir[0] * 0.35
  const tagZ = s.z - dir[1] * 0.35
  return (
    <group>
      <group position={[s.x, 0, s.z]} rotation={[0, rot, 0]}>
        {/* 상판 + 다리 */}
        <Box p={[0, 0.72, 0]} s={[w, 0.04, d]} c={top} />
        {s.exec ? (
          <>
            <Box p={[0, 0.36, -d / 2 + 0.06]} s={[w - 0.05, 0.68, 0.04]} c={top} />
            <Box p={[-w / 2 + 0.03, 0.36, 0]} s={[0.04, 0.7, d - 0.02]} c={top} />
            <Box p={[w / 2 - 0.03, 0.36, 0]} s={[0.04, 0.7, d - 0.02]} c={top} />
            <Box p={[w / 2 - 0.3, 0.36, 0.02]} s={[0.5, 0.66, d - 0.15]} c="#6b4730" />
          </>
        ) : (
          <>
            <Box p={[-w / 2 + 0.04, 0.35, 0]} s={[0.04, 0.7, d - 0.06]} c={C.deskLeg} />
            <Box p={[w / 2 - 0.04, 0.35, 0]} s={[0.04, 0.7, d - 0.06]} c={C.deskLeg} />
            <Box p={[0, 0.5, -d / 2 + 0.05]} s={[w - 0.1, 0.3, 0.02]} c={C.deskLeg} />
          </>
        )}
        {/* 모니터 / 키보드 / 마우스 */}
        <Monitor p={[s.exec ? -0.25 : 0, 0.74, -d / 2 + 0.2]} seed={idx} />
        {!s.exec && w > 1.5 && <Monitor p={[0.62, 0.74, -d / 2 + 0.24]} seed={idx + 1} />}
        <Box p={[0, 0.755, 0.1]} s={[0.44, 0.02, 0.14]} c="#e8e8e6" />
        <Box p={[0.32, 0.755, 0.12]} s={[0.06, 0.02, 0.1]} c="#e8e8e6" />
        {/* 머그 / 서류 */}
        <mesh position={[-w / 2 + 0.2, 0.79, 0.1]} castShadow>
          <cylinderGeometry args={[0.04, 0.035, 0.1, 12]} />
          <meshStandardMaterial color={['#e76f51', '#2a9d8f', '#f4a261', '#264653'][idx % 4]} />
        </mesh>
        <Box p={[-w / 2 + 0.35, 0.75, -0.12]} s={[0.3, 0.03, 0.22]} r={[0, 0.2, 0]} c="#fafaf7" />
        {/* 책상 위 명패 (입체) */}
        <group position={[s.exec ? 0.45 : -0.3, 0.8, d / 2 - 0.08]}>
          <mesh rotation={[-0.35, Math.PI, 0]} castShadow>
            <boxGeometry args={[0.36, 0.09, 0.025]} />
            <meshStandardMaterial color="#2d3436" />
          </mesh>
          <mesh position={[0, 0.004, 0.014]} rotation={[-0.35, 0, 0]}>
            <planeGeometry args={[0.35, 0.087]} />
            <meshStandardMaterial map={plate} />
          </mesh>
        </group>
        {/* 책상 스탠드 (야근/노을 모드에서 켜짐) */}
        <DeskLamp x={s.exec ? w / 2 - 0.2 : -w / 2 + 0.16} z={-d / 2 + 0.14} flip={!!s.exec} />
        {/* 모니터 귀퉁이에 붙은 쪽지 */}
        <DeskNotes3D seat={s} mx={s.exec ? -0.25 : 0} mz={-d / 2 + 0.2} rot={rot} />
        {/* 의자 */}
        <Chair x={0} z={d / 2 + 0.38} rot={0} color={s.exec ? C.chairExec : C.chair} exec={s.exec} />
      </group>
      <FloatingTag x={tagX} z={tagZ} name={s.name} title={s.title} y={s.exec ? 2.15 : 2.0} />
    </group>
  )
}

function DeskLamp({ x, z, flip }) {
  const gm = glowMat()
  const sx = flip ? -1 : 1
  return (
    <group position={[x, 0.74, z]} scale={[sx, 1, 1]}>
      <mesh position={[0, 0.012, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.08, 0.024, 16]} />
        <meshStandardMaterial color="#2f3437" />
      </mesh>
      <mesh position={[0.05, 0.2, 0.02]} rotation={[0.25, 0, -0.35]} castShadow>
        <cylinderGeometry args={[0.011, 0.011, 0.4, 8]} />
        <meshStandardMaterial color="#2f3437" />
      </mesh>
      <group position={[0.15, 0.38, 0.08]} rotation={[0.5, 0, -0.9]}>
        <mesh castShadow>
          <coneGeometry args={[0.07, 0.11, 16, 1, true]} />
          <meshStandardMaterial color="#e9c46a" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.03, 0]} material={lampMats.bulb}>
          <sphereGeometry args={[0.03, 10, 10]} />
        </mesh>
      </group>
      <mesh position={[0.25, 0.008, 0.22]} rotation={[-Math.PI / 2, 0, 0]} material={gm} renderOrder={2}>
        <planeGeometry args={[0.85, 0.85]} />
      </mesh>
    </group>
  )
}

function Plant({ x, z, scale = 1 }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.44, 16]} />
        <meshStandardMaterial color="#e8e1d6" roughness={0.6} />
      </mesh>
      {[
        [0, 0.75, 0, 0.28],
        [0.12, 0.95, 0.05, 0.22],
        [-0.1, 1.05, -0.06, 0.2],
        [0.02, 1.22, 0.02, 0.16],
      ].map(([px, py, pz, r], i) => (
        <mesh key={i} position={[px, py, pz]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={i % 2 ? '#5e8c61' : '#4a7c59'} flatShading roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 0.3]} />
        <meshStandardMaterial color="#6b4f3a" />
      </mesh>
    </group>
  )
}

function Bookshelf({ f }) {
  const alongZ = f.d > f.w
  const L = alongZ ? f.d : f.w
  const depth = alongZ ? f.w : f.d
  const h = f.h ?? 2
  const books = useMemo(() => {
    const out = []
    const cols = ['#c0392b', '#2c3e50', '#d35400', '#16a085', '#8e44ad', '#f1c40f', '#7f8c8d', '#ecf0f1', '#34495e']
    let seed = Math.floor(f.x * 100 + f.z * 7)
    const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
    const levels = Math.floor(h / 0.4)
    for (let lv = 0; lv < levels; lv++) {
      let u = -L / 2 + 0.05
      while (u < L / 2 - 0.1) {
        const bw = 0.04 + r() * 0.05
        const bh = 0.22 + r() * 0.1
        if (r() > 0.12) out.push({ u: u + bw / 2, y: 0.05 + lv * 0.4 + bh / 2 + 0.02, bw, bh, c: cols[Math.floor(r() * cols.length)] })
        u += bw + 0.005
      }
    }
    return out
  }, [f.x, f.z, L, h])
  return (
    <group position={[f.x, 0, f.z]} rotation={[0, alongZ ? Math.PI / 2 : 0, 0]}>
      <Box p={[0, h / 2, -depth / 2 + 0.02]} s={[L, h, 0.03]} c="#d7c6aa" />
      <Box p={[-L / 2, h / 2, 0]} s={[0.04, h, depth]} c="#c4ad8a" />
      <Box p={[L / 2, h / 2, 0]} s={[0.04, h, depth]} c="#c4ad8a" />
      {Array.from({ length: Math.floor(h / 0.4) + 1 }).map((_, i) => (
        <Box key={i} p={[0, 0.03 + i * 0.4, 0]} s={[L, 0.03, depth]} c="#c4ad8a" />
      ))}
      {books.map((b, i) => (
        <Box key={i} p={[b.u, b.y, 0]} s={[b.bw, b.bh, depth * 0.75]} c={b.c} cast={false} />
      ))}
    </group>
  )
}

function Table({ x, z, w, d, h = 0.74, top = C.deskTop, leg = '#4a4f52' }) {
  return (
    <group position={[x, 0, z]}>
      <Box p={[0, h, 0]} s={[w, 0.05, d]} c={top} />
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([a, b], i) => (
        <Box key={i} p={[a * (w / 2 - 0.08), h / 2, b * (d / 2 - 0.08)]} s={[0.05, h, 0.05]} c={leg} />
      ))}
    </group>
  )
}

function ArchModel({ x, z }) {
  // 설계사무소 느낌의 화이트 건축 모형
  const blocks = [
    [0, 0.06, 0, 0.5, 0.12, 0.4],
    [-0.12, 0.2, -0.05, 0.22, 0.18, 0.26],
    [0.13, 0.27, 0.05, 0.18, 0.32, 0.2],
    [-0.05, 0.36, 0.08, 0.12, 0.14, 0.12],
  ]
  return (
    <group position={[x, 0.765, z]}>
      <Box p={[0, 0.01, 0]} s={[0.7, 0.02, 0.6]} c="#c9b28a" />
      {blocks.map(([bx, by, bz, w, h, d], i) => (
        <Box key={i} p={[bx, by + 0.02, bz]} s={[w, h, d]} c="#fbfaf6" />
      ))}
      <mesh position={[0.25, 0.08, -0.2]} castShadow>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#7aa874" />
      </mesh>
    </group>
  )
}

function Furniture({ f }) {
  switch (f.type) {
    case 'plant':
      return <Plant x={f.x} z={f.z} />
    case 'bookshelf':
      return <Bookshelf f={f} />
    case 'pillar':
      return <Box p={[f.x, WALL_H / 2, f.z]} s={[f.w, WALL_H, f.d]} c="#e4ddd1" />
    case 'meetingTable':
      return (
        <group>
          <Table x={f.x} z={f.z} w={f.w} d={f.d} top="#f3ece0" />
          {[-0.45, 0.45].map((o) => (
            <group key={o}>
              <Chair x={f.x + o} z={f.z - 0.75} rot={Math.PI} color="#7c8a8f" />
              <Chair x={f.x + o} z={f.z + 0.75} rot={0} color="#7c8a8f" />
            </group>
          ))}
          <Box p={[f.x - 0.3, 0.78, f.z]} s={[0.42, 0.01, 0.3]} c="#ffffff" />
        </group>
      )
    case 'roundTable':
      return (
        <group>
          <mesh position={[f.x, 0.74, f.z]} castShadow receiveShadow>
            <cylinderGeometry args={[0.6, 0.6, 0.05, 40]} />
            <meshStandardMaterial color="#f3ece0" />
          </mesh>
          <mesh position={[f.x, 0.37, f.z]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.72]} />
            <meshStandardMaterial color="#4a4f52" />
          </mesh>
          <mesh position={[f.x, 0.02, f.z]}>
            <cylinderGeometry args={[0.3, 0.3, 0.04, 24]} />
            <meshStandardMaterial color="#4a4f52" />
          </mesh>
          {[45, 135, 225, 315].map((a) => {
            const r = (a * Math.PI) / 180
            const cx = f.x + Math.cos(r) * 0.95
            const cz = f.z + Math.sin(r) * 0.95
            return <Chair key={a} x={cx} z={cz} rot={faceTo(cx, cz, f.x, f.z)} color="#c98b5e" />
          })}
          <mesh position={[f.x, 0.85, f.z]} castShadow>
            <cylinderGeometry args={[0.05, 0.07, 0.18, 12]} />
            <meshStandardMaterial color="#fafafa" />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[f.x + Math.cos(i * 2) * 0.05, 0.99, f.z + Math.sin(i * 2) * 0.05]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color={['#f6bd60', '#f28482', '#f5cac3'][i]} />
            </mesh>
          ))}
        </group>
      )
    case 'credenza':
      return (
        <group>
          <Box p={[f.x, 0.35, f.z]} s={[f.w, 0.7, f.d]} c="#8a6244" />
          <Box p={[f.x - 0.4, 0.86, f.z]} s={[0.3, 0.32, 0.03]} c="#2f3437" />
          <Box p={[f.x - 0.4, 0.86, f.z - 0.02]} s={[0.25, 0.26, 0.01]} c="#a8c5da" />
          <Plant x={f.x + 0.5} z={f.z} scale={0.45} />
        </group>
      )
    case 'rack':
      return (
        <group position={[f.x, 0, f.z]}>
          {[0.05, 0.6, 1.15, 1.7, 2.05].map((y, i) => (
            <Box key={i} p={[0, y, 0]} s={[f.w, 0.03, f.d]} c="#9aa3a8" />
          ))}
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([a, b], i) => (
            <Box key={i} p={[(a * (f.w - 0.04)) / 2, f.h / 2, (b * (f.d - 0.04)) / 2]} s={[0.04, f.h, 0.04]} c="#6f787d" />
          ))}
          {[0.05, 0.6, 1.15, 1.7].flatMap((y, i) =>
            Array.from({ length: Math.max(1, Math.floor(Math.max(f.w, f.d) / 0.55)) }).map((_, k) => {
              const n = Math.max(1, Math.floor(Math.max(f.w, f.d) / 0.55))
              const u = -Math.max(f.w, f.d) / 2 + (k + 0.5) * (Math.max(f.w, f.d) / n)
              if ((i + k) % 3 === 2) return null
              return (
                <Box key={`${i}-${k}`} p={f.w > f.d ? [u, y + 0.2, 0] : [0, y + 0.2, u]} s={[0.42, 0.36, 0.36]} c={(i + k) % 2 ? '#c8a27a' : '#b98f62'} />
              )
            })
          )}
        </group>
      )
    case 'boxes':
      return (
        <group position={[f.x, 0, f.z]}>
          <Box p={[0, 0.22, 0]} s={[f.w, 0.44, f.d]} c="#c49a6c" />
          <Box p={[0.02, 0.6, 0]} s={[f.w * 0.85, 0.32, f.d * 0.85]} r={[0, 0.15, 0]} c="#b98f62" />
          <Box p={[0, 0.445, 0]} s={[f.w * 1.001, 0.01, 0.06]} c="#e0c9a6" cast={false} />
        </group>
      )
    case 'rolls':
      return (
        <group position={[f.x, 0, f.z]}>
          <mesh position={[0, 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.22, 0.6, 20, 1, true]} />
            <meshStandardMaterial color="#5d6b6f" side={THREE.DoubleSide} />
          </mesh>
          {Array.from({ length: 9 }).map((_, i) => (
            <mesh key={i} position={[Math.cos(i * 2.4) * 0.12, 0.55, Math.sin(i * 2.4) * 0.12]} rotation={[Math.sin(i) * 0.15, 0, Math.cos(i) * 0.15]} castShadow>
              <cylinderGeometry args={[0.035, 0.035, 0.9, 10]} />
              <meshStandardMaterial color={i % 3 ? '#f4f1e8' : '#cfe0ea'} />
            </mesh>
          ))}
        </group>
      )
    case 'consultDesk':
      return (
        <group>
          <Table x={f.x} z={f.z} w={f.w} d={f.d} top={C.deskTop} leg="#e9e7e2" />
          <Chair x={f.x} z={f.z - 0.75} rot={Math.PI} />
          <Chair x={f.x - 0.45} z={f.z + 0.75} rot={0} color="#7c8a8f" />
          <Chair x={f.x + 0.45} z={f.z + 0.75} rot={0} color="#7c8a8f" />
          <group position={[f.x, 0.765, f.z - 0.1]}>
            <Box p={[0, 0.01, 0]} s={[0.36, 0.02, 0.24]} c="#c9ccd0" />
            <Box p={[0, 0.12, -0.12]} r={[-0.25, 0, 0]} s={[0.36, 0.24, 0.015]} c="#c9ccd0" />
          </group>
          <Box p={[f.x + 0.6, 0.77, f.z + 0.1]} s={[0.6, 0.01, 0.42]} r={[0, -0.1, 0]} c="#f8f6f0" />
        </group>
      )
    case 'longTable':
      return (
        <group>
          <Table x={f.x} z={f.z} w={f.w} d={f.d} top="#efe3cf" />
          {[-1.35, -0.45, 0.45, 1.35].map((o) => (
            <group key={o}>
              <Chair x={f.x - 0.85} z={f.z + o} rot={-Math.PI / 2} color="#56707a" />
              <Chair x={f.x + 0.85} z={f.z + o} rot={Math.PI / 2} color="#56707a" />
            </group>
          ))}
          <ArchModel x={f.x} z={f.z - 0.6} />
          <Box p={[f.x, 0.77, f.z + 0.7]} s={[0.84, 0.005, 0.6]} c="#f6f4ee" />
          <Box p={[f.x + 0.05, 0.776, f.z + 0.72]} s={[0.5, 0.002, 0.35]} c="#9fc3d8" cast={false} />
          <mesh position={[f.x - 0.25, 0.8, f.z + 1.3]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.6, 10]} />
            <meshStandardMaterial color="#f4f1e8" />
          </mesh>
        </group>
      )
    case 'printer':
      return (
        <group position={[f.x, 0, f.z]}>
          <Box p={[0, 0.45, 0]} s={[f.w, 0.9, f.d]} c="#e8e8e6" />
          <Box p={[0, 0.93, 0]} s={[f.w * 0.9, 0.06, f.d * 0.8]} c="#3a3f42" />
          <Box p={[-0.32, 0.7, 0]} s={[0.03, 0.04, 0.3]} c="#ffffff" />
          <Box p={[0.15, 0.97, 0.15]} s={[0.2, 0.02, 0.1]} c="#54c7a0" />
        </group>
      )
    case 'cabinet':
      return (
        <group position={[f.x, 0, f.z]}>
          <Box p={[0, f.h / 2, 0]} s={[f.w, f.h, f.d]} c="#efece6" />
          <Box p={[0, f.h + 0.01, 0]} s={[f.w + 0.02, 0.02, f.d + 0.02]} c={C.deskTop} />
          {f.d > 1.5 && (
            <>
              <Plant x={0} z={-f.d / 2 + 0.3} scale={0.45} />
              {[0, 1, 2, 3].map((i) => (
                <Box key={i} p={[0, f.h + 0.13, -0.2 + i * 0.07]} s={[0.25, 0.24, 0.05]} c={['#2a9d8f', '#e76f51', '#264653', '#e9c46a'][i]} />
              ))}
            </>
          )}
        </group>
      )
    case 'whiteboard':
      return (
        <group position={[f.x, 0, f.z]}>
          <Box p={[0, 1.5, 0]} s={[f.w, 1.1, 0.04]} c="#fdfdfb" />
          <Box p={[0, 0.93, 0.05]} s={[f.w, 0.03, 0.08]} c="#9aa3a8" />
          <Box p={[-0.4, 1.7, 0.025]} s={[0.7, 0.01, 0.001]} c="#3a6ea5" cast={false} />
          <Box p={[-0.2, 1.55, 0.025]} s={[1.1, 0.01, 0.001]} c="#3a6ea5" cast={false} />
          <Box p={[0.5, 1.35, 0.025]} s={[0.5, 0.3, 0.001]} c="#e07a5f" cast={false} mat={<meshBasicMaterial color="#e07a5f" wireframe />} />
        </group>
      )
    case 'sofa':
      return (
        <group position={[f.x, 0, f.z]}>
          <Box p={[0, 0.22, 0]} s={[f.w, 0.44, f.d]} c="#3f7d7a" />
          <Box p={[f.w / 2 - 0.1, 0.6, 0]} s={[0.2, 0.55, f.d]} c="#356b68" />
          <Box p={[0, 0.5, -f.d / 2 + 0.08]} s={[f.w, 0.35, 0.16]} c="#356b68" />
          <Box p={[0, 0.5, f.d / 2 - 0.08]} s={[f.w, 0.35, 0.16]} c="#356b68" />
          <Box p={[-0.05, 0.5, -0.4]} s={[0.15, 0.3, 0.3]} r={[0, 0, -0.3]} c="#f2cc8f" />
        </group>
      )
    case 'coffeeTable':
      return <Table x={f.x} z={f.z} w={f.w} d={f.d} h={0.4} top="#e9d8bd" />
    case 'counter':
      return <PantryCounter f={f} />
    case 'fridge':
      return (
        <group position={[f.x, 0, f.z]}>
          <Box p={[0, 0.9, 0]} s={[f.w, 1.8, f.d]} c="#dfe3e6" />
          <Box p={[-f.w / 2 - 0.01, 1.2, 0]} s={[0.02, 0.01, f.d]} c="#aab2b8" cast={false} />
          <Box p={[-f.w / 2 - 0.03, 1.45, 0.2]} s={[0.03, 0.4, 0.03]} c="#7d868c" />
          <Box p={[-f.w / 2 - 0.03, 0.85, 0.2]} s={[0.03, 0.4, 0.03]} c="#7d868c" />
        </group>
      )
    default:
      return null
  }
}

function PantryCounter({ f }) {
  return (
    <group position={[f.x, 0, f.z]}>
      <Box p={[0, 0.43, 0]} s={[f.w, 0.86, f.d]} c="#f4f1ea" />
      <Box p={[0, 0.88, 0]} s={[f.w + 0.02, 0.04, f.d + 0.02]} c="#d9d4ca" />
      {/* 서랍 라인 */}
      {[-0.9, -0.3, 0.3, 0.9].map((u) => (
        <Box key={u} p={[u, 0.6, -f.d / 2 - 0.005]} s={[0.25, 0.02, 0.01]} c="#b8b2a7" cast={false} />
      ))}
      {/* 싱크 */}
      <Box p={[-0.85, 0.895, 0]} s={[0.55, 0.012, 0.36]} c="#9aa3a8" mat={<meshStandardMaterial color="#9aa3a8" metalness={0.8} roughness={0.25} />} />
      <group position={[-0.85, 0.9, 0.18]}>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.015, 0.02, 0.3]} />
          <meshStandardMaterial color="#c9ced2" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.3, -0.07]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.16]} />
          <meshStandardMaterial color="#c9ced2" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
      {/* 커피머신 */}
      <group position={[0.15, 0.9, 0.02]}>
        <Box p={[0, 0.2, 0]} s={[0.32, 0.4, 0.36]} c="#2b2d2f" />
        <Box p={[0, 0.42, 0]} s={[0.34, 0.04, 0.38]} c="#b0b6ba" />
        <Box p={[0, 0.06, -0.12]} s={[0.22, 0.04, 0.12]} c="#55595c" />
        <Box p={[0, 0.3, -0.185]} s={[0.12, 0.06, 0.01]} c="#7fd1ff" mat={<meshStandardMaterial color="#7fd1ff" emissive="#4fb3e8" emissiveIntensity={0.8} />} />
        <mesh position={[0, 0.12, -0.12]}>
          <cylinderGeometry args={[0.035, 0.03, 0.08, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>
      {/* 머그 */}
      {[0.55, 0.68].map((u, i) => (
        <mesh key={u} position={[u, 0.95, -0.1]} castShadow>
          <cylinderGeometry args={[0.04, 0.035, 0.1, 12]} />
          <meshStandardMaterial color={i ? '#f4a261' : '#ffffff'} />
        </mesh>
      ))}
      {/* 간식 바구니 */}
      <group position={[1.0, 0.9, 0]}>
        <mesh position={[0, 0.06, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.14, 0.12, 16]} />
          <meshStandardMaterial color="#c99a5b" roughness={1} />
        </mesh>
        {[
          ['#e63946', 0.06, 0.02],
          ['#f1c40f', -0.05, 0.04],
          ['#2a9d8f', 0.0, -0.07],
          ['#8d5524', -0.07, -0.03],
        ].map(([c, a, b], i) => (
          <Box key={i} p={[a, 0.15, b]} r={[0.3, i, 0.2]} s={[0.1, 0.05, 0.07]} c={c} />
        ))}
      </group>
    </group>
  )
}

/* ───────────────────────── 문 ───────────────────────── */
function SwingDoor({ hinge, len, closedRot, openRot, glass = true, auto = true }) {
  const ref = useRef()
  useFrame((_, dt) => {
    if (!ref.current) return
    const p = live.player
    const near = auto && Math.hypot(p.x - (hinge[0] + Math.cos(closedRot) * len * 0.5), p.z - hinge[1]) < 2.3
    const target = near || !auto ? openRot : closedRot
    ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, target, 5, dt)
  })
  return (
    <group ref={ref} position={[hinge[0], 0, hinge[1]]} rotation={[0, auto ? closedRot : openRot, 0]}>
      {glass ? (
        <>
          <mesh position={[len / 2, 1.1, 0]}>
            <boxGeometry args={[len - 0.08, 2.1, 0.02]} />
            <meshStandardMaterial color="#cfe6f0" transparent opacity={0.3} roughness={0.05} depthWrite={false} />
          </mesh>
          {[0.04, len - 0.04].map((u) => (
            <Box key={u} p={[u, 1.1, 0]} s={[0.06, 2.2, 0.05]} c={C.frame} />
          ))}
          <Box p={[len / 2, 0.04, 0]} s={[len, 0.08, 0.05]} c={C.frame} />
          <Box p={[len / 2, 2.17, 0]} s={[len, 0.06, 0.05]} c={C.frame} />
          <Box p={[len - 0.14, 1.05, 0.05]} s={[0.03, 0.5, 0.03]} c="#d9d9d9" />
        </>
      ) : (
        <>
          <Box p={[len / 2, 1.05, 0]} s={[len, 2.1, 0.04]} c="#c9a77c" />
          <Box p={[len - 0.1, 1.0, 0.04]} s={[0.1, 0.03, 0.03]} c="#8c8c8c" />
        </>
      )}
    </group>
  )
}

function Doors() {
  const H = Math.PI / 2
  return (
    <group>
      {/* 주출입구 양문형 유리문 (바깥쪽으로 열림) */}
      <SwingDoor hinge={[22.4, D]} len={0.8} closedRot={0} openRot={-H * 0.95} />
      <SwingDoor hinge={[24.0, D]} len={0.8} closedRot={Math.PI} openRot={Math.PI + H * 0.95} />
      {/* 부출입구 */}
      <SwingDoor hinge={[6.3, D]} len={1.0} closedRot={0} openRot={-H * 0.95} />
      {/* 실내 문 (열린 상태) */}
      <SwingDoor hinge={[4.7, 3.3]} len={0.9} openRot={0.05} glass={false} auto={false} />
      {/* 변소영 대표님실 유리 양문 */}
      <SwingDoor hinge={[4.7, 5.2]} len={0.7} openRot={0.12} auto={false} />
      <SwingDoor hinge={[4.7, 6.6]} len={0.7} openRot={-0.12} auto={false} />
      <SwingDoor hinge={[6.9, 2.6]} len={0.9} openRot={-H} glass={false} auto={false} />
      <SwingDoor hinge={[25.5, 7.7]} len={0.95} openRot={H} glass={false} auto={false} />
    </group>
  )
}

function Labels() {
  return roomLabels.map((l) => <FloorLabel key={l.text} {...l} />)
}
function FloorLabel({ text, x, z, big }) {
  const map = useMemo(() => labelTexture(text, big), [text, big])
  const w = big ? 3.4 : 2.4
  return (
    <mesh position={[x, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, w / 4]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} />
    </mesh>
  )
}

export default function Office() {
  return (
    <group>
      <Floors />
      <ClickFloor />
      {walls.map((wl, i) => (
        <Wall key={i} wl={wl} />
      ))}
      {seats.map((s, i) => (
        <Seat key={s.name} s={s} idx={i} />
      ))}
      {furniture.map((f, i) => (
        <Furniture key={i} f={f} />
      ))}
      {/* 박재경 전무석 손님 의자 */}
      <Chair x={7.75} z={6.85} rot={0} color="#7c8a8f" />
      <Chair x={8.65} z={6.85} rot={0} color="#7c8a8f" />
      {/* 한상우 부장석 손님 의자 */}
      <Chair x={18.3} z={7.7} rot={Math.PI / 2 + 0.3} color="#7c8a8f" />
      <Doors />
      <Labels />
      <Board3D />
      <Roulette3D />
      <VoteBox3D />
      {/* 🎄 설계실 오른쪽, 관리부로 가는 유리 파티션 옆 */}
      <XmasTree x={19.55} z={6.8} />
      {/* 🏛️ 탕비실 북쪽 벽 액자 */}
      <StoryFrame x={26.55} z={7.765} story={STORIES[todayStoryIndex()]} />
    </group>
  )
}
