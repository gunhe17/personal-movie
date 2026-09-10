"""시스템 기본 문자 양식 시드 데이터

시스템 기본 양식(center_id=NULL)을 생성합니다.
이미 존재하면 건너뜁니다.

실행:
  cd apps/api && uv run python -m scripts.seed.common.messaging
"""
import asyncio

from app.infrastructure.persistence.database import AsyncSessionLocal
from app.modules.messaging.message_template.repository import MessageTemplateRepository
from app.modules.messaging.message_template.services.initialize_system_templates import InitializeSystemTemplatesService


async def main():
    async with AsyncSessionLocal() as session:
        await InitializeSystemTemplatesService(MessageTemplateRepository(session)).execute()
        await session.commit()


if __name__ == "__main__":
    asyncio.run(main())
