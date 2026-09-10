# Field Note 고도화 로드맵

> 임상 노트 서식 다양화, 비언어 분석, 다회기 추적, 사례 개념화를 통한 필드노트 파이프라인 고도화

---

## 배경

### 경쟁사 분석 (마음토스/Mindthos)

마음토스는 **개인 상담사를 위한 AI 임상 도구**로, 우리 필드노트가 지향하는 방향과 동일한 제품.
핵심 기능: AI 축어록 생성, 20+ 임상 서식 템플릿, 사례 개념화, 다회기 흐름 추적, AI 슈퍼비전, 디지털 가계도.
가격: 8,900~49,900원/월 (크레딧 기반 개인 구독).

### 현재 필드노트 파이프라인

```
Mobile 녹음 → 30초 chunk 업로드 → S3 저장
                                    ↓
                        녹음 완료 후 Background Pipeline
                                    ↓
Step 1: 화자분리 전사 (gpt-4o-transcribe-diarize)
Step 2: LLM 전사 보정 (gpt-4.1) — 선택적
Step 3: AI 요약 (gpt-4.1) — 100-200자
Step 4: 상담일지 초안 (gpt-4.1) — 고정 JSON 1종
```

### Gap 분석

| 기능 | 우리 (현재) | 마음토스 | Gap |
|------|:-----------:|:-------:|:---:|
| STT + 화자분리 | ✅ | ✅ | - |
| 실시간 AI 추천 | ✅ | ❌ | 우리 우위 |
| 실시간 미리보기 | ✅ | ❌ | 우리 우위 |
| 텍스트 교정 | ✅ | ✅ | - |
| 상담 노트 자동 생성 | ✅ 고정 1종 | ✅ 20+ 서식 | **Gap** |
| 비언어적 단서 감지 | ❌ | ✅ | **Gap** |
| 다회기 흐름 추적 | 🟡 이전 3개 요약만 | ✅ 패턴 분석 | **Gap** |
| 이론별 맞춤 분석 | ❌ | ✅ | **Gap** |
| 사례 개념화 | ❌ | ✅ | **Gap** |
| 축어록 내보내기 | ❌ | ✅ | **Gap** |

### 우리의 구조적 강점

마음토스는 **녹음 파일만 분석하는 독립 도구**이지만, 우리는 **센터 운영 플랫폼 내 통합 모듈**:

- 내담자/보호자/케이스/세션 데이터가 이미 있음 → 다회기 추적이 자동 연결
- 심리검사(Assessment) 결과 연동 가능 → 사례 개념화에 검사 점수 통합
- 멀티테넌트/센터별 설정 가능 → 센터마다 다른 서식/이론 적용

---

## 설계 원칙

- **기존 파이프라인 구조 유지**: 4단계 파이프라인(transcribe → refine → summarize → note) 변경 최소화
- **프롬프트 레지스트리 패턴**: 서식/이론 다양화는 프롬프트 교체로 해결 (코드 분기 최소화)
- **JSONB 유연성 활용**: `CounselingNote.content`가 이미 JSONB → 어떤 서식이든 저장 가능
- **비용 제어 우선**: 토큰 비용이 큰 기능(다회기 분석, 개념화)은 수동 트리거
- **Phase별 독립 배포**: 각 Phase는 독립적으로 개발/배포 가능

---

## Phase 1: 임상 노트 고도화

> 영향 범위: 🟢 작음 | 프롬프트 교체 + 컬럼 1개 추가

### 1.1 목표

- 상담 노트 서식 다양화 (SOAP, DAP, BIRP, 가족센터 등)
- 센터별 기본 서식 설정
- 축어록 내보내기 (텍스트/JSON)

### 1.2 노트 서식 템플릿

#### 지원 서식 목록

| 서식 | 코드 | 구조 | 대상 |
|------|------|------|------|
| 기본 (현재) | `default` | mood, main_topic, intervention, progress, homework, next_goal, raw_notes | 범용 |
| SOAP | `soap` | subjective, objective, assessment, plan | 의료/임상 연계 |
| DAP | `dap` | data, assessment, plan | 간결한 기록 |
| BIRP | `birp` | behavior, intervention, response, plan | 행동 관찰 중심 |
| 가족센터 | `family_center` | presenting_problem, family_dynamics, intervention, outcome, follow_up | 가족상담센터 |

#### 프롬프트 레지스트리

