// 좌측 하단 채팅창: [📢 전체 채팅] + [👥 그룹 채팅(비밀방)]
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from './store'
import { myUid } from './db'
import { getSessionKey } from './net'
import { sendGlobal, deleteGlobal, clearGlobal, createRoom, sendRoom, clearRoom, leaveRoom, markRead, unreadCount } from './chat'
import { askConfirm } from './UI'

export function Chat() {
  const joined = useStore((s) => s.joined)
  const modal = useStore((s) => s.modal)
  const rooms = useStore((s) => s.rooms)
  useStore((s) => s.readTick) // 읽음 처리 시 배지 갱신
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState('global')
  const [roomId, setRoomId] = useState(null)
  const [creating, setCreating] = useState(false)

  const room = roomId ? rooms[roomId] : null
  useEffect(() => {
    if (roomId && !rooms[roomId]) setRoomId(null) // 방이 사라짐 / 나감
  }, [rooms, roomId])

  const groupUnread = Object.values(rooms).reduce((n, r) => n + (open && tab === 'group' && r.id === roomId ? 0 : unreadCount(r)), 0)

  if (!joined) return null
  return (
    <div className={'chat' + (open ? '' : ' closed') + (modal ? ' dim' : '')}>
      <div className="chat-head">
        <div className="chat-tabs">
          <button className={tab === 'global' ? 'on' : ''} onClick={() => (setTab('global'), setOpen(true))}>
            📢 전체 채팅
          </button>
          <button className={tab === 'group' ? 'on' : ''} onClick={() => (setTab('group'), setOpen(true))}>
            👥 그룹 채팅
            {groupUnread > 0 && <span className="red-dot">{groupUnread > 99 ? '99+' : groupUnread}</span>}
          </button>
        </div>
        <div className="chat-head-right">
          {open && tab === 'global' && (
            <button
              className="mini-btn"
              title="모든 사람의 전체 채팅을 비웁니다"
              onClick={() =>
                askConfirm({
                  title: '🗑️ 전체 대화를 비울까요?',
                  body: '접속 중인 모든 직원의 전체 채팅창이 함께 비워지고, 되돌릴 수 없어요.',
                  okText: '대화 비우기',
                  danger: true,
                  onOk: async () => {
                    await clearGlobal()
                    useStore.getState().set({ messages: [] })
                  },
                })
              }
            >
              🗑️ 대화 비우기
            </button>
          )}
          <button className="mini-btn ghosty" onClick={() => setOpen(!open)} title={open ? '접기' : '펼치기'}>
            {open ? '▾' : '▴'}
          </button>
        </div>
      </div>
      {open && tab === 'global' && <GlobalView />}
      {open && tab === 'group' && !room && <RoomList rooms={rooms} onOpen={setRoomId} onCreate={() => setCreating(true)} />}
      {open && tab === 'group' && room && <RoomView room={room} onBack={() => setRoomId(null)} />}
      {creating && (
        <NewRoomModal
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            setTab('group')
            setRoomId(id)
          }}
        />
      )}
    </div>
  )
}

/* ───────── 전체 채팅 ───────── */
function GlobalView() {
  const globalChat = useStore((s) => s.globalChat)
  const local = useStore((s) => s.messages)
  const me = useStore((s) => s.me)
  const uidMe = myUid()
  const list = useMemo(
    () => [...globalChat.map((m) => ({ ...m, mine: m.uid === uidMe })), ...local].sort((a, b) => (a.at || 0) - (b.at || 0)),
    [globalChat, local, uidMe]
  )
  const listRef = useRef()
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [list.length])
  const send = async (text) => {
    useStore.getState().setBubble(text)
    try {
      await sendGlobal(text, getSessionKey())
    } catch (e) {
      console.warn(e)
      useStore.getState().addMessage({ id: 'err' + Date.now(), system: true, text: '⚠️ 메시지 전송에 실패했어요. (Firebase 보안 규칙을 확인해 주세요)', at: Date.now() })
    }
  }
  return (
    <>
      <div className="chat-list" ref={listRef}>
        {list.length === 0 && <div className="sys">아직 대화가 없어요. 첫 인사를 남겨 보세요 👋</div>}
        {list.map((m) => (
          <MsgRow key={m.id} m={m} me={me} onDelete={m.mine && !m.system ? () => deleteGlobal(m) : null} />
        ))}
      </div>
      <ChatInput onSend={send} placeholder="전체에게 메시지 (Enter 전송)" max={80} />
    </>
  )
}

