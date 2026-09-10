# Field Note Lab - 내부 개발자 도구 설계

> 필드노트 STT/LLM 파이프라인의 모델 벤치마크, 프롬프트 고도화, 비용 추적을 위한 내부 웹 도구

---

## 배경

### 현재 필드노트 파이프라인

```
Mobile (Expo AV) → 30초 chunk 녹음 (m4a) → API 업로드 → S3 저장
                                                    ↓
                                        녹음 완료 후 Background Pipeline
                                                    ↓
Step 1: 화자분리 전사 (gpt-4o-transcribe-diarize) → ffmpeg 오디오 병합 → Whisper API
Step 2: LLM 전사 보정 (gpt-4.1) → 오탈자/필러 제거, 구어→문어
Step 3: AI 요약 (gpt-4.1) → 100-200자 요약
Step 4: 상담일지 초안 (gpt-4.1) → JSON 구조 생성
```

### 현재 한계

- 모델 비교 불가: STT/LLM 모델이 config에 고정
- 비용 추적 없음: 토큰 사용량, API 비용 기록 없음
- 프롬프트 고도화 어려움: prompts.py에 하드코딩, 버전 관리 없음
- 정확도 측정 불가: 모델 간 전사 품질 비교 도구 없음

### 목표

1. **STT 벤치마크**: 동일 오디오를 여러 모델로 전사하여 비용/시간/정확도 비교
2. **프롬프트 에디터**: Refinement/Summary/Note 프롬프트를 편집하면서 결과 실시간 비교
3. **비용 대시보드**: 모델별, 단계별 토큰 사용량 및 비용 추적

---

## 설계 원칙

- **Hybrid C 방식**: 프로덕션 데이터 읽기 전용 + 실험 데이터 별도 저장
- **프로덕션 코드 수정 금지**: 기존 `field_note` 모듈, STT/LLM 클라이언트 변경 없음
- **개발자 전용**: 기존 웹앱 내 `/internal/` 경로, 기존 JWT 인증 재사용
- **확장 가능**: OpenAI 우선, 추후 Deepgram/Google STT 등 프로바이더 추가 가능 구조

---

## 1. Backend 신규 모듈

### 파일 구조

```
apps/api/app/modules/field_note_lab/
├── __init__.py
├── models.py                    # 3개 테이블
├── schemas.py                   # 요청/응답 스키마
├── repository.py                # 3개 리포지토리
├── router.py                    # /internal/field-note-lab
├── facade/
│   ├── __init__.py
│   └── lab_facade.py            # 오케스트레이션
├── services/
│   ├── __init__.py
│   ├── run_stt_experiment.py    # STT 실험 실행
│   ├── run_llm_experiment.py    # LLM 실험 실행
│   ├── manage_prompts.py        # 프롬프트 CRUD + 버저닝
│   ├── aggregate_costs.py       # 비용 집계
│   └── list_source_data.py      # 프로덕션 데이터 조회 (읽기 전용)
└── handlers/
    ├── __init__.py
    ├── list_field_notes.py      # GET 프로덕션 필드노트 목록
    ├── get_field_note_detail.py # GET 프로덕션 필드노트 상세
    ├── run_stt_experiment.py    # POST STT 실험
    ├── run_llm_experiment.py    # POST LLM 실험
    ├── list_experiments.py      # GET 실험 목록
    ├── get_experiment_detail.py # GET 실험 상세
    ├── manage_prompts.py        # CRUD 프롬프트
    ├── import_prompts.py        # POST 프로덕션 프롬프트 import
    └── get_cost_dashboard.py    # GET 비용 대시보드

apps/api/app/infrastructure/llm/
└── cost_calculator.py           # 신규: 모델별 비용 계산 유틸
```

### 1.1 데이터베이스 모델 (models.py)

#### `lab_prompt_versions` - 프롬프트 버전 관리

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| prompt_key | String(50), NOT NULL, indexed | refine, summary, counseling_note, recommendation |
| version | Integer, NOT NULL | 자동 증가 |
| name | String(200), NOT NULL | 사용자 지정 이름 |
| system_prompt | Text, NOT NULL | 시스템 프롬프트 전문 |
| user_prompt_template | Text, nullable | 사용자 프롬프트 템플릿 (변수 포함) |
| author_id | String(36), nullable | 작성자 |
| is_active | Boolean, default=True | 활성 여부 |
| is_production | Boolean, default=False | 프로덕션 프롬프트 마킹 |
| description | Text, nullable | 변경 설명 |
| created_at, updated_at, deleted_at | DateTime | 표준 |

