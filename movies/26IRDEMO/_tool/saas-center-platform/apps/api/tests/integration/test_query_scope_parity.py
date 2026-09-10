"""app/query 스코프 동치(G2) + 봉투 스모크 — .claude/rules/api/query.md §7.

구 handler 유닛테스트(facade monkeypatch로 "인자를 넘기는가"를 봤다)가 검증하던 스코프 정책을
실 DB 대조로 옮긴 것. 새 구현엔 facade가 없어 mock으로 잡을 표면이 사라졌다.

핵심은 두 스코프의 **활성 조건 비대칭**(query.md §5):
  열람 케이스 = 활성 공동상담사만 / 담당 내담자 = 활성 무관·과거 포함.
"""

from datetime import date, datetime, timedelta

import pytest
from app.application.handlers.client.list_clients import _resolve_assigned_client_ids
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.assessment.models import Assessment
from app.modules.assessment.assessment_case.models import AssessmentCase
from app.modules.assessment.assessment_case_participant.models import (
    AssessmentCaseParticipant,
)
from app.modules.assessment.assessment_package.models import AssessmentPackage
from app.modules.assessment.assessment_session.models import AssessmentSession
from app.modules.assessment.center_assessment.models import CenterAssessment
from app.modules.assessment.facade import AssessmentCaseFacade
from app.modules.billing.billable.models import Billable
from app.modules.billing.payment.models import Payment
from app.modules.billing.price_list.models import PriceList, ServiceType
from app.modules.center.center_operating_time.models import OperatingTime
from app.modules.center.member.models import Member
from app.modules.center.member_invitation.models import MemberInvitation
from app.modules.center.member_working_time.models import MemberWorkingTime
from app.modules.center.program.models import Program
from app.modules.center.program_member.models import ProgramMember
from app.modules.center.room.models import Room
from app.modules.client.profile.models import Client
from app.modules.counseling.counseling_case.models import CounselingCase
from app.modules.counseling.counseling_case_participant.models import (
    CaseParticipantType,
    CounselingCaseParticipant,
)
from app.modules.counseling.counseling_note.models import CounselingNote
from app.modules.counseling.counseling_session.models import CounselingSession
from app.modules.counseling.facade import CounselingCaseFacade
from app.modules.document.document.models import Document
from app.modules.event.event.models import Event
from app.modules.event.event_atomic.models import EventAtomic
from app.modules.field_note.field_note.models import FieldNote
from app.modules.form.form.models import Form
from app.modules.form.template.models import FormTemplate
from app.modules.institution.institution.models import Institution
from app.modules.llm.credit_balance.models import CreditBalance
from app.modules.messaging.messaging.models import MessageLog
from app.modules.notice.notice.models import Notice
from app.modules.notification.notification.models import Notification
from app.modules.person.person.models import Person
from app.modules.role.role.models import Role
from app.modules.schedule.schedule.models import Schedule
from app.modules.schedule.schedule_change_request.models import ScheduleChangeRequest
from app.modules.subscription.subscription.models import Subscription
from app.modules.voucher.center_voucher.models import CenterVoucher
from app.modules.voucher.client_voucher.models import ClientVoucher
from app.modules.voucher.voucher.models import Voucher
from app.query.activity import query_activity_handler
from app.query.assessment import query_assessment_handler
from app.query.assessment_case import query_assessment_case_handler
from app.query.assessment_package import query_assessment_package_handler
from app.query.assessment_participant import query_assessment_participant_handler
from app.query.assessment_session import query_assessment_session_handler
from app.query.billable import query_billable_handler
from app.query.case_participant import query_counseling_participant_handler
from app.query.center_voucher import query_center_voucher_handler
from app.query.client import query_client_handler
from app.query.client_voucher import query_client_voucher_handler
from app.query.counseling_case import query_case_handler
from app.query.counseling_note import query_counseling_note_handler
from app.query.counseling_session import query_counseling_session_handler
from app.query.credit_balance import query_credit_balance_handler
from app.query.document import query_document_handler
from app.query.field_note import query_field_note_handler
from app.query.form_instance import query_form_instance_handler
from app.query.form_template import query_form_template_handler
from app.query.institution import query_institution_handler
from app.query.member import query_member_handler
from app.query.member_invitation import query_member_invitation_handler
from app.query.member_working_time import query_member_working_time_handler
from app.query.message_log import query_message_log_handler
from app.query.notice import query_notice_handler
from app.query.notification import query_notification_handler
from app.query.operating_time import query_operating_time_handler
from app.query.payment import query_payment_handler
from app.query.price_list import query_price_list_handler
from app.query.program import query_program_handler
from app.query.room import query_room_handler
from app.query.schedule import query_schedule_handler
from app.query.schedule_change_request import query_schedule_change_request_handler
from app.query.subscription import query_subscription_handler

CENTER = "center-q"
OWN = "member-own"
OTHER = "member-other"
NOW = datetime.combine(date.today(), datetime.min.time()) + timedelta(hours=10)

CLIENT = CaseParticipantType.CLIENT.value
COUNSELOR = CaseParticipantType.COUNSELOR.value


