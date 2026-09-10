import unicodedata
from dataclasses import dataclass, field

from app.core.datetime_utils import utc_now
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.rate_limit.factory import get_rate_limiter
from app.modules.center.facade import CenterFacade
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client.facade import ClientFacade
from app.modules.client_app.schemas import (
    LinkCenterSummary,
    LinkChildCandidate,
    LinkProfileCandidate,
    LinkVerifyRequest,
    LinkVerifyResponse,
)
from app.modules.family.facade import FamilyFacade

SELF_RELATION = "self"

TIER_STRONG = "strong"
TIER_WEAK = "weak"

DISABLED_LINKED_HERE = "linked_to_this_center"


def _normalize_name(value: str | None) -> str:
    # NFC 정규화 필수 — iOS/macOS 입력은 자모가 분해된 NFD 로 들어와 눈으로는 같은
    # "김지민"이 == 에서 어긋난다. 공백은 센터별 표기 차("김 지민")라 무시한다.
    if not value:
        return ""
    return "".join(unicodedata.normalize("NFC", value).split())


@dataclass
class _ProfileKey:
    """매칭에 쓰는 프로필의 정합 키.

    이름은 앱 표시명 하나가 아니라 **연결된 센터들이 준 이름까지 합친 집합**이다.
    첫 센터 표기가 앱에 굳은 뒤 둘째 센터가 다르게 적으면 제안이 통째로 사라지고,
    부모가 새 프로필을 만들어 아이가 갈라진다(설계.md §0-5 정합 키).
    """

    profile_id: str
    relation: str
    names: set[str]
    birth_date: object | None
    gender: str | None
    linked_center_ids: list[str] = field(default_factory=list)


@dataclass
class _MatchResult:
    tier: str
    reasons: list[str]
    score: int


def _match(
    key: _ProfileKey,
    child,
    *,
    is_self: bool,
) -> _MatchResult | None:
    """하드 탈락은 관계 불일치·생년월일 확정 불일치 둘뿐. 나머지는 강·약 후보로 남긴다.

    성별만 어긋나는 경우를 탈락시키지 않는 이유 — 이름과 생년월일이 같은데 성별이
    다르면 다른 아이보다 오타일 확률이 높다. 대신 자동 선택은 주지 않는다.
    """
    if (key.relation == SELF_RELATION) != is_self:
        return None

    child_name = _normalize_name(child.name)
    name_hit = bool(child_name) and child_name in key.names

    birth_hit = False
    if key.birth_date is not None and child.birth_date is not None:
        if key.birth_date != child.birth_date:
            return None
        birth_hit = True

    gender_conflict = (
        key.gender is not None
        and child.gender is not None
        and key.gender != child.gender
    )

    if not name_hit and not birth_hit:
        return None

    reasons = []
    if name_hit:
        reasons.append("name")
    if birth_hit:
        reasons.append("birth_date")
    if key.linked_center_ids:
        reasons.append("linked_elsewhere")

    # 성별이 어긋나면 생년월일까지 같아도 자동 선택은 주지 않는다 — 오타일 확률이 높지만
    # 확정은 부모 몫이다(설계.md §0-5 자동 매칭 금지)
    strong = name_hit and not gender_conflict
    return _MatchResult(
        tier=TIER_STRONG if strong else TIER_WEAK,
        reasons=reasons,
        score=(2 if birth_hit else 0) + (1 if name_hit else 0),
    )


