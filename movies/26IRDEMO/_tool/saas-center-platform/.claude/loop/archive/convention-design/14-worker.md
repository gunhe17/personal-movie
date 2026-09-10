# 계층 14 — worker consumer (`app/worker/**`)

> 정본 rule: (신설 예정) `worker.md`. 조사: top-down 감사에서 "계층 8은 producer만, consumer 워커 프로세스 미설계" 발견 → 사용자 편입 결정(2026-07-05).
> 성격: 비동기 소비 런타임 규약. 계층 8(eventing)이 "atomic 생성→emit"까지, 계층 14는 "그 이벤트/잡을 어떻게 소비하나".
> 조사·검토 3회(2026-07-05): 초기 "4종 동급" 프레이밍·A(xact락)·C(봉투)에 결함 발견 → 아래는 **정정 최종본**.

---

## 14-0. 워커 지형 = 2-Track + 스케줄러 축 (정정)

초기 "event/stream/cron/batch **4종 동급**"은 부정확. 문서 정본(eventing.md §1)은 **2-Track**이고, 코드 실측도 그렇다:

| 구분 | 정체 | 프로세스 | 근거 |
|------|------|---------|------|
| **Track A — event** | 도메인 이벤트 소비 (PG LISTEN/NOTIFY) | 독립 (`python -m app.worker.event`) | `__main__` 有 |
| **Track B — stream** | AI 잡 실행 백엔드 (Redis Stream) | 독립 (`python -m app.worker.stream`) | `__main__` 有 |
| └ batch | **Track B의 변형** — 같은 `run_worker`를 다른 스트림(`ai:jobs:batch`)에 재사용(지연 격리). 새 타입 아님 | 독립·코드 동일 | `stream/batch.py` → `stream.runner.run_worker` |
| **cron (스케줄러 축)** | 워커 아님 — **시간 트리거 스케줄러**(APScheduler). 큐 안 거침, outbox 밖 | **API lifecycle 내장** | `__main__` 無, `lifecycle.py` `register_jobs` |
| shim | `worker/batch.py`(co-locate)·`__main__.py`(runpy 위임) | 레거시 부트 | keeper·신규 금지 |

- **핵심**: 큐-소비 Track 2개(A·B) + 직교하는 스케줄러 축(cron). batch=B 변형, cron=워커 아님.

## 14-1. tx 소유 모델 `[집행 완료 — cron까지 이행됨]`

3갈래: event=워커가 `transactional_uow` 소유 / stream=executor 내부 / cron=`use_cron_action`(behavior)이 `transactional_uow` + advisory **xact** lock 소유. **cron 이행 완료**(scheduled.py 3잡 전부 `use_cron_action` 경유, 핸들러 tx-free) — 아래 "순서 종속·잠정 _run_locked" 서술은 이행 전 계획의 역사 기록.

- **결정: 2정본 + cron은 worker behavior로 통일 (단, 계층 10 뒤)**:
  | 패턴 | 언제 | 소유 |
  |------|------|------|
  | (a) 워커-소유(event형) | 소비 단위=tx 경계(짧은 반응) | 워커가 `transactional_uow` |
  | (b) executor-내부(stream형) | 장시간·다단계(STT/LLM) | tx는 application handler |

- **cron → `use_cron_action`(behavior)** — `use_event_action` 옆에 tx 소유 목적형 CM 신설. advisory lock을 그 안에 흡수.
- **순서 종속(검토서 발굴)**: cron 핸들러 3개가 **자체 `uow.commit()`**(하나는 `begin_nested()` 세이브포인트)한다. 트랜잭션 레벨 advisory lock(`pg_try_advisory_xact_lock`, 커밋 시 자동해제)은 핸들러의 **첫 내부 커밋에 조기 해제** → 멀티레플리카 보호 깨짐.
  - **∴ cron 핸들러 tx-free 전환(계층 10 tx-래퍼 제거) 선행 필수** → 그 후 `use_cron_action`+xact 락.
  - **잠정(그 전까지)**: 기존 `_run_locked`의 **세션 레벨 락 유지**(내부 커밋에도 살아남음, 현행 안전). cron 손대지 않음.

## 14-2. graceful shutdown `[정합 — 저우선]`

