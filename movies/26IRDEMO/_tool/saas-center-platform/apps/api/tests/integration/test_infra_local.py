"""infra 리팩토링 후 배선 검증 — 실제 로컬 리소스(PostgreSQL/파일시스템/스케줄러)에 붙는다.

DB 테스트는 conftest의 `test_session`(imomtae_test 전용 가드) 위에서 돈다.
"""
import hashlib

import pytest

from app.core.config import settings
from app.infrastructure.persistence.new_repository import PostgresRepository
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.institution.institution.models import Institution

from app.infrastructure.storage.local.client import LocalStorageClient
from app.infrastructure.storage import factory as storage_factory

from app.infrastructure.cache.factory import get_cache_client
from app.infrastructure.cache.noop.client import NoopCacheClient
from app.infrastructure.cache.redis.client import RedisCacheClient

from app.infrastructure.scheduler.apscheduler.client import ApScheduler
from app.infrastructure.scheduler.factory import get_scheduler


class InstitutionRepository(PostgresRepository[Institution]):
    model = Institution

    async def find_including_deleted(self, id: str) -> Institution | None:
        return await self._session.get(Institution, id)

    async def count_by_name(self, name: str) -> int:
        return await self._count(where=[Institution.name == name])


# ---------------------------------------------------------------- DB (persistence)


async def test_db_create_and_get_roundtrip(test_session):
    repo = InstitutionRepository(test_session)

    created = await repo.add(Institution(name="테스트기관"))
    assert created.id
    assert created.created_at is not None

    fetched = await repo.find_by_id(created.id)
    assert fetched is not None
    assert fetched.name == "테스트기관"


async def test_db_soft_delete_hides_entity(test_session):
    repo = InstitutionRepository(test_session)
    created = await repo.add(Institution(name="삭제대상"))

    assert await repo.remove_by_id(created.id) is not None
    assert await repo.find_by_id(created.id) is None
    assert await repo.find_including_deleted(created.id) is not None


async def test_unit_of_work_rolls_back_on_error(test_session):
    repo = InstitutionRepository(test_session)

    with pytest.raises(RuntimeError):
        async with UnitOfWork(test_session):
            await repo.add(Institution(name="롤백대상"))
            raise RuntimeError("boom")

    assert await repo.count_by_name("롤백대상") == 0


# ---------------------------------------------------------------- storage (local)


async def test_local_storage_upload_download_roundtrip(tmp_path):
    client = LocalStorageClient(base_path=str(tmp_path))
    data = b"hello-local-storage"

    result = await client.upload_file(data, "docs/a.txt", "text/plain")
    assert result["size"] == len(data)
    assert result["checksum"] == hashlib.md5(data).hexdigest()

    assert await client.download_file("docs/a.txt") == data


async def test_local_storage_versions_and_delete(tmp_path):
    client = LocalStorageClient(base_path=str(tmp_path))
    await client.upload_file(b"v1", "x.bin", "application/octet-stream")
    await client.upload_file(b"v2", "x.bin", "application/octet-stream")

    assert len(await client.list_versions("x.bin")) == 2

    await client.delete_file("x.bin")
    from app.core.exceptions import EntityNotFoundException
    with pytest.raises(EntityNotFoundException):
        await client.download_file("x.bin")


def test_storage_factory_local_branch(monkeypatch):
    monkeypatch.setattr(settings, "S3_BUCKET_ENABLED", False)
    storage_factory.get_storage_client.cache_clear()
    try:
        assert isinstance(storage_factory.get_storage_client(), LocalStorageClient)
    finally:
        storage_factory.get_storage_client.cache_clear()


# ---------------------------------------------------------------- cache


async def test_cache_factory_falls_back_to_noop_when_redis_disabled():
    if settings.REDIS_ENABLED:
        pytest.skip("REDIS_ENABLED=True — noop fallback 경로 아님")
    assert isinstance(await get_cache_client(), NoopCacheClient)


async def test_noop_cache_satisfies_contract():
    c = NoopCacheClient()
    await c.set("k", "v", ex=10)
    assert await c.get("k") is None
    assert await c.exists("k") is False
    assert await c.ping() is False
    assert await c.brpop("q", timeout=0) is None
    await c.delete("k")
    await c.publish("ch", "m")
    await c.lpush("q", "a")
    await c.close()


async def test_redis_cache_roundtrip_if_reachable():
    import redis.asyncio as aioredis

    r = aioredis.Redis(host="localhost", port=6379, decode_responses=True)
    try:
        await r.ping()
    except Exception:
        await r.aclose()
        pytest.skip("로컬 redis(:6379) 미접속 — redis 어댑터 통합 검증 생략")

    client = RedisCacheClient(r)
    try:
        await client.set("itest:k", "v", ex=10)
        assert await client.get("itest:k") == "v"
        assert await client.exists("itest:k") is True
        await client.delete("itest:k")
        assert await client.exists("itest:k") is False
    finally:
        await client.close()


# ---------------------------------------------------------------- scheduler


def test_scheduler_factory_returns_apscheduler():
    assert isinstance(get_scheduler(), ApScheduler)


def test_scheduler_disabled_is_noop():
    sched = ApScheduler(enabled=False)
    sched.start()
    assert sched._scheduler is None
    sched.stop()


async def test_scheduler_starts_registers_jobs_and_stops():
    sched = ApScheduler(enabled=True)
    registered = {}

    def register(scheduler):
        scheduler.add_job(lambda: None, "interval", seconds=3600, id="probe")
        registered["called"] = True

    sched.start(register_jobs=register)
    assert registered.get("called") is True
    assert sched._scheduler is not None
    assert sched._scheduler.get_job("probe") is not None

    sched.start()  # 이미 running → 재시작 무시
    assert sched._scheduler.get_job("probe") is not None

    sched.stop()
    assert sched._scheduler is None
