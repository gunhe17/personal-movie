import asyncpg

from app.core.config import settings


class Connection:
    def __init__(self, connection: asyncpg.Connection):
        self._connection = connection

    async def listen(self, *, channel: str, callback) -> None:
        await self._connection.add_listener(channel, callback)

    async def close(self) -> None:
        await self._connection.close()


async def notification_connection() -> Connection:
    # asyncpg는 raw DSN — SQLAlchemy의 "+asyncpg" 접미 제거
    dsn = settings.DATABASE_URL.replace("+asyncpg", "")
    connection = await asyncpg.connect(dsn)
    return Connection(connection=connection)
