import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import Character from './Character'
import { live, useStore } from './store'
import { isFree, findPath } from './nav'
import { zoneAt, PANTRY, W, D, seats, chairOf, ROULETTE } from './layout'
import { TREE, COFFEE, MODELS, STROLLER, NIRO, STORY, NOTION } from './furniture'
import { Stroller } from './Extras'

const SPEED = 3.6
const RIDE_SPEED = 2.7 // 유모차는 살짝 천천히
const JUMP_V = 5.6 // 점프 초속 (약 0.9m 높이)
const GRAVITY = 17

// 하린이 전용 유모차: 닉네임에 '하린'이 들어가면 탈 수 있음
export const canRide = (name) => typeof name === 'string' && name.includes('하린')
const GLIDE = 2.0
const keys = new Set()
const KEYMAP = {
  ArrowUp: 'u', KeyW: 'u',
  ArrowDown: 'd', KeyS: 'd',
  ArrowLeft: 'l', KeyA: 'l',
  ArrowRight: 'r', KeyD: 'r',
}

const typing = () => {
  const el = document.activeElement
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

// 🚗 외근 행선지 표시: '🚗 과천시청 (~15:30)'
export const outingText = (o) => (o && o.dest ? `🚗 ${o.dest}${o.until ? ` (~${o.until})` : ''}` : '')

export function HeadOverlay({ name, title, bubble, emote, mine, mood, status, outing }) {
  const onVacation = useStore((s) => !!s.vacations[name])
  return (
    <Html position={[0, 2.05, 0]} center zIndexRange={[50, 0]} style={{ pointerEvents: 'none' }}>
      <div className="head-wrap">
        {bubble && (
          <div className="bubble" key={bubble.key}>
            {bubble.text}
          </div>
        )}
        {emote && emote.kind === 'fresh' && (
          <div className="emote fresh" key={emote.key}>
            <span className="e1">😌</span>
            <span className="e2">✨</span>
            <span className="e3">💚</span>
            <div className="fresh-label">개운함 ✨</div>
          </div>
        )}
        {emote && emote.kind !== 'fresh' && (
          <div className="emote" key={emote.key}>
            <span className="e1">{emote.kind === 'coffee' ? '☕' : '🍪'}</span>
            <span className="e2">💖</span>
            <span className="e3">{emote.kind === 'coffee' ? '✨' : '😋'}</span>
          </div>
        )}
        {outing && outing.dest && <div className="outing-bubble">{outingText(outing)}</div>}
        {onVacation && <div className="vac-badge">🏖️ 휴가중</div>}
        <div className={'head-tag' + (mine ? ' mine' : '')}>
          {mood && <span className="mood">{mood}</span>}
          {name} <b>{title}</b>
          {status && <span className="status-chip">{status}</span>}
        </div>
      </div>
    </Html>
  )
}

// 의자 뒤쪽의 비어 있는 '일어설 자리' 찾기
export function standSpotFor(idx) {
  const c = chairOf(seats[idx])
  const back = [-c.dir[0], -c.dir[1]]
  const side = [c.dir[1], -c.dir[0]]
  const cands = [0.55, 0.75, 0.95, 0.4].map((k) => [c.x + back[0] * k, c.z + back[1] * k])
  for (const s of [0.5, -0.5, 0.8, -0.8]) cands.push([c.x + back[0] * 0.5 + side[0] * s, c.z + back[1] * 0.5 + side[1] * s])
  for (const [x, z] of cands) if (isFree(x, z)) return { x, z }
  return { x: c.x + back[0] * 0.6, z: c.z + back[1] * 0.6 }
}

export function Player() {
  const me = useStore((s) => s.me)
  const bubble = useStore((s) => s.bubble)
  const emote = useStore((s) => s.emote)
  const holding = useStore((s) => s.holding)
  const holdUntil = useStore((s) => s.holdUntil)
  const accessory = useStore((s) => s.accessory)
  const mood = useStore((s) => s.mood)
  const status = useStore((s) => s.status)
  const outing = useStore((s) => s.outing)
  const group = useRef()
  const anim = useRef({ moving: false, sitting: false })
  const path = useRef(null)
  const idle = useRef(0)
  const pendingSit = useRef(null) // 걸어가는 중인 좌석
  const glide = useRef(null) // { x, z, rot, then }
  const seatInfo = useRef(null) // 앉아 있는 동안 { idx, stand }
  const afterStand = useRef(null) // 일어난 뒤 이어서 할 클릭 이동
  const strollerAnim = useRef({ moving: false })
  const riding = useStore((s) => s.riding)

  useEffect(() => {
    const goTo = (x, z) => {
      const p = live.player
      const pts = findPath(p.x, p.z, x, z)
      if (pts && pts.length) {
        path.current = pts
        const last = pts[pts.length - 1]
        live.target = { x: last[0], z: last[1] }
        return true
      }
      return false
    }
    const standUp = (then) => {
      if (!seatInfo.current) return
      const { stand } = seatInfo.current
      seatInfo.current = null
      live.player.sitting = false
      useStore.getState().set({ sitting: null })
      glide.current = { x: stand.x, z: stand.z, then: 'stand' }
      afterStand.current = then || null
    }
    const down = (e) => {
      if (typing() || useStore.getState().modal) return
      if (e.code === 'Space') {
        e.preventDefault() // 포커스된 버튼이 눌리거나 화면이 스크롤되지 않게
        if (!e.repeat) jump()
        return
      }
      const k = KEYMAP[e.code]
      if (k) {
        e.preventDefault()
        if (seatInfo.current) standUp()
        keys.add(k)
        path.current = null
        pendingSit.current = null
        live.target = null
      }
    }
    const up = (e) => {
      const k = KEYMAP[e.code]
      if (k) keys.delete(k)
    }
    const blur = () => keys.clear()
    const click = (e) => {
      const { x, z } = e.detail
      if (seatInfo.current) return standUp({ x, z })
      if (glide.current) {
        if (glide.current.then === 'stand') afterStand.current = { x, z }
        else glide.current = null // 앉으러 가던 중이면 취소하고 새 목적지로
        if (afterStand.current) return
      }
      pendingSit.current = null
      goTo(x, z)
    }
    const sit = (e) => {
      const idx = e.detail.idx
      if (seatInfo.current || glide.current) return
      const p = live.player
      const spot = standSpotFor(idx)
      pendingSit.current = { idx, spot }
      if (Math.hypot(p.x - spot.x, p.z - spot.z) < 0.15 || !goTo(spot.x, spot.z)) {
        path.current = null
        live.target = null
      }
    }
    const stand = () => standUp()
    // 🦘 점프: 바닥에 있을 때만 (앉아 있거나 유모차 탑승 중에는 불가)
    const jump = () => {
      const p = live.player
      if (p.y > 0.001 || p.sitting || p.riding || glide.current) return
      p.vy = JUMP_V
      p.jumpCount = (p.jumpCount || 0) + 1
    }
    // 🍼 유모차 타기 / 내리기
    const ride = () => {
      const p = live.player
      if (p.riding || seatInfo.current || glide.current) return
      path.current = null
      live.target = null
      glide.current = { x: STROLLER.x, z: STROLLER.z, rot: STROLLER.rot, then: 'ride' }
    }
    const unride = () => {
      const p = live.player
      if (!p.riding) return
      p.riding = false
      useStore.getState().set({ riding: false })
    }
    window.addEventListener('jump-request', jump)
    window.addEventListener('ride-request', ride)
    window.addEventListener('unride-request', unride)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    window.addEventListener('floor-click', click)
    window.addEventListener('sit-request', sit)
    window.addEventListener('stand-request', stand)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      window.removeEventListener('floor-click', click)
      window.removeEventListener('sit-request', sit)
      window.removeEventListener('stand-request', stand)
      window.removeEventListener('jump-request', jump)
      window.removeEventListener('ride-request', ride)
      window.removeEventListener('unride-request', unride)
    }
  }, [])

  // 말풍선 / 이모트 / 손에 든 물건 타이머
  useEffect(() => {
    if (!bubble) return
    const t = setTimeout(() => useStore.getState().clearBubble(), bubble.until - Date.now())
    return () => clearTimeout(t)
  }, [bubble])
  useEffect(() => {
    if (!emote) return
    const t = setTimeout(() => useStore.getState().clearEmote(), Math.max(1000, emote.until - Date.now()))
    return () => clearTimeout(t)
  }, [emote])
  useEffect(() => {
    if (!holding) return
    // 커피는 3분, 간식은 25초 뒤 자동으로 내려놓음 (커피는 [반납] 버튼으로도)
    const t = setTimeout(() => useStore.getState().clearHolding(), Math.max(1000, (holdUntil || Date.now() + 25000) - Date.now()))
    return () => clearTimeout(t)
  }, [holding, holdUntil])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const p = live.player
    let moving = false

    if (glide.current) {
      // 의자에 앉거나 일어날 때의 부드러운 이동 (충돌 무시)
      const g = glide.current
      const dx = g.x - p.x
      const dz = g.z - p.z
      const dist = Math.hypot(dx, dz)
      const step = GLIDE * dt
      if (g.rot !== undefined) p.rot = dampAngle(p.rot, g.rot, 10, dt)
      if (dist <= step) {
        p.x = g.x
        p.z = g.z
        glide.current = null
        if (g.then === 'sit') {
          p.sitting = true
          seatInfo.current = { idx: g.idx, stand: g.stand }
          useStore.getState().set({ sitting: g.idx })
        } else if (g.then === 'ride') {
          p.riding = true
          useStore.getState().set({ riding: true })
        } else if (g.then === 'stand' && afterStand.current) {
          const t = afterStand.current
          afterStand.current = null
          window.dispatchEvent(new CustomEvent('floor-click', { detail: t }))
        }
      } else {
        p.x += (dx / dist) * step
        p.z += (dz / dist) * step
      }
    } else if (seatInfo.current) {
      const c = chairOf(seats[seatInfo.current.idx])
      p.rot = dampAngle(p.rot, c.rot, 10, dt)
    } else {
      let vx = 0
      let vz = 0
      if (!typing() && !useStore.getState().modal) {
        if (keys.has('u')) vz -= 1
        if (keys.has('d')) vz += 1
        if (keys.has('l')) vx -= 1
        if (keys.has('r')) vx += 1
      }
      if (vx || vz) {
        const len = Math.hypot(vx, vz)
        const sp = p.riding ? RIDE_SPEED : SPEED
        vx = (vx / len) * sp * dt
        vz = (vz / len) * sp * dt
        if (isFree(p.x + vx, p.z)) p.x += vx
        if (isFree(p.x, p.z + vz)) p.z += vz
        p.rot = dampAngle(p.rot, Math.atan2(vx, vz), 14, dt)
        moving = true
      } else if (path.current && path.current.length) {
        const [tx, tz] = path.current[0]
        const dx = tx - p.x
        const dz = tz - p.z
        const dist = Math.hypot(dx, dz)
        const step = (p.riding ? RIDE_SPEED : SPEED) * dt
        if (dist <= step) {
          p.x = tx
          p.z = tz
          path.current.shift()
          if (!path.current.length) {
            path.current = null
            live.target = null
          }
        } else {
          p.x += (dx / dist) * step
          p.z += (dz / dist) * step
        }
        if (dist > 0.01) p.rot = dampAngle(p.rot, Math.atan2(dx, dz), 12, dt)
        moving = true
      } else if (pendingSit.current) {
        // 의자 뒤에 도착 → 의자로 미끄러지듯 앉기
        const { idx, spot } = pendingSit.current
        pendingSit.current = null
        const c = chairOf(seats[idx])
        glide.current = { x: c.x + c.dir[0] * 0.05, z: c.z + c.dir[1] * 0.05, rot: c.rot, then: 'sit', idx, stand: spot }
      }
    }

    // 🦘 점프 물리
    if (p.y > 0 || p.vy > 0) {
      p.vy -= GRAVITY * dt
      p.y = Math.max(0, p.y + p.vy * dt)
      if (p.y === 0) p.vy = 0
    }
    anim.current.air = p.y > 0.02

    p.moving = moving || !!glide.current
    anim.current.moving = p.moving && !p.sitting
    anim.current.sitting = p.sitting || p.riding
    idle.current = p.moving || p.sitting || p.riding ? 0 : idle.current + dt
    if (idle.current > 1.4 && !live.overview) p.rot = dampAngle(p.rot, 0, 3, dt)
    if (group.current) {
      group.current.position.set(p.x, p.y, p.z)
      group.current.rotation.y = p.rot
    }
    strollerAnim.current.moving = p.moving

    // 주변 상호작용 판정
    const st = useStore.getState()
    st.setIf('zone', zoneAt(p.x, p.z))
    st.setIf('inPantry', p.x > PANTRY.x1 && p.z > PANTRY.z1)
    st.setIf('nearBoard', p.x > 6.9 && p.x < 10.1 && p.z > 2.6 && p.z < 4.7)
    st.setIf('nearRoulette', Math.hypot(p.x - ROULETTE.x, p.z - ROULETTE.z) < 1.6)
    st.setIf('nearTree', Math.hypot(p.x - TREE.x, p.z - TREE.z) < 1.7)
    st.setIf('nearCoffee', Math.hypot(p.x - COFFEE.x, p.z - COFFEE.z) < 1.35)
    st.setIf('nearDday', p.x > 20.2 && p.x < 23.4 && p.z < 2.7)
    st.setIf('nearStroller', !p.riding && Math.hypot(p.x - STROLLER.x, p.z - STROLLER.z) < 1.5)
    st.setIf('nearNiro', Math.hypot(p.x - NIRO.x, p.z - NIRO.z) < 1.6)
    st.setIf('nearStory', p.x > 24.5 && p.z < 3.2 && Math.abs(p.x - STORY.x) < 2.2)
    st.setIf('nearNotion', Math.hypot(p.x - (NOTION.x + 0.75), p.z - NOTION.z) < 1.4)
    st.setIf('nearModels', Math.abs(p.x - MODELS.x) < 1.6 && Math.abs(p.z - MODELS.z) < 2.6)
    let near = null
    if (!p.sitting && !glide.current) {
      let best = 1.3
      seats.forEach((s, i) => {
        const c = chairOf(s)
        const d = Math.hypot(p.x - c.x, p.z - c.z)
        if (d < best) {
          best = d
          near = i
        }
      })
    }
    st.setIf('nearSeat', near)
  })

  if (!me) return null
  return (
    <group ref={group}>
      {riding ? (
        <>
          <Stroller anim={strollerAnim} />
          <group position={[0, 0.36, -0.06]} scale={0.72}>
            <Character anim={anim} shirt={me.shirt} hair={me.hair} pants={me.pants} holding={holding} accessory={accessory} />
          </group>
        </>
      ) : (
        <Character anim={anim} shirt={me.shirt} hair={me.hair} pants={me.pants} holding={holding} accessory={accessory} />
      )}
      <HeadOverlay name={me.name} title={me.title} bubble={bubble} emote={emote} mood={mood.e} status={`${status.e} ${status.l}`} outing={status.e === '🚗' ? outing : null} mine />
    </group>
  )
}