#### `lab_experiment_runs` - 실험 실행 기록

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| experiment_type | String(30), NOT NULL, indexed | stt_transcribe, stt_diarize, llm_refine, llm_summary, llm_counseling_note |
| field_note_id | String(36), nullable, indexed | 원본 필드노트 참조 |
| field_note_audio_id | String(36), nullable | 원본 오디오 참조 (STT용) |
| provider | String(30), default="openai" | AI 제공자 |
| model_name | String(80), NOT NULL | 모델명 |
| model_params | Text(JSON), nullable | {temperature, max_tokens, language 등} |
| prompt_version_id | String(36), nullable | 사용된 프롬프트 버전 |
| author_id | String(36), nullable | 실행자 |
| status | String(20), default="pending" | pending, running, completed, failed |
| started_at | DateTime, nullable | 실행 시작 |
| completed_at | DateTime, nullable | 실행 완료 |
| latency_ms | Integer, nullable | API 응답 시간 (ms) |
| error_message | Text, nullable | 에러 메시지 |
| input_text | Text, nullable | 입력 텍스트 |
| input_audio_duration | Float, nullable | 오디오 길이 (초) |
| input_tokens | Integer, nullable | 입력 토큰 |
| output_tokens | Integer, nullable | 출력 토큰 |
| total_tokens | Integer, nullable | 총 토큰 |
| estimated_cost_usd | Float, nullable | 예상 비용 (USD) |
| output_text | Text, nullable | 출력 텍스트 |
| output_json | Text, nullable | 구조화 출력 (JSON) |
| tags | String(500), nullable | 쉼표 구분 태그 |
| notes | Text, nullable | 메모 |
| created_at, updated_at, deleted_at | DateTime | 표준 |

#### `lab_cost_records` - 비용 추적

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| experiment_run_id | String(36), nullable, indexed | 실험 참조 |
| field_note_id | String(36), nullable, indexed | 프로덕션 필드노트 참조 |
| source | String(20), NOT NULL | lab 또는 production |
| pipeline_step | String(30), NOT NULL | stt_chunk, stt_diarize, refine, summary, counseling_note |
| provider | String(30), default="openai" | |
| model_name | String(80), NOT NULL | |
| input_tokens | Integer, default=0 | |
| output_tokens | Integer, default=0 | |
| audio_duration_seconds | Float, default=0.0 | STT 오디오 길이 |
| estimated_cost_usd | Float, default=0.0 | |
| recorded_at | DateTime, NOT NULL | 비용 발생 시각 |
| created_at, updated_at, deleted_at | DateTime | 표준 |

### 1.2 API 엔드포인트 (router.py)

prefix: `/api/v1/internal/field-note-lab`

#### 프로덕션 데이터 조회 (읽기 전용)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/field-notes` | 완료된 필드노트 목록 (페이지네이션) |
| GET | `/field-notes/{id}` | 필드노트 상세 (오디오/전사/엔트리 포함) |
| GET | `/field-notes/{id}/audio/{audio_id}/download-url` | 오디오 다운로드 URL |

#### STT 실험

| Method | Path | 설명 |
|--------|------|------|
| POST | `/experiments/stt` | 단일 모델 STT 실험 |
| POST | `/experiments/stt/batch` | 복수 모델 동시 실험 |

#### LLM 실험

| Method | Path | 설명 |
|--------|------|------|
| POST | `/experiments/llm` | 단일 LLM 실험 |
| POST | `/experiments/llm/compare` | 복수 프롬프트/모델 비교 실험 |

#### 실험 관리

| Method | Path | 설명 |
|--------|------|------|
| GET | `/experiments` | 실험 목록 (필터/페이지네이션) |
| GET | `/experiments/{id}` | 실험 상세 |
| DELETE | `/experiments/{id}` | 실험 삭제 (소프트 삭제) |

#### 프롬프트 관리

| Method | Path | 설명 |
|--------|------|------|
| GET | `/prompts` | 프롬프트 목록 (prompt_key별 그룹) |
| GET | `/prompts/{id}` | 프롬프트 상세 |
| POST | `/prompts` | 새 프롬프트 버전 생성 |
| PATCH | `/prompts/{id}` | 메타데이터 수정 |
| DELETE | `/prompts/{id}` | 삭제 |
| POST | `/prompts/import-production` | 현재 프로덕션 프롬프트 v1으로 import |

