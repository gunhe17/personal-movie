# s03 채점 · 보고서 — 서류는 257분

장면이 약속한 것: `scenes9.html` §03 — 로샤를 엑셀로 채점하고 워드로 옮기고 틀을 복사하던 8시간~이틀이,
**결과 · 소견 · 보고서가 한 곳에 모이는 것**으로 바뀐다.

**배역: 검사 축 — 윤도현(2014-05-08 · 만 12세 · 남).** 무대는 마인드봄(4503).
배터리 `battery-yundohyun`(로샤 · HTP · SCT)이 **확정 3/3**이라 종합보고서가 선다.
2026-09-10에 박지우(만 35세)에서 옮겼다 — 마인드봄 SCT가 아동·청소년 문항("여자애들은", "나의 학교생활은")이라
성인 대상이 애초에 어긋나 있었고, 영상의 검사 축을 s01→s02→s03→s04 **한 사람**으로 잇기 위해서다.

## 선택본은 하나다 — `aireview`

예전에는 테이크가 둘이었다(A `draft` = AI 초안 생성 · B `aireview` = 종합 리뷰).
**지금 찍는 것은 `aireview` 하나다.** `draft`는 다시 찍지 않는다(CUT.md의 본편 제외를 뒤집은 결정).

| | **선택본 `aireview`** | (안 찍음) `draft` |
|---|---|---|
| 경로 | `/examinations/<examId>/report?ids=…` | `/clients/<id>/reports/<reportId>` |
| 본문 | A4 WYSIWYG + `preset-body.ts` 프리셋 | 서버 `sections[]` |
| AI | 종합 리뷰 · 구간 리뷰 (규칙 기반 시연) | 초안 생성 — 서버가 진짜 돈다 |
| 백엔드 | 없다 | 있다 (상태머신 · 감사추적) |

**화면의 "개발 예정" 라벨은 편집에서 사용자가 직접 넣는다.** 제품에도 스크립트에도 라벨을 넣지 않았다.

---

## 조작 — AI 리뷰 → 자료 드래그 앤 드롭 → 지적 하나 승인 (2026-09-10 저녁 재구성)

1. `AI 종합 리뷰` → **네 단계로 훑는다** — 문서 구조 파악 → 검사 결과 대조 → 서술 일관성 검토 → 표현·문체 점검
2. 결과: **완성도 55점** + **검토사항 3건**(주요 2건) + 작성 체크리스트
3. **드래그 앤 드롭** — 사이드바 `SCT · 영역별 점수 요약`을 집어 본문 `4) 자기개념` 아래 빈 문단에 놓는다.
   놓은 자리에 표(6행)가 앉고 사이드바 그 자료에 `첨부됨`이 붙는다. **실기능** — 아래 §드래그 앤 드롭
4. `섹션 누락` — Ⅲ 행동 관찰이 비었다 → `초안 작성` → **바뀔 문장을 지면 그대로 미리 보여준다** → `본문에 적용`
5. 끝나면 **77점 · 검토사항 2건**

빠진 것(패널에 지적은 남는다): 서술 모순 양방향 통일 · 구간 리뷰(문장 긋기) · 표현 교정 3건.

논지는 "AI가 고쳐준다"가 아니라 **고칠 문장을 먼저 보여주고 임상가가 승인해야 본문이 바뀐다**는 것이다.
CDSS가 문구가 아니라 화면 동작으로 드러나는 자리다. 패널 바닥에도 그렇게 적혀 있다 —
*"본 검토 결과는 작성 보조를 위한 참고 정보입니다. 최종 판단과 수정 여부는 임상가가 결정합니다."*

### 드래그 앤 드롭 — 제품 사본에 추가한 것 (2026-09-10)

제품에는 클릭 삽입만 있었다("자료를 누르면 본문 커서 위치에 첨부됩니다"). 사용자가 끌어다 놓는 흐름을 원해 `_tool/mindbom`에 넣었다.
클릭 삽입과 **같은 경로**(`insertMaterial` → `insertTable`/`insertImage`)를 타고, 드롭 좌표에 커서를 놓는 것만 다르다.

| 파일 | 무엇 |
|---|---|
| `PaginatedEditor.svelte` `placeCaretAtPoint(x,y)` | `caretRangeFromPoint`로 드롭 좌표를 모델 pos로 바꿔 `lastCaret`·selection에 놓는다 |
| `MaterialsPanel.svelte` | 미첨부 자료 버튼 `draggable` + `ondragstart` → `onAssetDragStart(g,a)` |
| `ReportSidebar.svelte` | prop 통과 |
| `report/+page.svelte` | `dragging` 상태 · `<main ondragover ondrop>` → `placeCaretAtPoint` → `service.insertMaterial` |
| `capture-service/scripts/human.mjs` `h.drag(from, {sel,fx,fy})` | mousedown → 12px 이동(dragstart) → 대상까지 이동 → mouseup. Chromium이 HTML5 DnD 이벤트를 실제로 낸다 |

