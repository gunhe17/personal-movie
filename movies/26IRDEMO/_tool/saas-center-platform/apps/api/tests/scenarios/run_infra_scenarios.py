"""인프라 리팩토링 검증 시나리오 — 인프라별 end-to-end 흐름 1개씩.

pytest 없이 asyncio로 직접 실행하는 시나리오 러너.
실행: uv run python tests/scenarios/run_infra_scenarios.py

대상: persistence(PostgreSQL) / storage(local) / cache / scheduler.
DB는 반드시 *_test 만 사용 — 개발 DB 보호.
"""
import asyncio
import hashlib
import shutil
import sys
import tempfile
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.infrastructure.persistence.models import BaseModel
from app.infrastructure.persistence.new_repository import PostgresRepository as BaseRepository
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.institution.institution.models import Institution

from app.infrastructure.storage.local.client import LocalStorageClient
from app.infrastructure.cache.factory import get_cache_client
from app.infrastructure.cache.noop.client import NoopCacheClient
from app.infrastructure.scheduler.apscheduler.client import ApScheduler


TEST_DATABASE_URL = "postgresql+asyncpg://imomtae:imomtae_dev@localhost:3501/imomtae_test"


class InstitutionRepository(BaseRepository[Institution]):
    def __init__(self, session):
        super().__init__(Institution, session)


class ScenarioRunner:
    def __init__(self):
        self.engine = None
        self.async_session = None
        self.passed = 0
        self.failed = 0
        self.errors = []

    async def setup(self):
        print("\n" + "=" * 60)
        print("🚀 인프라 시나리오 환경 초기화")
        print("=" * 60)

        db_name = TEST_DATABASE_URL.rsplit("/", 1)[-1]
        if not db_name.endswith("_test"):
            raise RuntimeError(f"안전 가드: *_test DB만 허용 (현재: {db_name})")

        self.engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool, echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.drop_all)
            await conn.run_sync(BaseModel.metadata.create_all)
        self.async_session = async_sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False,
        )
        print(f"✅ DB({db_name}) 테이블 생성 완료\n")

    async def teardown(self):
        if self.engine:
            await self.engine.dispose()
        print("\n" + "=" * 60)
        print("🧹 환경 정리 완료")
        print("=" * 60)

    async def run(self, fn, name):
        print("\n" + "-" * 60)
        print(f"🧪 {name}")
        print("-" * 60)
        try:
            await fn()
            self.passed += 1
            print(f"✅ 통과: {name}")
        except Exception as e:
            self.failed += 1
            msg = f"❌ 실패: {name}\n   {type(e).__name__}: {e}"
            self.errors.append(msg)
            print(msg)

    def print_summary(self):
        print("\n" + "=" * 60)
        print("📊 시나리오 결과 요약")
        print("=" * 60)
        print(f"✅ 통과: {self.passed}")
        print(f"❌ 실패: {self.failed}")
        if self.errors:
            print("\n실패 상세:")
            for e in self.errors:
                print(e)
        print("=" * 60 + "\n")
        return self.failed == 0


# ---------------------------------------------------------------- 시나리오


async def scenario_db(runner: ScenarioRunner):
    """기관 생애주기: 생성·커밋 → 새 세션 재조회 → 수정 → soft-delete → 은닉 확인."""
    async with runner.async_session() as s1:
        async with UnitOfWork(s1) as uow:
            created = await InstitutionRepository(s1).create({"name": "한빛상담센터"})
            inst_id = created.id
            await uow.commit()
    print(f"   ✓ Step 1: 생성·커밋 (id={inst_id})")

    async with runner.async_session() as s2:
        repo = InstitutionRepository(s2)
        fetched = await repo.get(inst_id)
        assert fetched is not None and fetched.name == "한빛상담센터", "새 세션 재조회 실패"
        print("   ✓ Step 2: 새 세션에서 재조회 (트랜잭션 영속성 확인)")

        await repo.update(inst_id, {"phone": "02-1234-5678"})
        await s2.commit()
        assert (await repo.get(inst_id)).phone == "02-1234-5678"
        print("   ✓ Step 3: 수정 반영")

        assert await repo.delete(inst_id) is True
        await s2.commit()
        assert await repo.get(inst_id) is None, "soft-delete 후에도 조회됨"
        assert await repo.get(inst_id, include_deleted=True) is not None
        print("   ✓ Step 4: soft-delete → 기본 조회 은닉, include_deleted 조회 가능")


