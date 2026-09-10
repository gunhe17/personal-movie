"""IDOR 게이트 회귀: require_self()가 path param 주체를 토큰 주체와 대조한다.

이전엔 person router 두 엔드포인트가 각자 `if person_id != ctx.person_id` 를 손으로 들고 있었다
(behavior action 부재). 게이트가 조용히 무력화되면(주체 미해석·param 오타) 남의 개인정보가 열린다.
"""
from types import SimpleNamespace

import pytest

from app.behavior.action.account import RequireSelf
from app.behavior.common.exception import ForbiddenError
from app.behavior.server import ServerMemory
from app.core.type import DevelopError


def _memory(*, path_params: dict, person_id: str | None = "P1"):
    m = ServerMemory()
    m.request = SimpleNamespace(path_params=path_params)
    m.account = SimpleNamespace(person_id=person_id) if person_id else None
    RequireSelf().apply(m)
    return m


async def test_self_passes():
    await RequireSelf.act(_memory(path_params={"person_id": "P1"}))


async def test_other_person_forbidden():
    with pytest.raises(ForbiddenError):
        await RequireSelf.act(_memory(path_params={"person_id": "P2"}))


async def test_center_flow_subject_is_used():
    m = _memory(path_params={"person_id": "P9"}, person_id=None)
    m.center = SimpleNamespace(person_id="P9")
    await RequireSelf.act(m)


async def test_unauthenticated_is_develop_error():
    """authenticate() 없이 선언하면 조용히 통과가 아니라 터진다."""
    with pytest.raises(DevelopError):
        await RequireSelf.act(_memory(path_params={"person_id": "P1"}, person_id=None))


async def test_missing_path_param_is_develop_error():
    """param 이름 오타가 '검사 없음'으로 새지 않는다."""
    with pytest.raises(DevelopError):
        await RequireSelf.act(_memory(path_params={"member_id": "P1"}))


@pytest.mark.parametrize("endpoint", ["get_person", "update_person"])
def test_person_router_declares_require_self(endpoint):
    """손으로 박힌 가드를 지운 자리 — 선언이 사라지면 IDOR 회귀."""
    import inspect

    from app.modules.person.person import router as person_router

    assert "require_self()" in inspect.getsource(getattr(person_router, endpoint))
