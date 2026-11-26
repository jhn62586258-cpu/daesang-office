import { create } from 'zustand'
import { START } from './layout'

// 매 프레임 바뀌는 값은 리렌더 없이 공유 (mutable)
export const live = {
  player: { x: START.x, z: START.z, rot: Math.PI, moving: false, sitting: false, y: 0, vy: 0, jumpCount: 0, riding: false },
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
  { e: '🚗', l: '외근/현장' },
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
  globalChat: [], // 전체 채팅 (Firebase /chat)
  rooms: {}, // 내가 속한 그룹방 { id: { name, members, messages } }
  readTick: 0,
  deskArchive: [], // 쪽지 보관함
  snackOptions: [], // 추가 간식 후보
  customRestaurants: [], // 추가 식당
  archiStories: [], // 직원이 공유한 건축 이야기
  treeWishes: [], // 🎄 트리 소원 카드
  ddays: [], // 📅 프로젝트 마감
  archiModels: [], // 📐 진행 중인 프로젝트
  accessory: (() => {
    try {
      const a = localStorage.getItem('archi-office-3d-accessory')
      return a === 'santa' || a === 'rudolph' ? a : null
    } catch {
      return null
    }
  })(), // 🎅 null | 'santa' | 'rudolph'
  holdUntil: 0, // 커피잔을 들고 있는 시간
  lastBrew: null, // ☕ 커피 뽑기 알림 (presence로 전달) { id, at }
  coffeeToasts: [], // 동료의 커피 알림 배너
  nearTree: false,
  nearCoffee: false,
  nearDday: false,
  nearModels: false,
  nearStroller: false,
  nearStory: false,
  nearNotion: false,
  notionUrl: '', // 📌 노션 사내 공지·서식함 링크 (Firebase /office_notion_url)
  vacations: {}, // 🏖️ { 직원이름: { by, at } } (Firebase /vacation_status)
  outing: (() => {
    try {
      const o = JSON.parse(localStorage.getItem('archi-office-3d-outing') || 'null')
      return o && typeof o.dest === 'string' ? o : null
    } catch {
      return null
    }
  })(), // 🚗 외근/현장 { dest: '과천시청', until: '15:30' }
  nearNiro: false,
  riding: false, // 🍼 내가 유모차 탑승 중
  weather: null, // 🌤️ 과천시 실시간 날씨 { temp, code, isDay, label, icon, precip, at }
  weatherError: false,
  weatherOverride: null, // 미리보기: null(실시간) | 'snow' | 'rain' | 'none'
  confirm: null, // 확인창 { title, body, okText, onOk }

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
      holdUntil: Date.now() + (kind === 'coffee' ? 180000 : 25000),
      emote: { kind, key: Math.random(), until: Date.now() + 3200 },
    }),
  // ☕ 커피 한잔 뽑기: 3분간 김 나는 커피잔을 들고 다님 + 동료에게 알림
  brewCoffee: () =>
    set({
      holding: 'coffee',
      holdUntil: Date.now() + 180000,
      emote: { kind: 'coffee', key: Math.random(), until: Date.now() + 3200 },
      lastBrew: { id: Math.random().toString(36).slice(2, 10), at: Date.now() },
    }),
  returnCoffee: () => set({ holding: null, holdUntil: 0 }),
  // 🎅 없음 → 산타 모자 → 루돌프 머리띠 → 없음
  cycleAccessory: () =>
    set((s) => {
      const next = s.accessory === null ? 'santa' : s.accessory === 'santa' ? 'rudolph' : null
      try {
        localStorage.setItem('archi-office-3d-accessory', next || '')
      } catch {}
      return { accessory: next }
    }),
  clearHolding: () => set({ holding: null }),
  clearEmote: () => set({ emote: null }),
  // 스트레칭 완료 → 머리 위 '개운함 ✨'
  refresh: () => set({ emote: { kind: 'fresh', key: Math.random(), until: Date.now() + 4000 } }),
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
