# 검사 모듈 전수 점검

> 작성: 2026-08-13
> 관점 3가지: **준동형(두 세계 일치)** · **아키텍처 확장성** · **임상 프로세스 타당도**
> 기준 문서: `docs/plan-exam-module-architecture.md`

---

## 0. 총평

**플랜의 1~5단계는 실제로 완주됐다.** 라우트가 `[examId]/(exam)/[step]` 한 벌로 통합됐고,
`ExamLayoutShell`·`exam-context`·`registry`가 실재하며, `gate.spec.ts`·`extensibility.spec.ts`가
불변식을 잠가 놓았다. `status`(워크플로) / `progress`(진행) 2축 분리는 플랜보다 개선된 부분이다
— 플랜의 `enabled?: (s: ExamStatus)`가 구현에서는 `(gate: ExamGate)`로 바뀌었다.

**봉인된 것은 "진행 화면 안쪽"이다.** 목록·상세·리포트·타입 시스템·백엔드는 여전히
검사 이름을 안다. "모듈 파일 하나만 추가"라는 목표 대비 실제로는 11곳 이상을 손대야 한다.

가장 시급한 것은 확장성이 아니라 **P0의 데이터 무결성**이다. SaMD 요구사항과 직접 충돌한다.

---

## P0 — 데이터 무결성 (SaMD 직결, 즉시)

### P0-1. 확정된 검사를 계속 수정할 수 있다 (HTP·SCT)

같은 사실("확정됐다")을 세 검사가 다르게 취급한다. 에러는 나지 않는다.

| | collect 재진입 | 편집 차단 | 읽기전용 표시 |
|---|---|---|---|
| 로르샤하 | 잠김 (`module.ts:36-38`) | `isReadOnly` (`Review.svelte:284-289`) | 헤더 부제 안내 |
| **SCT** | **항상 열림** | **없음** | 없음 |
| **HTP** | **항상 열림** | **없음** | 없음 |

실제 값으로 확인:

```
확정 후   HTP    열린단계:[collect,results]        collect재진입:가능
         SCT    열린단계:[collect,review,results] collect재진입:가능
         로르샤하 열린단계:[review,results]         collect재진입:차단
```

구체 지점:

- `sct/steps/Results.svelte:43-49` — `handleScoreEdit`가 status를 보지 않는다.
  확정 후에도 점수 셀 클릭 → 서버 반영.
  → **이미 발행한 PDF와 화면 숫자가 달라진다.**
- `sct/steps/Review.svelte:92-109` — `handleResponseEdit`도 확정 여부 무관.
  PUT이 목록 통째 교체라 확정된 검사의 원본 응답을 덮어쓴다.
  → **응답과 채점이 서로 다른 이야기를 한다.**
- `htp/steps/Collect.svelte:190-239` — `handleRemoveResult`·`saveAnalysis` 자동저장이 확정 후에도 동작.
  → **확정된 HTP의 분석 항목을 지워도 결과 화면 해석문은 그대로 남는다.**

읽기전용 컴포넌트 지원 현황도 갈린다 — HTP `RightPanel`/`InterpretationTable`,
SCT `ResponseReviewTable`/`DomainScoreTable` 모두 읽기전용 모드가 **없다.**
(SCT `ResponseReviewTable`은 `onResponseChange` 미전달 시 읽기전용으로 떨어지는 경로가
구현돼 있으나 호출부가 항상 핸들러를 넘겨 **연결되지 않은 상태**다.)

**조치**: `collect`에 `enabled: (g) => !isConfirmed(g.status)` 추가 + 편집 핸들러에 확정 가드 +
읽기전용 모드 배선. 로르샤하 패턴을 기준으로 삼는다.

### P0-2. `completed` SCT를 열면 "검사 확정" 버튼이 다시 뜬다

`sct/steps/Results.svelte:78-82`가 `canDownloadReport`를 인라인 재구현하고,
그 값을 `isExamCompleted`로 **재사용**한다. `completed`가 빠져 있다.

```
confirmed          PDF버튼:O  → 푸터:보고서 PDF   헤더:목록으로
report_generated   PDF버튼:O  → 푸터:보고서 PDF   헤더:목록으로
completed          PDF버튼:X  → 푸터:검사 확정    헤더:검사 중단(빨강)   ← 다 끝난 검사인데
```

