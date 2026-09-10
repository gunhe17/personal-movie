# Field Note AI 분석 렌즈 결정 위계 (Analysis Lens Resolution)

> 필드노트 AI 분석 시 "상담 회기"인지 "심리검사"인지 판단해 서로 다른 분석을 적용하는 신호 위계 설계. **기획 문서 (미구현)**

---

## 배경

### 문제 제기

필드노트 AI 분석은 상담과 검사에 대해 **이미 서로 다른 렌즈**로 동작한다. 하지만 둘을 가르는 판단 신호가 `task_id` 유무 **하나뿐**이라, 검사 일정에 연결됐지만 task가 없거나 아예 미연결된 노트는 전부 **상담으로 default** 된다.

상담과 검사는 AI 분석 결과 구조 자체가 달라야 하므로(아래 참고), 연결이 불완전하더라도 올바른 렌즈가 적용되도록 판단 신호를 보강할 필요가 있다.

### 현재 동작 (as-is)

분석 렌즈 분기는 단 한 곳에서 일어난다:

`apps/api/app/modules/field_note/facade/pipeline_facade.py:548`

```python
# 검사 항목(task) 연결 노트는 검사 렌즈로 분기 (field_note 자기 컬럼만 읽음 — cross-module 의존 없음).
is_assessment = bool(field_note.task_id)
actor_label = "검사자" if is_assessment else "상담사"
context_label = "검사 정보" if is_assessment else "회기 정보"
```

이 분기에 따라 두 프롬프트 중 하나가 선택된다 (`apps/api/app/modules/field_note/pipeline/prompts.py`):

| 렌즈 | 프롬프트 | 결과 JSON 필드 |
|------|----------|---------------|
| **상담** (`SUMMARY_ANALYSIS_SYSTEM_PROMPT`) | 요약·정서·이슈 (해석 허용) | `summary`, `keywords`, `issues`, `mood`, `highlights` |
| **검사** (`ASSESSMENT_ANALYSIS_SYSTEM_PROMPT`) | 해석 금지·verbatim 정리 | `summary`, `responses`, `observations`, `quotes`, `highlights` |

프론트(`apps/mobile/.../AIAnalysisView.tsx`)는 "데이터 있는 섹션만" 렌더하므로, 서버가 어떤 렌즈로 분석했는지에 따라 화면이 달라진다.

### Gap (연결 케이스별 판정)

| 케이스 | 현재 판정 | 정확? |
|--------|-----------|:----:|
| 검사 task에 연결 (`task_id` 있음) | 검사 | ✅ |
| `schedule_type="assessment"` 일정에 연결, task 없음 | **상담** | ❌ |
| 아무 데도 연결 안 됨 (FAB로 그냥 녹음) | **상담** | ❓ |

마지막 두 줄이 이 문서가 해결하려는 빈틈이다.

---

## 설계: 렌즈 결정 위계

`is_assessment = bool(task_id)` 단일 신호를, 아래 **우선순위 resolver**로 교체한다.

```
1. analysis_lens_override (사용자 수동 선택)   → 있으면 무조건 채택
2. task_id 있음                                → 검사
3. schedule_id → schedule_type 조회
       "assessment"           → 검사
       그 외(counseling 등)   → 상담
4. (위 전부 해당 없음 = 완전 미연결) → 내용 기반 LLM 분류
5. fallback                                     → 상담
```

**핵심 원칙: 명시적 신호 > 추론.** 확실한 연결 정보(override → task → schedule)를 먼저 쓰고, 내용 기반 추론은 마지막 폴백으로만 둔다. 임상 기록이라 오분류 비용이 크므로, 추론하더라도 사용자가 뒤집을 수 있어야 한다.

### 의사코드

```python
def resolve_analysis_lens(field_note, schedule_type=None, content_lens=None) -> str:
    # 1. 사용자 수동 override 최우선
    if field_note.analysis_lens_override in ("assessment", "counseling"):
        return field_note.analysis_lens_override
    # 2. 검사 task 연결
    if field_note.task_id:
        return "assessment"
    # 3. 일정 타입
    if schedule_type == "assessment":
        return "assessment"
    if schedule_type:  # counseling / meeting 등
        return "counseling"
    # 4. 완전 미연결 → 내용 기반 분류 결과
    if content_lens in ("assessment", "counseling"):
        return content_lens
    # 5. 기본값
    return "counseling"
```

> `schedule_type`과 `content_lens`는 호출자(`execute_summary`)가 필요한 경우에만 조회해서 주입한다. task_id나 override로 이미 결정되면 추가 조회/LLM 호출을 하지 않는다 (불필요한 비용 회피).

---

## 구현 조각

### B. schedule_type 신호 추가 (백엔드)

- **위치**: `pipeline_facade.execute_summary` (`pipeline_facade.py:546~571`)
- **방법**: `task_id`가 없고 `schedule_id`가 있을 때만 `ScheduleFacade.get_schedule(schedule_id, center_id) → Schedule.schedule_type` 조회.
  - `ScheduleFacade` 위치: `apps/api/app/modules/schedule/facade/schedule_facade.py:93` (`get_schedule` → `Schedule` 엔티티 반환)
