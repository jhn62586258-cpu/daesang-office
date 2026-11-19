// 한국 시간(KST) 연동 조명: 낮 / 노을 / 야근
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { W, D } from './layout'
import { useStore } from './store'

export function kstNow() {
  return new Date(Date.now() + 9 * 3600 * 1000) // UTC 메서드로 읽으면 KST
}
export function kstMode() {
  const h = kstNow().getUTCHours()
  if (h >= 7 && h < 17) return 'day'
  if (h === 17) return 'sunset'
  return 'night'
}
export const MODE_LABEL = { day: '☀️ 낮', sunset: '🌅 노을', night: '🌙 야근' }

// 여러 컴포넌트가 공유하는 조명 재질 (책상 스탠드 전구, 바닥 빛 웅덩이, 천장 조명)
export const lampMats = {
  bulb: new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffcf7a', emissiveIntensity: 0 }),
  fixture: new THREE.MeshStandardMaterial({ color: '#f5f1e8', emissive: '#ffe2ad', emissiveIntensity: 0 }),
  glow: null,
}
function makeGlowMat() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,214,140,1)')
  grd.addColorStop(0.45, 'rgba(255,190,110,0.45)')
  grd.addColorStop(1, 'rgba(255,170,90,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
}
export function glowMat() {
  return (lampMats.glow ||= makeGlowMat())
}

const P = {
  day: {
    bg: '#d9e9f3', hemiSky: '#fff6e8', hemiGround: '#b8a990', hemi: 0.85, amb: 0.25, ambC: '#ffe9d0',
    sun: '#fff1dc', sunI: 1.7, sunPos: [W / 2 + 6, 18, D / 2 - 10], ground: '#cfc6b8', walk: '#d9d3c9',
    ceil: 0, lamp: 0, glow: 0, fixture: 0, exposure: 1.05, fogNear: 38,
  },
  sunset: {
    bg: '#e9b394', hemiSky: '#ffe0c8', hemiGround: '#8a7466', hemi: 0.7, amb: 0.22, ambC: '#ffcfae',
    sun: '#ff9a5c', sunI: 1.45, sunPos: [W / 2 - 22, 6.5, D / 2 - 14], ground: '#9c8c84', walk: '#a8968c',
    ceil: 0.55, lamp: 0.7, glow: 0.35, fixture: 0.6, exposure: 1.0, fogNear: 34,
  },
  night: {
    bg: '#121a30', hemiSky: '#5868a0', hemiGround: '#2a2630', hemi: 0.3, amb: 0.14, ambC: '#8090c0',
    sun: '#9fb4ff', sunI: 0.28, sunPos: [W / 2 + 10, 16, D / 2 - 12], ground: '#2f3240', walk: '#3a3d4b',
    ceil: 1, lamp: 2.2, glow: 0.85, fixture: 1.6, exposure: 1.0, fogNear: 30,
  },
}

// 천장 조명 위치 (보이지 않는 점광원 + 슬림 펜던트)
const CEIL = [
  [2.3, 2.3], [2.3, 7.2], [7.6, 5.0], [11.3, 1.6], [16.3, 1.6], [12.0, 6.5],
  [15.45, 6.5], [18.4, 6.4], [22.3, 2.0], [22.6, 5.6], [26.4, 4.0], [27.0, 8.6],
]
const PENDANTS = [
  { x: 15.45, z: 6.5, l: 2.8, alongZ: true },
  { x: 8.2, z: 5.95, l: 1.6 },
  { x: 1.65, z: 7.0, l: 0.9 },
  { x: 2.0, z: 1.35, l: 1.4 },
  { x: 22.6, z: 4.6, l: 1.6, alongZ: true },
]

