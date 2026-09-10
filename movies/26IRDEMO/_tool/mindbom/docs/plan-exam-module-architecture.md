# 검사 모듈 아키텍처 플랜

> 목표: 지금 3종(HTP/SCT/로르샤하)이 아니라 **17종을 담을 코어**를 세운다.
> (현행 3종 + 준비중 14종. 스마트바디체커 제외)
>
> **상태: 토의 완료 → 구현 대기.** §7에 결정 사항, §8에 확정 설계.
> 준비중 14종은 조사를 거쳐 §2에 4개 군으로 정리했다 (출처 §9).

---

## 1. 현재 상태 (사실)

측정한 값이고 추정이 아니다.

| 항목 | 현재 |
|---|---|
| 검사별 `+layout.svelte` | 3벌 (112 + 112 + 243줄) |
| HTP vs SCT layout 실질 차이 | **2곳뿐** — `params.examId`/`params.id`, `'htp'`/`'sct'` |
| context 함수 | `getHTPContext` / `getSCTContext` / `getRorschachContext` (동일 형태 3벌) |
| 라우트 파라미터 | `[examId]`(HTP) vs `[id]`(SCT·로르샤하) 혼재 |
| 검사 진행 페이지 | 7개 (`.../htp`, `.../htp/results`, `.../sct`, `.../sct/results`, `.../rorschach`, `.../rorschach/coding`, `.../rorschach/results`) |
| 공통 셸 | `ExamLayoutShell` 1벌 — **이미 통합 완료** |

즉 **껍데기는 합쳐졌고, 진입점·라우팅·상태로드가 아직 3벌**이다.

### 검사를 하나 더 붙이려면 지금은

라우트 폴더 + `+layout.svelte`(112줄 복붙) + `+page.svelte` ×N + context 3함수 + `exam-route.ts` 분기 추가.
**18종이면 이 복붙이 18번 반복된다.** 이게 이번 작업의 동기.

---

## 2. 실제 대상 — 18종의 성격

`ExamCreateModal`의 목록. 이게 추상의 기준이 되어야 한다.

| 현행 (3) | 카테고리 | 진행 방식 |
|---|---|---|
| HTP | 투사(그림) | 이미지 업로드 → AI 객체탐지 → 해석 검토 |
| 로르샤하 | 투사(잉크반점) | **녹음 + 영역 드로잉** → 전사 → Exner 채점 |
| SCT | 투사(문장) | 문항 응답 입력 → AI 채점 → 검토 |

준비중 14종(스마트바디체커 제외)은 **조사를 거쳐** 아래 4개 군으로 정리됐다.
(출처는 §9. 확정 못한 부분은 "추정" 표기)

#### A군 — 문항형 자동채점 (7종)
K-CBCL · PAT · RAVEN · S척도(청소년/성인) · TCI · J-TCI

- `문항 응답 → 규칙 기반 자동채점 → 결과 확인` — **실질 2단계**
- 문항→척도 매핑이 고정. 규준표 조회로 T점수/백분위/절단점 산출.
- **AI 개입 지점이 없다.**
- 응답 주체가 갈린다: 본인(RAVEN·S척도·TCI·JTCI 12-18) vs 보호자(K-CBCL·PAT·JTCI 3-6/7-11)

#### B군 — 대용량 문항 + 해석 검토 (2종)
MMPI-2(567문항) · MMPI-A(478문항)

- `응답 → 자동채점(타당도+임상척도) → 해석 검토·확정` — **3단계**
- 채점은 규칙 기반이지만 **타당도 판정·코드타입 해석은 임상가 판단**이 실무 규범.
- **현행 CDSS 원칙(AI 초안 → 임상가 확인)에 가장 정합적인 신규 후보.**

#### C군 — 수행형, 검사자가 원점수 입력 (3종)
K-WISC-IV · K-WPPSI-IV · K-Bayley-III

