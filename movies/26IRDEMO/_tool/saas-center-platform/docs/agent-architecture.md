# Agent Architecture 설계 문서

> 상담센터 SaaS 플랫폼에 에이전트를 도입하기 위한 아키텍처 설계 문서.
> 현재 모듈러 모놀리스 구조를 기반으로 점진적 도입 전략을 정의한다.

---

## 1. 에이전트란 무엇인가 (제1원칙)

### 1.1 본질

```
기존 소프트웨어:  입력 → 고정된 로직 → 출력   (1회성)
에이전트:         목표 → 관찰 → 판단 → 행동 → ... → 목표 달성  (루프)
```

에이전트의 본질은 3가지 요소의 반복이다:

| 요소 | 설명 | 현재 시스템 대응 |
|------|------|-----------------|
| **Perception** (관찰) | 현재 상태를 읽는다 | Repository가 DB를 읽는 것 |
| **Reasoning** (판단) | 다음 행동을 결정한다 | Service의 if/else 분기 |
| **Action** (행동) | 상태를 변경한다 | Service가 엔티티를 수정하는 것 |

핵심 차이: 기존 Service는 "한 번" 실행하고 끝나지만, 에이전트는 **목표에 도달할 때까지 루프**를 돈다.

### 1.2 자동화와 에이전트의 차이

```
자동화 (Automation):
  IF 세션 8회 완료 → THEN 케이스 상태를 "완료"로 변경
  → 규칙이 미리 정해져 있음. 예외 없음.

에이전트 (Agent):
  "이 케이스를 적절히 마무리해줘"
  → 세션 출석률 확인 → 미완료 검사 확인 → 보호자 피드백 확인
  → 상태를 "완료"로 할지 "연장"으로 할지 판단
  → 규칙이 아니라 "목표"가 주어짐
```

### 1.3 현재 아키텍처와의 관계

```
현재:
  Request → Router → Handler → Facade → Service → DB
  (1회성, 동기적, 사람이 트리거)

에이전트 추가 시:
  Scheduler → Agent → [Rule|LLM] → Facade → Service → DB
  (비동기, 반복적, 목표 지향적, 시스템이 트리거)
```

**Facade가 곧 에이전트의 Tool이 된다.** 이것이 현재 설계의 가장 큰 장점이다.

---

## 2. 도메인별 규칙 기반 vs 판단 필요 경계

### 2.1 Assessment 도메인

#### 규칙 기반으로 충분한 것

| 기능 | 로직 | 현재 상태 |
|------|------|----------|
| Task 자동 생성 | Case 생성 시 assessment_ids 개수만큼 1:1 Task 생성 | 구현됨 |
| 상태 전이 | PENDING→PROCESSING→COMPLETED, 모든 Task 완료 시 Case 자동 완료 | 구현됨 |
| execution_method 결정 | Assessment.supports_online 플래그 기반 online/onsite 결정 | 구현됨 |
| 미완료 리마인더 발송 | Task가 PENDING 상태로 N일 경과 시 SMS/AlarmTalk 발송 | **미구현** |
| 만료 처리 | online Task 응답 기한 초과 시 자동 CANCELLED 또는 경고 | **미구현** |
| Scoring 자동 계산 | self_report 완료 시 Assessment.definition.scoring 규칙 적용 | 부분 구현 |

#### 판단이 필요한 것 (에이전트 영역)

| 기능 | 왜 판단이 필요한가 | 엔진 |
|------|-------------------|------|
| 검사 결과 해석 보조 | 단일 척도 해석은 규칙이지만, 복수 척도 패턴 해석은 전문가 경험에 의존 (불안+우울 동시 상승 = 내재화 문제) | LLM + 도메인 지식 |
| 보고서 초안 생성 | report_payload의 subscale 점수를 자연어 문장으로 변환 ("ANXIETY_DEPRESSED: 12점, NORMAL" → "불안/우울 영역은 정상 범위입니다") | LLM |
| 보호자 보고서 공개 판단 보조 | is_report_visible_to_guardian 결정 시 아동의 자해 관련 응답 포함 여부 등 맥락 판단 필요 | 하이브리드 (키워드 + LLM) |
| 추가 검사 추천 | 완료된 검사 결과 패턴 분석 → 교차 해석 기반 추가 검사 권장 | LLM + 도메인 지식 |