```python
# pipeline/prompts.py에 추가

SOAP_NOTE_SYSTEM_PROMPT = """당신은 심리상담 회기 녹취록과 상담사 메모를 분석하여 SOAP 형식의 상담일지를 작성하는 전문가입니다.

다음 JSON 구조로만 응답하세요:
{
  "subjective": "내담자가 보고한 주관적 경험, 감정, 증상 (내담자 관점)",
  "objective": "상담사가 관찰한 객관적 정보 (행동, 표정, 태도, 검사 결과 등)",
  "assessment": "상담사의 임상적 판단, 진전 평가, 패턴 분석",
  "plan": "다음 회기 계획, 과제, 의뢰, 추후 조치"
}

규칙:
- 한국어로 작성
- 전문적이고 객관적인 어조
- 각 섹션은 1-3문장으로 간결하게
- 정보가 부족한 필드는 null로 반환
- 반드시 유효한 JSON만 반환"""

DAP_NOTE_SYSTEM_PROMPT = """..."""  # 유사 패턴
BIRP_NOTE_SYSTEM_PROMPT = """..."""
FAMILY_CENTER_NOTE_SYSTEM_PROMPT = """..."""

# 레지스트리: 서식 코드 → 프롬프트 매핑
NOTE_TEMPLATE_REGISTRY: dict[str, str] = {
    "default": COUNSELING_NOTE_SYSTEM_PROMPT,
    "soap": SOAP_NOTE_SYSTEM_PROMPT,
    "dap": DAP_NOTE_SYSTEM_PROMPT,
    "birp": BIRP_NOTE_SYSTEM_PROMPT,
    "family_center": FAMILY_CENTER_NOTE_SYSTEM_PROMPT,
}
```

#### 프롬프트 선택 로직

현재 `generate_counseling_note.py`와 `process_pipeline.py`에서 프롬프트를 선택하는 방식:

```python
# 현재 (process_pipeline.py:86)
note_config = await infra.get_pipeline_config("counseling_note")
note_system_prompt = note_config.get("system_prompt") or COUNSELING_NOTE_SYSTEM_PROMPT

# 변경 후
note_config = await infra.get_pipeline_config("counseling_note")
# 1순위: ProductionAIConfig DB 오버라이드
# 2순위: 필드노트에 지정된 서식 템플릿
# 3순위: 센터 기본 서식
# 4순위: default (현재 프롬프트)
template_type = field_note.note_template_type or center_default or "default"
note_system_prompt = (
    note_config.get("system_prompt")
    or NOTE_TEMPLATE_REGISTRY.get(template_type)
    or COUNSELING_NOTE_SYSTEM_PROMPT
)
```

### 1.3 엔티티 변경

#### FieldNote 모델 (컬럼 추가)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `note_template_type` | String(30), nullable, default=None | 사용할 노트 서식 (default, soap, dap, birp, family_center) |

#### CenterNotePreference 모델 (신규)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| center_id | String(36), unique, indexed | 센터 ID |
| default_template_type | String(30), NOT NULL, default="default" | 센터 기본 서식 |
| created_at, updated_at | DateTime | 표준 |

> **대안**: Center 모델에 컬럼 추가 대신 별도 테이블로 분리.
> Center 모듈 수정을 최소화하고, 향후 서식별 추가 설정 확장에 유리.

### 1.4 축어록 내보내기

별도 서비스로 구현. 기존 `SummaryExecutionService.build_transcript_text()`의 포맷 로직을 재사용.

```python
# field_note/services/export_transcript.py (신규)

class ExportTranscriptService:
    """축어록을 텍스트/JSON 형식으로 내보내기"""
    
    async def execute(
        self, field_note_id: str, center_id: str, format: str = "text"
    ) -> ExportResult:
        # 1. FieldNote + FieldNoteAudio 로드
        # 2. speaker_map 적용 (Speaker A → "상담사" 등)
        # 3. 포맷별 변환:
        #    - text: [MM:SS] 화자명: 발화내용
        #    - json: [{speaker, text, start, end}]
        # 4. refined_transcript 우선, 없으면 diarized_transcript
```

### 1.5 API 엔드포인트

| Method | Path | 설명 | 신규/수정 |
|--------|------|------|:---------:|
| PATCH | `/field-notes/{id}/finish` | `note_template_type` 파라미터 추가 | 수정 |
| GET | `/field-notes/{id}/export` | 축어록 내보내기 (query: format=text\|json) | 신규 |
| GET | `/centers/{id}/note-preferences` | 센터 기본 서식 조회 | 신규 |
| PATCH | `/centers/{id}/note-preferences` | 센터 기본 서식 변경 | 신규 |

