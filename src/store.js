import { create } from 'zustand'
import { START } from './layout'

// 매 프레임 바뀌는 값은 리렌더 없이 공유 (mutable)
export const live = {
  player: { x: START.x, z: START.z, rot: Math.PI, moving: false, sitting: false },
  target: null, // 클릭 이동 목표 표시용
  overview: false,
  zoom: 1,
  wheelSpin: null, // 3D 룰렛 회전 { start, dur, from, to }
}

export const MOODS = [
  { e: '😊', l: '기쁨' },
  { e: '😢', l: '슬픔' },
  { e: '😡', l: '화남' },
  { e: '😴', l: '졸림' },
  { e: '🔥', l: '열정' },
]
export const STATUSES = [
  { e: '💻', l: '업무중' },
  { e: '☕', l: '탕비실' },
  { e: '🏗️', l: '현장외근' },
  { e: '🏃', l: '칼퇴대기' },
]

export const useStore = create((set, get) => ({
  me: null, // { id, name, title, shirt, pants, hair }
  joined: false,
  zone: '주출입구 홀',
  // 주변 상호작용
  inPantry: false,
  nearSeat: null, // seats 인덱스
  nearBoard: false,
  nearRoulette: false,
  sitting: null, // 앉아 있는 seats 인덱스
  overview: false,
  messages: [],
  bubble: null,
  holding: null,
  emote: null,
  mood: MOODS[0],
  status: STATUSES[0],
  remotes: {},
  notes: [], // 게시판 메모
  notesMode: 'local', // 'shared' | 'local'
  modal: null, // 'noteWrite' | 'board' | { note } | 'roulette'
  myChats: [], // presence로 내보내는 최근 채팅
  lastSpin: null,
  deskNotes: [], // 책상 쪽지
  deskMode: 'local',
  sharedVotes: {}, // 간식 투표 { 투표자id: 간식키 }
  myVote: null,
  voteMode: 'local',
  lightMode: 'auto', // 'auto' | 'day' | 'sunset' | 'night'
  timeMode: 'day', // 실제 적용 중인 조명
  musicOn: false,
  toast: null, // 점심 알림 배너

  join: (me) => set({ me, joined: true }),
  set: (patch) => set(patch),
  setIf: (k, v) => get()[k] !== v && set({ [k]: v }),
  toggleOverview: () => {
    live.overview = !get().overview
    set({ overview: live.overview })
  },
  addMessage: (m) =>
    set((s) => (s.messages.some((x) => x.id === m.id) ? s : { messages: [...s.messages.slice(-150), m] })),
  setBubble: (text) => set({ bubble: { text, until: Date.now() + 5000, key: Math.random() } }),
  clearBubble: () => set({ bubble: null }),
  doAction: (kind) =>
    set({
      holding: kind === 'coffee' ? 'coffee' : 'cookie',
      emote: { kind, key: Math.random(), until: Date.now() + 3200 },
    }),
  clearHolding: () => set({ holding: null }),
  clearEmote: () => set({ emote: null }),
  upsertRemote: (r) => set((s) => ({ remotes: { ...s.remotes, [r.id]: { ...s.remotes[r.id], ...r, seen: Date.now() } } })),
  removeRemote: (id) =>
    set((s) => {
      const n = { ...s.remotes }
      delete n[id]
      return { remotes: n }
    }),
}))

export const fmtTime = (d) => d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
export const uid = () => Math.random().toString(36).slice(2, 10)
