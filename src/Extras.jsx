import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOARD, ROULETTE } from './layout'
import { live, useStore } from './store'
import { RESTAURANTS, WHEEL_COLORS } from './restaurants'

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
    g.fillText(`- ${note.name} ${note.title}`, 238, 222)
  })
}

function Note3D({ note, pos }) {
  const map = useMemo(() => noteTexture(note), [note.id, note.text, note.color])
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
  const wheelTex = useMemo(
    () =>
      makeTex(512, 512, (g) => {
        const n = RESTAURANTS.length
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
    []
  )
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
