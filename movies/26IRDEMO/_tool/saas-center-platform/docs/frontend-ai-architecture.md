# 프론트엔드 AI 아키텍처 진화 설계

> 상담센터 SaaS 플랫폼의 프론트엔드가 AI/Agent 환경으로 전환하기 위한 아키텍처 설계 문서.
> 기존 `agent-architecture.md`(백엔드)와 대응하며, 프론트엔드 관점의 구조 변화를 정의한다.

---

## 1. 현재 아키텍처 진단

### 1.1 현재 데이터 흐름

```
[사용자 클릭]
    │
    ▼
[Action]  ← hooks/actions/*.action.ts
    │        { key: string[], request: (params) => Promise<ApiResponse<T>> }
    │
    ▼
[TanStack Query]  ← hooks/queries/builder.ts
    │               queryBuilder(action, keyId) → createQuery
    │               mutationBuilder(action, invalidateKey) → createMutation
    │
    ▼
[ViewModel]  ← features/*/view-model.ts
    │           mapClientsToVM(), mapAssessmentToVM() 등
    │
    ▼
[Svelte 컴포넌트]  ← $derived로 VM 소비, 이벤트로 Service 호출
```

### 1.2 현재 상태 관리 계층

| 계층 | 도구 | 역할 | 예시 |
|------|------|------|------|
| 서버 상태 | TanStack Query | API 캐시, invalidation | `queryBuilder(getClientList, ...)` |
| 전역 UI | Svelte Store (writable) | 세션, 센터, 알림 | `centerStore`, `auth`, `modalStore`, `snackbarStore` |
| 페이지/컴포넌트 | Svelte 5 Runes | 필터, 폼, 로컬 UI | `$state`, `$derived`, `$effect` |

### 1.3 Feature 모듈 스캐폴드

```
features/{도메인}/
├── constants.ts         # 상수, 탭/필터 옵션
├── filters.ts           # URL ↔ Filters 변환
├── query-builders.ts    # filters → API params 변환
├── view-model.ts        # API 응답 → UI VM 변환
├── *-service.ts         # 모달, 토스트, invalidate 오케스트레이션
├── hooks.svelte.ts      # Svelte 5 runes 기반 필터 훅
└── index.ts             # 공개 API re-export
```

### 1.4 근본적 전제와 한계

현재 아키텍처의 **모든 흐름은 사용자가 시작**한다:

```typescript
// 현재 Action 타입 — 요청-응답 1회성
export type Action<T, TResponse = ApiResponse<T>> = {
  key?: string[];
  request: (params?: any) => Promise<TResponse>;
};
```

```typescript
// 현재 Service 패턴 — 사용자 트리거 전제
function createManageService(deps: { queryClient: QueryClient }) {
  return {
    openCreatePackageModal() { modalStore.open({ onConfirm: () => action.request() }) },
    deletePackage() { /* 확인 모달 → API 호출 → invalidate → 토스트 */ },
  };
}
```

**한계 요약:**

| 한계 | 설명 |
|------|------|
| 요청-응답 전제 | Action 타입이 `Promise<T>` 반환만 지원. 스트리밍, 구독 불가 |
| 사용자 주도 전제 | Service가 "사용자 클릭 → 모달 → 확인 → API" 흐름만 표현 |
| Domain Model 부재 | 비즈니스 규칙이 컴포넌트 `disabled` 조건, 서버 400 에러에 분산 |
| 단방향 데이터 도착 | API가 한 번에 JSON을 내려주는 패턴만 존재. 점진적 도착 없음 |

### 1.5 백엔드 Agent 설계와의 연결점

`agent-architecture.md`에서 정의된 백엔드 구조:

```
Scheduler → Agent → [Rule|LLM] → Facade → Service → DB
```

프론트엔드가 받아야 할 것:

| 백엔드 개념 | 프론트엔드에서 필요한 대응 |
|-------------|---------------------------|
| `AgentSuggestion` (제안-승인 모델) | 제안 목록 조회, 승인/거부 UI, 실시간 알림 |
| `ReasoningResult` (판단 결과) | 신뢰도, 근거 표시, Level별 UI 분기 |
| `ActivityLog` (감사 추적) | Agent 행동 이력 조회 UI |
| LLM 스트리밍 응답 | SSE/WebSocket 수신, 점진적 렌더링 |
| Level 0-3 행동 분류 | Level 2 행동의 human-in-the-loop 승인 UI |

---

## 2. 프론트엔드 모델의 재정의

### 2.1 3계층 모델

개발자가 혼란을 느끼는 이유는, 프론트엔드에서 "모델"이 여러 층위에서 혼용되기 때문이다.