빈 문단(offset 0)에 놓으면 표가 그 빈 문단 **뒤**에 들어가고 빈 문단이 표 앞뒤로 남는다 — 지면에서는 표 위아래 한 줄 여백이라 오히려 낫다.

### 실측 — 리뷰가 실제로 무엇을 잡는가 (2026-09-10, DOM에서 읽음)

시작: **완성도 55점 · 1,371자 · 섹션 5개 · 검사 3/3 반영 · 검토사항 3건(주요 2건)**

| # | 심각도 | 지적 | 심어둔 결함 |
|---|---|---|---|
| 1 | high | `Ⅲ. 행동 관찰이(가) 비어 있습니다` → 수정안 `초안 작성` | ⓐ `preset-body.ts` Ⅲ 공란 |
| 2 | high | `우울 수준 서술이 문서 내에서 일치하지 않습니다` — 앞은 '중등도', 뒤는 '경미' → 양방향 통일 | ⓑ Ⅳ-2 `중등도` vs Ⅴ `경미한` |
| 3 | medium | `표현 교정 제안 3건` — 가장 많은 곳은 "5) 대인 지각 —" 문단(3건) | ⓒ `되어진` · `환자` · `매우` |

끝: **100점 · 1,555자 · 검토사항 1건**(구간 리뷰가 안 건드린 표현 교정 잔여 1건).
**55 → 100으로 오르고 3건 → 1건으로 준다** — 점수가 오르는 그림이 화면에 실제로 있다.

`Ⅱ. 실시한 검사 서술이 짧습니다`(60자 미만 규칙, `overall-review.ts:205`)는 **더 이상 뜨지 않는다.**
프리셋의 불릿 셋에 실시 방식 구절을 붙여 53자 → 105자가 됐다(`preset-body.ts:44-52`). 사용자 결정이다.

### 유령 지적은 사라졌다 (확인함)

규칙 2("배터리에 있는데 본문에 안 나오는 검사")가 보는 배터리를 `origin:'real'` 셋으로 좁혔다
(`overall-review.svelte.ts` `REVIEWED_EXAMS`). 실측 결과 **`검사 3/3 반영`**이고
`MMPI-2 결과가 본문에 언급되지 않았습니다` 류의 지적은 **뜨지 않는다.**

### 사이드바 `검사자료` — 윤도현의 실검사 3종만 (확인함)

`report-data.svelte.ts`에서 `MOCK_MATERIALS` 전개를 걷어냈다. DOM 실측:

```
로샤 · 로르샤하 · 2026-09-10   → 핵심(Core) 16 · 정서 7 · 대인관계 10 · 사고 9 · 인지적 중재 7 ·
                                 정보처리 7 · 자기지각 7 · S-CON 12 · DEPI 7 · CDI 5 · PTI 5 · HVI 8 · OBS 9
HTP  · 집-나무-사람 · 2026-09-10 → 집/나무/남자사람/여자사람.png · 해석 자기개념 4 · 정서적 안정성 6 · 대인관계 4
SCT  · 문장완성 · 2026-09-10     → 영역별 점수 요약 5 · 응답 5영역(9·8·8·8·7)
바닥: 윤도현 · 9DD1D1 · 만 12세 · 남
```

**TCI · MMPI-2 · S-척도는 없다.** 지면 머리글도 `심리평가 보고서 / 윤도현 (9DD1D1) / 등록일 2026-09-10`이다.
HTP 그림 넷은 실제로 로드된다(`naturalWidth 1050` 실측 — 아래 §스토리지).
표 자료의 썸네일은 `chart-svg.ts`의 `table` 변형이 그리는데, 로딩 뼈대처럼 보이던 것을 채점표 모양으로 고쳤다.

### `rule-based-fallback`은 이 화면에 **안 나온다**

그 글자는 `report.ai_model_version`을 출력하는 **draft 뷰어의 CDSS 푸터** 한 곳뿐이다 —
`routes/(protected)/clients/[id]/reports/[reportId]/+page.svelte:334`.
편집기(`/examinations/…/report`)에는 그 줄이 없다(`grep model_version` 결과 web 소스에서 유일한 출력 지점).
**선택본이 aireview 하나가 되면서 CUT.md §5 ①(모델명 결정)은 이번 편에서 해소된다.**

