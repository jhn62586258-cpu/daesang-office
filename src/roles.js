// 👥 부서 권한 (layout.js 직원 명단 기준)
// ※ 로그인 없이 이름으로 입장하는 구조라 '화면상 권한'입니다. 실제 보안이 필요하면 README의 보안 안내를 참고하세요.
import { seats } from './layout'

export const seatOf = (name) => seats.find((s) => s.name === name) || null
export const isAdminDept = (me) => !!me && seatOf(me.name)?.dept === '관리부'
export const ADMIN_ONLY_MSG = '관리부 직원만 수정할 수 있습니다.'
