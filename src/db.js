// 데이터 저장 공통 계층
// ▸ Firebase 모드: Realtime Database (firebase.js 설정값 사용)
// ▸ 로컬 모드: 같은 경로 구조를 localStorage에 저장하고 BroadcastChannel로 같은 브라우저의 탭끼리 실시간 공유
//   → 모든 기능 코드는 이 파일의 dbOn / dbSet / dbPush / dbUpdate / dbRemove 만 사용합니다.
import { ref, onValue, set, push, update, remove, query, orderByChild, limitToLast } from 'firebase/database'
import { firebaseReady } from './firebase'

let fb = null
const ready = firebaseReady().then((r) => (fb = r))

export const dbReady = () => ready
export const isFirebase = () => !!fb

// 내 고유 ID: Firebase 익명 로그인 uid
// 로컬 모드에서는 탭마다 다른 ID (같은 브라우저의 탭 2개로 그룹방·투표를 시험해 볼 수 있도록)
let localId = null
export function myUid() {
  if (fb) return fb.uid
  if (localId) return localId
  try {
    localId = sessionStorage.getItem('archi-office-3d-tabuid')
    if (!localId) {
      localId = 'local-' + Math.random().toString(36).slice(2, 10)
      sessionStorage.setItem('archi-office-3d-tabuid', localId)
    }
  } catch {
    localId = 'local-' + Math.random().toString(36).slice(2, 10)
  }
  return localId
}

/* ───────── 로컬 모드 구현 ───────── */
const LS = 'archi-office-3d-localdb'
let tree = null
const listeners = new Set()
let bc = null

function loadTree() {
  try {
    tree = JSON.parse(localStorage.getItem(LS) || '{}') || {}
  } catch {
    tree = {}
  }
}
function saveTree() {
  try {
    localStorage.setItem(LS, JSON.stringify(tree))
  } catch {}
}
const parts = (p) => p.split('/').filter(Boolean)
function getAt(p) {
  if (!tree) loadTree()
  let cur = tree
  for (const k of parts(p)) {
    if (cur == null || typeof cur !== 'object') return null
    cur = cur[k]
  }
  return cur === undefined ? null : cur
}
function setAt(p, v) {
  if (!tree) loadTree()
  const ks = parts(p)
  let cur = tree
  for (let i = 0; i < ks.length - 1; i++) {
    if (cur[ks[i]] == null || typeof cur[ks[i]] !== 'object') cur[ks[i]] = {}
    cur = cur[ks[i]]
  }
  const last = ks[ks.length - 1]
  if (v === null || v === undefined) delete cur[last]
  else cur[last] = JSON.parse(JSON.stringify(v))
}
function related(a, b) {
  const A = parts(a).join('/')
  const B = parts(b).join('/')
  return A === B || A.startsWith(B + '/') || B.startsWith(A + '/') || !A || !B
}
function notify(changed) {
  for (const l of listeners) if (related(l.path, changed)) l.fire()
}
function localChanged(path) {
  saveTree()
  notify(path)
  bc && bc.postMessage(path)
}
let storageHooked = false
function ensureBc() {
  if (!storageHooked && typeof window !== 'undefined') {
    // 다른 탭이 저장하면 storage 이벤트로도 갱신 (BroadcastChannel 보완)
    storageHooked = true
    window.addEventListener('storage', (e) => {
      if (e.key !== LS) return
      loadTree()
      notify('')
    })
  }
  if (bc || typeof BroadcastChannel === 'undefined') return
  try {
    bc = new BroadcastChannel(LS)
    bc.onmessage = (e) => {
      loadTree()
      notify(typeof e.data === 'string' ? e.data : '')
    }
  } catch {}
}
function lastN(obj, n) {
  if (!obj || typeof obj !== 'object' || !n) return obj
  const entries = Object.entries(obj).sort((a, b) => ((a[1] && a[1].at) || 0) - ((b[1] && b[1].at) || 0))
  return Object.fromEntries(entries.slice(-n))
}

export const newKey = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

/* ───────── 공개 API ───────── */

/**
 * 경로 구독. cb(value | null) 이 처음 1번 + 바뀔 때마다 호출됩니다.
 * opts.last: 'at' 기준 최근 N개만 / opts.onError: 권한 오류 등
 * @returns 구독 해제 함수
 */
export function dbOn(path, cb, opts = {}) {
  let off = null
  let dead = false
  ready.then(() => {
    if (dead) return
    if (fb) {
      let r = ref(fb.db, path)
      if (opts.last) r = query(r, orderByChild('at'), limitToLast(opts.last))
      off = onValue(
        r,
        (snap) => cb(snap.val()),
        (e) => {
          console.warn(`[DB] ${path} 읽기 실패`, e)
          opts.onError ? opts.onError(e) : cb(null)
        }
      )
    } else {
      ensureBc()
      const l = { path, fire: () => cb(lastN(getAt(path), opts.last)) }
      listeners.add(l)
      l.fire()
      off = () => listeners.delete(l)
    }
  })
  return () => {
    dead = true
    off && off()
  }
}

export async function dbSet(path, value) {
  await ready
  if (fb) return set(ref(fb.db, path), value)
  loadTree() // 다른 탭의 최신 저장분 위에 덮어쓰기 (탭 간 충돌 방지)
  setAt(path, value)
  localChanged(path)
}

export async function dbUpdate(path, obj) {
  await ready
  if (fb) return update(ref(fb.db, path), obj)
  loadTree()
  for (const [k, v] of Object.entries(obj)) setAt(`${path}/${k}`, v)
  localChanged(path)
}

export async function dbPush(path, value) {
  await ready
  if (fb) {
    const r = push(ref(fb.db, path))
    await set(r, value)
    return r.key
  }
  const key = newKey()
  loadTree()
  setAt(`${path}/${key}`, value)
  localChanged(path)
  return key
}

export async function dbRemove(path) {
  await ready
  if (fb) return remove(ref(fb.db, path))
  loadTree()
  setAt(path, null)
  localChanged(path)
}
