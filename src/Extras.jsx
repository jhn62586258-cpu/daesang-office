import { useMemo, useRef, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOARD, ROULETTE } from './layout'
import { live, useStore } from './store'
import { RESTAURANTS, WHEEL_COLORS } from './restaurants'
import { noteAuthor, kstToday, ddayLabel } from './notes'

const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif'

function makeTex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// 한글은 글자 단위 줄바꿈
export function wrapText(g, text, maxW, maxLines) {
  const lines = []
  let cur = ''
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(cur)
      cur = ''
      continue
    }
    if (g.measureText(cur + ch).width > maxW && cur) {
      lines.push(cur)
      cur = ch.trimStart()
    } else cur += ch
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'
  }
  return lines
}

function noteTexture(note) {
  return makeTex(256, 256, (g) => {
    g.fillStyle = note.color
    g.fillRect(0, 0, 256, 256)
    const grd = g.createLinearGradient(0, 0, 0, 256)
    grd.addColorStop(0, 'rgba(0,0,0,0.06)')
    grd.addColorStop(0.15, 'rgba(0,0,0,0)')
    grd.addColorStop(1, 'rgba(0,0,0,0.08)')
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = '#2d2a26'
    g.font = `700 30px ${FONT}`
    g.textBaseline = 'top'
    const lines = wrapText(g, note.text, 220, 5)
    lines.forEach((l, i) => g.fillText(l, 18, 30 + i * 38))
    g.font = `600 20px ${FONT}`
    g.fillStyle = 'rgba(45,42,38,0.65)'
    g.textAlign = 'right'
    g.fillText(`- ${noteAuthor(note)}`, 238, 222)
  })
}

function Note3D({ note, pos }) {
  const map = useMemo(() => noteTexture(note), [note.id, note.text, note.color, note.anon, note.name])
  useEffect(() => () => map.dispose(), [map])
  const ref = useRef()
  const hover = useRef(false)
  useFrame((_, dt) => {
    if (!ref.current) return
    const s = THREE.MathUtils.damp(ref.current.scale.x, hover.current ? 1.18 : 1, 12, dt)
    ref.current.scale.setScalar(s)
  })
  return (
    <group position={pos} rotation={[0, 0, note.tilt || 0]}>
      <mesh
        ref={ref}
        castShadow
        onClick={(e) => {
          e.stopPropagation()
          useStore.getState().set({ modal: { note } })
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          hover.current = true
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          hover.current = false
          document.body.style.cursor = ''
        }}
      >
        <planeGeometry args={[0.27, 0.27]} />
        <meshStandardMaterial map={map} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.11, 0.015]}>
        <sphereGeometry args={[0.018, 10, 10]} />
        <meshStandardMaterial color={note.color === '#ff8787' ? '#2f9e44' : '#e03131'} roughness={0.3} />
      </mesh>
    </group>
  )
}