@pytest.fixture
async def fixtures(test_session):
    """센터 하나에 스코프 4분면을 심는다 — 커밋하지 않는다(flush만, 세션 종료 시 롤백)."""
    rows = [
        Person(id="person-own", account_id="acc-own", name="나상담", phone="010-0000-0001"),
        Person(id="person-other", account_id="acc-other", name="남상담", phone="010-0000-0002"),
        Member(id=OWN, center_id=CENTER, person_id="person-own", role_id="role-counselor"),
        Member(id=OTHER, center_id=CENTER, person_id="person-other", role_id="role-counselor"),
        Program(id="prog-1", center_id=CENTER, name="프로그램A"),
    ]
    for cid, name, code in [
        ("cl-a", "가내담", "C0001"), ("cl-b", "나내담", "C0002"),
        ("cl-c", "다내담", "C0003"), ("cl-d", "라내담", "C0004"),
        ("cl-e", "마내담", "C0005"),
    ]:
        rows.append(Client(id=cid, center_id=CENTER, code=code, role="client", name=name))

    # 케이스 4분면: 주담당 / 활성 공동 / 비활성 공동 / 무관
    for case_id, code, counselor in [
        ("case-primary", "CS-001", OWN), ("case-shared", "CS-002", OTHER),
        ("case-inactive", "CS-003", OTHER), ("case-other", "CS-004", OTHER),
    ]:
        rows.append(CounselingCase(
            id=case_id, center_id=CENTER, program_id="prog-1",
            counselor_id=counselor, case_code=code,
        ))
    rows += [
        _participant("p-own-shared", "case-shared", OWN, COUNSELOR, True),
        _participant("p-own-inactive", "case-inactive", OWN, COUNSELOR, False),
        _participant("p-cl-a", "case-primary", "cl-a", CLIENT, True),
        _participant("p-cl-b", "case-shared", "cl-b", CLIENT, True),
        _participant("p-cl-c", "case-inactive", "cl-c", CLIENT, True),
        _participant("p-cl-d", "case-other", "cl-d", CLIENT, True),
    ]

    # 검사 케이스(주담당) — 담당 내담자 스코프는 상담+검사 union
    rows += [
        AssessmentCase(id="acase-own", center_id=CENTER, case_code="AS-001", counselor_id=OWN),
        AssessmentCaseParticipant(
            id="ap-cl-e", center_id=CENTER, case_id="acase-own",
            participant_type="client", participant_id="cl-e",
        ),
    ]

    # 일정 — sch-shared는 남의 소유지만 공동 담당 케이스의 회기라 own 스코프에 합류한다
    for sid, member, title in [
        ("sch-own", OWN, "내 일정"), ("sch-other", OTHER, "남 일정"),
        ("sch-shared", OTHER, "공동 회기"),
    ]:
        rows.append(Schedule(
            id=sid, center_id=CENTER, member_id=member, schedule_type="counseling",
            title=title, start=NOW, end=NOW + timedelta(hours=1),
        ))
    rows += [
        CounselingSession(
            id="sess-1", center_id=CENTER, counseling_case_id="case-primary",
            schedule_id="sch-own", session_number=1,
        ),
        CounselingSession(
            id="sess-2", center_id=CENTER, counseling_case_id="case-shared",
            schedule_id="sch-shared", session_number=1,
        ),
        FieldNote(id="fn-1", center_id=CENTER, author_id=OWN, schedule_id="sch-own", task_id="task-1"),
        FieldNote(id="fn-2", center_id=CENTER, author_id=OWN, schedule_id="sch-other"),
    ]

    # 바우처 — 시드 0건이라 group_by 대조용 최소 행을 직접 심는다
    for vid, name in [("v-1", "바우처A"), ("v-2", "바우처B")]:
        rows.append(Voucher(
            id=vid, name=name, program_name=name,
            program_organization="기관", program_year=2026,
        ))
    rows += [
        CenterVoucher(id="cv-1", center_id=CENTER, catalog_id="v-1", created_by=OWN),
        CenterVoucher(id="cv-2", center_id=CENTER, catalog_id="v-2", created_by=OWN),
        _client_voucher("clv-1", "cl-a", "cv-1", remaining=10),
        _client_voucher("clv-2", "cl-b", "cv-1", remaining=1),
        _client_voucher("clv-3", "cl-a", "cv-2", remaining=10),
    ]

    # 나머지 도구용 최소 행 — 봉투 스모크는 행이 0건이면 네임스페이스 접두를 볼 수 없다
    rows += [
        Role(id="role-counselor", center_id=CENTER, code="COUNSELOR", name="상담사"),
        Room(id="room-1", center_id=CENTER, name="상담실1"),
        Notice(
            id="notice-1", title="점검 공지", content="정기 점검", category="announcement",
            is_published=True, is_pinned=True, published_at=NOW, created_by=OWN,
        ),
        Institution(id="inst-1", name="가기관", phone="02-000-0000"),
        OperatingTime(id="ot-1", center_id=CENTER, weekday="MON"),
        MemberWorkingTime(id="mwt-1", center_id=CENTER, member_id=OWN, weekday="MON"),
        Subscription(
            id="sub-1", center_id=CENTER, plan="basic", status="active",
            current_period_start=NOW, current_period_end=NOW + timedelta(days=30),
        ),
        CreditBalance(
            id="cb-1", center_id=CENTER, plan_type="basic",
            period_start=NOW, period_end=NOW + timedelta(days=30),
        ),
        MessageLog(
            id="msg-1", center_id=CENTER, message_type="sms",
            recipient="01000000001", message="안내",
        ),
        Notification(
            id="noti-1", center_id=CENTER, recipient_id="acc-own", category="schedule",
            event_type="schedule_created", title="일정 알림", body="새 일정",
        ),
        # doc-private = 남의 비공개 — owner_scope가 access_level=center로 고정하는지 보는 대조군
        Document(
            id="doc-center", center_id=CENTER, uploader_id=OTHER, name="공용문서",
            storage_path="/x/a", file_type="pdf", file_size=10, checksum="c1",
            access_level="center",
        ),
        Document(
            id="doc-private", center_id=CENTER, uploader_id=OTHER, name="남의 비공개",
            storage_path="/x/b", file_type="pdf", file_size=10, checksum="c2",
            access_level="private",
        ),
        FormTemplate(id="tpl-1", center_id=CENTER, name="동의서", schema={"pages": []}),
        Form(id="form-1", center_id=CENTER, template_id="tpl-1"),
        Assessment(
            id="as-1", code="AS1", kor_name="검사가", eng_name="Assessment A",
            assessment_type="child", definition={},
        ),
        CenterAssessment(id="cas-1", center_id=CENTER, assessment_id="as-1", is_active=True),
        AssessmentPackage(id="apkg-1", center_id=CENTER, name="패키지A", assessment_summary=[]),
        AssessmentSession(id="asess-1", center_id=CENTER, case_id="acase-own"),
        ProgramMember(id="pm-1", center_id=CENTER, program_id="prog-1", member_id=OWN),
        PriceList(
            id="pl-1", center_id=CENTER, service_type=ServiceType.COUNSELING.value,
            service_name="개인상담", reference_id="prog-1", unit_price=50000, created_by=OWN,
        ),
        PriceList(
            id="pl-2", center_id=CENTER, service_type=ServiceType.ASSESSMENT.value,
            service_name="검사가", reference_id="as-1", unit_price=30000, created_by=OWN,
        ),
        Billable(
            id="bil-1", center_id=CENTER, client_id="cl-a",
            billable_date=NOW.date(), created_by=OWN,
        ),
        Payment(
            id="pay-1", billable_id="bil-1", amount=10000, payment_method="card",
            paid_at=NOW, created_by=OWN,
        ),
        MemberInvitation(
            id="inv-1", center_id=CENTER, invited_by="acc-own", role_id="role-counselor",
            name="새상담", email="new@example.com", expires_at=NOW + timedelta(days=7),
        ),
        ScheduleChangeRequest(
            id="scr-1", center_id=CENTER, schedule_id="sch-own", person_id="person-own",
            client_id="cl-a", current_start=NOW, current_end=NOW + timedelta(hours=1),
            requested_start=NOW + timedelta(days=1),
            requested_end=NOW + timedelta(days=1, hours=1),
        ),
        CounselingNote(
            id="cn-own", center_id=CENTER, counseling_session_id="sess-1",
            client_id="cl-a", content={}, author_id=OWN,
        ),
        CounselingNote(
            id="cn-other", center_id=CENTER, counseling_session_id="sess-1",
            client_id="cl-b", content={}, author_id=OTHER,
        ),
        Event(id="ev-1", center_id=CENTER, name="client_created", actor_id=OWN, actor_type="member"),
        EventAtomic(
            id="eva-1", event_id="ev-1", sequence=1, act="create",
            entity_name="client", entity_id="cl-a", payload={}, actor_id=OWN,
        ),
        # fn-3 = 남이 쓴 노트 — owner_scope가 author를 본인으로 고정하는지 보는 대조군
        FieldNote(id="fn-3", center_id=CENTER, author_id=OTHER, schedule_id="sch-shared"),
        Program(id="prog-2", center_id=CENTER, name="프로그램B"),
        AssessmentCase(id="acase-other", center_id=CENTER, case_code="AS-002", counselor_id=OTHER),
        AssessmentSession(id="asess-other", center_id=CENTER, case_id="acase-other"),
        CounselingSession(
            id="sess-3", center_id=CENTER, counseling_case_id="case-other",
            schedule_id="sch-other", session_number=1,
        ),
    ]

    test_session.add_all(rows)
    await test_session.flush()
    return UnitOfWork(test_session)


