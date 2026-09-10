# AI 인프라 분리 설계서

> **목적**: AI 워크로드를 API 서버에서 분리하여, AI 부하가 일반 사용자에게 영향을 주지 않는 구조를 만든다.
>
> **작성일**: 2026-04-24
> **상태**: Draft

---

## 1. 현재 아키텍처 (AS-IS)

### 1.1 배포 토폴로지

```
                     NGINX Ingress (K8s)
                          │
               ┌──────────┼──────────┐
               ▼          ▼          ▼
            [Web]      [API]     [Admin]
           2 pods    2~5 pods    1 pod
                       │
                       │  단일 프로세스에서 전부 처리
                       ├── 일반 CRUD (clients, schedule, billing...)
                       ├── Agent SSE 스트리밍 (30~240s 점유)
                       ├── Field Note STT 파이프라인 (수분 소요)
                       ├── AI Lab 실험 실행
                       ├── 크레딧 차감/잔액 관리
                       └── APScheduler (알림 발송)
                       │
                    [AWS RDS]        [AWS S3]
                    PostgreSQL       파일 저장소
                    pool: 30
```

### 1.2 AI 관련 모듈 현황

| 모듈 | 경로 | 역할 | 호출 방식 |
|------|------|------|-----------|
| **LLM Gateway** | `app/modules/llm/gateway/` | LLM/STT 클라이언트 + 크레딧 관리 | 동기 (await) |
| **Agent** | `app/modules/agent/` | 대화형 AI 에이전트 | SSE 스트리밍 |
| **Field Note** | `app/modules/field_note/pipeline/` | 음성 전사 + 정제 + 요약 | BackgroundTasks |
| **AI Lab** | `app/modules/ai_lab/` | 프롬프트 실험 + 프로덕션 설정 | 동기 (await) |
| **Runtime Pipeline** | `app/runtime/pipeline/` | 스킬 선택 → 쿼리/뮤테이션 실행 | Agent 내부 |
| **Infrastructure** | `app/infrastructure/llm/`, `stt/` | OpenAI/OpenRouter 프로바이더 | 동기 (await) |

### 1.3 현재 구조의 문제점

#### P0 — 서비스 격리 실패

| 문제 | 원인 | 영향 |
|------|------|------|
| **SSE가 워커를 인질로 잡음** | Agent 채팅 1건이 30~240초 동안 HTTP 연결 + DB 커넥션 점유 | 동시 SSE 10건이면 DB 풀(30) 1/3 소진 → 일반 CRUD 지연 |
| **LLM 호출 중 DB 세션 홀딩** | UoW가 전체 파이프라인을 감싸서 LLM 대기 중에도 DB 커넥션 반환 불가 | OpenAI 지연 → DB 커넥션 고갈 → 전체 서비스 다운 |
| **BackgroundTasks 유실** | FastAPI BackgroundTasks = 같은 프로세스, 영속성 없음 | 서버 재시작 시 STT 작업 사라짐, 사용자는 영원히 "처리 중" |
| **HPA 기준 부적합** | CPU 70% 기준 스케일링이지만 AI는 I/O 바운드 (외부 API 대기) | CPU 낮은데 응답 불가 → 스케일 안 됨 |

#### P1 — 데이터 정합성

| 문제 | 원인 | 영향 |
|------|------|------|
| **크레딧 Race Condition** | 잔액 확인 → LLM 호출(120s) → 차감 사이에 다른 요청이 크레딧 소진 가능 | 마이너스 잔액 발생 |
| **대화 히스토리 무한 로드** | `get_messages()` limit 없이 전체 조회 | 긴 대화 → 메모리/토큰 비용 선형 증가 |
| **AI 설정 캐시 없음** | `ProductionAIConfig` 매 호출마다 DB 조회 | 불필요한 DB 부하 |

#### P2 — 운영 안정성