- `연령/소검사 구성 선택 → 검사자 채점 입력 → 규준 변환 결과` — **3단계**
- **결정적 차이: 피검자 반응 원본이 시스템에 안 들어온다.** 검사자가 대면 실시·채점을 마치고 숫자만 넣는다. 시스템은 사실상 "규준 계산기".
- 추가 복잡성: 연령별 소검사 구성 분기(WPPSI 2:6–3:11 vs 4:0–7:7), **basal/ceiling 동적 문항 진행**(Bayley) → A군 문항 폼 컴포넌트로 재사용 불가.

#### D군 — 그림 투사 (2종)
BGT · KFD

- `이미지 업로드(+관찰기록) → AI 초안 → 검토·확정` — **3단계**
- **현행 HTP와 사실상 동일한 파이프라인.** 탐지 모델만 교체하면 된다.
- KFD는 규준 점수 체계가 없어 **순수 서술 해석**. → 프로젝트 원칙(투사검사에 가짜 정량 점수 금지)이 그대로 적용된다.
- BGT는 Koppitz 오류채점이라는 반정량 층이 하나 더 있고, 국내에 딥러닝 자동채점 연구 선례가 있다.

### 여기서 읽히는 것

1. **"단계 수"보다 "누가 입력하는가"가 더 큰 분기다.** 피검자 반응이 들어오는 검사(A·B·D)와 검사자가 채점 결과만 넣는 검사(C)는 화면·권한·감사추적이 전부 달라진다.
2. **AI가 실질 기여하는 건 소수다.** 14종 중 BGT·KFD(그림 분석)와 MMPI-2/A(해석문 초안) 정도. 나머지 9종은 규칙 계산기 + 폼이다.
   → SaMD 2등급 관점에서 오히려 유리하다. AI 미개입 검사는 위험 등급이 낮다.
3. **현행 3종의 추상은 A·C군에 과하다.** `ai_analyzing → ai_draft_ready → under_review`를 억지로 끼우면 **임상가가 아무것도 안 하는 빈 검토 화면**을 통과해야 한다.
4. 그래도 **공통인 것은 분명하다** — 검사 메타 로드, 사이드바·헤더 셸, 내담자 정보, 단계 이동/잠금, 확정, 감사추적, PDF.

---

## 3. 설계 원칙

18종을 담으려면 아래를 지켜야 한다.

1. **공통은 상태머신·셸까지만.** 입력 UI와 결과 UI는 검사마다 다르므로 억지로 공통화하지 않는다.
2. **모듈은 선언, 코어는 실행.** 검사는 "내가 어떤 단계를 갖는지"만 선언하고, 라우팅·가드·이동은 코어가 처리.
3. **가짜 공통화 금지.** MMPI T점수와 HTP 해석문장을 한 타입으로 묶지 않는다. (프로젝트 원칙: *투사적 검사에 가짜 정량 점수를 붙이지 않는다*)
4. **점진 이행 가능.** 18종을 한 번에 안 만든다. 3종을 옮기고, 그 다음부터 모듈만 추가.
5. **레지스트리는 지연 로딩.** 18종 코드가 전부 초기 번들에 들어가면 안 된다.

---

## 4. 제안 구조

```
lib/features/examination/
├── core/                          ← 검사 종류와 무관한 코어
│   ├── ExamLayoutShell.svelte     (이미 있음 — common/components에서 이동)
│   ├── exam-context.svelte.ts     검사 메타 로드 + context (112줄 복붙 대체)
│   ├── module.ts                  ExamModule 타입 정의
│   ├── registry.ts                type → module (지연 로딩)
│   └── status.ts                  상태머신 공통 술어(isConfirmed 등)
│
├── htp/
│   ├── module.ts                  ← 이 검사의 선언
│   └── steps/{Draw,Results}.svelte
├── sct/
│   ├── module.ts
│   └── steps/{Test,Results}.svelte
└── rorschach/
    ├── module.ts
    └── steps/{Record,Coding,Results}.svelte
```

### 모듈 선언 (예시)

