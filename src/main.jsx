import { createRoot } from 'react-dom/client'
import './styles.css'

const root = createRoot(document.getElementById('root'))
const params = new URLSearchParams(location.search)

// 📱 주소 뒤에 ?niro=1 → 3D 사무실(three.js)을 불러오지 않고 운행일지 화면만 바로 표시
if (params.has('niro')) {
  import('./NiroApp').then(({ default: NiroApp }) => root.render(<NiroApp />))
} else {
  import('./App').then(({ default: App }) => root.render(<App />))
}
