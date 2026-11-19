// ════════════════════════════════════════════════════════════════
//  🔥 Firebase 설정
// ════════════════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyAddnt8InNHMSUx2kMxAQaOi2rEPXKmVRI",
  authDomain: "://firebaseapp.com",
  databaseURL: "https://daesang-office-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "daesang-office",
  storageBucket: "daesang-office.firebasestorage.app",
  messagingSenderId: "738280488701",
  appId: "1:738280488701:web:61e0c15cd59cd78cb30894",
}
// ════════════════════════════════════════════════════════════════

import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'

const env = import.meta.env
const config = {
  apiKey: firebaseConfig.apiKey || env.VITE_FIREBASE_API_KEY || '',
  authDomain: firebaseConfig.authDomain || env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: firebaseConfig.databaseURL || env.VITE_FIREBASE_DATABASE_URL || '',
  projectId: firebaseConfig.projectId || env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: firebaseConfig.storageBucket || env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: firebaseConfig.messagingSenderId || env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: firebaseConfig.appId || env.VITE_FIREBASE_APP_ID || '',
}

// apiKey와 databaseURL이 있어야 Firebase 모드로 동작합니다.
// 비어 있으면 '로컬 모드'(같은 브라우저의 탭끼리만 공유 + localStorage 저장)로 동작합니다.
export const firebaseEnabled = !!(config.apiKey && config.databaseURL)

let readyPromise = null

/**
 * Firebase 준비: 앱 초기화 + 익명 로그인
 * @returns {Promise<{ db: import('firebase/database').Database, uid: string } | null>}
 */
export function firebaseReady() {
  if (!firebaseEnabled) return Promise.resolve(null)
  if (readyPromise) return readyPromise
  readyPromise = (async () => {
    try {
      const app = initializeApp(config)
      const db = getDatabase(app)
      const auth = getAuth(app)
      const uid = await new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Firebase 로그인 시간 초과 (15초)')), 15000)
        const off = onAuthStateChanged(auth, (u) => {
          if (u) {
            off()
            resolve(u.uid)
          }
        })
        signInAnonymously(auth).catch((e) => {
          off()
          reject(e)
        })
      })
      return { db, uid }
    } catch (e) {
      console.error(
        '[Firebase] 연결 실패 — 로컬 모드로 동작합니다.\n' +
          '① firebaseConfig 값 ② Authentication → 로그인 방법 → "익명" 사용 설정 ③ Realtime Database 생성 여부를 확인하세요.',
        e
      )
      return null
    }
  })()
  return readyPromise
}