- **트레이드오프**: 현재 파이프라인은 의도적으로 "자기 컬럼만 읽음(cross-module 의존 없음)"으로 설계됨(`pipeline_facade.py:546` 주석). schedule_type을 읽으면 Schedule 모듈에 대한 Facade 의존이 1개 생긴다. CLAUDE.md상 **다른 모듈 Facade 호출은 허용 패턴**이므로 규칙 위반은 아니나, 일부러 피했던 부분이라 의식적 결정.
- **리스크**: 낮음 · 효과 즉시 (검사 일정 연결 노트가 바로 검사 렌즈로).

### C. 내용 기반 분류 (백엔드) — 선택

- **목적**: 완전 미연결 노트(연결 정보 0)를 전사 내용으로 상담/검사 판별.
- **방법**: `gateway.generate_text`로 경량 분류 호출. 전사 앞부분(예: ~2000자)만 입력, Haiku 등 저렴 모델 지정(`resolve_config`의 `model_name`).
- **신규 작업**:
  - `prompts.py`: `CLASSIFY_LENS_SYSTEM_PROMPT` 추가 (출력: `"counseling"` | `"assessment"`)
  - `plan_config.py` **4곳** 수정: `AIPurpose.FIELD_NOTE_CLASSIFY_LENS` enum + `FREE_PURPOSES`(무료 권장) + `PURPOSE_ESTIMATED_CREDITS` + `PURPOSE_LABELS`
- **리스크**: 중간. 추가 LLM 호출(비용·지연) + 오분류 가능성(짧은 검사를 상담으로, 검사 결과를 논한 상담을 검사로). **미연결 노트는 드물어 비용 영향은 작음.**
- **대안**: C를 생략하고 D(토글)로만 처리 → 자동 추측 없이 사용자가 직접 선택(오분류 0, 추가 비용 0). **B+D 조합 권장 이유.**

### D. 사용자 렌즈 토글 (풀스택)

- **백엔드**:
  - `field_notes` 컬럼 추가 (alembic 마이그레이션):
    - `analysis_lens` (TEXT/VARCHAR, nullable): 실제 분석에 사용된 유효 렌즈 (표시·프론트 렌더 힌트용)
    - `analysis_lens_override` (nullable): 사용자가 수동 지정한 렌즈 (resolver 1순위)
  - 신규 엔드포인트: `PATCH .../field-notes/{id}/analysis-lens` → override 저장 후 요약 재실행
    - router + handler + facade method
  - 스키마: `FieldNoteResponse`/`FieldNoteDetailResponse`에 `analysis_lens`, `analysis_lens_override` 노출
- **프론트(모바일)**:
  - `types.ts`: `FieldNoteResponse`에 두 필드 추가
  - `api.ts` + `hooks.ts`: 렌즈 설정 액션 + 뮤테이션
  - `CompletedScreen.tsx` / `AIAnalysisView.tsx`: AI 분석 탭에 "상담 / 검사" 토글. 현재 적용된 렌즈 표시 + 변경 시 재분석 트리거 (기존 "다시 분석" 버튼 근처)
- **UX 주의**: 렌즈 토글 = 결과 스키마가 바뀌므로 **AI 재분석(재호출·재과금) 동반**. 토글 시 재분석됨을 사용자에게 알릴 것.
- **리스크**: 큼(풀스택). 단 **D가 들어가면 C의 오분류 리스크를 사용자가 직접 커버** 가능.

---

## 빌드 범위 옵션

| 옵션 | 포함 | 특징 |
|------|------|------|
| **B+D (권장)** | 신호보강 + 사용자 토글 | 자동추측 없음 → 오분류 0, 추가 LLM 비용 0. 미연결은 사용자가 선택. |
| **B+C+D (전체 위계)** | 신호보강 + 내용분류 + 토글 | 가장 완전. 새 AIPurpose + LLM 호출 + 풀스택. 작업량 최대. |
| **B만** | schedule_type 신호만 | 검사 일정 연결 노트 정확도만 우선 개선. 토글·분류는 후속. |

---

## 참고 위치 (구현 시)

| 항목 | 경로 |
|------|------|
| 렌즈 분기 (수정 대상) | `apps/api/app/modules/field_note/facade/pipeline_facade.py:546` |
| 프롬프트 정의 | `apps/api/app/modules/field_note/pipeline/prompts.py` |
| 결과 JSON 파싱 | `apps/api/app/modules/field_note/pipeline/services/summary_execution.py:34` |
| FieldNote 모델 (컬럼 추가) | `apps/api/app/modules/field_note/field_note/models.py:27` |
| Schedule 조회 | `apps/api/app/modules/schedule/facade/schedule_facade.py:93` |
| AIPurpose / 크레딧 | `apps/api/app/modules/llm/credit/plan_config.py:14` |
| LLM Gateway | `apps/api/app/modules/llm/gateway/ai_gateway.py` |
| 모바일 분석 뷰 | `apps/mobile/src/features/field-note/components/AIAnalysisView.tsx` |
| 모바일 완료 화면 | `apps/mobile/src/features/field-note/components/CompletedScreen.tsx` |
| 모바일 타입 | `apps/mobile/src/features/field-note/types.ts` |

---

## 결정 대기

- [ ] 빌드 범위 (B+D / B+C+D / B만)
- [ ] schedule_type cross-module 의존 허용 여부 (현재 "자기 컬럼만" 설계 깨짐)
- [ ] (C 채택 시) 내용 분류를 무료 purpose로 둘지