// 회의 데스크 옆 창고 벽면의 코르크 게시판
export function Board3D() {
  const notes = useStore((s) => s.notes)
  const { x, z, w, h, y } = BOARD
  const cork = useMemo(
    () =>
      makeTex(512, 256, (g) => {
        g.fillStyle = '#c69c6d'
        g.fillRect(0, 0, 512, 256)
        let seed = 7
        const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
        for (let i = 0; i < 5000; i++) {
          const v = r()
          g.fillStyle = v > 0.5 ? 'rgba(120,80,40,0.35)' : 'rgba(235,200,150,0.35)'
          g.fillRect(r() * 512, r() * 256, 2, 2)
        }
      }),
    []
  )
  const sign = useMemo(
    () =>
      makeTex(1024, 160, (g) => {
        g.fillStyle = '#2f3e46'
        g.beginPath()
        g.roundRect(8, 8, 1008, 144, 40)
        g.fill()
        g.fillStyle = '#ffd43b'
        g.font = `800 84px ${FONT}`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText('📌 사내 자유 게시판', 512, 84)
      }),
    []
  )
  const cols = 7
  const rows = 3
  const shown = notes.slice(0, cols * rows)
  return (
    <group position={[x, 0, z]}>
      {/* 프레임 + 코르크 */}
      <mesh position={[0, y, 0.025]} castShadow>
        <boxGeometry args={[w + 0.1, h + 0.1, 0.05]} />
        <meshStandardMaterial color="#8a5a35" roughness={0.6} />
      </mesh>
      <mesh position={[0, y, 0.052]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={cork} roughness={1} />
      </mesh>
      <mesh position={[0, y + h / 2 + 0.2, 0.03]}>
        <planeGeometry args={[1.5, 0.234]} />
        <meshBasicMaterial map={sign} transparent />
      </mesh>
      {shown.map((n, i) => {
        const c = i % cols
        const rr = Math.floor(i / cols)
        const jx = ((n.id.charCodeAt(n.id.length - 1) % 7) - 3) * 0.008
        const jy = ((n.id.charCodeAt(n.id.length - 2) % 7) - 3) * 0.008
        return <Note3D key={n.id} note={n} pos={[-w / 2 + 0.18 + c * 0.323 + jx, y + h / 2 - 0.2 - rr * 0.37 + jy, 0.06 + i * 0.0004]} />
      })}
      {notes.length === 0 && <EmptyHint y={y} />}
    </group>
  )
}

function EmptyHint({ y }) {
  const t = useMemo(
    () =>
      makeTex(512, 128, (g) => {
        g.fillStyle = 'rgba(255,255,255,0.85)'
        g.font = `700 40px ${FONT}`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText('첫 메모를 붙여 주세요 ✍️', 256, 64)
      }),
    []
  )
  return (
    <mesh position={[0, y, 0.06]}>
      <planeGeometry args={[1.2, 0.3]} />
      <meshBasicMaterial map={t} transparent />
    </mesh>
  )
}

// 탕비실 옆 점심 룰렛
export function Roulette3D() {
  const wheel = useRef()
  const bulbs = useRef([])
  const customCount = useStore((s) => s.customRestaurants.length) // 식당이 추가되면 칸 수도 바뀜
  const wheelTex = useMemo(
    () =>
      makeTex(512, 512, (g) => {
        const n = RESTAURANTS.length + customCount
        const cx = 256
        for (let i = 0; i < n; i++) {
          g.beginPath()
          g.moveTo(cx, cx)
          g.arc(cx, cx, 250, (i / n) * Math.PI * 2 - Math.PI / 2, ((i + 1) / n) * Math.PI * 2 - Math.PI / 2)
          g.closePath()
          g.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length]
          g.fill()
          g.strokeStyle = 'rgba(255,255,255,0.8)'
          g.lineWidth = 2
          g.stroke()
        }
        g.fillStyle = 'rgba(255,255,255,0.25)'
        g.beginPath()
        g.arc(cx, cx, 120, 0, Math.PI * 2)
        g.fill()
      }),
    [customCount]
  )
  useEffect(() => () => wheelTex.dispose(), [wheelTex])
  const sign = useMemo(
    () =>
      makeTex(1024, 300, (g) => {
        const grd = g.createLinearGradient(0, 0, 1024, 0)
        grd.addColorStop(0, '#ff6b6b')
        grd.addColorStop(0.5, '#f59f00')
        grd.addColorStop(1, '#cc5de8')
        g.fillStyle = grd
        g.beginPath()
        g.roundRect(10, 10, 1004, 280, 60)
        g.fill()
        g.strokeStyle = '#fff3bf'
        g.lineWidth = 10
        g.stroke()
        g.fillStyle = '#fff'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.font = `900 104px ${FONT}`
        g.fillText('🎰 오늘 뭐 먹지?', 512, 118)
        g.font = `800 64px ${FONT}`
        g.fillStyle = '#fff3bf'
        g.fillText('점심 룰렛', 512, 228)
      }),
    []
  )
  const R = 0.4
  const BULBS = 18
  useFrame(({ clock }, dt) => {
    const w = wheel.current
    if (!w) return
    const sp = live.wheelSpin
    if (sp) {
      const t = Math.min(1, (performance.now() - sp.start) / sp.dur)
      const e = 1 - Math.pow(1 - t, 3)
      if (sp.base === undefined) sp.base = w.rotation.z
      w.rotation.z = sp.base - e * sp.turns * Math.PI * 2
      if (t >= 1) live.wheelSpin = null
    } else w.rotation.z -= dt * 0.25
    const fast = !!live.wheelSpin
    bulbs.current.forEach((b, i) => {
      if (!b) return
      const on = Math.floor(clock.elapsedTime * (fast ? 14 : 3) + i) % 2 === 0
      b.material.emissiveIntensity = on ? 1.6 : 0.2
    })
  })
  const { x, z } = ROULETTE
  return (
    <group position={[x, 0, z]} scale={1.25}>
      {/* 받침대 */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.8, 0.34]} />
        <meshStandardMaterial color="#c92a2a" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.81, 0]}>
        <boxGeometry args={[0.64, 0.04, 0.38]} />
        <meshStandardMaterial color="#fab005" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.4, 0.172]}>
        <planeGeometry args={[0.44, 0.5]} />
        <meshStandardMaterial color="#ffe066" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.98, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 0.36, 12]} />
        <meshStandardMaterial color="#adb5bd" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* 바퀴 */}
      <group position={[0, 1.42, 0.06]}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[R + 0.05, R + 0.05, 0.06, 48]} />
          <meshStandardMaterial color="#f08c00" metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.032]}>
          <torusGeometry args={[R + 0.035, 0.022, 10, 48]} />
          <meshStandardMaterial color="#ffd43b" metalness={0.7} roughness={0.25} />
        </mesh>
        <group ref={wheel} position={[0, 0, 0.032]}>
          <mesh>
            <circleGeometry args={[R, 64]} />
            <meshStandardMaterial map={wheelTex} roughness={0.5} emissive="#ffffff" emissiveMap={wheelTex} emissiveIntensity={0.25} />
          </mesh>
        </group>
        <mesh position={[0, 0, 0.05]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color="#ffd43b" metalness={0.7} roughness={0.25} />
        </mesh>
        {Array.from({ length: BULBS }).map((_, i) => {
          const a = (i / BULBS) * Math.PI * 2
          return (
            <mesh key={i} ref={(m) => (bulbs.current[i] = m)} position={[Math.cos(a) * (R + 0.035), Math.sin(a) * (R + 0.035), 0.06]}>
              <sphereGeometry args={[0.018, 8, 8]} />
              <meshStandardMaterial color="#fff9db" emissive="#ffe066" emissiveIntensity={1} />
            </mesh>
          )
        })}
        {/* 포인터 */}
        <mesh position={[0, R + 0.09, 0.06]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.05, 0.12, 3]} />
          <meshStandardMaterial color="#e03131" roughness={0.4} />
        </mesh>
      </group>
      {/* 간판 */}
      <mesh position={[0, 2.12, 0.05]}>
        <planeGeometry args={[1.1, 0.322]} />
        <meshBasicMaterial map={sign} transparent />
      </mesh>
      <pointLight position={[0, 1.5, 0.5]} intensity={1.2} distance={2.2} color="#ffd8a8" />
    </group>
  )
}

