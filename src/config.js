// ════════════════════════════════════════════════════════════════
//  ⚙️ 추가 설정
// ════════════════════════════════════════════════════════════════

// 🚗 니로 운행일지 → 회사 구글 스프레드시트 자동 기록 (선택)
//  1) 구글 스프레드시트 → 확장 프로그램 → Apps Script 에 docs/niro-apps-script.gs 내용을 붙여넣기
//  2) [배포] → [새 배포] → 유형: 웹 앱 / 실행: 나 / 액세스 권한: 모든 사용자 → 배포
//  3) 발급된 웹 앱 URL(https://script.google.com/macros/s/…/exec)을 아래에 붙여넣기
//  비워 두면 Firebase에만 저장됩니다. (Vercel 환경변수 VITE_NIRO_SHEET_URL 로 넣어도 됩니다)
export const NIRO_SHEET_WEBAPP_URL = '' || import.meta.env.VITE_NIRO_SHEET_URL || ''

// 📌 관리부 수납장 위 '사내 공지·서식함' 기본 노션 페이지 (https://www.notion.so/... 공개 링크)
//  관리부 직원은 3D 화면에서 [⚙️ 노션 링크 수정]으로 바꿀 수 있고, 그 값(Firebase /office_notion_url)이 우선합니다.
export const NOTION_URL = 'https://notion.site' || import.meta.env.VITE_NOTION_URL || ''
