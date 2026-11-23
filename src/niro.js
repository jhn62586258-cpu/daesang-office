// 🚗 니로(Niro) 법인차량 운행일지
//   Firebase: /niro_logs/{id}
//   (선택) 구글 스프레드시트: config.js 의 NIRO_SHEET_WEBAPP_URL 로 한 줄씩 추가 전송
import { dbOn, dbSet, dbRemove, myUid } from './db'
import { NIRO_SHEET_WEBAPP_URL } from './config'

export const FUELS = ['Full', '3/4', '1/2', '1/4', '경고등']
export const PURPOSES = ['현장 방문', '관공서 · 인허가', '건축주 미팅', '자재 · 샘플 확인', '감리 · 검측', '기타 업무']

const s = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '')
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null)

export const kstDate = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
export const kstTime = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(11, 16)

function clean(id, d) {
  if (!d || typeof d !== 'object') return null
  return {
    id,
    driver: s(d.driver, 20),
    date: /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : '',
    depTime: s(d.depTime, 5),
    arrTime: s(d.arrTime, 5),
    dest: s(d.dest, 60),
    purpose: s(d.purpose, 60),
    odoStart: num(d.odoStart),
    odoEnd: num(d.odoEnd),
    distance: num(d.distance),
    fuel: FUELS.includes(d.fuel) ? d.fuel : '',
    sign: typeof d.sign === 'string' && d.sign.startsWith('data:image/png;base64,') ? d.sign : '',
    at: typeof d.at === 'number' ? d.at : 0,
    by: s(d.by, 64),
  }
}

// 최신순 (운행일자 → 출발시간 → 저장시각)
const sortKey = (r) => `${r.date} ${r.depTime} ${String(r.at).padStart(15, '0')}`
export function subscribeLogs(cb) {
  return dbOn(
    'niro_logs',
    (v) => {
      const list = Object.entries(v || {})
        .map(([k, d]) => clean(k, d))
        .filter((r) => r && r.date)
        .sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
      cb(list)
    },
    { last: 500 }
  )
}

// 직전 기록의 도착 주행거리 → 다음 기록의 출발 주행거리 자동 입력
export function lastOdometer(list) {
  for (const r of list) if (r.odoEnd != null) return r.odoEnd
  return null
}

export async function saveLog(rec) {
  const id = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const body = { ...rec, at: Date.now(), by: myUid() }
  await dbSet(`niro_logs/${id}`, body)
  sendToSheet({ id, ...body }) // 실패해도 Firebase 기록은 그대로
  return id
}
export const removeLog = (r) => dbRemove(`niro_logs/${r.id}`)

// 구글 Apps Script 웹 앱으로 전송 (CORS 우회: text/plain + no-cors)
export function sendToSheet(row) {
  if (!NIRO_SHEET_WEBAPP_URL) return
  fetch(NIRO_SHEET_WEBAPP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(row),
  }).catch((e) => console.warn('[운행일지] 구글 시트 전송 실패', e))
}
export const sheetEnabled = () => !!NIRO_SHEET_WEBAPP_URL

// 📥 엑셀에서 한글이 깨지지 않도록 BOM 포함 CSV
export function downloadCSV(list) {
  const head = ['운행일자', '운행자', '출발시간', '도착시간', '목적지', '운행목적', '출발 주행거리(km)', '도착 주행거리(km)', '이동거리(km)', '연료 잔여량', '서명']
  const esc = (v) => {
    const t = v == null ? '' : String(v)
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const rows = [...list]
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    .map((r) => [r.date, r.driver, r.depTime, r.arrTime, r.dest, r.purpose, r.odoStart, r.odoEnd, r.distance, r.fuel, r.sign ? '서명 완료' : ''].map(esc).join(','))
  const csv = '﻿' + [head.join(','), ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `니로_운행일지_${kstDate()}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