| 문제 | 원인 | 영향 |
|------|------|------|
| **Rate Limiting이 프로세스 로컬** | `_active_streams: set[str]` = Pod별 독립 | K8s 멀티 Pod에서 제한 우회 |
| **Graceful Shutdown 미흡** | 종료 시 진행 중 SSE 스트림 강제 종단 | 대화 상태 "active"로 남아 orphan 발생 |
| **에러 타입 미분류** | Timeout, 429, 500 모두 동일한 `conversation_error`로 처리 | 클라이언트 재시도 전략 수립 불가 |
| **분산 추적 부재** | trace_id가 LLM 호출 DB 기록에 미포함 | 느린 요청 원인 분석 불가 |
| **프론트엔드 SSE 복구 없음** | 연결 끊기면 수동 재전송 필요, Retry-After 미지원 | 네트워크 불안정 시 UX 저하 |

---

## 2. 목표 아키텍처 (TO-BE)

### 2.1 전체 토폴로지

```
                         NGINX Ingress (K8s)
                              │
               ┌──────────────┼──────────────┐
               ▼              ▼              ▼
            [Web]          [API]          [Admin]
                        2~5 pods
                           │
                ┌──────────┴──────────┐
                │                     │
          일반 CRUD              AI 요청 발행만
          (즉시 응답)           (MQ로 위임)
                                     │
                                     ▼
                         ┌──────────────────┐
                         │   Redis Cluster   │
                         │  (AWS ElastiCache) │
                         │                    │
                         │  ├─ Stream (MQ)    │
                         │  ├─ Pub/Sub        │
                         │  └─ Cache          │
                         └─────────┬──────────┘
                                   │
                  ┌────────────────┼────────────────┐
                  ▼                ▼                ▼
           [AI Worker]      [AI Worker]      [AI Worker]
            streaming        batch            batch
            1~N pods         1~N pods         1~N pods
            ├─ Agent Chat    ├─ STT           ├─ AI Lab
            └─ SSE 토큰발행  ├─ Refine        └─ 실험 실행
                             └─ Summary
                  │
                  ├── LLM/STT 호출 (외부 API)
                  ├── 결과 → Redis Pub/Sub → API → SSE 클라이언트
                  └── 완료 → Redis Stream → API → DB 저장 + 크레딧 정산
```

### 2.2 서비스 역할 분리

| 서비스 | 역할 | 하는 것 | 하지 않는 것 |
|--------|------|---------|-------------|
| **API Server** | HTTP 게이트웨이 + CRUD | 인증, 라우팅, DB CRUD, MQ 발행, SSE 프록시 | LLM/STT 직접 호출 |
| **AI Worker (Streaming)** | Agent 채팅 처리 | 스킬 선택, LLM 호출, 토큰 스트리밍 발행 | DB 직접 쓰기 (결과는 API로 위임) |
| **AI Worker (Batch)** | 비동기 AI 작업 | STT 전사, 텍스트 정제, 요약, 실험 실행 | SSE, HTTP 응답 |
| **Redis** | 메시지 브로커 + 캐시 | 작업 큐, Pub/Sub, 설정 캐시, Rate Limit | 영속 데이터 저장 |

---

## 3. 핵심 설계

### 3.1 Agent 채팅 — SSE 스트리밍 프록시 패턴

가장 까다로운 케이스. API 서버가 Redis Pub/Sub을 통해 토큰을 중계한다.

```
[Client]              [API Server]              [Redis]              [AI Worker]
   │                      │                       │                      │
   │── POST /stream ─────▶│                       │                      │
   │                      │                       │                      │
   │                      │── 1. 크레딧 선차감 ───▶│ (DB)                 │
   │                      │── 2. XADD job ────────▶│ (Stream)             │
   │                      │── 3. SUBSCRIBE ch ────▶│ (Pub/Sub)            │
   │                      │                       │                      │
   │                      │                       │── XREADGROUP ────────▶│
   │                      │                       │                      │── 히스토리 로드 (DB read)
   │                      │                       │                      │── 스킬 선택 (LLM #1~2)
   │                      │                       │                      │── 쿼리 실행 (DB read)
   │                      │                       │                      │── 응답 생성 (LLM #3)
   │                      │                       │◀── PUBLISH token ────│
   │◀── SSE: token ──────│◀── MESSAGE ───────────│                      │
   │◀── SSE: token ──────│◀── MESSAGE ───────────│◀── PUBLISH token ────│
   │                      │                       │                      │
   │                      │                       │◀── PUBLISH complete ─│
   │◀── SSE: [DONE] ─────│◀── MESSAGE ───────────│   (+ actual_tokens,  │
   │                      │                       │     messages_to_save) │
   │                      │                       │                      │
   │                      │── 4. 메시지 저장 (DB) ─│                      │
   │                      │── 5. 크레딧 정산 (DB) ─│                      │
   │                      │── 6. UNSUBSCRIBE ─────│                      │
```