### 2.2 Counseling 도메인

#### 규칙 기반으로 충분한 것

| 기능 | 로직 | 현재 상태 |
|------|------|----------|
| 중복 케이스 감지 | 같은 프로그램+상담사+내담자+시간(5분 내) 비교 | 구현됨 |
| 케이스 종결 검증 | SCHEDULED 세션 존재 시 종결 불가 | 구현됨 |
| 세션 리마인더 | scheduled_at - 24h 시점에 SMS 자동 발송 | **미구현** |
| 출석률 통계 | COMPLETED / 전체 세션 수 = 출석률 (단순 산술) | **미구현** |
| 연속 NO_SHOW 감지 | 3회 연속 NO_SHOW 시 경고 알림 (카운팅 규칙) | **미구현** |

#### 판단이 필요한 것 (에이전트 영역)

| 기능 | 왜 판단이 필요한가 | 엔진 |
|------|-------------------|------|
| 상담 노트 요약 | CounselingNote의 자유 텍스트를 구조화된 요약으로 변환 (주호소, 진행, 계획) | LLM |
| 종결/연장 판단 보조 | total_sessions 소진 시 출석률+목표 달성도+노트 내용 종합 판단 (chief_complaint vs 현재 상태 비교) | LLM |
| 위기 감지 | "죽고 싶다"가 비유인지 실제 위기인지 맥락 판단 (키워드 매칭만으로는 false positive 과다) | 하이브리드 (키워드 + LLM) |
| 상담사 매칭 추천 | 내담자 특성+상담사 전문분야+경력+케이스 수+선호 등 다차원 매칭 | LLM 또는 가중치 규칙 |
| 치료 계획 초안 | intake 세션 내용 기반 treatment plan 초안 생성 | LLM |

### 2.3 Schedule 도메인

#### 규칙 기반으로 충분한 것

| 기능 | 로직 | 현재 상태 |
|------|------|----------|
| 충돌 감지 | room_id 기준 시간 겹침 검사 (A.start < B.end AND A.end > B.start) | 구현됨 |
| 반복 일정 확장 | 반복 규칙에 따른 날짜 생성 | 구현됨 |
| 자동 슬롯 제안 | 빈 시간대 탐색 (쿼리 기반) | **미구현** |

#### 판단이 필요한 것

| 기능 | 왜 판단이 필요한가 | 엔진 |
|------|-------------------|------|
| 최적 시간 추천 | 내담자 선호+상담사 가용+방 배정 다차원 최적화 | 가중치 규칙 (LLM 불필요) |

### 2.4 경계 요약

| 판단 유형 | 예시 | 필요한 엔진 |
|-----------|------|------------|
| **패턴 매칭** | 상태 전이, 충돌 감지, 카운팅 | Rule Engine |
| **다차원 최적화** | 스케줄 추천, 상담사 매칭 | Rule Engine + 가중치 |
| **자연어 이해** | 노트 요약, 위기 감지, 보고서 생성 | LLM |
| **도메인 추론** | 검사 결과 해석, 추가 검사 추천 | LLM + 도메인 지식 |

---

## 3. 에이전트 권한 관리

### 3.1 설계 원칙: 에이전트 = 특수한 Member

현재 RBAC 시스템을 확장하여 에이전트를 통합한다.

```
현재 시스템:
  Account → Member → Role → Permission
  (사람)    (센터소속) (역할)  (권한)

에이전트 도입 시:
  AgentAccount → Member → AgentRole → Permission
  (에이전트)     (센터소속) (에이전트 전용) (기존 권한 재사용)
```

#### 기존 시스템 확장 근거