### 1.6 수정/생성 파일 목록

#### Backend

| 파일 | 작업 | 내용 |
|------|:----:|------|
| `field_note/pipeline/prompts.py` | 수정 | SOAP/DAP/BIRP/가족센터 프롬프트 + NOTE_TEMPLATE_REGISTRY |
| `field_note/pipeline/handlers/generate_counseling_note.py` | 수정 | template_type 기반 프롬프트 선택 로직 (L91 수정) |
| `field_note/pipeline/handlers/process_pipeline.py` | 수정 | 동일 프롬프트 선택 로직 (L86 수정) |
| `field_note/field_note/models.py` | 수정 | `note_template_type` 컬럼 추가 |
| `field_note/field_note/schemas.py` | 수정 | 응답/요청 스키마에 `note_template_type` 추가 |
| `field_note/field_note/services/export_transcript.py` | 신규 | 축어록 내보내기 서비스 |
| `field_note/field_note/handlers/export_transcript.py` | 신규 | 내보내기 핸들러 |
| `field_note/router.py` | 수정 | export 엔드포인트 추가 |
| `center/center_note_preference/models.py` | 신규 | CenterNotePreference 모델 |
| `center/center_note_preference/schemas.py` | 신규 | 요청/응답 스키마 |
| `center/center_note_preference/repository.py` | 신규 | CRUD |
| `center/center_note_preference/services/` | 신규 | Get/Upsert 서비스 |
| `center/center_note_preference/handlers/` | 신규 | 핸들러 |
| `center/router.py` | 수정 | note-preferences 라우터 추가 |
| 마이그레이션 1건 | 신규 | note_template_type 컬럼 + center_note_preferences 테이블 |

#### Frontend

| 파일 | 작업 | 내용 |
|------|:----:|------|
| `features/counseling/field-note/constants.ts` | 수정 | 서식 타입 상수/라벨 |
| `features/counseling/field-note/field-note-service.ts` | 수정 | export, template 선택 메서드 |
| `hooks/actions/field-note.action.ts` | 수정 | export API 호출 추가 |
| 상담 세션 상세 페이지 | 수정 | 서식 선택 드롭다운 + 내보내기 버튼 |
| 센터 설정 페이지 | 수정 | 기본 서식 설정 섹션 |

### 1.7 영향도

```
코드 변경량: ■■□□□ (프롬프트 추가 + 분기 1개)
DB 변경:     마이그레이션 1건 (컬럼 1개 + 테이블 1개)
비용 영향:   없음 (동일 LLM 호출 횟수)
기존 코드 파괴: 없음 (하위 호환 유지, default 서식 = 현재 동작)
```

---

## Phase 2: 비언어 분석 + 다회기 추적

> 영향 범위: 🟡 중간 | 파이프라인 확장 + 신규 모델

### 2.1 목표

- 침묵 감지 (오디오 에너지 분석, ML 불필요)
- 비언어 마커를 축어록에 삽입
- 케이스 단위 종단 분석 (다회기 패턴/주제 추적)

### 2.2 침묵 감지 (비언어 분석)

#### 접근 방식

```
오디오 바이트 (merge_audio_chunks 출력)
    ↓
pydub AudioSegment 로드
    ↓
500ms 프레임 단위 RMS 에너지 계산
    ↓
RMS < 임계값 (예: -40dBFS) & 연속 3초 이상
    ↓
침묵 구간 [{start, end, duration}] 추출
    ↓
FieldNote.nonverbal_markers에 JSON 저장
```

- **ML 모델 불필요**: 에너지 기반 임계값 방식으로 충분
- **의존성**: `pydub` (이미 `merge_audio_chunks`에서 ffmpeg 사용 중이므로 호환)
- **서버 부하**: 낮음 (오디오 에너지 계산은 CPU 경량 작업)

#### 파이프라인 삽입 위치

```
기존: transcribe → refine → summarize → note
변경: transcribe → [nonverbal] → refine → summarize → note
                       ↑
              transcribe 완료 직후, refine 전에 실행
              (별도 step이 아닌, transcribe 후처리로 통합)
```

```python
# process_pipeline.py 변경
async def process_field_note_pipeline(...):
    # Step 1: Transcribe
    ...
    
    # Step 1.5: 비언어 분석 (transcribe 성공 후)
    await _run_nonverbal_analysis(field_note_id, center_id, infra)
    
    # Step 2: Refine (기존)
    ...
```

