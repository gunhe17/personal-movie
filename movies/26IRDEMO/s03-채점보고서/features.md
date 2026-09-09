# s03 채점 · 보고서 — 서류는 257분

장면이 약속한 것: `scenes9.html` §03 — 로샤를 엑셀로 채점하고 워드로 옮기고 틀을 복사하던 8시간~이틀이,
**결과 · 소견 · 보고서가 한 곳에 모이는 것**으로 바뀐다.

**배역: 검사 축(무대는 마인드봄).** 박지우의 배터리 3종(HTP · 로샤 · SCT)이 **확정 3/3**이라 종합보고서가 섰다.
(윤도현의 로샤는 s02에서 방금 실시를 *시작*했을 뿐이라 보고서가 나올 수 없다 — CAST.md)

## 화면이 둘이다 — 그래서 테이크도 둘이다

같은 "종합보고서"인데 경로가 다르고, **AI가 진짜인 쪽과 시연인 쪽이 갈린다.**

| | **A 뷰어** `s03_web_draft_*` | **B 편집기** `s03_web_aireview_*` |
|---|---|---|
| 경로 | `/clients/<id>/reports/<reportId>` | `/examinations/<examId>/report?ids=…` |
| 본문 | 서버 `sections[]` | A4 WYSIWYG + `preset-body.ts` 프리셋 |
| AI | **초안 생성 — 서버가 진짜 돈다** | 종합 리뷰 · 구간 리뷰 · 교차분석 |
| 백엔드 | 있다 (상태머신 · 감사추적) | **없다** |

**편집에서 두 테이크를 이어 붙여 "전부 진짜"로 읽히게 만들지 않는다.** action을 나눠 찍은 이유가 그것이다.

---

## 테이크 A — AI 초안 생성 (전부 진짜)

1. 문서를 위에서 훑는다 — 평가 사유(임상가) · 실시 검사 · **검사 결과 3종이 이미 한 문서에** 모여 있다
2. 아래로 오면 **종합 소견과 제언이 비어 있다.** 8시간이 들던 자리
3. `AI 초안 생성` → 무엇을 채우는지 먼저 말한다 — *"비어 있는 섹션(종합 소견·제언 등)에 초안을 채웁니다"*
4. 서버가 링크된 검사 3종의 signals를 읽고 문장을 만든다. **화면을 옮기지 않으므로 빈 칸이 눈앞에서 채워진다**
5. 채워진 문단에 보라색 `AI` 배지. 본문 끝에 *"※ 본 소견은 AI가 생성한 초안이며, 최종 해석은 임상가의 검토·확정이 필요합니다"*
6. 문서가 스스로 밝히는 출처 — `AI 초안 생성: <날짜> · 모델 <버전> · 최종 해석·확정은 임상가 책임(CDSS)`

### 무엇이 진짜인지 (근거)

| | |
|---|---|
| 버튼이 서버를 부른다 | `POST /institutions/{i}/comprehensive-reports/{r}/generate-draft` — `router.py:76-85` · `report-service.ts:31-34` |
| 서버가 실제 검사에서 문장을 만든다 | `facade.py:294-329` — 링크된 검사의 `signals`를 모아 `ComprehensiveDraftInput` 구성. 본문의 "총 22개의 반응"은 **박지우의 로샤에서 온 수치**다 |
| 상태가 실제로 옮겨간다 | `draft → ai_generated`, `ai_model_version`·`ai_generated_at` 기록, 감사 로그에 `changed_keys`까지 — `facade.py:344-360` · `state_machine.py:13-20` |
| **임상가가 쓴 섹션은 AI가 못 건드린다** | `services.py:129-130` — `source=='clinician'`이면 무조건 skip. CDSS 불변식이 코드 한 줄로 서 있다 |
| 빈 섹션만 채운다 | `services.py:132-136` `fill_empty`. 이미 쓴 것을 덮지 않는다 |

### 문서 전체가 백지가 되지는 않는다

AI가 만드는 섹션은 **`종합 소견`과 `제언` 둘뿐이다**(`remote.py:386-394`). 나머지는
임상가 소유이거나(위 불변식) 검사에서 자동 조립된 것(`source='auto'`)이라 애초에 AI의 몫이 아니다.
그래서 이 장면은 "AI가 보고서를 써준다"고 말하지 않는다 — **누가 썼는지가 갈려 있다**고 말한다.

### 알아둘 것 — 화면에 `rule-based-fallback`이 찍힌다

`AI_COMPREHENSIVE_URL`이 없으면 서버가 룰베이스 폴백으로 문장을 조립하고, `model_version`이
`rule-based-fallback`이 된다. CDSS 푸터가 그 값을 **그대로 출력한다**(`+page.svelte:334`).
모델 서버는 저장소 밖의 외부 URL이라 로컬에 없다. 지금 테이크에는 그 글자가 들어 있다 —
회색 작은 글씨지만 정지 이미지로 뽑으면 읽힌다. 본 촬영 전에 모델을 연결하든지, 그 줄을 프레임에서 빼든지 정한다.

### 되돌리기

시드는 이미 초안이 생성된 상태로 온다(`under_review`, 두 섹션 `source='ai'`로 채워짐).
그 화면에서는 버튼을 눌러도 **아무 일도 안 일어난다** — `fill_empty`가 빈 섹션만 채우기 때문이다.

```bash
_scripts/s03-reset.sh          # 두 섹션을 비우고 status를 draft로
```

---