1. **center_id 스코핑이 이미 완벽** — 에이전트도 특정 센터에 소속
2. **Permission 체계 재사용 가능** — read:assessment, write:counseling 등 이미 세분화
3. **token_version 즉시 무효화** — 에이전트 이상 행동 시 즉시 권한 차단

### 3.2 Account 타입 확장

```python
class AccountType(str, Enum):
    HUMAN = "human"
    AGENT = "agent"

# Account 모델 필드 추가
account_type: AccountType = AccountType.HUMAN
```

### 3.3 에이전트 전용 Role 정의

```python
AGENT_ROLES = {
    "agent_assessment_reader": [
        "read:assessment_case",
        "read:assessment_task",
        "read:client",
    ],
    "agent_counseling_assistant": [
        "read:counseling_case",
        "read:counseling_session",
        "read:counseling_note",
        # write 없음 — 제안만 가능
    ],
    "agent_notification_sender": [
        "read:schedule",
        "read:client",
        "write:messaging",       # 메시지 발송만 가능
    ],
}
```

### 3.4 에이전트 권한 3원칙

| 원칙 | 내용 |
|------|------|
| **최소 권한 (Least Privilege)** | 필요한 read 권한만 기본 부여. write/manage는 명시적 승인 필요 |
| **행동은 제안, 실행은 승인** | 에이전트가 제안 → 상담사가 승인 → 실제 상태 변경. 고위험 행동은 human-in-the-loop 필수 |
| **모든 행동은 감사 추적** | ActivityLog.actor_id = agent의 member_id. 에이전트의 모든 행동 추적 가능 |

### 3.5 행동 수준(Level) 분류

| Level | 유형 | 설명 | 예시 |
|-------|------|------|------|
| **Level 0** | 자동 실행 | 읽기, 분석, 통계 계산 | 출석률 계산, 미완료 태스크 목록 조회 |
| **Level 1** | 자동 실행 + 로깅 | 알림 발송, 리마인더 | 세션 리마인더 SMS 발송 |
| **Level 2** | 제안 → 승인 | 상태 변경, 보고서 생성 | "케이스 A-2401-005 종결 권장" |
| **Level 3** | 금지 | 삭제, 권한 변경 | delete:\*, manage:role 등 |

### 3.6 AgentSuggestion 모델

Level 2 행동을 위한 제안-승인 테이블:

```python
class AgentSuggestion(BaseModel):
    """에이전트의 제안을 저장하고 사람의 승인을 관리"""
    __tablename__ = "agent_suggestions"

    id: str                         # UUID PK
    center_id: str                  # 멀티테넌시
    agent_member_id: str            # 어떤 에이전트가
    target_entity_type: str         # 무엇에 대해 (assessment_case, counseling_case 등)
    target_entity_id: str           # 대상 엔티티 ID
    action: str                     # 어떤 행동을 (close_case, generate_report 등)
    payload: dict                   # 구체적 내용 (JSONB)
    reasoning: str                  # 왜 이 제안을 했는지
    confidence: float               # 확신도 (0.0 ~ 1.0)
    status: str                     # pending → approved / rejected
    reviewed_by: str | None         # 승인/거절한 사람의 member_id
    reviewed_at: datetime | None
    created_at: datetime
```

### 3.7 승인 플로우

```
Agent 판단
    │
    ├─ Level 0-1: 즉시 실행 → ActivityLog 기록
    │
    └─ Level 2: AgentSuggestion 생성 (status=pending)
                    │
                    ▼
               상담사 UI에 알림 표시
                    │
                    ├─ 승인 → Handler가 실제 행동 실행 → ActivityLog 기록
                    │         (reviewed_by, reviewed_at 기록)
                    │
                    └─ 거절 → status=rejected, 사유 기록
                              (에이전트 학습 데이터로 활용 가능)
```

---

## 4. LLM + 규칙 엔진 구성

### 4.1 이원 구조 아키텍처