`core/status.ts:36`에 같은 이름의 함수가 있는데 쓰지 않는다.
(정의는 우연히 같지만 `isExamCompleted`로 재사용한 것이 오류의 원인)

**조치**: `core/status.ts`의 `canDownloadReport`·`isConfirmed`를 import해서 쓴다.
"완료됨"과 "PDF 받을 수 있음"은 다른 개념이므로 분리한다.

---

## P1 — 서버 상태와 화면이 어긋난다

### P1-1. HTP는 `refreshExam()`을 한 번도 부르지 않는다

호출 횟수 실측:

```
sct/steps/Collect.svelte        2
htp/steps/Collect.svelte        0   ←
htp/steps/Results.svelte        0   ←
rorschach/steps/Collect.svelte  0   ←
```

- `htp/steps/Collect.svelte:120-131` — AI 분석 완료 후 `ds.examStatus`(로컬 미러)만 갱신.
  `progress.has_result`가 true가 됐는데 컨텍스트는 모른다.
  → **분석이 방금 끝났는데 "결과 보기" 버튼이 비활성이고,
  툴팁은 "AI 분석이 끝난 뒤 결과를 볼 수 있습니다"라고 말한다.**
- `htp/steps/Results.svelte:219-248` — `patchStatus`가 로컬만 갱신.
  → '확인 완료'를 누르면 푸터는 바뀌는데 사이드바 배지와 이탈 버튼 기준은 옛 상태. 새로고침해야 맞는다.
- `rorschach/steps/Collect.svelte:296-352` — `completeSession` 후 refresh 없이 `goto(.../review)`.
  review의 `enabled`는 `progress.collect_done`인데 컨텍스트는 아직 false.
  → **'채점하기'를 눌렀는데 "반응 영역 기록을 먼저 완료해주세요"가 뜨며 방금 완료한 화면으로 되돌아간다.**

**조치**: 서버 상태를 바꾸는 모든 액션 뒤에 `await layoutCtx.refreshExam()`.
SCT Collect(`:156`)가 이미 올바른 패턴이다.

### P1-2. SCT는 "확정됐나"를 제3의 소스에서 읽는다

- 푸터 버튼 → `resultsQuery.data.status` (SCT 결과 API)
- 사이드바·이탈 버튼 → `layoutCtx.exam.status` (검사 상세 API)
- `handleComplete`는 `refreshExam()`만 부르고, `sct-service.ts:45-50`의 `invalidateResults()`는
  **await되지 않는다**(반환 Promise를 버림).

→ **확정 직후 사이드바는 '완료'인데 푸터는 '검사 확정' 그대로 → 한 번 더 누른다.**

### P1-3. 상세 화면의 '결과 보기'가 모듈 게이트를 우회한다

- `(detail)/+page.svelte:227-234` — 검사 종류 무관하게 `/results`로 하드코딩 goto.
- 같은 파일 `:243-245` — `canViewResults`는 status 축(`confirmed` 이상).
  그런데 HTP·SCT 모듈은 `has_result`(progress 축)로 연다.

→ ① HTP/SCT가 `ai_draft_ready`일 때 상세엔 버튼이 **안 보이는데** 사이드바엔 결과 단계가 열려 있다.
→ ② 로르샤하는 버튼을 눌러도 progress가 null이면 채점 화면으로 튕긴다.

**조치**: `examProgressPath(examId, type, {status, progress})`를 쓴다. 이미 그 용도로 존재한다.

---

## P2 — 임상 프로세스 타당도

### P2-1. 절차와 단계가 어긋난 곳

| 검사 | 표준 실시 절차 | 우리 구성 | 차이 |
|---|---|---|---|
| HTP | 그림 → **사후질문(PDI)** → 해석 | collect(업로드+PDI 섞임) → results | PDI가 별도 절차인데 업로드 화면에 섞임 |
| 로르샤하 | 자유반응 → **질문** → 채점 → 구조요약 | collect(녹음+영역) → review → results | 자유반응·질문이 합쳐짐 |
| SCT | 문장완성 → 채점 → 해석 | collect → review → results | **일치** (2026-08-13 분리) |