def _participant(pid, case_id, participant_id, ptype, is_active):
    return CounselingCaseParticipant(
        id=pid, center_id=CENTER, counseling_case_id=case_id,
        participant_id=participant_id, participant_type=ptype,
        is_active=is_active, joined_at=NOW,
    )


def _client_voucher(vid, client_id, center_voucher_id, *, remaining):
    return ClientVoucher(
        id=vid, center_id=CENTER, client_id=client_id,
        center_voucher_id=center_voucher_id, total_sessions=10,
        remaining_sessions=remaining, created_by=OWN,
    )


# --- G2: owner_scope 행 집합 == owning facade 정책 (query.md §7) ------------
#
# 스코프 서브쿼리는 handler 안에 중첩돼 직접 import할 수 없다 — 봉투 rows로 대조한다.
# 픽스처 건수(케이스 4·내담자 5)가 limit 40 아래라 절삭 없이 집합 비교가 성립한다.


async def test_case_owner_scope_matches_facade(fixtures):
    uow = fixtures
    out = await query_case_handler(
        CENTER, owner_scope=OWN, fields=["id"], limit=40, uow=uow
    )
    facade = set(await CounselingCaseFacade(uow).list_accessible_case_ids(CENTER, OWN))

    assert out["aggregate"]["count"] == len(out["rows"])  # 미절삭 — 집합 비교 유효
    assert {r["case.id"] for r in out["rows"]} == facade
    # 활성 공동상담사만 — 비활성 참여(case-inactive)와 무관 케이스는 빠진다
    assert facade == {"case-primary", "case-shared"}