> **설계 결정**: 비언어 분석을 별도 `processing_step`으로 추가하지 않음.
> `transcribe_status` 완료 후의 후처리로 처리하여, 파이프라인 상태 모델 변경을 피함.
> 실패해도 파이프라인 전체가 멈추지 않음 (non-fatal).

#### 비언어 마커 → 축어록 삽입

refine 단계 입력에 비언어 마커를 텍스트로 삽입:

```
[1] A: 그래서 요즘 힘들었어요.
[--- 4.2초 침묵 ---]
[2] B: 네, 그런 감정이 드셨군요.
```

### 2.3 엔티티 변경

#### FieldNote 모델 (컬럼 추가)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `nonverbal_markers` | Text, nullable | JSON: `[{type, start, end, duration}]` |

#### 비언어 마커 JSON 스키마

```json
[
  {
    "type": "silence",
    "start": 120.5,
    "end": 125.0,
    "duration": 4.5,
    "context": "내담자 발화 직후"
  }
]
```

> 현재는 `silence` 타입만 지원. 추후 `sigh`, `laughter` 등은
> 오디오 분류 모델이 필요하므로 별도 Phase로 분리.

### 2.4 다회기 흐름 추적

#### 현재 한계

```python
# get_previous_summaries.py
# 같은 케이스의 이전 3개 세션 요약만 가져와서 프롬프트에 주입
# → 분석 없이 단순 컨텍스트 제공만 함
```

#### 확장: 케이스 종단 분석

수동 트리거 방식의 케이스 단위 분석. 상담사가 필요할 때 "케이스 분석" 버튼을 눌러 실행.

```
내담자 케이스
    ↓
케이스 내 모든 세션의 요약 + 노트 수집
    ↓
LLM에 종단 분석 프롬프트와 함께 전송
    ↓
CounselingCaseAnalysis 테이블에 저장
```

#### CounselingCaseAnalysis 모델 (신규)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| center_id | String(36), indexed | 센터 ID |
| case_id | String(36), indexed | CounselingCase 참조 |
| content | Text (JSON) | 분석 결과 |
| session_count | Integer | 분석에 포함된 세션 수 |
| model_used | String(80) | 사용된 LLM 모델 |
| triggered_by | String(36) | 실행한 멤버 ID |
| created_at, updated_at, deleted_at | DateTime | 표준 |

#### 분석 결과 JSON 구조

```json
{
  "recurring_themes": ["직장 스트레스", "대인관계 어려움"],
  "emotional_trajectory": [
    {"session": 1, "date": "2026-01-15", "mood": "불안, 우울"},
    {"session": 2, "date": "2026-01-22", "mood": "불안 감소"},
    {"session": 3, "date": "2026-01-29", "mood": "안정적"}
  ],
  "intervention_summary": {
    "인지행동치료": {"frequency": 3, "effectiveness": "긍정적 반응"},
    "마음챙김": {"frequency": 1, "effectiveness": "초기 저항"}
  },
  "progress_summary": "3회기 동안 불안 수준이 점진적으로 감소...",
  "risk_factors": ["수면 문제 지속", "사회적 고립"],
  "recommendations": "인지 재구조화 지속, 수면 위생 교육 추가 필요"
}
```

#### 종단 분석 프롬프트

```python
# pipeline/prompts.py에 추가

CASE_ANALYSIS_SYSTEM_PROMPT = """당신은 심리상담 사례를 종단적으로 분석하는 전문 슈퍼바이저입니다.

여러 회기의 상담 요약과 노트를 시간순으로 제공합니다.
전체 흐름을 분석하여 다음 JSON 구조로 응답하세요:

{
  "recurring_themes": ["반복적으로 등장하는 주제들"],
  "emotional_trajectory": [{"session": 번호, "date": "날짜", "mood": "정서 상태"}],
  "intervention_summary": {"기법명": {"frequency": 사용횟수, "effectiveness": "효과 평가"}},
  "progress_summary": "전체 진행 경과 요약 (3-5문장)",
  "risk_factors": ["위험 요인 목록"],
  "recommendations": "향후 상담 방향 제안"
}

규칙:
- 한국어로 작성
- 관찰 가능한 변화에 기반, 과도한 추론 금지
- 정보가 부족한 필드는 빈 배열 또는 null
- 반드시 유효한 JSON만 반환"""
```

#### 비용 제어