/* ───────── 책상 쪽지 (모니터 귀퉁이 포스트잇) ───────── */
function deskNoteTexture(note) {
  return makeTex(192, 192, (g) => {
    g.fillStyle = note.color
    g.fillRect(0, 0, 192, 192)
    g.fillStyle = 'rgba(0,0,0,0.07)'
    g.fillRect(0, 0, 192, 26)
    g.fillStyle = '#2d2a26'
    g.font = `800 26px ${FONT}`
    g.textBaseline = 'top'
    g.fillText('💌', 12, 32)
    g.font = `700 24px ${FONT}`
    wrapText(g, note.text, 168, 4).forEach((l, i) => g.fillText(l, 12, 66 + i * 29))
  })
}

const SLOTS = [
  [0.3, 1.3, -0.22],
  [-0.3, 1.3, 0.2],
  [0.33, 1.05, 0.1],
]

function DeskNote({ note, pos, rotZ, seatRot }) {
  const map = useMemo(() => deskNoteTexture(note), [note.id, note.text, note.color])
  useEffect(() => () => map.dispose(), [map])
  const ref = useRef()
  const hover = useRef(false)
  const born = useRef(performance.now())
  useFrame((_, dt) => {
    if (!ref.current) return
    // 붙을 때 '딱' 하고 커졌다 작아지는 효과 + 호버 확대
    const age = (performance.now() - born.current) / 1000
    const pop = age < 0.5 ? 1 + Math.sin(age * Math.PI * 2) * 0.35 * (1 - age * 2) : 1
    const target = (hover.current ? 1.35 : 1) * pop
    const sc = THREE.MathUtils.damp(ref.current.scale.x, target, 14, dt)
    ref.current.scale.setScalar(sc)
  })
  const open = (e) => {
    e.stopPropagation()
    useStore.getState().set({ modal: { deskNote: note } })
  }
  const over = (e) => {
    e.stopPropagation()
    hover.current = true
    document.body.style.cursor = 'pointer'
  }
  const out = () => {
    hover.current = false
    document.body.style.cursor = ''
  }
  return (
    <group position={pos}>
      {/* 책상 방향과 상관없이 카메라(남쪽)를 향하도록 회전 보정 → 모니터 귀퉁이에 깃발처럼 붙은 포스트잇 */}
      <group rotation={[0, -seatRot, 0]}>
        <group ref={ref} position={[0, 0, 0.05]} rotation={[-0.45, 0, rotZ]}>
          <mesh position={[0, 0, 0.003]} onClick={open} onPointerOver={over} onPointerOut={out} castShadow>
            <planeGeometry args={[0.2, 0.2]} />
            <meshStandardMaterial map={map} roughness={0.9} emissive="#ffffff" emissiveMap={map} emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0, 0, -0.003]} rotation={[0, Math.PI, 0]} onClick={open} onPointerOver={over} onPointerOut={out}>
            <planeGeometry args={[0.2, 0.2]} />
            <meshStandardMaterial map={map} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.09, 0.006]}>
            <boxGeometry args={[0.09, 0.025, 0.002]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.6} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export function DeskNotes3D({ seat, mx, mz, rot }) {
  const all = useStore((s) => s.deskNotes)
  const notes = useMemo(() => all.filter((n) => n.seat === seat.name).slice(0, 3), [all, seat.name])
  return notes.map((n, i) => {
    const [x, y, r] = SLOTS[i]
    return <DeskNote key={n.id} note={n} pos={[mx + x, y, mz]} rotZ={r} seatRot={rot} />
  })
}

