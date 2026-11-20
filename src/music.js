// 🎄 크리스마스 캐롤 오르골 BGM — 외부 음원 없이 Web Audio API로 실시간 합성
// 곡: 징글벨(J. Pierpont, 1857) · We Wish You a Merry Christmas(영국 전통 캐롤) — 모두 퍼블릭 도메인 멜로디
// 오르골 음색: 빠르게 감쇠하는 사인파 + 비정수배 배음(금속 빗살 느낌) + 합성 리버브

let ctx = null
let master, dry, wet, verb
let timer = null
let playing = false
let queue = [] // { t(초, 곡 시작 기준), midi, dur, vel, kind }
let songStart = 0
let qi = 0
let songIdx = 0

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)

/* ───────── 악보 ───────── */
// 멜로디: [미디 음, 박자]  (0 = 쉼표)
const C5 = 72, D5 = 74, E5 = 76, F5 = 77, G5 = 79

const JINGLE = {
  name: '징글벨',
  bpm: 112,
  beatsPerBar: 4,
  melody: [
    [E5, 1], [E5, 1], [E5, 2],
    [E5, 1], [E5, 1], [E5, 2],
    [E5, 1], [G5, 1], [C5, 1.5], [D5, 0.5],
    [E5, 4],
    [F5, 1], [F5, 1], [F5, 1.5], [F5, 0.5],
    [F5, 1], [E5, 1], [E5, 1], [E5, 0.5], [E5, 0.5],
    [E5, 1], [D5, 1], [D5, 1], [E5, 1],
    [D5, 2], [G5, 2],
    [E5, 1], [E5, 1], [E5, 2],
    [E5, 1], [E5, 1], [E5, 2],
    [E5, 1], [G5, 1], [C5, 1.5], [D5, 0.5],
    [E5, 4],
    [F5, 1], [F5, 1], [F5, 1.5], [F5, 0.5],
    [F5, 1], [E5, 1], [E5, 1], [E5, 0.5], [E5, 0.5],
    [G5, 1], [G5, 1], [F5, 1], [D5, 1],
    [C5, 4],
  ],
  // 마디별 화음 (근음, 구성음)
  chords: ['C', 'C', 'C', 'C', 'F', 'C', 'D7', 'G', 'C', 'C', 'C', 'C', 'F', 'C', 'G7', 'C'],
}

const WEWISH = {
  name: 'We Wish You a Merry Christmas',
  bpm: 104,
  beatsPerBar: 3,
  pickup: 1, // 못갖춘마디 (첫 박 D)
  melody: [
    [74, 1],
    [79, 1], [79, 0.5], [81, 0.5], [79, 0.5], [78, 0.5],
    [76, 1], [76, 1], [76, 1],
    [81, 1], [81, 0.5], [83, 0.5], [81, 0.5], [79, 0.5],
    [78, 1], [74, 1], [74, 1],
    [83, 1], [83, 0.5], [84, 0.5], [83, 0.5], [81, 0.5],
    [79, 1], [76, 1], [74, 0.5], [74, 0.5],
    [76, 1], [81, 1], [78, 1],
    [79, 3],
  ],
  chords: ['G', 'C', 'D', 'D', 'G', 'C', 'D7', 'G'],
}

const CHORD_NOTES = {
  C: [48, 55, 60, 64],
  F: [53, 57, 60, 65],
  G: [43, 55, 59, 62],
  G7: [43, 53, 59, 62],
  D: [50, 57, 62, 66],
  D7: [50, 57, 60, 66],
}

const SONGS = [JINGLE, WEWISH]

// 곡 → 연주 이벤트 목록
function buildSong(song) {
  const spb = 60 / song.bpm
  const ev = []
  let beat = 0
  for (const [m, d] of song.melody) {
    if (m) ev.push({ t: beat * spb, midi: m, dur: d * spb, vel: 0.9 + Math.random() * 0.1, kind: 'mel' })
    beat += d
  }
  const total = beat
  // 반주: 마디 첫 박 베이스 + 나머지 박에 분산화음 (오르골 느낌)
  const offset = song.pickup || 0
  song.chords.forEach((c, bar) => {
    const notes = CHORD_NOTES[c]
    const b0 = offset + bar * song.beatsPerBar
    ev.push({ t: b0 * spb, midi: notes[0], dur: spb * song.beatsPerBar, vel: 0.55, kind: 'bass' })
    for (let k = 1; k < song.beatsPerBar; k++) {
      const n = notes[1 + ((k - 1) % 3)] + 12
      ev.push({ t: (b0 + k) * spb, midi: n, dur: spb, vel: 0.32, kind: 'acc' })
      if (song.beatsPerBar === 4) ev.push({ t: (b0 + k + 0.5) * spb, midi: notes[1 + (k % 3)] + 12, dur: spb / 2, vel: 0.22, kind: 'acc' })
    }
  })
  ev.sort((a, b) => a.t - b.t)
  return { ev, length: total * spb + spb * 3 } // 곡 사이 3박 쉼
}

