// 실시간 멀티플레이 (캐릭터 위치 · 상태/기분 · 채팅 · 룰렛 결과)
//
// ▸ Firebase 모드 (firebaseConfig 입력 시)
//   /presence/{uid_탭}  — 내 현재 상태 한 덩어리. 접속이 끊기면 onDisconnect로 자동 삭제
//   /chat/{pushId}      — 채팅 기록 (최근 40개를 불러와 늦게 들어온 사람도 볼 수 있음)
// ▸ 로컬 모드 (설정 없음)
//   BroadcastChannel — 같은 브라우저의 다른 탭끼리만 공유 (개발/미리보기용)
import { ref, set, push, onChildAdded, onChildChanged, onChildRemoved, onDisconnect, query, limitToLast, serverTimestamp, remove } from 'firebase/database'
import { live, useStore, fmtTime } from './store'
import { RESTAURANTS } from './restaurants'
import { mergeEphemeral, voteWeek } from './notes'
import { firebaseReady } from './firebase'

let fb = null // { db, uid }
let myKey = null
let myRef = null
let bc = null
let lastSent = ''
let lastBeat = 0
const tab = Math.random().toString(36).slice(2, 8)
const seenChat = new Set()
const seenSpin = new Set()
const HEX = /^#[0-9a-fA-F]{6}$/

const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '')
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d)
const col = (v, d) => (typeof v === 'string' && HEX.test(v) ? v : d)

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
  myKey = `${uid}_${tab}`
  myRef = ref(db, `presence/${myKey}`)
  onDisconnect(myRef).remove()
  window.addEventListener('beforeunload', () => remove(myRef))

  const pres = ref(db, 'presence')
  const onPeer = (snap) => snap.key !== myKey && applyPeer(snap.key, snap.val())
  onChildAdded(pres, onPeer)
  onChildChanged(pres, onPeer)
  onChildRemoved(pres, (snap) => useStore.getState().removeRemote(snap.key))

  onChildAdded(query(ref(db, 'chat'), limitToLast(40)), (snap) => {
    const m = snap.val()
    if (!m || seenChat.has(snap.key)) return
    seenChat.add(snap.key)
    if (m.sid === myKey) return // 내가 보낸 건 이미 화면에 있음
    const text = str(m.text, 80)
    if (!text) return
    const st = useStore.getState()
    st.addMessage({ id: snap.key, from: m.sid, name: str(m.name, 10), title: str(m.title, 6), shirt: col(m.shirt, '#a8d0e6'), text, time: str(m.time, 12) })
    if (Date.now() - num(m.at) < 8000) st.upsertRemote({ id: m.sid, bubble: { text, key: snap.key } })
  })
}

// 채팅 보내기 (UI에서 호출)
export function sendChat(msg) {
  if (fb) {
    push(ref(fb.db, 'chat'), {
      sid: myKey,
      uid: fb.uid,
      name: msg.name,
      title: msg.title,
      shirt: msg.shirt,
      text: msg.text,
      time: msg.time,
      at: Date.now(),
    }).catch((e) => console.warn('[Firebase] 채팅 전송 실패', e))
  } else {
    const st = useStore.getState()
    st.set({ myChats: [...st.myChats.slice(-3), { id: msg.id, x: msg.text, tm: msg.time, at: Date.now() }] })
  }
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
    if (data.type === 'p') applyPeer(data.tab, data.presence)
    else if (data.type === 'leave') useStore.getState().removeRemote(data.tab)
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
  const pr = {
    n: s.me.name,
    t: s.me.title,
    sh: s.me.shirt,
    pa: s.me.pants,
    hr: s.me.hair,
    x: Math.round(p.x * 100) / 100,
    z: Math.round(p.z * 100) / 100,
    r: Math.round(p.rot * 100) / 100,
    m: p.moving ? 1 : 0,
    si: p.sitting ? 1 : 0,
    ho: s.holding || null,
    em: s.emote ? { k: s.emote.kind, u: s.emote.until } : null,
    mo: s.mood.e,
    st: s.status.e,
    sp: s.lastSpin,
    vt: s.myVote ? { w: voteWeek(), c: s.myVote } : null,
  }
  if (!fb) {
    // 로컬 모드에서만: 채팅·메모를 presence에 실어 다른 탭으로 전달
    pr.c = s.myChats
    pr.nl = s.notes.filter((n) => n.authorId === s.me.id && !n.ephemeral).slice(0, 4)
    pr.dl = s.deskNotes.filter((n) => n.authorId === s.me.id && !n.ephemeral).slice(0, 4)
  }
  return pr
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
  const shirt = col(pr.sh, '#a8d0e6')
  st.upsertRemote({
    id,
    name,
    title,
    shirt,
    pants: col(pr.pa, '#2f3e55'),
    hair: pr.hr === 'long' ? 'long' : 'short',
    x: num(pr.x, 23),
    z: num(pr.z, 8.8),
    rot: num(pr.r),
    moving: !!pr.m,
    sitting: !!pr.si,
    holding: pr.ho === 'coffee' || pr.ho === 'cookie' ? pr.ho : null,
    emote: pr.em && typeof pr.em === 'object' ? { kind: pr.em.k === 'coffee' ? 'coffee' : 'snack', until: num(pr.em.u), key: num(pr.em.u) } : null,
    mood: str(pr.mo, 8),
    status: str(pr.st, 8),
    vote: pr.vt && typeof pr.vt.c === 'string' ? str(pr.vt.c, 12) : null,
    voteWeek: pr.vt ? str(pr.vt.w, 12) : null,
  })

  // 로컬 모드 채팅
  if (Array.isArray(pr.c)) {
    for (const c of pr.c.slice(-5)) {
      if (!c || typeof c.id !== 'string' || seenChat.has(id + c.id)) continue
      seenChat.add(id + c.id)
      const text = str(c.x, 80)
      if (!text) continue
      st.addMessage({ id: id + c.id, from: id, name, title, shirt, text, time: str(c.tm, 12) })
      if (Date.now() - num(c.at) < 6000) st.upsertRemote({ id, bubble: { text, key: c.id } })
    }
  }
  // 룰렛 결과
  if (pr.sp && typeof pr.sp.id === 'string' && !seenSpin.has(id + pr.sp.id)) {
    seenSpin.add(id + pr.sp.id)
    const idx = num(pr.sp.idx, -1)
    if (idx >= 0 && idx < RESTAURANTS.length && Date.now() - num(pr.sp.at) < 10 * 60 * 1000) {
      st.addMessage({
        id: 'spin' + id + pr.sp.id,
        system: true,
        spin: true,
        text: `🎰 ${name} ${title}님의 점심 룰렛 결과 → 🍽️ ${RESTAURANTS[idx]}`,
        time: fmtTime(new Date(num(pr.sp.at, Date.now()))),
      })
      if (Date.now() - num(pr.sp.at) < 8000) spinWheel3D()
    }
  }
  if (Array.isArray(pr.nl) && pr.nl.length) mergeEphemeral('notes', id, pr.nl.slice(0, 6))
  if (Array.isArray(pr.dl) && pr.dl.length) mergeEphemeral('deskNotes', id, pr.dl.slice(0, 6))
}

export function spinWheel3D() {
  live.wheelSpin = { start: performance.now(), dur: 4500, turns: 8 + Math.random() * 3 }
}
