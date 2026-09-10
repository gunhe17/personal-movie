---
paths:
  - "apps/api/app/server/**"
  - "apps/api/app/main.py"
---

# server 조립층 (L3) + main.py 합성 루트

FastAPI 앱을 **선언적으로 조립**한다 — 미들웨어·라우터·예외핸들러·lifespan 등록 + `app` 빌드. 비즈니스 로직 0. 명령형 `main.py` 와이어링을 `Server` 빌더(register → `.app()`)로 선언화한 것이며, **기존 동작(라우트 스냅샷·미들웨어 순서·예외 매핑) 보존이 불변식**이다. (personal_secret server 패턴 차용)

## 프레임워크 프리미티브 (`server/server.py`)
도메인 무지의 순수 어댑터 — 전부 `register(app: FastAPI)` 하나를 갖고, `Server.app()`이 등록 큐를 순회 호출.

| 래퍼 | 역할 |
|------|------|
| `Router(*, router, prefix="")` | **모듈 APIRouter + prefix** 를 `include_router`. 엔드포인트 단위 재선언 X (558+ 기존 라우터 보존) |
| `Middleware(*, cls=…\|func=…, **options)` | 클래스형(`add_middleware`) 또는 함수형(`@app.middleware`) |
| `ExceptionHandler(*, exception_class, handler)` | `add_exception_handler` |
| `Server` | 등록 큐(`startup`/`shutdown`/`middleware`/`router`/`exception_handler`) + `app()` |
| `saas_center_api()` | settings 기반 `Server` 팩토리(소문자) |

- `app()` **등록 순서**: 미들웨어 → 라우터 → 예외핸들러. 이 순서를 바꾸지 말 것.
- **미들웨어는 선언 순 = 요청 통과 순(바깥→안)** — starlette `add_middleware`가 `insert(0)`이라 `app()`이 역순으로 등록해 뒤집는다. 첫 선언(CORS)이 최외곽. 큐에 넣는 순서만 보고 판단하지 말 것.
- **lifespan은 훅 큐가 조립** — `startup`/`shutdown`에 등록한 async 훅 `(app) -> None`을 등록 순으로 실행하는 CM을 `app()`이 만들어 FastAPI에 넘긴다. shutdown도 등록 순(역순 아님) — main.py가 원하는 순서로 적는다.

## 합성 루트 — `app/main.py` (등록의 단일 출처)
조립이 일어나는 **유일한** 곳. 모듈 라우터를 import해 `Router(router=…, prefix="/api/v1")`로 등록.
```python
server = saas_center_api()
server.startup(lifecycle.start_logging); ...  # server/lifecycle.py 훅 (선언 순 실행)
server.shutdown(lifecycle.close_database)
server.middleware(middleware.cors()); ...     # server/middleware.py 팩토리 (첫 선언 = 최외곽)
for h in exception.domain_handlers(): server.exception_handler(h)
server.exception_handler(exception.fallback())
server.router(Router(router=system.router))   # system 먼저
server.router(Router(router=routers.person_router, prefix="/api/v1"))  # 도메인
app = server.app()
```
- `# server`/`# middleware`/`# exception`/`# router` 섹션 마커로 구획, `app`은 끝에서 빌드.
- 모듈은 자기를 등록하지 않는다 — 등록은 main.py에만.
- **모듈 라우터 import는 [`app/modules/routers.py`](../../../apps/api/app/modules/routers.py) 하나가 소유** — main.py는 `from app.modules import routers` 한 줄. 이름 규약 `{module}_router`(대표)·`{module}_{name}_router`(추가), 출처는 항상 `{module}[/{submodule}]/router.py`(모듈 `__init__` 재노출 경유 금지). 등록의 순서·prefix는 계속 main.py 소유 — routers.py는 import만.
- 이 집계를 **패키지 init(`app/modules/__init__.py`)에 두지 않는다** — `app.modules.무엇이든` import할 때마다 라우터 전량이 딸려와 modules(하층)가 application(상층)에 의존하게 되고 순환이 난다(실측: `app.worker.cron.scheduled` 진입 시 `partially initialized module` ImportError). 별도 모듈이라 명시 import 때만 로드된다.
- 신설 라우터가 routers.py에도 없고 부모 `include_router`에도 없으면 hook(`check_router_registration.py`)이 편집 직후 알린다.

## 레이어별 소유 (`server/`)
| 파일 | 소유 |
|------|------|
| `server.py` | 빌더 프리미티브 + `saas_center_api()` 팩토리 |
| `middleware.py` | `cors()`/`permission_version()`/`request_logging()` 팩토리 — **순서·옵션 기존 보존** |
| `exception.py` | 도메인예외→HTTP 매핑(`domain_handlers()`) + catch-all(`fallback()`). status·바디·trace_id/error_id 로깅·dev/prod 분기 보존 |
| `system.py` | 루트/헬스 라우터(main 인라인 X) + 서버 렌더링 페이지 라우트(`/schema-canvas`). `/ontology-explorer`는 페이지가 아니라 `tools/ontology-explorer`(Vite) 리다이렉트 |
| `pages/` | 그 페이지의 HTML 자산 + 경로 상수. 정적 파일만 — 데이터 빌드는 소유 패키지가(예: `persistence/schema_doc.py`) |
| `lifecycle.py` | startup/shutdown 훅 본문(`start_logging`·`seed_system_templates`·`close_database` …) + `init_db`(전 모듈 models import→metadata 등록, `scripts/init_db.py`도 소비). 훅 하나 = `async def {verb}_{noun}(app)` 하나, 등록은 main.py. **조립층(L3)이라 core/infra/modules/runtime/application 자유 import** |

## 안티패턴
- 엔드포인트/모듈이 **자기를 라우터에 등록** → main.py 단일 출처.
- `server/`가 도메인 비즈니스 로직 보유 → 조립·와이어링만(`Callable`/`APIRouter`만 받음).
- 예외 매핑·미들웨어 옵션을 main.py에 **인라인** → `exception.py`/`middleware.py` 팩토리로.
- lifespan 로직을 main.py에 인라인 → 훅 본문은 `lifecycle.py` 소유, main.py는 `server.startup(...)` 등록 한 줄.
- 부팅 단계를 한 훅에 뭉치기 → 단계 하나 = 훅 하나(순서가 main.py에 드러나야 한다).
- 조립 방식 바꾸며 **라우트/미들웨어 순서를 무심코 변경** → 동작 보존이 불변식, 라우트 스냅샷 대조.

## 검증
구조/조립 변경 후 **라우트 스냅샷 DIFF=0**(엔드포인트 수·경로·메서드 불변) + 미들웨어 순서 보존 확인. (선언화는 동작 보존이 목적)
