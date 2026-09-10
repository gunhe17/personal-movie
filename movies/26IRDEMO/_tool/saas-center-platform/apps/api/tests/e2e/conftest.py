"""E2E 테스트 공통 인프라.

실행 방법 (필수):
    bash scripts/run_e2e.sh            # DATABASE_URL을 *_test DB로 강제 후 pytest 실행
    bash scripts/run_e2e.sh -k client  # pytest 인자 전달

설계 원칙:
- 안전 가드: DB 이름이 `_test`로 끝나지 않으면 즉시 중단 (개발 DB 보호).
  세션 팩토리가 전역 AsyncSessionLocal이라 dependency override로는 격리가 불가능하고,
  환경변수(DATABASE_URL)로 앱 전체를 test DB에 바인딩하는 것이 유일한 격리 수단이다.
- 세션 시작 시 1회: test DB 생성(없으면) → public 스키마 리셋 → seed 실행.
  seed = 테스트의 고정 베이스라인 (계정 5, 센터 1, 내담자 7, 관계, 검사 카탈로그 등).
- 테스트는 seed를 읽고, 쓰기는 고유 식별자(unique())로 "추가"만 한다.
  truncate 없음 → 테스트는 실행 순서에 독립적이어야 한다.
- 전역 AsyncSessionLocal을 NullPool 엔진으로 재바인드: pytest-asyncio의
  함수 스코프 이벤트루프 간 커넥션 풀 공유 문제(another loop 에러)를 제거.
- 외부 발송(AlimTalk/SMS/FCM)은 클래스 레벨 패치로 차단, AI 잡 디스패처는
  레코더로 교체 (dispatched_jobs fixture로 발행 내역 검증 가능).
"""
import asyncio
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings

# ── 안전 가드: *_test DB가 아니면 e2e 전체 skip (DB는 일절 건드리지 않음) ────
# pytest.exit가 아닌 skip인 이유: `pytest tests` 전체 실행 시 unit까지 죽이지 않기 위함.
# DB 리셋/seed는 전부 e2e_environment fixture 안에서만 일어나므로 skip이면 안전하다.
_DB_NAME = settings.DATABASE_URL.rsplit("/", 1)[-1]
_IS_TEST_DB = _DB_NAME.endswith("_test")
_GUARD_MSG = (
    f"E2E는 *_test DB에서만 실행 (현재: {_DB_NAME}) — scripts/run_e2e.sh 를 사용하세요"
)

# 응답자(최종 응답 위임) 강제 비활성 — e2e는 최종 문구를 단정하고 외부 LLM 호출 금지.
# run_e2e.sh env와 이중 방어(DB 가드와 같은 결 — 스크립트 우회 실행에도 안전)

from app.infrastructure.persistence.database import AsyncSessionLocal  # noqa: E402
from app.infrastructure.persistence.models import BaseModel  # noqa: E402
from app.main import app  # noqa: E402  (모든 모델이 metadata에 등록됨)


# ═══════════════════════════════════════════════════════════════════
# 세션 1회: DB 준비 + seed
# ═══════════════════════════════════════════════════════════════════

def _server_url(dbname: str) -> str:
    """asyncpg 직결용 URL (드라이버 접두사 제거, DB명 교체)."""
    base = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    return base.rsplit("/", 1)[0] + f"/{dbname}"


async def _ensure_test_database() -> None:
    """imomtae_test DB가 없으면 생성한다."""
    import asyncpg

    last_error: Exception | None = None
    for admin_db in ("postgres", _DB_NAME.removesuffix("_test")):
        try:
            conn = await asyncpg.connect(_server_url(admin_db))
        except Exception as e:  # 접속 가능한 admin DB를 찾을 때까지 시도
            last_error = e
            continue
        try:
            exists = await conn.fetchval(
                "SELECT 1 FROM pg_database WHERE datname = $1", _DB_NAME
            )
            if not exists:
                await conn.execute(f'CREATE DATABASE "{_DB_NAME}"')
            return
        finally:
            await conn.close()
    raise RuntimeError(f"test DB 생성 실패: {last_error}")


async def _reset_schema_and_seed() -> None:
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)

    # 스키마 통째 리셋 — 과거 실행이 남긴 어떤 테이블도 제거
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.run_sync(BaseModel.metadata.create_all)

    # 앱 전역 세션팩토리 재바인드 (NullPool: 루프 간 커넥션 공유 없음).
    # behavior flow/get_db/seed 스크립트 전부 이 팩토리를 공유한다.
    AsyncSessionLocal.configure(bind=engine)

    # seed = 테스트 베이스라인 (common 순서 일부 + develop 픽스처, S3 의존 시드는 제외)
    from scripts.seed.common import role, assessment, admin_account
    from scripts.seed import develop

    await role.main()
    await assessment.main()
    await develop.seed_fixtures()
    await admin_account.main()


def _force_local_storage() -> None:
    """S3 대신 로컬 디스크로 — e2e가 실제 버킷에 파일을 쓰지 않게."""
    # 소비처가 get_storage_client를 직접 import해 갔으므로 이름 재바인딩은 안 먹는다 —
    # 팩토리 분기 조건을 바꾸고 캐시를 비워 실제 함수가 로컬을 돌려주게 한다.
    from app.infrastructure.storage.factory import get_storage_client

    settings.S3_BUCKET_ENABLED = False
    get_storage_client.cache_clear()


