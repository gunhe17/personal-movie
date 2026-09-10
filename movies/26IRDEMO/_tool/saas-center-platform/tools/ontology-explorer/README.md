# 온톨로지 Explorer (Vite + Svelte 5)

온톨로지 모델의 **검증·증명·유지 도구**. `public/data/`가 정본이고 앱은 렌더만 한다.
레이아웃 자체가 모델을 말한다: 전역 밴드(자연인·외부 기관) / 경계 스트립(선택적 연결) / **테넌트 컨테이너 박스**(기관 안의 기록 — 포함관계가 곧 center_id 격리).

## 실행
```bash
cd tools/ontology-explorer
pnpm install --ignore-workspace
pnpm dev                # http://localhost:3510 (API CORS 허용 오리진)
# API 콘솔 쓰려면: pnpm db:up && cd apps/api && uv run uvicorn app.main:app --port 3502
# 로그인: manager@test.com / test1234
```

`localhost:3502/ontology-explorer`는 여기로 리다이렉트된다 — 서버가 직접 뿌리던 HTML 콘솔은
이 앱의 API 콘솔에 흡수됐다(탐색기는 하나뿐).

## API 콘솔 — 온톨로지 표면만 부른다
`/api/v1/ontology/centers/{center_id}/{concept}`만 호출한다(도메인 CRUD 표면 아님).

- **개념·필터 목록은 손으로 안 적는다** — `/api-map`이 라우터에서 뽑아 준다. 서버에 개념이나
  필터가 늘면 이 화면은 코드 수정 없이 따라간다.
- **봉투가 곧 그래프** — `rows`는 노드, 행이 든 참조가 엣지. `{ref}_id`는 실선(id 있는 관계),
  `{ref}_names`는 점선(이름만 온 다홉 투영). 같은 id로 온 참조는 한 노드로 합쳐지므로
  "여러 회기가 한 케이스로 모인다"가 그림에 나온다.
- **catalog에 없는 개념은 점선 테두리 + '미등재'** — 지금 `sessions`·`counseling_case`·`schedule`이
  그렇다. 어휘가 어긋난 자리를 감추지 않는다(모델 정본은 `public/data/catalog.json`).
- `aggregate.count`는 탭 옆 배지로, `exact:false`면 '하한'으로 표시한다.

## 데이터 (public/data/ — 전부 편집 가능, 코드 수정 없이 반영)
- `catalog.json` — 개념·layer(밴드 배치)·관계(방향·카디널리티·필수 여부)·결정 링크
- `attributes.json` — **속성 수준 바인딩**: 온톨로지 속성 ↔ 실제 컬럼(타입·nullable), 상태 수명주기, 카디널리티 근거, 행이 태어나는 경로 (에이전트 실측)
- `decisions.json` — 공리 A1~A7·결정 D1~D8 요지
- `profiles/*.json` — 기관 프로필 (A5의 실물 — SaaS 런타임/납품 빌드 주입 대상). 드래프트 에디터의 내보내기를 여기 넣으면 정식 등장
- `bindings.json` — 개념→테이블 상태(bound/partial/missing)·제약·갭
- `audit.json` — 화면 위반 실측 36건. 재스캔: `pnpm audit` (상한 스캔)

## 읽는 법 (모델이 직관적으로 보이는 장치)
- **밴드·컨테이너**: 위=전역, 아래=기관 안. 상자를 뚫는 엣지 = 경계를 넘는 관계(⛓)
- **노드 카드**: 제목=현재 프로필 어휘(전환 시 morph), 부제=중립명(불변 앵커), 3색 미니바=속성 3분류(코어/역할기록/가변), 배지=바인딩 상태, 칩=결정 근거
- **유령 카드(점선)**: 이 프로필에 없는 개념 — 번역이 아니라 소멸(A3). 클릭=근거
- **엣지**: 실선=필수, 점선=선택, 화살표=방향, 끝 숫자=카디널리티