/* ───────── 탕비실 간식 투표함 ───────── */
export function VoteBox3D() {
  const lid = useRef()
  const paper = useRef()
  const sign = useMemo(
    () =>
      makeTex(512, 150, (g) => {
        g.fillStyle = '#ff8fab'
        g.beginPath()
        g.roundRect(6, 6, 500, 138, 44)
        g.fill()
        g.strokeStyle = '#fff'
        g.lineWidth = 8
        g.stroke()
        g.fillStyle = '#fff'
        g.font = `900 62px ${FONT}`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText('🗳️ 간식 투표', 256, 78)
      }),
    []
  )
  const face = useMemo(
    () =>
      makeTex(256, 256, (g) => {
        g.fillStyle = '#9be7d8'
        g.fillRect(0, 0, 256, 256)
        g.fillStyle = '#fff'
        g.beginPath()
        g.arc(128, 140, 70, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#2d2a26'
        g.beginPath()
        g.arc(102, 128, 9, 0, Math.PI * 2)
        g.arc(154, 128, 9, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = '#2d2a26'
        g.lineWidth = 6
        g.beginPath()
        g.arc(128, 150, 20, 0.15 * Math.PI, 0.85 * Math.PI)
        g.stroke()
        g.fillStyle = 'rgba(255,120,150,0.6)'
        g.beginPath()
        g.arc(82, 160, 12, 0, Math.PI * 2)
        g.arc(174, 160, 12, 0, Math.PI * 2)
        g.fill()
      }),
    []
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (paper.current) paper.current.position.y = 0.28 + Math.sin(t * 2.2) * 0.012
    if (lid.current) lid.current.rotation.z = Math.sin(t * 1.3) * 0.03
  })
  // 탕비실 카운터 위, 싱크대와 커피머신 사이
  return (
    <group position={[26.72, 0.9, 9.3]}>
      <group ref={lid}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <boxGeometry args={[0.28, 0.24, 0.22]} />
          <meshStandardMaterial color="#9be7d8" roughness={0.5} />
        </mesh>
        {/* 카메라·방 양쪽 모두에 웃는 얼굴 */}
        <mesh position={[0, 0.12, 0.111]}>
          <planeGeometry args={[0.26, 0.22]} />
          <meshStandardMaterial map={face} />
        </mesh>
        <mesh position={[0, 0.12, -0.111]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.26, 0.22]} />
          <meshStandardMaterial map={face} />
        </mesh>
        <mesh position={[0, 0.245, 0]}>
          <boxGeometry args={[0.3, 0.02, 0.24]} />
          <meshStandardMaterial color="#ff8fab" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.257, 0]}>
          <boxGeometry args={[0.14, 0.006, 0.025]} />
          <meshStandardMaterial color="#2d2a26" />
        </mesh>
        <mesh ref={paper} position={[0.0, 0.28, 0]} rotation={[0, 0, 0.12]}>
          <boxGeometry args={[0.1, 0.07, 0.004]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>
      <sprite position={[0, 0.55, 0]} scale={[0.5, 0.146, 1]}>
        <spriteMaterial map={sign} transparent />
      </sprite>
    </group>
  )
}

/* ───────── 🎄 크리스마스 트리 ───────── */
const TREE_BULB_COLORS = ['#ffd43b', '#ff6b6b', '#74c0fc', '#69db7c', '#f783ac']
const treeBulbMats = TREE_BULB_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.3 }))
const starMat = new THREE.MeshStandardMaterial({ color: '#ffd43b', emissive: '#ffb703', emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.3 })

function starGeometry() {
  const sh = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.17 : 0.075
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    i === 0 ? sh.moveTo(x, y) : sh.lineTo(x, y)
  }
  sh.closePath()
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 })
  g.center()
  return g
}

