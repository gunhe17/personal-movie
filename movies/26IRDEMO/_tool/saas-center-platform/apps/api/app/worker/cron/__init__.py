"""cron 워커 — APScheduler 기반 시간 트리거. 별 프로세스 아님(API lifecycle이 register).

event·stream 껍질과 달리 큐/루프가 없어 runner/consumer 역할이 없다 — scheduled.py 하나.
"""