```ts
// rorschach/module.ts
export const rorschachModule: ExamModule = {
  type: 'rorschach',
  title: '로샤 검사',
  subtitle: '잉크반점 검사',
  steps: [
    { key: 'record',  label: '반응 영역 기록', icon: 'mic',
      component: () => import('./steps/Record.svelte'),
      enabled: isRecording,
      lockedHint: '반응 영역 기록은 완료되어 수정할 수 없습니다.' },
    { key: 'coding',  label: '채점하기', icon: 'edit',
      component: () => import('./steps/Coding.svelte'),
      enabled: (s) => !isRecording(s) },
    { key: 'results', label: '결과 보기', icon: 'assessment',
      component: () => import('./steps/Results.svelte'),
      enabled: isConfirmed },
  ],
}
```

### 라우트 (완전 통합안)

```
routes/(protected)/examinations/[examId]/
├── +layout.svelte      검사 메타 로드 → context (1벌)
├── +layout.ts          examType 판별 → 모듈 로드
├── +page.svelte        진입 시 현재 상태에 맞는 step으로 리다이렉트
└── [step]/+page.svelte 모듈에서 step 찾아 컴포넌트 렌더 + 가드
```

URL: `/examinations/{id}/{step}` — 예: `/examinations/abc/coding`

---

## 5. URL 변경 영향 (완전 통합 시)

전수 조사 결과. **놓치면 링크가 깨지므로 전부 갱신 대상.**

§7 Q4의 공통 어휘 기준. 현행 3종은 `collect` / `review` / `results` 셋만 쓴다.

| 위치 | 현재 | 변경 후 |
|---|---|---|
| `htp/+page.svelte:55,362` | `/{id}/htp/results` | `/{id}/results` |
| `htp/results/+page.svelte:69,322,438` | `/{id}/htp` | `/{id}/collect` |
| `sct/+page.svelte:121,156,165` | `/{id}/sct/results` | `/{id}/results` |
| `sct/results/+page.svelte:251` | `/{id}/sct` | `/{id}/collect` |
| `rorschach/+page.svelte:125,350` | `/{id}/rorschach/coding` | `/{id}/review` |
| `rorschach/coding/+page.svelte:436,456` | `/{id}/rorschach/results` | `/{id}/results` |
| `rorschach/results/+page.svelte:121,146` | `/{id}/rorschach/coding` | `/{id}/review` |
| `[id]/+page.svelte:121,122` | 타입별 분기 | `examProgressPath()` 일원화 |
| `exam-route.ts` 전체 | 타입별 switch | 모듈 기반으로 재작성 |
| **`report/+page.svelte:435`** | `rorschach/results` (embed 매핑) | `results` |

> 화면 라벨은 그대로 둔다 — 로르샤하 `review` 단계의 사이드바 표기는 "채점하기"를 유지.

### 건드리면 안 되는 것 ⚠️

아래는 **백엔드 API 경로**다. 프론트 URL과 이름이 겹쳐서 혼동하기 쉽다.

```
/institutions/{instId}/examinations/{examId}/htp/results        ← API
/institutions/{instId}/examinations/{examId}/sct/results        ← API
/institutions/{instId}/examinations/{examId}/rorschach/...      ← API
```

`htp-service.ts`, `sct/query-builders.ts`, `rorschach/actions.ts` 안의 경로는 **그대로 둔다.**

---

## 6. 이행 계획 (단계별, 각 단계마다 빌드 통과)

| 단계 | 내용 | 위험도 |
|---|---|---|
| 1 | `core/` 뼈대 — 타입·레지스트리·상태 술어 (기존 코드 안 건드림) | 없음 |
| 2 | `exam-context` 팩토리로 3개 layout 축소 (URL 유지) | 낮음 |
| 3 | 페이지 → `steps/*.svelte` 이동 (라우트는 얇은 래퍼로) | 중간 |
| 4 | `[step]` 단일 라우트 전환 + URL 참조 일괄 갱신 | **높음** |
| 5 | 구 라우트 폴더 제거, `exam-route.ts` 재작성 | 중간 |

각 단계 후 `svelte-check` + `vite build` + 화면 확인.

### 되돌리기

단계마다 커밋을 쪼갠다. 4단계에서 문제가 나면 3단계까지는 살아있고, 그 상태로도 "112줄 복붙 제거"라는 이득은 남는다.

---

## 7. 결정 사항 (토의 완료)