- **정정**: stream consumer는 `count=1` **직렬**이라([consumer.py](../../../apps/api/app/worker/stream/consumer.py) `while self._running: await _process_message`) `stop()` 시 현재 메시지가 XACK까지 완료 → **in-flight 유실 없음**(이미 안전). "stream이 잡을 버린다"는 초기 판단은 오류.
- event(동시 Pool 16)만 `Pool.wait()` gather-drain이 필요. stream(직렬)은 불요.
- **결정: 버그 아님 → 지금 손대지 않음.** 나중에 stream 손댈 때 `Lifecycle`을 **`app/worker/common/`으로 추출**(event→import 아님)해 종료 코드모양만 통일. 저우선·곁다리.
- **cron `shutdown(wait=False)` = 의도적 keeper (버그 아님)**: `AsyncIOScheduler`라 wait=True는 루프-묶인 async 잡에 신뢰성 없고, API 파드 grace=기본 30s라 유효하지도 않다. cron은 advisory lock+`CronTrigger` next-tick 재실행+예외격리로 **abrupt 종료를 견디는 멱등 설계** → graceful drain 불요. (미래 "wait=True로 고치자"는 오해 방지 주석.)

## 14-3. 재시도 규약 = Track A outbox로 일원화 `[설계완료 — enqueue-seam 종속]`

- **정정**: event `max_attempts`(실패 재실행·backoff)와 stream `reclaim`(XAUTOCLAIM 크래시 회수)은 **다른 개념**. 초기 "봉투에 reclaim 실기(C1)"는 스트림 선택과 **이중 진실원** 결함.
- **결정(통일 — eventing.md "Track B=실행 백엔드" 의도 실현)**: **재시도의 주인 = Track A outbox 하나.**
  - Track B(Redis)는 재시도 정책을 갖지 않는다 — 무거운 실행 뒷단일 뿐.
  - AI 잡 실패 → 그걸 enqueue한 **Track A 이벤트가 실패로 잡힘** → outbox가 event와 **동일 기계**(`max_attempts`·backoff·sweeper)로 재시도(재-enqueue).
  - **단일 손잡이 = enqueue하는 reaction의 멱등성 선언**:
    - 비멱등(realtime STT) → 첫 실패에 이벤트 **terminal**(재시도 안 함) = 이중과금 방지.
    - 멱등(voucher) → outbox 재시도.
  - Redis XAUTOCLAIM = **크래시 in-flight 회수 보조**로 격하(재시도 주경로 아님).
