"""Worker Redis Stream / Consumer Group 이름.

- realtime: ai:jobs / ai-workers — 즉시성 작업(field_note STT·요약 등).
  consumer.py 의 모듈 기본값으로 정의되어 있으며 여기서 재정의하지 않는다.
- batch:    ai:jobs:batch / batch-workers — 즉시 응답이 필요 없는 여유 작업 범용 큐.
  voucher 추출 등 비긴급/대용량 잡을 별도 worker 프로세스에서 처리(realtime 큐와 격리).

batch 큐에 잡을 던지는 모듈은 executor 가 멱등이어야 한다(batch worker 는 XAUTOCLAIM
reclaim 으로 고착 메시지를 재배달하므로).
"""

STREAM_KEY_BATCH = "ai:jobs:batch"
GROUP_BATCH = "batch-workers"