#### 비용 대시보드

| Method | Path | 설명 |
|--------|------|------|
| GET | `/costs/summary` | 총 비용, 모델별, 단계별 집계 |
| GET | `/costs/timeline` | 일자별 비용 추이 |

### 1.3 비용 계산 로직 (cost_calculator.py)

```python
# apps/api/app/infrastructure/llm/cost_calculator.py

PRICING = {
    # STT (USD per minute)
    "whisper-1": {"audio_per_minute": 0.006},
    "gpt-4o-transcribe": {"audio_per_minute": 0.006},
    "gpt-4o-transcribe-diarize": {"audio_per_minute": 0.006},
    # LLM (USD per 1M tokens)
    "gpt-4o": {"input_per_1m": 2.50, "output_per_1m": 10.00},
    "gpt-4o-mini": {"input_per_1m": 0.15, "output_per_1m": 0.60},
    "gpt-4.1": {"input_per_1m": 2.00, "output_per_1m": 8.00},
    "gpt-4.1-mini": {"input_per_1m": 0.40, "output_per_1m": 1.60},
    "gpt-4.1-nano": {"input_per_1m": 0.10, "output_per_1m": 0.40},
}

def estimate_stt_cost(model: str, audio_duration_seconds: float) -> float:
    """STT 비용 추정 (USD)"""
    pricing = PRICING.get(model, {})
    per_minute = pricing.get("audio_per_minute", 0.006)
    return (audio_duration_seconds / 60.0) * per_minute

def estimate_llm_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """LLM 비용 추정 (USD)"""
    pricing = PRICING.get(model, {})
    input_cost = (input_tokens / 1_000_000) * pricing.get("input_per_1m", 0)
    output_cost = (output_tokens / 1_000_000) * pricing.get("output_per_1m", 0)
    return input_cost + output_cost
```

### 1.4 핵심: 토큰/비용 캡처 방식

기존 `SummaryLLMClient`는 `response.json()["choices"][0]["message"]["content"]`만 반환하고 `usage` 필드를 버림.
프로덕션 클라이언트를 수정하지 않고, **lab 서비스에서 직접 httpx 호출**하여 전체 응답 캡처:

```python
# run_llm_experiment.py (서비스)
async with httpx.AsyncClient(timeout=120.0) as client:
    response = await client.post(url, headers=headers, json=payload)
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    # → input_tokens, output_tokens, total_tokens 캡처
```

STT도 동일하게 직접 호출하여 응답 전체를 기록.

### 1.5 기존 코드와의 연동

| 연동 대상 | 방식 | 용도 |
|-----------|------|------|
| `field_note.models` | import (읽기 전용) | 프로덕션 필드노트/오디오 조회 |
| `field_note.repository` | import (읽기 전용) | 프로덕션 데이터 쿼리 |
| `field_note.schemas` | import | 응답 스키마 재사용 |
| `field_note.prompts` | import | 프로덕션 프롬프트 import 기능 |
| `infrastructure.storage` | import | S3 오디오 다운로드 |
| `core.config.settings` | import | API 키, 모델 설정 |
| `core.unit_of_work` | import | 트랜잭션 관리 |

**수정하지 않는 것**: `whisper_client.py`, `summary_client.py`, `process_pipeline.py`, 기존 `field_note` 모듈 전체

### 1.6 현재 프로덕션 프롬프트 (참조: prompts.py)

import 대상이 되는 4개 프롬프트:

- **REFINE_SYSTEM_PROMPT**: 한국어 심리상담 녹취록 교정 (오탈자, 필러, 구어→문어)
- **SUMMARY_SYSTEM_PROMPT**: 상담 녹음 요약 (100-200자, 해석 금지)
- **COUNSELING_NOTE_SYSTEM_PROMPT**: 상담일지 JSON 생성 (mood, main_topic, intervention 등)
- **RECOMMENDATION_SYSTEM_PROMPT**: 실시간 상담 추천 (질문, 기법, 관찰 포인트)

---

## 2. Frontend 신규 페이지

### 라우트 구조

