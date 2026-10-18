# 우리 반 교실 보드

교실 TV(학교 노트북 연결)에 띄워 두는 수업 도우미 웹사이트예요.
시계·시간표, 수업/쉬는 시간 화면, 판서, 과제 정류장, 이름 뽑기, 소음 측정, 신호등 등을 한 화면에서 써요.

## 주소
- 교실 보드: https://gonigoun.github.io/classboard/
- 연결 시험: https://gonigoun.github.io/classboard/test.html
- 화면 미리 보기: https://gonigoun.github.io/classboard/preview/

## 구성
| 파일 | 설명 |
|---|---|
| `index.html` | 모든 화면이 들어 있는 한 페이지 (시작 화면 · 역할 고르기 · 선생님 보드 · 학생 화면) |
| `css/board.css` | 화면 꾸밈 |
| `js/main.js` | 시작점: 로그인 상태와 주소(`#/…`)를 보고 알맞은 화면으로 보냄 |
| `js/board.js` | 선생님 보드 (게스트 모드 포함): 시계·수업 화면·과제 현황·위젯 바·시간 이동 |
| `js/student.js` | 학생 화면: 학급 코드로 입장, 과제 스스로 체크, 선생님께 메시지 |
| `js/classroom.js` | 선생님 쪽 학생 입장(학급 코드·자리)·메시지 창 |
| `js/tasks.js` | 과제 계산 (순서대로 / 골라서) |
| `js/store.js` | 저장·로그인 함수 모음 (화면 코드는 이것만 씀) |
| `js/backend-firebase.js` | 실제 저장소: Firebase |
| `js/data.js` | 예시 데이터, 날짜·시간 계산 |
| `js/sound.js` | 집중 종·자동 효과음 |
| `js/whiteboard.js` | 판서 |
| `js/widgets.js` | 배경·이름 뽑기·소음 측정·신호등·타이머 |
| `js/settings.js` | 설정 창 (시간표·과제 방식·명단·소리·초기화·허용할 선생님) |
| `js/history.js` | 지난 기록 (날짜별·학생별·엑셀 내려받기) |
| `firestore.rules` | Firebase 보안 규칙 (Firebase 콘솔에 게시한 내용과 같아야 함) |
| `test.html` | 학교 노트북에서 https·마이크·로그인·저장이 되는지 확인하는 시험 페이지 |
| `tests/` | 내 컴퓨터 시험용 가짜 저장소와 서버 (`python3 tests/mockserver.py 8766` → `http://localhost:8766/?mock`) |
| `docs/안내서.md` | 선생님용 안내서 |
| `preview/index.html` | 처음 검토한 화면 미리 보기 |

## 사용하는 서비스
- **GitHub Pages**: 페이지를 올려 두는 곳 (무료)
- **Firebase** (Google): 선생님 Google 로그인, 시간표·과제 결과 저장 (서울 서버, 무료 요금제)

## 지켜야 할 것
- 공개 저장소예요. **실제 학생 이름·사진은 올리지 않아요.** 실제 명단은 로그인 후 Firebase에만 저장돼요.
- Firebase 웹 설정값은 공개돼도 괜찮지만, 서비스 계정 키 같은 비밀 파일은 절대 올리지 않아요.

## 작업 방식
1. 변경은 `dev` 갈래에 올리고, 검토 요청(Pull Request)으로 확인해요.
2. 선생님이 확인하고 승인하면 `main`에 합쳐 실제 사이트에 반영돼요.
