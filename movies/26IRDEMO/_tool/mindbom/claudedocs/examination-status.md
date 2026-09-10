# 마인드봄 검사 3종 구현 현황

> 기준일: 2026-04-29 · 상태머신 공통: `created → in_progress → ai_analyzing → ai_draft_ready → under_review → confirmed → report_generated → completed`

## 한눈에 보기

| 항목 | HTP | Rorschach | SCT |
|---|---|---|---|
| **완성도** | 🟢 ~85% | 🟡 ~80% | 🟢 ~95% |
| **DB 테이블** | 3개 (drawings/objects/interpretations) | 3개 (sessions/regions/responses) | 없음 (Examination.result_data JSONB) |
| **AI 연동** | ✅ Detect + Interpret | ✅ Score (Job 폴링) + fallback | ✅ Score + fallback |
| **AI Mock fallback** | ❌ 없음 (AI 필수) | ✅ 룰 기반 | ✅ 룰 기반 (키워드) |
| **프론트 입력 UI** | ✅ Canvas BBox 에디터 | ✅ 카드별 영역 표시 + 음성녹음 | ✅ 40문항 폼 + 자동저장 |
| **결과 페이지** | ✅ | ✅ + 코딩 페이지 별도 | ✅ |
| **PDF 보고서** | ✅ | ✅ | ✅ |
| **남은 이슈** | 전통적 채점지표(Koppitz 등) 없음 | Phase 4-3 하위 클러스터 채점 미완 | 없음 (의도된 단순 구조) |

---

## 1. 🏠 HTP (House-Tree-Person)

**위치**: `apps/api/app/modules/examination/htp/`, `apps/web/.../examinations/[examId]/htp/`

### 백엔드 라우트
| Method | Path | 용도 |
|---|---|---|
| POST | `/drawings/initialize` | 그림 4종 (집/나무/남/여) 레코드 생성 |
| GET / PUT | `/drawings`, `/drawings/{id}` | 목록 / PDI 메타 수정 |
| PUT | `/drawings/{id}/image` | 이미지 업로드 |
| POST | `/analyze` | AI 객체탐지 + 해석 트리거 |
| GET / PATCH | `/results` | 결과 조회 / 임상가 수정 |
| POST | `/interpretations/toggle-important` | 중요 소견 토글 |
| GET | `/report/pdf` | PDF 생성 |

### 핵심 기능
- **객체 탐지**: AI 서버 `/detect` → BBox + 라벨 + 신뢰도 (이미지 좌표 스케일링 포함)
- **해석 생성**: AI 서버 `/htp/result` → main/sub 카테고리 + 문장 + safety/compound 플래그
- **임상가 검토**: BBox 드래그/리사이즈, 객체 추가/삭제, 해석 문장 수정, 중요 소견 마킹

### 프론트
- `+page.svelte`: 그림 탭(집/나무/남/여) + Canvas BBox 인터랙티브 에디터 + 객체/해석 사이드 패널
- `results/+page.svelte`: 결과 뷰

### 비고
- AI 의존도가 가장 높음 (mock 폴백 없음 → AI 서버 필수)
- 측정(measurement) 기능은 스키마엔 있지만 UI 노출은 미확인

---

## 2. 🖋️ Rorschach (잉크반점)

**위치**: `apps/api/app/modules/examination/rorschach/`, `apps/web/.../examinations/[id]/rorschach/`

### 백엔드 라우트
| 단계 | Method | Path | 용도 |
|---|---|---|---|
| 시작 | POST | `/start` | 세션 생성 |
| 녹음 | POST / GET | `/audio`, `/audio-url` | 음성 업로드 / 재생 URL |
| 영역 | POST/PATCH/DELETE | `/regions[/:id]` | 카드별 영역(path) CRUD |
| 완료 | POST | `/complete` | 녹음 단계 종료 |
| 전사 | POST | `/transcript` | OpenAI Whisper 화자분리 (lazy) |
| 채점 | POST | `/score`, `/regions/{id}/score` | 전체/단일 채점 |
| 검토 | PATCH | `/responses/{id}/coding` | final_coding_json 수정 |
| 확정 | POST | `/confirm` | 임상가 확정 |
| 결과 | GET | `/structural-summary`, `/report/pdf` | Exner CS 요약 / PDF |