규칙 엔진과 LLM을 **같은 인터페이스(Protocol) 뒤에** 배치한다.

```
┌──────────────────────────────────────────────────┐
│                 Agent Runtime                     │
│                                                   │
│   ┌──────────────┐     ┌──────────────┐          │
│   │  Rule Engine  │     │  LLM Engine   │          │
│   │  - if/else    │     │  - Claude API │          │
│   │  - 상태 머신   │     │  - 프롬프트    │          │
│   │  - 임계값 비교 │     │  - 도메인 지식  │          │
│   └──────┬───────┘     └──────┬───────┘          │
│          │                    │                    │
│          └──────┬─────────────┘                    │
│                 ▼                                   │
│         ┌──────────────┐                           │
│         │  Reasoning    │  ← 공통 Protocol          │
│         │  Engine       │                           │
│         └──────┬───────┘                           │
│                ▼                                    │
│         ┌──────────────┐                           │
│         │  Facade       │  ← 기존 시스템 재사용      │
│         │  (Tools)      │                           │
│         └──────────────┘                           │
└──────────────────────────────────────────────────┘
```

### 4.2 공통 인터페이스 (Protocol)

```python
# app/agents/core/reasoning.py

from typing import Protocol
from dataclasses import dataclass


@dataclass
class ReasoningResult:
    action: str              # "send_reminder", "suggest_closure", "no_action"
    confidence: float        # 0.0 ~ 1.0
    payload: dict            # 행동에 필요한 데이터
    reasoning: str           # 판단 근거 (감사 추적용)
    requires_approval: bool  # human-in-the-loop 필요 여부


class ReasoningEngine(Protocol):
    """규칙 엔진과 LLM이 동일하게 구현하는 인터페이스"""

    async def evaluate(
        self, context: dict, goal: str
    ) -> ReasoningResult: ...
```

### 4.3 규칙 엔진 구현 예시

```python
# app/agents/engines/rule_engine.py

class AssessmentReminderRule(ReasoningEngine):
    """검사 미완료 리마인더 — 순수 규칙"""

    async def evaluate(self, context: dict, goal: str) -> ReasoningResult:
        task = context["task"]
        days_since = (now() - task.created_at).days

        if task.status == "pending" and days_since > 3:
            return ReasoningResult(
                action="send_reminder",
                confidence=1.0,           # 규칙이므로 확신도 100%
                payload={"task_id": task.id, "days_overdue": days_since},
                reasoning=f"Task가 {days_since}일간 pending 상태",
                requires_approval=False,  # Level 1: 자동 실행
            )
        return ReasoningResult(action="no_action", confidence=1.0,
                               payload={}, reasoning="조건 미충족",
                               requires_approval=False)


class ConsecutiveNoShowRule(ReasoningEngine):
    """연속 NO_SHOW 감지 — 순수 규칙"""

    async def evaluate(self, context: dict, goal: str) -> ReasoningResult:
        sessions = context["recent_sessions"]
        consecutive = 0
        for s in reversed(sessions):
            if s.status == "no_show":
                consecutive += 1
            else:
                break

        if consecutive >= 3:
            return ReasoningResult(
                action="suggest_case_review",
                confidence=1.0,
                payload={"consecutive_noshow": consecutive},
                reasoning=f"최근 {consecutive}회 연속 NO_SHOW",
                requires_approval=True,   # Level 2: 상담사 확인
            )
        return ReasoningResult(action="no_action", confidence=1.0,
                               payload={}, reasoning="연속 NO_SHOW 없음",
                               requires_approval=False)
```

### 4.4 LLM 엔진 구현 예시