export function XmasTree({ x, z }) {
  const timeMode = useStore((s) => s.timeMode)
  const star = useRef()
  const light = useRef()
  const starGeo = useMemo(() => starGeometry(), [])
  // 3단 원뿔 위의 오너먼트 / 전구 위치 (항상 같은 배치)
  const { ornaments, bulbs } = useMemo(() => {
    let seed = 11
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const tiers = [
      { y0: 0.55, h: 0.95, rad: 0.62 },
      { y0: 1.1, h: 0.8, rad: 0.48 },
      { y0: 1.55, h: 0.7, rad: 0.33 },
    ]
    const orn = []
    const bl = []
    const onCone = (t, u, a) => {
      // u: 0(아래)~1(위)
      const y = t.y0 + u * t.h
      const rad = t.rad * (1 - u) + 0.02
      return [Math.cos(a) * rad, y, Math.sin(a) * rad]
    }
    tiers.forEach((t, ti) => {
      for (let i = 0; i < 9 - ti * 2; i++) orn.push({ p: onCone(t, 0.12 + r() * 0.5, r() * Math.PI * 2), c: ['#e03131', '#f8f9fa', '#ffd43b', '#1971c2', '#c2255c'][Math.floor(r() * 5)], s: 0.045 + r() * 0.025 })
    })
    // 나선형 전구 줄
    for (let i = 0; i < 46; i++) {
      const k = i / 46
      const ti = k < 0.45 ? 0 : k < 0.8 ? 1 : 2
      const t = tiers[ti]
      const local = ti === 0 ? k / 0.45 : ti === 1 ? (k - 0.45) / 0.35 : (k - 0.8) / 0.2
      bl.push({ p: onCone(t, 0.05 + local * 0.8, k * Math.PI * 2 * 5.5), m: i % TREE_BULB_COLORS.length })
    }
    return { ornaments: orn, bulbs: bl }
  }, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const base = timeMode === 'night' ? 2.2 : timeMode === 'sunset' ? 1.3 : 0.55
    treeBulbMats.forEach((m, i) => (m.emissiveIntensity = base * (0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.3))))
    starMat.emissiveIntensity = base * 0.9 + Math.sin(t * 3) * 0.25
    if (star.current) star.current.rotation.y = Math.sin(t * 0.8) * 0.5
    if (light.current) light.current.intensity = timeMode === 'night' ? 2.6 + Math.sin(t * 2) * 0.3 : timeMode === 'sunset' ? 1.2 : 0
  })
  return (
    <group position={[x, 0, z]}>
      {/* 화분 + 트리 스커트 */}
      <mesh position={[0, 0.17, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.24, 0.2, 0.34, 20]} />
        <meshStandardMaterial color="#b02a37" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.345, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.03, 20]} />
        <meshStandardMaterial color="#ffd43b" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.62, 32]} />
        <meshStandardMaterial color="#f1f3f5" roughness={1} />
      </mesh>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.25, 10]} />
        <meshStandardMaterial color="#6b4423" />
      </mesh>
      {/* 3단 잎 */}
      {[
        [0.55, 0.95, 0.66, '#2b8a3e'],
        [1.1, 0.8, 0.52, '#2f9e44'],
        [1.55, 0.7, 0.37, '#37b24d'],
      ].map(([y0, h, rad, c], i) => (
        <mesh key={i} position={[0, y0 + h / 2, 0]} castShadow>
          <coneGeometry args={[rad, h, 18]} />
          <meshStandardMaterial color={c} roughness={0.85} flatShading />
        </mesh>
      ))}
      {/* 눈 덮인 끝자락 */}
      {[
        [0.58, 0.64],
        [1.13, 0.5],
        [1.58, 0.35],
      ].map(([y, rad], i) => (
        <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[rad, 0.025, 6, 24]} />
          <meshStandardMaterial color="#ffffff" roughness={1} />
        </mesh>
      ))}
      {ornaments.map((o, i) => (
        <mesh key={'o' + i} position={o.p} castShadow>
          <sphereGeometry args={[o.s, 12, 12]} />
          <meshStandardMaterial color={o.c} metalness={0.6} roughness={0.25} />
        </mesh>
      ))}
      {bulbs.map((b, i) => (
        <mesh key={'b' + i} position={b.p} material={treeBulbMats[b.m]}>
          <sphereGeometry args={[0.022, 8, 8]} />
        </mesh>
      ))}
      <mesh ref={star} position={[0, 2.37, 0]} geometry={starGeo} material={starMat} />
      {/* 선물 상자 */}
      {[
        [0.42, 0.12, 0.25, 0.22, '#e03131', '#ffd43b'],
        [-0.38, 0.1, 0.3, 0.18, '#1971c2', '#ffffff'],
        [0.12, 0.09, -0.45, 0.16, '#ae3ec9', '#ffd43b'],
      ].map(([gx, hy, gz, sz, c, rib], i) => (
        <group key={i} position={[gx, hy, gz]} rotation={[0, i * 0.6, 0]}>
          <mesh castShadow>
            <boxGeometry args={[sz, hy * 2, sz]} />
            <meshStandardMaterial color={c} roughness={0.5} />
          </mesh>
          <mesh>
            <boxGeometry args={[sz + 0.005, hy * 2 + 0.005, 0.035]} />
            <meshStandardMaterial color={rib} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.035, hy * 2 + 0.005, sz + 0.005]} />
            <meshStandardMaterial color={rib} />
          </mesh>
        </group>
      ))}
      <pointLight ref={light} position={[0, 1.4, 0.6]} intensity={0} distance={4.5} decay={1.6} color="#ffd8a8" />
      <WishCards />
      {/* 클릭 영역: 트리를 누르면 소원 카드 팝업 */}
      <mesh
        position={[0, 1.2, 0]}
        onClick={(e) => {
          e.stopPropagation()
          if (useStore.getState().joined) useStore.getState().set({ modal: 'wishes' })
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <cylinderGeometry args={[0.6, 0.7, 2.4, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ───────── 🏛️ 오늘의 건축 이야기 액자 (탕비실 벽) ───────── */
export function StoryFrame({ x, z, story }) {
  const map = useMemo(
    () =>
      makeTex(640, 470, (g) => {
        g.fillStyle = '#fbf6ec'
        g.fillRect(0, 0, 640, 470)
        g.fillStyle = '#2f3e46'
        g.fillRect(0, 0, 640, 92)
        g.fillStyle = '#ffd43b'
        g.font = `800 46px ${FONT}`
        g.textBaseline = 'middle'
        g.fillText('🏛️ 오늘의 건축 이야기', 30, 48)
        g.fillStyle = '#8a6d3b'
        g.font = `700 30px ${FONT}`
        g.textBaseline = 'top'
        g.fillText(`${story.who} · ${story.tag}`, 30, 118)
        g.fillStyle = '#2b2a28'
        g.font = `800 38px ${FONT}`
        wrapText(g, story.quote, 580, 4).forEach((l, i) => g.fillText(l, 30, 170 + i * 52))
        g.fillStyle = '#9a9184'
        g.font = `600 24px ${FONT}`
        g.fillText('가까이 와서 [이야기 보기]를 눌러 보세요', 30, 420)
      }),
    [story]
  )
  useEffect(() => () => map.dispose(), [map])
  const open = (e) => {
    e.stopPropagation()
    if (useStore.getState().joined) useStore.getState().set({ modal: 'stories' })
  }
  return (
    <group position={[x, 1.55, z]}>
      <mesh castShadow>
        <boxGeometry args={[0.98, 0.76, 0.05]} />
        <meshStandardMaterial color="#8a5a35" roughness={0.55} />
      </mesh>
      <mesh
        position={[0, 0, 0.027]}
        onClick={open}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <planeGeometry args={[0.86, 0.632]} />
        <meshStandardMaterial map={map} roughness={0.8} emissive="#ffffff" emissiveMap={map} emissiveIntensity={0.12} />
      </mesh>
    </group>
  )
}

/* ───────── 🎄 트리에 매달린 소원 카드 ───────── */
function WishCards() {
  const wishes = useStore((s) => s.treeWishes)
  const shown = wishes.slice(0, 24)
  const slots = useMemo(() => {
    const out = []
    const tiers = [
      { y0: 0.55, h: 0.95, rad: 0.66 },
      { y0: 1.1, h: 0.8, rad: 0.52 },
      { y0: 1.55, h: 0.7, rad: 0.37 },
    ]
    for (let i = 0; i < 24; i++) {
      const t = tiers[i % 3 === 2 ? 2 : i % 2]
      const a = i * 2.39996 // 황금각으로 고르게 분포
      const u = 0.18 + ((i * 0.37) % 0.4)
      const rad = t.rad * (1 - u) + 0.05
      out.push({ p: [Math.cos(a) * rad, t.y0 + u * t.h - 0.04, Math.sin(a) * rad], ry: -a + Math.PI / 2 })
    }
    return out
  }, [])
  return shown.map((w, i) => (
    <group key={w.id} position={slots[i].p} rotation={[0, slots[i].ry, 0]}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 0.06, 4]} />
        <meshBasicMaterial color="#c9a227" />
      </mesh>
      <mesh rotation={[0, 0, (i % 5) * 0.06 - 0.12]}>
        <boxGeometry args={[0.1, 0.13, 0.006]} />
        <meshStandardMaterial color={w.color} roughness={0.8} emissive={w.color} emissiveIntensity={0.15} />
      </mesh>
    </group>
  ))
}

/* ───────── ✨ 크리스마스 전구 줄 (가랜드) ───────── */
const GARLAND_COLORS = ['#ffd43b', '#ff6b6b', '#74c0fc', '#69db7c']
const garlandMats = GARLAND_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.3 }))
// [시작점, 끝점, 높이] — 벽면 바로 앞 (x, z)
const GARLAND_RUNS = [
  { a: [0.4, 0.14], b: [28.15, 0.14], y: 2.5, span: 1.6 }, // 북쪽 통유리창 위
  { a: [20.15, 0.5], b: [20.15, 7.8], y: 2.36, span: 1.2 }, // 설계실 | 관리부 유리 파티션
  { a: [4.78, 0.4], b: [4.78, 9.3], y: 2.6, span: 1.3 }, // 대표님실 벽 (설계실 쪽)
  { a: [4.8, 2.68], b: [9.95, 2.68], y: 2.62, span: 1.3 }, // 창고 벽 (게시판 위)
  { a: [24.33, 0.4], b: [24.33, 7.6], y: 2.6, span: 1.2 }, // 관리부 동쪽 벽
  { a: [25.6, 7.78], b: [28.35, 7.78], y: 2.6, span: 0.9 }, // 탕비실 벽
]

