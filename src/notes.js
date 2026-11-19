// 영구 저장 데이터 (게시판 메모 · 책상 쪽지 · 간식 투표)
//
// ▸ Firebase 모드: Realtime Database
//   /board_notes/{id}            게시판 포스트잇
//   /desk_notes/{id}             책상 쪽지
//   /snack_votes/{주차}/{uid}     간식 투표 (1인 1표, 매주 월요일 새 회차)
// ▸ 로컬 모드: localStorage + BroadcastChannel (+ 다른 탭에는 presence로 임시 전달)
import { ref, set, remove as fbRemove, onValue, query, orderByChild, limitToLast } from 'firebase/database'
import { useStore, uid } from './store'
import { firebaseReady } from './firebase'

const HEX = /^#[0-9a-fA-F]{6}$/
const removedIds = new Set() // 떼어낸 임시 메모가 다시 붙지 않게

const s = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '')
function clean(id, d) {
  if (!d || typeof d !== 'object') return null
  return {
    id,
    text: s(d.text, 80),
    color: typeof d.color === 'string' && HEX.test(d.color) ? d.color : '#fff176',
    name: s(d.name, 10),
    title: s(d.title, 6),
    at: typeof d.at === 'number' ? d.at : 0,
    authorId: s(d.authorId, 40),
    tilt: typeof d.tilt === 'number' ? Math.max(-0.2, Math.min(0.2, d.tilt)) : 0,
    seat: s(d.seat, 10),
  }
}

// 메모형 컬렉션 하나를 관리하는 저장소
function makeNoteStore({ collection, lsKey, stateKey, modeKey, max = 80 }) {
  let fb = null
  let bc = null
  const setList = (list) =>
    useStore.setState((st) => {
      const eph = st[stateKey].filter((n) => n.ephemeral && !list.some((m) => m.id === n.id))
      return { [stateKey]: [...list, ...eph].sort((a, b) => b.at - a.at) }
    })
  const loadLocal = () => {
    try {
      const arr = JSON.parse(localStorage.getItem(lsKey) || '[]')
      return Array.isArray(arr) ? arr.map((d) => clean(d.id, d)).filter(Boolean) : []
    } catch {
      return []
    }
  }
  const saveLocal = (list) => {
    try {
      localStorage.setItem(lsKey, JSON.stringify(list.filter((n) => !n.ephemeral).slice(0, max)))
    } catch {}
  }
  const goLocal = () => {
    fb = null
    useStore.getState().set({ [modeKey]: 'local' })
    setList(loadLocal())
    if (!bc && typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(lsKey)
        bc.onmessage = () => setList(loadLocal())
      } catch {}
    }
  }
  return {
    async init() {
      fb = await firebaseReady()
      if (!fb) return goLocal()
      useStore.getState().set({ [modeKey]: 'shared' })
      onValue(
        query(ref(fb.db, collection), orderByChild('at'), limitToLast(max)),
        (snap) => {
          const list = []
          snap.forEach((c) => {
            const n = clean(c.key, c.val())
            if (n && n.text) list.push(n)
          })
          setList(list)
        },
        (e) => {
          console.warn(`[Firebase] ${collection} 읽기 실패 — 보안 규칙을 확인하세요.`, e)
          goLocal()
        }
      )
    },
    async add(fields) {
      const me = useStore.getState().me
      const note = { id: 'n' + Date.now().toString(36) + uid(), name: me.name, title: me.title, at: Date.now(), authorId: me.id, tilt: (Math.random() - 0.5) * 0.24, ...fields }
      if (fb) {
        try {
          const { id, ...body } = note
          await set(ref(fb.db, `${collection}/${id}`), body)
          return { shared: true }
        } catch (e) {
          console.warn(`[Firebase] ${collection} 저장 실패`, e)
        }
      }
      const list = [note, ...loadLocal()]
      saveLocal(list)
      setList(list)
      bc && bc.postMessage('changed')
      return { shared: false }
    },
    async remove(note) {
      removedIds.add(note.id)
      if (fb && !note.ephemeral) {
        try {
          await fbRemove(ref(fb.db, `${collection}/${note.id}`))
          return
        } catch {}
      }
      saveLocal(loadLocal().filter((n) => n.id !== note.id))
      useStore.setState((st) => ({ [stateKey]: st[stateKey].filter((n) => n.id !== note.id) }))
      bc && bc.postMessage('changed')
    },
  }
}