function skyTexture(mode) {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 512
  const g = c.getContext('2d')
  const grd = g.createLinearGradient(0, 0, 0, 512)
  if (mode === 'day') {
    grd.addColorStop(0, '#5aa9e6')
    grd.addColorStop(0.7, '#a9d6f5')
    grd.addColorStop(1, '#e6f3fb')
  } else if (mode === 'sunset') {
    grd.addColorStop(0, '#3d3b7a')
    grd.addColorStop(0.35, '#c4547a')
    grd.addColorStop(0.7, '#ff8c42')
    grd.addColorStop(1, '#ffd08a')
  } else {
    grd.addColorStop(0, '#060a1a')
    grd.addColorStop(0.6, '#152043')
    grd.addColorStop(1, '#283a6b')
  }
  g.fillStyle = grd
  g.fillRect(0, 0, 2048, 512)
  let seed = 3
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  if (mode === 'day') {
    g.fillStyle = '#fff7d6'
    g.beginPath()
    g.arc(1540, 110, 46, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,0.85)'
    for (let i = 0; i < 9; i++) {
      const x = r() * 2048
      const y = 60 + r() * 160
      for (let k = 0; k < 5; k++) {
        g.beginPath()
        g.arc(x + k * 34, y + Math.sin(k) * 10, 26 + r() * 18, 0, Math.PI * 2)
        g.fill()
      }
    }
  } else if (mode === 'sunset') {
    g.fillStyle = 'rgba(255,214,140,0.95)'
    g.beginPath()
    g.arc(420, 330, 70, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(255,170,120,0.5)'
    for (let i = 0; i < 6; i++) g.fillRect(r() * 2048, 120 + r() * 160, 200 + r() * 260, 10 + r() * 8)
  } else {
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`
      const s = r() * 2.2 + 0.6
      g.fillRect(r() * 2048, r() * 300, s, s)
    }
    g.fillStyle = '#f5f1d8'
    g.beginPath()
    g.arc(1620, 100, 34, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = grd
    g.beginPath()
    g.arc(1606, 92, 30, 0, Math.PI * 2)
    g.fill()
  }
  // 도시 스카이라인
  let x = 0
  while (x < 2048) {
    const w = 50 + r() * 110
    const h = 90 + r() * 230
    const y = 512 - h
    g.fillStyle = mode === 'day' ? `rgba(120,140,160,${0.55 + r() * 0.2})` : mode === 'sunset' ? `rgba(70,45,70,${0.85 + r() * 0.15})` : `rgba(18,22,40,1)`
    g.fillRect(x, y, w, h)
    if (mode !== 'day') {
      for (let wy = y + 10; wy < 500; wy += 16)
        for (let wx = x + 7; wx < x + w - 8; wx += 13)
          if (r() < (mode === 'night' ? 0.42 : 0.18)) {
            g.fillStyle = r() < 0.8 ? 'rgba(255,214,120,0.9)' : 'rgba(170,210,255,0.85)'
            g.fillRect(wx, wy, 6, 8)
          }
    }
    x += w + 4 + r() * 10
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function Ambience() {
  const { scene, gl } = useThree()
  const hemi = useRef()
  const amb = useRef()
  const sun = useRef()
  const ceil = useRef([])
  const ground = useRef()
  const walk = useRef()
  const lightMode = useStore((s) => s.lightMode)
  const timeMode = useStore((s) => s.timeMode)
  const skies = useMemo(() => ({ day: skyTexture('day'), sunset: skyTexture('sunset'), night: skyTexture('night') }), [])
  const tmp = useMemo(() => new THREE.Color(), [])

  // 1분마다 KST 확인 (미리보기 모드면 고정)
  useEffect(() => {
    const tick = () => useStore.getState().set({ timeMode: lightMode === 'auto' ? kstMode() : lightMode })
    tick()
    const t = setInterval(tick, 30000)
    return () => clearInterval(t)
  }, [lightMode])

  useEffect(() => {
    scene.fog = scene.fog || new THREE.Fog('#e9e2d6', 38, 75)
    if (!(scene.background instanceof THREE.Color)) scene.background = new THREE.Color('#e9e2d6')
  }, [scene])

  useFrame((_, dt) => {
    const p = P[useStore.getState().timeMode]
    const k = 1 - Math.exp(-2.5 * dt) // 부드러운 전환
    const lc = (col, hex) => col.lerp(tmp.set(hex), k)
    const ln = (a, b) => a + (b - a) * k
    lc(scene.background, p.bg)
    lc(scene.fog.color, p.bg)
    scene.fog.near = ln(scene.fog.near, p.fogNear)
    if (hemi.current) {
      lc(hemi.current.color, p.hemiSky)
      lc(hemi.current.groundColor, p.hemiGround)
      hemi.current.intensity = ln(hemi.current.intensity, p.hemi)
    }
    if (amb.current) {
      lc(amb.current.color, p.ambC)
      amb.current.intensity = ln(amb.current.intensity, p.amb)
    }
    if (sun.current) {
      lc(sun.current.color, p.sun)
      sun.current.intensity = ln(sun.current.intensity, p.sunI)
      sun.current.position.x = ln(sun.current.position.x, p.sunPos[0])
      sun.current.position.y = ln(sun.current.position.y, p.sunPos[1])
      sun.current.position.z = ln(sun.current.position.z, p.sunPos[2])
    }
    ceil.current.forEach((l) => l && (l.intensity = ln(l.intensity, p.ceil * 4.2)))
    lampMats.bulb.emissiveIntensity = ln(lampMats.bulb.emissiveIntensity, p.lamp)
    lampMats.fixture.emissiveIntensity = ln(lampMats.fixture.emissiveIntensity, p.fixture)
    const gm = glowMat()
    gm.opacity = ln(gm.opacity, p.glow)
    if (ground.current) lc(ground.current.color, p.ground)
    if (walk.current) lc(walk.current.color, p.walk)
    gl.toneMappingExposure = ln(gl.toneMappingExposure, p.exposure)
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#fff6e8', '#b8a990', 0.85]} />
      <ambientLight ref={amb} intensity={0.25} color="#ffe9d0" />
      <directionalLight
        ref={sun}
        position={[W / 2 + 6, 18, D / 2 - 10]}
        intensity={1.7}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[4096, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={60}
      >
        <object3D attach="target" position={[W / 2, 0, D / 2]} />
      </directionalLight>
      {CEIL.map(([x, z], i) => (
        <pointLight key={i} ref={(l) => (ceil.current[i] = l)} position={[x, 2.45, z]} intensity={0} distance={6.5} decay={1.6} color="#ffd9a8" />
      ))}
      {PENDANTS.map((p, i) => (
        <group key={i} position={[p.x, 2.42, p.z]} rotation={[0, p.alongZ ? Math.PI / 2 : 0, 0]}>
          <mesh material={lampMats.fixture}>
            <boxGeometry args={[p.l, 0.04, 0.08]} />
          </mesh>
          {[-p.l / 2 + 0.1, p.l / 2 - 0.1].map((u) => (
            <mesh key={u} position={[u, 0.15, 0]}>
              <cylinderGeometry args={[0.004, 0.004, 0.3]} />
              <meshBasicMaterial color="#555" />
            </mesh>
          ))}
        </group>
      ))}
      {/* 창밖 하늘 + 도시 스카이라인 */}
      <mesh position={[W / 2, 5, -5]}>
        <planeGeometry args={[80, 18]} />
        <meshBasicMaterial map={skies[timeMode]} fog={false} />
      </mesh>
      {/* 바깥 지면 */}
      <mesh position={[W / 2, -0.03, D / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W + 60, D + 40]} />
        <meshStandardMaterial ref={ground} color="#cfc6b8" roughness={1} />
      </mesh>
      <mesh position={[W / 2, -0.015, D + 1.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W + 1, 2.6]} />
        <meshStandardMaterial ref={walk} color="#d9d3c9" roughness={1} />
      </mesh>
    </>
  )
}