### 핵심 기능
- **녹음 + 영역 마킹**: 카드 I~X별 freehand path + 색상 + 메모, 오디오 타임스탬프 연동
- **화자분리**: OpenAI Whisper 직접 호출 (AI 팀 서버 아닌 외부 API)
- **Exner CS 채점** (`scoring.py`):
  - Upper section: Location(W/D/Dd/S), DQ, Determinants(M/FM/m, color, shading, form), FQ, Contents, Pairs
  - Basic Ratios: Lambda, EA, es, Z-score (카드별 가중치)
  - Lower section + Special Indices: **부분 구현 (Phase 4-3 미완)**
- **CDSS 이중 보관**: `ai_coding_json`(AI 초안) ↔ `final_coding_json`(임상가 확정) — 감사추적용

### 프론트
- `+page.svelte`: 카드 표시 + Canvas 영역 그리기 + 녹음 컨트롤(시작/정지/타이머) + 영역 리스트
- `coding/+page.svelte`: 채점/코딩 단계 별도 페이지
- `results/+page.svelte`: 구조요약 결과

### 비고
- ⚠️ `services.py`에 `TODO(local backend): currently S3-only` (오디오 URL) — 로컬 백엔드 미지원
- 표준 영역 매핑(W/D1/Dd34 등)은 임상가 수동 선택 (자동탐지 없음)
- 관리자 페이지: `/admin/rorschach-areas` (영역 마스터 관리)

---

## 3. ✏️ SCT (문장완성, 청소년 40문항)

**위치**: `apps/api/app/modules/examination/sct/`, `apps/web/.../examinations/[id]/sct/`

### 백엔드 라우트
| Method | Path | 용도 |
|---|---|---|
| GET | `/stems` | 40문항 stems (5영역 A~E) |
| PUT | `/responses` | 응답 저장 (자동저장/최종) |
| POST | `/score` | AI 채점 → ai_draft_ready |
| PATCH | `/scores` | 단일 문항 점수 수정 |
| POST | `/confirm` | 임상가 확정 → confirmed |
| GET | `/results`, `/report/pdf` | 결과 / PDF |

### 핵심 기능
- **40문항 / 5영역**:
  - A: 가족 관계
  - B: 또래·사회 관계
  - C: 정서·대처
  - D: 자기 인식
  - E: 학교 적응·미래 열망
- **복합 문항 3개** (id 22, 28, 31): answer + reason 둘 다 입력
- **0~6 점수**: 0=정서적 안정/긍정, 6=강한 심리적 갈등
- **AI 폴백 강력**: `AI_SCT_SCORE_URL` 미설정 시 키워드 기반 룰 채점 (`_rule_score_sct_aggregated`)
- **빈 응답 강제 0점**: AI가 무슨 점수를 주든 안전장치로 0 처리
- ⚠️ 최근 커밋 `65f0eca`: stemSuffix(종결어미) 제거 — 답변 자유도 확보

### 데이터 저장
**별도 테이블 없음**, `Examination.result_data` JSONB에 통째로:
```json
{
  "responses": [{ "stemId": 1, "answer": "...", "reason": "...", "answeredAt": "..." }],
  "totalCount": 40,
  "completedCount": 38,
  "scores": [
    {
      "domain": "A", "domainLabel": "가족 관계", "totalScore": 12,
      "items": [{ "stemId": 1, "score": 3, "rationale": "..." }]
    }
  ]
}
```

### 프론트
- `+page.svelte`: 문항 카드 + 응답 입력 + 진행률 + **localStorage 백업 + 1.5s 디바운스 자동저장**
- `results/+page.svelte`: 영역별 점수 + 문항별 채점 결과

### stems 동기화 주의
`apps/api/app/modules/examination/sct/stems.py` ↔ AI 추론서버 `sct-inference-v1/app/stems.py` 변경 시 **양쪽 동기화 필수**.

---

## 공통 인프라

### AI 서비스 (`apps/api/app/infrastructure/ai/`)
- `base.py` `AIService` 4개 메서드: `detect_htp_batch`, `interpret_htp`, `score_sct`, `score_rorschach`
- `remote.py` `RemoteAIService`: HTTP 클라이언트 (HTP는 multipart, SCT는 동기 JSON, Rorschach는 Job 폴링)
- 환경변수: `AI_SERVICE_URL`, `AI_INTERPRETATION_URL`, `AI_SCT_SCORE_URL`, `AI_RORSCHACH_SCORE_URL`
- `AI_SERVICE_ENABLED` 토글로 Mock 전환 가능 (CLAUDE.md 명시)

### CDSS 원칙
모든 검사가 동일한 패턴:
**AI 초안 (`ai_*_json`) → 임상가 검토/수정 → 확정 (`final_*_json`) → 보고서**
AI는 절대 최종 판단 하지 않음.