function dampAngle(a, b, lambda, dt) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * (1 - Math.exp(-lambda * dt))
}

const STATUS_LABEL = { '💻': '업무중', '☕': '탕비실', '🚗': '외근/현장', '🏗️': '외근/현장', '🏃': '칼퇴대기' }

// 다른 동료 아바타
export function RemotePlayer({ r }) {
  const group = useRef()
  const anim = useRef({ moving: false, sitting: false })
  const strollerAnim = useRef({ moving: false })
  const pos = useRef({ x: r.x, z: r.z, rot: r.rot })
  const jumpSim = useRef({ y: 0, vy: 0, seen: r.jp }) // 점프는 신호를 받으면 내 화면에서 같은 궤적으로 재생 (부드럽게)
  const [bubble, setBubble] = useState(null)
  const [, force] = useState(0)
  useEffect(() => {
    if (!r.bubble) return
    setBubble(r.bubble)
    const t = setTimeout(() => setBubble(null), 5000)
    return () => clearTimeout(t)
  }, [r.bubble?.key])
  const emote = r.emote && r.emote.until > Date.now() ? r.emote : null
  useEffect(() => {
    if (!emote) return
    const t = setTimeout(() => force((n) => n + 1), emote.until - Date.now() + 50)
    return () => clearTimeout(t)
  }, [emote?.key])
  useFrame((_, dt) => {
    const p = pos.current
    p.x = THREE.MathUtils.damp(p.x, r.x, 10, dt)
    p.z = THREE.MathUtils.damp(p.z, r.z, 10, dt)
    p.rot = dampAngle(p.rot, r.rot, 10, dt)
    // 🦘 점프
    const j = jumpSim.current
    if (r.jp !== j.seen) {
      j.seen = r.jp
      if (j.y <= 0.001) j.vy = JUMP_V
    }
    if (j.y > 0 || j.vy > 0) {
      j.vy -= GRAVITY * Math.min(dt, 0.05)
      j.y = Math.max(0, j.y + j.vy * Math.min(dt, 0.05))
      if (j.y === 0) j.vy = 0
    } else if (r.y > 0.05) j.y = THREE.MathUtils.damp(j.y, r.y, 14, dt) // 신호를 놓친 경우 높이값으로 보정
    anim.current.moving = r.moving && !r.sitting && !r.riding
    anim.current.sitting = r.sitting || r.riding
    anim.current.air = j.y > 0.02
    strollerAnim.current.moving = r.moving
    if (group.current) {
      group.current.position.set(p.x, j.y, p.z)
      group.current.rotation.y = p.rot
    }
  })
  const statusText = r.status ? `${r.status} ${STATUS_LABEL[r.status] || ''}`.trim() : null
  return (
    <group ref={group}>
      {r.riding ? (
        <>
          <Stroller anim={strollerAnim} />
          <group position={[0, 0.36, -0.06]} scale={0.72}>
            <Character anim={anim} shirt={r.shirt} hair={r.hair} pants={r.pants} holding={r.holding} accessory={r.accessory} />
          </group>
        </>
      ) : (
        <Character anim={anim} shirt={r.shirt} hair={r.hair} pants={r.pants} holding={r.holding} accessory={r.accessory} />
      )}
      <HeadOverlay name={r.name} title={r.title} bubble={bubble} emote={emote} mood={r.mood} status={statusText} outing={r.outing} />
    </group>
  )
}