- **잠정(seam 완성 전)**: 현재 stream은 XACK만 하고 실패를 이벤트로 안 알린다. [반응→Track B enqueue seam](../../../apps/api/app/modules/counseling/counseling_case_analysis/handlers/create_analysis_handler.py#L90) 완성 전까지는 **스트림 분리(realtime/batch) + 무재시도 주석** 유지(아래 예시 C-잠정).
- **스트림 분리는 별개로 유지** — batch/realtime 분리는 **지연 격리**용(재시도와 직교).

## 14-4. 명명·구조 `[설계완료]`

- 상시 소비 워커 = `runner`·`consumer`·`connection` 3분할 + 부속(event `sweeper`·stream `batch`). event·stream 이미 일관.
- cron(`scheduled.py` 단일)·shim = **변형 keeper**(프로세스 성격 상이). `batch.py`·`__main__.py`(runpy 위임) = 레거시 호환 keeper, 신규 금지.

## 14-5. 워커→modules import 규율 `[설계완료]`

- **결정: 계층 9-4/12 cross-module 규율을 worker/**로 확장** — 워커 도메인 접근은 application handler 경유가 정본. modules repo/helper 직접 import 금지(9-4 hook paths에 `app/worker/**` 추가, advisory).
- **판별**: sweeper의 `EventRepository`(이벤트 아웃박스) = 워커/이벤팅 인프라라 cross-module 아님(keeper). cron의 `notification.helpers`(`dispatch_single_notification`·`send_sms_to_client`) 직접 = **keeper** — 06장이 인정한 공식 발송 표면이라 repo/service 직접 취득과 달리 워커 직접 사용 허용(예시 A line 98~99가 정본, worker.md 구조·import 절 참조). 금지 대상은 repo/service 직접 취득뿐.

## 14-6. 도메인 호출 방식 `[설계완료]`

- 워커 → application handler 단일 진입. event만 behavior `use_event_action`(감사 actor+event_group). stream은 application 직접(request 컨텍스트 없음). cron은 14-1 순서 따라 `use_cron_action`으로.
- 외부 채널 발송(알림톡/SMS)은 **tx 커밋·세션 close 후 `create_task` fire-and-forget**(tx 안 외부 IO 금지).

---

## before → after 예시

### A. cron tx — 세션락 유지(잠정) → 계층10 후 `use_cron_action`+xact락 (14-1)

```python
# 잠정(현행 유지) — 세션 레벨 락. cron 핸들러가 자체 commit하므로 xact락 못 씀.
#   _run_locked 그대로: 세션락은 내부 커밋에도 살아남아 안전. cron 손대지 않음.

# 목표(계층 10에서 cron 핸들러 tx-free 전환 후) — behavior + xact락
@asynccontextmanager                          # app/behavior/worker.py, use_event_action 옆
async def use_cron_action(*, lock_key: int, name: str) -> AsyncIterator[Scope | None]:
    async with transactional_uow() as uow:
        if not await uow.try_advisory_xact_lock(lock_key):   # 커밋/롤백 시 자동해제
            logger.debug("%s: lock held by another replica, skipping", name)
            yield None
            return
        yield Scope(uow=uow)                  # finally 불필요(xact락 자동해제)

async def send_schedule_reminders_job():      # app/worker/cron/scheduled.py
    async with use_cron_action(lock_key=SCHEDULE_LOCK, name="schedule_reminders") as scope:
        if scope is None:
            return
        targets = await send_schedule_reminders_handler(uow=scope.uow, ...)  # tx-free 핸들러
    for t in targets:                         # 발송은 커밋 뒤(§14-6)
        asyncio.create_task(dispatch_single_notification(t))
```

핵심: xact락은 핸들러가 tx-free여야 성립(자체 커밋 시 조기해제). **계층 10 순서 종속.**

### B. shutdown — 정정: stream 이미 안전, 저우선 (14-2)

```python
# stream은 직렬(count=1) — stop() 시 현재 메시지 XACK까지 완료 → 유실 없음(현행 OK).
# 나중에 손댈 때만: Lifecycle을 app/worker/common으로 추출해 event/stream 종료 코드모양 통일.
from app.worker.common.lifecycle import Lifecycle   # event 아닌 common에서
```

### C. retry — Track A outbox 일원화 (14-3)

```python
# 목표 — 재시도는 outbox 하나. enqueue하는 reaction이 멱등성만 선언.
#   비멱등(realtime STT): 실패 시 이벤트 terminal(재시도 안 함) = 이중과금 방지
#   멱등(voucher):        outbox가 event처럼 max_attempts 재시도
async def run(self, *, uow, input, center_id):        # Track B enqueue reaction
    await enqueue_job("field_note_stt", ..., idempotent=False)   # 실패=terminal
    await enqueue_job("voucher_extract", ..., idempotent=True)   # 실패=outbox 재시도

# 잠정(enqueue-seam 완성 전) — 스트림 분리 + 무재시도 주석
STREAM_CONFIG = {
    # realtime STT 무재시도: reclaim 시 같은 오디오 재-STT = 이중과금. 실패=사용자 재요청.
    "field_note_realtime": StreamConfig(reclaim=None),
    "voucher_batch": StreamConfig(reclaim=600),      # 멱등 — 600s 후 크래시 회수
}
```

---

## 실행 워크리스트 (계층 14)

| 작업 | 대상 | 선행 | 파괴성 |
|------|------|------|:-----:|
| ~~(A) cron → `use_cron_action`+xact락~~ **완료** | scheduled.py 3잡 + behavior/worker.py `use_cron_action` — 핸들러 tx-free 이행됨 | — | 집행됨 |
| (C) 재시도 outbox 일원화 | Track B enqueue reaction 멱등성 선언 + 실패→이벤트 전파 | **enqueue-seam 완성** | behavioral |
| (C-잠정) 무재시도 주석 | Track B 비멱등 executor `reclaim=None` 근거 주석 | — | 주석 |
| (14-5) cross-module hook worker 확장 | 9-4 hook paths에 `app/worker/**`(advisory) | — | 도구 |
| (14-5) cron 발송 표면 keeper | notification.helpers 직접 = 공식 발송 표면 허용(예시 A) | — | 무변경 |
| (B) shutdown 통일 | 공용 `Lifecycle`(common 추출) | **저우선·곁다리** | 정합 |
| rule 신설 | `worker.md`(paths: `app/worker/**`) — 2-Track+스케줄러·tx 2정본·retry outbox 일원화·import 규율. eventing.md worker paths 조율 | — | 문서 |

**성격 요약**: 계층 14 = 소비 런타임 정본화. **정정 핵심** — tx(cron behavior 전환은 계층 10 종속)·shutdown(stream 이미 안전, 저우선)·retry(**Track A outbox로 일원화**, 봉투 아님). 검토 3회로 초기 결함(4종 동급·xact락·이중진실원) 제거.