async def test_client_owner_scope_matches_legacy_resolver(fixtures):
    uow = fixtures
    out = await query_client_handler(
        CENTER, owner_scope=OWN, fields=["id"], limit=40, uow=uow
    )
    legacy = set(await _resolve_assigned_client_ids(CENTER, OWN, uow))

    assert out["aggregate"]["count"] == len(out["rows"])
    assert {r["client.id"] for r in out["rows"]} == legacy
    # 활성 무관(cl-c는 비활성 공동 케이스) + 검사 케이스(cl-e) 포함, 무관 케이스(cl-d)만 제외
    # — 열람 케이스 스코프와의 비대칭이 여기서 드러난다
    assert legacy == {"cl-a", "cl-b", "cl-c", "cl-e"}


# --- 봉투 계약 스모크: {rows, aggregate} + {namespace}.{field} -------------


ALL_TOOLS = [
    (query_activity_handler, "activity_log", {}),
    (query_assessment_handler, "assessment", {}),
    (query_assessment_case_handler, "assessment_case", {}),
    (query_assessment_package_handler, "assessment_package", {}),
    (query_assessment_participant_handler, "assessment_participant", {"case_id": "acase-own"}),
    (query_assessment_session_handler, "assessment_session", {}),
    (query_billable_handler, "billable", {}),
    (query_center_voucher_handler, "center_voucher", {}),
    (query_client_handler, "client", {}),
    (query_client_voucher_handler, "client_voucher", {}),
    (query_case_handler, "case", {}),
    (query_counseling_note_handler, "note", {"author_id": OWN}),  # dependent — 앵커 필수
    (query_counseling_participant_handler, "participant", {"counseling_case_id": "case-primary"}),
    (query_counseling_session_handler, "session", {}),
    (query_credit_balance_handler, "credit_balance", {}),
    (query_document_handler, "document", {}),
    (query_field_note_handler, "field_note", {"author_id": OWN}),  # dependent — 앵커 필수
    (query_form_instance_handler, "form_instance", {"template_id": "tpl-1"}),
    (query_form_template_handler, "form_template", {}),
    (query_institution_handler, "institution", {}),
    (query_member_handler, "member", {}),
    (query_member_invitation_handler, "invitation", {}),
    (query_member_working_time_handler, "member_working_time", {}),
    (query_message_log_handler, "message_log", {}),
    (query_notice_handler, "notice", {}),
    (query_notification_handler, "notification", {"actor_membership_id": OWN}),
    (query_operating_time_handler, "operating_time", {}),
    (query_payment_handler, "payment", {}),
    (query_price_list_handler, "price_list", {}),
    (query_program_handler, "program", {}),
    (query_room_handler, "room", {}),
    (query_schedule_handler, "schedule", {}),
    (query_schedule_change_request_handler, "schedule_change_request", {}),
    (query_subscription_handler, "subscription", {}),
]


@pytest.mark.parametrize(
    "handler,namespace,kwargs",
    ALL_TOOLS,
    ids=[namespace for _, namespace, _ in ALL_TOOLS],
)
async def test_envelope_shape(fixtures, handler, namespace, kwargs):
    out = await handler(CENTER, uow=fixtures, **kwargs)

    assert set(out) >= {"rows", "aggregate"}
    assert out["aggregate"]["count"] == len(out["rows"]) > 0
    assert out["aggregate"]["exact"] is True
    assert all(k.startswith(f"{namespace}.") for row in out["rows"] for k in row)


async def test_envelope_bare_keys_when_not_namespaced(fixtures):
    out = await query_client_handler(CENTER, uow=fixtures, namespaced=False)

    assert all("." not in k for row in out["rows"] for k in row)


# --- owner_scope 정책 (구 유닛테스트 의도 이관) -----------------------------


async def test_case_owner_scope_narrows_to_accessible(fixtures):
    out = await query_case_handler(CENTER, owner_scope=OWN, uow=fixtures)

    assert {r["case.id"] for r in out["rows"]} == {"case-primary", "case-shared"}


