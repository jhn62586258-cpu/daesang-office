import { useEffect, useMemo, useRef, useState } from 'react'
import { seats, zoneAt as zoneAtPos } from './layout'
import { live, useStore, MOODS, STATUSES, fmtTime, uid } from './store'
import {
  addNote,
  deleteNote,
  noteAuthor,
  addDeskNote,
  archiveDeskNote,
  deleteArchived,
  saveNotionUrl,
  setVacation,
  removeDeskNote,
  snackList,
  castVote,
  tally,
  voteWeek,
  addSnackOption,
  removeSnackOption,
  addRestaurant,
  removeRestaurant,
  addStory,
  removeStory,
  addWish,
  removeWish,
  saveDday,
  removeDday,
  ddayLabel,
  kstToday,
  saveModel,
  removeModel,
} from './notes'
import { COFFEE } from './furniture'
import { isAdminDept, seatOf, ADMIN_ONLY_MSG } from './roles'
import { live as liveState } from './store'
import { canRide, standSpotFor, outingText } from './Player'
import NiroLog from './NiroLog'
import { cycleWeatherPreview } from './weather'
import { STORIES, todayStoryIndex } from './stories'
import { myUid } from './db'
import { startMusic, stopMusic, playChime, currentSongName } from './music'
import { kstNow, MODE_LABEL } from './Ambience'
import { spinWheel3D } from './net'
import { RESTAURANTS, WHEEL_COLORS } from './restaurants'

const TITLES = ['대표님', '전무', '이사', '상무', '실장', '부장', '과장', '대리', '주임', '사원', '인턴']
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

function loadOutfit() {
  try {
    return JSON.parse(localStorage.getItem('archi-office-3d-outfit') || '{}') || {}
  } catch {
    return {}
  }
}

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

// 내 화면에만 보이는 안내 메시지 (채팅창 가운데 회색 줄)
export const sysMsg = (text, extra = {}) =>
  useStore.getState().addMessage({ id: 'sys' + uid(), system: true, text, time: fmtTime(new Date()), at: Date.now(), ...extra })

// 확인창 열기
export const askConfirm = (opts) => useStore.getState().set({ confirm: opts })

