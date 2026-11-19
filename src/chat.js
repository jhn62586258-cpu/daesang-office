// 채팅
//   /chat/{msgId}                          전체 채팅 (최근 60개)
//   /group_chats/{roomId}/meta             그룹방 정보 { name, createdBy, createdAt }
//   /group_chats/{roomId}/members/{uid}    멤버 { n: 이름, t: 직급 }
//   /group_chats/{roomId}/messages/{id}    그룹방 메시지
//   /user_rooms/{uid}/{roomId}             내가 초대된 방 목록 (멤버에게만 방이 보이도록)
import { useStore, fmtTime } from './store'
import { dbOn, dbPush, dbSet, dbRemove, dbUpdate, myUid, dbReady, newKey } from './db'

const HEX = /^#[0-9a-fA-F]{6}$/
const s = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '')
const n0 = (v) => (typeof v === 'number' && isFinite(v) ? v : 0)
const seen = new Set()
let firstLoad = true

function cleanMsg(id, d) {
  if (!d || typeof d !== 'object' || typeof d.text !== 'string') return null
  return {
    id,
    uid: s(d.uid, 64),
    sid: s(d.sid, 80),
    name: s(d.name, 10),
    title: s(d.title, 6),
    shirt: typeof d.shirt === 'string' && HEX.test(d.shirt) ? d.shirt : '#a8d0e6',
    text: s(d.text, 200),
    at: n0(d.at),
    time: s(d.time, 12) || fmtTime(new Date(n0(d.at) || Date.now())),
  }
}
const sorted = (obj) =>
  Object.entries(obj || {})
    .map(([k, v]) => cleanMsg(k, v))
    .filter(Boolean)
    .sort((a, b) => a.at - b.at)

/* ───────── 전체 채팅 ───────── */
export async function initChat(getSessionKey) {
  await dbReady()
  dbOn(
    'chat',
    (v) => {
      const list = sorted(v)
      const st = useStore.getState()
      const me = myUid()
      // 새로 들어온 남의 메시지 → 그 사람 머리 위 말풍선
      for (const m of list) {
        if (seen.has(m.id)) continue
        seen.add(m.id)
        if (!firstLoad && m.uid !== me && Date.now() - m.at < 10000 && m.sid) st.upsertRemote({ id: m.sid, bubble: { text: m.text, key: m.id } })
      }
      firstLoad = false
      st.set({ globalChat: list })
    },
    { last: 60 }
  )
  initGroups()
}

export async function sendGlobal(text, sid) {
  const st = useStore.getState()
  const me = st.me
  await dbPush('chat', { uid: myUid(), sid, name: me.name, title: me.title, shirt: me.shirt, text: text.slice(0, 80), time: fmtTime(new Date()), at: Date.now() })
}
export const deleteGlobal = (msg) => dbRemove(`chat/${msg.id}`)
export const clearGlobal = () => dbRemove('chat')

/* ───────── 그룹 채팅 ───────── */
const roomSubs = new Map() // roomId → 구독 해제 함수

function initGroups() {
  const me = myUid()
  dbOn(`user_rooms/${me}`, (v) => {
    const ids = Object.keys(v || {})
    // 새 방 구독
    for (const id of ids) {
      if (roomSubs.has(id)) continue
      const off = dbOn(
        `group_chats/${id}`,
        (room) => {
          const st = useStore.getState()
          if (!room || !room.members || !room.members[me]) {
            // 방이 사라졌거나 내가 멤버가 아님 → 내 목록에서 정리
            const rooms = { ...st.rooms }
            delete rooms[id]
            st.set({ rooms })
            return
          }
          const members = Object.entries(room.members).map(([u, m]) => ({ uid: u, name: s(m && m.n, 10), title: s(m && m.t, 6) }))
          st.set({
            rooms: {
              ...st.rooms,
              [id]: {
                id,
                name: s(room.meta && room.meta.name, 20) || '그룹방',
                createdAt: n0(room.meta && room.meta.createdAt),
                members,
                messages: sorted(room.messages).slice(-150),
              },
            },
          })
        },
        {
          onError: () => {
            dbRemove(`user_rooms/${me}/${id}`).catch(() => {})
          },
        }
      )
      roomSubs.set(id, off)
    }
    // 빠진 방 구독 해제
    for (const [id, off] of roomSubs) {
      if (ids.includes(id)) continue
      off()
      roomSubs.delete(id)
      const rooms = { ...useStore.getState().rooms }
      delete rooms[id]
      useStore.getState().set({ rooms })
    }
  })
}

// 방 만들기: invitees = [{ uid, name, title }]
export async function createRoom(name, invitees) {
  const st = useStore.getState()
  const me = myUid()
  const roomId = 'g' + newKey()
  const members = { [me]: { n: st.me.name, t: st.me.title } }
  for (const p of invitees) members[p.uid] = { n: p.name, t: p.title }
  // ① 방 생성 (보안 규칙상 방을 먼저 만든 뒤 ② 멤버별 목록에 추가)
  await dbSet(`group_chats/${roomId}`, { meta: { name: name.slice(0, 20), createdBy: me, createdAt: Date.now() }, members })
  await Promise.all(Object.keys(members).map((u) => dbSet(`user_rooms/${u}/${roomId}`, true)))
  await dbPush(`group_chats/${roomId}/messages`, {
    uid: 'system',
    name: '',
    title: '',
    text: `${st.me.name} ${st.me.title}님이 방을 만들었어요 · 멤버 ${Object.keys(members).length}명`,
    at: Date.now(),
    time: fmtTime(new Date()),
  })
  return roomId
}

export async function sendRoom(roomId, text) {
  const st = useStore.getState()
  await dbPush(`group_chats/${roomId}/messages`, {
    uid: myUid(),
    name: st.me.name,
    title: st.me.title,
    shirt: st.me.shirt,
    text: text.slice(0, 200),
    time: fmtTime(new Date()),
    at: Date.now(),
  })
}

export const clearRoom = (roomId) => dbRemove(`group_chats/${roomId}/messages`)

export async function leaveRoom(room) {
  const st = useStore.getState()
  const me = myUid()
  if (room.members.length <= 1) {
    await dbRemove(`group_chats/${room.id}`) // 마지막 멤버면 방 삭제
  } else {
    await dbPush(`group_chats/${room.id}/messages`, { uid: 'system', name: '', title: '', text: `${st.me.name} ${st.me.title}님이 방을 나갔어요`, at: Date.now(), time: fmtTime(new Date()) })
    await dbRemove(`group_chats/${room.id}/members/${me}`)
  }
  await dbRemove(`user_rooms/${me}/${room.id}`)
}

/* ───────── 안 읽은 메시지 ───────── */
const LR = 'archi-office-3d-lastread'
function readMap() {
  try {
    return JSON.parse(localStorage.getItem(LR) || '{}') || {}
  } catch {
    return {}
  }
}
export function markRead(roomId) {
  const room = useStore.getState().rooms[roomId]
  if (!room) return
  const last = room.messages.length ? room.messages[room.messages.length - 1].at : Date.now()
  const m = readMap()
  if (m[roomId] === last) return
  m[roomId] = last
  try {
    localStorage.setItem(LR, JSON.stringify(m))
  } catch {}
  useStore.getState().set({ readTick: Date.now() })
}
export function unreadCount(room) {
  const since = readMap()[room.id] || 0
  const me = myUid()
  return room.messages.filter((m) => m.at > since && m.uid !== me && m.uid !== 'system').length
}

export { dbUpdate }
