// 외부 음원 없이 Web Audio API로 실시간 합성하는 로파이(Lo-fi) 배경음악 + 빗소리
// 구성: 일렉피아노 코드(Dm9–G13–Cmaj9–Am9) · 베이스 · 붐뱁 드럼(스윙) · 펜타토닉 멜로디(딜레이) · LP 잡음 · 빗소리

let ctx = null
let master, musicBus, rainGain, wobble, delayIn, noiseBuf
let timer = null
let nextTime = 0
let step = 0
let bar = 0
let playing = false

const BPM = 72
const S16 = 60 / BPM / 4
const SWING = 0.32

const CHORDS = [
  { bass: 38, notes: [53, 57, 60, 64] }, // Dm9
  { bass: 43, notes: [53, 57, 59, 64] }, // G13
  { bass: 36, notes: [52, 55, 59, 62] }, // Cmaj9
  { bass: 45, notes: [55, 59, 60, 64] }, // Am9
]
const PENTA = [69, 72, 74, 76, 79, 81]
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)

function makeNoise(seconds, color = 'white') {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (color === 'brown') {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    } else d[i] = w
  }
  return buf
}

function build() {
  ctx = new (window.AudioContext || window.webkitAudioContext)()
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.ratio.value = 3
  comp.connect(ctx.destination)
  master = ctx.createGain()
  master.gain.value = 0
  master.connect(comp)

  // 로파이 질감: 고음을 깎는 로우패스
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 2300
  tone.Q.value = 0.6
  tone.connect(master)
  musicBus = ctx.createGain()
  musicBus.gain.value = 0.85
  musicBus.connect(tone)

  // 테이프 워블 (피치가 살짝 흔들림)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.45
  wobble = ctx.createGain()
  wobble.gain.value = 7
  lfo.connect(wobble)
  lfo.start()

  // 멜로디용 딜레이
  delayIn = ctx.createGain()
  const dly = ctx.createDelay(1)
  dly.delayTime.value = S16 * 3
  const fb = ctx.createGain()
  fb.gain.value = 0.32
  const dlyLp = ctx.createBiquadFilter()
  dlyLp.type = 'lowpass'
  dlyLp.frequency.value = 1600
  delayIn.connect(dly)
  dly.connect(dlyLp)
  dlyLp.connect(fb)
  fb.connect(dly)
  dlyLp.connect(musicBus)

  noiseBuf = makeNoise(2)

  // LP 판 잡음
  const crackleBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate)
  const cd = crackleBuf.getChannelData(0)
  for (let i = 0; i < cd.length; i++) cd[i] = Math.random() < 0.0007 ? (Math.random() * 2 - 1) * 0.9 : (Math.random() * 2 - 1) * 0.012
  const crackle = ctx.createBufferSource()
  crackle.buffer = crackleBuf
  crackle.loop = true
  const cHp = ctx.createBiquadFilter()
  cHp.type = 'highpass'
  cHp.frequency.value = 900
  const cG = ctx.createGain()
  cG.gain.value = 0.16
  crackle.connect(cHp)
  cHp.connect(cG)
  cG.connect(master)
  crackle.start()

  // 빗소리: 브라운 노이즈 + 밴드 필터 + 느린 강약 + 빗방울
  const rain = ctx.createBufferSource()
  rain.buffer = makeNoise(5, 'brown')
  rain.loop = true
  const rLp = ctx.createBiquadFilter()
  rLp.type = 'lowpass'
  rLp.frequency.value = 1400
  const rHp = ctx.createBiquadFilter()
  rHp.type = 'highpass'
  rHp.frequency.value = 250
  rainGain = ctx.createGain()
  rainGain.gain.value = 0
  const rLfo = ctx.createOscillator()
  rLfo.frequency.value = 0.07
  const rLfoG = ctx.createGain()
  rLfoG.gain.value = 0.05
  const rainMod = ctx.createGain() // 빗줄기 강약 (켜고 끄는 rainGain과 분리)
  rainMod.gain.value = 0.8
  rLfoG.gain.value = 0.2
  rLfo.connect(rLfoG)
  rLfoG.connect(rainMod.gain)
  rLfo.start()
  rain.connect(rHp)
  rHp.connect(rLp)
  rLp.connect(rainMod)
  rainMod.connect(rainGain)
  rainGain.connect(master)
  rain.start()
}

function env(g, t, peak, a, d, sustain, rel) {
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + a)
  g.gain.exponentialRampToValueAtTime(Math.max(peak * sustain, 0.0001), t + a + d)
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + rel)
}