/* ───────── 오디오 그래프 ───────── */
function makeImpulse(seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

function build() {
  ctx = new (window.AudioContext || window.webkitAudioContext)()
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.ratio.value = 3
  comp.connect(ctx.destination)
  master = ctx.createGain()
  master.gain.value = 0
  const tone = ctx.createBiquadFilter() // 너무 쨍하지 않게 고음 살짝 정리
  tone.type = 'lowpass'
  tone.frequency.value = 5200
  master.connect(tone)
  tone.connect(comp)
  dry = ctx.createGain()
  dry.gain.value = 0.75
  dry.connect(master)
  verb = ctx.createConvolver()
  verb.buffer = makeImpulse(3.2, 2.6)
  wet = ctx.createGain()
  wet.gain.value = 0.42
  verb.connect(wet)
  wet.connect(master)
}

// 오르골 한 음: 금속 빗살을 튕긴 듯 빠르게 사라지는 소리
function pluck(midi, t, vel, kind) {
  const f = mtof(midi)
  const out = ctx.createGain()
  out.gain.value = kind === 'bass' ? 0.16 : kind === 'acc' ? 0.1 : 0.2
  out.connect(dry)
  out.connect(verb)
  const len = kind === 'bass' ? 2.6 : 1.9
  const partials = [
    [1, 1, len],
    [2.0, 0.22, len * 0.5],
    [3.0, 0.08, len * 0.35],
    [5.43, 0.07, 0.35], // 금속성 비정수배 배음
    [8.9, 0.035, 0.12],
  ]
  for (const [mult, amp, dec] of partials) {
    const freq = f * mult
    if (freq > 16000) continue
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq
    o.detune.value = (Math.random() - 0.5) * 4
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(amp * vel, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec)
    o.connect(g)
    g.connect(out)
    o.start(t)
    o.stop(t + dec + 0.05)
  }
}

function loadSong() {
  const song = SONGS[songIdx % SONGS.length]
  const built = buildSong(song)
  queue = built.ev
  qi = 0
  return built.length
}

let songLen = 0
function tick() {
  const now = ctx.currentTime
  const ahead = now + 0.2
  while (true) {
    if (qi >= queue.length) {
      // 곡이 끝나면 다음 곡으로
      if (songStart + songLen > ahead) break
      songStart += songLen
      songIdx++
      songLen = loadSong()
      continue
    }
    const e = queue[qi]
    const at = songStart + e.t
    if (at > ahead) break
    if (at >= now - 0.05) pluck(e.midi, Math.max(at, now), e.vel, e.kind)
    qi++
  }
}

// 클릭 이벤트 안에서 호출해야 브라우저가 소리를 허용합니다
export async function startMusic() {
  if (!ctx) build()
  if (ctx.state === 'suspended') await ctx.resume()
  if (playing) return
  playing = true
  songIdx = 0
  songLen = loadSong()
  songStart = ctx.currentTime + 0.15
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
  master.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 1.5)
  timer = setInterval(tick, 40)
}

export function stopMusic() {
  if (!ctx || !playing) return
  playing = false
  clearInterval(timer)
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
  master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8)
  setTimeout(() => !playing && ctx.suspend(), 1000)
}

// 지금 연주 중인 곡 이름 (HUD 표시용)
export const currentSongName = () => (playing ? SONGS[songIdx % SONGS.length].name : '')

/* ───────── 알림음 (점심·스트레칭 알림) ───────── */
let chimeCtx = null
export async function playChime() {
  try {
    chimeCtx ||= ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (chimeCtx.state === 'suspended') await chimeCtx.resume()
    const c = chimeCtx
    const out = c.createGain()
    out.gain.value = 0.35
    out.connect(c.destination)
    const t0 = c.currentTime + 0.05
    ;[
      [76, 0],
      [72, 0.22],
      [79, 0.44],
    ].forEach(([m, dt]) => {
      const f = 440 * Math.pow(2, (m - 69) / 12)
      ;[
        [1, 0.5],
        [2.76, 0.12],
        [5.4, 0.05],
      ].forEach(([mult, amp]) => {
        const o = c.createOscillator()
        o.type = 'sine'
        o.frequency.value = f * mult
        const g = c.createGain()
        g.gain.setValueAtTime(0, t0 + dt)
        g.gain.linearRampToValueAtTime(amp, t0 + dt + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 1.4 / mult)
        o.connect(g)
        g.connect(out)
        o.start(t0 + dt)
        o.stop(t0 + dt + 1.5)
      })
    })
  } catch {}
}
