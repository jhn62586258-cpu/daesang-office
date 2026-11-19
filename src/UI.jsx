import { useEffect, useMemo, useRef, useState } from 'react'
import { seats } from './layout'
import { live, useStore, MOODS, STATUSES, fmtTime, uid } from './store'
import { addNote, deleteNote, deskNotes as deskStore, SNACKS, castVote, tally, voteWeek } from './notes'
import { startMusic, stopMusic, setRain, playChime } from './lofi'
import { kstNow, MODE_LABEL } from './Ambience'
import { spinWheel3D, sendChat } from './net'
import { RESTAURANTS, WHEEL_COLORS } from './restaurants'

const TITLES = ['대표님', '이사', '상무', '실장', '부장', '과장', '대리', '주임', '사원', '인턴']
const SHIRTS = [
  { c: '#a8d0e6', n: '스카이 블루' },
  { c: '#ffffff', n: '화이트' },
  { c: '#f6c6c6', n: '핑크' },
  { c: '#c8dcb4', n: '세이지' },
  { c: '#f1dfb8', n: '베이지' },
  { c: '#3d5a80', n: '네이비' },
]
const PANTS = ['#2f3e55', '#5b5f63', '#8a7560', '#1f1f22']
const NOTE_COLORS = [
  { c: '#fff176', n: '노랑' },
  { c: '#f8bbd0', n: '분홍' },
  { c: '#b2f2bb', n: '민트' },
  { c: '#a5d8ff', n: '하늘' },
  { c: '#ffd8a8', n: '주황' },
  { c: '#e5dbff', n: '라벤더' },
]

function persistentId() {
  try {
    let id = localStorage.getItem('archi-office-3d-uid')
    if (!id) {
      id = uid() + uid()
      localStorage.setItem('archi-office-3d-uid', id)
    }
    return id
  } catch {
    return uid() + uid()
  }
}

const sysMsg = (text, extra = {}) => useStore.getState().addMessage({ id: 'sys' + uid(), system: true, text, time: fmtTime(new Date()), ...extra })

