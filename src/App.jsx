import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Office from './Office'
import { Player, RemotePlayer, ClickMarker, CameraRig } from './Player'
import { EntryModal, ActionPanel, Modals, HUD, LunchAlerts, ConfirmDialog, CoffeeToasts, JumpButton } from './UI'
import { initWeather } from './weather'
import { Chat } from './ChatPanel'
import { initNet } from './net'
import { initData } from './notes'
import { initChat } from './chat'
import { Ambience } from './Ambience'
import { useStore } from './store'
import { START } from './layout'

function Remotes() {
  const remotes = useStore((s) => s.remotes)
  return Object.values(remotes)
    .filter((r) => r.name)
    .map((r) => <RemotePlayer key={r.id} r={r} />)
}

let started = false
export default function App() {
  const joined = useStore((s) => s.joined)
  useEffect(() => {
    if (started) return
    started = true
    initNet() // 캐릭터 위치·상태 (presence)
    initData() // 게시판·쪽지·보관함·간식 투표·룰렛 식당
    initChat() // 전체 채팅 + 그룹 채팅
    initWeather() // 🌤️ 과천시 실시간 날씨
  }, [])
  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 45, position: [START.x, 14, START.z + 12], near: 0.1, far: 200 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color('#e9e2d6')
          scene.fog = new THREE.Fog('#e9e2d6', 38, 75)
        }}
      >
        <Ambience />
        <Office />
        <ClickMarker />
        {joined && <Player />}
        <Remotes />
        <CameraRig />
      </Canvas>
      <HUD />
      <Chat />
      <LunchAlerts />
      <CoffeeToasts />
      <ActionPanel />
      <JumpButton />
      <Modals />
      <EntryModal />
      <ConfirmDialog />
    </>
  )
}
