// 고정 가구 배치 (렌더링 + 충돌 판정 공용)

// 상호작용 위치
export const TREE = { x: 25.95, z: 5.45 } // 🎄 크리스마스 트리 (다목적실 가운데)
export const COFFEE = { x: 27.15, z: 8.75 } // ☕ 탕비실 커피머신 앞
export const MODELS = { x: 15.45, z: 6.5 } // 📐 공용 회의 테이블 위 모형 전시
export const DDAY = { x: 21.75, z: 0.16 } // 📅 관리부 북쪽 창가 전광판
export const STROLLER = { x: 27.85, z: 1.75, rot: -Math.PI / 2 } // 🍼 하린이 유모차 (다목적실 소파 옆, 충돌 판정 없음)
export const NIRO = { x: 21.72, z: 9.2 } // 🚗 주출입구 옆 니로 키박스
export const STORY = { x: 26.4, z: 0.2 } // 🏛️ 다목적실 북쪽 벽 '오늘의 건축 이야기' 보드 (기존 화이트보드 자리)
export const NOTION = { x: 20.6, z: 6.9 } // 📌 관리부 수납장 위 노션 공지·서식함
// 모든 항목: x,z = 중심, w = x폭, d = z깊이
export const furniture = [
  // 조대호 대표님실
  { type: 'meetingTable', x: 2.0, z: 1.35, w: 1.9, d: 0.95, chairs: 4 },
  { type: 'bookshelf', x: 0.28, z: 2.3, w: 0.42, d: 2.6, h: 2.0 },
  // 변소영 대표님실 + 접견실
  { type: 'roundTable', x: 1.65, z: 7.0, w: 1.2, d: 1.2 },
  { type: 'bookshelf', x: 0.28, z: 7.1, w: 0.42, d: 2.6, h: 2.0 },
  { type: 'credenza', x: 1.9, z: 9.32, w: 1.7, d: 0.45 },
  // 창고
  { type: 'rack', x: 7.6, z: 0.38, w: 3.6, d: 0.5, h: 2.1 },
  { type: 'rack', x: 4.98, z: 1.25, w: 0.45, d: 1.7, h: 2.1 },
  { type: 'boxes', x: 8.3, z: 1.95, w: 0.6, d: 0.5 },
  { type: 'boxes', x: 9.05, z: 1.95, w: 0.6, d: 0.5 },
  { type: 'rolls', x: 9.55, z: 1.15, w: 0.6, d: 0.6 },
  // 박재경 전무석 주변 (좌석은 layout.js seats)
  // 설계실
  { type: 'bookshelf', x: 13.95, z: 6.5, w: 0.4, d: 4.0, h: 1.7, rot: 'E' },
  { type: 'longTable', x: 15.45, z: 6.5, w: 1.1, d: 3.6 },
  { type: 'cabinet', x: 18.25, z: 8.2, w: 0.55, d: 0.6, h: 0.75 },
  // 기둥
  { type: 'pillar', x: 9.75, z: 0.3, w: 0.5, d: 0.5 },
  { type: 'pillar', x: 20.5, z: 0.3, w: 0.5, d: 0.5 },
  // 관리부
  { type: 'printer', x: 20.62, z: 2.95, w: 0.62, d: 0.62 },
  { type: 'printer', x: 20.62, z: 3.85, w: 0.62, d: 0.62 },
  { type: 'cabinet', x: 20.6, z: 6.25, w: 0.55, d: 3.1, h: 1.0 },
  // 다목적실
  { type: 'sofa', x: 28.05, z: 3.8, w: 0.8, d: 2.2 },
  { type: 'coffeeTable', x: 27.0, z: 3.8, w: 0.6, d: 1.1 },
  // 탕비실
  { type: 'counter', x: 27.0, z: 9.3, w: 2.7, d: 0.55 },
  { type: 'fridge', x: 28.15, z: 8.1, w: 0.65, d: 0.65 },
  // 🎄 크리스마스 트리 — 다목적실 가운데 (렌더링은 XmasTree)
  { type: 'xmasTree', x: 25.95, z: 5.45, w: 0.9, d: 0.9 },
  // 🚗 니로 키박스 스탠드 (렌더링은 NiroKiosk)
  { type: 'niroKiosk', x: 21.72, z: 9.2, w: 0.5, d: 0.3 },
  // 탕비실 옆 점심 룰렛 (렌더링은 Roulette3D)
  { type: 'roulette', x: 25.0, z: 9.26, w: 0.78, d: 0.45 },
]