로르샤하 건은 **임상심리사가 직접 제기**했다. 상세는 `docs/rorschach-ux-redesign.md`.

### P2-2. HTP만 검토 단계가 없다 — CDSS 원칙과 충돌

| | 수집 | **검토** | 결과 |
|---|---|---|---|
| HTP | collect | **없음 — results에 섞임** | results |
| SCT | collect | review | results |
| 로르샤하 | collect | review | results |

`htp/steps/Results.svelte:231` — `ai_draft_ready → under_review → confirmed` 전이를
결과 화면의 '확인 완료' 버튼이 처리한다.

CDSS 원칙("AI 초안 → 임상가 검토 → 확정")에서 **검토는 독립 단계여야 한다.**
결과 열람과 검토가 한 화면이면 "봤다"와 "검토했다"가 구분되지 않는다 — 감사추적 관점에서도 약하다.

### P2-3. 확정 동작에 조회 이름이 붙어 있다

`rorschach/components/coding/CodingFooter.svelte:29-32` — 라벨은 항상 '결과 보기'인데,
`isReadOnly`가 아니면 `onConfirm`이 확정 모달을 띄우고 status를 바꾼다(`Review.svelte:435-464`).

→ **"결과를 보려고" 눌렀는데 "확정 후에는 수정할 수 없습니다" 모달이 뜬다.**
되돌릴 수 없는 동작에 조회 동작의 이름이 붙었다.

(`nextLabel`의 `isReadOnly ? '결과 보기' : '결과 보기'` 삼항은 두 갈래가 같은 값 —
원래 다른 라벨을 의도했던 흔적이다.)

### P2-4. 완료된 검사를 목록에서 열면 경고가 뜬다

`examinations/+page.svelte:191`이 progress 없이 `examProgressPath`를 호출 → 항상 첫 단계.
확정된 로르샤하는 collect가 잠겨 있어 되돌려지면서
**"반응 영역 기록은 완료되어 수정할 수 없습니다" 스낵바**가 뜬다. 열었을 뿐인데.

---

## P3 — 확장성 (새 검사를 붙일 때)

### P3-1. `ExamType` 유니온이 3종 하드코딩이고 사본이 있다

- `common/constants.ts:5` — `'htp' | 'rorschach' | 'sct'`
- `lib/stores/exam.store.ts:4` — **완전히 같은 유니온의 두 번째 정의.** `ExamStatus`도 복제.
- `registry.ts:14` — `Record<ExamType, ExamModule>`가 exhaustive

증상: `core/extensibility.spec.ts:22`가 가상 MMPI-2 모듈을 선언하면서 `type: 'htp'`로 두고
`// 타입 유니온은 아직 3종 고정`이라 주석을 달았다. **확장성 테스트가 스스로 확장 불가를 증언한다.**

`isSupportedExamType()`은 이미 런타임 키 조회다 — 타입만 발목을 잡는다.

### P3-2. 검사 이름이 5곳에 3가지 표기로 존재한다

```
exam-visual.ts:14        '로샤'
constants.ts:25          '로르샤하'
rorschach/module.ts:27   '로샤 검사'
ExamCreateModal:185      '로르샤하'
examinations/+page:64    '로샤'
```

`EXAM_TYPE_LABELS`(constants.ts:23-27)와 `EXAM_TYPE_VISUAL.label`(exam-visual.ts)이
같은 정보를 담고 값이 다르다. **같은 사실을 다섯 곳이 각자 답하는데 아무도 에러를 안 낸다.**

### P3-3. 모듈의 `title`/`subtitle`을 아무도 안 쓴다

8개 step 컴포넌트가 전부 리터럴로 다시 적는다:

```
rorschach/steps/Collect.svelte:356   examTitle="로샤 검사"
htp/steps/Collect.svelte:243         examTitle="HTP 검사"
... (총 8곳)
```

`layoutCtx.module.title`을 쓰는 곳은 `exam-context.svelte.ts:96`의 에러 메시지 하나뿐이다.
모듈 선언과 화면이 어긋나도 아무도 모른다.

### P3-4. 검사별 지식이 모듈 밖으로 샌다

