"""bulk 초대 characterization — 부분 실패 허용의 불변 계약을 고정한다.
역할 검증 실패는 결과 error로, 통과분은 단일 tx에 영속(application.md §3-1).
1 event + N atomics로 이메일 반응(email_member_invited)이 성공분마다 트리거된다(behavior.md INV-tx)."""
from app.application.handlers.center.bulk_create_member_invitations import (
    bulk_create_member_invitations_handler,
)
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.center.models import Center
from app.modules.center.member.schemas import EmploymentType
from app.modules.center.member_invitation.repository import MemberInvitationRepository
from app.modules.center.member_invitation.schemas import (
    MemberInvitationBulkCreate,
    MemberInvitationCreate,
)
from app.modules.event.event_atomic.repository import EventAtomicRepository
from app.modules.role.role.models import Role
from app.modules.role.role.schemas import RoleCode


async def _seed(session):
    session.add(Center(id="center-1", name="테스트센터", code="TEST01"))
    session.add(Role(id="role-admin", center_id="center-1", code="ADMIN", name="관리자"))
    session.add(Role(id="role-manager", center_id="center-1", code="MANAGER", name="매니저"))
    # COUNSELOR 역할 미시드 → 그 항목은 role 조회 실패로 흡수
    await session.flush()


def _item(
    name,
    email,
    role_code,
):
    return MemberInvitationCreate(
        name=name,
        email=email,
        role_code=role_code,
        employment_type=EmploymentType.FULLTIME,
    )


async def test_bulk_partial_failure_persists_only_success(test_session):
    await _seed(test_session)
    uow = UnitOfWork(test_session)

    data = MemberInvitationBulkCreate(items=[
        _item("A", "a@test.com", RoleCode.ADMIN),
        _item("B", "b@test.com", RoleCode.MANAGER),
        _item("C", "c@test.com", RoleCode.COUNSELOR),  # 실패(역할 없음)
    ])

    resp = await bulk_create_member_invitations_handler(
        event_group_id="group-1",
        center_id="center-1",
        data=data,
        invited_by="inviter-1",
        uow=uow,
        actor_id="member-1",
    )

    assert resp.total == 3
    assert resp.success_count == 2
    assert resp.failure_count == 1
    assert [r.success for r in resp.results] == [True, True, False]

    # 성공 2건만 영속(실패분은 write 전 검증 탈락 — 애초에 쓰이지 않음)
    count = await MemberInvitationRepository(test_session).count_by_center(center_id="center-1")
    assert count == 2

    # 성공분마다 member_invitation_created atomic 발행(단건 경로와 통일 = 이메일 반응 트리거)
    atomics, page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id="center-1",
    )
    created = [a for a in atomics if a.entity_name == "member_invitation" and a.act == "created"]
    assert len(created) == 2
    # 1 event + N atomics — 두 atomic이 한 event에 묶인다(건별 event N개 = 안티패턴)
    assert len({a.event_id for a in created}) == 1