| 세션 수 | 예상 입력 토큰 | 예상 비용 (gpt-4.1) |
|---------|--------------|---------------------|
| 5회기 | ~5,000 | ~$0.01 |
| 10회기 | ~10,000 | ~$0.02 |
| 20회기 | ~20,000 | ~$0.04 |
| 50회기 | ~50,000+ | ~$0.10+ |

> 자동 트리거 시 매 세션 완료마다 비용 누적 → **수동 트리거 필수**
> UI에 예상 비용 표시 후 상담사 확인 후 실행

### 2.5 API 엔드포인트

| Method | Path | 설명 | 신규/수정 |
|--------|------|------|:---------:|
| POST | `/counseling-cases/{id}/analysis` | 케이스 종단 분석 트리거 (수동) | 신규 |
| GET | `/counseling-cases/{id}/analysis` | 분석 결과 목록 | 신규 |
| GET | `/counseling-cases/{id}/analysis/{analysis_id}` | 분석 상세 | 신규 |

### 2.6 수정/생성 파일 목록

#### Backend

| 파일 | 작업 | 내용 |
|------|:----:|------|
| `field_note/field_note/models.py` | 수정 | `nonverbal_markers` 컬럼 추가 |
| `field_note/pipeline/services/nonverbal_analysis.py` | 신규 | 침묵 감지 서비스 (pydub RMS) |
| `field_note/pipeline/handlers/process_pipeline.py` | 수정 | Step 1.5 비언어 분석 삽입 |
| `field_note/pipeline/services/refine_execution.py` | 수정 | 비언어 마커 삽입 로직 |
| `field_note/facade/pipeline_facade.py` | 수정 | nonverbal 데이터 로드 메서드 |
| `field_note/field_note/schemas.py` | 수정 | nonverbal_markers 응답 필드 |
| `counseling/counseling_case_analysis/models.py` | 신규 | CounselingCaseAnalysis 모델 |
| `counseling/counseling_case_analysis/schemas.py` | 신규 | 요청/응답 스키마 |
| `counseling/counseling_case_analysis/repository.py` | 신규 | CRUD |
| `counseling/counseling_case_analysis/services/generate_case_analysis.py` | 신규 | 종단 분석 서비스 |
| `counseling/counseling_case_analysis/handlers/` | 신규 | 핸들러 |
| `counseling/counseling_case_analysis/router.py` | 신규 | 라우터 |
| `field_note/pipeline/prompts.py` | 수정 | CASE_ANALYSIS_SYSTEM_PROMPT 추가 |
| 마이그레이션 2건 | 신규 | nonverbal_markers 컬럼 + case_analyses 테이블 |

#### Frontend

| 파일 | 작업 | 내용 |
|------|:----:|------|
| 축어록 뷰어 컴포넌트 | 수정 | 비언어 마커 시각화 (컬러 뱃지) |
| 케이스 상세 페이지 | 수정 | "케이스 분석" 탭/버튼 추가 |
| `features/counseling/case-analysis/` | 신규 | 분석 결과 표시 Feature 모듈 |

### 2.7 영향도

```
코드 변경량: ■■■□□ (파이프라인 확장 + 신규 서브모듈)
DB 변경:     마이그레이션 2건
비용 영향:   침묵 감지 = 없음, 종단 분석 = 토큰 비용 (수동 트리거로 제어)
기존 코드 파괴: 낮음 (비언어 분석은 non-fatal, 파이프라인 상태 모델 변경 없음)
```

---

## Phase 3: 사례 개념화 + 이론 맞춤

> 영향 범위: 🔴 큼 | 신규 모델 3개 + 크로스 모듈 연동

### 3.1 목표

- 상담 이론 프레임워크 관리 (CBT, 인간중심, 구조적 가족치료 등)
- 상담사별 이론 선호 설정
- 이론 기반 맞춤 노트 생성 (같은 세션을 다른 이론 관점으로 분석)
- 사례 개념화 자동 생성 (검사 결과 연동)

### 3.2 이론 프레임워크

#### TherapyFramework 모델 (신규)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| code | String(30), unique | `cbt`, `person_centered`, `psychodynamic`, `solution_focused`, `structural_family`, `dbt`, `narrative` |
| name_ko | String(100) | 한국어 이름 |
| name_en | String(100) | 영문 이름 |
| description | Text | 이론 설명 |
| note_prompt_supplement | Text | 노트 생성 시 추가 프롬프트 (이론 관점) |
| conceptualization_prompt | Text | 사례 개념화 프롬프트 |
| is_system | Boolean, default=True | 시스템 기본 vs 사용자 추가 |
| is_active | Boolean, default=True | 활성 여부 |
| created_at, updated_at, deleted_at | DateTime | 표준 |