| 위치 | 내용 |
|---|---|
| `(detail)/+page.svelte:149,152,160` | PDF 다운로드가 `exam_type` if-체인. **모듈에 `downloadReport` 훅이 없다** |
| `report/+page.svelte:856-860` | 리포트 자산 로딩 if-체인. `loadHtpAssets` 등이 리포트 페이지 안에 산다 |
| `report/+page.svelte:831-847` | `ROR_CLUSTER_LABEL` 등 로르샤하 도메인 어휘가 리포트 페이지에 박혀 있다 |
| `examinations/+page.svelte:185` | `isSupportedExamType()`이 있는데 리터럴 배열로 재구현 |
| `ExamTypeIcon.svelte:15,31,51` | if-체인. 아이콘은 모듈이 선언해야 할 것 |
| `ExamCreateModal.svelte:184-186` | 생성 가능 검사 목록 하드코딩 |

### P3-5. `scoringMode`는 아무도 안 읽는 죽은 필드

소비처 grep 결과 **0곳**. 값 세팅만 3곳(전부 `'ai'`), 테스트가 `'auto'`로 세팅하지만
어떤 단언도 이 필드를 검사하지 않는다.

플랜 §7 Q2는 "분류가 아니라 상태 경로를 결정하는 **동작**"이라 정당화했는데,
`core/status.ts:1-11` 주석은 정반대를 말한다 — *"채점 방식과 무관하게 같은 경로를 쓴다."*

**둘 중 하나가 거짓이다.** 현 코드 기준으로는 status.ts가 맞다.

### P3-6. `ExamProgress` 두 불리언이 C군에서 무너진다

`{collect_done, collected_count, collect_total, has_result}` — 소검사 12개짜리 검사는
"어느 소검사가 끝났나"를 표현할 수 없다. 개수로 뭉개면 **어느 7개인지가 사라진다.**

`setup` 단계의 선택 결과를 `record`의 `enabled`가 읽을 방법도 없다.
`extensibility.spec.ts:57`이 `enabled: (g) => g.progress !== null`이라는
**사실상 항상 true인 조건**으로 우회하고 있다 — 4단계 테스트가 통과하는 이유가 판정이 없기 때문이다.

그리고 이미 이탈이 시작됐다: **로르샤하는 `has_result`를 쓰지 않고 `isConfirmed(status)`로 돌아갔다**
(`rorschach/module.ts:47,57-58`).

### P3-7. 백엔드 progress가 프론트 모듈과 대칭이 아니다

`apps/api/.../common/progress_service.py:38-51`이 `exam_type` if-체인.
프론트는 "모듈 파일 하나"인데 백엔드는 서비스 분기 + 판정 함수 + import다.

`collect_done`이 무엇을 의미하는지가 **코드가 아니라 주석으로만 연결돼 있다.**
새 검사를 붙일 때 가장 조용히 어긋날 지점.

---

## P4 — 모듈 간 규약 불일치

세 모듈을 나란히 놓으면 같은 개념이 검사마다 다르다.

| 항목 | HTP | SCT | 로르샤하 |
|---|---|---|---|
| `collect.enabled` | 없음(항상 열림) | 없음(항상 열림) | `isRecording` — **완료 후 닫힘** |
| `results.enabled` | `has_result` | `has_result` | `progress !== null && isConfirmed` |
| `results.done` | `has_result` | `isConfirmed` | `isConfirmed` |

→ **사이드바 '완료' 배지의 의미가 검사마다 다르다.** `has_result`인 HTP는 즉시 '완료',
같은 조건의 SCT는 '진행중'.

로르샤하의 `progress !== null` 가드는 코어가 이미 두 곳에서 하고 있어(`exam-context:126-130`,
`[step]/+page.svelte:57-58`) **삼중 방어**다.

### 타입으로 강제되지 않는 규약

- `enabled`가 있으면 `lockedHint`도 있어야 하는데 둘 다 optional.
  `[step]/+page.svelte:38`이 `if (step.lockedHint)`라 **hint 없는 잠긴 단계는 설명 없이 튕겨낸다.**
- `icon`이 optional이라 없으면 사이드바 정렬이 어긋난다
  (`ExamLayoutShell:146-149`가 조건부 렌더 → 라벨이 왼쪽으로 당겨짐).

### `resolveActiveStep`의 선형 전제

