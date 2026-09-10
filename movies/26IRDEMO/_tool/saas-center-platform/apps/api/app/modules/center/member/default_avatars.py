"""멤버 기본 아바타 — 내담자와 동일한 성별 매칭 기본 아바타 풀을 재사용한다.

기본 아바타 풀(S3 `default-avatars/{gender}/*.webp`)은 내담자 모듈에 정의돼 있고,
멤버도 같은 풀에서 성별 매칭 아바타를 배정받는다. (단일 소스 유지)
"""
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client.profile.default_avatars import pick_default_avatar_url
from app.modules.person.client import PersonClient


async def resolve_member_default_avatar(
    uow: UnitOfWork, person_id: str
) -> str | None:
    """멤버의 성별에 맞춰 기본 아바타 URL을 배정. 성별 미지정이면 None."""
    person = await PersonClient(uow).find_by_id(person_id)
    return pick_default_avatar_url(person.gender if person else None)
