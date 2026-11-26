# 🏢 건축사사무소 3D 가상 오피스 — Firebase + Vercel 배포판

React Three Fiber로 만든 3D 가상 사무실입니다. 실시간 멀티플레이와 영구 저장은 **Firebase Realtime Database**를 씁니다.
Firebase 설정을 비워 두면 **로컬 모드**(같은 브라우저의 탭끼리만 공유)로 동작하니, 설정 전에도 화면은 바로 확인할 수 있어요.

## 1. 로컬 실행
```bash
npm install
npm run dev        # http://localhost:5173
```

## 2. Firebase 준비 (약 5분)
1. https://console.firebase.google.com → **프로젝트 추가**
2. **빌드 → Realtime Database → 데이터베이스 만들기**
   - 위치: `asia-southeast1 (싱가포르)` 추천 → **잠금 모드**로 시작
3. **빌드 → Authentication → 시작하기 → 로그인 방법 → "익명"** 사용 설정
4. **Realtime Database → 규칙** 탭에 `database.rules.json` 내용을 그대로 붙여넣고 **게시**
5. **프로젝트 설정(⚙️) → 일반 → 내 앱 → 웹 앱(</>) 추가** → 표시되는 `firebaseConfig`를 복사해
   `src/firebase.js` 맨 위 `firebaseConfig = { ... }` 에 붙여넣기
   - `databaseURL` 이 빠져 있으면 Realtime Database 화면 상단의 주소(`https://...firebasedatabase.app`)를 넣어 주세요.
6. **Authentication → 설정 → 승인된 도메인**에 배포 주소(예: `내프로젝트.vercel.app`)를 추가

> 화면 상단 '접속 N명' 옆에 **로컬 모드** 표시가 사라지면 Firebase에 연결된 것입니다.

## 3. GitHub → Vercel 배포
```bash
git init
git add .
git commit -m "3D 가상 오피스"
git branch -M main
git remote add origin https://github.com/<내계정>/archi-office-3d.git
git push -u origin main
```
1. https://vercel.com → **Add New → Project → GitHub 저장소 Import**
2. Framework Preset: **Vite** (자동 감지) · Build: `npm run build` · Output: `dist`
3. (선택) 설정값을 코드에 넣지 않았다면 **Environment Variables**에 `.env.example`의 `VITE_FIREBASE_*` 값을 입력
4. **Deploy** → 이후 `git push` 할 때마다 자동 재배포

## 데이터 구조 (Realtime Database)
| 경로 | 내용 |
|---|---|
| `/presence/{uid_탭}` | 캐릭터 위치·앉기·기분/상태·룰렛 결과 (접속 끊기면 자동 삭제) |
| `/chat/{msgId}` | 전체 채팅 (최근 60개 표시 · 내 메시지 개별 삭제 · 전체 비우기) |
| `/group_chats/{roomId}` | 그룹 채팅방 `meta` · `members/{uid}` · `messages` (멤버만 읽기/쓰기) |
| `/user_rooms/{uid}/{roomId}` | 내가 초대된 방 목록 (멤버에게만 방이 보이도록) |
| `/board_notes/{id}` | 자유 게시판 포스트잇 (익명이면 이름 미저장) |
| `/desk_notes/{id}` | 책상에 붙은 💌 비밀 쪽지 / 📞 부재중 전화 메모 (`kind`·`caller`·`phone`) |
| `/desk_notes_archive/{id}` | 확인 완료한 쪽지 보관함 |
| `/snack_options/{id}` | 직원이 추가한 간식 후보 |
| `/snack_votes/{주차}/{uid}` | 간식 투표 (1인 1표, 매주 월요일 새 회차) |
| `/custom_restaurants/{id}` | 직원이 추가한 점심 룰렛 식당 |
| `/archi_stories/{id}` | 직원이 공유한 건축 이야기·기사 (작성자만 삭제) |
| `/tree_wishes/{id}` | 🎄 트리 소원 카드 (100자, 작성자만 삭제) |
| `/project_dday/{id}` | 📅 프로젝트 마감 D-Day (관리부 전광판) |
| `/archi_models/{id}` | 📐 진행 중인 프로젝트 안내 (회의 테이블 모형 전시대) |
| `/niro_logs/{id}` | 🚗 니로 법인차량 운행일지 (서명 PNG 포함, 작성자 본인만 삭제) |
| `/office_notion_url` | 📌 사내 공지·서식함 노션 링크 `{url, by, at}` (관리부가 화면에서 수정) |
| `/vacation_status/{직원이름}` | 🏖️ 휴가중 표시 `{on, by, at}` (관리부가 체크) |