/* ───────────────────── 출근 모달 ───────────────────── */
export function EntryModal() {
  const joined = useStore((s) => s.joined)
  const [mode, setMode] = useState('list')
  const [pick, setPick] = useState('조한나|사원')
  const [name, setName] = useState('')
  const [title, setTitle] = useState('사원')
  const [shirt, setShirt] = useState(SHIRTS[0].c)
  const [pants, setPants] = useState(PANTS[0])
  const [hair, setHair] = useState('short')
  const [err, setErr] = useState('')
  const groups = useMemo(() => {
    const g = {}
    for (const s of seats) (g[s.dept] ||= []).push(s)
    return g
  }, [])
  if (joined) return null

  const submit = (e) => {
    e.preventDefault()
    let n, t
    if (mode === 'list') [n, t] = pick.split('|')
    else {
      n = name.trim()
      t = title
      if (!n) return setErr('이름을 입력해 주세요.')
      if (n.length > 8) return setErr('이름은 8자 이내로 입력해 주세요.')
    }
    const me = { id: persistentId(), name: n, title: t, shirt, pants, hair }
    useStore.getState().join(me)
    sysMsg(`${n} ${t}님이 출근했습니다. ☀️`)
  }

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
  return (
    <div className="modal-bg">
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <div className="badge">🏢</div>
          <div>
            <h1>건축사사무소 3D 오피스</h1>
            <p>{today} · 오늘도 좋은 하루 보내세요!</p>
          </div>
        </div>
        <div className="tabs">
          <button type="button" className={mode === 'list' ? 'on' : ''} onClick={() => setMode('list')}>
            직원 목록에서 선택
          </button>
          <button type="button" className={mode === 'custom' ? 'on' : ''} onClick={() => setMode('custom')}>
            직접 입력
          </button>
        </div>
        {mode === 'list' ? (
          <label className="field">
            <span>이름 · 직급</span>
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              {Object.entries(groups).map(([dept, list]) => (
                <optgroup key={dept} label={dept}>
                  {list.map((s) => (
                    <option key={s.name} value={`${s.name}|${s.title}`}>
                      {s.name} {s.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ) : (
          <div className="row2">
            <label className="field">
              <span>이름</span>
              <input value={name} onChange={(e) => (setName(e.target.value), setErr(''))} placeholder="예: 홍길동" maxLength={10} autoFocus />
            </label>
            <label className="field">
              <span>직급</span>
              <select value={title} onChange={(e) => setTitle(e.target.value)}>
                {TITLES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="field">
          <span>오늘의 셔츠</span>
          <div className="swatches">
            {SHIRTS.map((s) => (
              <button type="button" key={s.c} title={s.n} className={shirt === s.c ? 'on' : ''} style={{ background: s.c }} onClick={() => setShirt(s.c)} />
            ))}
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <span>슬랙스</span>
            <div className="swatches">
              {PANTS.map((c) => (
                <button type="button" key={c} className={pants === c ? 'on' : ''} style={{ background: c }} onClick={() => setPants(c)} />
              ))}
            </div>
          </div>
          <div className="field">
            <span>헤어</span>
            <div className="seg">
              <button type="button" className={hair === 'short' ? 'on' : ''} onClick={() => setHair('short')}>
                짧은 머리
              </button>
              <button type="button" className={hair === 'long' ? 'on' : ''} onClick={() => setHair('long')}>
                긴 머리
              </button>
            </div>
          </div>
        </div>
        {err && <div className="err">{err}</div>}
        <button className="go" type="submit">
          출근하기 →
        </button>
        <p className="hint">주출입구에서 시작합니다 · 방향키/WASD 또는 바닥 클릭으로 이동</p>
      </form>
    </div>
  )
}

/* ───────────────────── 채팅 ───────────────────── */
export function Chat() {
  const joined = useStore((s) => s.joined)
  const messages = useStore((s) => s.messages)
  const me = useStore((s) => s.me)
  const modal = useStore((s) => s.modal)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(true)
  const listRef = useRef()
  const inputRef = useRef()
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, open])
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Enter' && document.activeElement !== inputRef.current && joined && !useStore.getState().modal) {
        const tag = document.activeElement?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'SELECT') return
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [joined])
  if (!joined) return null
  const send = (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    const id = uid()
    const msg = { id: 'me' + id, from: me.id, mine: true, name: me.name, title: me.title, shirt: me.shirt, text: t, time: fmtTime(new Date()) }
    const st = useStore.getState()
    st.addMessage(msg)
    st.setBubble(t)
    sendChat({ ...msg, id })
    setText('')
  }
  return (
    <div className={'chat' + (open ? '' : ' closed') + (modal ? ' dim' : '')}>
      <div className="chat-head" onClick={() => setOpen(!open)}>
        <span>💬 사무실 채팅</span>
        <span className="chat-sub">{open ? '접기 ▾' : '펼치기 ▴'}</span>
      </div>
      {open && (
        <>
          <div className="chat-list" ref={listRef}>
            {messages.map((m) =>
              m.system ? (
                <div key={m.id} className={'sys' + (m.spin ? ' spin' : '')}>
                  {m.text}
                </div>
              ) : m.mine ? (
                <div key={m.id} className="msg mine">
                  <span className="time">{m.time}</span>
                  <div className="txt">{m.text}</div>
                </div>
              ) : (
                <div key={m.id} className="msg">
                  <div className="ava" style={{ background: m.shirt }}>
                    {m.name[0]}
                  </div>
                  <div>
                    <div className="who">
                      {m.name} {m.title}
                    </div>
                    <div className="row">
                      <div className="txt">{m.text}</div>
                      <span className="time">{m.time}</span>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
          <form className="chat-input" onSubmit={send}>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
              placeholder="메시지 입력 (Enter 전송)"
              maxLength={80}
            />
            <button type="submit" disabled={!text.trim()}>
              전송
            </button>
          </form>
        </>
      )}
    </div>
  )
}

/* ───────────────────── 상황별 액션 버튼 ───────────────────── */
export function ActionPanel() {
  const joined = useStore((s) => s.joined)
  const inPantry = useStore((s) => s.inPantry)
  const nearSeat = useStore((s) => s.nearSeat)
  const nearBoard = useStore((s) => s.nearBoard)
  const nearRoulette = useStore((s) => s.nearRoulette)
  const sitting = useStore((s) => s.sitting)
  const modal = useStore((s) => s.modal)
  const me = useStore((s) => s.me)
  const deskNotes = useStore((s) => s.deskNotes)
  if (!joined || modal) return null
  const countFor = (name) => deskNotes.filter((n) => n.seat === name).length
  const listBtn = (name) => {
    const c = countFor(name)
    return c > 0 ? (
      <button className="act b-light" onClick={() => useStore.getState().set({ modal: { deskList: name } })}>
        📬 쪽지 {c}개 보기
      </button>
    ) : null
  }

  const groups = []
  if (sitting !== null) {
    const s = seats[sitting]
    groups.push(
      <div className="act-group" key="sit">
        <div className="act-title">🪑 {s.name} {s.title} 자리</div>
        {listBtn(s.name)}
        <button className="act b-stand" onClick={() => window.dispatchEvent(new Event('stand-request'))}>
          ⬆️ 일어나기
        </button>
      </div>
    )
  } else {
    if (nearSeat !== null) {
      const s = seats[nearSeat]
      groups.push(
        <div className="act-group" key="seat">
          <div className="act-title">{s.name} {s.title} 자리</div>
          <button className="act b-sit" onClick={() => window.dispatchEvent(new CustomEvent('sit-request', { detail: { idx: nearSeat } }))}>
            🪑 자리에 앉기
          </button>
          {me.name !== s.name && (
            <button className="act b-letter" onClick={() => useStore.getState().set({ modal: { deskWrite: nearSeat } })}>
              💌 책상에 쪽지 남기기
            </button>
          )}
          {listBtn(s.name)}
        </div>
      )
    }
    if (inPantry) {
      const act = (kind) => {
        const st = useStore.getState()
        st.doAction(kind)
        const me = st.me
        sysMsg(kind === 'coffee' ? `☕ ${me.name} ${me.title}님이 커피를 내렸어요.` : `🍪 ${me.name} ${me.title}님이 간식을 먹고 있어요.`)
      }
      groups.push(
        <div className="act-group" key="pantry">
          <div className="act-title">탕비실</div>
          <button className="act b-coffee" onClick={() => act('coffee')}>
            ☕ 커피 마시기
          </button>
          <button className="act b-snack" onClick={() => act('snack')}>
            🍪 간식 먹기
          </button>
          <button className="act b-vote" onClick={() => useStore.getState().set({ modal: 'vote' })}>
            🗳️ 간식 투표하기
          </button>
        </div>
      )
    }
    if (nearBoard) {
      groups.push(
        <div className="act-group" key="board">
          <div className="act-title">사내 자유 게시판</div>
          <button className="act b-note" onClick={() => useStore.getState().set({ modal: 'noteWrite' })}>
            📝 메모 붙이기
          </button>
          <button className="act b-light" onClick={() => useStore.getState().set({ modal: 'board' })}>
            📋 게시판 보기
          </button>
        </div>
      )
    }
    if (nearRoulette) {
      groups.push(
        <div className="act-group" key="roulette">
          <div className="act-title">점심 룰렛</div>
          <button className="act b-roulette" onClick={() => useStore.getState().set({ modal: 'roulette' })}>
            🎰 룰렛 돌리기
          </button>
        </div>
      )
    }
  }
  if (!groups.length) return null
  return <div className="actions">{groups}</div>
}

/* ───────────────────── 모달 공통 ───────────────────── */
function Sheet({ children, onClose, wide, className = '' }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="modal-bg soft" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'sheet ' + (wide ? 'wide ' : '') + className}>
        <button className="x" onClick={onClose} aria-label="닫기">
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}

export function Modals() {
  const modal = useStore((s) => s.modal)
  const close = () => useStore.getState().set({ modal: null })
  if (!modal) return null
  if (modal === 'noteWrite') return <NoteWrite onClose={close} />
  if (modal === 'board') return <BoardView onClose={close} />
  if (modal === 'roulette') return <Roulette onClose={close} />
  if (modal === 'vote') return <VoteModal onClose={close} />
  if (modal.note) return <NoteView note={modal.note} onClose={close} back={modal.back} />
  if (modal.deskWrite !== undefined) return <DeskWrite idx={modal.deskWrite} onClose={close} />
  if (modal.deskNote) return <DeskNoteView note={modal.deskNote} onClose={close} back={modal.back} />
  if (modal.deskList) return <DeskList name={modal.deskList} onClose={close} />
  return null
}

function NoteWrite({ onClose }) {
  const [color, setColor] = useState(NOTE_COLORS[0].c)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    const res = await addNote({ text: t, color })
    const me = useStore.getState().me
    sysMsg(`📝 ${me.name} ${me.title}님이 게시판에 메모를 붙였어요.`)
    if (!res.shared && useStore.getState().netMode === 'firebase') sysMsg('⚠️ Firebase 저장에 실패해 이 브라우저에만 붙였어요. (보안 규칙을 확인해 주세요)')
    onClose()
  }
  return (
    <Sheet onClose={onClose}>
      <h2>📝 포스트잇 붙이기</h2>
      <form onSubmit={submit} className="note-form">
        <div className="note-preview" style={{ background: color }}>
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={60} placeholder="예: 오늘 빨리 퇴근하고 싶어요 🙏" />
          <span className="cnt">{text.length}/60</span>
        </div>
        <div className="swatches big">
          {NOTE_COLORS.map((c) => (
            <button type="button" key={c.c} title={c.n} className={color === c.c ? 'on' : ''} style={{ background: c.c }} onClick={() => setColor(c.c)} />
          ))}
        </div>
        <button className="go" disabled={!text.trim() || busy}>
          {busy ? '붙이는 중…' : '📌 게시판에 붙이기'}
        </button>
      </form>
    </Sheet>
  )
}

function BoardView({ onClose }) {
  const notes = useStore((s) => s.notes)
  const mode = useStore((s) => s.notesMode)
  return (
    <Sheet onClose={onClose} wide>
      <h2>📌 사내 자유 게시판</h2>
      <p className="sub">
        {notes.length}개의 메모 · {mode === 'shared' ? '모든 동료와 공유되는 게시판 (Firebase)' : '이 브라우저에 저장된 게시판 (로컬 모드)'}
      </p>
      <div className="cork">
        {notes.length === 0 && <div className="empty">아직 붙은 메모가 없어요. 첫 메모를 붙여 보세요!</div>}
        {notes.map((n) => (
          <button key={n.id} className="pi" style={{ background: n.color, transform: `rotate(${(n.tilt || 0) * -40}deg)` }} onClick={() => useStore.getState().set({ modal: { note: n, back: 'board' } })}>
            <span className="pin" />
            <span className="pt">{n.text}</span>
            <span className="pa">
              - {n.name} {n.title}
            </span>
          </button>
        ))}
      </div>
      <div className="sheet-foot">
        <button className="go small" onClick={() => useStore.getState().set({ modal: 'noteWrite' })}>
          📝 메모 붙이기
        </button>
      </div>
    </Sheet>
  )
}

function NoteView({ note, onClose, back }) {
  const me = useStore((s) => s.me)
  const mine = me && note.authorId === me.id
  const date = note.at ? new Date(note.at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <Sheet onClose={onClose} className="note-sheet">
      <div className="note-big" style={{ background: note.color }}>
        <span className="pin" />
        <p>{note.text}</p>
        <div className="by">
          - {note.name} {note.title}
          <small>{date}</small>
        </div>
      </div>
      <div className="sheet-foot">
        {back && (
          <button className="ghost" onClick={() => useStore.getState().set({ modal: back })}>
            ← 게시판으로
          </button>
        )}
        {mine && (
          <button
            className="ghost danger"
            onClick={async () => {
              await deleteNote(note)
              useStore.getState().set({ modal: back || null })
            }}
          >
            🗑️ 내 메모 떼기
          </button>
        )}
      </div>
    </Sheet>
  )
}

/* ───────────────────── 책상 쪽지 ───────────────────── */
const DESK_COLORS = [
  { c: '#fff176', n: '노랑' },
  { c: '#f8bbd0', n: '분홍' },
  { c: '#b2f2bb', n: '민트' },
  { c: '#a5d8ff', n: '하늘' },
]
const seatByName = (name) => seats.find((x) => x.name === name)

function DeskWrite({ idx, onClose }) {
  const seat = seats[idx]
  const me = useStore((s) => s.me)
  const [color, setColor] = useState(DESK_COLORS[0].c)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    const res = await deskStore.add({ seat: seat.name, text: t.slice(0, 50), color })
    sysMsg(`💌 ${me.name} ${me.title}님이 ${seat.name} ${seat.title}님 책상에 쪽지를 남겼어요.`)
    if (!res.shared && useStore.getState().netMode === 'firebase') sysMsg('⚠️ Firebase 저장에 실패해 이 브라우저에만 붙였어요. (보안 규칙을 확인해 주세요)')
    onClose()
  }
  return (
    <Sheet onClose={onClose}>
      <h2>💌 책상에 쪽지 남기기</h2>
      <p className="sub">모니터 귀퉁이에 포스트잇으로 붙여 둘게요.</p>
      <form onSubmit={submit} className="note-form">
        <div className="note-preview desk" style={{ background: color }}>
          <div className="to">
            To. {seat.name} {seat.title}님
          </div>
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={50} placeholder={`${seat.title}님, 다녀오시면 전화 부탁드려요!`} />
          <div className="from">
            - {me.name} {me.title}
          </div>
          <span className="cnt">{text.length}/50</span>
        </div>
        <div className="swatches big">
          {DESK_COLORS.map((c) => (
            <button type="button" key={c.c} title={c.n} className={color === c.c ? 'on' : ''} style={{ background: c.c }} onClick={() => setColor(c.c)} />
          ))}
        </div>
        <button className="go" disabled={!text.trim() || busy}>
          {busy ? '붙이는 중…' : '📌 책상에 붙이기'}
        </button>
      </form>
    </Sheet>
  )
}

function DeskNoteView({ note, onClose, back }) {
  const me = useStore((s) => s.me)
  const seat = seatByName(note.seat)
  const date = note.at ? new Date(note.at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
  const done = async () => {
    await deskStore.remove(note)
    sysMsg(`✅ ${me.name} ${me.title}님이 ${seat ? seat.name + ' ' + seat.title + '님 책상의 ' : ''}쪽지를 확인했어요.`)
    useStore.getState().set({ modal: back || null })
  }
  return (
    <Sheet onClose={onClose} className="note-sheet">
      <div className="note-big" style={{ background: note.color }}>
        <span className="pin tape" />
        <div className="to">💌 To. {seat ? `${seat.name} ${seat.title}님` : note.seat}</div>
        <p>{note.text}</p>
        <div className="by">
          - {note.name} {note.title}
          <small>{date}</small>
        </div>
      </div>
      <div className="sheet-foot">
        {back && (
          <button className="ghost" onClick={() => useStore.getState().set({ modal: back })}>
            ← 목록으로
          </button>
        )}
        <button className="go small ok" onClick={done}>
          ✅ 확인 완료 (떼어내기)
        </button>
      </div>
    </Sheet>
  )
}

function DeskList({ name, onClose }) {
  const notes = useStore((s) => s.deskNotes.filter((n) => n.seat === name))
  const seat = seatByName(name)
  useEffect(() => {
    if (!notes.length) onClose()
  }, [notes.length])
  return (
    <Sheet onClose={onClose}>
      <h2>📬 {seat ? `${seat.name} ${seat.title}님` : name} 책상의 쪽지</h2>
      <p className="sub">{notes.length}개 · 눌러서 읽고 확인 완료하면 떼어져요</p>
      <div className="desk-list">
        {notes.map((n) => (
          <button key={n.id} className="dl-item" style={{ background: n.color }} onClick={() => useStore.getState().set({ modal: { deskNote: n, back: { deskList: name } } })}>
            <span className="dl-text">{n.text}</span>
            <span className="dl-by">
              - {n.name} {n.title} · {fmtTime(new Date(n.at))}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

/* ───────────────────── 간식 투표 ───────────────────── */
function VoteModal({ onClose }) {
  const st = useStore()
  const counts = tally(st)
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const ranked = [...SNACKS].sort((a, b) => counts[b.k] - counts[a.k])
  const max = Math.max(1, ...Object.values(counts))
  const [busy, setBusy] = useState(false)
  const week = voteWeek()
  const mon = new Date(week + 'T00:00:00Z')
  const nextMon = new Date(mon.getTime() + 7 * 86400000)
  const label = `${nextMon.getUTCMonth() + 1}/${nextMon.getUTCDate()}`
  const vote = async (k) => {
    if (busy || st.myVote === k) return
    setBusy(true)
    const first = !st.myVote
    await castVote(k)
    if (first) sysMsg(`🗳️ ${st.me.name} ${st.me.title}님이 간식 투표에 참여했어요!`)
    setBusy(false)
  }
  const medal = ['🥇', '🥈', '🥉']
  return (
    <Sheet onClose={onClose} wide className="vote-sheet">
      <h2>🗳️ 오늘의 간식 투표함</h2>
      <p className="sub">
        다음 주({label}~) 탕비실에 채울 간식을 골라 주세요 · 1인 1표, 언제든 바꿀 수 있어요
      </p>
      <div className="vote-grid">
        {SNACKS.map((x) => (
          <button key={x.k} className={'vote-opt' + (st.myVote === x.k ? ' on' : '')} onClick={() => vote(x.k)} disabled={busy}>
            <span className="ve">{x.e}</span>
            <span className="vl">{x.l}</span>
            {st.myVote === x.k && <span className="vmine">내 선택 ✓</span>}
          </button>
        ))}
      </div>
      <div className="vote-board">
        <div className="vb-head">
          <b>📊 실시간 순위</b>
          <span>총 {total}표</span>
        </div>
        {ranked.map((x, i) => {
          const c = counts[x.k]
          const pct = total ? Math.round((c / total) * 100) : 0
          return (
            <div className={'vb-row' + (st.myVote === x.k ? ' mine' : '')} key={x.k}>
              <span className="vb-rank">{c > 0 && i < 3 ? medal[i] : i + 1}</span>
              <span className="vb-name">
                {x.e} {x.l}
              </span>
              <div className="vb-track">
                <div className="vb-bar" style={{ width: `${(c / max) * 100}%`, background: x.c }} />
              </div>
              <span className="vb-count">
                {c}표 <small>{pct}%</small>
              </span>
            </div>
          )
        })}
      </div>
      <p className="vote-note">{st.voteMode === 'shared' ? '✓ 투표 결과는 Firebase에 저장되어 모든 동료에게 공유돼요 (매주 월요일 새 회차)' : 'ℹ️ 로컬 모드: 이 브라우저의 탭끼리만 집계돼요 (Firebase 설정 시 전체 공유)'}</p>
    </Sheet>
  )
}

/* ───────────────────── 점심 룰렛 ───────────────────── */
function Roulette({ onClose }) {
  const n = RESTAURANTS.length
  const seg = 360 / n
  const [rot, setRot] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])
  const spin = () => {
    if (spinning) return
    const idx = Math.floor(Math.random() * n)
    const jitter = (Math.random() - 0.5) * seg * 0.6
    const target = 360 - (idx + 0.5) * seg + jitter
    const base = rot - (rot % 360)
    const next = base + 360 * 7 + target
    setResult(null)
    setSpinning(true)
    setRot(next)
    spinWheel3D()
    timer.current = setTimeout(() => {
      setSpinning(false)
      setResult(idx)
      const st = useStore.getState()
      const me = st.me
      const id = uid()
      st.addMessage({ id: 'spin' + id, system: true, spin: true, text: `🎰 ${me.name} ${me.title}님의 점심 룰렛 결과 → 🍽️ ${RESTAURANTS[idx]}`, time: fmtTime(new Date()) })
      st.set({ lastSpin: { id, idx, at: Date.now() } })
      st.setBubble(`오늘 점심은 ${RESTAURANTS[idx]}! 🍽️`)
    }, 4700)
  }
  const R = 200
  const slices = RESTAURANTS.map((name, i) => {
    const a0 = ((i * seg - 90) * Math.PI) / 180
    const a1 = (((i + 1) * seg - 90) * Math.PI) / 180
    const d = `M${R},${R} L${R + R * Math.cos(a0)},${R + R * Math.sin(a0)} A${R},${R} 0 0 1 ${R + R * Math.cos(a1)},${R + R * Math.sin(a1)} Z`
    const mid = i * seg + seg / 2
    const label = name.length > 11 ? name.slice(0, 10) + '…' : name
    return (
      <g key={i}>
        <path d={d} fill={WHEEL_COLORS[i % WHEEL_COLORS.length]} stroke="#fff" strokeWidth="1.5" />
        <text x={R} y={R} transform={`rotate(${mid - 90} ${R} ${R}) translate(${R - 12} 0)`} textAnchor="end" dominantBaseline="middle" className="wl">
          {label}
        </text>
      </g>
    )
  })
  return (
    <Sheet onClose={onClose} wide className="roulette-sheet">
      <h2>🎰 오늘 뭐 먹지? 점심 룰렛</h2>
      <p className="sub">동편마을 · 인덕원 맛집 {n}곳 중 하나가 당첨돼요</p>
      <div className="wheel-wrap">
        <div className="wheel-pointer" />
        <svg viewBox={`0 0 ${R * 2} ${R * 2}`} className="wheel-svg" style={{ transform: `rotate(${rot}deg)`, transition: spinning ? 'transform 4.6s cubic-bezier(0.12, 0.7, 0.08, 1)' : 'none' }}>
          {slices}
          <circle cx={R} cy={R} r="26" fill="#fff" stroke="#f08c00" strokeWidth="5" />
        </svg>
        <button className="wheel-hub" onClick={spin} disabled={spinning}>
          {spinning ? '…' : 'GO'}
        </button>
      </div>
      <div className="roulette-result">
        {result !== null ? (
          <div className="win" key={result}>
            <span className="confetti">🎉</span>
            <div>
              <small>오늘의 점심 당첨!</small>
              <b>{RESTAURANTS[result]}</b>
              <em>✓ 사무실 채팅에 공유했어요</em>
            </div>
          </div>
        ) : (
          <div className="hint2">{spinning ? '두근두근… 돌아가는 중 🎲' : '가운데 GO 버튼이나 아래 버튼을 눌러 주세요'}</div>
        )}
      </div>
      <div className="sheet-foot">
        <button className="go small" onClick={spin} disabled={spinning}>
          {result !== null ? '🔄 다시 돌리기' : '🎰 룰렛 돌리기'}
        </button>
      </div>
    </Sheet>
  )
}

/* ───────────────────── HUD + 상태/기분 ───────────────────── */
export function HUD() {
  const joined = useStore((s) => s.joined)
  const zone = useStore((s) => s.zone)
  const me = useStore((s) => s.me)
  const overview = useStore((s) => s.overview)
  const remotes = useStore((s) => s.remotes)
  const mood = useStore((s) => s.mood)
  const status = useStore((s) => s.status)
  const netMode = useStore((s) => s.netMode)
  const [open, setOpen] = useState(false)
  const [clock, setClock] = useState(fmtTime(new Date()))
  useEffect(() => {
    const t = setInterval(() => setClock(fmtTime(new Date())), 10000)
    return () => clearInterval(t)
  }, [])
  if (!joined) return null
  const online = 1 + Object.values(remotes).filter((r) => r.name).length
  const pickMood = (m) => {
    useStore.getState().set({ mood: m })
  }
  const pickStatus = (s) => {
    useStore.getState().set({ status: s })
    sysMsg(`${s.e} ${me.name} ${me.title}님 상태: ${s.l}`)
  }
  return (
    <>
      <div className="hud-top">
        <div className="pill strong">🏢 건축사사무소</div>
        <div className="pill">📍 {zone}</div>
        <div className="pill">🕘 {clock}</div>
        <div className="pill" title={netMode === 'firebase' ? 'Firebase로 동료와 실시간 공유 중' : 'Firebase 미설정: 같은 브라우저의 다른 탭과만 공유 중'}>
          <span className="live" /> 접속 {online}명{netMode !== 'firebase' && <em className="local-badge">로컬 모드</em>}
        </div>
      </div>
      <div className="hud-right">
        <AmbienceControls />
        <button className={'tool' + (overview ? ' on' : '')} onClick={() => useStore.getState().toggleOverview()}>
          {overview ? '🎯 내 캐릭터 보기' : '🗺️ 전체 평면 보기'}
        </button>
        <div className="help">
          <div>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <kbd>←</kbd>
            <kbd>→</kbd> / <kbd>WASD</kbd> 이동
          </div>
          <div>🖱️ 바닥 클릭 → 걸어가기</div>
          <div>🖱️ 휠 → 확대/축소</div>
          <div>
            <kbd>Enter</kbd> 채팅 입력
          </div>
        </div>
      </div>
      <div className="me-wrap">
        {open && (
          <div className="mood-pop">
            <div className="mp-title">오늘의 기분</div>
            <div className="mp-row">
              {MOODS.map((m) => (
                <button key={m.e} className={mood.e === m.e ? 'on' : ''} onClick={() => pickMood(m)}>
                  <span>{m.e}</span>
                  {m.l}
                </button>
              ))}
            </div>
            <div className="mp-title">근무 상태</div>
            <div className="mp-row">
              {STATUSES.map((s) => (
                <button key={s.e} className={status.e === s.e ? 'on' : ''} onClick={() => pickStatus(s)}>
                  <span>{s.e}</span>
                  {s.l}
                </button>
              ))}
            </div>
            <button className="mp-done" onClick={() => setOpen(false)}>
              완료
            </button>
          </div>
        )}
        <button className="me-card" onClick={() => setOpen(!open)}>
          <div className="ava" style={{ background: me.shirt }}>
            {me.name[0]}
            <span className="ava-mood">{mood.e}</span>
          </div>
          <div className="me-txt">
            <div>
              <b>{me.name}</b> {me.title}
            </div>
            <div className="status">
              {status.e} {status.l}
            </div>
          </div>
          <div className="me-edit">
            오늘의 상태/기분
            <br />
            설정 {open ? '▾' : '▴'}
          </div>
        </button>
      </div>
    </>
  )
}

/* ───────────────────── 점심시간 알림 (KST 평일 11:25 / 11:30) ───────────────────── */
const LUNCH = {
  pre: { time: '11:25', icon: '⏰', title: '점심시간 5분 전입니다!', body: '오늘 뭐 먹을지 점심 룰렛을 돌려볼까요?', tone: 'pre' },
  lunch: { time: '11:30', icon: '🍚', title: '점심시간입니다!', body: '맛있게 식사하세요! 오후도 힘내요 💪', tone: 'lunch' },
}
function fireLunch(kind) {
  const a = LUNCH[kind]
  useStore.getState().set({ toast: { ...a, kind, key: uid() } })
  playChime()
  sysMsg(`${a.icon} ${a.title} ${a.body}`)
}

export function LunchAlerts() {
  const joined = useStore((s) => s.joined)
  const toast = useStore((s) => s.toast)
  useEffect(() => {
    if (!joined) return
    const check = () => {
      const k = kstNow()
      const dow = k.getUTCDay()
      if (dow === 0 || dow === 6) return // 주말 제외
      const hm = `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`
      const day = k.toISOString().slice(0, 10)
      for (const kind of ['pre', 'lunch']) {
        if (hm !== LUNCH[kind].time) continue
        const key = `archi-office-3d-lunch-${kind}`
        let last = null
        try {
          last = localStorage.getItem(key)
        } catch {}
        if (last === day || fired.has(kind + day)) continue
        fired.add(kind + day)
        try {
          localStorage.setItem(key, day)
        } catch {}
        fireLunch(kind)
      }
    }
    check()
    const t = setInterval(check, 10000)
    return () => clearInterval(t)
  }, [joined])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => useStore.getState().set({ toast: null }), 20000)
    return () => clearTimeout(t)
  }, [toast?.key])
  if (!toast) return null
  const close = () => useStore.getState().set({ toast: null })
  return (
    <div className={'lunch-toast ' + toast.tone} key={toast.key} role="status">
      <div className="lt-icon">{toast.icon}</div>
      <div className="lt-body">
        <div className="lt-time">KST {toast.time} · 점심 알림</div>
        <b>{toast.title}</b>
        <span>{toast.body}</span>
      </div>
      <div className="lt-actions">
        <button
          className="lt-go"
          onClick={() => {
            close()
            useStore.getState().set({ modal: 'roulette' })
          }}
        >
          🎰 점심 룰렛 바로가기
        </button>
        <button className="lt-x" onClick={close} aria-label="닫기">
          ✕
        </button>
      </div>
      <div className="lt-progress" />
    </div>
  )
}
const fired = new Set()

function AmbienceControls() {
  const lightMode = useStore((s) => s.lightMode)
  const timeMode = useStore((s) => s.timeMode)
  const musicOn = useStore((s) => s.musicOn)
  const [kst, setKst] = useState(() => kstNow())
  useEffect(() => {
    const t = setInterval(() => setKst(kstNow()), 15000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (musicOn) setRain(timeMode === 'night')
  }, [timeMode, musicOn])
  const toggleMusic = async () => {
    if (musicOn) {
      stopMusic()
      useStore.getState().set({ musicOn: false })
    } else {
      try {
        await startMusic(useStore.getState().timeMode === 'night')
        useStore.getState().set({ musicOn: true })
      } catch {
        sysMsg('🔇 이 브라우저에서는 소리를 재생할 수 없어요.')
      }
    }
  }
  const hh = String(kst.getUTCHours()).padStart(2, '0')
  const mm = String(kst.getUTCMinutes()).padStart(2, '0')
  const opts = [
    ['auto', '🕘 자동'],
    ['day', '☀️ 낮'],
    ['sunset', '🌅 노을'],
    ['night', '🌙 야근'],
  ]
  return (
    <div className="amb">
      <button className={'tool music' + (musicOn ? ' on' : '')} onClick={toggleMusic}>
        {musicOn ? '🎵 배경음악 ON' : '🔇 배경음악 OFF'}
        {musicOn && <span className="eq"><i /><i /><i /></span>}
      </button>
      <div className="bell-tests">
        <button onClick={() => fireLunch('pre')}>🔔 11:25 알림 테스트</button>
        <button onClick={() => fireLunch('lunch')}>🔔 11:30 알림 테스트</button>
      </div>
      <div className="amb-box">
        <div className="amb-now">
          KST {hh}:{mm} · {MODE_LABEL[timeMode]} 모드{lightMode !== 'auto' && <em> (미리보기)</em>}
          {musicOn && <span>{timeMode === 'night' ? ' · 🌧️ 로파이+빗소리' : ' · 🎧 로파이'}</span>}
        </div>
        <div className="amb-seg">
          {opts.map(([k, l]) => (
            <button key={k} className={lightMode === k ? 'on' : ''} onClick={() => useStore.getState().set({ lightMode: k })}>
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export { live }
