# 로르샤하 검사 모듈 구현 계획

> 담당: 로샤 파트

---

## 0. 현황

### 이미 있는 것
- **상태 머신 / Examination 공통 모델** ([app/modules/examination/common/](../apps/api/app/modules/examination/common/))
- **AI 인터페이스 정의** — `transcribe_rorschach`, `score_rorschach` ([infrastructure/ai/base.py](../apps/api/app/infrastructure/ai/base.py))
- **MockAIService** ([infrastructure/ai/mock.py](../apps/api/app/infrastructure/ai/mock.py))
- **검사 등록 모달** — exam_type=`rorschach` 선택 가능

### 비어 있는 것
- 백엔드 [app/modules/examination/rorschach/](../apps/api/app/modules/examination/rorschach/) — `__init__.py`만 존재
- 프론트 `lib/features/examination/rorschach/` — 폴더 자체가 없음
- 라우트 `/examinations/[id]/rorschach` — 없음

---

## 1. 사용자 흐름 (3단계)

```
[1] 검사 진행 (AudioTouchSync)
    /examinations/[id]/rorschach
    ↓ 10장 카드 순회
    ↓ 음성 녹음 (전체 세션 1트랙)
    ↓ 카드별 영역(Region) 그리기 + 메모
    ↓ 완료 → status: in_progress → ai_analyzing

[2] 채점/코딩 (SmartIndexing)
    /examinations/[id]/rorschach/coding
    ↓ 트랜스크립트 + 오디오 재생
    ↓ 영역마다 Exner 코딩 입력 (location/dq/determinants/fq/contents/...)
    ↓ AI 채점 초안 → 임상가 검토·수정
    ↓ 완료 → status: ai_draft_ready → under_review → confirmed

[3] 결과 (Results)
    /examinations/[id]/rorschach/results
    ↓ 구조요약 (UpperSection/LowerSection/SpecialIndices)
    ↓ 보고서 생성 → status: report_generated → completed
```

---

## 2. 도메인 모델 (DB)

### 테이블 설계 (3개)

**`rorschach_sessions`** — 검사 세션 (Examination 1:1)
```
id, examination_id (FK, unique)
audio_url       # 전체 녹음 파일 경로
audio_duration  # 초
started_at, ended_at
created_at, updated_at, deleted_at
```

**`rorschach_regions`** — 카드별 영역 (피검자가 보고한 위치)
```
id, session_id (FK)
card_no         # 1..10
label           # "1", "2", ... 카드 내 순번
path_json       # [{x,y}, ...] normalized 0..1
color           # HEX
memo            # 검사자 메모
audio_timestamp # 그릴 때 녹음 타임코드 (초)
created_at, updated_at, deleted_at
```

**`rorschach_responses`** — 응답별 채점 (영역 1:1 또는 1:N — 일단 1:1로 시작)
```
id, region_id (FK, unique)
response_no                # 카드 내 응답 번호
free_association_text      # 자유연상 전사
inquiry_text               # 질문 단계 전사

# Exner CS 채점 — AI 초안과 임상가 확정값 분리 (CDSS)
ai_coding_json             # AI가 낸 초안 (jsonb)
final_coding_json          # 임상가 확정 (jsonb)
ai_confidence              # 0..1
ai_reasoning               # 텍스트

confirmed_at               # 임상가 확정 시각
confirmed_by               # member_id
created_at, updated_at, deleted_at
```

> **CDSS 원칙:** `ai_coding_json`은 절대 덮어쓰지 않고, 임상가 수정은 `final_coding_json`에만 반영. 감사추적용.

### 트랜스크립트 저장 방식

옵션 A: 별도 테이블 `rorschach_transcript_segments` (start/end/speaker/text)
옵션 B: `rorschach_sessions.transcript_json` 컬럼

**→ 일단 B (jsonb)** 로 시작. 검색·인덱싱 필요해지면 A로 분리.

---

## 3. 백엔드 API (`app/modules/examination/rorschach/`)

### 엔드포인트

| Method | Path | 용도 |
|---|---|---|
| POST | `/examinations/{id}/rorschach/start` | 세션 시작 (in_progress 전이) |
| POST | `/examinations/{id}/rorschach/audio` | 전체 음성 업로드 → transcribe 호출 |
| POST | `/examinations/{id}/rorschach/regions` | 영역 추가 |
| PATCH | `/examinations/{id}/rorschach/regions/{region_id}` | 메모/path 수정 |
| DELETE | `/examinations/{id}/rorschach/regions/{region_id}` | 영역 삭제 |
| POST | `/examinations/{id}/rorschach/score` | 전체 응답 AI 채점 (ai_analyzing → ai_draft_ready) |
| PATCH | `/examinations/{id}/rorschach/responses/{response_id}/coding` | 임상가 수정 (final_coding_json) |
| POST | `/examinations/{id}/rorschach/confirm` | 검토 완료 (under_review → confirmed) |
| GET  | `/examinations/{id}/rorschach` | 세션 + 영역 + 응답 일괄 조회 |
| GET  | `/examinations/{id}/rorschach/structural-summary` | 구조요약 계산 |

### 파일 구조

```
app/modules/examination/rorschach/
├── __init__.py
├── models.py        # RorschachSession, RorschachRegion, RorschachResponse
├── schemas.py       # 요청/응답 DTO + Exner 코딩 스키마
├── repository.py    # 순수 쿼리
├── services.py      # 단일 비즈니스 로직 (도메인 예외)
├── facade.py        # 서비스 조합 + AI 호출
├── handlers.py      # UoW 트랜잭션 경계
├── router.py        # FastAPI 라우터
└── scoring.py       # Exner 구조요약 계산 (순수 함수)
```

