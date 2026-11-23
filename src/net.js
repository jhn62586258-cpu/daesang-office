// 실시간 멀티플레이 (캐릭터 위치 · 앉기 · 기분/상태 · 룰렛 결과)
//
// ▸ Firebase 모드: /presence/{uid_탭} — 내 현재 상태 한 덩어리. 접속이 끊기면 onDisconnect로 자동 삭제
// ▸ 로컬 모드: BroadcastChannel — 같은 브라우저의 다른 탭끼리만 공유 (개발/미리보기용)
// (채팅은 chat.js, 저장 데이터는 notes.js 가 담당)
import { ref, set, onChildAdded, onChildChanged, onChildRemoved, onDisconnect, serverTimestamp, remove } from 'firebase/database'
import { live, useStore, fmtTime } from './store'
import { RESTAURANTS } from './restaurants'
import { firebaseReady } from './firebase'
import { myUid } from './db'

let fb = null // { db, uid }
let myRef = null
let bc = null
let lastSent = ''
let lastBeat = 0
const tab = Math.random().toString(36).slice(2, 8)
let sessionKey = 'local_' + tab
const seenSpin = new Set()
const seenBrew = new Set()
const HEX = /^#[0-9a-fA-F]{6}$/

const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '')
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d)
const col = (v, d) => (typeof v === 'string' && HEX.test(v) ? v : d)

// 내 접속 세션 ID (채팅 말풍선을 내 캐릭터에 띄우는 데 사용)
export const getSessionKey = () => sessionKey

export async function initNet() {
  fb = await firebaseReady()
  if (fb) startFirebase()
  else startBroadcast()
  setInterval(publish, 120)
  // 오래 소식이 없는 동료 정리 (네트워크 단절 대비)
  setInterval(() => {
    const now = Date.now()
    const rs = useStore.getState().remotes
    for (const id in rs) if (now - rs[id].seen > (fb ? 45000 : 5000)) useStore.getState().removeRemote(id)
  }, 2000)
}

/* ───────── Firebase ───────── */
function startFirebase() {
  const { db, uid } = fb
  useStore.getState().set({ netMode: 'firebase' })
  sessionKey = `${uid}_${tab}`
  myRef = ref(db, `presence/${sessionKey}`)
  onDisconnect(myRef).remove()
  window.addEventListener('beforeunload', () => remove(myRef))

  const pres = ref(db, 'presence')
  const onPeer = (snap) => snap.key !== sessionKey && applyPeer(snap.key, snap.val())
  onChildAdded(pres, onPeer)
  onChildChanged(pres, onPeer)
  onChildRemoved(pres, (snap) => useStore.getState().removeRemote(snap.key))
}

/* ───────── 로컬 모드 (BroadcastChannel) ───────── */
function startBroadcast() {
  useStore.getState().set({ netMode: 'tabs' })
  if (typeof BroadcastChannel === 'undefined') return
  try {
    bc = new BroadcastChannel('archi-office-3d')
  } catch {
    return
  }
  bc.onmessage = ({ data }) => {
    if (!data || data.tab === tab) return
    if (data.type === 'p') applyPeer('local_' + data.tab, data.presence)
    else if (data.type === 'leave') useStore.getState().removeRemote('local_' + data.tab)
    else if (data.type === 'hello') lastSent = ''
  }
  bc.postMessage({ type: 'hello', tab })
  window.addEventListener('beforeunload', () => bc && bc.postMessage({ type: 'leave', tab }))
}

/* ───────── 내 상태 보내기 ───────── */
function buildPresence() {
  const s = useStore.getState()
  if (!s.me) return null
  const p = live.player
  return {
    u: myUid(), // 그룹방 초대용 고유 ID
    n: s.me.name,
    t: s.me.title,
    sh: s.me.shirt,
    pa: s.me.pants,
    hr: s.me.hair,
    x: Math.round(p.x * 100) / 100,
    y: Math.round((p.y || 0) * 100) / 100, // 🦘 점프 높이
    jp: p.jumpCount || 0, // 🦘 점프 신호 (늘어날 때마다 상대 화면에서 점프 재생)
    rd: p.riding ? 1 : 0, // 🍼 유모차 탑승 중
    r: Math.round(p.rot * 100) / 100,
    m: p.moving ? 1 : 0,
    si: p.sitting ? 1 : 0,
    ho: s.holding || null,
    em: s.emote ? { k: s.emote.kind, u: s.emote.until } : null,
    mo: s.mood.e,
    st: s.status.e,
    sp: s.lastSpin,
    ac: s.accessory, // 🎅 산타 모자 / 🦌 루돌프 머리띠
    cf: s.lastBrew, // ☕ 커피 뽑기 알림
  }
}

