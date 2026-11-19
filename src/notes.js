// 영구 저장 데이터
//   /board_notes/{id}             사내 자유 게시판 포스트잇 (익명 가능)
//   /desk_notes/{id}              책상에 붙은 쪽지
//   /desk_notes_archive/{id}      확인 완료(떼어낸) 쪽지 보관함
//   /snack_options/{id}           직원이 추가한 간식 후보
//   /snack_votes/{주차}/{uid}      간식 투표 (1인 1표, 매주 월요일 새 회차)
//   /custom_restaurants/{id}      직원이 추가한 점심 룰렛 식당
import { useStore, uid } from './store'
import { dbOn, dbSet, dbRemove, myUid, isFirebase, dbReady } from './db'

const HEX = /^#[0-9a-fA-F]{6}$/
const s = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '')
const n0 = (v) => (typeof v === 'number' && isFinite(v) ? v : 0)

function cleanNote(id, d) {
  if (!d || typeof d !== 'object') return null
  return {
    id,
    text: s(d.text, 80),
    color: typeof d.color === 'string' && HEX.test(d.color) ? d.color : '#fff176',
    name: s(d.name, 10),
    title: s(d.title, 6),
    anon: !!d.anon,
    at: n0(d.at),
    authorId: s(d.authorId, 40),
    tilt: typeof d.tilt === 'number' ? Math.max(-0.2, Math.min(0.2, d.tilt)) : 0,
    seat: s(d.seat, 10),
    checkedAt: n0(d.checkedAt),
    checkedBy: s(d.checkedBy, 20),
  }
}
const toList = (obj, cleaner) =>
  Object.entries(obj || {})
    .map(([k, v]) => cleaner(k, v))
    .filter((x) => x && (x.text || x.label || x.name))
    .sort((a, b) => b.at - a.at)

const mode = () => (isFirebase() ? 'shared' : 'local')

/* ───────── 초기화: 모든 구독 시작 ───────── */
export async function initData() {
  await dbReady()
  const st = useStore.getState()
  st.set({ notesMode: mode(), deskMode: mode(), voteMode: mode() })
  dbOn('board_notes', (v) => useStore.getState().set({ notes: toList(v, cleanNote) }), { last: 80 })
  dbOn('desk_notes', (v) => useStore.getState().set({ deskNotes: toList(v, cleanNote) }), { last: 200 })
  dbOn('desk_notes_archive', (v) => useStore.getState().set({ deskArchive: toList(v, cleanNote) }), { last: 300 })
  dbOn('snack_options', (v) =>
    useStore.getState().set({
      snackOptions: toList(v, (k, d) => (d && typeof d === 'object' ? { id: k, label: s(d.label, 20), emoji: s(d.emoji, 4) || '🍬', by: s(d.by, 20), at: n0(d.at) } : null)).reverse(),
    })
  )
  dbOn(`snack_votes/${voteWeek()}`, (v) => {
    const votes = {}
    for (const [k, d] of Object.entries(v || {})) if (d && typeof d.choice === 'string') votes[k] = d.choice.slice(0, 40)
    useStore.getState().set({ sharedVotes: votes, myVote: votes[myUid()] || null })
  })
  dbOn('custom_restaurants', (v) =>
    useStore.getState().set({
      customRestaurants: toList(v, (k, d) => (d && typeof d === 'object' ? { id: k, name: s(d.name, 30), by: s(d.by, 20), at: n0(d.at) } : null)).reverse(),
    })
  )
}

/* ───────── 게시판 메모 ───────── */
export async function addNote({ text, color, anon }) {
  const me = useStore.getState().me
  const id = 'n' + Date.now().toString(36) + uid()
  await dbSet(`board_notes/${id}`, {
    text: text.slice(0, 60),
    color,
    anon: !!anon,
    name: anon ? '' : me.name, // 익명이면 이름을 아예 저장하지 않음
    title: anon ? '' : me.title,
    at: Date.now(),
    authorId: myUid(),
    tilt: (Math.random() - 0.5) * 0.24,
  })
}
export const deleteNote = (note) => dbRemove(`board_notes/${note.id}`)
export const noteAuthor = (n) => (n.anon || !n.name ? '익명' : `${n.name} ${n.title}`.trim())