```
┌─────────────────────────────────────────────────┐
│  Server State Model                              │
│  백엔드 API 응답의 형상 (DTO)                      │
│  현재: hooks/actions/*.action.ts 의 반환 타입       │
│  예: ClientListResponse, AssessmentCaseResponse   │
├─────────────────────────────────────────────────┤
│  Domain Model  ← 현재 부재, 신규 도입              │
│  UI와 무관한 비즈니스 규칙의 집합                    │
│  예: 검사 접수 가능 여부, 내담자 활성 상태 판단       │
├─────────────────────────────────────────────────┤
│  View Model                                      │
│  특정 화면을 그리기 위해 가공된 데이터               │
│  현재: features/*/view-model.ts                   │
│  예: ClientCardVM, AssessmentVM                   │
└─────────────────────────────────────────────────┘
```

### 2.2 Domain Model 도입 — `lib/domain/`

Domain Model은 **"UI 프레임워크 없이도 설명 가능한 비즈니스 규칙"**이다.
순수 함수로 구현하며, Svelte/TanStack Query에 의존하지 않는다.

```
lib/domain/
├── assessment.ts     # 검사 도메인 규칙
├── client.ts         # 내담자 도메인 규칙
├── counseling.ts     # 상담 도메인 규칙
├── schedule.ts       # 일정 도메인 규칙
└── types.ts          # 공통 타입 (ValidationResult, Intent 등)
```

#### 예시: assessment.ts

```typescript
// lib/domain/assessment.ts
import type { ValidationResult } from './types';

export function canReceiveAssessment(
  client: { status: string },
  center: { assessmentTypes: string[] },
  assessmentType: string
): ValidationResult {
  if (client.status === 'inactive')
    return { ok: false, reason: '비활성 내담자에게는 검사를 접수할 수 없습니다' };
  if (!center.assessmentTypes.includes(assessmentType))
    return { ok: false, reason: '센터에서 지원하지 않는 검사 유형입니다' };
  return { ok: true };
}

export function getAssessmentProgress(
  tasks: { status: string }[]
): { completed: number; total: number; percentage: number } {
  const completed = tasks.filter(t => t.status === 'completed').length;
  return {
    completed,
    total: tasks.length,
    percentage: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
  };
}

export function canTransitionTo(
  currentStatus: string,
  targetStatus: string
): ValidationResult {
  const transitions: Record<string, string[]> = {
    pending: ['processing', 'cancelled'],
    processing: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };
  const allowed = transitions[currentStatus] ?? [];
  if (!allowed.includes(targetStatus))
    return { ok: false, reason: `${currentStatus}에서 ${targetStatus}로 전환할 수 없습니다` };
  return { ok: true };
}
```

#### 예시: client.ts

```typescript
// lib/domain/client.ts
import type { ValidationResult } from './types';

export function isClientActive(client: { status: string }): boolean {
  return client.status === 'active';
}

export function canDeleteClient(
  client: { status: string },
  ongoingCases: { type: string; id: string }[]
): ValidationResult {
  if (ongoingCases.length > 0)
    return {
      ok: false,
      reason: `진행 중인 케이스가 ${ongoingCases.length}건 있어 삭제할 수 없습니다`,
    };
  return { ok: true };
}
```

#### 예시: types.ts

```typescript
// lib/domain/types.ts
export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export type IntentSource =
  | { kind: 'user' }
  | { kind: 'agent'; agentId: string; confidence: number; reasoning: string };

export interface Intent<T = unknown> {
  type: string;
  payload: T;
  source: IntentSource;
}
```

### 2.3 기존 ViewModel과의 관계

Domain Model과 ViewModel은 **역할이 다르다**:

| 구분 | Domain Model | ViewModel |
|------|-------------|-----------|
| 위치 | `lib/domain/` | `features/*/view-model.ts` |
| 역할 | 비즈니스 규칙 검증/계산 | API 데이터 → UI 표현 변환 |
| 의존성 | 없음 (순수 함수) | Domain Model 사용 가능 |
| 예시 | `canReceiveAssessment()` → `{ ok: false, reason: '...' }` | `mapAssessmentToVM()` → `{ bgColor, iconComponent }` |

```
[API 응답] → [Domain Model 규칙 적용] → [ViewModel 변환] → [UI 렌더링]
```

ViewModel이 Domain Model을 참조하는 예:

```typescript
// features/assessment/manage/view-model.ts (개선 후)
import { getAssessmentProgress } from '$lib/domain/assessment';

export function mapAssessmentCaseToVM(case_: AssessmentCase, tasks: Task[]): AssessmentCaseVM {
  const progress = getAssessmentProgress(tasks);
  return {
    id: case_.id,
    title: case_.assessment_snapshots[0]?.kor_name ?? '',
    progress,
    progressLabel: `${progress.completed}/${progress.total} 완료`,
    // ... UI 전용 필드
  };
}
```

