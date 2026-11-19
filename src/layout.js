// 평면도 기반 레이아웃 데이터 (단위: m)
// 좌표계: x = 도면 왼쪽→오른쪽 (0 ~ 28.55), z = 도면 위쪽→아래쪽 (0 ~ D)
// 도면 치수: 4,850 + 5,700 + 8,700 + 9,300 = 28,550

export const W = 28.55
export const D = 9.6
export const WALL_H = 2.7

// 벽 타입: ext(외벽·창), extLow(전면 외벽·낮은 창대), solid(내벽), glass(유리 파티션), low(사무용 파티션)
export const walls = [
  // ── 외벽
  { a: [0, 0], b: [W, 0], type: 'ext' },
  { a: [0, 0], b: [0, D], type: 'extSide' },
  { a: [W, 0], b: [W, D], type: 'extSide' },
  { a: [0, D], b: [6.3, D], type: 'extLow' },
  { a: [7.3, D], b: [22.4, D], type: 'extLow' }, // 6.3~7.3 부출입구
  { a: [24.0, D], b: [W, D], type: 'extLow' }, // 22.4~24.0 주출입구

  // ── 좌측 구역 (조대호 대표님실 / 변소영 대표님실)
  { a: [4.7, 0], b: [4.7, 3.3], type: 'solid' },
  { a: [4.7, 4.3], b: [4.7, 5.2], type: 'solid' }, // 3.3~4.3 조대호 대표님실 문
  { a: [4.7, 6.6], b: [4.7, D], type: 'solid' }, // 5.2~6.6 변소영 대표님실 양문
  { a: [0, 4.8], b: [4.7, 4.8], type: 'solid' },

  // ── 창고 (복도를 없애고 창고를 대표님실 벽까지 확장)
  { a: [4.7, 2.6], b: [5.9, 2.6], type: 'solid' },
  { a: [6.9, 2.6], b: [10.0, 2.6], type: 'solid' }, // 5.9~6.9 창고 문, 남쪽 면에 게시판
  { a: [10.0, 0], b: [10.0, 2.6], type: 'solid' },

  // ── 박재경 전무석 ㄷ자 파티션 (북쪽으로 출입)
  { a: [6.9, 4.7], b: [6.9, 7.45], type: 'low' },
  { a: [9.5, 4.7], b: [9.5, 7.45], type: 'low' },
  { a: [6.9, 7.45], b: [9.5, 7.45], type: 'low' },

  // ── 설계실 상단 칸막이 (4석)
  { a: [12.55, 0.1], b: [12.55, 2.6], type: 'low' },
  { a: [15.05, 0.1], b: [15.05, 2.6], type: 'low' },
  { a: [17.55, 0.1], b: [17.55, 2.6], type: 'low' },
  { a: [11.0, 2.6], b: [12.55, 2.6], type: 'low' },
  { a: [13.55, 2.6], b: [15.05, 2.6], type: 'low' },
  { a: [16.05, 2.6], b: [17.55, 2.6], type: 'low' },
  { a: [18.55, 2.6], b: [20.2, 2.6], type: 'low' },

  // ── 설계실 하단 좌측 4인 클러스터
  { a: [10.9, 4.4], b: [12.7, 4.4], type: 'low' },
  { a: [10.9, 8.6], b: [12.7, 8.6], type: 'low' },
  { a: [12.0, 4.4], b: [12.0, 8.6], type: 'low' },
  { a: [10.4, 6.6], b: [13.7, 6.6], type: 'low', h: 1.05 },

  // ── 한상우 부장석
  { a: [17.2, 4.4], b: [17.2, 8.6], type: 'low' },
  { a: [17.2, 4.4], b: [18.6, 4.4], type: 'low' },
  { a: [17.2, 8.6], b: [18.6, 8.6], type: 'low' },

  // ── 설계실 | 관리부 유리 파티션 (하단 통로 개방)
  { a: [20.2, 0], b: [20.2, 7.9], type: 'glass' },

  // ── 관리부 칸막이
  { a: [21.9, 2.4], b: [24.4, 2.4], type: 'low' },
  { a: [22.5, 7.35], b: [24.4, 7.35], type: 'low' },

  // ── 다목적실 / 탕비실
  { a: [24.4, 0], b: [24.4, 7.7], type: 'solid' },
  { a: [25.5, 7.7], b: [W, 7.7], type: 'solid' }, // 24.4~25.5 다목적실 문
  { a: [25.6, 7.7], b: [25.6, 8.1], type: 'solid' },
  { a: [25.6, 9.1], b: [25.6, D], type: 'solid' }, // 8.1~9.1 탕비실 입구
]