/* ───────── 책상 쪽지 + 보관함 ───────── */
export async function addDeskNote({ seat, text, color }) {
  const me = useStore.getState().me
  const id = 'd' + Date.now().toString(36) + uid()
  await dbSet(`desk_notes/${id}`, {
    seat,
    text: text.slice(0, 50),
    color,
    name: me.name,
    title: me.title,
    at: Date.now(),
    authorId: myUid(),
    tilt: (Math.random() - 0.5) * 0.24,
  })
}

// 확인 완료(떼어내기) → 보관함으로 이동
export async function archiveDeskNote(note) {
  const me = useStore.getState().me
  const { id, ...body } = note
  await dbSet(`desk_notes_archive/${id}`, { ...body, checkedAt: Date.now(), checkedBy: `${me.name} ${me.title}` })
  await dbRemove(`desk_notes/${id}`)
}
export const deleteArchived = (note) => dbRemove(`desk_notes_archive/${note.id}`)

/* ───────── 간식 투표 ───────── */
export const SNACKS = [
  { k: 'choco', e: '🍫', l: '초코파이 / 몽쉘', c: '#a0522d' },
  { k: 'pretzel', e: '🥨', l: '프레첼 / 과자류', c: '#f59f00' },
  { k: 'zero', e: '🥤', l: '제로 탄산음료', c: '#4dabf7' },
  { k: 'capsule', e: '☕', l: '아메리카노 캡슐', c: '#6f4e37' },
  { k: 'ramen', e: '🍜', l: '컵라면 / 에너지바', c: '#e8590c' },
]
const EXTRA_COLORS = ['#cc5de8', '#20c997', '#ff6b6b', '#fab005', '#5c7cfa', '#f06595', '#94d82d', '#15aabf']
const SNACK_EMOJI = { 젤리: '🍬', 아이스크림: '🍦', 빵: '🍞', 도넛: '🍩', 쿠키: '🍪', 과일: '🍎', 요거트: '🥛', 우유: '🥛', 견과: '🥜', 떡: '🍡', 치즈: '🧀', 사탕: '🍭', 녹차: '🍵', 차: '🍵', 주스: '🧃', 바나나: '🍌', 케이크: '🍰', 초콜릿: '🍫', 감자: '🥔', 팝콘: '🍿' }

// 기본 후보 + 직원이 추가한 후보
export function snackList(st) {
  const custom = st.snackOptions.map((o, i) => ({ k: 'c_' + o.id, e: o.emoji, l: o.label, c: EXTRA_COLORS[i % EXTRA_COLORS.length], custom: o }))
  return [...SNACKS, ...custom]
}

// 투표 회차 = 이번 주 월요일(KST)
export function voteWeek() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000)
  const day = (kst.getUTCDay() + 6) % 7
  const mon = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - day))
  return mon.toISOString().slice(0, 10)
}

export async function castVote(choice) {
  const st = useStore.getState()
  if (!snackList(st).some((x) => x.k === choice)) return
  st.set({ myVote: choice })
  await dbSet(`snack_votes/${voteWeek()}/${myUid()}`, { choice, at: Date.now(), name: st.me.name, title: st.me.title })
}

export async function addSnackOption(label) {
  const t = label.trim().slice(0, 20)
  if (!t) return
  const me = useStore.getState().me
  const emoji = Object.entries(SNACK_EMOJI).find(([k]) => t.includes(k))?.[1] || '🍬'
  const id = 's' + Date.now().toString(36) + uid()
  await dbSet(`snack_options/${id}`, { label: t, emoji, by: `${me.name} ${me.title}`, at: Date.now() })
}
export const removeSnackOption = (opt) => dbRemove(`snack_options/${opt.id}`)

// 집계 (삭제된 후보에 대한 표는 제외)
export function tally(st) {
  const list = snackList(st)
  const counts = Object.fromEntries(list.map((x) => [x.k, 0]))
  for (const v of Object.values(st.sharedVotes)) if (counts[v] !== undefined) counts[v]++
  return counts
}

/* ───────── 점심 룰렛 식당 ───────── */
export async function addRestaurant(name) {
  const t = name.trim().slice(0, 30)
  if (!t) return
  const me = useStore.getState().me
  const id = 'r' + Date.now().toString(36) + uid()
  await dbSet(`custom_restaurants/${id}`, { name: t, by: `${me.name} ${me.title}`, at: Date.now() })
}
export const removeRestaurant = (r) => dbRemove(`custom_restaurants/${r.id}`)