---

## 3. Intent 패턴 — 사용자와 Agent의 공존

### 3.1 핵심 원리

사용자가 버튼을 누르든, Agent가 제안하든, 결국 **같은 형태의 의도(Intent)**로 수렴시킨다.

```
┌──────────────┐       ┌──────────────┐
│  사용자 UI    │       │  Agent Engine │
│  (클릭, 폼)   │       │  (판단, 제안)  │
└──────┬───────┘       └──────┬───────┘
       │                      │
       ▼                      ▼
┌─────────────────────────────────────┐
│         Intent (의도)                │
│  { type, payload, source }          │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Domain Model (검증)                 │
│  validate(intent) → ValidationResult│
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Execute (실행)                      │
│  Action.request() → API 호출        │
└─────────────────────────────────────┘
```

"무엇을 하는가"는 하나로 두고, "누가/어떻게 시작했는가"만 갈라친다.

### 3.2 Intent 타입 정의

```typescript
// lib/domain/types.ts

export type AssessmentIntent =
  | { type: 'RECEIVE_ASSESSMENT'; payload: { clientId: string; assessmentType: string; centerId: string } }
  | { type: 'CANCEL_ASSESSMENT'; payload: { assessmentId: string; reason: string } }
  | { type: 'COMPLETE_TASK'; payload: { taskId: string; result: unknown } };

export type CounselingIntent =
  | { type: 'CREATE_SESSION'; payload: { counselingId: string; scheduledAt: string } }
  | { type: 'COMPLETE_SESSION'; payload: { sessionId: string; note: string } }
  | { type: 'CLOSE_CASE'; payload: { counselingId: string; reason: string } };

export type ScheduleIntent =
  | { type: 'CREATE_SCHEDULE'; payload: { startTime: string; endTime: string; roomId: string } }
  | { type: 'CANCEL_SCHEDULE'; payload: { scheduleId: string; reason: string } };
```

### 3.3 사용자 모드 vs Agent 모드

```typescript
// features/assessment/receive/receive-service.ts (개선 후)
import { canReceiveAssessment } from '$lib/domain/assessment';
import type { Intent, IntentSource } from '$lib/domain/types';

export function createReceiveService(deps: { queryClient: QueryClient }) {
  
  async function processReceiveIntent(intent: Intent<{ clientId: string; assessmentType: string }>) {
    // 1. 같은 Domain 검증 (사용자든 Agent든)
    const validation = canReceiveAssessment(client, center, intent.payload.assessmentType);
    if (!validation.ok) {
      snackbarStore.error(validation.reason);
      return;
    }

    // 2. source에 따라 분기
    if (intent.source.kind === 'user') {
      // 사용자: 즉시 실행
      await receiveAssessmentAction.request(intent.payload);
      snackbarStore.success('검사가 접수되었습니다');
      deps.queryClient.invalidateQueries({ queryKey: ['assessmentList'] });
    } else {
      // Agent: 제안으로 기록 (백엔드 AgentSuggestion과 동일 개념)
      await createAgentSuggestion({
        action: intent.type,
        payload: intent.payload,
        confidence: intent.source.confidence,
        reasoning: intent.source.reasoning,
      });
    }
  }

  return { processReceiveIntent };
}
```

### 3.4 AgentSuggestion과 프론트엔드 연결

백엔드 `agent-architecture.md` 섹션 3.6의 `AgentSuggestion` 모델에 대응하는 프론트엔드 흐름:

```
[백엔드 Agent가 AgentSuggestion 생성]
        │
        ▼
[프론트엔드: SSE/폴링으로 제안 수신]
        │
        ▼
[Agent 제안 알림 UI]  ← 신뢰도, 근거, 대상 엔티티 표시
        │
   ┌────┴────┐
   ▼         ▼
[승인]     [거부]
   │         │
   ▼         ▼
[API: PATCH /agent-suggestions/{id}]
   │         │
   ▼         ▼
[status=approved]  [status=rejected]
   │
   ▼
[백엔드가 실제 행동 실행]
   │
   ▼
[TanStack Query invalidation → UI 갱신]
```

---

## 4. 상태 관리 진화 — Agent State 계층 추가

### 4.1 현재 → 미래 상태 계층

```
현재 (2계층):
┌───────────────────────────────┐
│  서버 상태: TanStack Query     │
│  전역 UI: Svelte Store        │
│  로컬: Svelte 5 Runes        │
└───────────────────────────────┘

미래 (3계층):
┌───────────────────────────────┐
│  서버 상태: TanStack Query     │  ← 변경 없음
├───────────────────────────────┤
│  Agent 상태: Agent Store ★    │  ← 신규 추가
│  - 제안 큐 (AgentSuggestion)  │
│  - 스트리밍 응답 버퍼          │
│  - Agent 연결 상태             │
│  - 승인 대기 목록              │
├───────────────────────────────┤
│  전역 UI: Svelte Store        │  ← 변경 없음
│  로컬: Svelte 5 Runes        │
└───────────────────────────────┘
```

