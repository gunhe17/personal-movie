"""지속성 커널 — DB 엔진/세션, BaseModel, UnitOfWork.

P2(2026-06-15): core에서 이전. 도메인(modules)이 직접 import 허용하는 안정적 지속성 추상.
스키마 초기화(init_db)는 조립 관심사라 app/server/lifecycle.py에 있음.
"""