## 테이크 B — AI 종합 리뷰 · 구간 리뷰 (시연용)

1. `AI 종합 리뷰` → **네 단계로 훑는다** — 문서 구조 파악 → 검사 결과 대조 → 서술 일관성 검토 → 표현·문체 점검
2. 결과: **완성도 게이지(55점)** + 검토사항 3건 + 작성 체크리스트
3. `섹션 누락` — Ⅲ 행동 관찰이 비었다 → `초안 작성` → **바뀔 문장을 지면 그대로 미리 보여준다**(삭제선·형광) → `본문에 적용`
   → 지적 카드가 사라지고 점수가 오른다
4. `서술 모순` — 같은 문서에서 *중등도* vs *경미*가 엇갈린다 → `'중등도'로 통일` / `'경미'로 통일` **양방향**
5. **구간 리뷰** — 문장 하나를 마우스로 그으면 그 문장만 본다. 맞춤법 · 표현 개선 · **근거 연결**이 갈려서 나오고,
   `수정 후 미리보기`가 바뀔 곳만 형광으로 보여준 뒤 `1곳 모두 적용`

논지는 "AI가 고쳐준다"가 아니라 **고칠 문장을 먼저 보여주고 임상가가 승인해야 본문이 바뀐다**는 것이다.
CDSS가 문구가 아니라 화면 동작으로 드러나는 자리다.

### ⚠️ 이 화면은 시연용이다 — 반드시 알고 쓴다

| | |
|---|---|
| 지적을 만드는 것 | **정규식 규칙**. 서버 호출 없음 — `overall-review.ts:167-349` |
| 진행 4단계 | **타이머** 520+880+1340+700ms — `overall-review.ts:79-84` |
| 구간 리뷰 | `setTimeout(…, 900)` — `span-review.svelte.ts:58-66` |
| 교차분석 · MMPI-2 · TCI · S-척도 자료 | **전량 하드코딩** — `mock-longitudinal.ts` · `mock-materials.ts` |
| 코드가 스스로 밝힌다 | `overall-review.ts:3-5` — *"시연용 목업. 실기능 전환 시 analyzeOverall()을 POST /api/report/review 호출로 교체"*. 그 엔드포인트는 백엔드에 없다 |
| 저장 | **안 된다.** `comprehensive_reports`를 건드리지 않고 상태도 안 바뀐다 |

**그리고 화면의 본문은 박지우의 실제 기록이 아니다.** A4 지면은 `preset-body.ts` 프리셋이고,
`실시한 검사`에 **TCI · MMPI-2 · S-척도**가 올라 있다 — 박지우에게 실시된 적 없는 검사 셋이다.
AI 리뷰가 잡아내는 결함(Ⅲ 공란 · '되어진'·'환자' · '중등도' vs '경미')도 시연용으로 **일부러 심어 둔 것**이다
(`preset-body.ts:47-50, 85-87, 92-95`). *"기능은 전부 현재 코드에서 확인한 것만"*이라는 scenes9 원칙과
정면으로 부딪히므로, 이 테이크를 IR 영상에 쓸지는 **연출이 아니라 사실 판단으로 정해야 한다.**

---

## 촬영

| | A (draft) | B (aireview) |
|---|---|---|
| 조작 | `_scripts/s03-draft.mjs` | `_scripts/s03-review.mjs` |
| 시작 | `/clients/<clientId>/reports/<reportId>` | `/examinations/<examId>/report?ids=<3종>` |
| 전제 | `_scripts/s03-reset.sh` — 두 섹션을 비운다 | 없음(저장이 없어 되돌릴 것도 없다). 재촬영은 **새로고침**이 전제 — 본문을 고치면 지적이 사라진다 |
| 리허설 | 24단계 18.4초 · 오류 0 | 27단계 27.4초 · 오류 0 |

id는 시드마다 바뀐다. 스크립트에는 id가 없다 — 그때마다 DB에서 뽑는다.

```bash
docker exec mindbom-postgres psql -U mindbom -d mindbom -c \
  "select cr.client_id, cr.id report_id, cr.status from comprehensive_reports cr
     join clients c on c.id=cr.client_id where c.name='박지우';"
docker exec mindbom-postgres psql -U mindbom -d mindbom -c \
  "select examination_id from comprehensive_report_examinations where report_id='<report_id>';"
```

### 셀렉터 함정 (실측)

- **`초안 생성`은 `AI 초안 생성`의 부분 문자열이다.** `button:has-text("초안 생성")`은 모달 뒤의 헤더 버튼을
  누르고 **아무 일도 안 나며 오류도 없다**. 실제로 한 번 이렇게 빈손으로 끝났다 —
  `getByRole('button', {name:'초안 생성', exact:true})`
- `AI 종합 리뷰`는 화면에 셋이다(툴바 버튼 · `aside` aria-label · `h3`). `getByRole('button', …)`이면 하나로 좁혀진다
- `생성 중...`은 AI 초안 버튼과 PDF 버튼이 함께 쓴다
- 구간 리뷰는 **진짜 드래그여야 열린다** — Range API로 선택하면 mouseup이 없어 버튼이 안 뜬다. `h.selectText()`가 마우스로 긋는다
- 헤더는 `shrink-0`이고 본문만 스크롤한다 — 버튼을 누르려고 화면이 움직이지 않는다. 빈 칸이 눈앞에서 채워지는 그림이 여기서 나온다

## 제품에서 발견한 것

없다. 제품 코드는 건드리지 않았다.
