import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const SKIN = '#f6d3b8'

function M({ c, ...p }) {
  return <meshStandardMaterial color={c} roughness={0.7} {...p} />
}

// 귀여운 2등신 회사원 캐릭터 (셔츠 + 슬랙스 + 사원증)
// anim: { moving: bool } 을 담은 ref 객체
export default function Character({ anim, shirt = '#a8d0e6', pants = '#2f3e55', hair = 'short', hairColor = '#2b2220', holding = null }) {
  const legL = useRef()
  const legR = useRef()
  const armL = useRef()
  const armR = useRef()
  const body = useRef()
  const head = useRef()
  const phase = useRef(0)
  const amt = useRef(0)
  const sit = useRef(0)

  useFrame((_, dt) => {
    const moving = anim.current?.moving
    const sitting = anim.current?.sitting
    amt.current = THREE.MathUtils.damp(amt.current, moving ? 1 : 0, 10, dt)
    sit.current = THREE.MathUtils.damp(sit.current, sitting ? 1 : 0, 9, dt)
    phase.current += dt * (moving ? 11 : 2)
    const s = Math.sin(phase.current) * amt.current
    const k = sit.current
    // 앉기: 허벅지를 앞으로 접고 팔은 키보드 위로
    const typing = sitting && !moving ? Math.sin(phase.current * 6) * 0.06 : 0
    if (legL.current) legL.current.rotation.x = s * 0.7 * (1 - k) - 1.45 * k
    if (legR.current) legR.current.rotation.x = -s * 0.7 * (1 - k) - 1.45 * k
    if (legL.current) legL.current.rotation.z = 0.08 * k
    if (legR.current) legR.current.rotation.z = -0.08 * k
    if (armL.current) armL.current.rotation.x = -s * 0.6 * (1 - k) + (-0.85 + typing) * k
    if (armR.current) {
      const target = holding ? -1.25 : s * 0.6 * (1 - k) + (-0.85 - typing) * k
      armR.current.rotation.x = THREE.MathUtils.damp(armR.current.rotation.x, target, 12, dt)
    }
    if (body.current)
      body.current.position.y =
        (Math.abs(Math.sin(phase.current)) * 0.05 * amt.current + (1 - amt.current) * Math.sin(phase.current * 0.8) * 0.008) * (1 - k) + 0.03 * k
    if (head.current) head.current.rotation.z = Math.sin(phase.current * 0.5) * 0.04 * amt.current
  })

  return (
    <group>
      {/* 그림자용 원 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[0.28, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <group ref={body}>
        {/* 다리 (슬랙스) */}
        {[
          [legL, -0.09],
          [legR, 0.09],
        ].map(([r, x], i) => (
          <group key={i} ref={r} position={[x, 0.5, 0]}>
            <mesh position={[0, -0.21, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.26, 4, 10]} />
              <M c={pants} />
            </mesh>
            <mesh position={[0, -0.44, 0.04]} castShadow>
              <boxGeometry args={[0.13, 0.08, 0.22]} />
              <M c="#3b2a20" roughness={0.4} />
            </mesh>
          </group>
        ))}
        {/* 몸통 (셔츠) */}
        <mesh position={[0, 0.72, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.22, 6, 16]} />
          <M c={shirt} />
        </mesh>
        {/* 벨트 */}
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.205, 0.205, 0.05, 20]} />
          <M c="#2a2522" />
        </mesh>
        {/* 셔츠 칼라 + 단추 라인 */}
        <mesh position={[-0.06, 0.92, 0.14]} rotation={[0.4, 0, 0.5]}>
          <boxGeometry args={[0.1, 0.04, 0.08]} />
          <M c="#ffffff" />
        </mesh>
        <mesh position={[0.06, 0.92, 0.14]} rotation={[0.4, 0, -0.5]}>
          <boxGeometry args={[0.1, 0.04, 0.08]} />
          <M c="#ffffff" />
        </mesh>
        {[0.82, 0.72, 0.62].map((y) => (
          <mesh key={y} position={[0, y, 0.2]}>
            <sphereGeometry args={[0.012, 6, 6]} />
            <M c="#f5f5f5" />
          </mesh>
        ))}
        {/* 사원증 목걸이 */}
        <mesh position={[0, 0.84, 0.17]} rotation={[0.25, 0, 0]}>
          <torusGeometry args={[0.13, 0.008, 6, 20, Math.PI]} />
          <M c="#1f6feb" />
        </mesh>
        <group position={[0.0, 0.66, 0.205]} rotation={[0.1, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.09, 0.12, 0.01]} />
            <M c="#ffffff" />
          </mesh>
          <mesh position={[0, 0.025, 0.006]}>
            <boxGeometry args={[0.07, 0.03, 0.002]} />
            <M c="#1f6feb" />
          </mesh>
        </group>
        {/* 팔 */}
        {[
          [armL, -0.26, false],
          [armR, 0.26, true],
        ].map(([r, x, right], i) => (
          <group key={i} ref={r} position={[x, 0.86, 0]}>
            <mesh position={[0, -0.15, 0]} rotation={[0, 0, x > 0 ? 0.12 : -0.12]} castShadow>
              <capsuleGeometry args={[0.06, 0.2, 4, 10]} />
              <M c={shirt} />
            </mesh>
            <mesh position={[x > 0 ? 0.03 : -0.03, -0.31, 0]} castShadow>
              <sphereGeometry args={[0.06, 12, 12]} />
              <M c={SKIN} />
            </mesh>
            {right && holding && <HeldItem kind={holding} />}
          </group>
        ))}
        {/* 머리 */}
        <group ref={head} position={[0, 1.27, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.31, 28, 24]} />
            <M c={SKIN} />
          </mesh>
          {/* 머리카락 */}
          <mesh position={[0, 0.06, -0.02]} scale={[1.06, 0.92, 1.06]} castShadow>
            <sphereGeometry args={[0.31, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <M c={hairColor} />
          </mesh>
          <mesh position={[0, -0.02, -0.06]} scale={[1.05, 1, 1]}>
            <sphereGeometry args={[0.31, 24, 16, Math.PI * 0.75, Math.PI * 1.5, Math.PI * 0.3, Math.PI * 0.35]} />
            <M c={hairColor} side={THREE.DoubleSide} />
          </mesh>
          {/* 앞머리 */}
          <mesh position={[0.06, 0.17, 0.2]} rotation={[0.6, 0, -0.4]} scale={[1.6, 0.5, 0.8]}>
            <sphereGeometry args={[0.1, 12, 10]} />
            <M c={hairColor} />
          </mesh>
          {hair === 'long' && (
            <>
              <mesh position={[0, -0.18, -0.12]} scale={[1, 1.4, 0.7]} castShadow>
                <sphereGeometry args={[0.27, 20, 16]} />
                <M c={hairColor} />
              </mesh>
              <mesh position={[-0.27, -0.1, 0.02]} scale={[0.4, 1.3, 0.6]}>
                <sphereGeometry args={[0.16, 12, 10]} />
                <M c={hairColor} />
              </mesh>
              <mesh position={[0.27, -0.1, 0.02]} scale={[0.4, 1.3, 0.6]}>
                <sphereGeometry args={[0.16, 12, 10]} />
                <M c={hairColor} />
              </mesh>
            </>
          )}
          {/* 눈 */}
          {[-0.1, 0.1].map((x) => (
            <group key={x} position={[x, 0.0, 0.28]}>
              <mesh scale={[1, 1.25, 0.6]}>
                <sphereGeometry args={[0.04, 12, 12]} />
                <M c="#1d1d1f" roughness={0.2} />
              </mesh>
              <mesh position={[0.012, 0.018, 0.02]}>
                <sphereGeometry args={[0.012, 8, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
          {/* 볼터치 */}
          {[-0.17, 0.17].map((x) => (
            <mesh key={x} position={[x, -0.08, 0.25]} scale={[1, 0.6, 0.4]}>
              <sphereGeometry args={[0.05, 10, 10]} />
              <meshStandardMaterial color="#ff9a9a" transparent opacity={0.6} />
            </mesh>
          ))}
          {/* 입 */}
          <mesh position={[0, -0.1, 0.285]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.035, 0.009, 6, 12, Math.PI]} />
            <M c="#b5534a" />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function HeldItem({ kind }) {
  if (kind === 'coffee')
    return (
      <group position={[0.03, -0.36, 0.05]} rotation={[1.25, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.065, 0.05, 0.17, 16]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0.0, 0]}>
          <cylinderGeometry args={[0.068, 0.06, 0.07, 16]} />
          <meshStandardMaterial color="#a0703f" />
        </mesh>
        <mesh position={[0, 0.095, 0]}>
          <cylinderGeometry args={[0.07, 0.068, 0.025, 16]} />
          <meshStandardMaterial color="#3d2b1f" />
        </mesh>
        <mesh position={[0, 0.115, 0]}>
          <cylinderGeometry args={[0.072, 0.072, 0.015, 16]} />
          <meshStandardMaterial color="#f5f0e8" />
        </mesh>
      </group>
    )
  return (
    <group position={[0.03, -0.38, 0.06]} rotation={[1.25, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.025, 20]} />
        <meshStandardMaterial color="#d49a5a" roughness={0.9} />
      </mesh>
      {[
        [0.03, 0.02],
        [-0.03, -0.01],
        [0.0, -0.04],
        [-0.02, 0.04],
      ].map(([a, b], i) => (
        <mesh key={i} position={[a, b, 0.014]}>
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshStandardMaterial color="#3d2416" />
        </mesh>
      ))}
    </group>
  )
}
