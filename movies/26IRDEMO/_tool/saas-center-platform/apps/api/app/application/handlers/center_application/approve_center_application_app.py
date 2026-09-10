from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentFacade
from app.modules.center.facade import (
    CenterApplicationFacade,
    MemberFacade,
    OperatingTimeFacade,
)
from app.modules.center.center_application.schemas import CenterApplicationResponse
from app.modules.event import emit
from app.modules.llm.facade import CreditFacade
from app.modules.person.facade import PersonFacade
from app.modules.role.facade import RoleFacade
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.role.role.schemas import RoleCode


async def approve_center_application_app_handler(
    application_id: str,
    reviewer_account_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    ip: str | None = None,
) -> CenterApplicationResponse:
    # tx 경계·commit은 호출자(platform_admin handler / center router)가 소유 — audit를 같은 tx에 포함하기 위함.
    # 승인 이메일은 center_application_approved 반응이 발송.
    # approve — Center 생성 + 승인만, AdminMember 제외 (atomics = center.created + application.approved)
    atomics, application = await CenterApplicationFacade(uow).approve_application(
        application_id, reviewer_account_id
    )
    assert application.center_id is not None
    center_id = application.center_id

    # initialize
    ca_atomics, _ = await AssessmentFacade(uow).initialize_center_assessments(
        center_id=center_id
    )

    role_facade = RoleFacade(uow)
    role_atomics, _ = await role_facade.initialize_center_roles_and_permissions(
        center_id=center_id
    )

    operating_atomic, _ = await OperatingTimeFacade(
        uow
    ).initialize_default_operating_times(center_id=center_id)

    # Trial 구독(Pro, 1년) + 크레딧
    sub_atomic, sub = await SubscriptionFacade(uow).create_trial(center_id)
    credit_atomic, _ = await CreditFacade(uow).initialize_credit(
        center_id=center_id,
        plan_type=sub.plan,
        period_start=sub.current_period_start,
        period_end=sub.current_period_end,
    )

    # AdminMember 생성 — 센터별 ADMIN Role 사용
    admin_role = await role_facade.find_role_by_center_and_code(
        center_id, RoleCode.ADMIN.value
    )
    if not admin_role:
        raise ValueError(f"센터의 ADMIN Role을 찾을 수 없습니다: {center_id}")
    # created_by는 account_id — 멤버 생성용 person으로 해석
    applicant = await PersonFacade(uow).find_person_by_account(application.created_by)
    if not applicant:
        raise ValueError(
            f"신청 계정의 person을 찾을 수 없습니다: {application.created_by}"
        )
    member_atomic, _ = await MemberFacade(uow).create_center_admin_member(
        center_id=center_id,
        person_id=applicant.id,
        role_id=admin_role.id,
    )

    # emit — center_application_approved 반응(승인 이메일)이 이 이벤트로 트리거된다
    await emit(
        uow,
        "center_application_approved",
        event_group_id=event_group_id,
        atomics=[
            *atomics,
            *ca_atomics,
            *role_atomics,
            operating_atomic,
            sub_atomic,
            credit_atomic,
            member_atomic,
        ],
        center_id=center_id,
        actor_id=reviewer_account_id,
        actor_type="admin",
        ip_address=ip,
    )

    return CenterApplicationResponse.model_validate(application)


TOOL = {
    "name": "approve_center_application_app_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "센터 개설 신청을 승인해 센터를 생성하고 검사·역할·운영시간·체험구독을 초기화하며 신청자를 ADMIN으로 등록한다.",
    "keywords": [
        "approve center application app",
        "센터 승인",
        "센터 신청 승인",
        "개설 승인",
        "센터 등록 승인",
        "가맹 승인",
        "센터 개설 허가",
        "center application 승인",
        "입점 승인",
    ],
    "boundaries": "운영자가 '센터 개설 신청'을 승인하는 도구다. 자격 승인(approve_credential_handler)이나 계정 잠금/해제(lock·unlock_admin_account_handler)와는 무관하다. 승인 시 센터 생성·초기화가 한 번에 이뤄지고, 신청자에게 승인 이메일이 발송되며 센터 ADMIN으로 등록된다.",
    "output": "승인 결과: 생성된 센터 정보 (CenterApplicationResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "application_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 신청",
                "description": "승인할 센터 개설 신청의 UUID.",
            },
        },
        "required": ["application_id"],
    },
}