export function Garlands() {
  const timeMode = useStore((s) => s.timeMode)
  const { groups, wire } = useMemo(() => {
    const groups = GARLAND_COLORS.map(() => [])
    const wire = []
    let n = 0
    for (const r of GARLAND_RUNS) {
      const len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1])
      const spans = Math.max(1, Math.round(len / r.span))
      const steps = spans * 7
      let prev = null
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const local = (t * spans) % 1
        const sag = Math.sin(local * Math.PI) * 0.16 // 줄이 살짝 처지는 모양
        const p = [r.a[0] + (r.b[0] - r.a[0]) * t, r.y - sag, r.a[1] + (r.b[1] - r.a[1]) * t]
        if (prev) wire.push(...prev, ...p)
        prev = p
        if (i % 7 !== 0 || i === 0) groups[n++ % GARLAND_COLORS.length].push(p)
      }
    }
    return { groups, wire: new Float32Array(wire) }
  }, [])
  const refs = useRef([])
  useEffect(() => {
    const m = new THREE.Matrix4()
    refs.current.forEach((im, gi) => {
      if (!im) return
      groups[gi].forEach((p, i) => im.setMatrixAt(i, m.makeTranslation(p[0], p[1], p[2])))
      im.instanceMatrix.needsUpdate = true
    })
  }, [groups])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const base = timeMode === 'night' ? 2.6 : timeMode === 'sunset' ? 1.4 : 0.7
    garlandMats.forEach((m, i) => (m.emissiveIntensity = base * (0.5 + 0.5 * Math.max(0, Math.sin(t * 1.8 + i * 1.57)))))
  })
  return (
    <group>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[wire, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#2b6b3a" />
      </lineSegments>
      {groups.map((g, i) => (
        <instancedMesh key={i} ref={(m) => (refs.current[i] = m)} args={[null, garlandMats[i], g.length]} frustumCulled={false}>
          <sphereGeometry args={[0.028, 8, 8]} />
        </instancedMesh>
      ))}
    </group>
  )
}

