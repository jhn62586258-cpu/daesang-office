import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Office from './Office'
import { Player, RemotePlayer, ClickMarker, CameraRig } from './Player'
import { useEffect } from 'react'
import { EntryModal, Chat, ActionPanel, Modals, HUD, LunchAlerts } from './UI'
import { initNet } from './net'
import { boardNotes, deskNotes, initVotes } from './notes'
import { Ambience } from './Ambience'
import { useStore } from './store'
import { W, D, START } from './layout'

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
    initNet()
    boardNotes.init()
    deskNotes.init()
    initVotes()
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
      <ActionPanel />
      <Modals />
      <EntryModal />
    </>
  )
}