```python
# app/agents/engines/llm_engine.py

class CounselingNoteSummarizer(ReasoningEngine):
    """상담 노트 요약 — LLM 필요"""

    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    async def evaluate(self, context: dict, goal: str) -> ReasoningResult:
        notes = context["session_notes"]
        case = context["case"]

        prompt = f"""
        상담 케이스 정보:
        - 주호소: {case.chief_complaint}
        - 상담 목표: {case.goal}

        최근 세션 노트:
        {notes}

        위 내용을 다음 구조로 요약해주세요:
        1. 현재 주요 이슈
        2. 진행 상황 (목표 대비)
        3. 다음 세션 권장 초점
        """

        response = await self.llm.complete(prompt)

        return ReasoningResult(
            action="provide_summary",
            confidence=0.85,              # LLM이므로 확신도 < 1.0
            payload={"summary": response},
            reasoning="LLM 기반 노트 요약 생성",
            requires_approval=True,       # Level 2: 상담사 검토 필요
        )
```

### 4.5 하이브리드 엔진 구현 예시

```python
# app/agents/engines/hybrid_engine.py

class CrisisDetector(ReasoningEngine):
    """위기 감지 — 키워드 규칙 + LLM 맥락 판단"""

    CRISIS_KEYWORDS = ["자해", "자살", "죽고 싶", "살기 싫"]

    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    async def evaluate(self, context: dict, goal: str) -> ReasoningResult:
        note_text = context["note_text"]

        # Phase 1: 규칙 기반 키워드 스캔 (빠르고 비용 0)
        keyword_hits = [kw for kw in self.CRISIS_KEYWORDS if kw in note_text]

        if not keyword_hits:
            return ReasoningResult(
                action="no_action", confidence=0.95,
                payload={}, reasoning="위기 키워드 미감지",
                requires_approval=False,
            )

        # Phase 2: 키워드 감지 시에만 LLM 호출 (비용 절약)
        prompt = f"""
        상담 노트에서 다음 키워드가 감지되었습니다: {keyword_hits}

        노트 전문:
        {note_text}

        이 맥락에서 실제 위기 상황인지 판단해주세요:
        - CRISIS: 즉각적 개입 필요
        - EXPRESSIVE: 비유적 표현, 일시적 감정
        - HISTORICAL: 과거 경험 회상
        """

        assessment = await self.llm.complete(prompt)

        return ReasoningResult(
            action="crisis_alert",
            confidence=0.9,
            payload={"keywords": keyword_hits, "assessment": assessment},
            reasoning=f"키워드 {keyword_hits} 감지 후 LLM 맥락 분석 수행",
            requires_approval=True,  # 항상 사람 확인
        )
```

### 4.6 엔진 선택 전략

```
요청 수신
    │
    ▼
  판단 유형 분류
    │
    ├─ 결정적(deterministic)?  → Rule Engine   (비용 0,   지연 0ms)
    │   예: 상태 전이, 임계값, 카운팅
    │
    ├─ 하이브리드?             → Rule → LLM    (비용 최소화)
    │   예: 위기 감지 (키워드 선행 → 맥락 판단)
    │
    └─ 자연어 이해 필수?       → LLM Engine    (비용 발생, 지연 1-3초)
        예: 노트 요약, 보고서 생성
```

핵심: **LLM 호출을 최소화**한다. 규칙으로 먼저 걸러내고, 진짜 판단이 필요한 경우에만 LLM 호출.

### 4.7 LLM 비용 관리

| 전략 | 설명 |
|------|------|
| **계층적 필터링** | Rule Engine이 먼저 처리 → LLM 호출 건수 자체를 줄임 |
| **프롬프트 캐싱** | 동일 검사 유형의 해석 프롬프트는 캐싱 (Assessment.definition 기반) |
| **배치 처리** | 실시간이 아닌 일괄 처리로 API 호출 최적화 (노트 요약 등) |
| **모델 티어링** | 간단한 분류 → 소형 모델, 복잡한 추론 → 대형 모델 |
| **센터별 한도** | 센터 구독 플랜에 따른 LLM 호출 월간 한도 설정 |

---

## 5. 에이전트 조직 전략

### 5.1 결론: 도메인별 분리 + 공통 런타임