```
apps/web/src/routes/(protected)/internal/
└── field-note-lab/
    ├── +layout.svelte           # Lab 레이아웃 (탭 네비게이션)
    ├── +layout.ts               # export const ssr = false
    ├── +page.svelte              # 대시보드 (비용 요약 + 최근 실험)
    ├── +page.ts
    ├── stt-benchmark/
    │   ├── +page.svelte          # STT 벤치마크
    │   └── +page.ts
    ├── prompt-editor/
    │   ├── +page.svelte          # 프롬프트 편집/테스트
    │   └── +page.ts
    ├── cost-tracker/
    │   ├── +page.svelte          # 비용 추적 대시보드
    │   └── +page.ts
    └── experiments/
        ├── +page.svelte          # 실험 히스토리
        ├── +page.ts
        └── [experimentId]/
            ├── +page.svelte      # 실험 상세/비교
            └── +page.ts
```

### Feature 모듈 구조

```
apps/web/src/lib/features/internal/field-note-lab/
├── constants.ts                 # 모델 옵션, 실험 타입, 상태값
├── types.ts                     # API 타입 정의
│
├── dashboard/
│   ├── query-builders.ts
│   ├── view-model.ts
│   └── components/
│       ├── CostOverviewCard.svelte
│       └── RecentExperiments.svelte
│
├── stt-benchmark/
│   ├── constants.ts             # STT 모델 목록, 언어 옵션
│   ├── query-builders.ts
│   ├── view-model.ts
│   ├── stt-service.ts
│   ├── hooks.svelte.ts
│   └── components/
│       ├── FieldNoteSelector.svelte    # 필드노트 선택 드롭다운
│       ├── AudioPlayer.svelte          # 브라우저 오디오 재생
│       ├── ModelSelector.svelte        # STT 모델 멀티셀렉트
│       ├── TranscriptComparison.svelte # 모델별 전사 결과 비교
│       └── BenchmarkResultCard.svelte  # 개별 결과 카드
│
├── prompt-editor/
│   ├── constants.ts             # 프롬프트 키 목록
│   ├── query-builders.ts
│   ├── view-model.ts
│   ├── prompt-service.ts
│   ├── hooks.svelte.ts
│   └── components/
│       ├── PromptTextarea.svelte       # 프롬프트 편집 영역
│       ├── PromptVersionList.svelte    # 버전 히스토리
│       ├── TestPanel.svelte            # 입력 선택 + 실행 + 결과
│       └── OutputComparison.svelte     # 버전 간 결과 비교
│
├── cost-tracker/
│   ├── query-builders.ts
│   ├── view-model.ts
│   └── components/
│       ├── CostChart.svelte           # 일자별 비용 라인 차트
│       ├── ModelBreakdown.svelte      # 모델별 비용 테이블
│       └── StepBreakdown.svelte       # 단계별 비용 테이블
│
└── experiments/
    ├── query-builders.ts
    ├── view-model.ts
    ├── filters.ts
    └── components/
        ├── ExperimentTable.svelte
        └── ExperimentDetail.svelte
```

### Action 파일

```
apps/web/src/lib/hooks/actions/fieldNoteLab.action.ts
```

### 주요 페이지별 기능

#### 대시보드 (/)
- 총 비용 요약 카드 (이번 주/이번 달)
- 모델별 비용 분포 (간단 차트)
- 최근 실험 5건 목록

#### STT 벤치마크 (/stt-benchmark)
1. 필드노트 선택 (완료된 것 중 선택)
2. 오디오 미리듣기 (presigned URL로 `<audio>` 재생)
3. 모델 선택 (복수 선택 가능)
4. "실험 실행" → batch API 호출
5. 결과 테이블: 모델 | 전사텍스트 | 소요시간 | 비용 | 세그먼트수
6. 전사 결과 나란히 비교 (side-by-side)

#### 프롬프트 에디터 (/prompt-editor)
1. prompt_key 선택 (refine/summary/counseling_note/recommendation)
2. 버전 목록 사이드바 (현재 프로덕션 마킹)
3. 프롬프트 편집 영역 (textarea)
4. 테스트 패널:
   - 입력 데이터 선택 (기존 필드노트 전사본)
   - 모델 선택
   - "테스트 실행" → LLM 실험 API 호출
   - 결과 표시 + 토큰/비용 정보
5. 버전 간 출력 diff 비교