function ep(midi, t, vel, len) {
  // 부드러운 일렉피아노: 사인 + 약한 삼각파 배음
  const g = ctx.createGain()
  env(g, t, 0.07 * vel, 0.015, 0.6, 0.35, len)
  g.connect(musicBus)
  ;[
    ['sine', 1, 1],
    ['triangle', 2, 0.18],
  ].forEach(([type, mult, amp]) => {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = mtof(midi) * mult
    o.detune.value = (Math.random() - 0.5) * 8
    wobble.connect(o.detune)
    o.onended = () => wobble.disconnect(o.detune)
    const og = ctx.createGain()
    og.gain.value = amp
    o.connect(og)
    og.connect(g)
    o.start(t)
    o.stop(t + 0.62 + len + 0.1)
  })
}

function bass(midi, t, len) {
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.value = mtof(midi)
  const g = ctx.createGain()
  env(g, t, 0.22, 0.01, 0.25, 0.5, len)
  o.connect(g)
  g.connect(musicBus)
  o.start(t)
  o.stop(t + len + 0.4)
}

function lead(midi, t) {
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.value = mtof(midi)
  wobble.connect(o.detune)
  o.onended = () => wobble.disconnect(o.detune)
  const g = ctx.createGain()
  env(g, t, 0.045, 0.03, 0.3, 0.4, 0.6)
  o.connect(g)
  g.connect(musicBus)
  g.connect(delayIn)
  o.start(t)
  o.stop(t + 1.1)
}

function kick(t) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(120, t)
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.55, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.32)
  o.connect(g)
  g.connect(musicBus)
  o.start(t)
  o.stop(t + 0.35)
}

function noiseHit(t, type, freq, q, peak, dur) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(peak, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.connect(f)
  f.connect(g)
  g.connect(musicBus)
  src.start(t, Math.random() * 1.5)
  src.stop(t + dur + 0.02)
}

function drip(t) {
  const o = ctx.createOscillator()
  o.type = 'sine'
  const f = 1800 + Math.random() * 1600
  o.frequency.setValueAtTime(f, t)
  o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.05)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.012 + Math.random() * 0.015, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
  o.connect(g)
  g.connect(rainGain)
  o.start(t)
  o.stop(t + 0.08)
}

function schedule(s, t) {
  const chord = CHORDS[bar % 4]
  const swing = s % 4 === 2 ? S16 * SWING : 0
  const tt = t + swing
  if (s === 0) {
    chord.notes.forEach((n, i) => ep(n, t + i * 0.012, 0.9 + Math.random() * 0.2, S16 * 14))
    bass(chord.bass, t, S16 * 6)
  }
  if (s === 10) chord.notes.slice(1).forEach((n, i) => ep(n, tt + i * 0.01, 0.45, S16 * 5))
  if (s === 8) bass(chord.bass + (bar % 2 ? 7 : 12), t, S16 * 4)
  // 붐뱁 드럼
  if (s === 0 || s === 7 || (s === 10 && bar % 2 === 1)) kick(tt)
  if (s === 4 || s === 12) noiseHit(tt, 'bandpass', 1900, 0.8, 0.16, 0.18)
  if (s % 2 === 0) noiseHit(tt, 'highpass', 7500, 0.5, s % 4 === 0 ? 0.035 : 0.022, 0.045)
  // 멜로디: 가끔씩, 쉬어가며
  if (bar % 8 > 1 && s % 2 === 0 && Math.random() < 0.22) lead(PENTA[Math.floor(Math.random() * PENTA.length)], tt)
  // 빗방울
  if (Math.random() < 0.5) drip(t + Math.random() * S16)
}

function tick() {
  while (nextTime < ctx.currentTime + 0.15) {
    schedule(step, nextTime)
    nextTime += S16
    step = (step + 1) % 16
    if (step === 0) bar++
  }
}

// 클릭 이벤트 안에서 호출해야 브라우저가 소리를 허용합니다
export async function startMusic(rainOn) {
  if (!ctx) build()
  if (ctx.state === 'suspended') await ctx.resume()
  if (playing) return setRain(rainOn)
  playing = true
  step = 0
  bar = 0
  nextTime = ctx.currentTime + 0.1
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
  master.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 2.5)
  setRain(rainOn)
  timer = setInterval(tick, 25)
}

export function stopMusic() {
  if (!ctx || !playing) return
  playing = false
  clearInterval(timer)
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
  master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8)
  setTimeout(() => !playing && ctx.suspend(), 900)
}

export function setRain(on) {
  if (!ctx) return
  rainGain.gain.cancelScheduledValues(ctx.currentTime)
  rainGain.gain.setValueAtTime(rainGain.gain.value, ctx.currentTime)
  rainGain.gain.linearRampToValueAtTime(on ? 0.22 : 0, ctx.currentTime + 2)
}

// 부드러운 알림음 (딩-동-딩, 실로폰 느낌)
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