### 4.2 Agent Store 설계

```typescript
// stores/agent.store.ts

import { writable, derived } from 'svelte/store';

export interface AgentSuggestionItem {
  id: string;
  agentName: string;
  action: string;
  targetEntityType: string;
  targetEntityId: string;
  payload: Record<string, unknown>;
  reasoning: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface AgentStreamState {
  id: string;
  status: 'idle' | 'thinking' | 'streaming' | 'done' | 'error';
  tokens: string[];
  progress?: number;
  error?: string;
}

function createAgentStore() {
  const suggestions = writable<AgentSuggestionItem[]>([]);
  const streams = writable<Map<string, AgentStreamState>>(new Map());
  const connectionStatus = writable<'connected' | 'disconnected' | 'reconnecting'>('disconnected');

  const pendingSuggestions = derived(suggestions, ($s) =>
    $s.filter((s) => s.status === 'pending')
  );

  const pendingCount = derived(pendingSuggestions, ($s) => $s.length);

  return {
    suggestions,
    streams,
    connectionStatus,
    pendingSuggestions,
    pendingCount,

    addSuggestion(suggestion: AgentSuggestionItem) {
      suggestions.update((s) => [suggestion, ...s]);
    },

    updateSuggestionStatus(id: string, status: 'approved' | 'rejected') {
      suggestions.update((s) =>
        s.map((item) => (item.id === id ? { ...item, status } : item))
      );
    },

    startStream(id: string) {
      streams.update((m) => {
        m.set(id, { id, status: 'thinking', tokens: [] });
        return new Map(m);
      });
    },

    appendToken(id: string, token: string) {
      streams.update((m) => {
        const stream = m.get(id);
        if (stream) {
          stream.status = 'streaming';
          stream.tokens.push(token);
          m.set(id, { ...stream });
        }
        return new Map(m);
      });
    },

    completeStream(id: string) {
      streams.update((m) => {
        const stream = m.get(id);
        if (stream) m.set(id, { ...stream, status: 'done' });
        return new Map(m);
      });
    },

    clear() {
      suggestions.set([]);
      streams.set(new Map());
    },
  };
}

export const agentStore = createAgentStore();
```

### 4.3 Agent 상태 머신

Agent의 행동은 단순한 로딩/성공/에러가 아니라, 복합적인 상태 전이를 가진다:

```
idle ──→ thinking ──→ suggesting ──→ awaitingApproval ──→ executing ──→ done
  │         │             │                │                 │          │
  │         └─────────────┴────────────────┴─────────────────┘          │
  │                              error ←─────────────────────────────────┘
  │                                │
  └────────────────────────────────┘
```

| 상태 | UI 표현 | 사용자 행동 |
|------|---------|-----------|
| `idle` | 없음 | - |
| `thinking` | "Agent가 분석 중..." 인디케이터 | 취소 가능 |
| `streaming` | 텍스트 점진적 표시 | 생성 중단 가능 |
| `suggesting` | 제안 카드 표시 (신뢰도, 근거) | 승인/수정/거부 |
| `awaitingApproval` | "승인 대기 중" 배지 | 승인/거부 |
| `executing` | 실행 중 프로그레스 | - |
| `done` | 완료 알림 | 되돌리기 가능 |
| `error` | 에러 메시지 | 재시도 |

### 4.4 스트리밍과 TanStack Query 캐시 전환

스트리밍 중에는 Agent Store가 토큰을 버퍼링하고, 완료 후 TanStack Query 캐시로 전환한다:

```typescript
// 스트리밍 중: Agent Store (ephemeral)
agentStore.startStream(requestId);
eventSource.onmessage = (e) => {
  const event = JSON.parse(e.data);
  if (event.type === 'token') agentStore.appendToken(requestId, event.data);
};

// 완료 후: TanStack Query 캐시 (durable)로 전환
eventSource.addEventListener('done', () => {
  agentStore.completeStream(requestId);
  queryClient.invalidateQueries({ queryKey: ['noteSummary', sessionId] });
});
```

---

## 5. 데이터 파이프라인 — SSE/WebSocket 도입

### 5.1 현재와 미래

```
현재:
[프론트엔드] ──HTTP──→ [/api/proxy] ──→ [백엔드 API]
             ←──JSON───            ←──

미래 (추가):
[프론트엔드] ──HTTP──→ [/api/proxy]          ← 기존 유지
             ←──SSE───  [/api/agent/stream]  ← Agent 스트리밍
             ←──WS────  [/api/agent/ws]      ← 실시간 알림 (선택)
```