```
agents/
├── core/             # 공통 런타임 (모든 에이전트가 사용)
│   ├── base.py       # BaseAgent (관찰-판단-행동 루프)
│   ├── reasoning.py  # ReasoningEngine Protocol
│   ├── registry.py   # 에이전트 등록/관리
│   └── scheduler.py  # 에이전트 실행 스케줄러
│
├── engines/          # 판단 엔진 (Rule, LLM, Hybrid)
│   ├── rule_engine.py
│   ├── llm_engine.py
│   └── hybrid_engine.py
│
├── assessment/       # Assessment 도메인 에이전트들
│   ├── reminder_agent.py        # 미완료 검사 리마인더 (규칙)
│   ├── progress_agent.py        # 진행률 모니터링 (규칙)
│   ├── report_agent.py          # 보고서 초안 생성 (LLM)
│   └── interpretation_agent.py  # 결과 해석 보조 (LLM)
│
├── counseling/       # Counseling 도메인 에이전트들
│   ├── session_reminder_agent.py  # 세션 리마인더 (규칙)
│   ├── noshow_monitor_agent.py    # NO_SHOW 모니터링 (규칙)
│   ├── note_summary_agent.py      # 노트 요약 (LLM)
│   ├── crisis_detector_agent.py   # 위기 감지 (하이브리드)
│   └── closure_advisor_agent.py   # 종결 판단 보조 (LLM)
│
└── scheduling/       # Schedule 도메인 에이전트들
    └── conflict_monitor_agent.py  # 충돌 사전 감지 (규칙)
```

### 5.2 도메인별 분리 근거

| 근거 | 설명 |
|------|------|
| **도메인 지식 격리** | Assessment 에이전트는 검사 점수 해석을, Counseling 에이전트는 상담 프로세스를 알아야 함. 하나에 다 넣으면 프롬프트 비대화 → LLM 비용 증가 + 정확도 하락 |
| **권한 범위 격리** | Assessment Agent: read:assessment_\*, Counseling Agent: read:counseling_\*. 각 에이전트의 Facade 접근 범위가 다름 → 최소 권한 원칙 적용 용이 |
| **장애 격리** | Assessment 에이전트 오류 → Counseling 에이전트 정상 동작. 모듈러 모놀리스의 장점을 에이전트에도 적용 |
| **Facade 1:1 매핑** | AssessmentAgent → AssessmentCaseFacade, CounselingAgent → CounselingCaseFacade. 기존 코드 변경 없이 Facade를 Tool로 등록 |

### 5.3 BaseAgent 구조

```python
# app/agents/core/base.py

class BaseAgent:
    """모든 에이전트의 공통 루프"""

    name: str
    domain: str                        # "assessment" | "counseling" | "schedule"
    permissions: list[str]             # 필요한 권한 목록
    engines: list[ReasoningEngine]     # 이 에이전트가 사용하는 판단 엔진들

    async def run_cycle(self, uow: UnitOfWork):
        """한 번의 관찰-판단-행동 사이클"""

        # 1. 관찰: 현재 상태 수집
        context = await self.observe(uow)

        # 2. 판단: 엔진 실행
        for engine in self.engines:
            result = await engine.evaluate(context, self.goal)

            if result.action == "no_action":
                continue

            # 3. 행동
            if result.requires_approval:
                await self.create_suggestion(uow, result)  # Level 2
            else:
                await self.execute_action(uow, result)      # Level 0-1

            # 4. 감사 로그
            await self.log_activity(uow, result)

    async def observe(self, uow: UnitOfWork) -> dict:
        """도메인별 하위 클래스에서 구현"""
        raise NotImplementedError

    async def create_suggestion(self, uow: UnitOfWork, result: ReasoningResult):
        """AgentSuggestion 테이블에 제안 저장"""
        suggestion_repo = uow.repo(AgentSuggestionRepository)
        suggestion = AgentSuggestion(
            center_id=self.center_id,
            agent_member_id=self.agent_member_id,
            target_entity_type=result.payload.get("entity_type", ""),
            target_entity_id=result.payload.get("entity_id", ""),
            action=result.action,
            payload=result.payload,
            reasoning=result.reasoning,
            confidence=result.confidence,
            status="pending",
        )
        suggestion_repo.add(suggestion)

    async def execute_action(self, uow: UnitOfWork, result: ReasoningResult):
        """도메인별 하위 클래스에서 구현"""
        raise NotImplementedError

    async def log_activity(self, uow: UnitOfWork, result: ReasoningResult):
        """ActivityLog에 에이전트 행동 기록"""
        activity_facade = ActivityLogFacade(uow)
        await activity_facade.log(
            center_id=self.center_id,
            actor_id=self.agent_member_id,
            actor_name=self.name,
            category="agent_action",
            action=result.action,
            entity_type=result.payload.get("entity_type", ""),
            entity_id=result.payload.get("entity_id", ""),
            summary=result.reasoning,
        )
```

