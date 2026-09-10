from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client.facade import ProfileFacade
from app.modules.client.facade.client_facade import ClientFacade
from app.modules.client_app.schemas import AppInvitationResponse
from app.modules.event import emit

LINKABLE_CLIENT_ROLES = ("guardian", "both")

# 만 14세 미만은 법정대리인 동의 없이 본인 연결 불가(개인정보보호법) — 명부 생년월일로 차단
SELF_LINK_MIN_AGE = 14


async def issue_app_invitation_handler(
    *,
    center_id: uuid_str,
    client_id: uuid_str,
    actor_id: uuid_str,
    event_group_id: uuid_str,
    self_link: bool = False,
    uow: UnitOfWork,
) -> AppInvitationResponse:
    now = utc_now()

    client = await ClientFacade(uow).get_client_in_center(
        center_id=center_id, client_id=client_id
    )
    # 코드는 보호자(guardian/both) 단위 발급 — 아이(client)에게 발급하지 않는다 (§0-6).
    # 예외: self_link = 보호자 없는 청소년·성인 본인 내담 → both로 승격 후 본인에게 발급.
    promoted = False
    promote_atomic = None
    if client.role not in LINKABLE_CLIENT_ROLES:
        if not (self_link and client.role == "client"):
            raise InvalidOperationException("초대 코드는 보호자에게만 발급할 수 있습니다")
        if client.birth_date is None:
            raise InvalidOperationException(
                "본인 연결은 생년월일이 등록돼 있어야 합니다. 내담자 정보를 먼저 채워 주세요"
            )
        today = now.date()
        age = (
            today.year
            - client.birth_date.year
            - ((today.month, today.day) < (client.birth_date.month, client.birth_date.day))
        )
        if age < SELF_LINK_MIN_AGE:
            raise InvalidOperationException(
                "만 14세 미만은 본인 연결을 할 수 없어요. 보호자를 등록해 발급해 주세요"
            )

        promote_atomic, client = await ProfileFacade(uow).update_client(
            center_id=center_id, client_id=client_id, role="both"
        )
        promoted = True

    # 연결 후보가 0명이면 앱에서 확인 버튼이 비활성인 채로 막힌다 —
    # 코드를 주기 전에 여기서 끊는다(role=both는 본인이 후보라 통과).
    children = await ClientFacade(uow).list_children_of_guardian(
        center_id=center_id, guardian_client_id=client_id
    )
    if not children and client.role != "both":
        raise InvalidOperationException(
            "연결할 자녀가 없습니다. 보호자-자녀 관계를 먼저 등록해 주세요"
        )

    link_facade = CenterLinkFacade(uow)
    invitation_atomic, invitation = await link_facade.issue_invitation(
        center_id=center_id,
        guardian_client_id=client_id,
        issued_by_member_id=actor_id,
        now=now,
    )
    await link_facade.record_audit(
        center_id=center_id,
        actor_type="member",
        actor_id=actor_id,
        action="invitation_issued",
        invitation_id=invitation.id,
        snapshot={
            "guardian_client_id": client_id,
            "guardian_name": client.name,
            "expires_at": invitation.expires_at.isoformat(),
            **({"self_link": True, "promoted_from": "client"} if promoted else {}),
        },
    )
    await emit(
        uow,
        "app_invitation_issued",
        event_group_id=event_group_id,
        atomics=[promote_atomic, invitation_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return AppInvitationResponse.model_validate(invitation)