#### 이론별 프롬프트 보충 예시

```python
# CBT 관점 보충 프롬프트 (note_prompt_supplement)
"""추가 분석:
- 내담자의 자동적 사고(automatic thoughts)를 식별하세요
- 인지 왜곡 패턴을 분류하세요 (흑백 사고, 과잉일반화, 재앙화 등)
- 상담사가 사용한 인지 재구조화 기법을 구체적으로 기술하세요
- 행동 실험이나 과제가 있었다면 그 내용과 목적을 기록하세요

JSON에 추가 필드:
"cognitive_distortions": ["식별된 인지 왜곡 목록"],
"automatic_thoughts": "핵심 자동적 사고",
"behavioral_experiments": "행동 실험 내용 (없으면 null)"
"""
```

#### 노트 생성 시 이론 적용 방식

```python
# generate_counseling_note.py 변경

# 기본 서식 프롬프트 (Phase 1의 NOTE_TEMPLATE_REGISTRY)
base_prompt = NOTE_TEMPLATE_REGISTRY.get(template_type, COUNSELING_NOTE_SYSTEM_PROMPT)

# 이론 보충 프롬프트 (Phase 3)
if therapy_framework:
    system_prompt = f"{base_prompt}\n\n{therapy_framework.note_prompt_supplement}"
else:
    system_prompt = base_prompt
```

> **핵심**: 기존 서식 프롬프트에 이론 관점을 **보충**하는 방식.
> SOAP + CBT, DAP + 인간중심 등 서식과 이론의 조합이 가능.

### 3.3 상담사별 이론 설정

#### MemberTherapyPreference 모델 (신규)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| member_id | String(36), indexed | Member 참조 |
| center_id | String(36), indexed | Center 참조 |
| therapy_framework_id | String(36) | 기본 이론 프레임워크 |
| created_at, updated_at | DateTime | 표준 |
| UniqueConstraint | (member_id, center_id) | 센터별 1개 |

### 3.4 사례 개념화 자동 생성

#### CaseConceptualization 모델 (신규)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| center_id | String(36), indexed | 센터 ID |
| case_id | String(36), indexed | CounselingCase 참조 |
| therapy_framework_id | String(36), nullable | 적용된 이론 |
| content | Text (JSON) | 개념화 결과 |
| assessment_data_snapshot | Text (JSON), nullable | 참조된 검사 결과 스냅샷 |
| session_count | Integer | 분석 포함 세션 수 |
| model_used | String(80) | LLM 모델 |
| generated_by | String(36) | 실행자 |
| created_at, updated_at, deleted_at | DateTime | 표준 |

#### 개념화 결과 JSON 구조

```json
{
  "presenting_problem": "주호소 문제 정리",
  "predisposing_factors": ["발달력, 가족력 기반 소인 요인"],
  "precipitating_factors": ["촉발 요인"],
  "perpetuating_factors": ["문제 유지 요인"],
  "protective_factors": ["보호 요인, 강점"],
  "case_formulation": "이론 기반 사례 공식화 (2-3단락)",
  "treatment_goals": [
    {"goal": "단기 목표", "timeframe": "4주", "measurable_outcome": "측정 가능한 결과"}
  ],
  "treatment_plan": "구체적 개입 계획",
  "assessment_integration": "검사 결과 해석 및 통합 (있는 경우)"
}
```

### 3.5 Assessment 크로스 연동

**현재 연동 경로:**

```
field_note → CounselingSessionFacade → session.client_ids
                                          ↓ (Phase 3에서 추가)
                                    AssessmentCaseFacade
                                          ↓
                                    client의 검사 결과 조회
                                          ↓
                                    개념화 프롬프트에 검사 점수 주입
```

> **주의**: Assessment 모듈의 검사 결과 포맷이 검사 종류별로 다름.
> → 검사 요약(점수 + 해석)을 일반화된 포맷으로 변환하는 정규화 레이어 필요.

```python
# 검사 결과 정규화 (assessment facade에 메서드 추가)
async def get_assessment_summary_for_client(
    self, client_id: str, center_id: str
) -> list[dict]:
    """내담자의 모든 검사 결과를 일반화된 포맷으로 반환"""
    return [
        {
            "assessment_name": "BDI-II",
            "date": "2026-01-10",
            "total_score": 25,
            "severity": "중등도 우울",
            "key_findings": "인지적 증상 > 신체적 증상"
        },
        ...
    ]
```