async def scenario_storage_local(runner: ScenarioRunner):
    """문서 생애주기: 업로드 → 다운로드 검증 → 새 버전 → 버전 목록 → 공개 URL → 삭제."""
    base = Path(tempfile.mkdtemp(prefix="infra-scenario-storage-"))
    try:
        client = LocalStorageClient(base_path=str(base))
        path = "clients/c1/report.pdf"

        v1 = b"%PDF-1.4 first version"
        meta = await client.upload_file(v1, path, "application/pdf")
        assert meta["checksum"] == hashlib.md5(v1).hexdigest()
        print(f"   ✓ Step 1: 업로드 (size={meta['size']}, checksum 일치)")

        assert await client.download_file(path) == v1
        print("   ✓ Step 2: 다운로드 라운드트립 일치")

        await client.upload_file(b"%PDF-1.4 second version", path, "application/pdf")
        versions = await client.list_versions(path)
        assert len(versions) == 2, f"버전 누적 실패: {len(versions)}"
        print(f"   ✓ Step 3: 새 버전 업로드 → 버전 {len(versions)}개 누적")

        url = client.get_public_url(path)
        assert url.startswith("file://") and url.endswith(path)
        print(f"   ✓ Step 4: 공개 URL 발급 ({url[:24]}...)")

        await client.delete_file(path)
        from app.core.exceptions import EntityNotFoundException
        try:
            await client.download_file(path)
            raise AssertionError("삭제 후에도 다운로드됨")
        except EntityNotFoundException:
            pass
        print("   ✓ Step 5: 삭제 → 다운로드 시 EntityNotFound")
    finally:
        shutil.rmtree(base, ignore_errors=True)


async def scenario_cache(runner: ScenarioRunner):
    """factory로 활성 캐시 취득 후 동작 검증 — redis면 set/get/TTL, 없으면 noop 폴백 안전성."""
    client = await get_cache_client()

    if isinstance(client, NoopCacheClient):
        print("   · REDIS_ENABLED=False → NoopCacheClient (폴백 경로)")
        await client.set("session:1", "token", ex=60)
        assert await client.get("session:1") is None, "noop은 항상 miss"
        assert await client.exists("session:1") is False
        await client.delete("session:1")
        assert await client.ping() is False
        print("   ✓ Redis 비활성 환경에서 캐시 계약이 안전하게 no-op")
    else:
        print(f"   · 활성 캐시: {type(client).__name__}")
        await client.set("itest:session", "token-abc", ex=30)
        assert await client.get("itest:session") == "token-abc", "set→get 불일치"
        assert await client.exists("itest:session") is True
        await client.delete("itest:session")
        assert await client.exists("itest:session") is False
        assert await client.ping() is True
        print("   ✓ set→get→TTL→delete 라운드트립 + ping")
    await client.close()


async def scenario_scheduler(runner: ScenarioRunner):
    """스케줄러 생애주기: 활성화 → 잡 2개 등록·기동 → 멱등 재기동 → 정지."""
    original = settings.ENABLE_SCHEDULER
    settings.ENABLE_SCHEDULER = True
    sched = ApScheduler()
    try:
        def register(scheduler):
            scheduler.add_job(lambda: None, "interval", minutes=10, id="reconcile")
            scheduler.add_job(lambda: None, "cron", hour=3, id="nightly-cleanup")

        sched.start(register_jobs=register)
        assert sched._scheduler is not None, "스케줄러 미기동"
        jobs = {j.id for j in sched._scheduler.get_jobs()}
        assert jobs == {"reconcile", "nightly-cleanup"}, f"잡 등록 불일치: {jobs}"
        print(f"   ✓ Step 1: 기동 + 잡 2개 등록 {jobs}")

        sched.start()
        assert len(sched._scheduler.get_jobs()) == 2, "재기동이 상태를 망침"
        print("   ✓ Step 2: 멱등 재기동 (기존 상태 유지)")

        sched.stop()
        assert sched._scheduler is None, "정지 후에도 인스턴스 잔존"
        print("   ✓ Step 3: 정지 → 클린 셧다운")
    finally:
        sched.stop()
        settings.ENABLE_SCHEDULER = original


async def main():
    runner = ScenarioRunner()
    try:
        await runner.setup()
        await runner.run(lambda: scenario_db(runner), "[persistence] 기관 생애주기 (실 DB·UoW)")
        await runner.run(lambda: scenario_storage_local(runner), "[storage/local] 문서 생애주기")
        await runner.run(lambda: scenario_cache(runner), "[cache] 활성 캐시 동작/폴백")
        await runner.run(lambda: scenario_scheduler(runner), "[scheduler] 잡 등록·기동·정지")
        success = runner.print_summary()
        sys.exit(0 if success else 1)
    finally:
        await runner.teardown()


if __name__ == "__main__":
    asyncio.run(main())
