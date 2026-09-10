"""내담자 SMS send-key: (schedule, client, type)당 최초 1회만 획득(재트리거·재claim 중복 방지).
인앱 알림 행이 없어 in-app 게이트를 못 쓰는 내담자 직접 SMS 경로의 멱등(eventing.md §6)."""
from app.modules.notification import helpers


class _FakeCache:
    """실 Redis SET NX 시맨틱(신규만 True) in-memory 모사."""
    def __init__(self):
        self._keys: set[str] = set()

    async def set_nx(self, key: str, *, ex: int | None = None) -> bool:
        if key in self._keys:
            return False
        self._keys.add(key)
        return True


async def test_claim_is_once_per_key(monkeypatch):
    cache = _FakeCache()

    async def _get_cache():
        return cache

    monkeypatch.setattr(helpers, "get_cache_client", _get_cache, raising=False)
    import app.infrastructure.cache.factory as factory
    monkeypatch.setattr(factory, "get_cache_client", _get_cache)

    args = dict(schedule_id="s1", client_id="cl1", sms_type="counseling_reminder")
    assert await helpers.claim_client_sms_send(**args) is True   # 최초 = 발송
    assert await helpers.claim_client_sms_send(**args) is False  # 재트리거 = skip

    # 다른 client 는 독립 키 → 획득
    assert await helpers.claim_client_sms_send(schedule_id="s1", client_id="cl2",
                                               sms_type="counseling_reminder") is True