### 5.4 도메인 에이전트 구현 예시

```python
# app/agents/assessment/reminder_agent.py

class AssessmentReminderAgent(BaseAgent):
    name = "assessment_reminder"
    domain = "assessment"
    permissions = ["read:assessment_case", "read:assessment_task",
                   "read:client", "write:messaging"]

    def __init__(self, center_id: str, agent_member_id: str):
        self.center_id = center_id
        self.agent_member_id = agent_member_id
        self.engines = [AssessmentReminderRule()]
        self.goal = "미완료 검사 태스크에 대한 리마인더 관리"

    async def observe(self, uow: UnitOfWork) -> dict:
        """Assessment 도메인 상태 관찰"""
        task_facade = AssessmentTaskFacade(uow)
        pending_tasks = await task_facade.list_pending_tasks(
            center_id=self.center_id
        )
        return {"tasks": pending_tasks}

    async def execute_action(self, uow: UnitOfWork, result: ReasoningResult):
        """리마인더 발송 실행"""
        messaging_facade = MessagingFacade(uow, self.alarmtalk, self.sms)
        await messaging_facade.send_sms(
            center_id=self.center_id,
            recipient=result.payload["phone"],
            message=f"미완료 검사가 있습니다. ({result.payload['days_overdue']}일 경과)",
        )
```

### 5.5 크로스 도메인 처리

도메인 간 협업이 필요한 경우, 기존 Handler 패턴과 동일하게 Orchestrator에서 조합한다.

```python
# app/agents/orchestrator.py

class CaseClosureOrchestrator:
    """크로스 도메인 조합 — Handler 패턴과 동일"""

    async def evaluate_closure(self, case_id: str, uow: UnitOfWork):
        # Counseling 도메인 확인
        counseling_facade = CounselingCaseFacade(uow)
        case = await counseling_facade.get_case(case_id)
        sessions = await counseling_facade.list_sessions(case_id)

        has_scheduled = any(s.status == "scheduled" for s in sessions)

        # Assessment 도메인 확인 (관련 검사가 있는 경우)
        assessment_facade = AssessmentCaseFacade(uow)
        related_cases = await assessment_facade.find_by_client(case.client_id)
        pending_assessments = [c for c in related_cases if c.status == "processing"]

        # 조합 판단
        if has_scheduled:
            return "종결 불가: 예정된 세션 존재"
        if pending_assessments:
            return f"주의: {len(pending_assessments)}개 검사 진행 중"
        return "종결 가능"
```

---

## 6. 점진적 도입 전략

### Phase 0: 이벤트 기반 자동화 (에이전트 아님)

**목표**: 규칙 기반 자동화 기반 구축

| 작업 | 설명 |
|------|------|
| 미완료 검사 리마인더 | Task.status=pending + N일 경과 → SMS 발송 |
| 세션 리마인더 | scheduled_at - 24h → SMS 발송 |
| 연속 NO_SHOW 경고 | 3회 연속 → 관리자 알림 |
| 검사 만료 처리 | online Task 기한 초과 → 자동 상태 변경 |

