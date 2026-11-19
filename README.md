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
| `/chat/{pushId}` | 채팅 (최근 40개 표시) |
| `/board_notes/{id}` | 자유 게시판 포스트잇 |
| `/desk_notes/{id}` | 책상 쪽지 |
| `/snack_votes/{주차}/{uid}` | 간식 투표 (1인 1표, 매주 월요일 새 회차) |

## 파일 구조
```
├─ index.html
├─ package.json / vite.config.js / vercel.json
├─ database.rules.json      ← Firebase 보안 규칙
├─ .env.example             ← (선택) 환경변수 방식
└─ src/
   ├─ firebase.js           ← 🔥 firebaseConfig 붙여넣는 곳
   ├─ net.js                ← 실시간 멀티플레이 (presence · chat)
   ├─ notes.js              ← 게시판 · 책상 쪽지 · 간식 투표 저장
   ├─ main.jsx / App.jsx / store.js
   ├─ layout.js / furniture.js / nav.js     ← 평면도 · 가구 · 길찾기
   ├─ Office.jsx / Extras.jsx / Character.jsx / Player.jsx
   ├─ Ambience.jsx / lofi.js                ← KST 조명 · 로파이 음악
   ├─ UI.jsx / styles.css / textures.js / restaurants.js
```

## 운영 팁
- 채팅은 계속 쌓입니다. 가끔 Firebase 콘솔에서 `/chat` 노드를 삭제해 정리하세요.
- 익명 로그인이라 누구나 링크로 들어올 수 있습니다. 사내 전용으로 막으려면 Vercel의 **Password Protection**이나 Firebase의 Google 로그인 + 도메인 제한 규칙을 추가하세요.
