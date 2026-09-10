---
paths:
  - "apps/api/tests/**"
---

# Testing — 계층별 경계

테스트는 검증 대상 레이어로 나뉜다. 각 레벨은 대상·DB·격리 수단이 다르다 — 한 테스트가 여러 레이어를 겸하지 않는다. `pyproject.toml`의 `asyncio_mode = "auto"`라 async 테스트에 `@pytest.mark.asyncio`를 붙이지 않는다. `testpaths = ["tests"]`.

루트: 레이어 정의 [service.md](service.md)·[facade.md](facade.md)·[application.md](application.md)·[router.md](router.md).

---

## 이 문서

| 섹션 | 핵심 |
|------|------|
| 레벨 | unit(Mock) / integration(Test DB) / e2e(Test DB, HTTP) / scenarios |
| DB | 실 DB fixture는 이름이 `*_test`인 DB에서만 동작 — 개발 DB 보호 |
| fixture | `tests/conftest.py` — `test_session`·`test_client`·`cleanup_db`. function 스코프 |
| 위치 | 대상 레이어 폴더 아래, 모듈명 하위(`tests/unit/{module}/test_*.py`) |

---

## 1. 레벨 · 경계

| 레벨 | 대상 | DB | 수단 | 위치 |
|------|------|----|------|------|
| **unit** | service·gateway 등 단위 로직 | Mock | `unittest.mock`(`AsyncMock`/`patch`)로 repository·의존 격리 | `tests/unit/{module}/` |
| **integration** | facade — 여러 service 조합 | Test DB | `test_session` | `tests/integration/` |
| **e2e** | router→handler→DB 전체 흐름 | Test DB | `AsyncClient`(httpx)로 실제 HTTP | `tests/e2e/` |
| **scenarios** | 다단계 유스케이스 시나리오 | Test DB | e2e 조합 | `tests/scenarios/` |

- **unit은 DB를 안 켠다** — repository/외부 어댑터를 mock. 도메인 로직(검증·분기·계산)만 본다.
- **integration 이상은 Test DB** — `test_session`/`test_client` fixture 경유. mutation은 실 트랜잭션으로 검증.
- 새 테스트는 검증하려는 레이어의 폴더에 둔다. service 로직이면 unit, HTTP 계약·권한 게이트면 e2e.

## 2. fixture (`tests/conftest.py`)

| fixture | 제공 |
|---------|------|
| `test_engine` | `*_test` DB 엔진 — DB 이름이 `_test`로 안 끝나면 즉시 실패(개발 DB 보호) |
| `cleanup_db` | function마다 스키마 초기화 |
| `test_session` | `AsyncSession` (repository/facade 직접 호출용) |
| `test_client` | `AsyncClient` + `get_db` override (e2e HTTP) |
| `seed_roles` 등 | 공통 시드 |

- 전부 **function 스코프** — 테스트 간 상태 격리. 공유 상태를 만들지 않는다.
- e2e HTTP 인증이 필요하면 admin/account 토큰을 fixture나 setup 블록에서 발급([e2e/conftest.py](../../../apps/api/tests/e2e/conftest.py)).
- 무한 await(스트리밍 등) 방어로 `faulthandler_timeout = 60` — 스위트가 hang하면 60초 후 스택 덤프.

## 3. 실행

```bash
# apps/api
uv run pytest                       # 전체 (testpaths=tests)
uv run pytest tests/unit            # 레벨만
uv run pytest tests/e2e/test_06_voucher_admin_flow.py::test_admin_voucher_crud_flow
```

---

## 안티패턴

- unit에서 실 DB 연결 → repository를 mock으로 격리(§1). DB 필요하면 integration/e2e로 올린다.
- async 테스트에 `@pytest.mark.asyncio` → `asyncio_mode="auto"`라 불필요.
- fixture를 session/module 스코프로 공유 상태 → function 스코프(테스트 격리).
- 개발 DB로 테스트 → fixture가 `*_test`만 허용, 우회 금지.
- 한 테스트가 service+HTTP를 겸함 → 레이어별로 분리(unit vs e2e).