## v7 새 기능 사용법

### 🔗 내 자리로 바로 입장: `?user=이름`
`https://내주소.vercel.app/?user=이한준` 처럼 `layout.js`의 직원 이름을 붙이면 선택 창 없이 내 자리에 앉은 채로 바로 입장합니다.
각자 이 주소를 브라우저 즐겨찾기에 등록해 두면 편해요. (한글은 브라우저가 자동으로 `%EC%9D%B4...`로 바꿔도 정상 동작)
명단에 없는 이름이면 안내 문구와 함께 일반 선택 창이 뜹니다. 옷 색·헤어는 마지막으로 직접 입장할 때 고른 것을 그대로 씁니다.

### 📌 사내 공지·서식함 (Notion)
관리부 왼쪽 낮은 수납장 위의 데스크 사인에 다가가거나 클릭하면 [📌 사내 공지·서식함(Notion) 열기] 버튼이 나오고, 새 탭으로 노션이 열립니다.
- 기본 링크: `src/config.js`의 `NOTION_URL`에 넣거나 Vercel 환경변수 `VITE_NOTION_URL`로 지정
- 관리부 직원은 [⚙️ 노션 링크 수정]으로 화면에서 바로 바꿀 수 있고, 바꾼 링크는 Firebase `/office_notion_url`에 저장되어 기본값보다 우선합니다.

### 관리부 전용 권한
`layout.js`에서 `dept: '관리부'`인 직원으로 입장했을 때만 다음이 보입니다.
- 📅 D-Day 전광판 일정 추가·수정·삭제 (다른 직원은 보기만 가능)
- 🏖️ 직원 휴가 관리 (우측 하단 버튼) → 체크한 직원은 책상 이름표와 캐릭터 머리 위에 [🏖️ 휴가중] 배지
- ⚙️ 노션 링크 수정

### 🚗 외근/현장 · 👥 접속자 목록
우측 하단 내 카드 → 근무 상태 [🚗 외근/현장] → 행선지·복귀 시간 입력 → 머리 위에 `🚗 과천시청 (~15:30)` 말풍선.
상단 [접속 N명 ▾]을 누르면 접속자 목록(기분·상태·외근·휴가)이 열립니다.

### 💌 비밀 쪽지
다른 직원 책상 앞에서 [💌 비밀 쪽지 남기기] → [💬 일반 쪽지] 또는 [📞 부재중 전화 메모](전화 주신 분·연락처) 선택.
책상 위 포스트잇에는 아이콘만 보이고, 내용은 그 책상 주인으로 입장한 사람만 열고 확인·삭제할 수 있습니다. 다른 사람은 "🔒 본인만 확인할 수 있는 비밀 쪽지입니다."만 보여요.

### ⚠️ 보안에 대한 솔직한 안내
이 앱은 **익명 로그인 + 이름 선택** 방식이라, 위의 '관리부 권한'과 '본인만 보기'는 **화면(UI)에서만 막는 장치**입니다.
링크를 가진 사람은 누구나 다른 이름(예: `?user=관리부직원`)으로 들어올 수 있고, 개발자 도구를 다룰 줄 알면 데이터베이스의 쪽지 내용도 읽을 수 있어요.
사내 장난 방지·실수 방지 용도로는 충분하지만, 정말 민감한 내용(개인정보, 계약 금액 등)은 쪽지로 남기지 마세요.
제대로 막으려면 Firebase Google 로그인(회사 도메인 제한) + 사용자 uid ↔ 직원 이름 매핑을 추가해 보안 규칙에서 검사해야 합니다.

