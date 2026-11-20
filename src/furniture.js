// 고정 가구 배치 (렌더링 + 충돌 판정 공용)
// 모든 항목: x,z = 중심, w = x폭, d = z깊이
export const furniture = [
  // 조대호 사장님실
  { type: 'meetingTable', x: 2.0, z: 1.35, w: 1.9, d: 0.95, chairs: 4 },
  { type: 'bookshelf', x: 0.28, z: 2.3, w: 0.42, d: 2.6, h: 2.0 },
  { type: 'plant', x: 4.3, z: 0.45, w: 0.5, d: 0.5 },
  // 변소영 대표님실 + 접견실
  { type: 'roundTable', x: 1.65, z: 7.0, w: 1.2, d: 1.2 },
  { type: 'bookshelf', x: 0.28, z: 7.1, w: 0.42, d: 2.6, h: 2.0 },
  { type: 'credenza', x: 1.9, z: 9.32, w: 1.7, d: 0.45 },
  { type: 'plant', x: 0.45, z: 5.25, w: 0.5, d: 0.5 },
  { type: 'plant', x: 4.3, z: 9.15, w: 0.5, d: 0.5 },
  // 창고
  { type: 'rack', x: 7.6, z: 0.38, w: 3.6, d: 0.5, h: 2.1 },
  { type: 'rack', x: 4.98, z: 1.25, w: 0.45, d: 1.7, h: 2.1 },
  { type: 'boxes', x: 8.3, z: 1.95, w: 0.6, d: 0.5 },
  { type: 'boxes', x: 9.05, z: 1.95, w: 0.6, d: 0.5 },
  { type: 'rolls', x: 9.55, z: 1.15, w: 0.6, d: 0.6 },
  // 박재경 전무석 주변 (좌석은 layout.js seats)
  { type: 'plant', x: 5.05, z: 9.15, w: 0.45, d: 0.45 },
  { type: 'plant', x: 9.3, z: 8.25, w: 0.45, d: 0.45 },
  // 설계실
  { type: 'bookshelf', x: 13.95, z: 6.5, w: 0.4, d: 4.0, h: 1.7, rot: 'E' },
  { type: 'longTable', x: 15.45, z: 6.5, w: 1.1, d: 3.6 },
  { type: 'plant', x: 16.55, z: 3.35, w: 0.45, d: 0.45 },
  { type: 'plant', x: 21.05, z: 9.12, w: 0.45, d: 0.45 },
  { type: 'cabinet', x: 18.25, z: 8.2, w: 0.55, d: 0.6, h: 0.75 },
  // 기둥
  { type: 'pillar', x: 9.75, z: 0.3, w: 0.5, d: 0.5 },
  { type: 'pillar', x: 20.5, z: 0.3, w: 0.5, d: 0.5 },
  // 관리부
  { type: 'printer', x: 20.62, z: 2.95, w: 0.62, d: 0.62 },
  { type: 'printer', x: 20.62, z: 3.85, w: 0.62, d: 0.62 },
  { type: 'cabinet', x: 20.6, z: 6.25, w: 0.55, d: 3.1, h: 1.0 },
  { type: 'plant', x: 24.05, z: 8.05, w: 0.45, d: 0.45 },
  // 다목적실
  { type: 'whiteboard', x: 26.5, z: 0.18, w: 2.2, d: 0.1 },
  { type: 'sofa', x: 28.05, z: 3.8, w: 0.8, d: 2.2 },
  { type: 'coffeeTable', x: 27.0, z: 3.8, w: 0.6, d: 1.1 },
  { type: 'plant', x: 28.15, z: 0.45, w: 0.5, d: 0.5 },
  { type: 'plant', x: 24.85, z: 0.45, w: 0.5, d: 0.5 },
  // 탕비실
  { type: 'counter', x: 27.0, z: 9.3, w: 2.7, d: 0.55 },
  { type: 'fridge', x: 28.15, z: 8.1, w: 0.65, d: 0.65 },
  // 🎄 크리스마스 트리 (렌더링은 XmasTree)
  { type: 'xmasTree', x: 19.55, z: 6.8, w: 0.9, d: 0.9 },
  // 탕비실 옆 점심 룰렛 (렌더링은 Roulette3D)
  { type: 'roulette', x: 25.0, z: 9.26, w: 0.78, d: 0.45 },
]