### Q1. 준비중 검사들의 진행 방식 → **조사 완료, §2에 반영**
> 답: "3종만으로 최소추상하되 나머지도 적용 가능한지 조사"

14종을 조사해 4개 군(A/B/C/D)으로 정리했다. 결론:
- **D군(BGT·KFD)은 현행 HTP 파이프라인 그대로 재사용 가능** — 검증됨.
- **B군(MMPI-2/A)은 SCT 패턴에 채점만 규칙 기반으로 바뀐 형태** — 담긴다.
- **A군 7종은 현행 추상이 과하다** — AI 단계가 무의미.
- **C군 3종이 가장 안 맞는다** — 피검자 반응 원본이 시스템에 안 들어온다.

→ **최소 추상은 3종 기준으로 만들되, A·C군을 위한 확장점(§8)을 미리 남긴다.**

### Q2. 상태머신 공통 가능한가? → **조건부 가능. 2경로 분기 필요**
> 답: "공통으로 가는 것이 가능해?"

**하나의 상태머신으로는 안 된다.** A·C군에 `ai_analyzing → ai_draft_ready → under_review`를 강제하면
임상가가 아무 할 일 없는 빈 검토 화면을 통과해야 한다. 이건 CDSS 원칙의 형해화이자 UX 결함이다.

**대신 상태 집합은 공통으로 두고 경로만 분기**하면 된다 — 상태를 새로 만들지 않아도 된다.

```
공통: created → in_progress → ... → confirmed → report_generated → completed

  AI 경로 (B·D군 + 현행 3종):
    in_progress → ai_analyzing → ai_draft_ready → under_review → confirmed

  자동채점 경로 (A·C군):
    in_progress → ai_draft_ready → confirmed
                  └ 채점 완료 = "결과 준비됨" 의미로 재사용
```

즉 **DB 스키마·감사추적·목록 필터는 그대로 두고**, 모듈이 "내 경로는 어느 쪽인가"만 선언한다.
스키마 변경이 없으므로 백엔드 영향이 최소다.

> 대안으로 `scored` 상태를 신설하는 방법도 있으나, DB enum·감사추적·목록 탭·상태 라벨을
> 전부 건드려야 해서 지금은 과하다. 4번째 검사를 실제로 붙일 때 재검토.

### Q3. 카테고리 1급? → **아니오. 검사별 모듈화**
> 답: "검사별 모듈화"

`ExamModule.category`는 두지 않는다. 카테고리는 **분류일 뿐 동작이 아니다.**
공통 UI(T점수 프로파일 뷰 등)가 필요해지면 그때 `lib/features/examination/shared/`에
컴포넌트로 빼서 모듈들이 **가져다 쓰는** 형태로 한다 — 상속이 아니라 조합.

단, **`scoringMode: 'ai' | 'auto'`는 둔다.** 이건 분류가 아니라 Q2의 상태 경로를 결정하는 동작이다.

### Q4. step key 명명 → **공통 어휘 + 검사별 라벨 분리**
> 답: "검사들 둘러보고 추상화해보자"

조사 결과 17종을 덮는 최소 어휘가 나왔다. **URL은 공통 어휘, 화면 라벨은 검사별 자유.**

| key | 의미 | 사용 군 |
|---|---|---|
| `setup` | 연령·검사 폼·소검사 구성 선택 | C군·JTCI·PAT (현행 3종은 불필요) |
| `collect` | 피검자/보호자의 **원자료** 수집 (응답·이미지·음성) | A·B·D군, 현행 3종 |
| `record` | **검사자**가 관찰·수행 결과를 직접 입력 | C군, D군의 관찰기록 |
| `score` | 규칙 기반 규준 변환 | A·B·C군 |
| `review` | 초안·결과 검토·수정 | B·D군, 현행 3종 |
| `results` | 최종 결과 열람 | 전군 |

**`collect`와 `record`를 나눈 게 핵심이다.** 누가 입력하는가가 권한·감사추적을 가른다.

현행 3종 매핑:
- HTP: `collect`(이미지) → `results`
- SCT: `collect`(문항) → `results`
- 로르샤하: `collect`(녹음+영역) → `review`(채점) → `results`

