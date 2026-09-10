from app.core.datetime_utils import utc_now
from app.core.exceptions import (
    EntityNotFoundException,
    InvalidOperationException,
    PermissionDeniedException,
)
from app.core.type import unset, uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.rate_limit.factory import get_rate_limiter
from app.modules.center.facade import CenterFacade
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client.facade import ClientFacade
from app.modules.client_app.schemas import AppLinkResponse, LinkClaimRequest, LinkClaimResponse
from app.modules.family.facade import FamilyFacade


async def claim_center_link_handler(
    data: LinkClaimRequest,
    *,
    person_id: uuid_str,
    uow: UnitOfWork,
) -> LinkClaimResponse:
    get_rate_limiter().check_and_record(f"app_link_claim:{person_id}", limit=10)

    now = utc_now()

    async with uow:
        link_facade = CenterLinkFacade(uow)
        invitation = await link_facade.get_valid_invitation(code=data.code, now=now)

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
        candidate_ids = {child.id for child in children}
        child_by_id = {child.id: child for child in children}

        family_facade = FamilyFacade(uow)
        # 가족이 없으면 여기서 owner로 생성된다 — 게이트보다 먼저 와야 신규 가입자가 막히지 않는다
        family = await family_facade.ensure_family(person_id=person_id)

        # 연결은 임상기록·청구를 가족 전원에게 여는 행위이고 해제는 관리자만 할 수 있다
        # — 생성만 열어두면 구성원이 되돌릴 수 없는 권한 부여를 하게 된다(revoke와 대칭).
        membership = await family_facade.find_membership(person_id=person_id)
        if membership is None:
            raise EntityNotFoundException("가족을 찾을 수 없습니다")
        if membership.role != "owner":
            raise PermissionDeniedException("센터 연결은 가족 관리자만 할 수 있습니다")

        # 프로필별 기존 링크 — 이 센터 중복 차단 + "최초 연결 센터가 정본" 판정에 함께 쓴다
        existing_links = await link_facade.list_links_by_family(
            family_id=family.id, alive_only=True
        )
        linked_center_ids_by_profile: dict[str, set[str]] = {}
        linked_profile_id_by_client: dict[str, str] = {}
        for existing in existing_links:
            linked_center_ids_by_profile.setdefault(existing.profile_id, set()).add(
                existing.center_id
            )
            linked_profile_id_by_client[existing.client_id] = existing.profile_id

        # verify — 앱은 센터 명부의 아이를 확인만 한다(초대에 없는 client 연결 금지).
        # 전량 통과 후에만 쓰기로 넘어간다 — 프로필 생성·개명이 먼저 일어나면
        # 뒤에서 막혀도 유령 프로필·무단 개명이 남는다.
        seen_profile_ids: set[str] = set()
        seen_client_ids: set[str] = set()
        for mapping in data.mappings:
            if mapping.client_id not in candidate_ids:
                raise InvalidOperationException("초대에 포함되지 않은 내담자입니다")
            if mapping.profile_id is None and mapping.new_profile is None:
                raise InvalidOperationException("연결할 프로필을 선택해 주세요")
            if mapping.client_id in seen_client_ids:
                raise InvalidOperationException(
                    "같은 아이를 두 번 연결할 수 없어요"
                )
            seen_client_ids.add(mapping.client_id)
            # 이미 링크가 있는 아이를 다른 프로필로 옮기려는 시도 — center_links 는
            # (family_id, client_id) 도 유니크라 조용히 옛 링크가 재사용된다
            linked_profile_id = linked_profile_id_by_client.get(mapping.client_id)
            if linked_profile_id is not None and linked_profile_id != mapping.profile_id:
                raise InvalidOperationException(
                    "이미 다른 프로필에 연결된 아이예요. 기존 연결을 해제한 뒤 다시 연결해 주세요"
                )
            # 한 프로필에 두 아이를 매핑하면 center_links 부분 유니크에 걸려 500이 난다
            if mapping.profile_id is not None:
                if mapping.profile_id in seen_profile_ids:
                    raise InvalidOperationException(
                        "같은 프로필에 두 명을 연결할 수 없어요. 아이마다 다른 프로필을 선택해 주세요"
                    )
                seen_profile_ids.add(mapping.profile_id)
                # 같은 이유(부분 유니크) — 이미 이 센터에 걸린 프로필은 재연결 불가
                if invitation.center_id in linked_center_ids_by_profile.get(
                    mapping.profile_id, set()
                ):
                    raise InvalidOperationException(
                        "이미 이 센터에 연결된 아이예요"
                    )

        links = []
        for mapping in data.mappings:
            child = child_by_id[mapping.client_id]

            if mapping.profile_id is not None:
                profile = await family_facade.get_profile(
                    profile_id=mapping.profile_id, family_id=family.id
                )
                # 연결 즉시 센터 명부 값이 정본이 된다 — 연결 후 앱에서 못 고치므로(readonly)
                # 어긋난 값이 그대로 굳는 걸 막는다. 이미 다른 센터에 걸린 프로필은
                # 최초 연결 센터가 정본이라 덮지 않는다(센터 간 표기 차로 이름이 흔들림).
                if not linked_center_ids_by_profile.get(profile.id):
                    profile = await family_facade.update_profile(
                        profile_id=profile.id,
                        family_id=family.id,
                        display_name=child.name,
                        # 센터가 비워둔 값으로 부모가 채운 값을 지우지 않는다
                        birth_date=child.birth_date if child.birth_date else unset,
                        gender=child.gender if child.gender else unset,
                    )
            else:
                # 성인 본인 내담(후보 = 보호자 자신)이면 relation은 self
                is_self = child.id == invitation.guardian_client_id
                profile = await family_facade.create_profile(
                    family_id=family.id,
                    display_name=mapping.new_profile.display_name or child.name,
                    relation="self" if is_self else mapping.new_profile.relation,
                    birth_date=mapping.new_profile.birth_date or child.birth_date,
                    gender=mapping.new_profile.gender or child.gender,
                )

            link = await link_facade.create_link(
                family_id=family.id,
                profile_id=profile.id,
                person_id=person_id,
                center_id=invitation.center_id,
                client_id=child.id,
                guardian_client_id=invitation.guardian_client_id,
                invitation_id=invitation.id,
                now=now,
            )
            links.append(link)

            # 승인 근거 스냅샷 동결 (§14-1 — 전이와 같은 트랜잭션)
            await link_facade.record_audit(
                center_id=invitation.center_id,
                actor_type="person",
                actor_id=person_id,
                action="link_created",
                link_id=link.id,
                invitation_id=invitation.id,
                snapshot={
                    "code": data.code,
                    "claimed_at": now.isoformat(),
                    "client_id": child.id,
                    "client_name": child.name,
                    "client_birth_date": child.birth_date.isoformat() if child.birth_date else None,
                    "profile_id": profile.id,
                    "guardian_client_id": invitation.guardian_client_id,
                },
            )

        # 열람은 비소모, 수락 완료 시에만 소모 (§14-2)
        await link_facade.claim_invitation(
            invitation_id=invitation.id,
            person_id=person_id,
            now=now,
        )

        centers = await CenterFacade(uow).get_active_by_ids(
            list({link.center_id for link in links})
        )
        link_responses = [
            AppLinkResponse(
                id=link.id,
                profile_id=link.profile_id,
                center_id=link.center_id,
                center_name=centers[link.center_id].name if link.center_id in centers else None,
                center_phone=centers[link.center_id].phone if link.center_id in centers else None,
                center_logo_url=centers[link.center_id].logo_url if link.center_id in centers else None,
                client_id=link.client_id,
                status=link.status,
                linked_at=link.linked_at,
            )
            for link in links
        ]

    return LinkClaimResponse(links=link_responses)