/* ───────────────────── 확인창 ───────────────────── */
export function ConfirmDialog() {
  const c = useStore((s) => s.confirm)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!c) return
    const k = (e) => e.key === 'Escape' && useStore.getState().set({ confirm: null })
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [c])
  if (!c) return null
  const close = () => useStore.getState().set({ confirm: null })
  const ok = async () => {
    setBusy(true)
    try {
      await c.onOk()
    } catch (e) {
      console.warn(e)
      sysMsg('⚠️ 처리하지 못했어요. (Firebase 보안 규칙을 확인해 주세요)')
    }
    setBusy(false)
    close()
  }
  return (
    <div className="modal-bg soft confirm-bg" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet confirm">
        <h2>{c.title}</h2>
        {c.body && <p className="sub">{c.body}</p>}
        <div className="sheet-foot">
          <button className="ghost" onClick={close}>
            취소
          </button>
          <button className={'go small' + (c.danger ? ' danger-go' : '')} onClick={ok} disabled={busy} autoFocus>
            {busy ? '처리 중…' : c.okText || '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}

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
  // 🔗 ?user=이름 → 선택 창 없이 내 자리에서 바로 입장
  const [urlNotice, setUrlNotice] = useState('')
  useEffect(() => {
    if (useStore.getState().joined) return
    let q = ''
    try {
      q = (new URLSearchParams(window.location.search).get('user') || '').trim()
    } catch {}
    if (!q) return
    const idx = seats.findIndex((st) => st.name === q)
    if (idx < 0) {
      setUrlNotice(`'${q.slice(0, 12)}' 님을 직원 명단에서 찾지 못했어요. 아래에서 직접 선택해 주세요.`)
      return
    }
    const st = seats[idx]
    const o = loadOutfit()
    const spot = standSpotFor(idx)
    Object.assign(liveState.player, { x: spot.x, z: spot.z, rot: Math.PI })
    useStore.getState().join({ id: persistentId(), name: st.name, title: st.title, shirt: o.shirt || SHIRTS[0].c, pants: o.pants || PANTS[0], hair: o.hair || 'short' })
    sysMsg(`${st.name} ${st.title}님이 출근했습니다. ☀️`)
    // 3D 장면(캐릭터)이 준비될 때까지 몇 번 재시도해서 내 자리에 앉기
    let tries = 0
    const trySit = () => {
      if (useStore.getState().sitting !== null || tries++ > 20) return
      window.dispatchEvent(new CustomEvent('sit-request', { detail: { idx } }))
      setTimeout(trySit, 500)
    }
    setTimeout(trySit, 600)
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
    try {
      localStorage.setItem('archi-office-3d-outfit', JSON.stringify({ shirt, pants, hair }))
    } catch {}
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
        {urlNotice && <div className="url-notice">🔗 {urlNotice}</div>}
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

/* ───────────────────── 상황별 액션 버튼 ───────────────────── */
export function ActionPanel() {
  const joined = useStore((s) => s.joined)
  const inPantry = useStore((s) => s.inPantry)
  const nearSeat = useStore((s) => s.nearSeat)
  const nearBoard = useStore((s) => s.nearBoard)
  const nearRoulette = useStore((s) => s.nearRoulette)
  const nearTree = useStore((s) => s.nearTree)
  const nearCoffee = useStore((s) => s.nearCoffee)
  const nearDday = useStore((s) => s.nearDday)
  const nearModels = useStore((s) => s.nearModels)
  const holding = useStore((s) => s.holding)
  const nearStroller = useStore((s) => s.nearStroller)
  const nearNiro = useStore((s) => s.nearNiro)
  const nearStory = useStore((s) => s.nearStory)
  const nearNotion = useStore((s) => s.nearNotion)
  const riding = useStore((s) => s.riding)
  const strollerBusy = useStore((s) => Object.values(s.remotes).some((r) => r.riding))
  const sitting = useStore((s) => s.sitting)
  const modal = useStore((s) => s.modal)
  const me = useStore((s) => s.me)
  const deskNotes = useStore((s) => s.deskNotes)
  if (!joined || modal) return null
  const countFor = (name) => deskNotes.filter((n) => n.seat === name).length
  // 💌 비밀 쪽지는 책상 주인만 열어볼 수 있음
  const listBtn = (name) => {
    const c = countFor(name)
    return c > 0 && me.name === name ? (
      <button className="act b-light" onClick={() => useStore.getState().set({ modal: { deskList: name } })}>
        📬 내 쪽지 {c}개 보기
      </button>
    ) : null
  }

  const groups = []
  if (sitting !== null) {
    const s = seats[sitting]
    groups.push(
      <div className="act-group" key="sit">
        <div className="act-title">
          🪑 {s.name} {s.title} 자리
        </div>
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
          <div className="act-title">
            {s.name} {s.title} 자리
          </div>
          <button className="act b-sit" onClick={() => window.dispatchEvent(new CustomEvent('sit-request', { detail: { idx: nearSeat } }))}>
            🪑 자리에 앉기
          </button>
          {me.name !== s.name && (
            <button className="act b-letter" onClick={() => useStore.getState().set({ modal: { deskWrite: nearSeat } })}>
              💌 비밀 쪽지 남기기
            </button>
          )}
          {listBtn(s.name)}
        </div>
      )
    }
    if (inPantry) {
      // 탕비실: 간식 투표 + 점심 룰렛만
      groups.push(
        <div className="act-group" key="pantry">
          <div className="act-title">탕비실</div>
          <button className="act b-vote" onClick={() => useStore.getState().set({ modal: 'vote' })}>
            🗳️ 간식 투표하기
          </button>
          <button className="act b-roulette" onClick={() => useStore.getState().set({ modal: 'roulette' })}>
            🎰 룰렛 돌리기
          </button>
        </div>
      )
    }
    if (nearStory) {
      groups.push(
        <div className="act-group" key="story">
          <div className="act-title">다목적실 게시판</div>
          <button className="act b-story" onClick={() => useStore.getState().set({ modal: 'stories' })}>
            🏛️ 오늘의 건축 이야기 보기
          </button>
        </div>
      )
    }
    if (nearNotion) {
      groups.push(
        <div className="act-group" key="notion">
          <div className="act-title">관리부 수납장</div>
          <button className="act b-notion" onClick={openNotion}>
            📌 사내 공지·서식함(Notion) 열기
          </button>
          {isAdminDept(me) && (
            <button className="act b-light" onClick={() => useStore.getState().set({ modal: 'notionEdit' })}>
              ⚙️ 노션 링크 수정
            </button>
          )}
        </div>
      )
    }
    if (nearStroller && !riding) {
      groups.push(
        <div className="act-group" key="stroller">
          <div className="act-title">🍼 하린이 전용 유모차</div>
          {!canRide(me.name) ? (
            <span className="act-note">닉네임에 '하린'이 들어간 아기만 탈 수 있어요 👶</span>
          ) : strollerBusy ? (
            <span className="act-note">다른 하린이가 타고 있어요</span>
          ) : (
            <button className="act b-ride" onClick={() => window.dispatchEvent(new Event('ride-request'))}>
              🍼 유모차 타기
            </button>
          )}
        </div>
      )
    }
    if (nearNiro) {
      groups.push(
        <div className="act-group" key="niro">
          <div className="act-title">🔑 니로 키박스</div>
          <button className="act b-niro" onClick={() => useStore.getState().set({ modal: 'niro' })}>
            🚗 니로 운행일지
          </button>
        </div>
      )
    }
    if (nearTree) {
      groups.push(
        <div className="act-group" key="tree">
          <div className="act-title">🎄 크리스마스 트리</div>
          <button className="act b-tree" onClick={() => useStore.getState().set({ modal: 'wishes' })}>
            🎄 트리 소원 카드 달기
          </button>
        </div>
      )
    }
    if (nearDday) {
      groups.push(
        <div className="act-group" key="dday">
          <div className="act-title">관리부 전광판</div>
          <button className="act b-dday" onClick={() => useStore.getState().set({ modal: 'dday' })}>
            📅 마감 D-Day 보드
          </button>
        </div>
      )
    }
    if (nearModels) {
      groups.push(
        <div className="act-group" key="models">
          <div className="act-title">모형 전시대</div>
          <button className="act b-models" onClick={() => useStore.getState().set({ modal: 'models' })}>
            📐 진행 중인 프로젝트 보기
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
    if (nearRoulette && !inPantry) {
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
  if (riding) {
    groups.push(
      <div className="act-group" key="riding">
        <div className="act-title">🍼 유모차 타는 중 · 방향키로 이동</div>
        <button className="act b-light" onClick={() => window.dispatchEvent(new Event('unride-request'))}>
          🚼 유모차 내리기
        </button>
      </div>
    )
  }
  if (holding === 'coffee') {
    groups.push(
      <div className="act-group" key="mug">
        <div className="act-title">☕ 따뜻한 커피를 들고 있어요</div>
        <button
          className="act b-light"
          onClick={() => {
            useStore.getState().returnCoffee()
            sysMsg('☕ 커피잔을 반납했어요. 잘 마셨습니다!')
          }}
        >
          🫗 커피잔 반납
        </button>
      </div>
    )
  }
  if (!groups.length) return null
  return <div className="actions">{groups}</div>
}

// 📌 노션 열기 (클릭 이벤트 안에서 바로 새 창으로)
function openNotion() {
  const url = useStore.getState().notionUrl
  if (!url) {
    sysMsg(isAdminDept(useStore.getState().me) ? '📌 아직 노션 링크가 없어요. [⚙️ 노션 링크 수정]에서 등록해 주세요.' : '📌 아직 노션 링크가 등록되지 않았어요. 관리부에 문의해 주세요.')
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

function brewCoffee() {
  const st = useStore.getState()
  st.brewCoffee()
  playChime()
  sysMsg(`☕ 커피를 내렸어요! 동료들에게 "탕비실에서 한잔 하실래요?" 알림을 보냈어요.`)
}

/* ───────────────────── 모달 공통 ───────────────────── */
function Sheet({ children, onClose, wide, className = '' }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && !useStore.getState().confirm && onClose()
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
  if (!modal || modal === 'newRoom') return null
  if (modal === 'noteWrite') return <NoteWrite onClose={close} />
  if (modal === 'board') return <BoardView onClose={close} />
  if (modal === 'roulette') return <Roulette onClose={close} />
  if (modal === 'vote') return <VoteModal onClose={close} />
  if (modal === 'archive') return <ArchiveModal onClose={close} />
  if (modal === 'stretch') return <StretchModal onClose={close} />
  if (modal === 'stories') return <StoriesModal onClose={close} />
  if (modal === 'wishes') return <WishesModal onClose={close} />
  if (modal === 'dday') return <DdayModal onClose={close} />
  if (modal === 'models') return <ModelsModal onClose={close} />
  if (modal === 'niro') return <NiroModal onClose={close} />
  if (modal === 'notionEdit') return <NotionEditModal onClose={close} />
  if (modal === 'vacation') return <VacationModal onClose={close} />
  if (modal === 'people') return <PeopleModal onClose={close} />
  if (modal.note) return <NoteView note={modal.note} onClose={close} back={modal.back} />
  if (modal.deskWrite !== undefined) return <DeskWrite idx={modal.deskWrite} onClose={close} />
  if (modal.deskNote) return <DeskNoteView note={modal.deskNote} onClose={close} back={modal.back} />
  if (modal.deskList) return <DeskList name={modal.deskList} onClose={close} />
  if (modal.archived) return <ArchivedView note={modal.archived} onClose={close} />
  return null
}

/* ───────────────────── 사내 자유 게시판 ───────────────────── */
function NoteWrite({ onClose }) {
  const [color, setColor] = useState(NOTE_COLORS[0].c)
  const [text, setText] = useState('')
  const [anon, setAnon] = useState(true) // 기본값: 익명
  const [busy, setBusy] = useState(false)
  const me = useStore((s) => s.me)
  const submit = async (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    try {
      await addNote({ text: t, color, anon })
      sysMsg(anon ? '🕵️ 누군가 게시판에 익명 메모를 붙였어요.' : `📝 ${me.name} ${me.title}님이 게시판에 메모를 붙였어요.`)
      onClose()
    } catch (e2) {
      console.warn(e2)
      sysMsg('⚠️ 메모를 저장하지 못했어요. (Firebase 보안 규칙을 확인해 주세요)')
      setBusy(false)
    }
  }
  return (
    <Sheet onClose={onClose}>
      <h2>📝 포스트잇 붙이기</h2>
      <form onSubmit={submit} className="note-form">
        <div className="note-preview" style={{ background: color }}>
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={60} placeholder="예: 오늘 빨리 퇴근하고 싶어요 🙏" />
          <span className="cnt">{text.length}/60</span>
          <span className="sign">- {anon ? '익명' : `${me.name} ${me.title}`}</span>
        </div>
        <div className="swatches big">
          {NOTE_COLORS.map((c) => (
            <button type="button" key={c.c} title={c.n} className={color === c.c ? 'on' : ''} style={{ background: c.c }} onClick={() => setColor(c.c)} />
          ))}
        </div>
        <label className={'anon-check' + (anon ? ' on' : '')}>
          <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
          <span>🕵️ 익명으로 남기기</span>
          <small>{anon ? '이름이 저장되지 않고 "익명"으로 표시돼요' : `"${me.name} ${me.title}" 실명으로 표시돼요`}</small>
        </label>
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
            <span className="pa">- {noteAuthor(n)}</span>
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
  const mine = note.authorId && note.authorId === myUid()
  const date = note.at ? new Date(note.at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <Sheet onClose={onClose} className="note-sheet">
      <div className="note-big" style={{ background: note.color }}>
        <span className="pin" />
        <p>{note.text}</p>
        <div className="by">
          - {noteAuthor(note)}
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
const seatLabel = (name) => {
  const s = seatByName(name)
  return s ? `${s.name} ${s.title}` : name
}
const fullDate = (t) => (t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '')

// 쪽지 내용 한 줄 요약 (부재중 전화는 발신자·연락처 포함)
const noteHead = (n) => (n.kind === 'call' ? `📞 부재중 전화${n.caller ? ` · ${n.caller}` : ''}${n.phone ? ` (${n.phone})` : ''}` : '💬 일반 쪽지')

function DeskWrite({ idx, onClose }) {
  const seat = seats[idx]
  const me = useStore((s) => s.me)
  const [kind, setKind] = useState('note')
  const [color, setColor] = useState(DESK_COLORS[0].c)
  const [text, setText] = useState('')
  const [caller, setCaller] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = kind === 'call' ? caller.trim() || text.trim() : text.trim()
  const submit = async (e) => {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    try {
      const body = text.trim() || (kind === 'call' ? '전화 왔었어요. 확인 부탁드려요.' : '')
      await addDeskNote({ seat: seat.name, kind, caller, phone, text: body, color: kind === 'call' ? '#f8bbd0' : color })
      sysMsg(`${kind === 'call' ? '📞' : '💌'} ${seat.name} ${seat.title}님 책상에 ${kind === 'call' ? '부재중 전화 메모' : '비밀 쪽지'}를 남겼어요. (본인만 볼 수 있어요)`)
      onClose()
    } catch (e2) {
      console.warn(e2)
      sysMsg('⚠️ 쪽지를 저장하지 못했어요. (Firebase 보안 규칙을 확인해 주세요)')
      setBusy(false)
    }
  }
  return (
    <Sheet onClose={onClose}>
      <h2>💌 비밀 쪽지 남기기</h2>
      <p className="sub">
        {seat.name} {seat.title}님 책상에 포스트잇으로 붙여요 · 🔒 책상 주인만 내용을 볼 수 있어요
      </p>
      <div className="kind-seg">
        <button type="button" className={kind === 'note' ? 'on' : ''} onClick={() => setKind('note')}>
          💬 일반 쪽지
        </button>
        <button type="button" className={kind === 'call' ? 'on call' : ''} onClick={() => setKind('call')}>
          📞 부재중 전화 메모
        </button>
      </div>
      <form onSubmit={submit} className="note-form">
        {kind === 'call' && (
          <div className="row2">
            <label className="field">
              <span>전화 주신 분</span>
              <input value={caller} onChange={(e) => setCaller(e.target.value)} maxLength={20} placeholder="예: 안양시청 건축과 김주무관" autoFocus />
            </label>
            <label className="field">
              <span>연락처</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} inputMode="tel" placeholder="예: 031-000-0000" />
            </label>
          </div>
        )}
        <div className="note-preview desk" style={{ background: kind === 'call' ? '#f8bbd0' : color }}>
          <div className="to">
            {kind === 'call' ? '📞' : '💌'} To. {seat.name} {seat.title}님
          </div>
          <textarea
            autoFocus={kind === 'note'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={80}
            placeholder={kind === 'call' ? '용건 (예: 인허가 서류 관련, 오후에 회신 부탁)' : `${seat.title}님, 다녀오시면 전화 부탁드려요!`}
          />
          <div className="from">
            - {me.name} {me.title}
          </div>
          <span className="cnt">{text.length}/80</span>
        </div>
        {kind === 'note' && (
          <div className="swatches big">
            {DESK_COLORS.map((c) => (
              <button type="button" key={c.c} title={c.n} className={color === c.c ? 'on' : ''} style={{ background: c.c }} onClick={() => setColor(c.c)} />
            ))}
          </div>
        )}
        <button className="go" disabled={!ok || busy}>
          {busy ? '붙이는 중…' : '🔒 비밀 쪽지 붙이기'}
        </button>
      </form>
    </Sheet>
  )
}

function DeskNoteView({ note, onClose, back }) {
  const me = useStore((s) => s.me)
  const [busy, setBusy] = useState(false)
  const owner = me && me.name === note.seat
  if (!owner)
    return (
      <Sheet onClose={onClose} className="lock-sheet">
        <div className="lock-big">🔒</div>
        <h2>본인만 확인할 수 있는 비밀 쪽지입니다.</h2>
        <p className="sub">
          {seatLabel(note.seat)}님 책상에 붙은 {note.kind === 'call' ? '📞 부재중 전화 메모' : '💬 쪽지'}예요.
        </p>
        <div className="sheet-foot center">
          <button className="go small" onClick={onClose}>
            확인
          </button>
        </div>
      </Sheet>
    )
  const run = async (fn, msg) => {
    setBusy(true)
    try {
      await fn(note)
      sysMsg(msg)
      useStore.getState().set({ modal: back || null })
    } catch (e) {
      console.warn(e)
      sysMsg('⚠️ 처리하지 못했어요. (Firebase 보안 규칙을 확인해 주세요)')
      setBusy(false)
    }
  }
  return (
    <Sheet onClose={onClose} className="note-sheet">
      <div className="note-big" style={{ background: note.color }}>
        <span className="pin tape" />
        <div className="to">{noteHead(note)}</div>
        <p>{note.text}</p>
        <div className="by">
          - {note.name} {note.title}
          <small>{fullDate(note.at)}</small>
        </div>
      </div>
      <div className="sheet-foot">
        {back && (
          <button className="ghost" onClick={() => useStore.getState().set({ modal: back })}>
            ← 목록으로
          </button>
        )}
        <button className="ghost danger" disabled={busy} onClick={() => run(async (n) => (await deleteArchivedLive(n)), '🗑️ 쪽지를 삭제했어요.')}>
          🗑️ 삭제
        </button>
        <button className="go small ok" onClick={() => run(archiveDeskNote, '✅ 쪽지를 확인했어요. (📬 보관함으로 이동)')} disabled={busy}>
          ✅ 확인 완료 (보관함)
        </button>
      </div>
    </Sheet>
  )
}
// 책상에 붙은 쪽지를 보관함 없이 바로 삭제
const deleteArchivedLive = (n) => removeDeskNote(n)

function DeskList({ name, onClose }) {
  const all = useStore((s) => s.deskNotes)
  const me = useStore((s) => s.me)
  const notes = all.filter((n) => n.seat === name)
  useEffect(() => {
    if (!notes.length) onClose()
  }, [notes.length])
  if (!me || me.name !== name)
    return (
      <Sheet onClose={onClose} className="lock-sheet">
        <div className="lock-big">🔒</div>
        <h2>본인만 확인할 수 있는 비밀 쪽지입니다.</h2>
      </Sheet>
    )
  return (
    <Sheet onClose={onClose}>
      <h2>📬 내 책상의 비밀 쪽지</h2>
      <p className="sub">{notes.length}개 · 눌러서 읽고 확인 완료하면 보관함으로 이동해요</p>
      <div className="desk-list">
        {notes.map((n) => (
          <button key={n.id} className="dl-item" style={{ background: n.color }} onClick={() => useStore.getState().set({ modal: { deskNote: n, back: { deskList: name } } })}>
            <span className="dl-kind">{noteHead(n)}</span>
            <span className="dl-text">{n.text}</span>
            <span className="dl-by">
              - {n.name} {n.title} · {fullDate(n.at)}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

/* ───────────────────── 📬 쪽지 보관함 (내 자리 것만) ───────────────────── */
function ArchiveModal({ onClose }) {
  const archive = useStore((s) => s.deskArchive)
  const me = useStore((s) => s.me)
  const mySeat = seatByName(me.name) ? me.name : null
  const mine = mySeat ? archive.filter((n) => n.seat === mySeat) : []
  return (
    <Sheet onClose={onClose} wide>
      <h2>📬 내 쪽지 보관함</h2>
      <p className="sub">
        {mySeat ? `확인 완료한 내 책상(${seatLabel(mySeat)})의 쪽지 · 총 ${mine.length}개 · 🔒 본인만 볼 수 있어요` : '직원 명단에 있는 이름으로 입장하면 내 책상의 쪽지 보관함을 볼 수 있어요.'}
      </p>
      <div className="arch-list">
        {mySeat && mine.length === 0 && <div className="room-empty">보관된 쪽지가 없어요.</div>}
        {mine.map((n) => (
          <div key={n.id} className="arch-item">
            <span className="arch-color" style={{ background: n.color }} />
            <button className="arch-main" onClick={() => useStore.getState().set({ modal: { archived: n } })}>
              <div className="arch-top">
                <b>{noteHead(n)}</b>
                <span>
                  보낸 사람 {n.name} {n.title}
                </span>
              </div>
              <div className="arch-text">{n.text}</div>
              <div className="arch-meta">
                받은 시간 {fullDate(n.at)}
                {n.checkedAt ? ` · 확인 ${fullDate(n.checkedAt)}` : ''}
              </div>
            </button>
            <button
              className="arch-del"
              title="영구 삭제"
              onClick={() =>
                askConfirm({
                  title: '🗑️ 이 쪽지를 영구 삭제할까요?',
                  body: `"${n.text}" — 삭제하면 되돌릴 수 없어요.`,
                  okText: '영구 삭제',
                  danger: true,
                  onOk: () => deleteArchived(n),
                })
              }
            >
              🗑️
            </button>
          </div>
        ))}
      </div>
    </Sheet>
  )
}

function ArchivedView({ note, onClose }) {
  const me = useStore((s) => s.me)
  if (!me || me.name !== note.seat)
    return (
      <Sheet onClose={onClose} className="lock-sheet">
        <div className="lock-big">🔒</div>
        <h2>본인만 확인할 수 있는 비밀 쪽지입니다.</h2>
      </Sheet>
    )
  return (
    <Sheet onClose={onClose} className="note-sheet">
      <div className="note-big archived" style={{ background: note.color }}>
        <span className="pin tape" />
        <div className="to">💌 To. {seatLabel(note.seat)}님</div>
        <p>{note.text}</p>
        <div className="by">
          - {note.name} {note.title}
          <small>받은 시간 {fullDate(note.at)}</small>
          {note.checkedAt > 0 && (
            <small>
              ✅ 확인 {fullDate(note.checkedAt)} {note.checkedBy && `· ${note.checkedBy}`}
            </small>
          )}
        </div>
      </div>
      <div className="sheet-foot">
        <button className="ghost" onClick={() => useStore.getState().set({ modal: 'archive' })}>
          ← 보관함으로
        </button>
        <button
          className="ghost danger"
          onClick={() =>
            askConfirm({
              title: '🗑️ 이 쪽지를 영구 삭제할까요?',
              body: '삭제하면 되돌릴 수 없어요.',
              okText: '영구 삭제',
              danger: true,
              onOk: async () => {
                await deleteArchived(note)
                useStore.getState().set({ modal: 'archive' })
              },
            })
          }
        >
          🗑️ 영구 삭제
        </button>
      </div>
    </Sheet>
  )
}

/* ───────────────────── 간식 투표 ───────────────────── */
function VoteModal({ onClose }) {
  const myVote = useStore((s) => s.myVote)
  const sharedVotes = useStore((s) => s.sharedVotes)
  const snackOptions = useStore((s) => s.snackOptions)
  const voteMode = useStore((s) => s.voteMode)
  const me = useStore((s) => s.me)
  const st = { sharedVotes, snackOptions }
  const list = snackList(st)
  const counts = tally(st)
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const ranked = [...list].sort((a, b) => counts[b.k] - counts[a.k])
  const max = Math.max(1, ...Object.values(counts))
  const [busy, setBusy] = useState(false)
  const [newOpt, setNewOpt] = useState('')
  const week = voteWeek()
  const mon = new Date(week + 'T00:00:00Z')
  const nextMon = new Date(mon.getTime() + 7 * 86400000)
  const label = `${nextMon.getUTCMonth() + 1}/${nextMon.getUTCDate()}`
  const vote = async (k) => {
    if (busy || myVote === k) return
    setBusy(true)
    const first = !myVote
    try {
      await castVote(k)
      if (first) sysMsg(`🗳️ ${me.name} ${me.title}님이 간식 투표에 참여했어요!`)
    } catch (e) {
      console.warn(e)
      sysMsg('⚠️ 투표를 저장하지 못했어요. (Firebase 보안 규칙을 확인해 주세요)')
    }
    setBusy(false)
  }
  const add = async (e) => {
    e.preventDefault()
    const t = newOpt.trim()
    if (!t) return
    if (list.some((x) => x.l.replace(/\s/g, '') === t.replace(/\s/g, ''))) return sysMsg(`ℹ️ '${t}'은(는) 이미 후보에 있어요.`)
    setNewOpt('')
    try {
      await addSnackOption(t)
      sysMsg(`🍬 ${me.name} ${me.title}님이 간식 후보 '${t}'을(를) 추가했어요.`)
    } catch (e2) {
      console.warn(e2)
      sysMsg('⚠️ 후보를 추가하지 못했어요.')
    }
  }
  const medal = ['🥇', '🥈', '🥉']
  return (
    <Sheet onClose={onClose} wide className="vote-sheet">
      <h2>🗳️ 오늘의 간식 투표함</h2>
      <p className="sub">다음 주({label}~) 탕비실에 채울 간식을 골라 주세요 · 1인 1표, 언제든 바꿀 수 있어요</p>
      <div className="vote-grid">
        {list.map((x) => (
          <div key={x.k} className={'vote-opt' + (myVote === x.k ? ' on' : '')}>
            <button className="vote-hit" onClick={() => vote(x.k)} disabled={busy}>
              <span className="ve">{x.e}</span>
              <span className="vl">{x.l}</span>
              {x.custom && <span className="vby">{x.custom.by} 추가</span>}
            </button>
            {myVote === x.k && <span className="vmine">내 선택 ✓</span>}
            {x.custom && (
              <button
                className="vote-x"
                title="후보 삭제"
                onClick={() =>
                  askConfirm({
                    title: `'${x.l}' 후보를 삭제할까요?`,
                    body: counts[x.k] ? `이 후보에 들어간 ${counts[x.k]}표도 집계에서 빠져요.` : '',
                    okText: '삭제',
                    danger: true,
                    onOk: () => removeSnackOption(x.custom),
                  })
                }
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <form className="add-row" onSubmit={add}>
        <input value={newOpt} onChange={(e) => setNewOpt(e.target.value)} maxLength={20} placeholder="먹고 싶은 간식 이름 (예: 아이스크림, 젤리)" />
        <button className="add-btn" disabled={!newOpt.trim()}>
          + 원하는 간식 후보 추가하기
        </button>
      </form>
      <div className="vote-board">
        <div className="vb-head">
          <b>📊 실시간 순위</b>
          <span>총 {total}표</span>
        </div>
        {ranked.map((x, i) => {
          const c = counts[x.k]
          const pct = total ? Math.round((c / total) * 100) : 0
          return (
            <div className={'vb-row' + (myVote === x.k ? ' mine' : '')} key={x.k}>
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
      <p className="vote-note">{voteMode === 'shared' ? '✓ 투표와 후보는 Firebase에 저장되어 모든 동료에게 공유돼요 (투표는 매주 월요일 새 회차)' : 'ℹ️ 로컬 모드: 이 브라우저의 탭끼리만 공유돼요 (Firebase 설정 시 전체 공유)'}</p>
    </Sheet>
  )
}

/* ───────────────────── 점심 룰렛 ───────────────────── */
function Roulette({ onClose }) {
  const custom = useStore((s) => s.customRestaurants)
  const me = useStore((s) => s.me)
  const names = useMemo(() => [...RESTAURANTS, ...custom.map((c) => c.name)], [custom])
  const n = names.length
  const seg = 360 / n
  const [rot, setRot] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null) // 당첨 식당 이름
  const [editOpen, setEditOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])
  const spin = () => {
    if (spinning) return
    const idx = Math.floor(Math.random() * n)
    const jitter = (Math.random() - 0.5) * seg * 0.6
    const target = 360 - (idx + 0.5) * seg + jitter
    const base = rot - (rot % 360)
    const next = base + 360 * 7 + target
    const picked = names[idx]
    setResult(null)
    setSpinning(true)
    setRot(next)
    spinWheel3D()
    timer.current = setTimeout(() => {
      setSpinning(false)
      setResult(picked)
      const st = useStore.getState()
      const id = uid()
      st.addMessage({ id: 'spin' + id, system: true, spin: true, text: `🎰 ${me.name} ${me.title}님의 점심 룰렛 결과 → 🍽️ ${picked}`, time: fmtTime(new Date()), at: Date.now() })
      st.set({ lastSpin: { id, idx, name: picked, at: Date.now() } })
      st.setBubble(`오늘 점심은 ${picked}! 🍽️`)
    }, 4700)
  }
  const add = async (e) => {
    e.preventDefault()
    const t = newName.trim()
    if (!t) return
    if (names.some((x) => x.replace(/\s/g, '') === t.replace(/\s/g, ''))) return sysMsg(`ℹ️ '${t}'은(는) 이미 룰렛에 있어요.`)
    setNewName('')
    try {
      await addRestaurant(t)
      sysMsg(`🍴 ${me.name} ${me.title}님이 점심 룰렛에 '${t}'을(를) 추가했어요.`)
    } catch (e2) {
      console.warn(e2)
      sysMsg('⚠️ 식당을 추가하지 못했어요.')
    }
  }
  const R = 200
  const fontSize = n > 50 ? 8.5 : n > 40 ? 9.5 : 10.5
  const maxChars = n > 50 ? 9 : 11
  const slices = names.map((name, i) => {
    const a0 = ((i * seg - 90) * Math.PI) / 180
    const a1 = (((i + 1) * seg - 90) * Math.PI) / 180
    const d = `M${R},${R} L${R + R * Math.cos(a0)},${R + R * Math.sin(a0)} A${R},${R} 0 0 1 ${R + R * Math.cos(a1)},${R + R * Math.sin(a1)} Z`
    const mid = i * seg + seg / 2
    const label = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name
    const isCustom = i >= RESTAURANTS.length
    return (
      <g key={i}>
        <path d={d} fill={WHEEL_COLORS[i % WHEEL_COLORS.length]} stroke="#fff" strokeWidth="1.5" />
        <text x={R} y={R} transform={`rotate(${mid - 90} ${R} ${R}) translate(${R - 12} 0)`} textAnchor="end" dominantBaseline="middle" className="wl" style={{ fontSize }}>
          {isCustom ? '★' : ''}
          {label}
        </text>
      </g>
    )
  })
  return (
    <Sheet onClose={onClose} wide className="roulette-sheet">
      <h2>🎰 오늘 뭐 먹지? 점심 룰렛</h2>
      <p className="sub">
        동편마을 · 인덕원 맛집 {n}곳 중 하나가 당첨돼요{custom.length > 0 && ` (기본 ${RESTAURANTS.length} + ★추가 ${custom.length})`}
      </p>
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
              <b>{result}</b>
              <em>✓ 사무실 채팅에 공유했어요</em>
            </div>
          </div>
        ) : (
          <div className="hint2">{spinning ? '두근두근… 돌아가는 중 🎲' : '가운데 GO 버튼이나 아래 버튼을 눌러 주세요'}</div>
        )}
      </div>
      <div className="sheet-foot">
        <button className="ghost" onClick={() => setEditOpen(!editOpen)}>
          🍴 식당 추가/편집 {editOpen ? '▴' : '▾'}
        </button>
        <button className="go small" onClick={spin} disabled={spinning}>
          {result !== null ? '🔄 다시 돌리기' : '🎰 룰렛 돌리기'}
        </button>
      </div>
      {editOpen && (
        <div className="rest-edit">
          <form className="add-row" onSubmit={add}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={30} placeholder="새 식당 이름 (예: 인덕원 칼국수)" disabled={spinning} />
            <button className="add-btn" disabled={!newName.trim() || spinning}>
              + 추가
            </button>
          </form>
          <div className="rest-title">★ 직원이 추가한 식당 {custom.length}곳</div>
          <div className="chips">
            {custom.length === 0 && <span className="chip-empty">아직 추가된 식당이 없어요</span>}
            {custom.map((c) => (
              <span key={c.id} className="chip custom" title={`${c.by} 추가`}>
                ★ {c.name}
                <button
                  disabled={spinning}
                  onClick={() =>
                    askConfirm({
                      title: `'${c.name}'을(를) 룰렛에서 뺄까요?`,
                      okText: '삭제',
                      danger: true,
                      onOk: () => removeRestaurant(c),
                    })
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <details className="rest-default">
            <summary>기본 맛집 {RESTAURANTS.length}곳 보기</summary>
            <div className="chips">
              {RESTAURANTS.map((r) => (
                <span key={r} className="chip">
                  {r}
                </span>
              ))}
            </div>
          </details>
        </div>
      )}
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
  const archiveCount = useStore((s) => (s.me ? s.deskArchive.filter((n) => n.seat === s.me.name).length : 0))
  const [open, setOpen] = useState(false)
  const [clock, setClock] = useState(fmtTime(new Date()))
  useEffect(() => {
    const t = setInterval(() => setClock(fmtTime(new Date())), 10000)
    return () => clearInterval(t)
  }, [])
  if (!joined) return null
  const online = 1 + Object.values(remotes).filter((r) => r.name).length
  const pickMood = (m) => useStore.getState().set({ mood: m })
  const pickStatus = (s) => {
    useStore.getState().set({ status: s })
    if (s.e !== '🚗') sysMsg(`${s.e} ${me.name} ${me.title}님 상태: ${s.l}`)
  }
  return (
    <>
      <div className="hud-top">
        <div className="pill strong">🏢 건축사사무소</div>
        <div className="pill">📍 {zone}</div>
        <div className="pill">🕘 {clock}</div>
        <button className="pill people-pill" onClick={() => useStore.getState().set({ modal: 'people' })} title="접속자 목록 보기">
          <span className="live" /> 접속 {online}명 ▾{netMode !== 'firebase' && <em className="local-badge">로컬 모드</em>}
        </button>
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
            {status.e === '🚗' && <OutingForm />}
            <button className="mp-done" onClick={() => setOpen(false)}>
              완료
            </button>
          </div>
        )}
        <div className="me-row">
          {isAdminDept(me) && (
            <button className="archive-btn vac-btn" onClick={() => useStore.getState().set({ modal: 'vacation' })}>
              🏖️ 직원 휴가 관리
            </button>
          )}
          <button className="archive-btn" onClick={() => useStore.getState().set({ modal: 'archive' })}>
            📬 쪽지 보관함{archiveCount > 0 && <b>{archiveCount}</b>}
          </button>
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
      </div>
    </>
  )
}

/* ───────────────────── 시간 알림 (KST) ───────────────────── */
// 점심: 평일 11:25 / 11:30 · 스트레칭: 매일 15:00
const ALERTS = {
  pre: { time: '11:25', weekdaysOnly: true, icon: '⏰', label: '점심 알림', title: '점심시간 5분 전입니다!', body: '오늘 뭐 먹을지 점심 룰렛을 돌려볼까요?', tone: 'pre', action: '🎰 점심 룰렛 바로가기', modal: 'roulette' },
  lunch: { time: '11:30', weekdaysOnly: true, icon: '🍚', label: '점심 알림', title: '점심시간입니다!', body: '맛있게 식사하세요! 오후도 힘내요 💪', tone: 'lunch', action: '🎰 점심 룰렛 바로가기', modal: 'roulette' },
  stretch: { time: '15:00', weekdaysOnly: false, icon: '🧘', label: '스트레칭 알림', title: '오후 3시! 굽은 허리와 피로한 눈을 풀어줄 시간이에요', body: '1분이면 충분해요. 함께 몸을 풀어 볼까요?', tone: 'stretch', action: '🧘 1분 스트레칭 시작', modal: 'stretch' },
}
const fired = new Set()
function fireAlert(kind) {
  const a = ALERTS[kind]
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
      const hm = `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`
      const day = k.toISOString().slice(0, 10)
      for (const [kind, a] of Object.entries(ALERTS)) {
        if (hm !== a.time) continue
        if (a.weekdaysOnly && (dow === 0 || dow === 6)) continue // 주말 제외
        const key = `archi-office-3d-alert-${kind}`
        let last = null
        try {
          last = localStorage.getItem(key)
        } catch {}
        if (last === day || fired.has(kind + day)) continue // 하루 한 번
        fired.add(kind + day)
        try {
          localStorage.setItem(key, day)
        } catch {}
        fireAlert(kind)
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
        <div className="lt-time">
          KST {toast.time} · {toast.label}
        </div>
        <b>{toast.title}</b>
        <span>{toast.body}</span>
      </div>
      <div className="lt-actions">
        <button
          className="lt-go"
          onClick={() => {
            close()
            useStore.getState().set({ modal: toast.modal })
          }}
        >
          {toast.action}
        </button>
        <button className="lt-x" onClick={close} aria-label="닫기">
          ✕
        </button>
      </div>
      <div className="lt-progress" />
    </div>
  )
}

/* ───────────────────── 🧘 1분 스트레칭 & 눈 운동 ───────────────────── */
const STEPS = [
  { sec: 15, icon: '🦒', title: '거북목 펴기', text: '턱을 뒤로 당기고 고개를 천천히 왼쪽, 오른쪽으로 5초씩 지그시 눌러주세요.', anim: 'neck' },
  { sec: 15, icon: '🙆‍♂️', title: '허리 펴고 기지개', text: '의자 등받이에서 등을 떼고 양손을 깍지 낀 채 천장을 향해 쭉 뻗어 허리를 펴주세요.', anim: 'reach' },
  { sec: 20, icon: '👀', title: '안구 건조 예방 눈 운동', text: '고개는 고정하고, 초록색 동그라미가 ∞(무한대) 모양과 사각형 모서리를 따라 움직이는 걸 눈동자로만 따라가 보세요!', anim: 'eyes' },
]
const TOTAL = STEPS.reduce((a, b) => a + b.sec, 0)

// 눈 운동 경로: 앞 10초 ∞, 뒤 10초 사각형 모서리 (모서리마다 잠깐 멈춤)
function eyePoint(t, w, h) {
  const cx = w / 2
  const cy = h / 2
  const ax = w * 0.4
  const ay = h * 0.36
  if (t < 10) {
    const a = (t / 5) * Math.PI * 2 // 5초에 한 바퀴
    return [cx + ax * Math.sin(a), cy + ay * Math.sin(a) * Math.cos(a) * 1.6]
  }
  const corners = [
    [cx - ax, cy - ay],
    [cx + ax, cy - ay],
    [cx + ax, cy + ay],
    [cx - ax, cy + ay],
  ]
  const u = ((t - 10) % 10) / 2.5 // 한 변에 2.5초
  const i = Math.floor(u)
  const f = u - i
  const hold = 0.3 // 각 모서리에서 잠깐 멈춤
  const e = f < hold ? 0 : (f - hold) / (1 - hold)
  const k = e < 0.5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2
  const [x0, y0] = corners[i % 4]
  const [x1, y1] = corners[(i + 1) % 4]
  return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k]
}

function EyeTrack({ elapsed }) {
  const W = 360
  const H = 190
  const [x, y] = eyePoint(elapsed, W, H)
  const trail = []
  for (let k = 1; k <= 6; k++) trail.push(eyePoint(Math.max(0, elapsed - k * 0.07), W, H))
  const inf = []
  for (let i = 0; i <= 80; i++) {
    const [px, py] = eyePoint((i / 80) * 5, W, H)
    inf.push(`${px.toFixed(1)},${py.toFixed(1)}`)
  }
  const square = elapsed >= 10
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="eye-track">
      {square ? (
        <rect x={W / 2 - W * 0.4} y={H / 2 - H * 0.36} width={W * 0.8} height={H * 0.72} rx="6" className="guide" />
      ) : (
        <polyline points={inf.join(' ')} className="guide" />
      )}
      {trail.map(([tx, ty], i) => (
        <circle key={i} cx={tx} cy={ty} r={14 - i * 1.6} fill="#51cf66" opacity={0.25 - i * 0.035} />
      ))}
      <circle cx={x} cy={y} r="15" fill="#2f9e44" />
      <circle cx={x} cy={y} r="15" fill="none" stroke="#b2f2bb" strokeWidth="4" opacity="0.8" />
      <text x={W / 2} y={H - 8} textAnchor="middle" className="eye-cap">
        {square ? '□ 사각형 모서리 따라가기' : '∞ 무한대 따라가기'}
      </text>
    </svg>
  )
}

function StretchModal({ onClose }) {
  const [elapsed, setElapsed] = useState(0) // 전체 경과(초)
  const [paused, setPaused] = useState(false)
  const [done, setDone] = useState(false)
  const last = useRef(performance.now())
  useEffect(() => {
    if (done) return
    let raf
    const loop = (now) => {
      const dt = (now - last.current) / 1000
      last.current = now
      if (!paused) setElapsed((e) => Math.min(TOTAL, e + dt))
      raf = requestAnimationFrame(loop)
    }
    last.current = performance.now()
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [paused, done])
  useEffect(() => {
    if (elapsed >= TOTAL && !done) {
      setDone(true)
      const st = useStore.getState()
      st.refresh()
      playChime()
      sysMsg(`🧘 ${st.me.name} ${st.me.title}님이 1분 스트레칭을 완료했어요! 피로도 -20% ✨`)
    }
  }, [elapsed, done])
  let idx = 0
  let acc = 0
  while (idx < STEPS.length - 1 && elapsed >= acc + STEPS[idx].sec) acc += STEPS[idx++].sec
  const step = STEPS[idx]
  const inStep = elapsed - acc
  const left = Math.max(0, Math.ceil(step.sec - inStep))
  const frac = Math.min(1, inStep / step.sec)
  const skip = () => setElapsed(Math.min(TOTAL, acc + step.sec))
  const restart = () => {
    setElapsed(0)
    setDone(false)
    setPaused(false)
  }
  const R = 34
  const C = 2 * Math.PI * R
  return (
    <Sheet onClose={onClose} wide className="stretch-sheet">
      <h2>🧘 1분 오피스 스트레칭 & 눈 휴식</h2>
      <div className="st-steps">
        {STEPS.map((s, i) => (
          <div key={i} className={'st-step' + (done || i < idx ? ' done' : i === idx ? ' now' : '')}>
            <span>{done || i < idx ? '✓' : i + 1}</span>
            {s.icon} {s.title} <small>{s.sec}초</small>
          </div>
        ))}
      </div>
      <div className="st-total">
        <div style={{ width: `${(elapsed / TOTAL) * 100}%` }} />
      </div>
      {done ? (
        <div className="st-done">
          <div className="st-big">✨</div>
          <b>스트레칭 완료! 피로도 -20% 감소!</b>
          <p>개운해진 몸으로 남은 오후도 힘내요 💚</p>
          <div className="sheet-foot center">
            <button className="ghost" onClick={restart}>
              🔄 한 번 더
            </button>
            <button className="go small" onClick={onClose}>
              완료
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="st-body">
            <div className="st-visual">
              {step.anim === 'eyes' ? (
                <EyeTrack elapsed={inStep} />
              ) : (
                <div className={'st-figure ' + step.anim + (paused ? ' paused' : '')}>
                  <span>{step.icon}</span>
                </div>
              )}
            </div>
            <div className="st-info">
              <div className="st-label">
                {idx + 1}단계 · {step.sec}초
              </div>
              <h3>
                {step.icon} {step.title}
              </h3>
              <p>{step.text}</p>
              {step.anim === 'neck' && <div className="st-sub">{inStep < 7.5 ? '⬅️ 왼쪽으로 지그시…' : '➡️ 오른쪽으로 지그시…'}</div>}
              {step.anim === 'reach' && <div className="st-sub">{Math.floor(inStep) % 4 < 2 ? '⬆️ 쭉~ 뻗고' : '😮‍💨 숨을 내쉬며 유지'}</div>}
            </div>
            <svg className="st-ring" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r={R} className="bg" />
              <circle cx="40" cy="40" r={R} className="fg" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
              <text x="40" y="46" textAnchor="middle">
                {left}
              </text>
            </svg>
          </div>
          <div className="sheet-foot center">
            <button className="ghost" onClick={() => setPaused(!paused)}>
              {paused ? '▶ 계속하기' : '⏸ 일시정지'}
            </button>
            <button className="ghost" onClick={skip}>
              ⏭ 다음 단계
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}

/* ───────────────────── 🏛️ 오늘의 건축 이야기 ───────────────────── */
function StoriesModal({ onClose }) {
  const shared = useStore((s) => s.archiStories)
  const me = useStore((s) => s.me)
  const today = todayStoryIndex()
  const [i, setI] = useState(today)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const story = STORIES[i]
  const uidMe = myUid()
  const submit = async (e) => {
    e.preventDefault()
    if (!text.trim() || busy) return
    if (url.trim() && !/^https?:\/\//.test(url.trim())) return sysMsg('ℹ️ 링크는 http:// 또는 https:// 로 시작해야 해요.')
    setBusy(true)
    try {
      await addStory({ title, text, url })
      sysMsg(`🏛️ ${me.name} ${me.title}님이 건축 이야기를 공유했어요${title.trim() ? `: '${title.trim()}'` : '.'}`)
      setTitle('')
      setText('')
      setUrl('')
    } catch (e2) {
      console.warn(e2)
      sysMsg('⚠️ 이야기를 저장하지 못했어요. (Firebase 보안 규칙을 확인해 주세요)')
    }
    setBusy(false)
  }
  return (
    <Sheet onClose={onClose} wide className="story-sheet">
      <h2>🏛️ 오늘의 건축 이야기</h2>
      <p className="sub">매일 하나씩 추천되는 건축가의 말과 건축 상식 · 커피 한 잔과 함께 ☕</p>
      <div className="story-card">
        <div className="sc-top">
          <span className="sc-tag">{story.tag}</span>
          {i === today && <span className="sc-today">오늘의 추천</span>}
          <span className="sc-n">
            {i + 1} / {STORIES.length}
          </span>
        </div>
        <div className="sc-who">{story.who}</div>
        <blockquote>{story.quote}</blockquote>
        <p>{story.body}</p>
        <div className="sc-nav">
          <button className="ghost" onClick={() => setI((i + STORIES.length - 1) % STORIES.length)}>
            ◀ 이전
          </button>
          {i !== today && (
            <button className="ghost" onClick={() => setI(today)}>
              오늘의 이야기
            </button>
          )}
          <button className="ghost" onClick={() => setI((i + 1) % STORIES.length)}>
            다음 ▶
          </button>
        </div>
      </div>

      <div className="shared-head">
        <b>📚 직원들이 공유한 건축 이야기</b>
        <span>{shared.length}개</span>
      </div>
      <div className="shared-list">
        {shared.length === 0 && <div className="room-empty">아직 공유된 이야기가 없어요. 첫 이야기를 올려 보세요!</div>}
        {shared.map((x) => (
          <div key={x.id} className="shared-item">
            {x.title && <b>{x.title}</b>}
            <p>{x.text}</p>
            {x.url && (
              <a href={x.url} target="_blank" rel="noopener noreferrer">
                🔗 {x.url.replace(/^https?:\/\//, '').slice(0, 48)}
                {x.url.length > 56 ? '…' : ''}
              </a>
            )}
            <div className="si-meta">
              {x.name} {x.rank} · {fullDate(x.at)}
              {x.authorId === uidMe && (
                <button
                  onClick={() =>
                    askConfirm({ title: '이 이야기를 삭제할까요?', okText: '삭제', danger: true, onOk: () => removeStory(x) })
                  }
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <form className="story-form" onSubmit={submit}>
        <div className="sf-title">+ 나도 건축 이야기/기사 공유하기</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="제목 (선택) 예: 루이스 칸의 빛과 침묵" />
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="함께 보고 싶은 건축 이야기, 명언, 기사 요약을 적어 주세요 (300자)" />
        <div className="sf-row">
          <input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={300} placeholder="기사·참고 링크 (선택) https://…" />
          <button className="add-btn" disabled={!text.trim() || busy}>
            {busy ? '올리는 중…' : '공유하기'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}

/* ───────────────────── 조명 / 음악 컨트롤 ───────────────────── */
const ACC_LABEL = { null: '없음', santa: '🎅 산타 모자', rudolph: '🦌 루돌프 머리띠' }
function AccessoryButton() {
  const acc = useStore((s) => s.accessory)
  return (
    <button className={'tool acc-btn' + (acc ? ' on' : '')} onClick={() => useStore.getState().cycleAccessory()} title="누를 때마다 산타 모자 → 루돌프 머리띠 → 없음">
      🎅 산타/루돌프 <small>{ACC_LABEL[acc]}</small>
    </button>
  )
}

/* ───────────────────── 🚗 외근 행선지 · 복귀 시간 ───────────────────── */
function OutingForm() {
  const outing = useStore((s) => s.outing)
  const me = useStore((s) => s.me)
  const [dest, setDest] = useState(outing?.dest || '')
  const [until, setUntil] = useState(outing?.until || '')
  const save = (e) => {
    e.preventDefault()
    const o = { dest: dest.trim().slice(0, 20), until: /^\d{2}:\d{2}$/.test(until) ? until : '' }
    if (!o.dest) return
    useStore.getState().set({ outing: o })
    try {
      localStorage.setItem('archi-office-3d-outing', JSON.stringify(o))
    } catch {}
    sysMsg(`${outingText(o)} — ${me.name} ${me.title}님 외근 중`)
  }
  return (
    <form className="outing-form" onSubmit={save}>
      <div className="mp-title">🚗 행선지 · 복귀 예정</div>
      <div className="of-row">
        <input value={dest} onChange={(e) => setDest(e.target.value)} maxLength={20} placeholder="예: 과천시청" autoFocus />
        <input type="time" value={until} onChange={(e) => setUntil(e.target.value)} />
      </div>
      <button className="of-save" disabled={!dest.trim()}>
        {outing && outing.dest === dest.trim() && (outing.until || '') === until ? '✓ 표시 중' : '머리 위에 표시하기'}
      </button>
    </form>
  )
}

/* ───────────────────── 👥 접속자 목록 ───────────────────── */
function PeopleModal({ onClose }) {
  const me = useStore((s) => s.me)
  const remotes = useStore((s) => s.remotes)
  const mood = useStore((s) => s.mood)
  const status = useStore((s) => s.status)
  const outing = useStore((s) => s.outing)
  const vacations = useStore((s) => s.vacations)
  const zoneOf = (r) => (r.x != null ? zoneAtPos(r.x, r.z) : '')
  const people = [
    { key: 'me', name: me.name, title: me.title, shirt: me.shirt, mood: mood.e, st: `${status.e} ${status.l}`, outing: status.e === '🚗' ? outing : null, zone: useStore.getState().zone, mine: true },
    ...Object.values(remotes)
      .filter((r) => r.name)
      .map((r) => ({ key: r.id, name: r.name, title: r.title, shirt: r.shirt, mood: r.mood, st: r.status ? `${r.status} ${STATUS_NAME[r.status] || ''}` : '', outing: r.outing, zone: zoneOf(r) })),
  ]
  const away = Object.keys(vacations).filter((n) => !people.some((p) => p.name === n))
  return (
    <Sheet onClose={onClose}>
      <h2>👥 지금 접속 중 {people.length}명</h2>
      <div className="people-list">
        {people.map((p) => (
          <div key={p.key} className={'pl-item' + (p.mine ? ' mine' : '')}>
            <span className="ava" style={{ background: p.shirt }}>
              {p.name[0]}
              <span className="ava-mood">{p.mood}</span>
            </span>
            <div className="pl-body">
              <b>
                {p.name} <small>{p.title}</small> {p.mine && <em>나</em>} {vacations[p.name] && <span className="vac-chip">🏖️ 휴가중</span>}
              </b>
              <span>{p.outing && p.outing.dest ? outingText(p.outing) : `${p.st} · 📍 ${p.zone}`}</span>
            </div>
          </div>
        ))}
      </div>
      {away.length > 0 && (
        <>
          <div className="mp-title" style={{ marginTop: 14 }}>
            🏖️ 휴가중
          </div>
          <div className="chips">
            {away.map((n) => (
              <span key={n} className="chip">
                {seatOf(n) ? `${n} ${seatOf(n).title}` : n}
              </span>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}
const STATUS_NAME = { '💻': '업무중', '☕': '탕비실', '🚗': '외근/현장', '🏃': '칼퇴대기' }

/* ───────────────────── 🏖️ 직원 휴가 관리 (관리부) ───────────────────── */
function VacationModal({ onClose }) {
  const me = useStore((s) => s.me)
  const vacations = useStore((s) => s.vacations)
  const [busy, setBusy] = useState(null)
  if (!isAdminDept(me))
    return (
      <Sheet onClose={onClose} className="lock-sheet">
        <div className="lock-big">🔒</div>
        <h2>{ADMIN_ONLY_MSG}</h2>
      </Sheet>
    )
  const groups = {}
  for (const st of seats) (groups[st.dept] ||= []).push(st)
  const toggle = async (st, on) => {
    setBusy(st.name)
    try {
      await setVacation(st.name, on)
      sysMsg(on ? `🏖️ ${st.name} ${st.title}님 휴가 등록` : `🏢 ${st.name} ${st.title}님 휴가 해제`)
    } catch (e) {
      console.warn(e)
      sysMsg('⚠️ 저장하지 못했어요. (Firebase 보안 규칙을 확인해 주세요)')
    }
    setBusy(null)
  }
  const count = Object.keys(vacations).length
  return (
    <Sheet onClose={onClose} wide>
      <h2>🏖️ 직원 휴가 관리</h2>
      <p className="sub">체크한 직원은 책상 이름표와 캐릭터 머리 위에 [🏖️ 휴가중] 배지가 표시돼요 · 현재 {count}명 휴가중</p>
      {Object.entries(groups).map(([dept, list]) => (
        <div key={dept} className="vac-group">
          <div className="mp-title">{dept}</div>
          <div className="vac-grid">
            {list.map((st) => {
              const on = !!vacations[st.name]
              return (
                <label key={st.name} className={'person' + (on ? ' on vac' : '')}>
                  <input type="checkbox" checked={on} disabled={busy === st.name} onChange={(e) => toggle(st, e.target.checked)} />
                  <span className="pn">
                    {st.name} <small>{st.title}</small>
                  </span>
                  {on && <span className="vac-chip">🏖️ 휴가중</span>}
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </Sheet>
  )
}

/* ───────────────────── 📌 노션 링크 수정 (관리부) ───────────────────── */
function NotionEditModal({ onClose }) {
  const me = useStore((s) => s.me)
  const cur = useStore((s) => s.notionUrl)
  const [url, setUrl] = useState(cur || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (!isAdminDept(me))
    return (
      <Sheet onClose={onClose} className="lock-sheet">
        <div className="lock-big">🔒</div>
        <h2>{ADMIN_ONLY_MSG}</h2>
      </Sheet>
    )
  const save = async (e) => {
    e.preventDefault()
    const u = url.trim()
    if (!/^https:\/\/[^\s]+$/.test(u)) return setErr('https:// 로 시작하는 노션 링크를 넣어 주세요.')
    setBusy(true)
    try {
      await saveNotionUrl(u)
      sysMsg(`📌 ${me.name} ${me.title}님이 사내 공지·서식함 노션 링크를 바꿨어요.`)
      onClose()
    } catch (e2) {
      console.warn(e2)
      setErr('저장하지 못했어요. (Firebase 보안 규칙을 확인해 주세요)')
      setBusy(false)
    }
  }
  return (
    <Sheet onClose={onClose}>
      <h2>⚙️ 노션 링크 수정</h2>
      <p className="sub">관리부 수납장 위 [📌 사내 공지·서식함]이 열 노션 페이지 주소예요. 노션에서 [공유] → [웹에 게시] 또는 링크 복사로 받은 주소를 넣어 주세요.</p>
      <form className="model-form" onSubmit={save}>
        <input value={url} onChange={(e) => (setUrl(e.target.value), setErr(''))} placeholder="https://www.notion.so/..." autoFocus />
        {err && <div className="err">{err}</div>}
        <div className="sheet-foot">
          {cur && (
            <a className="ghost" href={cur} target="_blank" rel="noopener noreferrer">
              현재 링크 열어보기 ↗
            </a>
          )}
          <button className="go small" disabled={busy || !url.trim()}>
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}

/* ───────────────────── 🌤️ 과천시 실시간 날씨 ───────────────────── */
const PREVIEW_LABEL = { snow: '❄️ 눈', rain: '🌧️ 비', none: '☀️ 맑음' }
function WeatherPill() {
  const w = useStore((s) => s.weather)
  const err = useStore((s) => s.weatherError)
  const ov = useStore((s) => s.weatherOverride)
  return (
    <button className="weather-pill" onClick={cycleWeatherPreview} title={'Open-Meteo 실시간 날씨 · 10분마다 갱신\n누르면 창밖 효과 미리보기: 실시간 → 눈 → 비 → 맑음'}>
      📍 과천시{' '}
      {w ? (
        <>
          <span className="wp-temp">{w.temp}°C</span> {w.icon} <small>{w.label}</small>
        </>
      ) : (
        <small>{err ? '날씨 불러오기 실패' : '날씨 불러오는 중…'}</small>
      )}
      {ov && <em>미리보기 {PREVIEW_LABEL[ov]}</em>}
    </button>
  )
}

/* ───────────────────── 🦘 점프 버튼 (모바일/마우스) ───────────────────── */
export function JumpButton() {
  const joined = useStore((s) => s.joined)
  if (!joined) return null
  return (
    <button
      className="jump-btn"
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault()
        window.dispatchEvent(new Event('jump-request'))
      }}
      title="Space 키로도 점프할 수 있어요"
    >
      <span>⬆️</span>점프
    </button>
  )
}

/* ───────────────────── 🚗 니로 운행일지 팝업 ───────────────────── */
function NiroModal({ onClose }) {
  const me = useStore((s) => s.me)
  const seatName = seats.find((x) => x.name === me.name) ? `${me.name} ${me.title}` : ''
  return (
    <Sheet onClose={onClose} wide className="niro-sheet">
      <h2>🚗 니로(Niro) 법인차량 운행일지</h2>
      <p className="sub">
        모바일에서는 주소 뒤에 <code>?niro=1</code> 을 붙이면 이 화면만 바로 열려요
      </p>
      <NiroLog
        defaultDriver={seatName}
        onSaved={(r) => sysMsg(`🚗 ${r.driver}님의 니로 운행일지가 저장됐어요 (${r.dest} · ${r.distance}km)`)}
      />
    </Sheet>
  )
}

function AmbienceControls() {
  const lightMode = useStore((s) => s.lightMode)
  const timeMode = useStore((s) => s.timeMode)
  const musicOn = useStore((s) => s.musicOn)
  const [kst, setKst] = useState(() => kstNow())
  useEffect(() => {
    const t = setInterval(() => setKst(kstNow()), 15000)
    return () => clearInterval(t)
  }, [])
  const toggleMusic = async () => {
    if (musicOn) {
      stopMusic()
      useStore.getState().set({ musicOn: false })
    } else {
      try {
        await startMusic()
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
      <WeatherPill />
      <button className={'tool music' + (musicOn ? ' on' : '')} onClick={toggleMusic}>
        {musicOn ? '🎵 배경음악 ON' : '🔇 배경음악 OFF'}
        {musicOn && (
          <span className="eq">
            <i />
            <i />
            <i />
          </span>
        )}
      </button>
      <div className="tool-row">
        <button className="tool stretch-btn" onClick={() => useStore.getState().set({ modal: 'stretch' })}>
          🧘 1분 스트레칭
        </button>
        <AccessoryButton />
      </div>
      <div className="bell-tests">
        <button onClick={() => fireAlert('pre')}>🔔 11:25 테스트</button>
        <button onClick={() => fireAlert('lunch')}>🔔 11:30 테스트</button>
        <button onClick={() => fireAlert('stretch')}>🔔 15:00 테스트</button>
      </div>
      <div className="amb-box">
        <div className="amb-now">
          KST {hh}:{mm} · {MODE_LABEL[timeMode]} 모드{lightMode !== 'auto' && <em> (미리보기)</em>}
          {musicOn && <span> · 🎄 캐롤 오르골</span>}
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

/* ───────────────────── ☕ 동료 커피 알림 배너 ───────────────────── */
export function CoffeeToasts() {
  const toasts = useStore((s) => s.coffeeToasts)
  const joined = useStore((s) => s.joined)
  if (!joined || !toasts.length) return null
  const go = (key) => {
    useStore.getState().set({ coffeeToasts: useStore.getState().coffeeToasts.filter((t) => t.key !== key) })
    window.dispatchEvent(new CustomEvent('floor-click', { detail: { x: COFFEE.x, z: COFFEE.z } }))
  }
  return (
    <div className="coffee-toasts">
      {toasts.map((t) => (
        <div key={t.key} className="coffee-toast">
          <span className="ct-cup">☕</span>
          <span className="ct-text">
            <b>
              {t.name} {t.title}
            </b>
            님이 커피를 내렸어요! 탕비실에서 한잔 하실래요?
          </span>
          <button onClick={() => go(t.key)}>탕비실로 가기</button>
        </div>
      ))}
    </div>
  )
}

/* ───────────────────── 🎄 트리 소원 카드 ───────────────────── */
const WISH_COLORS = ['#fff3bf', '#ffe3e3', '#d3f9d8', '#d0ebff', '#f3d9fa', '#ffe8cc']
function WishesModal({ onClose }) {
  const wishes = useStore((s) => s.treeWishes)
  const me = useStore((s) => s.me)
  const [text, setText] = useState('')
  const [color, setColor] = useState(WISH_COLORS[0])
  const [busy, setBusy] = useState(false)
  const uidMe = myUid()
  const submit = async (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    try {
      await addWish({ text: t, color })
      sysMsg(`🎄 ${me.name} ${me.title}님이 트리에 소원 카드를 달았어요!`)
      setText('')
    } catch (e2) {
      console.warn(e2)
      sysMsg('⚠️ 소원 카드를 저장하지 못했어요. (Firebase 보안 규칙을 확인해 주세요)')
    }
    setBusy(false)
  }
  return (
    <Sheet onClose={onClose} wide className="wish-sheet">
      <h2>🎄 트리 소원 카드</h2>
      <p className="sub">올해의 회고나 새해 소원을 한 줄로 적어 트리에 매달아 주세요 · {wishes.length}장 달림</p>
      <form className="wish-form" onSubmit={submit}>
        <div className="wish-card-preview" style={{ background: color }}>
          <span className="wc-hole" />
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={100} placeholder="예: 내년엔 모든 공모전 당선! 🏆" />
          <span className="wc-count">{text.length}/100</span>
        </div>
        <div className="wish-row">
          <div className="swatches">
            {WISH_COLORS.map((c) => (
              <button type="button" key={c} className={color === c ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
          <button className="go small tree-go" disabled={!text.trim() || busy}>
            {busy ? '매다는 중…' : '🎄 트리에 매달기'}
          </button>
        </div>
      </form>
      <div className="wish-wall">
        {wishes.length === 0 && <div className="room-empty">아직 매달린 카드가 없어요. 첫 소원을 달아 주세요 ✨</div>}
        {wishes.map((w, i) => (
          <div key={w.id} className="wish-card" style={{ background: w.color, transform: `rotate(${((i % 5) - 2) * 1.2}deg)` }}>
            <span className="wc-hole" />
            <p>{w.text}</p>
            <div className="wc-by">
              — {w.name} {w.rank}
              {w.authorId === uidMe && (
                <button onClick={() => askConfirm({ title: '내 소원 카드를 뗄까요?', okText: '떼기', danger: true, onOk: () => removeWish(w) })}>떼기</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  )
}

/* ───────────────────── 📅 마감 D-Day 보드 ───────────────────── */
function DdayModal({ onClose }) {
  const ddays = useStore((s) => s.ddays)
  const me = useStore((s) => s.me)
  const [editing, setEditing] = useState(null) // null | 'new' | 프로젝트
  const [name, setName] = useState('')
  const [date, setDate] = useState(kstToday())
  const [busy, setBusy] = useState(false)
  const admin = isAdminDept(me) // 📅 일정 추가·수정·삭제는 관리부만
  const startEdit = (p) => {
    if (!admin) return sysMsg(`🔒 ${ADMIN_ONLY_MSG}`)
    setEditing(p || 'new')
    setName(p ? p.name : '')
    setDate(p ? p.date : kstToday())
  }
  const save = async (e) => {
    e.preventDefault()
    if (!name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date) || busy) return
    setBusy(true)
    try {
      await saveDday({ id: editing && editing !== 'new' ? editing.id : null, name, date })
      const d = ddayLabel(date)
      sysMsg(`📅 ${me.name} ${me.title}님이 마감을 ${editing === 'new' ? '등록' : '수정'}했어요: ${name.trim()} (${d.text})`)
      setEditing(null)
    } catch (e2) {
      console.warn(e2)
      sysMsg('⚠️ 마감을 저장하지 못했어요. (Firebase 보안 규칙을 확인해 주세요)')
    }
    setBusy(false)
  }
  const sorted = [...ddays].sort((a, b) => {
    const da = ddayLabel(a.date).diff
    const db = ddayLabel(b.date).diff
    return (da < 0 ? 1e6 - da : da) - (db < 0 ? 1e6 - db : db)
  })
  return (
    <Sheet onClose={onClose} wide className="dday-sheet">
      <h2>📅 프로젝트 마감 D-Day 보드</h2>
      <p className="sub">오늘({kstToday().replace(/-/g, '.')}, KST) 기준으로 자동 계산돼 관리부 전광판에 표시돼요 · 다가오는 순서로 3개</p>
      <div className="dday-list">
        {sorted.length === 0 && <div className="room-empty">등록된 마감이 없어요.</div>}
        {sorted.map((p) => {
          const d = ddayLabel(p.date)
          const tone = d.diff < 0 ? 'past' : d.diff <= 3 ? 'hot' : d.diff <= 7 ? 'warm' : 'cool'
          return (
            <div key={p.id} className={'dday-item ' + tone}>
              <span className="dd-badge">{d.text}</span>
              <div className="dd-body">
                <b>{p.name}</b>
                <span>
                  {p.date.replace(/-/g, '.')} · {p.by} 등록
                </span>
              </div>
              {admin && (
                <>
                  <button className="ghost" onClick={() => startEdit(p)}>
                    ✏️ 수정
                  </button>
                  <button
                    className="ghost danger"
                    onClick={() => askConfirm({ title: `'${p.name}' 마감을 삭제할까요?`, okText: '삭제', danger: true, onOk: () => removeDday(p) })}
                  >
                    🗑️
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>
      {editing ? (
        <form className="dday-form" onSubmit={save}>
          <div className="sf-title">{editing === 'new' ? '+ 새 마감 등록' : '✏️ 마감 수정'}</div>
          <div className="sf-row">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="프로젝트명 (예: OO현상설계 제출)" autoFocus />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="date-in" />
          </div>
          {name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date) && <div className="dd-preview">전광판 표시: <b>{name.trim()}</b> · <b>{ddayLabel(date).text}</b></div>}
          <div className="sheet-foot">
            <button type="button" className="ghost" onClick={() => setEditing(null)}>
              취소
            </button>
            <button className="go small" disabled={!name.trim() || busy}>
              {busy ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      ) : admin ? (
        <div className="sheet-foot">
          <button className="go small" onClick={() => startEdit(null)}>
            + 마감 등록
          </button>
        </div>
      ) : (
        <div className="admin-only">🔒 {ADMIN_ONLY_MSG}</div>
      )}
    </Sheet>
  )
}

/* ───────────────────── 📐 진행 중인 프로젝트 (모형 전시대) ───────────────────── */
function ModelsModal({ onClose }) {
  const models = useStore((s) => s.archiModels)
  const me = useStore((s) => s.me)
  const [editing, setEditing] = useState(null) // null | 'new' | 프로젝트
  const [f, setF] = useState({ title: '', desc: '', url: '' })
  const [busy, setBusy] = useState(false)
  const startEdit = (m) => {
    setEditing(m || 'new')
    setF(m ? { title: m.title, desc: m.desc, url: m.url } : { title: '', desc: '', url: '' })
  }
  const save = async (e) => {
    e.preventDefault()
    if (!f.title.trim() || busy) return
    if (f.url.trim() && !/^https?:\/\//.test(f.url.trim())) return sysMsg('ℹ️ 링크는 http:// 또는 https:// 로 시작해야 해요.')
    setBusy(true)
    try {
      const isNew = editing === 'new'
      await saveModel({ id: isNew ? null : editing.id, at: isNew ? null : editing.at, ...f })
      sysMsg(`📐 ${me.name} ${me.title}님이 프로젝트를 ${isNew ? '등록' : '수정'}했어요: ${f.title.trim()}`)
      setEditing(null)
    } catch (e2) {
      console.warn(e2)
      sysMsg('⚠️ 프로젝트를 저장하지 못했어요. (Firebase 보안 규칙을 확인해 주세요)')
    }
    setBusy(false)
  }
  return (
    <Sheet onClose={onClose} wide className="models-sheet">
      <h2>📐 진행 중인 프로젝트 안내</h2>
      <p className="sub">회의 테이블 위 모형 전시대 · 사무실에서 진행 중인 프로젝트를 누구나 등록하고 고칠 수 있어요</p>
      {editing ? (
        <form className="model-form" onSubmit={save}>
          <div className="sf-title">{editing === 'new' ? '+ 새 프로젝트 등록' : '✏️ 프로젝트 수정'}</div>
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={40} placeholder="프로젝트 제목 (예: 안양 동편 근린생활시설 신축)" autoFocus />
          <textarea value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} maxLength={300} placeholder="개요 (규모·용도·진행 단계·담당 등, 300자)" />
          <input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} maxLength={300} placeholder="참고 링크 (선택) https://…" />
          <div className="sheet-foot">
            <button type="button" className="ghost" onClick={() => setEditing(null)}>
              취소
            </button>
            <button className="go small" disabled={!f.title.trim() || busy}>
              {busy ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="model-grid">
            {models.length === 0 && <div className="room-empty">아직 등록된 프로젝트가 없어요. 첫 프로젝트를 소개해 주세요!</div>}
            {models.map((m, i) => (
              <div key={m.id} className="model-card">
                <div className="mc-icon">{['🏢', '🏡', '🏛️', '🏫', '🏬'][i % 5]}</div>
                <b>{m.title}</b>
                {m.desc && <p>{m.desc}</p>}
                {m.url && (
                  <a href={m.url} target="_blank" rel="noopener noreferrer">
                    🔗 참고 링크 열기
                  </a>
                )}
                <div className="mc-meta">
                  {m.by} · {fullDate(m.updatedAt || m.at)} 수정
                </div>
                <div className="mc-actions">
                  <button className="ghost" onClick={() => startEdit(m)}>
                    ✏️ 수정
                  </button>
                  <button
                    className="ghost danger"
                    onClick={() => askConfirm({ title: `'${m.title}'을(를) 삭제할까요?`, okText: '삭제', danger: true, onOk: () => removeModel(m) })}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="sheet-foot">
            <button className="go small" onClick={() => startEdit(null)}>
              + 프로젝트 등록
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}

export { live }
