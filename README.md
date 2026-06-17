# 덕고(Duck-Go)

만화 취향을 3x3 빙고판으로 제작하고, 다른 사용자와 공유하며, 풀이 결과와 댓글로 소통할 수 있는 React 기반 웹 프로젝트입니다.

배포 주소: https://duckgo-project.web.app

## 1. 프로젝트 개요

덕고(Duck-Go)는 사용자가 좋아하는 만화 9개를 선택해 취향 빙고를 만들고 공유할 수 있는 웹 서비스입니다.

주요 목적은 단순한 작품 목록 저장이 아니라, 사용자의 취향을 시각적인 빙고판으로 표현하고 다른 사용자가 해당 빙고를 풀며 서로의 취향을 비교할 수 있도록 하는 것입니다.

## 2. 주요 기능

- 이메일/비밀번호 로그인 및 회원가입
- Google 팝업 로그인
- 로그인/로그아웃 상태에 따른 UI 변경
- 비회원 빙고 업로드
- 사용자 지정 관리 아이디와 관리 비밀번호를 통한 비회원 빙고 관리
- 만화 검색 API를 활용한 작품 검색
- 작품 선택 후 한글 표시 제목과 감상평 입력
- 직접 입력을 통한 작품 등록
- 3x3 빙고판 제작
- 빙고 칸 개별 삭제 및 전체 초기화
- 빙고 완료도 표시
- 공개/비공개 빙고 설정
- Firestore 기반 빙고 업로드 및 목록 조회
- 조회수 기준 인기 빙고 정렬
- 최신순 빙고 정렬
- 실시간 인기 만화 랭킹
- 빙고 상세 화면
- 작품 정보, 주인장 코멘트, 방명록, 푼 빙고 탭
- 줄거리 한국어 번역 및 원문 보기
- 댓글/방명록 작성 및 조회
- 내가 작성한 댓글 삭제
- 관리자 댓글 숨김/해제
- 다른 사용자의 빙고 풀이 결과 등록
- 닉네임 기반 풀이 결과 저장
- 빙고 완성 줄 수 계산
- 내가 등록한 풀이 결과 삭제
- 공유 링크 생성
- 링크 복사 및 브라우저 공유
- 빙고 이미지 PNG 저장 및 공유
- 관리 페이지에서 내 빙고 수정, 삭제, 공유, 댓글 관리
- 모바일/데스크톱 반응형 레이아웃

## 3. 기술 스택

- React
- Vite
- JavaScript
- CSS
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- Jikan API
- MyMemory Translation API

## 4. 실행 방법

### 4.1. 패키지 설치

```bash
npm install
```

### 4.2. 개발 서버 실행

```bash
npm run dev
```

기본 실행 주소:

```text
http://localhost:5173
```

### 4.3. 빌드

```bash
npm run build
```

### 4.4. 빌드 결과 미리보기

```bash
npm run preview
```

## 5. Firebase 설정

Firebase를 사용하려면 Firebase 프로젝트 생성 후 다음 기능을 활성화해야 합니다.

- Authentication
  - 이메일/비밀번호 로그인
  - Google 로그인
- Cloud Firestore
- Firebase Hosting

### 승인 도메인

Google 로그인 사용 시 Firebase Authentication의 승인된 도메인에 다음 주소를 추가해야 합니다.

```text
localhost
duckgo-project.web.app
```

## 6. 환경변수 및 민감정보 주의

제출 시 API Key, Firebase 설정값, 비밀번호 등 민감한 정보는 제거해야 합니다.

환경변수 예시는 `.env.example` 파일에 작성되어 있습니다.

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

실제 제출용 zip 파일을 만들 때는 Firebase Key가 코드에 직접 포함되어 있지 않은지 확인해야 합니다.

## 7. 프로젝트 구조

```text
web-project-react/
├─ public/
├─ src/
│  ├─ assets/
│  ├─ App.jsx
│  ├─ App.css
│  ├─ firebase.js
│  ├─ index.css
│  └─ main.jsx
├─ firestore.rules
├─ firebase.json
├─ package.json
├─ vite.config.js
└─ README.md
```