> 로르샤하의 `coding`은 AI 채점을 임상가가 검토·수정하는 단계라 `review`가 맞다.
> 다만 화면 라벨은 "채점하기"를 유지한다 (URL만 공통 어휘).

### Q5. 지금 할 작업인가? → **예. 4단계까지 진행**
> 답: "발표는 기존 버전으로도 가능하다"

발표 리스크가 해소됐으므로 **URL 통합(4단계)까지 완주**한다.
§8의 원래 추천(1~3단계만)은 폐기한다.

---

## 8. 확정 설계

### 8-1. ExamModule

```ts
export interface ExamModule {
  type: ExamType
  title: string            // '로샤 검사'
  subtitle: string         // '잉크반점 검사'
  /** 상태 경로 결정 — 'ai'면 초안·검토 단계, 'auto'면 채점 후 바로 결과 */
  scoringMode: 'ai' | 'auto'
  steps: ExamStep[]
}

export interface ExamStep {
  key: StepKey             // 공통 어휘 (URL 세그먼트)
  label: string            // 검사별 자유 ('채점하기')
  icon?: string
  component: () => Promise<{ default: Component }>   // 지연 로딩
  enabled?: (s: ExamStatus) => boolean
  done?: (s: ExamStatus) => boolean
  lockedHint?: string
}
```

### 8-2. 지금 만들지 않는 것 (확장점만 남김)

- `setup` 단계 — C군이 붙을 때. 현행 3종은 안 쓴다.
- `record`/`score` 단계 — A·C군이 붙을 때.
- 카테고리별 공통 결과 뷰 — 실제 중복이 생긴 뒤에.
- `scored` 상태 신설 — Q2 참조.

**섣불리 만들지 않는 게 요점이다.** 타입에 자리만 만들어두고 구현은 필요할 때 한다.

---

## 9. 조사 출처

준비중 14종 조사 근거 (2026-07 기준):

- MMPI-2/MMPI-A: [한국청소년상담복지개발원 자료집](https://www.kyci.or.kr/fileup/lib_pdf/2014-82.pdf)
- K-WISC-V: [인싸이트](https://inpsyt.co.kr/psy/item/view/KWISC5_CO_TG), [실시·채점 워크숍 교안](https://doitweb.dothome.co.kr/img/%EA%B5%90%EC%95%88/)
- K-WPPSI-IV: [인싸이트](https://inpsyt.co.kr/psy/item/view/WPPSI_CO_TG)
- TCI/JTCI: [마음사랑](https://maumsarang.kr/maum/examine/tci_overview.asp)
- PAT-2: [인싸이트](https://inpsyt.co.kr/psy/item/view/PAT_CO_CA)
- K-CBCL: [ASEBA 한국](https://www.aseba.co.kr/info/FAQ.aspx)
- S척도: [청소년 스마트폰 과의존 자가진단 척도](https://nyit.or.kr/user/sub04_3_2.asp)
- BGT: [딥러닝 기반 BGT 자동채점 연구(KCI)](https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART002946890)
- RAVEN: [K-CPM/K-SPM](http://www.guidance.co.kr/newhome/psychology_test/test/raven.asp)
- K-Bayley-III: [표현언어척도 예비연구](https://www.e-csd.org/journal/view.php?viewtype=pubreader&number=598)

### ⚠️ 별도 확인이 필요한 사업적 쟁점

아키텍처와 별개로, 구현 착수 전 확인해야 할 것들:

1. **규준표 라이선스** — 웩슬러·베일리·MMPI·TCI·CBCL의 규준표는 **출판사 저작물**이다.
   상당수가 이미 출판사 온라인 채점(온라인코드)을 **필수**로 묶어놨다.
   마인드봄이 채점을 대체할 수 있는지 자체가 선결 과제다.
2. **판본 확정** — K-WISC는 현장 표준이 이미 **V판**으로 전환됐다(모달에는 IV로 표기됨).
   S척도도 15문항 KIA 판본 vs 27문항 연구 판본이 갈린다.
3. **KFD 정량화 금지** — 규준 점수 체계가 없는 검사다. 서술 해석만 산출한다.
