import asyncio

from app.server.lifecycle import init_db

from app.infrastructure.persistence.database import engine
from app.infrastructure.persistence.models import BaseModel


async def drop_all_tables():
    # 모델 모듈을 임포트해야 metadata에 테이블이 등록된다 — 없으면 drop_all이 조용히 0개를 지운다
    from app.modules import models  # noqa: F401

    print("🗑️  Dropping all tables...")
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.drop_all)
    print(f"✅ Dropped {len(BaseModel.metadata.tables)} tables")

async def create_all_tables():
    print("📦 Creating all tables...")
    await init_db()
    print("✅ All tables created")

async def main():
    print("=" * 50)
    print("Database Initialization Script")
    print("=" * 50)

    await drop_all_tables()

    await create_all_tables()

    print("\n" + "=" * 50)
    print("✅ Database initialization complete!")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())