**필요 인프라**: BackgroundTasks 또는 Celery Beat (주기적 실행)

### Phase 1: 단순 에이전트 (루프 + 규칙)

**목표**: Agent 런타임 도입, BaseAgent + Rule Engine

| 작업 | 설명 |
|------|------|
| Agent Runtime 구축 | BaseAgent, ReasoningEngine Protocol, AgentRegistry |
| AgentSuggestion 모델 | 제안-승인 테이블 |
| Agent 권한 통합 | Account.account_type, AgentRole |
| 규칙 기반 에이전트 배포 | Phase 0의 자동화를 Agent 구조로 전환 |

### Phase 2: LLM 에이전트 (루프 + AI 판단)

**목표**: 자연어 이해가 필요한 영역에 LLM 투입

| 작업 | 설명 |
|------|------|
| LLM Engine 구축 | LLMClient 통합, 프롬프트 관리 |
| 상담 노트 요약 | CounselingNote → 구조화된 요약 |
| 검사 결과 해석 보조 | report_payload → 자연어 해석문 초안 |
| 위기 감지 (하이브리드) | 키워드 Rule + LLM 맥락 판단 |

### Phase 3: 멀티 에이전트 (에이전트 간 협업)

**목표**: 크로스 도메인 Orchestrator 도입

| 작업 | 설명 |
|------|------|
| CaseClosureOrchestrator | Counseling + Assessment 종합 종결 판단 |
| IntakeAssistant | 접수 → 검사 배정 → 스케줄 생성 자동화 |
| 치료 계획 초안 생성 | intake 내용 기반 treatment plan 초안 |

---

## 7. 전체 아키텍처 요약

```
┌──────────────────────────────────────────────────────────────────┐
│                    현재 아키텍처와 에이전트의 관계                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  기존:  Request → Router → Handler → Facade → Service → DB       │
│                                                                    │
│  추가:  Scheduler → Agent → [Rule|LLM] → Facade → Service → DB  │
│                      │                                             │
│                      ├─ 권한: 기존 RBAC 확장 (AgentRole)           │
│                      ├─ 감사: 기존 ActivityLog 재사용               │
│                      ├─ 알림: 기존 MessagingFacade 재사용           │
│                      └─ 승인: AgentSuggestion (새로 추가)          │
│                                                                    │
│  설계 원칙:                                                        │
│    1. Facade가 곧 Tool → 기존 코드 변경 없음                      │
│    2. 규칙 먼저, LLM은 진짜 필요할 때만                            │
│    3. 도메인별 분리, 크로스 도메인은 Orchestrator                   │
│    4. 고위험 행동은 반드시 사람 승인                                │
│    5. 모든 행동은 ActivityLog로 감사 추적                          │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. 새로 추가해야 하는 것 (최소)

| 구성 요소 | 설명 | 해당 Phase |
|-----------|------|-----------|
| `agents/core/base.py` | BaseAgent (관찰-판단-행동 루프) | Phase 1 |
| `agents/core/reasoning.py` | ReasoningEngine Protocol, ReasoningResult | Phase 1 |
| `agents/core/registry.py` | 에이전트 등록/관리/실행 | Phase 1 |
| `agents/core/scheduler.py` | 주기적 에이전트 실행 (Celery Beat 등) | Phase 1 |
| `agents/engines/rule_engine.py` | 규칙 기반 판단 엔진 | Phase 1 |
| `agents/engines/llm_engine.py` | LLM 기반 판단 엔진 | Phase 2 |
| `agents/engines/hybrid_engine.py` | 규칙 + LLM 하이브리드 엔진 | Phase 2 |
| `AgentSuggestion` 모델 | 제안-승인 테이블 | Phase 1 |
| `Account.account_type` | HUMAN/AGENT 구분 필드 | Phase 1 |
| Agent 전용 Role 정의 | 에이전트별 최소 권한 Role | Phase 1 |
| LLMClient 인프라 | Claude API 통합, 프롬프트 관리 | Phase 2 |