function publish() {
  const pr = buildPresence()
  if (!pr) return
  const json = JSON.stringify(pr)
  const now = Date.now()
  const beat = fb ? 15000 : 1000 // 변화가 없어도 주기적으로 '살아있음' 알림
  if (json === lastSent && now - lastBeat < beat) return
  lastSent = json
  lastBeat = now
  if (fb) set(myRef, { ...pr, ts: serverTimestamp() }).catch(() => {})
  else if (bc) bc.postMessage({ type: 'p', tab, presence: pr })
}

/* ───────── 다른 사람의 상태 반영 (신뢰할 수 없는 입력 → 형식 검사) ───────── */
function applyPeer(id, pr) {
  const st = useStore.getState()
  if (!pr || typeof pr.n !== 'string' || !pr.n) {
    if (st.remotes[id]) st.removeRemote(id)
    return
  }
  const name = str(pr.n, 10)
  const title = str(pr.t, 6)
  st.upsertRemote({
    id,
    uid: str(pr.u, 64),
    name,
    title,
    shirt: col(pr.sh, '#a8d0e6'),
    pants: col(pr.pa, '#2f3e55'),
    hair: pr.hr === 'long' ? 'long' : 'short',
    x: num(pr.x, 23),
    y: Math.max(0, Math.min(3, num(pr.y))),
    z: num(pr.z, 8.8),
    jp: num(pr.jp),
    riding: !!pr.rd,
    rot: num(pr.r),
    moving: !!pr.m,
    sitting: !!pr.si,
    holding: pr.ho === 'coffee' || pr.ho === 'cookie' ? pr.ho : null,
    emote: pr.em && typeof pr.em === 'object' ? { kind: ['coffee', 'snack', 'fresh'].includes(pr.em.k) ? pr.em.k : 'snack', until: num(pr.em.u), key: num(pr.em.u) } : null,
    mood: str(pr.mo, 8),
    status: str(pr.st, 8),
    accessory: pr.ac === 'santa' || pr.ac === 'rudolph' ? pr.ac : null,
  })

  // ☕ 동료가 커피를 뽑음 → 1분 이내의 새 소식만 배너로
  if (pr.cf && typeof pr.cf.id === 'string' && !seenBrew.has(id + pr.cf.id)) {
    seenBrew.add(id + pr.cf.id)
    if (Date.now() - num(pr.cf.at) < 60000 && st.joined) {
      const key = id + pr.cf.id
      st.set({ coffeeToasts: [...st.coffeeToasts.slice(-2), { key, name, title, at: Date.now() }] })
      setTimeout(() => {
        const cur = useStore.getState().coffeeToasts
        useStore.getState().set({ coffeeToasts: cur.filter((t) => t.key !== key) })
      }, 7000)
    }
  }

  // 룰렛 결과 (식당 이름을 함께 받아서, 추가 식당 목록이 달라도 정확히 표시)
  if (pr.sp && typeof pr.sp.id === 'string' && !seenSpin.has(id + pr.sp.id)) {
    seenSpin.add(id + pr.sp.id)
    const idx = num(pr.sp.idx, -1)
    const place = str(pr.sp.name, 30) || (idx >= 0 && idx < RESTAURANTS.length ? RESTAURANTS[idx] : '')
    if (place && Date.now() - num(pr.sp.at) < 10 * 60 * 1000) {
      st.addMessage({
        id: 'spin' + id + pr.sp.id,
        system: true,
        spin: true,
        text: `🎰 ${name} ${title}님의 점심 룰렛 결과 → 🍽️ ${place}`,
        time: fmtTime(new Date(num(pr.sp.at, Date.now()))),
        at: num(pr.sp.at, Date.now()),
      })
      if (Date.now() - num(pr.sp.at) < 8000) spinWheel3D()
    }
  }
}

export function spinWheel3D() {
  live.wheelSpin = { start: performance.now(), dur: 4500, turns: 8 + Math.random() * 3 }
}