async def test_case_owner_scope_notices_out_of_scope_id(fixtures):
    # 조용한 치환 대신 사유 고지 (L2)
    out = await query_case_handler(CENTER, owner_scope=OWN, id="case-other", uow=fixtures)

    assert out["rows"] == []
    assert "notice" in out


async def test_case_owner_scope_notices_other_counselor_filter(fixtures):
    # 남의 담당으로 걸러도 조회는 되지만 결과가 "그 사람의 전체"가 아님을 고지
    out = await query_case_handler(CENTER, owner_scope=OWN, counselor_id=OTHER, uow=fixtures)

    assert {r["case.id"] for r in out["rows"]} == {"case-shared"}
    assert "notice" in out


async def test_case_all_scope_passes_counselor_filter(fixtures):
    out = await query_case_handler(CENTER, owner_scope=None, counselor_id=OTHER, uow=fixtures)

    assert {r["case.id"] for r in out["rows"]} == {"case-shared", "case-inactive", "case-other"}
    assert "notice" not in out


async def test_case_client_id_filter(fixtures):
    out = await query_case_handler(CENTER, client_id="cl-d", uow=fixtures)

    assert {r["case.id"] for r in out["rows"]} == {"case-other"}


async def test_client_owner_scope_narrows_to_assigned(fixtures):
    scoped = await query_client_handler(CENTER, owner_scope=OWN, uow=fixtures)
    every = await query_client_handler(CENTER, owner_scope=None, uow=fixtures)

    assert {r["client.id"] for r in scoped["rows"]} == {"cl-a", "cl-b", "cl-c", "cl-e"}
    assert {r["client.id"] for r in every["rows"]} == {"cl-a", "cl-b", "cl-c", "cl-d", "cl-e"}


async def test_client_owner_scope_without_assignment_is_empty(fixtures):
    out = await query_client_handler(CENTER, owner_scope="member-nobody", uow=fixtures)

    assert out["rows"] == []
    assert out["aggregate"]["count"] == 0


async def test_schedule_owner_scope_forces_self_plus_shared_sessions(fixtures):
    # LLM이 남의 것을 넣어도 본인 일정 + 공동 담당 회기 일정으로 고정
    out = await query_schedule_handler(
        CENTER, owner_scope=OWN, member_ids=[OTHER], uow=fixtures
    )

    assert {r["schedule.id"] for r in out["rows"]} == {"sch-own", "sch-shared"}


async def test_schedule_all_scope_passes_member_filter(fixtures):
    out = await query_schedule_handler(CENTER, owner_scope=None, member_ids=[OTHER], uow=fixtures)

    assert {r["schedule.id"] for r in out["rows"]} == {"sch-other", "sch-shared"}


async def test_field_note_task_id_filter(fixtures):
    out = await query_field_note_handler(CENTER, author_id=OWN, task_id="task-1", uow=fixtures)

    assert {r["field_note.id"] for r in out["rows"]} == {"fn-1"}


async def test_field_note_without_anchor_is_empty(fixtures):
    # 앵커 없이는 센터 전체 녹음 덤프 금지
    out = await query_field_note_handler(CENTER, uow=fixtures)

    assert out == {"rows": [], "aggregate": {"count": 0, "exact": True}}


# --- client_voucher group_by (G-impl) --------------------------------------


async def test_voucher_list_mode_envelope(fixtures):
    out = await query_client_voucher_handler(CENTER, uow=fixtures)

    assert out["aggregate"] == {"count": 3, "exact": True}
    assert "group_by" not in out["aggregate"]


async def test_voucher_group_by_center_voucher(fixtures):
    out = await query_client_voucher_handler(
        CENTER, group_by="center_voucher_id", uow=fixtures
    )

    # aggregate.count = 그룹 수가 아니라 필터 통과 원자 행 총수
    assert out["aggregate"] == {"count": 3, "exact": True, "group_by": "center_voucher_id"}
    assert out["rows"] == [
        {"center_voucher_id": "cv-1", "center_voucher_name": "바우처A", "count": 2},
        {"center_voucher_id": "cv-2", "center_voucher_name": "바우처B", "count": 1},
    ]


async def test_voucher_group_by_propagates_filters(fixtures):
    out = await query_client_voucher_handler(
        CENTER, group_by="center_voucher_id", remaining_sessions_min=5, uow=fixtures
    )

    assert out["aggregate"]["count"] == 2
    assert {r["center_voucher_id"]: r["count"] for r in out["rows"]} == {"cv-1": 1, "cv-2": 1}


async def test_voucher_group_by_rejects_unknown_dim(fixtures):
    with pytest.raises(ValueError, match="unsupported group_by"):
        await query_client_voucher_handler(CENTER, group_by="status", uow=fixtures)


# --- owner_scope 최소 불변식: 스코프는 넓어지지 않는다 ---------------------
#
# owner_scope를 실제로 소비하는 9종(나머지 25종은 noqa ARG001로 무시 선언).
# strict=True는 픽스처에 스코프 밖 대조군이 있어 **진부분집합**이어야 하는 것.