### Exner 코딩 스키마 (Pydantic)

```python
class RorschachCoding(BaseModel):
    location: Literal["W","D","Dd","WS","DS","DdS"] | None = None
    dq: Literal["+","o","v/+","v"] | None = None
    determinants: list[str] = []   # F, Ma, FMa, FC, ...
    fq: Literal["+","o","u","-","none"] | None = None
    pair: bool = False
    contents: list[str] = []       # H, Hd, A, An, ...
    popular: bool = False
    z_score: Literal["ZW","ZA","ZD","ZS"] | None = None
    special_scores: list[str] = [] # DV, DR, INCOM, FABCOM, ...
```

---

## 4. 프론트엔드 (`apps/web/src/lib/features/examination/rorschach/`)

### 디렉터리 구조 (FRONTEND_ARCHITECTURE.md V4 패턴)

```
lib/features/examination/rorschach/
├── components/
│   ├── sync/              # [1] 검사 진행
│   │   ├── CardCanvas.svelte
│   │   ├── CardTabs.svelte
│   │   ├── FreehandDrawing.svelte
│   │   ├── RegionOverlay.svelte
│   │   ├── RecordingControl.svelte
│   │   └── SyncFooter.svelte
│   ├── coding/            # [2] 채점
│   │   ├── CardViewerPanel.svelte
│   │   ├── CodingInputPanel.svelte
│   │   ├── TranscriptAudioPanel.svelte
│   │   └── FilterBar.svelte
│   └── result/            # [3] 결과
│       ├── upperSection/
│       ├── lowerSection/
│       └── specialIndices/
├── hooks/
│   ├── recording.svelte.ts        # MediaRecorder
│   ├── region-manager.svelte.ts
│   ├── transcript-sync.svelte.ts
│   └── audio-playback.svelte.ts
├── workflow.svelte.ts     # 로샤 전용 워크플로우 (FRONTEND_ARCHITECTURE.md §2)
├── rorschach-service.ts
├── view-model.ts
├── actions.ts             # HTTP 호출
├── types.ts
└── constants.ts           # CODING_OPTIONS, REGION_COLORS
```

### 라우트 (`src/routes/(protected)/examinations/[id]/`)

```
[id]/
├── +page.svelte           # 검사 상세 (현재 없음 — 우선 만들어야 함)
└── rorschach/
    ├── +page.svelte       # 검사 진행
    ├── coding/+page.svelte
    └── results/+page.svelte
```

---

## 5. 구현 단계 (Phase)

### Phase 1 — 검사 진행 화면 (이번 작업)
**목표:** 데모 가능한 진행 화면. 영역 그리기·녹음 타이머까지. 저장은 mock.

- [ ] 라우트 `examinations/[id]/+page.svelte` (검사 상세 — 진행 시작 버튼)
- [ ] 라우트 `examinations/[id]/rorschach/+page.svelte`
- [ ] `types.ts` + `constants.ts`
- [ ] `hooks/recording.svelte.ts` — 일단 타이머만 (mock)
- [ ] `hooks/region-manager.svelte.ts` (Svelte 5 Runes)
- [ ] `components/sync/` 5개 컴포넌트
- [ ] 카드 이미지 — `static/rorschach/card-{1..10}.png` (placeholder)
- [ ] "검사 완료" 클릭 시: 콘솔 로그 + 토스트 (저장 X)

**제외:** 백엔드, 실제 녹음, AI 호출, 채점/결과 화면

### Phase 2 — 백엔드 + 저장 연동
- [ ] DB 마이그레이션 (3 테이블)
- [ ] models / schemas / repository / services / facade / handlers / router
- [ ] 라우터 등록 (`app/main.py` or `app/api/v1/__init__.py`)
- [ ] Phase 1 화면을 실제 API에 연결

### Phase 3 — 채점 화면 (SmartIndexing)
- [ ] AI 채점 호출 (MockAIService)
- [ ] 임상가 수정 UI
- [ ] 트랜스크립트 ↔ 영역 ↔ 코딩 동기화

### Phase 4 — 결과 화면 + 구조요약 계산
- [ ] `scoring.py` — Exner 구조요약 (R, Lambda, EB, EA 등)
- [ ] result 컴포넌트들 구현

### Phase 5 — 실제 음성 녹음 + AI 연동
- [ ] MediaRecorder API
- [ ] 파일 업로드 (multipart)
- [ ] AI팀 서버 준비되면 RemoteAIService

---

## 6. 결정 사항 / 미정

### 결정됨
- 트랜스크립트는 일단 `sessions.transcript_json` (jsonb)
- AI 코딩과 임상가 코딩 컬럼 분리 (`ai_coding_json` / `final_coding_json`)
- 응답:영역 = 1:1 (필요 시 확장)

### 미정 (진행 중 결정)
- 카드별로 녹음을 끊을 것인가, 전체 1트랙으로 갈 것인가?
  - → 일단 전체 1트랙 + 트랜스크립트에 카드 마커
- 영역 path 좌표계: pixel vs normalized(0..1)
  - → **normalized**. 캔버스 크기 바뀌어도 안전
- 카드 이미지 저작권/사용
  - → Phase 1에선 placeholder. 이후 별도 검토 필요

---

## 7. SaMD 체크리스트 (작업 시 유의)

- [ ] AI 코딩 결과는 절대 덮어쓰지 않음 (감사추적)
- [ ] 영역/응답 변경 시 `audit` 모듈에 기록
- [ ] 상태 전이는 `state_machine.validate_transition` 통과해야만 변경
- [ ] 임상가 확인(`confirmed_by`, `confirmed_at`) 없이는 보고서 생성 불가
- [ ] AI가 자동으로 `confirmed` 이상 상태로 전이시키지 않음
