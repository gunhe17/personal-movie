# 오버라이드(승격) 예 — 배치 가구 등록

`POST /clients/batch`(보호자+자녀+형제 관계 자동 생성)는 표준 create의 변형이 아니라
**복합 use-case**다 — 생성 뼈대로 못 담는다. 이런 것은 처음부터 수제 파일로 두고
생성기는 관여하지 않는다 (현행 `create_clients.py` 그대로 유지).

승격 절차: `generated/create_client.py`로 부족해지는 순간 →
그 파일을 `services/create_client.py`로 복사 → 생성기가 다음 재생성부터 스킵 →
이후는 일반 수제 코드로 취급 (단방향 — 다시 생성 관리로 되돌리지 않는다).