## 🚗 니로 운행일지
- 3D 사무실: 주출입구 옆 키박스를 클릭하거나 가까이 가서 [🚗 니로 운행일지]
- 📱 모바일 전용 화면: `https://내사이트.vercel.app/?niro=1` (3D를 불러오지 않아 빠름 → 홈 화면에 추가 추천)
- 📥 [전체 기록] 탭에서 엑셀(CSV) 다운로드
- 구글 스프레드시트 자동 기록(선택): `docs/niro-apps-script.gs` 안내대로 Apps Script 웹 앱을 배포한 뒤
  `src/config.js` 의 `NIRO_SHEET_WEBAPP_URL` 에 URL 입력 (또는 Vercel 환경변수 `VITE_NIRO_SHEET_URL`)

## 🌤️ 과천시 실시간 날씨
- [Open-Meteo](https://open-meteo.com) 무료 API (키 불필요) · 10분마다 갱신 · `src/weather.js`
- 우측 상단 날씨 표시를 누르면 창밖 효과 미리보기: 실시간 → 눈 → 비 → 맑음

> 새 버전으로 업데이트할 때는 **`database.rules.json`을 Firebase 콘솔 → Realtime Database → 규칙에 다시 붙여넣고 [게시]** 해야 새 기능이 저장됩니다.

## 파일 구조
```
├─ index.html
├─ package.json / vite.config.js / vercel.json
├─ database.rules.json      ← Firebase 보안 규칙
├─ .env.example             ← (선택) 환경변수 방식
└─ src/
   ├─ firebase.js           ← 🔥 firebaseConfig 붙여넣는 곳
   ├─ db.js                 ← 저장 공통 계층 (Firebase / 로컬 모드 자동 전환)
   ├─ net.js                ← 실시간 캐릭터 동기화 (presence)
   ├─ chat.js               ← 전체 채팅 · 그룹 채팅 데이터
   ├─ ChatPanel.jsx         ← 채팅창 UI (탭 · 그룹방 · 삭제)
   ├─ notes.js              ← 게시판 · 쪽지 · 보관함 · 간식 투표 · 룰렛 식당
   ├─ main.jsx / App.jsx / store.js
   ├─ layout.js / furniture.js / nav.js     ← 평면도 · 가구 · 길찾기
   ├─ Office.jsx / Extras.jsx / Character.jsx / Player.jsx
   ├─ Ambience.jsx / music.js               ← KST 조명 · 크리스마스 캐롤 오르골 (Web Audio)
   ├─ stories.js                            ← 오늘의 건축 이야기 기본 10편
   ├─ weather.js                            ← 과천시 실시간 날씨 (Open-Meteo)
   ├─ niro.js / NiroLog.jsx / NiroApp.jsx   ← 니로 운행일지 (데이터 · 화면 · ?niro=1 단독 화면)
   ├─ config.js                             ← 구글 시트 웹 앱 URL · 노션 기본 링크 등 추가 설정
   ├─ roles.js                              ← 관리부 권한 판정 (layout.js의 dept 기준)
   ├─ UI.jsx / styles.css / textures.js / restaurants.js
```

## 시간 알림 (KST)
| 시각 | 알림 |
|---|---|
| 평일 11:25 / 11:30 | 점심 알림 + 룰렛 바로가기 |
| 매일 15:00 | 🧘 1분 스트레칭 & 눈 운동 (상단 [🧘 1분 스트레칭] 버튼으로 언제든 실행) |

## 운영 팁
- 전체 채팅은 채팅창의 [🗑️ 대화 비우기]로 정리할 수 있어요.
- 익명 로그인이라 누구나 링크로 들어올 수 있습니다. 사내 전용으로 막으려면 Vercel의 **Password Protection**이나 Firebase의 Google 로그인 + 도메인 제한 규칙을 추가하세요.
