// ════════════════════════════════════════════════════════════════
//  ⚙️ 추가 설정
// ════════════════════════════════════════════════════════════════

// 🚗 니로 운행일지 → 회사 구글 스프레드시트 자동 기록 (선택)
//  1) 구글 스프레드시트 → 확장 프로그램 → Apps Script 에 docs/niro-apps-script.gs 내용을 붙여넣기
//  2) [배포] → [새 배포] → 유형: 웹 앱 / 실행: 나 / 액세스 권한: 모든 사용자 → 배포
//  3) 발급된 웹 앱 URL(https://script.google.com/macros/s/…/exec)을 아래에 붙여넣기
//  비워 두면 Firebase에만 저장됩니다. (Vercel 환경변수 VITE_NIRO_SHEET_URL 로 넣어도 됩니다)
export const NIRO_SHEET_WEBAPP_URL = '' || import.meta.env.VITE_NIRO_SHEET_URL || ''
