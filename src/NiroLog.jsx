// 🚗 니로 운행일지 — 작성 폼 + 전체 기록 (3D 사무실 팝업 / ?niro=1 모바일 화면 공용)
import { useEffect, useMemo, useRef, useState } from 'react'
import { seats } from './layout'
import { FUELS, PURPOSES, kstDate, kstTime, subscribeLogs, lastOdometer, saveLog, removeLog, downloadCSV, sheetEnabled } from './niro'
import { myUid, dbReady, isFirebase } from './db'

const LS_DRIVER = 'archi-office-3d-niro-driver'
const DRIVERS = seats.map((s) => `${s.name} ${s.title}`)

/* ───────── ✍️ 자필 서명 패드 ───────── */
function SignaturePad({ value, onChange }) {
  const ref = useRef()
  const drawing = useRef(false)
  const last = useRef(null)
  const dirty = useRef(false)
  const setup = () => {
    const c = ref.current
    const r = c.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = Math.round(r.width * dpr)
    c.height = Math.round(r.height * dpr)
    const g = c.getContext('2d')
    g.scale(dpr, dpr)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.strokeStyle = '#1b1f24'
    g.lineWidth = 2.6
  }
  useEffect(() => {
    setup()
    if (!value) dirty.current = false
  }, [])
  useEffect(() => {
    if (!value && ref.current && dirty.current) {
      setup()
      dirty.current = false
    }
  }, [value])
  const pt = (e) => {
    const r = ref.current.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  const down = (e) => {
    e.preventDefault()
    ref.current.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = pt(e)
    const g = ref.current.getContext('2d')
    g.beginPath()
    g.arc(last.current[0], last.current[1], 1.2, 0, Math.PI * 2)
    g.fillStyle = '#1b1f24'
    g.fill()
  }
  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const p = pt(e)
    const g = ref.current.getContext('2d')
    g.beginPath()
    g.moveTo(last.current[0], last.current[1])
    g.lineTo(p[0], p[1])
    g.stroke()
    last.current = p
    dirty.current = true
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    // 저장 용량을 줄이기 위해 가로 480px 로 축소해 PNG 로 저장
    const src = ref.current
    const w = 480
    const h = Math.round((src.height / src.width) * w)
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    out.getContext('2d').drawImage(src, 0, 0, w, h)
    dirty.current = true
    onChange(out.toDataURL('image/png'))
  }
  const clear = () => {
    setup()
    dirty.current = false
    onChange('')
  }
  return (
    <div className="sign-wrap">
      <canvas ref={ref} className="sign-pad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
      {!value && <span className="sign-ph">여기에 손가락이나 마우스로 서명해 주세요</span>}
      <button type="button" className="sign-clear" onClick={clear}>
        지우기
      </button>
    </div>
  )
}