/* ───────── 🎀 크리스마스 리스 (출입문 장식) ───────── */
export function Wreath({ p, ry = 0, s = 1 }) {
  const berries = useMemo(() => Array.from({ length: 9 }, (_, i) => (i / 9) * Math.PI * 2 + 0.3), [])
  return (
    <group position={p} rotation={[0, ry, 0]} scale={s}>
      <mesh>
        <torusGeometry args={[0.2, 0.065, 10, 28]} />
        <meshStandardMaterial color="#2b8a3e" roughness={0.9} flatShading />
      </mesh>
      {berries.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.06]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color={i % 3 === 0 ? '#ffd43b' : '#e03131'} roughness={0.4} />
        </mesh>
      ))}
      <group position={[0, -0.2, 0.07]}>
        <mesh rotation={[0, 0, 0.6]} position={[-0.05, 0, 0]}>
          <boxGeometry args={[0.1, 0.05, 0.02]} />
          <meshStandardMaterial color="#c92a2a" />
        </mesh>
        <mesh rotation={[0, 0, -0.6]} position={[0.05, 0, 0]}>
          <boxGeometry args={[0.1, 0.05, 0.02]} />
          <meshStandardMaterial color="#c92a2a" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#e03131" />
        </mesh>
      </group>
    </group>
  )
}

/* ───────── ❄️ 창밖에 내리는 눈 ───────── */
function snowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.4, 'rgba(255,255,255,0.8)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

export function Snow({ W, D }) {
  const timeMode = useStore((s) => s.timeMode)
  // 북쪽 창밖(넓게) + 남쪽 출입구 밖
  const AREAS = useMemo(
    () => [
      { n: 1400, x0: -3, x1: W + 3, z0: -6, z1: -0.35 },
      { n: 600, x0: -3, x1: W + 3, z0: D + 0.4, z1: D + 4.5 },
    ],
    [W, D]
  )
  const total = AREAS.reduce((a, b) => a + b.n, 0)
  const { pos, meta } = useMemo(() => {
    const pos = new Float32Array(total * 3)
    const meta = new Float32Array(total * 4) // 속도, 흔들림 위상, 영역, 기준 x
    let i = 0
    AREAS.forEach((ar, ai) => {
      for (let k = 0; k < ar.n; k++, i++) {
        const x = ar.x0 + Math.random() * (ar.x1 - ar.x0)
        pos[i * 3] = x
        pos[i * 3 + 1] = Math.random() * 7
        pos[i * 3 + 2] = ar.z0 + Math.random() * (ar.z1 - ar.z0)
        meta[i * 4] = 0.35 + Math.random() * 0.55
        meta[i * 4 + 1] = Math.random() * Math.PI * 2
        meta[i * 4 + 2] = ai
        meta[i * 4 + 3] = x
      }
    })
    return { pos, meta }
  }, [AREAS, total])
  const geo = useRef()
  const mat = useRef()
  const tex = useMemo(() => snowTexture(), [])
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = clock.elapsedTime
    for (let i = 0; i < total; i++) {
      let y = pos[i * 3 + 1] - meta[i * 4] * dt
      if (y < 0) y += 7
      pos[i * 3 + 1] = y
      pos[i * 3] = meta[i * 4 + 3] + Math.sin(t * 0.7 + meta[i * 4 + 1]) * 0.25
    }
    if (geo.current) geo.current.attributes.position.needsUpdate = true
    if (mat.current) mat.current.opacity = timeMode === 'night' ? 0.95 : timeMode === 'sunset' ? 0.85 : 0.7
  })
  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geo}>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={mat} map={tex} size={0.09} sizeAttenuation transparent depthWrite={false} color="#ffffff" opacity={0.8} />
    </points>
  )
}