export function ClickMarker() {
  const ref = useRef()
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = live.target
    m.visible = !!t
    if (t) {
      m.position.set(t.x, 0.02, t.z)
      const s = 1 + Math.sin(clock.elapsedTime * 6) * 0.12
      m.scale.set(s, s, s)
    }
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.18, 0.26, 32]} />
      <meshBasicMaterial color="#f2a516" transparent opacity={0.9} depthWrite={false} />
    </mesh>
  )
}

export function CameraRig() {
  const { camera, gl } = useThree()
  const look = useRef(new THREE.Vector3(live.player.x, 0.8, live.player.z))
  useEffect(() => {
    const wheel = (e) => {
      live.zoom = THREE.MathUtils.clamp(live.zoom + e.deltaY * 0.0012, 0.45, 1.8)
    }
    gl.domElement.addEventListener('wheel', wheel, { passive: true })
    return () => gl.domElement.removeEventListener('wheel', wheel)
  }, [gl])
  useFrame((_, dt) => {
    const p = live.player
    let tx, ty, tz, lx, lz
    if (live.overview) {
      const aspect = camera.aspect || 1.6
      const vfov = THREE.MathUtils.degToRad(camera.fov)
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect)
      const dist = Math.max((W / 2 + 1.2) / Math.tan(hfov / 2), (D / 2 + 2.5) / Math.tan(vfov / 2) / 0.62) * 1.04
      tx = W / 2
      ty = dist * 0.88
      tz = D / 2 + dist * 0.47
      lx = W / 2
      lz = D / 2 + 1.6
    } else {
      const z = live.zoom
      tx = p.x
      ty = 8.2 * z + 1.2
      tz = p.z + 6.6 * z + 0.6
      lx = p.x
      lz = p.z - 0.4
    }
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tx, 4, dt)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, ty, 4, dt)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, tz, 4, dt)
    look.current.x = THREE.MathUtils.damp(look.current.x, lx, 5, dt)
    look.current.y = 0.8
    look.current.z = THREE.MathUtils.damp(look.current.z, lz, 5, dt)
    camera.lookAt(look.current)
  })
  return null
}