def _block_external_messaging() -> None:
    """AlimTalk/SMS(LGU)·FCM 클래스를 no-op으로 패치 — 외부 발송 원천 차단."""
    from app.infrastructure.messaging.lgu.transport import LGUBaseClient

    async def _noop_request(self, *args, **kwargs):
        return {"status": "skipped-by-e2e"}

    async def _noop_token(self, *args, **kwargs):
        return "e2e-dummy-token"

    LGUBaseClient._request = _noop_request
    LGUBaseClient._get_access_token = _noop_token

    try:
        from app.infrastructure.messaging.firebase import client as firebase_client

        for cls_name in ("FirebaseService", "FirebasePushService"):
            cls = getattr(firebase_client, cls_name, None)
            if cls is None:
                continue
            cls.__init__ = lambda self, *a, **k: None

            async def _noop_push(self, *args, **kwargs):
                return {"status": "skipped-by-e2e"}

            for name in dir(cls):
                if name.startswith("send"):
                    setattr(cls, name, _noop_push)
    except ImportError:
        pass


# AI 잡 발행 레코더 (실제 STT/LLM 실행 차단 + 발행 내역 검증용)
_dispatched_jobs: list[dict] = []


class _RecordingDispatcher:
    async def dispatch(self, job_type, *, target_id, center_id, params=None):
        _dispatched_jobs.append(
            {
                "job_type": job_type,
                "resource_id": target_id,
                "center_id": center_id,
                "params": params or {},
            }
        )


def _block_llm() -> None:
    """Anthropic Messenger.create를 카드형 응답으로 패치 — 실 LLM 네트워크 호출 차단.
    ASGITransport는 BackgroundTasks 완료까지 응답을 안 돌려주므로, 프로필 refine 등
    요청에 딸린 LLM 호출이 안 막히면 스윕이 hang한다(faulthandler 60s)."""
    from app.infrastructure.anthropic.common.schemas import MessageResult, Usage
    from app.infrastructure.anthropic.messages.client import AnthropicMessenger

    async def _canned(self, **kwargs) -> MessageResult:
        return MessageResult(
            text='{"work_style": "", "primary_focus": [], "notes": ""}',
            stop_reason="end_turn",
            usage=Usage(input_tokens=0, output_tokens=0),
            tool_uses=[],
            model="e2e-stub",
            content=[],
        )

    AnthropicMessenger.create = _canned


def _override_dispatchers() -> None:
    # behavior의 with_dispatcher()/with_batch_dispatcher() 액션이 factory 함수를
    # (Depends 아닌) 직접 호출하므로, dependency_overrides 대신 모듈 속성을 패치한다.
    # 액션이 act 안에서 지역 import(`from ...factory import get_task_dispatcher`)라
    # 호출 시점에 패치된 속성을 집어 든다.
    from app.infrastructure.worker import factory

    async def _recorder(*args, **kwargs):
        return _RecordingDispatcher()

    factory.get_task_dispatcher = _recorder
    factory.get_batch_dispatcher = _recorder


@pytest.fixture(scope="session", autouse=True)
def e2e_environment():
    """세션 전체에서 1회: DB 리셋 + seed + 외부 효과 차단."""
    if not _IS_TEST_DB:
        pytest.skip(_GUARD_MSG)

    async def _setup():
        await _ensure_test_database()
        await _reset_schema_and_seed()

    asyncio.run(_setup())
    _block_external_messaging()
    _block_llm()
    _force_local_storage()
    _override_dispatchers()
    yield
    app.dependency_overrides.clear()


# ═══════════════════════════════════════════════════════════════════
# 클라이언트 / 인증 fixture
# ═══════════════════════════════════════════════════════════════════

SEED_PASSWORD = "test1234"
SEED_USERS = {
    "admin": "admin@mindscope.com",  # 김원장 (ADMIN)
    "manager": "manager@mindscope.com",  # 이사무 (MANAGER)
    "staff": "staff@mindscope.com",  # 박접수 (STAFF)
    "counselor1": "counselor1@mindscope.com",  # 정상담 (COUNSELOR)
    "counselor2": "counselor2@mindscope.com",  # 최치료 (COUNSELOR)
}

_login_cache: dict[str, dict] = {}


@pytest.fixture
async def api():
    """비인증 ASGI 클라이언트."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", timeout=30) as c:
        yield c


async def login_as(api: AsyncClient, key: str) -> dict:
    """seed 계정 로그인 → {headers, center_id, account_id, ...} (세션 캐시)."""
    if key in _login_cache:
        return _login_cache[key]

    r = await api.post(
        "/api/v1/auth/login",
        json={"email": SEED_USERS[key], "password": SEED_PASSWORD},
    )
    assert r.status_code == 200, f"login failed ({key}): {r.status_code} {r.text}"
    data = r.json()
    session = {
        "key": key,
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
        "account_id": data["account"]["id"],
        "person_id": data["person"]["id"] if data.get("person") else None,
        "center_id": data["centers"][0]["id"] if data["centers"] else None,
        "centers": data["centers"],
    }
    _login_cache[key] = session
    return session


@pytest.fixture
async def admin(api):
    return await login_as(api, "admin")


@pytest.fixture
async def manager(api):
    return await login_as(api, "manager")


@pytest.fixture
async def staff(api):
    return await login_as(api, "staff")


@pytest.fixture
async def counselor(api):
    return await login_as(api, "counselor1")


@pytest.fixture
def dispatched_jobs():
    """이번 테스트에서 발행된 AI 잡 검증용. 사용 전 초기화."""
    _dispatched_jobs.clear()
    return _dispatched_jobs


def unique(prefix: str) -> str:
    """seed/테스트 간 충돌 없는 고유 이름."""
    return f"{prefix}-{uuid.uuid4().hex[:6]}"
