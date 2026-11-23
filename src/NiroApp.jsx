// 📱 ?niro=1 — 3D 사무실 없이 차량 운행일지만 여는 모바일용 화면
import { useEffect } from 'react'
import NiroLog from './NiroLog'

export default function NiroApp() {
  useEffect(() => {
    document.documentElement.classList.add('niro-page') // 3D 화면용 스크롤 잠금 해제
    document.body.classList.add('niro-page')
    document.title = '🚗 니로 운행일지'
  }, [])
  const officeUrl = location.pathname
  return (
    <div className="niro-app">
      <header className="niro-head">
        <div className="nh-icon">🚗</div>
        <div>
          <h1>니로 법인차량 운행일지</h1>
          <p>운행 후 바로 기록하고 서명해 주세요</p>
        </div>
      </header>
      <NiroLog standalone />
      <footer className="niro-foot">
        <a href={officeUrl}>🏢 3D 사무실로 가기</a>
      </footer>
    </div>
  )
}
