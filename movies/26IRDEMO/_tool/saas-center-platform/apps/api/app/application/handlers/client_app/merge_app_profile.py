from app.core.datetime_utils import utc_now
from app.core.exceptions import (
    ConflictException,
    EntityNotFoundException,
    InvalidOperationException,
    PermissionDeniedException,
)
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client_app.schemas import AppProfileMergeRequest, AppProfileResponse
from app.modules.family.facade import FamilyFacade
from app.modules.ledger.facade import LedgerFacade

OWNER_ROLE = "owner"


async def merge_app_profile_handler(
    *,
    person_id: uuid_str,
    profile_id: uuid_str,
    data: AppProfileMergeRequest,
    uow: UnitOfWork,
) -> AppProfileResponse:
    """연결 때 매칭이 어긋나 갈라진 프로필을 합친다 — source 기록 전건 이동 후 source 삭제.

    이 경로가 없으면 "연동했더니 예전 기록이 사라졌다"가 영구 고착된다(연결된 프로필은
    수정도 잠기므로 손으로 맞출 수단이 없다).
    """
    now = utc_now()

    async with uow:
        family_facade = FamilyFacade(uow)

        # 되돌릴 수 없는 통합이라 프로필 삭제와 같은 등급 — 가족 관리자만(설계.md §15-6-4)
        membership = await family_facade.find_membership(person_id=person_id)
        if membership is None:
            raise EntityNotFoundException("가족을 찾을 수 없습니다")
        if membership.role != OWNER_ROLE:
            raise PermissionDeniedException("아이 프로필 합치기는 관리자만 할 수 있습니다")
        family_id = membership.family_id

        if profile_id == data.target_profile_id:
            raise InvalidOperationException("같은 프로필끼리는 합칠 수 없어요")

        source = await family_facade.get_profile(profile_id=profile_id, family_id=family_id)
        target = await family_facade.get_profile(
            profile_id=data.target_profile_id, family_id=family_id
        )

        # child ↔ self 이동은 기록 가시성 스코프가 통째로 바뀐다(설계.md §15-6-3)
        if source.relation != target.relation:
            raise InvalidOperationException(
                "본인 프로필과 아이 프로필은 서로 합칠 수 없어요 — 보이는 범위가 달라져요"
            )

        link_facade = CenterLinkFacade(uow)
        links = await link_facade.list_links_by_family(
            family_id=family_id, alive_only=True
        )
        source_links = [link for link in links if link.profile_id == source.id]
        target_center_ids = {
            link.center_id for link in links if link.profile_id == target.id
        }
        # 같은 센터에 둘 다 걸려 있으면 옮긴 결과가 (profile_id, center_id) 유니크를 깬다
        # — 그리고 대개 그건 갈라진 한 아이가 아니라 진짜 형제라는 신호다
        if any(link.center_id in target_center_ids for link in source_links):
            raise ConflictException(
                "같은 센터에 두 아이가 연결돼 있어요 — 한쪽 연결을 해제한 뒤 합쳐 주세요"
            )

        await LedgerFacade(uow).move_entries_profile(
            source_profile_id=source.id,
            target_profile_id=target.id,
        )

        # 링크 이관 = revoke 후 신규 (§14-1 in-place 정정 금지).
        # revoke 가 반드시 먼저다 — create 를 앞세우면 (family_id, client_id) 멱등 가드가
        # 옛 링크를 그대로 돌려줘 병합이 성공한 척하며 아무것도 옮기지 않는다.
        moved_links = []
        for link in source_links:
            await link_facade.revoke_link(
                link_id=link.id,
                family_id=family_id,
                reason="mismap",
                now=now,
            )
            moved = await link_facade.create_link(
                family_id=family_id,
                profile_id=target.id,
                person_id=link.person_id,
                center_id=link.center_id,
                client_id=link.client_id,
                guardian_client_id=link.guardian_client_id,
                invitation_id=link.invitation_id,
                now=now,
                linked_at=link.linked_at,
            )
            moved_links.append(moved)

            # 감사 체인 포인터는 create 쪽에 둔다 — revoke 스냅샷에 새 link_id 를 담으려면
            # create 가 선행돼야 하는데 부분 유니크가 그 순서를 막는다
            await link_facade.record_audit(
                center_id=link.center_id,
                actor_type="person",
                action="link_created",
                link_id=moved.id,
                invitation_id=link.invitation_id,
                actor_id=person_id,
                snapshot={
                    "source": "profile_merge",
                    "supersedes_link_id": link.id,
                    "merged_from_profile_id": source.id,
                    "profile_id": target.id,
                    "client_id": link.client_id,
                },
            )
            await link_facade.record_audit(
                center_id=link.center_id,
                actor_type="person",
                action="link_revoked",
                link_id=link.id,
                invitation_id=link.invitation_id,
                actor_id=person_id,
                snapshot={
                    "reason": "mismap",
                    "merged_into_profile_id": target.id,
                    "client_id": link.client_id,
                },
            )

        await family_facade.remove_profile(profile_id=source.id, family_id=family_id)

        response = AppProfileResponse.model_validate(target)
        response.is_linked = bool(target_center_ids) or bool(moved_links)
        return response