### 3.6 API 엔드포인트

| Method | Path | 설명 | 신규 |
|--------|------|------|:----:|
| GET | `/therapy-frameworks` | 이론 프레임워크 목록 | ✅ |
| GET | `/therapy-frameworks/{id}` | 이론 상세 | ✅ |
| POST | `/therapy-frameworks` | 커스텀 이론 추가 | ✅ |
| PATCH | `/therapy-frameworks/{id}` | 수정 | ✅ |
| GET | `/members/{id}/therapy-preference` | 상담사 이론 설정 조회 | ✅ |
| PATCH | `/members/{id}/therapy-preference` | 상담사 이론 설정 변경 | ✅ |
| POST | `/counseling-cases/{id}/conceptualization` | 사례 개념화 생성 (수동) | ✅ |
| GET | `/counseling-cases/{id}/conceptualization` | 개념화 목록 | ✅ |
| GET | `/counseling-cases/{id}/conceptualization/{cid}` | 개념화 상세 | ✅ |
| POST | `/field-notes/{id}/generate-counseling-note` | 수정: `therapy_framework_id` 파라미터 추가 | 수정 |

### 3.7 수정/생성 파일 목록

#### Backend

| 파일 | 작업 | 내용 |
|------|:----:|------|
| `counseling/therapy_framework/` | 신규 | 전체 서브모듈 (models, schemas, repo, services, handlers, router) |
| `center/member_therapy_preference/` | 신규 | MemberTherapyPreference 서브모듈 |
| `counseling/case_conceptualization/` | 신규 | CaseConceptualization 서브모듈 |
| `field_note/pipeline/handlers/generate_counseling_note.py` | 수정 | 이론 프롬프트 보충 로직 |
| `field_note/pipeline/handlers/process_pipeline.py` | 수정 | 동일 |
| `assessment/facade/` | 수정 | `get_assessment_summary_for_client` 메서드 추가 |
| `field_note/pipeline/prompts.py` | 수정 | 개념화 프롬프트 추가 |
| 마이그레이션 3건 | 신규 | 3개 테이블 |

#### Frontend

| 파일 | 작업 | 내용 |
|------|:----:|------|
| 센터 설정 페이지 | 수정 | 이론 프레임워크 관리 섹션 |
| 멤버 프로필 페이지 | 수정 | 이론 선호 설정 |
| 케이스 상세 페이지 | 수정 | 개념화 탭 + 생성 버튼 |
| `features/counseling/conceptualization/` | 신규 | 개념화 Feature 모듈 |
| `features/counseling/therapy-framework/` | 신규 | 이론 설정 Feature 모듈 |

#### 시드 데이터

```python
# scripts/seed_therapy_frameworks.py (신규)
FRAMEWORKS = [
    {"code": "cbt", "name_ko": "인지행동치료", "name_en": "Cognitive Behavioral Therapy"},
    {"code": "person_centered", "name_ko": "인간중심치료", "name_en": "Person-Centered Therapy"},
    {"code": "psychodynamic", "name_ko": "정신역동치료", "name_en": "Psychodynamic Therapy"},
    {"code": "solution_focused", "name_ko": "해결중심치료", "name_en": "Solution-Focused Therapy"},
    {"code": "structural_family", "name_ko": "구조적 가족치료", "name_en": "Structural Family Therapy"},
    {"code": "dbt", "name_ko": "변증법적 행동치료", "name_en": "Dialectical Behavior Therapy"},
    {"code": "narrative", "name_ko": "이야기치료", "name_en": "Narrative Therapy"},
]
```

### 3.8 영향도

```
코드 변경량: ■■■■■ (신규 서브모듈 3개 + 크로스 모듈 연동)
DB 변경:     마이그레이션 3건 (테이블 3개)
비용 영향:   토큰 비용 증가 (수동 트리거로 제어)
기존 코드 파괴: 중간 (Assessment Facade 확장 필요)
```

---

## 전체 영향도 요약

### Phase별 비교

```
              코드 변경량   DB 변경   비용 영향   기존 파괴 위험   예상 기간
Phase 1       ■■□□□        1건      없음        없음            1-2주
Phase 2       ■■■□□        2건      수동 제어   낮음            2-3주
Phase 3       ■■■■■        3건      수동 제어   중간            3-4주
```

### 의존성 관계