function MsgRow({ m, onDelete }) {
  if (m.system || m.uid === 'system')
    return <div className={'sys' + (m.spin ? ' spin' : '')}>{m.text}</div>
  if (m.mine)
    return (
      <div className="msg mine">
        {onDelete && (
          <button className="msg-del" title="내 메시지 삭제" onClick={onDelete}>
            ×
          </button>
        )}
        <span className="time">{m.time}</span>
        <div className="txt">{m.text}</div>
      </div>
    )
  return (
    <div className="msg">
      <div className="ava" style={{ background: m.shirt }}>
        {(m.name || '?')[0]}
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
}

function ChatInput({ onSend, placeholder, max }) {
  const [text, setText] = useState('')
  const inputRef = useRef()
  useEffect(() => {
    // Enter: 채팅 입력창으로 바로 이동
    const k = (e) => {
      if (e.key !== 'Enter' || useStore.getState().modal || useStore.getState().confirm) return
      const tag = document.activeElement?.tagName
      if (document.activeElement === inputRef.current || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'SELECT') return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  const submit = (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    onSend(t)
    setText('')
  }
  return (
    <form className="chat-input" onSubmit={submit}>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
        placeholder={placeholder}
        maxLength={max}
      />
      <button type="submit" disabled={!text.trim()}>
        전송
      </button>
    </form>
  )
}

/* ───────── 그룹 채팅: 방 목록 ───────── */
function RoomList({ rooms, onOpen, onCreate }) {
  const list = Object.values(rooms).sort((a, b) => {
    const la = a.messages.length ? a.messages[a.messages.length - 1].at : a.createdAt
    const lb = b.messages.length ? b.messages[b.messages.length - 1].at : b.createdAt
    return lb - la
  })
  return (
    <div className="room-list">
      <button className="new-room" onClick={onCreate}>
        + 새 그룹방 만들기
      </button>
      {list.length === 0 && (
        <div className="room-empty">
          🔒 초대받은 그룹방이 없어요.
          <br />
          방을 만들면 초대한 멤버에게만 보여요.
        </div>
      )}
      {list.map((r) => {
        const last = r.messages[r.messages.length - 1]
        const n = unreadCount(r)
        return (
          <button key={r.id} className="room-item" onClick={() => onOpen(r.id)}>
            <div className="ri-ico">🔒</div>
            <div className="ri-body">
              <div className="ri-top">
                <b>{r.name}</b>
                <span>{r.members.length}명</span>
              </div>
              <div className="ri-last">{last ? (last.uid === 'system' ? last.text : `${last.name}: ${last.text}`) : '대화를 시작해 보세요'}</div>
            </div>
            {n > 0 && <span className="red-dot big">{n > 99 ? '99+' : n}</span>}
          </button>
        )
      })}
    </div>
  )
}

/* ───────── 그룹 채팅: 방 안 ───────── */
function RoomView({ room, onBack }) {
  const me = useStore((s) => s.me)
  const uidMe = myUid()
  const listRef = useRef()
  const msgs = room.messages.map((m) => ({ ...m, mine: m.uid === uidMe }))
  useEffect(() => {
    markRead(room.id)
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [room.id, room.messages.length])
  return (
    <>
      <div className="room-head">
        <button className="mini-btn ghosty" onClick={onBack}>
          ←
        </button>
        <div className="rh-info">
          <b>🔒 {room.name}</b>
          <span title={room.members.map((m) => `${m.name} ${m.title}`).join(', ')}>{room.members.map((m) => m.name).join(', ')}</span>
        </div>
        <button
          className="mini-btn"
          onClick={() =>
            askConfirm({
              title: `🧹 '${room.name}' 대화를 비울까요?`,
              body: '이 방 멤버 모두의 대화 기록이 지워져요.',
              okText: '대화 비우기',
              danger: true,
              onOk: () => clearRoom(room.id),
            })
          }
        >
          🧹 비우기
        </button>
        <button
          className="mini-btn danger"
          onClick={() =>
            askConfirm({
              title: `🚪 '${room.name}' 방을 나갈까요?`,
              body: room.members.length <= 1 ? '마지막 멤버라서 방이 삭제돼요.' : '다시 들어오려면 다른 멤버가 새 방에 초대해야 해요.',
              okText: '방 나가기',
              danger: true,
              onOk: async () => {
                await leaveRoom(room)
                onBack()
              },
            })
          }
        >
          🚪 나가기
        </button>
      </div>
      <div className="chat-list room" ref={listRef}>
        {msgs.length === 0 && <div className="sys">대화가 비어 있어요 🤫</div>}
        {msgs.map((m) => (
          <MsgRow key={m.id} m={m} me={me} />
        ))}
      </div>
      <ChatInput onSend={(t) => sendRoom(room.id, t)} placeholder={`🔒 ${room.name}에 메시지`} max={200} />
    </>
  )
}

/* ───────── 새 그룹방 만들기 ───────── */
function NewRoomModal({ onClose, onCreated }) {
  const remotes = useStore((s) => s.remotes)
  const me = useStore((s) => s.me)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const uidMe = myUid()
  // 현재 접속 중인 직원 (같은 사람이 탭을 여러 개 열어도 한 번만)
  const people = useMemo(() => {
    const m = new Map()
    for (const r of Object.values(remotes)) if (r.uid && r.name && r.uid !== uidMe && !m.has(r.uid)) m.set(r.uid, { uid: r.uid, name: r.name, title: r.title, shirt: r.shirt, mood: r.mood })
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [remotes, uidMe])
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    useStore.getState().set({ modal: 'newRoom' })
    return () => {
      window.removeEventListener('keydown', k)
      if (useStore.getState().modal === 'newRoom') useStore.getState().set({ modal: null })
    }
  }, [])
  const chosen = people.filter((p) => picked[p.uid])
  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return setErr('방 이름을 입력해 주세요.')
    if (!chosen.length) return setErr('초대할 멤버를 1명 이상 선택해 주세요.')
    setBusy(true)
    try {
      const id = await createRoom(name.trim(), chosen)
      onCreated(id)
    } catch (e2) {
      console.warn(e2)
      setErr('방을 만들지 못했어요. (Firebase 보안 규칙을 확인해 주세요)')
      setBusy(false)
    }
  }
  return createPortal(
    <div className="modal-bg soft" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={submit}>
        <button type="button" className="x" onClick={onClose}>
          ✕
        </button>
        <h2>👥 새 그룹방 만들기</h2>
        <p className="sub">초대한 멤버에게만 방이 보이는 비밀방이에요.</p>
        <label className="field">
          <span>방 이름</span>
          <input value={name} onChange={(e) => (setName(e.target.value), setErr(''))} maxLength={20} placeholder="예: 3층 도면 TF, 점심 메이트" autoFocus />
        </label>
        <div className="field" style={{ marginTop: 12 }}>
          <span>
            초대할 멤버 · 현재 접속 중 {people.length}명 {chosen.length > 0 && <em className="pick-count">{chosen.length}명 선택</em>}
          </span>
          <div className="people">
            {people.length === 0 && <div className="room-empty">지금 접속 중인 다른 직원이 없어요.</div>}
            {people.map((p) => (
              <label key={p.uid} className={'person' + (picked[p.uid] ? ' on' : '')}>
                <input type="checkbox" checked={!!picked[p.uid]} onChange={(e) => setPicked({ ...picked, [p.uid]: e.target.checked })} />
                <span className="ava" style={{ background: p.shirt }}>
                  {p.name[0]}
                </span>
                <span className="pn">
                  {p.name} <small>{p.title}</small>
                </span>
                {p.mood && <span>{p.mood}</span>}
              </label>
            ))}
          </div>
        </div>
        <div className="me-line">
          👑 방장: {me.name} {me.title} (자동 포함)
        </div>
        {err && <div className="err">{err}</div>}
        <button className="go" disabled={busy}>
          {busy ? '만드는 중…' : `🔒 방 만들기${chosen.length ? ` (${chosen.length + 1}명)` : ''}`}
        </button>
      </form>
    </div>,
    document.body
  )
}