SCOPED_TOOLS = [
    (query_assessment_case_handler, "assessment_case", {}, True),
    (query_assessment_session_handler, "assessment_session", {}, True),
    (query_client_handler, "client", {}, True),
    (query_case_handler, "case", {}, True),
    (query_counseling_note_handler, "note", {"counseling_session_id": "sess-1"}, True),
    (query_counseling_session_handler, "session", {}, True),
    (query_document_handler, "document", {}, True),
    (query_field_note_handler, "field_note", {"schedule_id": "sch-shared"}, True),
    (query_schedule_handler, "schedule", {}, True),
]


@pytest.mark.parametrize(
    "handler,namespace,anchor,strict",
    SCOPED_TOOLS,
    ids=[namespace for _, namespace, _, _ in SCOPED_TOOLS],
)
async def test_owner_scope_never_widens(fixtures, handler, namespace, anchor, strict):
    scoped = await handler(CENTER, owner_scope=OWN, uow=fixtures, **anchor)
    every = await handler(CENTER, owner_scope=None, uow=fixtures, **anchor)

    scoped_ids = {r[f"{namespace}.id"] for r in scoped["rows"]}
    all_ids = {r[f"{namespace}.id"] for r in every["rows"]}

    assert scoped_ids <= all_ids
    assert scoped["aggregate"]["count"] <= every["aggregate"]["count"]
    if strict:
        assert scoped_ids < all_ids


async def test_assessment_case_owner_scope_matches_facade(fixtures):
    uow = fixtures
    out = await query_assessment_case_handler(
        CENTER, owner_scope=OWN, fields=["id"], limit=40, uow=uow
    )
    facade = set(await AssessmentCaseFacade(uow).list_accessible_case_ids(CENTER, OWN))

    assert out["aggregate"]["count"] == len(out["rows"])  # 미절삭 — 집합 비교 유효
    assert {r["assessment_case.id"] for r in out["rows"]} == facade
    assert facade == {"acase-own"}


# --- 삭제된 유닛테스트 17개의 의도 이관 -------------------------------------
#
# facade monkeypatch("인자를 넘겼는가")는 관찰 가능한 결과 단언으로 번역한다.


async def test_activity_fields_trim_to_identity_plus_requested(fixtures):
    out = await query_activity_handler(
        CENTER, actor_id=OWN, entity_id="cl-a", fields=["summary"], uow=fixtures
    )

    assert out["aggregate"]["count"] == 1
    assert set(out["rows"][0]) == {
        "activity_log.id",
        "activity_log.event_name",
        "activity_log.summary",
        "activity_log.created_at",
    }


async def test_activity_owner_scope_ignored(fixtures):
    scoped = await query_activity_handler(CENTER, owner_scope=OWN, uow=fixtures)
    every = await query_activity_handler(CENTER, uow=fixtures)

    assert scoped["rows"] == every["rows"]


async def test_assessment_case_owner_scope_narrows_to_accessible(fixtures):
    out = await query_assessment_case_handler(CENTER, owner_scope=OWN, uow=fixtures)

    assert {r["assessment_case.id"] for r in out["rows"]} == {"acase-own"}


async def test_assessment_case_owner_scope_nothing_accessible_notices(fixtures):
    # 담당·참여 케이스가 없으면 조용한 빈 결과 대신 고지 봉투 (L2)
    out = await query_assessment_case_handler(
        CENTER, owner_scope="member-nobody", counselor_id=OTHER, uow=fixtures
    )

    assert out["rows"] == []
    assert out["aggregate"]["count"] == 0
    assert "notice" in out


async def test_assessment_case_owner_scope_notices_other_counselor_filter(fixtures):
    out = await query_assessment_case_handler(
        CENTER, owner_scope=OWN, counselor_id=OTHER, uow=fixtures
    )

    assert out["rows"] == []
    assert "notice" in out


async def test_assessment_case_all_scope_passes_counselor_filter(fixtures):
    out = await query_assessment_case_handler(
        CENTER, owner_scope=None, counselor_id=OTHER, uow=fixtures
    )

    assert {r["assessment_case.id"] for r in out["rows"]} == {"acase-other"}
    assert "notice" not in out


async def test_assessment_case_client_id_filter(fixtures):
    out = await query_assessment_case_handler(CENTER, client_id="cl-e", uow=fixtures)

    assert {r["assessment_case.id"] for r in out["rows"]} == {"acase-own"}


async def test_assessment_session_client_id_filter(fixtures):
    out = await query_assessment_session_handler(CENTER, client_id="cl-e", uow=fixtures)

    assert {r["assessment_session.id"] for r in out["rows"]} == {"asess-1"}


async def test_assessment_session_client_without_participation_is_empty(fixtures):
    # 참여 검사 케이스가 없으면 필터 없는 전체 조회로 새지 않는다
    out = await query_assessment_session_handler(CENTER, client_id="cl-d", uow=fixtures)

    assert out["rows"] == []
    assert out["aggregate"]["count"] == 0


