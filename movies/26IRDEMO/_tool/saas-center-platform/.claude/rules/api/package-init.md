---
paths:
  - "apps/api/app/modules/**/__init__.py"
---

# 모듈 패키지 구조 + `__init__.py`

> 레퍼런스 [activity_log](../../../apps/api/app/modules/activity_log/) (실모듈).
> 정답 구조를 따르지 않는 것이 의도된 예외(BFF read-model·게이트웨이·플러그인 SPI·스트리밍·서브모듈 router 등)는 [ARCHITECTURE.md](../../../apps/api/app/modules/ARCHITECTURE.md) 예외 카탈로그(EX-1~EX-10)에 명문화.

## 1. 구조 — 항상 멀티 서브모듈

모든 모듈은 **서브모듈 단위**로 구성한다(엔티티 1개라도). `model`·`repository`·`service`는 **서브모듈 안에만** — 모듈 루트로 새지 않는다.

```
activity_log/
├── __init__.py            # 공개 표면 (service re-export)
├── router.py              # 루트 — HTTP 마운트 지점 (main.py가 import)
├── facade/                # 루트 — application handler 전용 표면 (타 도메인 모듈 비노출)
└── activity_log/          # 서브모듈 = 수직 슬라이스
    ├── models.py · repository.py · schemas.py
    ├── services/          # (__init__ 없음)
    └── handlers/
```

- `facade`는 루트 유지 = 외부 경계(application handler가 import). `router`도 루트가 기본이되, **루트가 prefix·tags·순서를 더할 때만 둔다** — 서브 라우터를 그대로 통과시키기만 하는 루트 router.py는 두지 않고 [routers.py](../../../apps/api/app/modules/routers.py)가 서브를 직접 들인다(2026-08-14: assistant·billing·form·messaging·voucher 5개 제거). 모듈 `__init__`의 router 재노출도 금지 — 출처는 언제나 `router.py`. 라우트의 소유자는 **URL 경로 그룹**이다([ARCHITECTURE.md](../../../apps/api/app/modules/ARCHITECTURE.md) EX-1) — 호출 대상이 module handler냐 application handler냐는 기준이 아니다.
- **모듈 비노출 (모듈은 서로를 모른다)** — cross-module 워크플로를 조율하는 유일 주체는 **application handler**: 각 모듈의 루트 `facade`를 호출해 조립한다. **도메인 모듈은 타 모듈의 `facade`·`service`·`repository`·`model` 어느 것도 import하지 않는다** — facade→facade·handler→facade·service→service 전부 금지([persistence-repository.md](persistence-repository.md) §6 repo JOIN 금지·모듈 간 model import 0과 같은 원칙). 예외: admin/집계 read 표면(`platform_admin/*`)은 §6.3 read-model로 직접 JOIN 허용 — 단 read만, 쓰기는 owning 모듈 facade 경유([cross-module-write.md](cross-module-write.md) 신설·이동·재사용).
- **모델 등록은 손 목록이 아니다** — [`app/modules/models.py`](../../../apps/api/app/modules/models.py)가 트리에서 `models.py`·`model.py`를 수집해 `BaseModel.metadata`에 등록하고, `init_db`·alembic `migrations/env.py`가 그것만 import한다. 새 모델·경로 이동에 등록 작업 0(옛 손 목록 3벌은 서로 어긋나 `init_db`가 123개 중 24개를 빠뜨리고 있었다 — 2026-08-14 실측).
- **기능 서브모듈** — 한 서브모듈이 2+ 엔티티를 담았으면 데이터(`model`·`repository`·`service`)를 엔티티별 서브모듈로 가른다. 그러면 `router`·`handler`·`schema`만 남는 기능 서브모듈이 생긴다(예: 데이터=`client_relation`·`sibling_relation`, 기능=`client/relation`). 허용 — 여러 엔티티를 묶는 기능 표면. 기능 서브모듈의 handler/service가 같은 모듈 내 형제 데이터 서브모듈을 cross-import하는 것도 허용(한 aggregate).

## 2. `__init__.py`

| 위치 | `__init__.py` |
|---|---|
| 모듈 루트 | **루트 소비처가 있으면** 그 소비처가 쓰는 공개 심볼을 re-export + `__all__`. 루트 소비처 0이면 빈/부재 허용 |
| 서브모듈 (`activity_log/` 등) | 두지 않는다 — namespace package(PEP 420) |
| `services/`·`handlers/` | re-export 허용 — 호출처가 `from ..services import X`(패키지 경유)에 의존하면 둔다. namespace(없음)도 무방 |

- **re-export는 소비처가 정한다** — `from app.modules.{m} import X`(루트 경유) 소비처가 실재할 때만 그 심볼을 루트에 노출. 루트 소비처가 없으면(모두 서브모듈 full-path로 import) 빈/부재 `__init__`이 정상 — 쓰이지 않는 공개 표면을 추측으로 만들지 않는다(2026-06-29 결정).
- import: 공개 심볼은 루트에서(`from .. import CreateXService`), 비공개 impl(`repository`·`models`)은 full-path(`from ..activity_log.repository import X`).

```python
# good: 모듈 루트 = 유일한 공개 표면 (activity_log/__init__.py)
from .activity_log.services.create_activity_log import CreateActivityLogService
from .activity_log.services.list_activity_logs import ListActivityLogsService
__all__ = ["CreateActivityLogService", "ListActivityLogsService"]

# 틀린 것 → 맞는 것
# 빈 activity_log/__init__.py 를 남김  →   삭제 (namespace package)
```
