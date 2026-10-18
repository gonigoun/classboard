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
| `index.html` | 교실 보드 화면 (주소만 열면 나오는 화면) |
| `css/board.css` | 화면 꾸밈 |
| `js/app.js` | 화면 전체를 움직이는 중심 코드 (시계·수업 상태·과제 정류장·위젯 바·시간 이동) |
| `js/data.js` | 예시 데이터, 날짜·시간 계산 |
| `js/store.js` | Google 로그인과 Firebase 저장 |
| `js/sound.js` | 집중 종·자동 효과음 |
| `js/whiteboard.js` | 판서 |
| `js/widgets.js` | 배경·이름 뽑기·소음 측정·신호등 |
| `js/settings.js` | 설정 창 (시간표·명단·소리·초기화) |
| `js/history.js` | 지난 기록 (날짜별·학생별·엑셀 내려받기) |
| `test.html` | 학교 노트북에서 https·마이크·Google 로그인·저장이 되는지 확인하는 시험 페이지 |
| `preview/index.html` | 화면 구성 미리 보기 (실제 저장·로그인 없음) |

## 사용하는 서비스
- **GitHub Pages**: 페이지를 올려 두는 곳 (무료)
- **Firebase** (Google): 선생님 Google 로그인, 시간표·과제 결과 저장 (서울 서버, 무료 요금제)

## 지켜야 할 것
- 공개 저장소예요. **실제 학생 이름·사진은 올리지 않아요.** 실제 명단은 로그인 후 Firebase에만 저장돼요.
- Firebase 웹 설정값은 공개돼도 괜찮지만, 서비스 계정 키 같은 비밀 파일은 절대 올리지 않아요.

## 작업 방식
1. 변경은 `dev` 갈래에 올리고, 검토 요청(Pull Request)으로 확인해요.
2. 선생님이 확인하고 승인하면 `main`에 합쳐 실제 사이트에 반영돼요.
