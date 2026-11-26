import * as THREE from 'three'

const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR","Nanum Gothic",sans-serif'

function rand(seed) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

const cache = {}
function tex(key, draw, repeat) {
  if (!cache[key]) cache[key] = draw()
  const t = new THREE.CanvasTexture(cache[key])
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (repeat) t.repeat.set(repeat[0], repeat[1])
  return t
}

// 밝은 우드 마루 (512px = 2m)
export function woodTexture(rx, ry) {
  return tex('wood', () => {
    const [c, g] = canvas(512, 512)
    const r = rand(7)
    const plankH = 512 / 8
    for (let row = 0; row < 8; row++) {
      let x = -r() * 200
      while (x < 512) {
        const len = 160 + r() * 200
        const tone = 200 + r() * 22
        g.fillStyle = `rgb(${tone + 18},${tone - 8},${tone - 48})`
        g.fillRect(x, row * plankH, len, plankH)
        for (let k = 0; k < 7; k++) {
          g.strokeStyle = `rgba(150,105,60,${0.05 + r() * 0.07})`
          g.lineWidth = 1 + r() * 1.5
          g.beginPath()
          const y = row * plankH + r() * plankH
          g.moveTo(x, y)
          g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 8, x + len * 0.6, y + (r() - 0.5) * 8, x + len, y)
          g.stroke()
        }
        g.fillStyle = 'rgba(110,75,40,0.35)'
        g.fillRect(x, row * plankH, 2, plankH)
        x += len
      }
      g.fillStyle = 'rgba(110,75,40,0.3)'
      g.fillRect(0, row * plankH, 512, 2)
    }
    return c
  }, [rx, ry])
}