```
Phase 1 (서식 다양화)
    ↓ Phase 2는 Phase 1 없이도 가능하나, 서식 선택 UX와 함께 제공이 자연스러움
Phase 2 (비언어 + 다회기)
    ↓ Phase 3의 사례 개념화는 Phase 2의 다회기 데이터가 있을 때 더 풍부
Phase 3 (개념화 + 이론)
```

### 아키텍처 다이어그램

```
Phase 1                         Phase 2                      Phase 3
┌──────────────┐               ┌──────────────┐             ┌───────────────┐
│ NOTE_TEMPLATE│               │ Nonverbal    │             │ Therapy       │
│ _REGISTRY    │               │ Analysis     │             │ Framework DB  │
│ (SOAP/DAP/) │               │ (pydub RMS)  │             │ + Prompts     │
└──────┬───────┘               └──────┬───────┘             └──────┬────────┘
       │                              │                            │
       ▼                              ▼                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Pipeline Orchestrator                           │
│  transcribe → [nonverbal] → refine → summarize → generate_note        │
│                                                    ↑                    │
│                                          template_type + framework      │
└──────────────────────────────────────────────────────────────────────────┘
       │                              │                            │
       ▼                              ▼                            ▼
┌──────────────┐               ┌──────────────┐             ┌───────────────┐
│ CounselingNote│              │ CaseAnalysis │             │ Case          │
│ (JSONB flex) │               │ (종단 분석)  │             │ Conceptualiz. │
└──────────────┘               └──────────────┘             │ + Assessment  │
                                                            └───────────────┘
```

### 기존 코드 영향 최소화 전략

1. **CounselingNote.content = JSONB**: 어떤 서식이든 스키마 변경 없이 저장
2. **upsert_generated_note = raw dict**: 서비스 코드 수정 불필요
3. **ProductionAIConfig**: 이미 프롬프트 오버라이드 인프라 존재
4. **Non-fatal steps**: 비언어 분석/종단 분석 실패 시 파이프라인 전체 영향 없음
5. **수동 트리거**: 비용이 큰 기능은 자동 실행 안 함

---

## 검증 방법

### Phase 1 검증

1. 마이그레이션 실행 → `note_template_type` 컬럼, `center_note_preferences` 테이블 확인
2. `PATCH /field-notes/{id}/finish` body에 `note_template_type: "soap"` 포함 → SOAP 형식 노트 생성 확인
3. `note_template_type` 미지정 시 → 기존 default 동작 확인 (하위 호환)
4. `GET /field-notes/{id}/export?format=text` → 축어록 텍스트 다운로드 확인
5. 센터 설정에서 기본 서식 변경 → 이후 생성되는 노트에 반영 확인

### Phase 2 검증

1. 3초 이상 침묵이 포함된 테스트 오디오 → `nonverbal_markers` JSON 확인
2. 축어록에 `[--- 4.2초 침묵 ---]` 마커 삽입 확인
3. 케이스 종단 분석: 3회기 이상 데이터가 있는 케이스로 테스트
4. 분석 결과 JSON 구조 및 한글 품질 확인

### Phase 3 검증

1. 시드 데이터 실행 → 7개 이론 프레임워크 조회 확인
2. 같은 세션에 CBT 관점 / 인간중심 관점으로 노트 재생성 → 결과 차이 확인
3. 검사 결과가 있는 내담자의 사례 개념화 → assessment_integration 필드 확인
4. 프론트엔드에서 이론 선택 → 노트 생성 → 결과 표시 E2E

---

*작성일: 2026-04-14*
*Phase 1부터 순차 구현 예정*

## 인계 항목 — domain-refinement 루프에서 이관 (2026-07-09)

어휘 감사에서 발견됐으나 transcribe_status·6-status 슬라이스와 같은 표면이라 이 이니셔티브가 소유:

| 위치 | 위반 | 정본 |
|---|---|---|
| `pipeline/services/summary_execution.py` | 명사 파일명 + 다중 메서드(1 use-case=1 파일 위반) | `{verb}_{noun}` 분리 (naming.md §2-F) |
| `SummaryExecutionService.save_summary` | save 금지 접두 | 의미대로 upsert/update 계열 |
| `facade/pipeline_facade.py` `mark_audio_merged`·`set_audio_transcript`·`clear_audio_transcript` | mark_/set_ 어휘 | 워커 파이프라인 상태 보고 = runtime.md R1 keeper 준용 여부를 스텝 리네임과 함께 판정 |