/* ───────── 운행일지 본체 ───────── */
export default function NiroLog({ defaultDriver = '', onSaved, standalone = false }) {
  const [tab, setTab] = useState('write')
  const [logs, setLogs] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [shared, setShared] = useState(true)
  useEffect(() => {
    dbReady().then(() => setShared(isFirebase()))
    const off = subscribeLogs((l) => {
      setLogs(l)
      setLoaded(true)
    })
    return off
  }, [])

  const remembered = (() => {
    try {
      return localStorage.getItem(LS_DRIVER) || ''
    } catch {
      return ''
    }
  })()
  const initialDriver = defaultDriver || remembered
  const [driverSel, setDriverSel] = useState(DRIVERS.includes(initialDriver) ? initialDriver : initialDriver ? '__custom' : '')
  const [driverCustom, setDriverCustom] = useState(DRIVERS.includes(initialDriver) ? '' : initialDriver)
  const [date, setDate] = useState(kstDate())
  const [depTime, setDepTime] = useState('')
  const [arrTime, setArrTime] = useState('')
  const [dest, setDest] = useState('')
  const [purpose, setPurpose] = useState('')
  const [odoStart, setOdoStart] = useState('')
  const [odoStartTouched, setOdoStartTouched] = useState(false)
  const [odoEnd, setOdoEnd] = useState('')
  const [fuel, setFuel] = useState('')
  const [sign, setSign] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

  // 직전 기록의 도착 주행거리를 출발 주행거리로 자동 입력
  const prevOdo = lastOdometer(logs)
  useEffect(() => {
    if (!odoStartTouched && prevOdo != null) setOdoStart(String(prevOdo))
  }, [prevOdo, odoStartTouched])

  const driver = driverSel === '__custom' ? driverCustom.trim() : driverSel
  const s0 = odoStart === '' ? null : Number(odoStart)
  const s1 = odoEnd === '' ? null : Number(odoEnd)
  const distance = s0 != null && s1 != null && isFinite(s0) && isFinite(s1) ? Math.round((s1 - s0) * 10) / 10 : null

  const submit = async (e) => {
    e.preventDefault()
    const miss = []
    if (!driver) miss.push('운행자')
    if (!date) miss.push('운행일자')
    if (!depTime) miss.push('출발시간')
    if (!arrTime) miss.push('도착시간')
    if (!dest.trim()) miss.push('목적지')
    if (!purpose.trim()) miss.push('운행목적')
    if (s0 == null || !isFinite(s0)) miss.push('출발 주행거리')
    if (s1 == null || !isFinite(s1)) miss.push('도착 주행거리')
    if (!fuel) miss.push('연료 잔여량')
    if (!sign) miss.push('서명')
    if (miss.length) return setErr(`${miss.join(', ')}을(를) 입력해 주세요.`)
    if (distance < 0) return setErr('도착 주행거리가 출발 주행거리보다 작아요. 다시 확인해 주세요.')
    if (distance > 2000) return setErr('이동거리가 2,000km를 넘어요. 주행거리를 다시 확인해 주세요.')
    setErr('')
    setBusy(true)
    try {
      await saveLog({ driver, date, depTime, arrTime, dest: dest.trim(), purpose: purpose.trim(), odoStart: s0, odoEnd: s1, distance, fuel, sign })
      try {
        localStorage.setItem(LS_DRIVER, driver)
      } catch {}
      setDone({ driver, dest: dest.trim(), distance })
      onSaved && onSaved({ driver, dest: dest.trim(), distance })
      // 다음 기록을 위해 초기화 (운행자는 유지)
      setDepTime('')
      setArrTime('')
      setDest('')
      setPurpose('')
      setOdoEnd('')
      setOdoStartTouched(false)
      setFuel('')
      setSign('')
    } catch (e2) {
      console.warn(e2)
      setErr('저장하지 못했어요. 네트워크 또는 Firebase 보안 규칙을 확인해 주세요.')
    }
    setBusy(false)
  }

  // 목록 요약
  const month = kstDate().slice(0, 7)
  const monthLogs = logs.filter((r) => r.date.startsWith(month))
  const monthKm = monthLogs.reduce((a, r) => a + (r.distance || 0), 0)
  const [viewSign, setViewSign] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const uidMe = myUid()

  return (
    <div className={'niro' + (standalone ? ' standalone' : '')}>
      <div className="niro-tabs">
        <button className={tab === 'write' ? 'on' : ''} onClick={() => setTab('write')}>
          ✍️ 운행 기록 작성
        </button>
        <button className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>
          📋 전체 기록 <b>{logs.length}</b>
        </button>
      </div>
      {!shared && <div className="niro-warn">⚠️ Firebase 미설정(로컬 모드): 이 브라우저에만 저장돼요.</div>}

      {tab === 'write' && (
        <form className="niro-form" onSubmit={submit}>
          {done && (
            <div className="niro-done">
              ✅ 저장 완료! {done.driver} · {done.dest} · {done.distance}km{sheetEnabled() && ' · 구글 시트로도 전송했어요'}
            </div>
          )}
          <div className="nf-grid">
            <label className="nf">
              <span>운행자 *</span>
              <select value={driverSel} onChange={(e) => setDriverSel(e.target.value)}>
                <option value="">선택해 주세요</option>
                {DRIVERS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
                <option value="__custom">✏️ 직접 입력</option>
              </select>
              {driverSel === '__custom' && <input value={driverCustom} onChange={(e) => setDriverCustom(e.target.value)} maxLength={20} placeholder="운행자 이름" />}
            </label>
            <label className="nf">
              <span>운행일자 *</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="nf">
              <span>출발시간 *</span>
              <div className="nf-row">
                <input type="time" value={depTime} onChange={(e) => setDepTime(e.target.value)} />
                <button type="button" className="now-btn" onClick={() => setDepTime(kstTime())}>
                  지금
                </button>
              </div>
            </label>
            <label className="nf">
              <span>도착시간 *</span>
              <div className="nf-row">
                <input type="time" value={arrTime} onChange={(e) => setArrTime(e.target.value)} />
                <button type="button" className="now-btn" onClick={() => setArrTime(kstTime())}>
                  지금
                </button>
              </div>
            </label>
            <label className="nf wide">
              <span>목적지 *</span>
              <input value={dest} onChange={(e) => setDest(e.target.value)} maxLength={60} placeholder="예: 안양시청 건축과, 과천 지식정보타운 현장" />
            </label>
            <label className="nf wide">
              <span>운행목적 *</span>
              <input value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={60} placeholder="직접 입력하거나 아래에서 선택" />
              <div className="chips">
                {PURPOSES.map((p) => (
                  <button type="button" key={p} className={'chip' + (purpose === p ? ' custom' : '')} onClick={() => setPurpose(p)}>
                    {p}
                  </button>
                ))}
              </div>
            </label>
            <label className="nf">
              <span>
                출발 시 주행거리 (km) * {prevOdo != null && !odoStartTouched && <em>직전 기록에서 자동 입력</em>}
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={odoStart}
                onChange={(e) => (setOdoStart(e.target.value), setOdoStartTouched(true))}
                placeholder="예: 12345"
              />
            </label>
            <label className="nf">
              <span>도착 시 주행거리 (km) *</span>
              <input type="number" inputMode="decimal" step="0.1" min="0" value={odoEnd} onChange={(e) => setOdoEnd(e.target.value)} placeholder="계기판 숫자" />
            </label>
            <div className="nf wide">
              <span>실제 이동거리</span>
              <div className={'nf-distance' + (distance != null && distance < 0 ? ' bad' : '')}>{distance == null ? '도착 주행거리를 입력하면 자동 계산돼요' : `${distance.toLocaleString()} km`}</div>
            </div>
            <div className="nf wide">
              <span>연료 잔여량 *</span>
              <div className="fuel-seg">
                {FUELS.map((f) => (
                  <button type="button" key={f} className={(fuel === f ? 'on ' : '') + (f === '경고등' ? 'warn' : '')} onClick={() => setFuel(f)}>
                    {f === '경고등' ? '⚠️ 경고등' : f}
                  </button>
                ))}
              </div>
            </div>
            <div className="nf wide">
              <span>운행자 자필 서명 *</span>
              <SignaturePad value={sign} onChange={setSign} />
            </div>
          </div>
          {err && <div className="err">{err}</div>}
          <button className="go" disabled={busy}>
            {busy ? '저장 중…' : '🚗 운행일지 저장'}
          </button>
        </form>
      )}

      {tab === 'list' && (
        <div className="niro-list">
          <div className="nl-summary">
            <div>
              <small>이번 달 ({month.replace('-', '.')})</small>
              <b>
                {monthLogs.length}회 · {Math.round(monthKm * 10) / 10}km
              </b>
            </div>
            <div>
              <small>누적 기록</small>
              <b>{logs.length}건</b>
            </div>
            <button className="go small" onClick={() => downloadCSV(logs)} disabled={!logs.length}>
              📥 엑셀(CSV) 다운로드
            </button>
          </div>
          {!loaded && <div className="room-empty">불러오는 중…</div>}
          {loaded && logs.length === 0 && <div className="room-empty">아직 운행 기록이 없어요.</div>}
          {logs.length > 0 && (
            <div className="nl-table-wrap">
              <table className="nl-table">
                <thead>
                  <tr>
                    <th>일자</th>
                    <th>운행자</th>
                    <th>시간</th>
                    <th>목적지 · 목적</th>
                    <th>주행거리</th>
                    <th>이동</th>
                    <th>연료</th>
                    <th>서명</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {logs.map((r) => (
                    <tr key={r.id}>
                      <td>{r.date.slice(5).replace('-', '/')}</td>
                      <td className="b">{r.driver}</td>
                      <td>
                        {r.depTime}~{r.arrTime}
                      </td>
                      <td>
                        <div className="b">{r.dest}</div>
                        <small>{r.purpose}</small>
                      </td>
                      <td className="num">
                        {r.odoStart?.toLocaleString()} → {r.odoEnd?.toLocaleString()}
                      </td>
                      <td className="num b">{r.distance}km</td>
                      <td>
                        <span className={'fuel-tag' + (r.fuel === '경고등' ? ' warn' : '')}>{r.fuel}</span>
                      </td>
                      <td>{r.sign ? <img src={r.sign} alt="서명" className="sign-thumb" onClick={() => setViewSign(r)} /> : '-'}</td>
                      <td>
                        {r.by === uidMe && (
                          <button className="nl-del" title="내 기록 삭제" onClick={() => setConfirmDel(r)}>
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="nl-note">
            {sheetEnabled() ? '✓ 새 기록은 회사 구글 스프레드시트에도 자동으로 추가돼요.' : 'ℹ️ 구글 스프레드시트 연동은 src/config.js 의 NIRO_SHEET_WEBAPP_URL 을 설정하면 켜져요.'} 내 기록만 삭제할 수 있어요.
          </p>
        </div>
      )}

      {viewSign && (
        <div className="niro-overlay" onClick={() => setViewSign(null)}>
          <div className="niro-pop" onClick={(e) => e.stopPropagation()}>
            <b>
              {viewSign.driver} · {viewSign.date}
            </b>
            <img src={viewSign.sign} alt="서명" />
            <button className="ghost" onClick={() => setViewSign(null)}>
              닫기
            </button>
          </div>
        </div>
      )}
      {confirmDel && (
        <div className="niro-overlay" onClick={() => setConfirmDel(null)}>
          <div className="niro-pop" onClick={(e) => e.stopPropagation()}>
            <b>이 운행 기록을 삭제할까요?</b>
            <p>
              {confirmDel.date} · {confirmDel.driver} · {confirmDel.dest} ({confirmDel.distance}km)
            </p>
            <div className="sheet-foot">
              <button className="ghost" onClick={() => setConfirmDel(null)}>
                취소
              </button>
              <button
                className="go small danger-go"
                onClick={async () => {
                  await removeLog(confirmDel)
                  setConfirmDel(null)
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
