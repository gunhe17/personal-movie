"""비-HTTP 트리거 드라이버(shell) 네임스페이스.

메커니즘별 서브패키지 — 각자 트리거 lifecycle을 소유하고 일은 application handler에 위임:
  event/   Track A · Postgres LISTEN/NOTIFY   · python -m app.worker.event
  stream/  Track B · Redis Stream             · python -m app.worker.stream[.batch]
  cron/    시간 · APScheduler                 · API lifecycle이 register (별 프로세스 아님)
"""
