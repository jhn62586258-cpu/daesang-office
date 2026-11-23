// 🌤️ 경기도 과천시 실시간 날씨 — Open-Meteo (API 키 불필요, 무료)
// https://open-meteo.com/en/docs  · 10분마다 갱신
import { useStore } from './store'

const LAT = 37.4292
const LON = 126.9877
const URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code,is_day,precipitation&timezone=Asia%2FSeoul`

// WMO 날씨 코드 → 한글 + 아이콘 + 창밖 효과
export function describe(code, isDay = 1) {
  if (code === 0) return { label: '맑음', icon: isDay ? '☀️' : '🌙', precip: 'none' }
  if (code === 1) return { label: '대체로 맑음', icon: isDay ? '🌤️' : '🌙', precip: 'none' }
  if (code === 2) return { label: '구름 조금', icon: '⛅', precip: 'none' }
  if (code === 3) return { label: '흐림', icon: '☁️', precip: 'none' }
  if (code === 45 || code === 48) return { label: '안개', icon: '🌫️', precip: 'none' }
  if (code >= 51 && code <= 57) return { label: '이슬비', icon: '🌦️', precip: 'rain' }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: '비', icon: '🌧️', precip: 'rain' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: '눈', icon: '❄️', precip: 'snow' }
  if (code >= 95) return { label: '뇌우', icon: '⛈️', precip: 'rain' }
  return { label: '흐림', icon: '☁️', precip: 'none' }
}

async function load() {
  try {
    const res = await fetch(URL)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const j = await res.json()
    const c = j.current || {}
    const code = Number(c.weather_code)
    const d = describe(code, c.is_day)
    useStore.getState().set({
      weather: { temp: Math.round(Number(c.temperature_2m)), code, isDay: !!c.is_day, ...d, at: Date.now() },
      weatherError: false,
    })
  } catch (e) {
    console.warn('[날씨] 과천시 날씨를 불러오지 못했어요', e)
    useStore.getState().set({ weatherError: true })
  }
}

let started = false
export function initWeather() {
  if (started) return
  started = true
  load()
  setInterval(load, 10 * 60 * 1000)
}

// 미리보기 순서: 실시간 → 눈 → 비 → 맑음 → 실시간
export function cycleWeatherPreview() {
  const cur = useStore.getState().weatherOverride
  const next = cur === null ? 'snow' : cur === 'snow' ? 'rain' : cur === 'rain' ? 'none' : null
  useStore.getState().set({ weatherOverride: next })
}