---

## ⚠️ 이 화면은 시연용이다 — 반드시 알고 쓴다

| | |
|---|---|
| 지적을 만드는 것 | **정규식 규칙**. 서버 호출 없음 — `overall-review.ts:167-349` |
| 진행 4단계 | **타이머** 520+880+1340+700ms — `overall-review.ts:79-84` |
| 구간 리뷰 | `setTimeout(…, 900)` — `span-review.svelte.ts:58-66` |
| 본문 Ⅰ~Ⅴ | `preset-body.ts` 프리셋. 서버 `sections[]`가 아니다 |
| 교차분석 탭 | **전량 하드코딩** — `mock-longitudinal.ts`. 탭을 열면 `검사 6`(실검사 3 + 목업 MMPI-2·TCI·S-척도 3)이 뜬다. **스크립트는 이 탭을 열지 않는다** |
| 코드가 스스로 밝힌다 | `overall-review.svelte.ts` 머리주석 — *"시연용: analyzeOverall()이 규칙 매칭 목업"* |
| 저장 | **안 된다.** `comprehensive_reports`를 건드리지 않고 상태도 안 바뀐다 → 되돌릴 것이 없다 |

본문에 심어둔 결함 셋은 **일부러 남긴 것**이다(`preset-body.ts` 주석). 지우면 리뷰 시연이 빈손이 된다.

---

## 촬영

| | |
|---|---|
| 조작 | `_scripts/s03-review.mjs` |
| 시작 URL | `/examinations/<yun-rorschach>/report?ids=<로샤>,<HTP>,<SCT>` |
| 전제 | 마인드봄 재시드 뒤 배터리 3종이 `confirmed`. 저장이 없어 되돌릴 것은 없다 |
| 재촬영 | **새로고침이 전제** — 본문을 고치면 지적이 사라진다 |
| 리허설 | **17단계 17.5초 · 종료 코드 0 · 오류 0** (2026-09-10 저녁, 재구성 흐름, 재시드 뒤) |

### 시작 URL은 재시드마다 바뀐다 — 이 한 줄로 뽑는다

```bash
PGPASSWORD=mindbom_dev psql -h localhost -p 4501 -U mindbom -d mindbom -At -c "
select 'http://localhost:4503/examinations/'
  || max(case when e.note='seed:yun-rorschach' then e.id::text end)
  || '/report?ids='
  || string_agg(e.id::text, ',' order by array_position(
       array['seed:yun-rorschach','seed:battery-htp','seed:battery-sct'], e.note))
from examinations e
where e.note in ('seed:yun-rorschach','seed:battery-htp','seed:battery-sct')
  and e.deleted_at is null;"
```

`?ids=`의 순서가 **본문·사이드바의 순서**다(로샤 → HTP → SCT). 경로의 `examId`는 표지·서명의 대표 검사다.

### 스토리지 — HTP 그림이 보이려면

`app/core/config.py:50`의 `STORAGE_BACKEND` 기본값이 `"s3"`다. `apps/api/.env`에 **`STORAGE_BACKEND=local`이 없으면**
파일이 `/tmp/mindbom-storage/`에 정상적으로 있는데도 API가 빈 버킷 이름으로 S3를 불러
`botocore ParamValidationError` → `GET /api/v1/storage/htp/<examId>/*.png`가 **500**이고,
사이드바 HTP 썸네일 넷이 빈 칸(alt `집.png` …)으로 남는다. 2026-09-10에 `.env`에 그 줄을 넣고 API를 재기동해 해소했다.
**API에 reload가 없으므로 `.env`를 고치면 재기동해야 한다.**

### 셀렉터 함정 (실측)

- `AI 종합 리뷰`는 화면에 셋이다(툴바 버튼 · `aside` aria-label · `h3`). `getByRole('button', …)`이면 하나로 좁혀진다
- 구간 리뷰는 **진짜 드래그여야 열린다** — Range API로 선택하면 mouseup이 없어 버튼이 안 뜬다. `h.selectText()`가 마우스로 긋는다
- `.para:has-text("해석되어진")` — 새 본문에서도 그 표현은 Ⅳ-5) 한 곳뿐이다(마지막 문단의 `해석되어야`와 안 겹친다). 스크립트 수정 불필요했다
- 헤더는 `shrink-0`이고 본문만 스크롤한다

## 제품에서 발견한 것

`STORAGE_BACKEND` 기본값 문제(위 §스토리지) 하나. `.env` 한 줄과 재기동으로 해소했고 제품 코드는 안 고쳤다.