#### 비용 추적 (/cost-tracker)
- 기간 필터 (날짜 범위)
- 일자별 비용 추이 라인 차트
- 모델별 비용 테이블 (모델 | 실험수 | 총비용 | 평균지연)
- 단계별 비용 테이블 (STT | Refine | Summary | Note)

#### 실험 히스토리 (/experiments)
- 필터: 실험타입, 모델, 상태, 날짜범위
- 테이블: 실험ID | 타입 | 모델 | 상태 | 비용 | 지연 | 생성일
- 클릭 → 상세 페이지

---

## 3. 구현 순서

### Phase 1: 인프라 (Backend 기반)
1. `cost_calculator.py` 생성
2. `field_note_lab/models.py` 생성
3. Alembic 마이그레이션 생성/실행
4. `field_note_lab/schemas.py` 생성
5. `field_note_lab/repository.py` 생성

### Phase 2: 서비스/핸들러 (Backend 로직)
6. `services/list_source_data.py` (프로덕션 데이터 읽기)
7. `services/run_stt_experiment.py` (STT 실험)
8. `services/run_llm_experiment.py` (LLM 실험)
9. `services/manage_prompts.py` (프롬프트 CRUD)
10. `services/aggregate_costs.py` (비용 집계)
11. `facade/lab_facade.py`
12. 각 handler 파일
13. `router.py` + `main.py` 등록

### Phase 3: Frontend 기반
14. `fieldNoteLab.action.ts` (API 레이어)
15. `features/internal/field-note-lab/constants.ts`, `types.ts`
16. 라우트 레이아웃 (`+layout.svelte`, `+layout.ts`)

### Phase 4: Frontend 페이지
17. 대시보드 페이지
18. STT 벤치마크 페이지
19. 프롬프트 에디터 페이지
20. 비용 추적 페이지
21. 실험 히스토리 페이지

---

## 4. 검증 방법

1. **DB 마이그레이션**: `uv run alembic upgrade head` → 3개 테이블 생성 확인
2. **프로덕션 데이터 읽기**: `GET /internal/field-note-lab/field-notes` → 기존 필드노트 목록 반환
3. **프롬프트 import**: `POST /prompts/import-production` → `prompts.py`의 4개 프롬프트가 v1로 저장
4. **STT 실험**: 기존 오디오로 `POST /experiments/stt` → 전사 결과 + 비용 + 지연시간 기록
5. **LLM 실험**: 기존 전사본으로 `POST /experiments/llm` → 프롬프트 적용 결과 + 토큰/비용 기록
6. **비용 대시보드**: `GET /costs/summary` → 실험별 비용 집계 확인
7. **Frontend**: 각 페이지에서 위 API 호출 → UI에 결과 표시

---

## 5. 주요 파일 (수정/참조)

### 신규 생성
- `apps/api/app/infrastructure/llm/cost_calculator.py`
- `apps/api/app/modules/field_note_lab/` (전체 모듈)
- `apps/api/migrations/versions/xxx_add_field_note_lab_tables.py`
- `apps/web/src/routes/(protected)/internal/field-note-lab/` (전체)
- `apps/web/src/lib/features/internal/field-note-lab/` (전체)
- `apps/web/src/lib/hooks/actions/fieldNoteLab.action.ts`

### 수정 (최소한)
- `apps/api/app/main.py` — 라우터 등록 1줄 추가
- `apps/api/migrations/env.py` — 모델 import 1줄 추가

### 참조만 (수정 안 함)
- `apps/api/app/modules/field_note/models.py`
- `apps/api/app/modules/field_note/repository.py`
- `apps/api/app/modules/field_note/schemas.py`
- `apps/api/app/modules/field_note/prompts.py`
- `apps/api/app/infrastructure/stt/whisper_client.py`
- `apps/api/app/infrastructure/llm/summary_client.py`
- `apps/api/app/core/config.py`

---

## 6. 현재 설정 참조 (config.py)

```python
# STT
STT_MODEL = "whisper-1"
STT_DIARIZE_MODEL = "gpt-4o-transcribe-diarize"
STT_DIARIZE_ENABLED = True

# LLM
OPENAI_MODEL = "gpt-4.1"
SUMMARY_MODEL = ""  # 비어있으면 OPENAI_MODEL 사용
SUMMARY_MAX_TOKENS = 2048
```

---

*작성일: 2026-04-01*
*다음 세션에서 이 문서를 참조하여 구현 진행*
