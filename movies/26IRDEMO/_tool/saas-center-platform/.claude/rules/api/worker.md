---
paths:
  - "apps/api/app/worker/**"
---

# worker — 소비 런타임 (2-Track + 스케줄러 축)

지형: 큐-소비 Track 2개 + 직교 스케줄러 축. batch는 새 타입이 아니라 Track B 변형(같은 `run_worker`, 다른 스트림 — 지연 격리). 이벤트 흐름 자체는 [eventing.md](eventing.md).

| | Track A `worker/event` | Track B `worker/stream` | cron `worker/cron` |
|---|---|---|---|
| 매체 | PG LISTEN/NOTIFY | Redis Stream | APScheduler(API 프로세스 내장) |
| tx 소유 | 워커가 `transactional_uow`(claim/run/finalize 각각) | executor(핸들러) 내부 | `use_cron_action`(behavior)이 tx+event group+커밋 후 dispatch 소유 |
| 재시도 | DB 지수 backoff+`max_attempts` + sweeper 재-NOTIFY | XAUTOCLAIM(크래시 회수 — **멱등 executor만**) | 없음(멱등·next-tick) |

## tx — 2정본 + cron behavior

- 소비 단위=tx 경계(짧은 반응) → **워커-소유**(event형). 잡이 장시간·다단계(STT/LLM) → **executor-내부**(stream형, 워커는 claim/ack만).
- cron 잡 = `use_cron_action(lock_key=, name=)`(behavior.worker) — tx는 `transactional_uow`, 멀티 레플리카 조율은 advisory **xact** lock(커밋 시 자동 해제). scope가 `event_group_id`를 핸들러에 전달하고 clean-exit 커밋 뒤 dispatch한다. **cron 핸들러는 tx-free 필수** — 내부 커밋은 xact lock 조기 해제(보호 붕괴).
- per-item 격리용 `begin_nested()`(SAVEPOINT)는 **tx-free 위반이 아니다** — 커밋이 아니라 xact lock이 유지되고, 배치에서 한 항목 실패가 나머지를 롤백시키지 않게 하는 유일한 도구(별도 세션·점진 커밋은 lock 보호를 깨므로 불가). 레퍼런스 [apply_expired_downgrades](../../../apps/api/app/application/handlers/subscription/apply_expired_downgrades.py).
- 워커가 `AsyncSessionLocal()`을 손수 조립하지 않는다(X3 — 표준 uow 경로만). 예외: Track B leaf executor(`JOB_HANDLERS` 대상)는 요청 세션이 없어 자체 세션이 구조 필수 — `_mark_failed`(롤백 후 상태 마킹)도 새 세션 필수.

## 재시도 — 무재시도는 명시적 선택

- Track B 재수거(XAUTOCLAIM)는 **멱등 executor만** 켠다. 비멱등(realtime STT — 재실행=이중과금)은 `reclaim=None` + **근거 주석 필수**(은닉 금지 — 버그로 오인·삭제 방지).
- 재시도 일원화의 목표 상태 = Track A outbox가 주인(reaction이 멱등성 선언) — enqueue-seam(8-4) 완성 후.

## 종료

- event = `Lifecycle`(SIGTERM/SIGINT) + `Pool.wait()`(in-flight gather drain). stream = 직렬(count=1)이라 현재 메시지 완료로 충분.
- cron `shutdown(wait=False)` = **의도적**(AsyncIOScheduler에 wait 무의미 + 멱등·next-tick 설계) — "고치지" 말 것.

## 구조·import

- 상시 소비 워커 = `runner`·`consumer`·`connection` 3분할(+event `sweeper`·stream `batch`). `worker/batch.py`·`__main__.py`는 레거시 부트 호환 keeper — 신규 금지.
- **worker→modules 내부(repository/models/services) 직접 import 금지** — 도메인 접근은 application handler(EVENT_REACTIONS·JOB_HANDLERS·cron handler) 경유. 예외 2: `event` 모듈(이벤트 아웃박스 = 워커 인프라)·`notification.helpers`의 `dispatch_single_notification`·`send_sms_to_client`(06장이 인정한 **공식 발송 표면** — repo/service가 아니라 발송 API라 워커 직접 사용 허용, 레퍼런스 [scheduled.py](../../../apps/api/app/worker/cron/scheduled.py):25). hook(check_cross_module_import)이 advisory로 감시.
- 외부 채널 발송(알림톡/SMS)은 tx 커밋 뒤 `asyncio.create_task`(tx 안 외부 IO 금지).

## 안티패턴

- cron 핸들러가 `async with uow`/`commit` → xact lock 조기 해제. tx-free로
- 비멱등 잡에 reclaim/재시도 → 이중과금. `reclaim=None`+주석
- 워커가 NOTIFY payload의 center/actor 신뢰 → claim 행에서 읽기([behavior.md](behavior.md) §6)
- 워커가 modules repo/service 직접 import → handler 경유(`notification.helpers` 발송 표면·`event` 인프라는 예외)