async def test_price_list_reference_id_filter(fixtures):
    out = await query_price_list_handler(CENTER, reference_id="prog-1", uow=fixtures)

    assert {r["price_list.id"] for r in out["rows"]} == {"pl-1"}


async def test_member_invitation_role_code_resolves(fixtures):
    out = await query_member_invitation_handler(CENTER, role_code="counselor", uow=fixtures)

    assert {r["invitation.id"] for r in out["rows"]} == {"inv-1"}
    assert out["rows"][0]["invitation.role_id"] == "role-counselor"


async def test_member_invitation_unknown_role_code_is_empty(fixtures):
    # 없는 코드 = 빈 결과 강제(무필터로 새지 않는다)
    out = await query_member_invitation_handler(CENTER, role_code="nosuch", uow=fixtures)

    assert out["rows"] == []
    assert out["aggregate"]["count"] == 0


async def test_program_counselor_id_narrows_to_junction(fixtures):
    scoped = await query_program_handler(CENTER, counselor_id=OWN, uow=fixtures)
    every = await query_program_handler(CENTER, uow=fixtures)

    assert {r["program.id"] for r in scoped["rows"]} == {"prog-1"}
    assert {r["program.id"] for r in every["rows"]} == {"prog-1", "prog-2"}


async def test_program_counselor_id_empty_junction_is_empty(fixtures):
    out = await query_program_handler(CENTER, counselor_id=OTHER, uow=fixtures)

    assert out["rows"] == []
    assert out["aggregate"]["count"] == 0


async def test_program_counselor_names_projection(fixtures):
    out = await query_program_handler(CENTER, uow=fixtures)
    names = {r["program.id"]: r["program.counselor_names"] for r in out["rows"]}

    assert names["prog-1"] == ["나상담"]
    assert names["prog-2"] == []  # array_agg NULL 방지 — 빈 담당은 []


@pytest.mark.parametrize("owner_scope", [None, OWN])
async def test_member_owner_scope_ignored(fixtures, owner_scope):
    # 구성원은 센터 관리 조회 — access_level과 무관하게 센터 전체
    out = await query_member_handler(CENTER, owner_scope=owner_scope, uow=fixtures)

    assert {r["member.id"] for r in out["rows"]} == {OWN, OTHER}


async def test_notice_owner_scope_ignored_and_filters(fixtures):
    out = await query_notice_handler(
        CENTER,
        owner_scope=OWN,  # 무시돼야 함
        category="announcement",
        keyword="점검",
        is_pinned=True,
        fields=["content"],
        uow=fixtures,
    )

    assert out["rows"] == [
        {"notice.id": "notice-1", "notice.title": "점검 공지", "notice.content": "정기 점검"}
    ]


# --- 목록 드리프트 가드 ------------------------------------------------------


def test_tool_lists_cover_every_query_module():
    from pathlib import Path

    import app.query.client as any_query_module

    slice_dir = Path(any_query_module.__file__).parent
    modules = {p.stem for p in slice_dir.glob("*.py")} - {"__init__", "core"}
    # owner_scope에 noqa 마커가 붙은 파일 = 그 도구가 스코프를 소비하지 않는다는 선언
    scoped_modules = {
        name
        for name in modules
        if "owner_scope: str | None = None,  # noqa" not in (slice_dir / f"{name}.py").read_text()
    }

    assert {h.__module__.rsplit(".", 1)[-1] for h, _, _ in ALL_TOOLS} == modules
    assert {h.__module__.rsplit(".", 1)[-1] for h, _, _, _ in SCOPED_TOOLS} == scoped_modules


# --- 기간 상한 경계: date_to는 그 날 전체를 포함한다 -------------------------
#
# DateTime 컬럼을 맨 date와 비교하면 종료일이 00:00으로 잘려 그 날 하루가 통째로 빠진다.
# 구·신 동치 대조가 이걸 못 잡은 이유 = 대조 케이스가 기간을 전 범위로만 줘서 경계를
# 한 번도 안 밟았기 때문. 여기선 경계일 **23:30 행**을 심고 date_to를 그 날짜로 준다.
# (하한은 원래 자정이라 정상이지만, 같은 날 00:00 행으로 대칭 가드한다.)

BOUNDARY_DAY = date(2026, 3, 2)
EDGES = (("early", datetime(2026, 3, 2, 0, 0)), ("late", datetime(2026, 3, 2, 23, 30)))


def _bnd_assessment(tag, ts):
    return [
        Assessment(
            id=f"bnd-{tag}", code=f"BND-{tag}", kor_name="경계검사", eng_name="Boundary",
            assessment_type="child", definition={}, created_at=ts,
        ),
        CenterAssessment(
            id=f"bnd-cas-{tag}", center_id=CENTER, assessment_id=f"bnd-{tag}", is_active=True,
        ),
    ]


def _bnd_schedule(tag, ts, schedule_type):
    return Schedule(
        id=f"bnd-sch-{tag}", center_id=CENTER, member_id=OWN, schedule_type=schedule_type,
        title=f"경계일정-{tag}", start=ts, end=ts + timedelta(minutes=30),
    )