### 5.2 SSE 구독 계층

기존 `hooks/actions/` (요청-응답)와 병행하여 `hooks/subscriptions/` (이벤트 스트림)을 추가한다:

```
hooks/
├── actions/           # 기존: 요청-응답 (Action 타입)
│   ├── client.action.ts
│   ├── assessment.action.ts
│   └── ...
├── queries/           # 기존: TanStack Query 빌더
│   └── builder.ts
└── subscriptions/     # 신규: SSE/WebSocket 구독
    ├── agent-stream.ts
    └── agent-notification.ts
```

#### SSE 클라이언트

```typescript
// hooks/subscriptions/agent-stream.ts

export interface AgentStreamEvent {
  type: 'token' | 'tool_start' | 'tool_end' | 'thinking' | 'done' | 'error';
  data: string;
  metadata?: Record<string, unknown>;
}

export function createAgentStream(
  endpoint: string,
  params: Record<string, string>,
  callbacks: {
    onToken: (token: string) => void;
    onThinking: (thought: string) => void;
    onDone: (result: unknown) => void;
    onError: (error: string) => void;
  }
) {
  const controller = new AbortController();

  const url = new URL(endpoint, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const eventSource = new EventSource(url.toString());

  eventSource.onmessage = (event) => {
    const parsed: AgentStreamEvent = JSON.parse(event.data);
    switch (parsed.type) {
      case 'token':
        callbacks.onToken(parsed.data);
        break;
      case 'thinking':
        callbacks.onThinking(parsed.data);
        break;
      case 'done':
        callbacks.onDone(JSON.parse(parsed.data));
        eventSource.close();
        break;
      case 'error':
        callbacks.onError(parsed.data);
        eventSource.close();
        break;
    }
  };

  eventSource.onerror = () => {
    callbacks.onError('연결이 끊어졌습니다');
    eventSource.close();
  };

  return {
    cancel() {
      controller.abort();
      eventSource.close();
    },
  };
}
```

### 5.3 NDJSON 이벤트 프로토콜

단순 텍스트 스트리밍이 아니라, **구조화된 이벤트**를 전송한다:

```
data: {"type":"thinking","data":"노트 분석 중..."}

data: {"type":"token","data":"불안/우울 영역은 "}

data: {"type":"token","data":"정상 범위입니다."}

data: {"type":"tool_start","data":"getAssessmentResult","metadata":{"taskId":"123"}}

data: {"type":"tool_end","data":"","metadata":{"taskId":"123","result":"..."}}

data: {"type":"done","data":"{\"summary\":\"...\",\"confidence\":0.85}"}
```

이 프로토콜을 통해 UI는 **무엇이 도착하고 있는지** 정확히 알 수 있다.

### 5.4 성능 목표

| 지표 | 목표 | 설명 |
|------|------|------|
| TTFT (Time-to-First-Token) | 300–700ms | 사용자가 "빠르다"고 느끼는 임계값 |
| 토큰 배치 렌더링 | 30–60ms 간격 | reflow storm 방지 |
| AbortController 응답 | 즉시 | 사용자가 생성 중단 시 즉각 반응 |
| SSE 재연결 | 자동, 3초 내 | `EventSource` 내장 재연결 활용 |

### 5.5 SvelteKit 서버 프록시

현재 `/api/proxy`를 통해 백엔드에 프록시하고 있으므로, SSE도 같은 패턴으로 프록시한다:

```typescript
// routes/api/agent/stream/+server.ts (서버 라우트)
export async function GET({ request, url, cookies }) {
  const token = cookies.get('access_token');
  const backendUrl = `${API_BASE}/agent/stream?${url.searchParams}`;

  const response = await fetch(backendUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
    signal: request.signal,
  });

  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

---

## 6. 컴포넌트 아키텍처 — Agent 인지 UI

### 6.1 설계 원칙

기존 컴포넌트를 **두 벌로 만들지 않는다**. 같은 컴포넌트에 Agent 제안 영역을 조건부로 추가한다.

```
┌────────────────────────────────────────┐
│  검사 접수 폼                            │
│                                        │
│  [내담자 선택]  ← 사용자 입력 또는 Agent 자동 채움  │
│  [검사 유형]    ← 사용자 입력 또는 Agent 자동 채움  │
│                                        │
│  ┌──────────────────────────────┐      │
│  │  Agent 제안 (source=agent)   │      │  ← Agent 모드일 때만 표시
│  │  "이전 상담 기록 기반          │      │
│  │   MMPI-2를 추천합니다"        │      │
│  │  신뢰도: 92%                 │      │
│  │  [승인] [수정] [거부]         │      │
│  └──────────────────────────────┘      │
│                                        │
│  [접수하기]  ← 사용자 직접 실행도 가능     │
└────────────────────────────────────────┘
```

### 6.2 Agent 제안 컴포넌트

```svelte
<!-- lib/components/agent/AgentSuggestionCard.svelte -->
<script lang="ts">
  import type { AgentSuggestionItem } from '$lib/stores/agent.store';

  interface Props {
    suggestion: AgentSuggestionItem;
    onApprove: (id: string) => void;
    onReject: (id: string, reason?: string) => void;
    onModify?: (id: string) => void;
  }

  let { suggestion, onApprove, onReject, onModify }: Props = $props();

  const confidenceLabel = $derived(
    suggestion.confidence >= 0.9
      ? '높음'
      : suggestion.confidence >= 0.7
        ? '보통'
        : '낮음'
  );