export const boardNotes = makeNoteStore({ collection: 'board_notes', lsKey: 'archi-office-3d-notes', stateKey: 'notes', modeKey: 'notesMode' })
export const deskNotes = makeNoteStore({ collection: 'desk_notes', lsKey: 'archi-office-3d-desknotes', stateKey: 'deskNotes', modeKey: 'deskMode', max: 200 })

export const addNote = (f) => boardNotes.add({ text: f.text.slice(0, 60), color: f.color })
export const deleteNote = (n) => boardNotes.remove(n)

// 로컬 모드: 다른 탭이 presence로 보낸 임시 메모 병합
export function mergeEphemeral(stateKey, peerId, arr) {
  const incoming = arr
    .map((d) => clean(s(d && d.id, 40), d))
    .filter((n) => n && n.id && n.text && !removedIds.has(n.id))
    .map((n) => ({ ...n, authorId: peerId, ephemeral: true }))
  if (!incoming.length) return
  useStore.setState((st) => {
    const have = new Set(st[stateKey].map((n) => n.id))
    const fresh = incoming.filter((n) => !have.has(n.id))
    return fresh.length ? { [stateKey]: [...st[stateKey], ...fresh].sort((a, b) => b.at - a.at) } : {}
  })
}

/* ───────── 간식 투표 ───────── */
export const SNACKS = [
  { k: 'choco', e: '🍫', l: '초코파이 / 몽쉘', c: '#a0522d' },
  { k: 'pretzel', e: '🥨', l: '프레첼 / 과자류', c: '#f59f00' },
  { k: 'zero', e: '🥤', l: '제로 탄산음료', c: '#4dabf7' },
  { k: 'capsule', e: '☕', l: '아메리카노 캡슐', c: '#6f4e37' },
  { k: 'ramen', e: '🍜', l: '컵라면 / 에너지바', c: '#e8590c' },
]
const SNACK_KEYS = SNACKS.map((x) => x.k)

// 투표 회차 = 이번 주 월요일(KST)
export function voteWeek() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000)
  const day = (kst.getUTCDay() + 6) % 7
  const mon = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - day))
  return mon.toISOString().slice(0, 10)
}

const LS_VOTE = 'archi-office-3d-vote'
let voteFb = null
let voteBc = null

export async function initVotes() {
  const week = voteWeek()
  try {
    const v = JSON.parse(localStorage.getItem(LS_VOTE) || 'null')
    if (v && v.week === week && SNACK_KEYS.includes(v.choice)) useStore.getState().set({ myVote: v.choice })
  } catch {}
  voteFb = await firebaseReady()
  if (voteFb) {
    useStore.getState().set({ voteMode: 'shared' })
    onValue(
      ref(voteFb.db, `snack_votes/${week}`),
      (snap) => {
        const votes = {}
        snap.forEach((c) => {
          const v = c.val()
          if (v && SNACK_KEYS.includes(v.choice)) votes[c.key] = v.choice
        })
        useStore.getState().set({ sharedVotes: votes })
        if (votes[voteFb.uid]) useStore.getState().set({ myVote: votes[voteFb.uid] })
      },
      () => {
        voteFb = null
        useStore.getState().set({ voteMode: 'local' })
      }
    )
    return
  }
  useStore.getState().set({ voteMode: 'local' })
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      voteBc = new BroadcastChannel(LS_VOTE)
      voteBc.onmessage = (e) => e.data && SNACK_KEYS.includes(e.data) && useStore.getState().set({ myVote: e.data })
    } catch {}
  }
}

export async function castVote(choice) {
  if (!SNACK_KEYS.includes(choice)) return
  const st = useStore.getState()
  st.set({ myVote: choice })
  const week = voteWeek()
  try {
    localStorage.setItem(LS_VOTE, JSON.stringify({ week, choice }))
  } catch {}
  if (voteFb) {
    try {
      await set(ref(voteFb.db, `snack_votes/${week}/${voteFb.uid}`), { choice, at: Date.now(), name: st.me.name, title: st.me.title })
      return true
    } catch (e) {
      console.warn('[Firebase] 투표 저장 실패', e)
    }
  }
  voteBc && voteBc.postMessage(choice)
  return false
}

// 집계: Firebase 표 / (로컬 모드) 내 표 + 다른 탭의 표
export function tally(st) {
  const counts = Object.fromEntries(SNACK_KEYS.map((k) => [k, 0]))
  if (st.voteMode === 'shared') {
    for (const v of Object.values(st.sharedVotes)) counts[v]++
  } else {
    if (st.myVote) counts[st.myVote]++
    for (const r of Object.values(st.remotes)) if (r.vote && r.voteWeek === voteWeek() && counts[r.vote] !== undefined) counts[r.vote]++
  }
  return counts
}