/* ───────── 📅 관리부 마감 D-Day 전광판 ───────── */
export function DdayBoard({ x, z }) {
  const ddays = useStore((s) => s.ddays)
  const [today, setToday] = useState(() => kstToday())
  useEffect(() => {
    const t = setInterval(() => setToday(kstToday()), 60000) // 자정이 지나면 D-n 자동 갱신
    return () => clearInterval(t)
  }, [])
  const map = useMemo(() => {
    const upcoming = [...ddays].sort((a, b) => {
      const da = ddayLabel(a.date).diff
      const db = ddayLabel(b.date).diff
      return (da < 0 ? 1e6 - da : da) - (db < 0 ? 1e6 - db : db) // 다가오는 순, 지난 건 뒤로
    })
    return makeTex(1024, 480, (g) => {
      g.fillStyle = '#0b0d10'
      g.fillRect(0, 0, 1024, 480)
      g.fillStyle = '#ffb703'
      g.font = `800 50px ${FONT}`
      g.textBaseline = 'middle'
      g.shadowColor = '#ff9f1c'
      g.shadowBlur = 18
      g.fillText('📅 마감 D-Day', 36, 52)
      g.font = `600 28px ${FONT}`
      g.fillStyle = '#adb5bd'
      g.shadowBlur = 0
      g.textAlign = 'right'
      g.fillText(today.replace(/-/g, '.') + ' 기준', 990, 54)
      g.textAlign = 'left'
      if (!upcoming.length) {
        g.fillStyle = '#ffd166'
        g.font = `700 44px ${FONT}`
        g.shadowColor = '#ffb703'
        g.shadowBlur = 14
        g.fillText('등록된 마감이 없어요 — 클릭해서 등록!', 36, 260)
      }
      upcoming.slice(0, 3).forEach((p, i) => {
        const y = 150 + i * 112
        const d = ddayLabel(p.date)
        const col = d.diff < 0 ? '#868e96' : d.diff <= 3 ? '#ff4d4d' : d.diff <= 7 ? '#ffb703' : '#69db7c'
        g.shadowColor = col
        g.shadowBlur = 16
        g.fillStyle = '#ffe8a3'
        g.font = `800 50px ${FONT}`
        let name = p.name
        while (g.measureText(name).width > 650 && name.length > 1) name = name.slice(0, -1)
        if (name !== p.name) name = name.slice(0, -1) + '…'
        g.fillText(name, 36, y)
        g.fillStyle = col
        g.font = `900 64px ${FONT}`
        g.textAlign = 'right'
        g.fillText(d.text, 990, y)
        g.textAlign = 'left'
        g.shadowBlur = 0
        g.fillStyle = '#6c757d'
        g.font = `600 24px ${FONT}`
        g.fillText(p.date.replace(/-/g, '.'), 38, y + 40)
      })
      // 전광판 도트 느낌
      g.shadowBlur = 0
      g.fillStyle = 'rgba(0,0,0,0.38)'
      for (let yy = 0; yy < 480; yy += 6) g.fillRect(0, yy, 1024, 2)
      for (let xx = 0; xx < 1024; xx += 6) g.fillRect(xx, 0, 2, 480)
    })
  }, [ddays, today])
  useEffect(() => () => map.dispose(), [map])
  const open = (e) => {
    e.stopPropagation()
    if (useStore.getState().joined) useStore.getState().set({ modal: 'dday' })
  }
  return (
    <group position={[x, 1.72, z]}>
      <mesh castShadow>
        <boxGeometry args={[1.42, 0.72, 0.06]} />
        <meshStandardMaterial color="#212529" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh
        position={[0, 0, 0.032]}
        onClick={open}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <planeGeometry args={[1.34, 0.628]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
      {[-0.5, 0.5].map((u) => (
        <mesh key={u} position={[u, 0.42, -0.02]}>
          <cylinderGeometry args={[0.006, 0.006, 0.14, 6]} />
          <meshStandardMaterial color="#868e96" />
        </mesh>
      ))}
    </group>
  )
}