**API 서버 부담**: Redis SUBSCRIBE + SSE 중계만. DB 세션 불필요. LLM 호출 없음.

**AI Worker DB 접근 규칙**:
- **읽기만 허용**: 대화 히스토리, 스킬 카탈로그, 센터 데이터 조회 (쿼리 실행)
- **쓰기 금지**: 모든 쓰기는 완료 메시지에 포함 → API 서버가 DB에 저장
- **이유**: 트랜잭션 경계를 API 서버에 유지하여 데이터 정합성 보장

### 3.2 Field Note — Fire & Forget + 진행률 보고

```
[Client]              [API Server]              [Redis]              [AI Worker]
   │                      │                       │                      │
   │── POST /transcribe ─▶│                       │                      │
   │                      │── status: queued (DB) ─│                      │
   │                      │── XADD job ───────────▶│ (Stream)             │
   │◀── 202 Accepted ────│                        │                      │
   │                      │                       │── XREADGROUP ────────▶│
   │                      │                       │                      │
   │                      │                       │                      │── S3에서 오디오 다운로드
   │                      │                       │◀── progress 30% ─────│  (presigned URL)
   │                      │                       │                      │── Whisper STT 호출
   │                      │                       │◀── progress 70% ─────│
   │                      │                       │                      │── 텍스트 정제 (LLM)
   │                      │                       │◀── progress 90% ─────│
   │                      │                       │                      │── 요약 (LLM)
   │                      │                       │◀── COMPLETE ─────────│
   │                      │                       │   (transcript, summary,
   │                      │                       │    actual_tokens)     │
   │                      │                       │                      │
   │                      │◀── XREADGROUP result ─│                      │
   │                      │── DB 저장 + 크레딧 정산│                      │
   │                      │── status: completed ──│                      │
   │                      │                       │                      │
   │── GET /field-note ──▶│                       │                      │
   │◀── 200 (completed) ─│                       │                      │
```

**개선점**:
- 작업 영속성 보장 (서버 재시작해도 큐에 남음)
- 진행률 보고 → 프론트엔드에서 실시간 상태 표시 가능
- 실패 시 자동 재시도 (Dead Letter Queue로 N회 후 포기)

### 3.3 크레딧 시스템 — 선차감 + 정산 패턴

```
AS-IS (동기, Race Condition 존재):
  ┌──────────────────────────────────────────────┐
  │ 잔액 확인 → LLM 호출 (120s) → 차감          │
  │            ↑ 이 구간에서 다른 요청이 크레딧   │
  │              소진 가능 → 마이너스 잔액        │
  └──────────────────────────────────────────────┘

TO-BE (선차감 + 정산):
  ┌──────────────────────────────────────────────┐
  │ Step 1: 선차감 (estimated tokens)            │
  │   - SELECT ... FOR UPDATE (row lock)         │
  │   - balance -= estimated                     │
  │   - INSERT credit_reservation (pending)      │
  │   - 잔액 부족 시 즉시 거부                   │
  │                                              │
  │ Step 2: LLM 호출 (Worker, 120s)              │
  │   - 이 동안 잔액은 이미 차감된 상태          │
  │   - 다른 요청도 차감된 잔액 기준으로 판단     │
  │   - Race Condition 없음                      │
  │                                              │
  │ Step 3: 정산                                  │
  │   - actual_tokens < estimated → 차액 환불     │
  │   - actual_tokens > estimated → 추가 차감     │
  │   - 실패 시 → 전액 환불                      │
  │   - reservation status = settled              │
  └──────────────────────────────────────────────┘
```

```python
# 새로운 테이블: credit_reservations
class CreditReservation(Base):
    id: str                  # UUID
    center_id: str           # FK
    estimated_tokens: int    # 선차감량
    actual_tokens: int | None  # 실사용량 (정산 후)
    status: str              # pending → settled / refunded / expired
    purpose: str             # agent_chat, field_note_stt, ...
    created_at: datetime
    settled_at: datetime | None
    expires_at: datetime     # 정산 미완료 시 자동 환불 (TTL)
```