// 직원 좌석: (x,z)=책상 중심, face=앉은 사람이 바라보는 방향
export const seats = [
  // 설계실 상단 (좌→우)
  { name: '조성화', title: '상무', x: 11.27, z: 0.62, face: 'N', dept: '설계실' },
  { name: '정지선', title: '부장', x: 13.8, z: 0.62, face: 'N', dept: '설계실' },
  { name: '최유정', title: '과장', x: 16.3, z: 0.62, face: 'N', dept: '설계실' },
  { name: '김정훈', title: '이사', x: 18.87, z: 0.62, face: 'N', dept: '설계실' },
  // 설계실 하단 좌측 파티션
  { name: '정현민', title: '사원', x: 11.15, z: 6.22, face: 'S', w: 1.4, dept: '설계실' },
  { name: '이서영', title: '과장', x: 12.85, z: 6.22, face: 'S', w: 1.4, dept: '설계실' },
  { name: '김유진', title: '과장', x: 11.15, z: 6.98, face: 'N', w: 1.4, dept: '설계실' },
  { name: '하지현', title: '사원', x: 12.85, z: 6.98, face: 'N', w: 1.4, dept: '설계실' },
  // 설계실 하단 우측
  { name: '한상우', title: '부장', x: 17.65, z: 5.9, face: 'W', w: 1.7, dept: '설계실' },
  // 설계실 좌측 (정현민 사원 왼쪽, 부출입구 위) 독립 파티션 좌석
  { name: '박재경', title: '전무', x: 8.2, z: 5.95, face: 'S', w: 1.8, d: 0.8, dept: '설계실' },
  // 관리부 (위→아래)
  { name: '변성수', title: '상무', x: 23.15, z: 1.55, face: 'S', w: 1.7, dept: '관리부' },
  { name: '이한준', title: '과장', x: 23.95, z: 4.0, face: 'E', w: 1.45, dept: '관리부' },
  { name: '조한나', title: '사원', x: 23.95, z: 6.15, face: 'E', w: 1.45, dept: '관리부' },
  // 좌측 임원실
  { name: '조대호', title: '대표님', x: 2.55, z: 3.75, face: 'S', w: 1.7, d: 0.8, exec: true, dept: '임원실' },
  { name: '변소영', title: '대표님', x: 3.45, z: 7.6, face: 'W', w: 1.9, d: 0.85, exec: true, dept: '임원실' },
]

export const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }

export const roomLabels = [
  { text: '조대호 대표님실', x: 2.35, z: 4.35 },
  { text: '변소영 대표님실', x: 2.35, z: 5.25 },
  { text: '창고', x: 6.0, z: 1.9 },
  { text: '설계실', x: 15.4, z: 3.45, big: true },
  { text: '관리부', x: 21.6, z: 5.6, big: true },
  { text: '다목적실', x: 26.2, z: 6.0 },
  { text: '탕비실', x: 26.7, z: 8.45 },
  { text: '주출입구', x: 23.2, z: 9.25 },
  { text: '부출입구', x: 6.8, z: 9.25 },
]

// 현재 위치(구역) 판정
export function zoneAt(x, z) {
  if (x < 4.7) return z < 4.8 ? '조대호 대표님실' : '변소영 대표님실'
  if (x < 10.0 && z < 2.6) return '창고'
  if (x < 9.9) return z < 4.7 ? '설계실 · 자유 게시판' : '설계실 · 박재경 전무석'
  if (x < 20.2) return '설계실'
  if (z > 7.9 && x > 21.2 && x < 25.6) return '주출입구 홀'
  if (x < 24.4) return '관리부'
  if (z < 7.7) return '다목적실'
  if (x > 25.6) return '탕비실'
  return '출입구 홀'
}

export const START = { x: 23.2, z: 8.85 }
export const PANTRY = { x1: 25.3, z1: 7.75, x2: W, z2: D }
export const BOARD = { x: 8.55, z: 2.66, w: 2.3, h: 1.15, y: 1.45 } // 창고 남쪽 벽면 코르크 게시판
export const ROULETTE = { x: 25.0, z: 9.26 } // 탕비실 옆 점심 룰렛

// 좌석의 의자 위치(앉는 위치)와 바라보는 각도
export function chairOf(s) {
  const dir = DIRS[s.face]
  const d = s.d ?? 0.72
  const off = d / 2 + 0.38
  return { x: s.x - dir[0] * off, z: s.z - dir[1] * off, rot: Math.atan2(dir[0], dir[1]), dir }
}