</script>

<div class="agent-suggestion" role="region" aria-label="Agent 제안">
  <div class="agent-header">
    <span class="agent-badge">{suggestion.agentName}</span>
    <span class="confidence">신뢰도: {Math.round(suggestion.confidence * 100)}% ({confidenceLabel})</span>
  </div>

  <p class="reasoning">{suggestion.reasoning}</p>

  <div class="actions">
    <button onclick={() => onApprove(suggestion.id)}>승인</button>
    {#if onModify}
      <button onclick={() => onModify(suggestion.id)}>수정</button>
    {/if}
    <button onclick={() => onReject(suggestion.id)}>거부</button>
  </div>
</div>
```

### 6.3 스트리밍 텍스트 컴포넌트

```svelte
<!-- lib/components/agent/StreamingText.svelte -->
<script lang="ts">
  import { agentStore } from '$lib/stores/agent.store';

  interface Props {
    streamId: string;
    onCancel?: () => void;
  }

  let { streamId, onCancel }: Props = $props();

  const stream = $derived.by(() => {
    let current: import('$lib/stores/agent.store').AgentStreamState | undefined;
    agentStore.streams.subscribe((m) => { current = m.get(streamId); })();
    return current;
  });

  const displayText = $derived(stream?.tokens.join('') ?? '');
</script>

{#if stream}
  <div
    class="streaming-container"
    role="status"
    aria-live="polite"
    aria-label="Agent 응답"
  >
    {#if stream.status === 'thinking'}
      <div class="thinking-indicator">분석 중...</div>
    {:else if stream.status === 'streaming'}
      <div class="streaming-text">{displayText}<span class="cursor-blink">|</span></div>
      {#if onCancel}
        <button onclick={onCancel}>생성 중단</button>
      {/if}
    {:else if stream.status === 'done'}
      <div class="completed-text">{displayText}</div>
    {:else if stream.status === 'error'}
      <div class="error-text">오류가 발생했습니다: {stream.error}</div>
    {/if}
  </div>
{/if}
```

### 6.4 Human-in-the-Loop 패턴

백엔드 `agent-architecture.md`의 Level 분류에 대응하는 프론트엔드 처리:

| Level | 백엔드 행동 | 프론트엔드 UI |
|-------|-----------|-------------|
| **Level 0** | 자동 실행 (읽기, 분석) | 표시 없음 또는 결과만 표시 |
| **Level 1** | 자동 실행 + 로깅 (알림 발송) | 토스트 알림: "Agent가 리마인더를 발송했습니다" |
| **Level 2** | 제안 → 승인 (상태 변경) | `AgentSuggestionCard` 표시, 승인/거부 필수 |
| **Level 3** | 금지 (삭제, 권한 변경) | Agent가 이 행동을 제안하지 않음 |

Level 2 승인 플로우:

```typescript
// features/agent/suggestion-service.ts
export function createSuggestionService(deps: { queryClient: QueryClient }) {
  return {
    async approve(suggestionId: string) {
      await patchAgentSuggestion(suggestionId, { status: 'approved' });
      agentStore.updateSuggestionStatus(suggestionId, 'approved');
      snackbarStore.success('제안이 승인되었습니다');
      // 백엔드가 실제 행동 실행 후 관련 쿼리 invalidate
      deps.queryClient.invalidateQueries({ queryKey: ['agentSuggestions'] });
    },

    async reject(suggestionId: string, reason?: string) {
      await patchAgentSuggestion(suggestionId, { status: 'rejected', reason });
      agentStore.updateSuggestionStatus(suggestionId, 'rejected');
      snackbarStore.info('제안이 거부되었습니다');
    },
  };
}
```

### 6.5 접근성

| 요소 | 처리 |
|------|------|
| 스트리밍 텍스트 | `aria-live="polite"` — 스크린 리더가 점진적으로 읽음 |
| Agent 제안 카드 | `role="region"` + `aria-label` — 영역 구분 |
| 승인/거부 버튼 | `aria-describedby` — 어떤 제안에 대한 행동인지 명시 |
| 상태 변화 | `role="status"` — 상태 전이 알림 |

---

## 7. 점진적 마이그레이션 로드맵

### 전체 개요

```
Phase 0          Phase 1          Phase 2          Phase 3
Domain Model     Intent 패턴       Agent State      Agent UI
─────────────→ ─────────────→ ─────────────→ ─────────────→
Agent 없이도     명시적 의도       스트리밍/구독     제안/승인 UI
가치 있음        Command/Event     SSE 파이프라인    Human-in-the-loop

백엔드 대응:
agent-architecture.md
Phase 0          Phase 1          Phase 2          Phase 3
이벤트 자동화     Agent Runtime     LLM Engine       멀티 에이전트
```

---

### Phase 0: Domain Model 분리

> **목표**: 비즈니스 규칙을 순수 함수로 분리. Agent 없이도 코드 품질 향상.

#### 변경 범위

| 작업 | 파일 | 설명 |
|------|------|------|
| domain 폴더 생성 | `lib/domain/` | assessment, client, counseling, schedule, types |
| 규칙 추출 | `features/*/view-model.ts`, `*-service.ts` | 컴포넌트에 흩어진 조건문을 domain 함수로 이동 |
| ViewModel 연결 | `features/*/view-model.ts` | domain 함수를 import하여 사용 |

#### 구체적 추출 대상

```
현재: features/assessment/receive/receive-service.ts 내부
  if (client.status === 'inactive') { snackbar.error('...'); return; }

이동: lib/domain/assessment.ts
  export function canReceiveAssessment(client, center, type): ValidationResult

현재: 컴포넌트 내 disabled 조건
  disabled={tasks.some(t => t.status === 'processing')}

이동: lib/domain/assessment.ts
  export function hasOngoingTask(tasks): boolean
```

#### 리스크

- **낮음**: 순수 함수 추출이므로 기존 동작에 영향 없음
- **주의**: 동일 규칙이 서버에도 있으면 불일치 가능 → 서버 규칙을 기준으로 추출

#### 백엔드 대응

- `agent-architecture.md` Phase 0 (이벤트 기반 자동화)과 병행 가능
- 프론트엔드 Domain Model = 백엔드 Service/Facade의 validation 로직 미러링

---

### Phase 1: Intent 패턴 도입

> **목표**: "무엇을 했는가"를 명시적으로 표현. Command/Event 분리 기반 마련.

#### 변경 범위

| 작업 | 파일 | 설명 |
|------|------|------|
| Intent 타입 정의 | `lib/domain/types.ts` | `Intent<T>`, `IntentSource`, 도메인별 Intent 타입 |
| Service 리팩토링 | `features/*-service.ts` | 직접 API 호출 → Intent 생성 → processIntent() |
| Event 타입 정의 | `lib/domain/events.ts` | `DomainEvent` 타입 (감사 추적 기반) |

#### 예시: 기존 → 변경

```typescript
// 기존
function createDetailService(deps) {
  return {
    async deleteClient(clientId: string) {
      const confirmed = await modalUtils.confirm({ message: '삭제하시겠습니까?' });
      if (!confirmed) return;
      await deleteClientAction.request({ clientId });
      snackbarStore.success('삭제되었습니다');
      deps.queryClient.invalidateQueries({ queryKey: ['clientList'] });
    },
  };
}

// 변경
function createDetailService(deps) {
  return {
    async deleteClient(clientId: string) {
      const intent: Intent = {
        type: 'DELETE_CLIENT',
        payload: { clientId },
        source: { kind: 'user' },
      };

      const validation = canDeleteClient(client, ongoingCases);
      if (!validation.ok) {
        snackbarStore.error(validation.reason);
        return;
      }

      const confirmed = await modalUtils.confirm({ message: '삭제하시겠습니까?' });
      if (!confirmed) return;

      await deleteClientAction.request(intent.payload);
      snackbarStore.success('삭제되었습니다');
      deps.queryClient.invalidateQueries({ queryKey: ['clientList'] });
    },
  };
}
```

#### 리스크

- **중간**: Service 시그니처 변경. 단, 점진적 적용 가능 (한 도메인씩)
- **주의**: 과도한 추상화 방지 — Intent가 단순 래퍼가 되지 않도록

#### 백엔드 대응

- `agent-architecture.md` Phase 1 (Agent Runtime, AgentSuggestion)과 연결
- Intent의 `source: 'agent'` 분기가 Agent 제안 수신의 진입점

---

### Phase 2: Agent State + SSE 파이프라인

> **목표**: Agent 응답을 실시간으로 수신하고 관리하는 인프라 구축.

#### 변경 범위

| 작업 | 파일 | 설명 |
|------|------|------|
| Agent Store | `stores/agent.store.ts` | 제안 큐, 스트리밍 상태, 연결 상태 |
| SSE 클라이언트 | `hooks/subscriptions/agent-stream.ts` | EventSource 래퍼, NDJSON 파싱 |
| SSE 프록시 | `routes/api/agent/stream/+server.ts` | SvelteKit 서버 → 백엔드 프록시 |
| 알림 구독 | `hooks/subscriptions/agent-notification.ts` | AgentSuggestion 실시간 수신 |

#### 의존성

- **백엔드**: SSE 엔드포인트 구현 필요 (`agent-architecture.md` Phase 2)
- **인프라**: Nginx `X-Accel-Buffering: no` 설정 (SSE 버퍼링 방지)

#### 리스크

- **중간-높음**: 새로운 통신 패턴 도입. EventSource 에러 핸들링, 재연결 로직 필요
- **주의**: SSE와 TanStack Query 캐시 간 일관성 유지

---

### Phase 3: Agent 인지 UI 컴포넌트

> **목표**: 사용자가 Agent 제안을 승인/거부하는 UI, 스트리밍 텍스트 표시.

#### 변경 범위

| 작업 | 파일 | 설명 |
|------|------|------|
| AgentSuggestionCard | `lib/components/agent/AgentSuggestionCard.svelte` | 제안 표시 + 승인/거부 |
| StreamingText | `lib/components/agent/StreamingText.svelte` | 점진적 텍스트 렌더링 |
| AgentBadge | `lib/components/agent/AgentBadge.svelte` | 사이드바/헤더에 제안 개수 표시 |
| Suggestion Service | `features/agent/suggestion-service.ts` | 승인/거부 API + invalidation |
| 기존 컴포넌트 확장 | 각 도메인 페이지 | Agent 제안 영역 조건부 추가 |

#### 의존성

- Phase 2 (Agent Store, SSE)가 선행되어야 함
- 백엔드 `AgentSuggestion` CRUD API 필요

#### 리스크

- **중간**: 기존 UI 변경. 디자인 시스템과 일관성 유지 필요
- **주의**: Agent UI가 기존 사용자 흐름을 방해하지 않도록 (opt-in 또는 조건부 표시)

---

### Phase 대응표

| 프론트엔드 Phase | 백엔드 Phase (`agent-architecture.md`) | 동시 진행 가능 |
|-----------------|---------------------------------------|:------------:|
| Phase 0: Domain Model | Phase 0: 이벤트 자동화 | ✅ 독립 |
| Phase 1: Intent 패턴 | Phase 1: Agent Runtime | ✅ 독립 |
| Phase 2: Agent State + SSE | Phase 2: LLM Engine | ⚠️ SSE 엔드포인트 필요 |
| Phase 3: Agent UI | Phase 2-3: LLM + 멀티에이전트 | ⚠️ AgentSuggestion API 필요 |

---

## 부록 A: 용어 사전 (Ubiquitous Language)

| 용어 | 정의 | 프론트엔드 대응 |
|------|------|----------------|
| **Intent** | 사용자 또는 Agent가 수행하려는 의도 | `{ type, payload, source }` 타입 |
| **Domain Model** | UI와 무관한 비즈니스 규칙 집합 | `lib/domain/` 순수 함수 |
| **ViewModel** | 화면 렌더링을 위해 가공된 데이터 | `features/*/view-model.ts` |
| **AgentSuggestion** | Agent의 Level 2 행동 제안 | `agentStore.suggestions` |
| **Stream** | Agent의 점진적 응답 | `agentStore.streams` |
| **TTFT** | Time-to-First-Token | SSE 첫 토큰까지의 시간 |
| **Human-in-the-Loop** | 고위험 행동의 사람 승인 | AgentSuggestionCard 승인/거부 UI |

## 부록 B: 관련 문서

| 문서 | 역할 |
|------|------|
| `docs/agent-architecture.md` | 백엔드 Agent 설계 (Facade=Tool, Rule/LLM Engine, 권한, 점진적 도입) |
| `docs/domain-architecture.md` | 전체 도메인 모델 (Assessment, Counseling, Schedule 엔티티) |
| 본 문서 (`frontend-ai-architecture.md`) | 프론트엔드 AI 대응 아키텍처 (Domain Model, Intent, Agent State, SSE, UI) |

## 부록 C: 참조 아티클

- [What Changes in Frontend Architecture When AI Enters the Product](https://altersquare.medium.com/what-changes-in-frontend-architecture-when-ai-enters-the-product-08617974e14b) — AlterSquare, Feb 2026
  - AI State + UI State 분리
  - SSE/WebSocket 실시간 프로토콜
  - 디자인 시스템의 Machine-readable contract
  - AI 출력의 untrusted input 처리
  - Micro-frontend 기반 AI 기능 독립 스케일링