async def verify_link_invitation_handler(
    data: LinkVerifyRequest,
    *,
    person_id: uuid_str,
    uow: UnitOfWork,
) -> LinkVerifyResponse:
    # 6자리 코드 무차별 대입 방어 (열람은 비소모라 rate limit이 유일한 게이트)
    get_rate_limiter().check_and_record(f"app_link_verify:{person_id}", limit=10)

    now = utc_now()

    async with uow:
        link_facade = CenterLinkFacade(uow)
        invitation = await link_facade.get_valid_invitation(code=data.code, now=now)

        center = await CenterFacade(uow).get_center(invitation.center_id)

        client_facade = ClientFacade(uow)
        guardian = await client_facade.get_client_in_center(
            center_id=invitation.center_id,
            client_id=invitation.guardian_client_id,
        )
        children = await client_facade.list_children_of_guardian(
            center_id=invitation.center_id,
            guardian_client_id=invitation.guardian_client_id,
        )
        # 자녀 관계가 없는 보호자(성인 본인 내담, role=both)는 보호자 자신이 연결 후보
        if not children and guardian.role == "both":
            children = [guardian]

        family_facade = FamilyFacade(uow)
        family = await family_facade.ensure_family(person_id=person_id)
        profiles = await family_facade.list_profiles(family_id=family.id)

        links = await link_facade.list_links_by_family(family_id=family.id, alive_only=True)
        # 이 센터에 이미 걸린 프로필은 고르면 부분 유니크에 걸린다 — 목록에서 지우지 않고
        # 비활성으로 내려보낸다(사라지면 "우리 아이가 왜 없지?" → 새 프로필로 간다)
        linked_here = {
            link.profile_id for link in links if link.center_id == invitation.center_id
        }
        linked_profile_id_by_client = {link.client_id: link.profile_id for link in links}

        # 다른 센터가 준 이름·생년월일을 매치 키에 얹기 위한 배치 조회
        linked_client_info = await client_facade.get_clients_by_ids(
            [link.client_id for link in links]
        )
        center_names = await CenterFacade(uow).get_active_by_ids(
            [link.center_id for link in links]
        )

        keys: dict[str, _ProfileKey] = {
            profile.id: _ProfileKey(
                profile_id=profile.id,
                relation=profile.relation,
                names={_normalize_name(profile.display_name)} - {""},
                birth_date=profile.birth_date,
                gender=profile.gender,
            )
            for profile in profiles
        }
        for link in links:
            key = keys.get(link.profile_id)
            if key is None:
                continue
            key.linked_center_ids.append(link.center_id)
            info = linked_client_info.get(link.client_id)
            if info is None:
                continue
            normalized = _normalize_name(info.name)
            if normalized:
                key.names.add(normalized)
            if key.birth_date is None:
                key.birth_date = info.birth_date

        profile_by_id = {profile.id: profile for profile in profiles}

        # 전역 greedy — 자녀별로 순회하며 집으면 형제 순서에 따라 서로의 최적 후보를 뺏는다
        scored: list[tuple[int, int, str, str, _MatchResult]] = []
        for child in children:
            is_self = child.id == invitation.guardian_client_id
            for key in keys.values():
                result = _match(key, child, is_self=is_self)
                if result is None:
                    continue
                scored.append(
                    (
                        1 if result.tier == TIER_STRONG else 0,
                        result.score,
                        child.id,
                        key.profile_id,
                        result,
                    )
                )
        scored.sort(key=lambda row: (row[0], row[1]), reverse=True)

        matches_by_child: dict[str, list[tuple[str, _MatchResult]]] = {}
        for _, _, client_id, profile_id, result in scored:
            matches_by_child.setdefault(client_id, []).append((profile_id, result))

        suggested_by_child: dict[str, str] = {}
        taken: set[str] = set()
        for _, _, client_id, profile_id, result in scored:
            if result.tier != TIER_STRONG:
                continue
            if client_id in suggested_by_child or profile_id in taken:
                continue
            if profile_id in linked_here:
                continue
            suggested_by_child[client_id] = profile_id
            taken.add(profile_id)

        candidates = []
        for child in children:
            profile_candidates = [
                LinkProfileCandidate(
                    profile_id=profile_id,
                    display_name=profile_by_id[profile_id].display_name,
                    birth_date=profile_by_id[profile_id].birth_date,
                    relation=profile_by_id[profile_id].relation,
                    tier=result.tier,
                    reasons=result.reasons,
                    linked_center_names=[
                        found.name
                        for found in (
                            center_names.get(center_id)
                            for center_id in keys[profile_id].linked_center_ids
                        )
                        if found is not None
                    ],
                    disabled_reason=(
                        DISABLED_LINKED_HERE if profile_id in linked_here else None
                    ),
                )
                for profile_id, result in matches_by_child.get(child.id, [])
            ]

            candidates.append(
                LinkChildCandidate(
                    client_id=child.id,
                    name=child.name,
                    birth_date=child.birth_date,
                    gender=child.gender,
                    is_self=child.id == invitation.guardian_client_id,
                    suggested_profile_id=suggested_by_child.get(child.id),
                    candidates=profile_candidates,
                    linked_profile_id=linked_profile_id_by_client.get(child.id),
                )
            )

        # address JSONB(AddressInfo) → 한 줄 / 커버 = 센터 이미지 첫 장, 없으면 로고
        # (get_app_center_detail과 같은 유도)
        center_address = center.address or {}
        address_str = (
            " ".join(
                part
                for part in (center_address.get("address"), center_address.get("detail"))
                if part
            )
            or None
        )
        center_images = center.image_urls or []

        return LinkVerifyResponse(
            center=LinkCenterSummary(
                id=center.id,
                name=center.name,
                phone=center.phone,
                address=address_str,
                image_url=center_images[0] if center_images else center.logo_url,
            ),
            guardian_name=guardian.name,
            expires_at=invitation.expires_at,
            children=candidates,
        )
