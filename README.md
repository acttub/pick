# pick.acttub.com — 명대사 월드컵

연기해보고 싶은 장면만 남기는 16강 토너먼트. 마지막에 남은 한 장면이 품은 질문을 돌려준다.

판정하지 않는다 — 점수도, 유형도, 어울리는 역할도 없다. 고른 것을 되비추고 질문을 건넬 뿐이다.

## 돌려보기

```bash
npm install
npm run css            # styles.css 생성
uv run --with "fonttools[woff]" python build-fonts.py   # fonts/ 생성
npm run serve          # http://localhost:8643
```

`file://`로 열면 안 된다 — 경로 라우팅과 `/styles.css` 같은 절대 경로가 풀리지 않는다.
`python3 -m http.server`로도 안 된다 — `/r16`·`/with/3`은 파일이 아니라서 404가 난다.
`serve.py`가 `vercel.json`의 rewrites를 흉내내므로 그걸 쓴다.

## 구조

```
index.html      화면 골격 (문장 없음)
copy.js         사용자에게 보이는 모든 문장
data.js         장면 16개
app.js          화면 전환·토너먼트·공유
src/input.css   Tailwind 입력 + @font-face + 이 앱만의 컴포넌트
src/brand/      브랜드 정본 사본 — 직접 고치지 않는다 (토큰·티어 셸·기기 하드닝)
design/         Pen 캔버스 (.pen) — 화면 목업
styles.css      생성물 — 직접 고치지 않는다
fonts/          생성물 — 쓰인 글자만 담은 Pretendard woff2 3굵기
vercel.json     경로 → index.html (catch-all을 쓰지 않는다)
```

## 고칠 때 잊기 쉬운 것

| 무엇을 고쳤나 | 다시 돌릴 것 |
|---|---|
| `src/input.css` 또는 마크업 클래스 | `npm run css` |
| **문구(`copy.js`·`data.js`·`index.html`)** | `build-fonts.py` — 안 돌리면 새 글자가 시스템 폰트로 렌더된다 |
| 경로를 추가 | `vercel.json`의 `rewrites` |
| 화면 구조·여백 | `uv run tools/device-matrix.py subpro/pick` (볼트에서) — 20기기 통과가 배포 조건 |

`styles.css`와 `fonts/`는 **커밋된 생성물**이다. Vercel에 빌드 단계가 없어서, 빌드를 잊으면 옛것이 배포된다.

## 경로가 여러 개인 이유

Vercel Hobby 요금제는 페이지뷰만 세고 커스텀 이벤트를 못 센다. 그래서 토너먼트 단계를 경로로 만들어
`/r16` → `/r8` → `/r4` → `/final` → `/result/*` 페이지뷰로 이탈률과 결과 분포를 센다.

그래서 **`vercel.json`에 catch-all 폴백을 두지 않는다.** 폴백이 `/_vercel/insights/*`까지 삼키면
계측 스크립트가 404가 되고 숫자가 조용히 사라진다. 경로를 하나씩 적어 둔 것은 그 사고를 막으려는 것이다.

진행 상태는 보관하지 않는다. 대결 중 새로고침·뒤로가기는 시작 화면으로 되돌아간다 — 15번 선택은
다시 하면 되는 비용이고, 상태 직렬화는 이 규모에 과하다.

### 알려진 대가 — 뒤로가기를 여러 번 눌러야 사이트를 벗어난다

한 판을 끝내면 히스토리에 5개(`/r16` `/r8` `/r4` `/final` `/result/*`)가 쌓인다. 결과 화면에서
뒤로가기를 누르면 시작 화면이 나오지만, 사이트를 완전히 벗어나려면 그만큼 더 눌러야 한다.

`replaceState`로 바꾸면 히스토리가 얕아지지만 **그러면 단계가 세어지지 않는다.** 배포된
`/_vercel/insights/script.js`를 실제로 받아 확인한 결과 그 스크립트는 **`pushState`만 가로채고
`replaceState`는 보지 않는다**(`popstate`는 듣는다). 즉 이 깊이는 계측을 얻는 값이다.
Pro 요금제로 올려 커스텀 이벤트를 쓰게 되면 이 구조를 되돌릴 수 있다.