## 8. 주요 파일 설명

### `src/App.jsx`

프로젝트의 핵심 화면과 기능 로직을 담당합니다.

- 페이지 전환
- 로그인 상태 관리
- 빙고 제작소
- 빙고 업로드
- 빙고 상세 화면
- 댓글/방명록
- 푼 빙고 등록 및 조회
- 관리 페이지
- 공유 링크 및 이미지 저장
- 랭킹 및 탐색 화면

### `src/App.css`

전체 UI 스타일과 반응형 레이아웃을 담당합니다.

- 메인 화면
- 제작소
- 상세 화면
- 관리 화면
- 모달
- 버튼/카드/입력창
- 모바일 레이아웃

### `src/firebase.js`

Firebase 앱 초기화와 Authentication, Firestore 연결을 담당합니다.

### `firestore.rules`

Firestore 보안 규칙 파일입니다.

- 로그인 사용자 댓글 권한
- 빙고 작성자 권한
- 비회원 관리 아이디 기반 업로드
- 풀이 결과 삭제 권한
- 댓글 숨김 권한

### `firebase.json`

Firebase Hosting 및 Firestore 규칙 배포 설정 파일입니다.

## 9. 데이터 저장 구조

### `boards`

빙고판 정보를 저장합니다.

주요 필드:

- `title`: 빙고 제목
- `owner`: 작성자 이메일 또는 비회원 관리 아이디
- `ownerUid`: 로그인 사용자 UID
- `isPublic`: 공개 여부
- `managePassword`: 관리 비밀번호
- `cells`: 9칸 작품 정보 배열
- `views`: 조회수
- `createdAt`: 생성 시간

### `comments`

방명록 댓글을 저장합니다.

주요 필드:

- `boardId`: 대상 빙고 ID
- `body`: 댓글 내용
- `author`: 작성자 이메일
- `authorUid`: 작성자 UID
- `hidden`: 숨김 여부
- `createdAt`: 작성 시간

### `boardResponses`

다른 사용자가 푼 빙고 결과를 저장합니다.

주요 필드:

- `boardId`: 원본 빙고 ID
- `nickname`: 풀이 결과 등록 닉네임
- `author`: 로그인 사용자 이메일
- `authorUid`: 로그인 사용자 UID
- `checkedIndices`: 체크한 칸 번호 배열
- `createdAt`: 등록 시간

## 10. 배포 방법

### Hosting 배포

```bash
npm run build
npx firebase-tools deploy --only hosting:duckgo-project --project web2026-a4f35
```

### Firestore 규칙 배포

```bash
npx firebase-tools deploy --only firestore:rules --project web2026-a4f35
```

## 11. 외부 API

### Jikan API

만화 제목, 작가, 줄거리, 표지 이미지 검색에 사용했습니다.

### MyMemory Translation API

영어 줄거리의 한국어 번역 기능에 사용했습니다.

긴 줄거리는 API 요청 제한을 피하기 위해 문장 단위로 나누어 번역한 뒤 다시 합치는 방식으로 처리했습니다.

## 12. 사용 시 주의사항

- Google 로그인은 Firebase Authentication 승인 도메인에 현재 접속 도메인이 등록되어 있어야 동작합니다.
- 비회원 빙고는 사용자가 입력한 관리 아이디와 관리 비밀번호가 필요합니다.
- 비회원 관리 아이디는 영문 소문자, 숫자, 하이픈, 언더바 조합만 사용할 수 있습니다.
- 기존에 자동 ID로 생성된 빙고는 해당 자동 ID 또는 공유 링크로 관리해야 합니다.
- 번역 API는 외부 무료 API이므로 네트워크 상태나 요청 제한에 따라 실패할 수 있습니다.

## 13. AI 활용 내역

개발 과정에서 AI 도구를 활용하여 다음 작업을 보조받았습니다.

- React 기능 구현 방향 정리
- Firebase Auth 및 Firestore 연동 오류 해결
- Firestore 보안 규칙 작성 보조
- UI 레이아웃 개선
- 반응형 디자인 수정
- 오류 메시지 및 사용자 흐름 개선
- README 및 보고서 작성 방향 정리

