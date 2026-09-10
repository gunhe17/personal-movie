from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.center.client import MemberClient
from app.modules.notification.facade import NotificationFacade
from app.modules.person.client import PersonClient
from app.modules.person.credential.schemas import CredentialResponse
from app.modules.person.facade import PersonFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic

logger = get_logger(__name__)


async def approve_credential_handler(
    *,
    credential_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> CredentialResponse:
    # 알림은 당사자가 소속된 모든 센터에 각각 1건씩 발송 — Notification 이 center_id 기반
    # 조회라 어느 센터 컨텍스트에서도 보이도록.
    # approve — write는 owning 모듈 facade 경유
    credential_atomic, credential = await PersonFacade(uow).approve_credential(
        credential_id=credential_id,
        admin_account_id=actor_id,
    )

    # read enrichment는 cross-module Client(DTO) 경유
    person = await PersonClient(uow).find_by_id(credential.person_id)
    recipient_account_id = person.account_id if person else None
    center_ids: list[str] = []
    notification_atomics = []
    if person:
        members = await MemberClient(uow).list_by_person(person.id)
        center_ids = [m.center_id for m in members if m.center_id]

    # event_ref에 reviewed_at(epoch)을 포함해 재승인(수정→재검증) 사이클마다 unique
    if recipient_account_id and center_ids:
        notification = NotificationFacade(uow)
        reviewed_at_token = (
            int(credential.reviewed_at.timestamp()) if credential.reviewed_at else 0
        )
        for center_id in center_ids:
            notification_atomic, _ = await notification.notify(
                center_id=center_id,
                recipient_id=recipient_account_id,
                category="system",
                event_type="credential_verified",
                title="자격 인증이 완료되었어요",
                body=f"'{credential.title}' 인증이 완료되었어요.",
                priority="important",
                data={
                    "credential_id": credential.id,
                    "credential_type": credential.credential_type,
                    "title": credential.title,
                },
                event_ref=f"credential:{credential.id}:verified:{center_id}:{reviewed_at_token}",
            )
            notification_atomics.append(notification_atomic)
    else:
        logger.warning(
            "Credential 승인 후 알림 발송 실패: 수신자 정보 부족 "
            f"(credential_id={credential_id}, person_id={credential.person_id}, "
            f"recipient={recipient_account_id}, centers={len(center_ids)})"
        )

    await emit(
        uow,
        "person_credential_approved",
        event_group_id=event_group_id,
        atomics=[
            credential_atomic,
            *notification_atomics,
            AdminAuditAtomic(
                _act="approved",
                _entity_name="person_credential",
                _entity_id=credential.id,
                _payload={
                    "data": {
                        "id": credential.id,
                        "credential_type": credential.credential_type,
                        "title": credential.title,
                    }
                },
            ),
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    result = CredentialResponse.from_orm_model(credential)
    return await PersonFacade(uow).attach_credential_presigned_url(result)


TOOL = {
    "name": "approve_credential_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "제출된 자격(자격증·면허) 검증 신청을 승인하고 당사자에게 알림을 보낸다.",
    "keywords": [
        "approve credential",
        "자격 승인",
        "자격증 승인",
        "검증 승인",
        "인증 승인",
        "자격 인정",
        "credential 승인",
        "면허 승인",
        "승인 처리",
    ],
    "boundaries": "운영자(어드민)가 제출된 자격 검증을 '승인'하는 도구다. 반려는 reject_credential_handler를 쓴다. 승인되면 당사자가 소속된 모든 센터에 인증 완료 알림이 발송된다. 계정 잠금(lock_admin_account_handler)과는 무관하다.",
    "output": "승인된 자격 (CredentialResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "credential_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 자격",
                "description": "승인할 자격(자격증/면허) 검증 항목의 UUID.",
            },
        },
        "required": ["credential_id"],
    },
}