### 3.4 Redis 사용 전략

| 용도 | Redis 자료구조 | Key 패턴 | TTL |
|------|---------------|----------|-----|
| **작업 큐** | Stream + Consumer Group | `ai:jobs:{type}` | 없음 (ACK 기반) |
| **SSE 토큰 중계** | Pub/Sub Channel | `ai:stream:{conversation_id}` | 자동 (구독 해제 시) |
| **작업 진행률** | Hash | `ai:progress:{job_id}` | 1시간 |
| **Rate Limit** | Sorted Set | `ai:rate:{center_id}` | 1분 (슬라이딩 윈도우) |
| **AI 설정 캐시** | Hash | `ai:config:{step_name}` | 5분 |
| **구독 플랜 캐시** | String | `sub:plan:{center_id}` | 5분 |

### 3.5 메시지 스키마

```json
// ai:jobs:agent_chat (Redis Stream)
{
  "job_id": "uuid",
  "trace_id": "uuid",
  "center_id": "uuid",
  "member_id": "uuid",
  "conversation_id": "uuid",
  "message": "오늘 오후 3시에 상담 예약 잡아줘",
  "pending_state": "{\"step\": \"confirm\", \"data\": {...}}",
  "config": {
    "agent_model": "google/gemini-2.5-flash",
    "agent_provider": "openrouter"
  },
  "reservation_id": "uuid",
  "created_at": "2026-04-24T10:00:00Z"
}
```

```json
// ai:stream:{conversation_id} (Pub/Sub 메시지)
// 토큰 스트리밍
{"type": "token", "content": "오후"}
{"type": "token", "content": " 3시에"}
{"type": "tool_result", "skill": "get_schedules", "output": [...]}
{"type": "complete", "actual_tokens": 847, "messages": [...]}
{"type": "error", "code": "llm_timeout", "retry_after": 5}
```

```json
// ai:jobs:field_note (Redis Stream)
{
  "job_id": "uuid",
  "trace_id": "uuid",
  "center_id": "uuid",
  "field_note_id": "uuid",
  "steps": ["transcribe", "refine", "summarize"],
  "audio_urls": [
    "https://s3.../field-notes/.../audio/chunk1.webm?X-Amz-Signature=..."
  ],
  "config": {
    "stt_model": "whisper-1",
    "summary_model": "gpt-4o-mini"
  },
  "reservation_id": "uuid"
}
```

---

## 4. 누락 사항 및 보완 설계

### 4.1 에러 처리 + 재시도 전략

현재 모든 에러가 동일한 `conversation_error`로 처리됨. 에러 타입별 전략 필요.

| 에러 타입 | Worker 동작 | API → Client | 재시도 |
|-----------|------------|--------------|--------|
| **LLM Timeout** | 결과 Redis 발행 (error) | SSE: `error_code: llm_timeout` | 자동 1회, 5s 후 |
| **LLM Rate Limit (429)** | 대기 후 재시도 | SSE: `error_code: rate_limited, retry_after: 30` | Worker 자동 (exp backoff) |
| **LLM 잘못된 응답** | DLQ로 이동 | SSE: `error_code: llm_error` | 수동 |
| **Worker Crash** | Redis 미ACK → 재할당 | SSE: 연결 끊김 → 클라이언트 재시도 | 자동 (다른 Worker) |
| **크레딧 부족** | 작업 거부 (API 단에서 차단) | HTTP 403 | 없음 |

**Dead Letter Queue (DLQ)**:
```
ai:jobs:agent_chat        → 정상 큐
ai:dlq:agent_chat         → 3회 실패 후 이동
ai:dlq:agent_chat:reason  → 실패 사유 기록
```

### 4.2 멀티테넌시 공정성

현재 `_active_streams: set[str]`이 프로세스 로컬이라 K8s 멀티 Pod에서 무의미.

**Redis 기반 분산 Rate Limiting**:

```python
# 센터별 동시 AI 요청 제한
# Redis: SORTED SET (sliding window)
key = f"ai:rate:{center_id}"

async def check_rate_limit(center_id: str, max_concurrent: int = 3):
    now = time.time()
    pipe = redis.pipeline()
    pipe.zremrangebyscore(key, 0, now - 60)   # 1분 이전 제거
    pipe.zcard(key)                            # 현재 활성 수
    pipe.zadd(key, {job_id: now})              # 현재 요청 추가
    pipe.expire(key, 120)
    _, count, *_ = await pipe.execute()

    if count >= max_concurrent:
        await redis.zrem(key, job_id)          # 롤백
        raise RateLimitException(f"센터 동시 요청 {max_concurrent}건 초과")
```

**플랜별 동시 제한**:

| 플랜 | 동시 Agent 채팅 | 동시 STT 작업 | 분당 AI 요청 |
|------|----------------|--------------|-------------|
| Free | 0 | 0 | 0 |
| Starter | 1 | 1 | 10 |
| Pro | 3 | 2 | 30 |
| Enterprise | 10 | 5 | 100 |

### 4.3 AI Worker의 DB 접근 설계

Worker가 DB를 **전혀** 안 읽으면 메시지 페이로드가 비대해짐.
Worker가 DB를 **자유롭게** 읽으면 API 서버와 동일한 커넥션 풀 경쟁 발생.

**절충안: Read-Only Replica 사용**

```
                    [RDS Primary]
                    (읽기+쓰기)
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
           [API]      [API]     [Scheduler]
          (R/W)      (R/W)       (R/W)
                         │
                    [RDS Replica]
                    (읽기 전용)
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        [AI Worker] [AI Worker] [AI Worker]
         (Read)     (Read)      (Read)
```

- Worker는 Read Replica에서 대화 히스토리, 스킬 카탈로그, 센터 데이터 조회
- Worker의 DB 부하가 Primary에 영향 없음
- 쓰기는 무조건 결과 메시지 → API 서버 → Primary
- Read Replica lag (보통 <100ms)은 AI 사용 케이스에서 문제없음

### 4.4 AI 설정 동기화

현재 `ProductionAIConfig`를 매 호출마다 DB에서 조회. Worker 분리 시 해결 필요.

**Redis 캐시 + 이벤트 기반 무효화**:

```python
# 설정 변경 시 (AI Lab에서 프로덕션 적용)
async def apply_production_config(step_name: str, config: dict):
    await db.save(config)                               # DB 저장
    await redis.hset(f"ai:config:{step_name}", config)  # 캐시 갱신
    await redis.publish("ai:config:changed", step_name) # Worker에 통보

# Worker 측
async def get_config(step_name: str) -> dict:
    cached = await redis.hgetall(f"ai:config:{step_name}")
    if cached:
        return cached
    # 캐시 미스 → Read Replica에서 조회 후 캐시
    config = await db_replica.query(...)
    await redis.hset(f"ai:config:{step_name}", config, ex=300)
    return config
```

### 4.5 Observability (분산 추적)

현재 trace_id가 LLM 호출 기록에 미포함. 서비스 분리 후 필수.

```
[Client] ──▶ [API] ──▶ [Redis] ──▶ [Worker] ──▶ [OpenAI]
  │            │          │           │             │
  │        trace_id   trace_id    trace_id     trace_id
  │        span: api  (전달)     span: worker  span: llm
  │            │                     │
  │        log: job    log: start   log: skill_select 340ms
  │        published   processing   log: llm_call 12.4s
  │                                 log: complete
```

**구현**:
- API → Redis 메시지에 `trace_id` 포함
- Worker → 모든 로그에 `trace_id` + `worker_id` + `job_id` 포함
- LLM 호출 기록(`llm_calls` 테이블)에 `trace_id` 컬럼 추가
- Prometheus 커스텀 메트릭:

```python
# Worker 측 메트릭
ai_job_duration = Histogram(
    "ai_job_duration_seconds",
    "AI 작업 처리 시간",
    labelnames=["job_type", "step", "model"]
)
ai_job_queue_depth = Gauge(
    "ai_job_queue_depth",
    "큐 대기 작업 수",
    labelnames=["job_type"]
)
ai_job_failures = Counter(
    "ai_job_failures_total",
    "AI 작업 실패 수",
    labelnames=["job_type", "error_type"]
)
```

### 4.6 Graceful Shutdown + Worker Heartbeat

**문제**: Worker가 장시간 작업 중 종료되면 작업 유실.

**Worker Heartbeat 패턴**:

```python
# Worker: 5초마다 heartbeat
async def process_job(job):
    while processing:
        await redis.set(f"ai:heartbeat:{job_id}", time.time(), ex=15)
        # ... 작업 처리 ...

# Supervisor: heartbeat 만료 감지 → 작업 재할당
async def monitor_stale_jobs():
    for job_id in active_jobs:
        last_beat = await redis.get(f"ai:heartbeat:{job_id}")
        if time.time() - last_beat > 15:
            await reassign_job(job_id)
```

**K8s 연동**:

```yaml
# ai-worker deployment
spec:
  terminationGracePeriodSeconds: 300  # 5분 유예
  containers:
    - lifecycle:
        preStop:
          exec:
            command: ["/bin/sh", "-c", "touch /tmp/drain && sleep 270"]
```

Worker는 `/tmp/drain` 파일 감지 시 새 작업 안 받고, 현재 작업 완료 후 종료.

### 4.7 프론트엔드 SSE 복구

현재 SSE 연결이 끊기면 수동 재전송 필요. 자동 복구 필요.

```typescript
// TO-BE: sse-client.ts
async function streamWithRetry(url: string, body: object, options: StreamOptions) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await readSSEStream(url, body, options);
      return; // 정상 완료
    } catch (error) {
      if (error.code === 'llm_timeout' || error.code === 'network_error') {
        attempt++;
        const delay = Math.min(1000 * 2 ** attempt, 10000); // 2s, 4s, 8s
        await sleep(delay);

        // 대화 상태 확인 후 재시도
        const status = await checkConversationStatus(conversationId);
        if (status === 'completed') return; // 이미 완료됨
        if (status === 'processing') {
          // Worker에서 처리 중 — SSE 재구독만
          await resubscribeSSE(conversationId, options);
          return;
        }
        // pending — 재전송
        continue;
      }
      throw error; // 재시도 불가 에러
    }
  }
  options.onError?.({ code: 'max_retries_exceeded' });
}
```

### 4.8 로컬 개발 환경

Worker 분리 후에도 로컬 개발이 복잡해지면 안 됨.

```yaml
# docker-compose.yml (로컬 개발용)
services:
  postgres:
    image: postgres:16-alpine
    ports: ["3501:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  api:
    build: ./apps/api
    ports: ["3502:8000"]
    environment:
      - REDIS_URL=redis://redis:6379
      - AI_WORKER_MODE=embedded  # 로컬에서는 API 내장 모드

  # 로컬에서는 ai-worker를 별도로 띄우거나, embedded 모드 사용
  ai-worker:
    build: ./apps/api
    command: ["python", "-m", "app.worker.main"]
    environment:
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=...  # Read Replica 대신 같은 DB
    profiles: ["worker"]  # docker compose --profile worker up
```

**`AI_WORKER_MODE=embedded`**: 개발 시 기존처럼 API 프로세스 내에서 AI 직접 실행.
프로덕션에서만 `AI_WORKER_MODE=distributed`로 전환.

---

## 5. K8s 리소스 변경안

### 5.1 신규 리소스

```yaml
# 추가되는 K8s 리소스
infra/k8s/prod/
├── deployment-ai-worker.yaml      # AI Worker Deployment
├── hpa-ai-worker.yaml             # 큐 깊이 기반 HPA
├── deployment-redis.yaml          # Redis (또는 ElastiCache 사용)
├── service-redis.yaml             # Redis ClusterIP Service
├── configmap-ai-worker.yaml       # Worker 전용 설정
└── secret-ai-worker.yaml          # OpenAI/OpenRouter API 키
```