BOUNDARY_TOOLS = [
    # (namespace, handler, from_kwarg, to_kwarg, 경계행 빌더)
    ("assessment", query_assessment_handler, "date_from", "date_to", _bnd_assessment),
    (
        "assessment_package", query_assessment_package_handler, "date_from", "date_to",
        lambda tag, ts: [AssessmentPackage(
            id=f"bnd-{tag}", center_id=CENTER, name=f"경계패키지-{tag}",
            assessment_summary=[], created_at=ts,
        )],
    ),
    (
        "assessment_session", query_assessment_session_handler, "date_from", "date_to",
        lambda tag, ts: [
            _bnd_schedule(tag, ts, "assessment"),
            AssessmentSession(
                id=f"bnd-{tag}", center_id=CENTER, case_id="acase-own",
                schedule_id=f"bnd-sch-{tag}",
            ),
        ],
    ),
    (
        "session", query_counseling_session_handler, "date_from", "date_to",
        lambda tag, ts: [
            _bnd_schedule(tag, ts, "counseling"),
            CounselingSession(
                id=f"bnd-{tag}", center_id=CENTER, counseling_case_id="case-primary",
                schedule_id=f"bnd-sch-{tag}", session_number=9,
            ),
        ],
    ),
    (
        # 같은 도구의 두 번째 기간 축 — completed_at
        "session", query_counseling_session_handler, "completed_from", "completed_to",
        lambda tag, ts: [
            # 회기당 일정 1:1(uq_counseling_session_schedule) — 시각은 completed_at만 본다
            _bnd_schedule(tag, NOW, "counseling"),
            CounselingSession(
                id=f"bnd-{tag}", center_id=CENTER, counseling_case_id="case-primary",
                schedule_id=f"bnd-sch-{tag}", session_number=9, completed_at=ts,
            ),
        ],
    ),
    (
        "form_template", query_form_template_handler, "date_from", "date_to",
        lambda tag, ts: [FormTemplate(
            id=f"bnd-{tag}", center_id=CENTER, name=f"경계양식-{tag}",
            schema={"pages": []}, created_at=ts,
        )],
    ),
    (
        "institution", query_institution_handler, "date_from", "date_to",
        lambda tag, ts: [Institution(
            id=f"bnd-{tag}", name=f"경계기관-{tag}", phone="02-111-1111", created_at=ts,
        )],
    ),
    (
        "notice", query_notice_handler, "published_from", "published_to",
        lambda tag, ts: [Notice(
            id=f"bnd-{tag}", title=f"경계공지-{tag}", content="본문", category="announcement",
            is_published=True, published_at=ts, created_by=OWN,
        )],
    ),
    (
        "operating_time", query_operating_time_handler, "date_from", "date_to",
        lambda tag, ts: [OperatingTime(
            id=f"bnd-{tag}", center_id=CENTER, weekday="TUE", created_at=ts,
        )],
    ),
    (
        "room", query_room_handler, "date_from", "date_to",
        lambda tag, ts: [Room(
            id=f"bnd-{tag}", center_id=CENTER, name=f"경계상담실-{tag}", created_at=ts,
        )],
    ),
    # 이미 정상이던 곳도 함께 못박는다 — 회귀 가드
    (
        "assessment_case", query_assessment_case_handler, "date_from", "date_to",
        lambda tag, ts: [AssessmentCase(
            id=f"bnd-{tag}", center_id=CENTER, case_code=f"AS-B{tag}",
            counselor_id=OWN, created_at=ts,
        )],
    ),
    (
        "client", query_client_handler, "date_from", "date_to",
        lambda tag, ts: [Client(
            id=f"bnd-{tag}", center_id=CENTER, code=f"CB{tag[0]}", role="client",  # code varchar(6)
            name=f"경계내담-{tag}", created_at=ts,
        )],
    ),
    (
        "client_voucher", query_client_voucher_handler, "date_from", "date_to",
        lambda tag, ts: [ClientVoucher(
            id=f"bnd-{tag}", center_id=CENTER, client_id="cl-a", center_voucher_id="cv-1",
            total_sessions=10, remaining_sessions=5, created_by=OWN, created_at=ts,
        )],
    ),
]


@pytest.mark.parametrize(
    "namespace,handler,from_kw,to_kw,make_rows",
    BOUNDARY_TOOLS,
    ids=[f"{ns}.{to_kw}" for ns, _, _, to_kw, _ in BOUNDARY_TOOLS],
)
async def test_date_to_includes_end_day(
    fixtures, test_session, namespace, handler, from_kw, to_kw, make_rows
):
    uow = fixtures
    for tag, ts in EDGES:
        test_session.add_all(make_rows(tag, ts))
    await test_session.flush()

    out = await handler(
        CENTER,
        **{from_kw: BOUNDARY_DAY, to_kw: BOUNDARY_DAY},
        uow=uow,
    )

    ids = {r[f"{namespace}.id"] for r in out["rows"]}
    # late(23:30) 누락 = date_to가 00:00으로 잘린 것, early(00:00) 누락 = 하한 붕괴
    assert ids == {"bnd-early", "bnd-late"}
    assert out["aggregate"]["count"] == 2
