"""서버 조립층 (L3) — FastAPI 생명주기·부팅 와이어링.

main.py(엔트리)는 app 생성·라우터 마운트·핸들러만 담당하고,
startup/shutdown 오케스트레이션은 lifecycle.py가 소유한다. (구 app/bootstrap 대체)
"""