### 5.2 AI Worker HPA

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ai-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mindscope-ai-worker
  minReplicas: 1
  maxReplicas: 10
  metrics:
    # 커스텀 메트릭: Redis 큐 깊이
    - type: External
      external:
        metric:
          name: ai_job_queue_depth
        target:
          type: AverageValue
          averageValue: "5"    # Worker당 대기 작업 5개 초과 시 스케일
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30   # 빠른 스케일업
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300  # 느린 스케일다운
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
```

### 5.3 리소스 비교

| 서비스 | CPU req/limit | Memory req/limit | Replicas | 비고 |
|--------|-------------|----------------|----------|------|
| API (현재) | 100m/1000m | 512Mi/1Gi | 2~5 | CRUD + AI 전부 |
| API (목표) | 100m/500m | 256Mi/512Mi | 2~5 | CRUD + SSE 프록시만 |
| AI Worker (목표) | 200m/2000m | 1Gi/2Gi | 1~10 | LLM/STT 전담 |
| Redis | 100m/500m | 256Mi/512Mi | 1 (또는 ElastiCache) | MQ + 캐시 |

**API 서버 리소스가 줄어듦** — LLM 호출이 없으므로 메모리/CPU 부담 감소.

---

## 6. 단계별 전환 로드맵

```
Phase 0                Phase 1              Phase 2              Phase 3              Phase 4
Redis 추가             Field Note           크레딧 재설계         AI Lab               Agent 채팅
───────────────────────────────────────────────────────────────────────────────────────────────────
                                                                                        
[Redis 배포]           [STT/요약을           [선차감+정산          [실험 실행을          [SSE 프록시
 ElastiCache            Worker로 분리]        패턴 적용]           Worker로 분리]        패턴 적용]
 or Redis Pod                                                                           
                       [DLQ + 재시도]        [credit_reservation  [큐+폴링 패턴]        [Pub/Sub 중계]
[embedded 모드                                테이블 추가]                               
 개발/테스트]          [진행률 보고]                              [결과 콜백]           [프론트 SSE
                                            [분산 Rate Limit]                           복구 로직]
[Observability                                                                          
 trace_id 추가]        [Heartbeat]           [Read Replica        [Worker HPA]          [Graceful
                                             도입]                                      Shutdown]

예상 기간:             예상 기간:            예상 기간:            예상 기간:            예상 기간:
1주                    2주                   2주                   1주                   3주
리스크: 낮음           리스크: 낮음          리스크: 중간          리스크: 낮음          리스크: 높음
```

### Phase별 검증 기준

| Phase | 완료 조건 |
|-------|----------|
| **0** | Redis 연결 확인, embedded 모드에서 기존 기능 정상 동작 |
| **1** | Field Note STT가 Worker에서 처리됨, 서버 재시작해도 작업 유지, DLQ 동작 확인 |
| **2** | 크레딧 선차감/정산 정상 동작, Race Condition 테스트 통과, Read Replica lag 검증 |
| **3** | AI Lab 실험이 Worker에서 실행됨, 결과 폴링 정상 |
| **4** | Agent 채팅이 Pub/Sub으로 스트리밍됨, API 서버에서 LLM 호출 0건, 부하 테스트 통과 |

---

## 7. 리스크 및 의사결정 포인트

| 의사결정 | 선택지 | 권장 | 이유 |
|----------|--------|------|------|
| **메시지 큐** | Redis Streams vs RabbitMQ vs Kafka | Redis Streams | 이미 캐시/Pub/Sub에 Redis 사용, 운영 복잡도 최소화 |
| **Worker 프레임워크** | Celery vs ARQ vs 자체 구현 | ARQ | async 네이티브, Redis 기반, 경량 |
| **Read Replica** | RDS Replica vs 같은 Primary | RDS Replica | AI 읽기 부하 격리가 목적 자체 |
| **Redis 운영** | ElastiCache vs 자체 Pod | ElastiCache | 운영 부담 최소화, 자동 failover |
| **로컬 개발** | 항상 Worker 분리 vs embedded 모드 | embedded 모드 기본 | 개발 경험 보존 |
| **온프레미스 확장** | K8s 노드 확장 vs 별도 클러스터 | 같은 EKS + 노드 그룹 분리 | AI Worker를 GPU/고성능 노드 그룹에 배치 |

### 온프레미스 확장 시나리오

향후 자체 LLM 운영 시:

```
[EKS Cluster]
├── Node Group: general (t3.medium)
│   ├── API Pods
│   ├── Web/Admin Pods
│   └── Redis
│
├── Node Group: ai-cpu (c5.2xlarge)
│   └── AI Worker Pods (API 기반 LLM 호출)
│
└── Node Group: ai-gpu (g4dn.xlarge)  ← 향후 추가
    └── AI Worker Pods (자체 모델 추론)
```

Worker가 이미 분리되어 있으므로, 노드 그룹만 추가하면 온프레미스 전환 가능.