// 카펫 타일 (512px = 2m, 50cm 타일 4x4)
export function carpetTexture(rx, ry) {
  return tex('carpet', () => {
    const [c, g] = canvas(512, 512)
    const r = rand(3)
    const s = 128
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const alt = (i + j) % 2
        const base = alt ? [128, 136, 138] : [140, 146, 146]
        g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`
        g.fillRect(i * s, j * s, s, s)
        for (let k = 0; k < 900; k++) {
          const v = (r() - 0.5) * 30
          g.fillStyle = `rgba(${base[0] + v},${base[1] + v},${base[2] + v},0.6)`
          if (alt) g.fillRect(i * s + r() * s, j * s + r() * s, 1, 3)
          else g.fillRect(i * s + r() * s, j * s + r() * s, 3, 1)
        }
        g.strokeStyle = 'rgba(70,80,82,0.35)'
        g.lineWidth = 1.5
        g.strokeRect(i * s + 0.5, j * s + 0.5, s - 1, s - 1)
      }
    return c
  }, [rx, ry])
}

// 탕비실 타일
export function tileTexture(rx, ry) {
  return tex('tile', () => {
    const [c, g] = canvas(256, 256)
    g.fillStyle = '#eceae5'
    g.fillRect(0, 0, 256, 256)
    const r = rand(11)
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const v = 228 + r() * 14
        g.fillStyle = `rgb(${v},${v - 2},${v - 6})`
        g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122)
      }
    return c
  }, [rx, ry])
}

// 창고 콘크리트
export function concreteTexture(rx, ry) {
  return tex('concrete', () => {
    const [c, g] = canvas(256, 256)
    g.fillStyle = '#b9b6b0'
    g.fillRect(0, 0, 256, 256)
    const r = rand(5)
    for (let k = 0; k < 3000; k++) {
      const v = 150 + r() * 70
      g.fillStyle = `rgba(${v},${v},${v - 4},0.25)`
      g.fillRect(r() * 256, r() * 256, 2, 2)
    }
    return c
  }, [rx, ry])
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

// 바닥 구역 라벨
export function labelTexture(text, big) {
  const [c, g] = canvas(1024, 256)
  g.font = `800 ${big ? 150 : 120}px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = 'rgba(70,60,50,0.55)'
  g.fillText(text, 512, 132)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// 떠 있는 직원 이름표
export function nameTagTexture(name, title, mine, count = 0, vacation = false) {
  const [c, g] = canvas(640, 220)
  const accent = mine ? '#f2a516' : '#3c6e71'
  g.shadowColor = 'rgba(0,0,0,0.25)'
  g.shadowBlur = 18
  g.shadowOffsetY = 8
  roundRect(g, 20, 14, 600, 170, 34)
  g.fillStyle = '#fffdf8'
  g.fill()
  g.shadowColor = 'transparent'
  roundRect(g, 20, 14, 600, 170, 34)
  g.lineWidth = 6
  g.strokeStyle = accent
  g.stroke()
  g.fillStyle = accent
  roundRect(g, 44, 52, 16, 94, 8)
  g.fill()
  g.textBaseline = 'middle'
  g.font = `800 82px ${FONT}`
  g.fillStyle = '#2b2a28'
  const nameW = g.measureText(name).width
  g.font = `600 60px ${FONT}`
  const titleW = g.measureText(title).width
  const total = nameW + 22 + titleW
  const sx = 340 - total / 2
  g.font = `800 82px ${FONT}`
  g.fillStyle = '#2b2a28'
  g.textAlign = 'left'
  g.fillText(name, sx, 102)
  g.font = `600 60px ${FONT}`
  g.fillStyle = accent
  g.fillText(title, sx + nameW + 22, 106)
  if (vacation) {
    // 🏖️ 휴가중 배지
    roundRect(g, 4, 0, 230, 70, 35)
    g.fillStyle = '#ff922b'
    g.fill()
    g.strokeStyle = '#fff'
    g.lineWidth = 5
    g.stroke()
    g.fillStyle = '#fff'
    g.font = `900 40px ${FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('🏖️ 휴가중', 119, 37)
    g.textAlign = 'left'
  }
  if (count > 0) {
    // 쪽지 알림 배지
    roundRect(g, 440, 0, 196, 84, 42)
    g.fillStyle = '#ff6b9a'
    g.fill()
    g.strokeStyle = '#fff'
    g.lineWidth = 5
    g.stroke()
    g.fillStyle = '#fff'
    g.font = `800 52px ${FONT}`
    g.textAlign = 'center'
    g.fillText('💌 ' + (count > 9 ? '9+' : count), 538, 45)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// 책상 위 아크릴 명패
export function deskPlateTexture(name, title) {
  const [c, g] = canvas(512, 128)
  g.fillStyle = '#2d3436'
  g.fillRect(0, 0, 512, 128)
  g.fillStyle = '#d9b26a'
  g.fillRect(0, 112, 512, 16)
  g.font = `700 64px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#fbf6ea'
  g.fillText(`${name} ${title}`, 256, 58)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// 모니터 화면 (CAD 도면 느낌)
export function screenTexture(seed) {
  return tex('screen' + (seed % 4), () => {
    const [c, g] = canvas(256, 160)
    const r = rand(seed + 3)
    const dark = seed % 2 === 0
    g.fillStyle = dark ? '#1d2733' : '#f4f6f8'
    g.fillRect(0, 0, 256, 160)
    g.fillStyle = dark ? '#2f3d4d' : '#dde3ea'
    g.fillRect(0, 0, 256, 14)
    g.fillRect(0, 14, 26, 146)
    g.strokeStyle = dark ? '#7fd1ff' : '#3a6ea5'
    g.lineWidth = 1.5
    for (let k = 0; k < 9; k++) {
      const x = 40 + r() * 170
      const y = 24 + r() * 110
      g.strokeRect(x, y, 20 + r() * 60, 14 + r() * 40)
    }
    g.strokeStyle = dark ? '#ffd166' : '#e07a5f'
    g.beginPath()
    g.moveTo(36, 140)
    g.lineTo(240, 140)
    g.stroke()
    return c
  })
}