`core/module.ts:91-95`의 `allowed.at(-1)`는 "뒤로 갈수록 조건이 엄격"을 가정한다.
로르샤하 `collect`는 **나중에 닫히므로**(`enabled: isRecording`) `allowed`가 연속 구간이 아니다.
지금은 3종이 우연히 맞을 뿐이고, 웩슬러처럼 단계를 왕복하는 검사에서는 잘못된 착지점을 고른다.

---

## P5 — 단계 컴포넌트 중복

1. **셸 배관 6줄 × 8곳** — `examTitle`/`examSubtitle`/`steps`/`client`/`exam`/`isLoading` 중
   5개가 전부 `layoutCtx`에서 온다. **셸이 `getExamContext()`를 직접 읽으면 사라진다.**
2. **`embed=1` 처리 3벌** — 세 Results가 각자 `searchParams.get('embed')`를 읽고
   `{#if embed}` 분기를 복붙. **새 검사가 이걸 잊으면 리포트 모달에 사이드바가 두 겹으로 뜬다.**
3. **`exitMode` 계산 3가지** — HTP는 인라인 리터럴, SCT는 `canDownloadReport` 재사용,
   로르샤하는 `"leave"` 고정.
4. **일시 상태를 사이드바에 반영하는 메커니즘이 계약에 없다** — SCT Review만
   `layoutCtx.steps`를 손으로 패치해 'AI 분석 중' 배지를 넣는다. HTP도 같은 상태가 있는데 없다.
5. **상태 라벨 로컬 재정의** — `(detail)/+page.svelte:56` 근처.
   `exam-visual.ts:23-28` 주석이 경고한 바로 그 패턴이 살아 있다.

---

## 권장 순서

**즉시 (P0)** — SaMD 무결성. 다른 무엇보다 앞선다.
1. 확정 후 편집 차단 (HTP·SCT) — `collect.enabled`에 `!isConfirmed` + 편집 핸들러 가드 + 읽기전용 배선
2. SCT `completed` 회귀 — `core/status.ts` 함수 사용, "완료됨"과 "PDF 가능"을 분리

**단기 (P1)** — 사용자가 매번 겪는 어긋남
3. `refreshExam()` 누락 3곳
4. SCT 확정 소스 일원화
5. 상세 화면 '결과 보기'를 `examProgressPath`로

**중기 (P3·P4)** — 4번째 검사 붙이기 전
6. `ExamType` 개방 + `exam.store.ts` 사본 제거
7. `ExamModule`에 `shortLabel`/`icon`/`downloadReport`/`loadReportAssets` 추가 → 이름 5곳 통일, if-체인 제거
8. 셸이 컨텍스트를 직접 읽게 → 배관 8곳 + embed 분기 제거
9. `scoringMode` 결정 — 삭제하거나 소비처 구현
10. 모듈 규약 통일 (`results.done` 기준, `enabled`↔`lockedHint` 타입 강제)

**설계 결정 필요 (P2·P3-6)** — 논의 후
11. 로르샤하 자유반응/질문 분리 → `docs/rorschach-ux-redesign.md`
12. HTP 검토 단계 신설 (CDSS 원칙)
13. `ExamProgress` 확장 슬롯 — **4번째 검사가 C군(웩슬러)이면 미룰 수 없다**

---

## 부록: 새 검사(웩슬러)를 붙일 때 실제 작업

1. `constants.ts:5` → `exam.store.ts:4` 사본 → `registry.ts:14` → `exam-visual.ts:8` →
   `constants.ts:23` (**코어 5곳**)
2. `ExamTypeIcon.svelte`, `ExamCreateModal.svelte:184`, `examinations/+page.svelte:63,185`
   (**공용 UI 4곳**)
3. 백엔드 `progress.py` + `progress_service.py:38` (**API 2곳**)
   — 소검사 12개를 `collect_done` 하나에 담는 **설계 결정 필요**
4. `setup` 결과를 `record.enabled`가 읽을 방법 없음 → **계약 변경 필요**
5. `steps/*.svelte` 3~4개 — 셸 배관·embed 분기·exitMode를 각각 복붙
6. PDF와 리포트 자산을 `(detail)`·`report`에 if 분기로 추가

**"모듈 하나 추가" 목표 대비 11곳 이상, 그중 3·4번은 설계 결정을 동반한다.**
