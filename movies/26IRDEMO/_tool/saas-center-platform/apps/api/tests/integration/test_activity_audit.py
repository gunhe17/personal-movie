from datetime import date
from uuid import uuid4

import pytest

from app.application.handlers.activity.list_activity import list_activity_handler
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client.profile.handlers.create_client import create_client_handler
from app.modules.client.profile.handlers.update_client import update_client_handler
from app.modules.client.profile.handlers.delete_client import delete_client_handler
from app.modules.client.profile.handlers.create_clients import create_clients_handler
from app.modules.client.profile.schemas import (
    ClientCreate,
    ClientRole,
    ClientUpdate,
    CreateClientsRequest,
    GuardianInput,
    ChildInput,
    Gender,
)
from app.modules.event.event_atomic.repository import EventAtomicRepository

# case_analysis 모델은 라우터가 핸들러를 함수내 lazy import라 app 기동 시 미등록 —
# 테스트 create_all이 테이블을 만들도록 모듈 레벨에서 메타데이터에 등록한다.
from app.modules.counseling.counseling_case_analysis.models import CounselingCaseAnalysis  # noqa: F401


@pytest.mark.asyncio
async def test_create_client_emits_audit_atomic(test_session):
    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    # create client → emit (event_atomics, 같은 tx). behavior.request가 하던 커밋을 테스트가 대신.
    response = await create_client_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        data=ClientCreate(role=ClientRole.CLIENT, name="홍길동"),
        uow=uow,
        actor_id=actor_id,
    )
    await uow.commit()

    assert response.name == "홍길동"

    # event_atomics에 audit 한 줄이 박혔나
    atomics, page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id,
    )
    assert page["total"] == 1
    atomic = atomics[0]
    assert atomic.act == "created"
    assert atomic.entity_name == "client"
    assert atomic.entity_id == response.id
    assert atomic.actor_id == actor_id
    assert atomic.payload["data"]["name"] == "홍길동"

    # list_activity가 그 atomic을 읽어 화면용으로 복원하나
    listed = await list_activity_handler(uow=uow, center_id=center_id)
    assert listed.total == 1
    item = listed.items[0]
    assert item.category == "client"
    assert item.action == "created"
    assert item.entity_type == "client"
    assert item.summary == "내담자 생성"
    assert item.extra["data"]["name"] == "홍길동"
    # member-1은 실제 Member가 아니라 actor_name은 graceful None
    assert item.actor_name is None


@pytest.mark.asyncio
async def test_activity_resolves_actor_name(test_session):
    from app.modules.center.member.models import Member
    from app.modules.person.person.models import Person

    uow = UnitOfWork(test_session)
    center_id = "center-1"

    # seed actor: Person + Member (actor_id = member.id)
    person = Person(account_id="acc-1", name="김상담", phone="010-0000-0000")
    test_session.add(person)
    await test_session.flush()
    member = Member(center_id=center_id, person_id=person.id, role_id="role-1")
    test_session.add(member)
    await test_session.flush()

    await create_client_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        data=ClientCreate(role=ClientRole.CLIENT, name="홍길동"),
        uow=uow,
        actor_id=member.id,
    )
    await uow.commit()

    # list_activity가 actor_id(member.id) → Member → Person.name 으로 실명 복원
    listed = await list_activity_handler(uow=uow, center_id=center_id)
    assert listed.total == 1
    assert listed.items[0].actor_id == member.id
    assert listed.items[0].actor_name == "김상담"


@pytest.mark.asyncio
async def test_update_client_emits_updated_atomic(test_session):
    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    created = await create_client_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        data=ClientCreate(role=ClientRole.CLIENT, name="홍길동"),
        uow=uow,
        actor_id=actor_id,
    )
    await uow.commit()

    # update — name만 변경
    await update_client_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        client_id=created.id,
        data=ClientUpdate(name="홍길순"),
        uow=uow,
        actor_id=actor_id,
    )
    await uow.commit()

    # updated atomic의 payload는 {input, result} 두 덩어리
    atomics, page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id,
        act="updated",
    )
    assert page["total"] == 1
    updated = atomics[0]
    assert updated.act == "updated"
    assert updated.entity_id == created.id
    assert updated.payload["input"] == {"name": "홍길순"}        # 바뀐 요청 필드만 (델타)
    assert updated.payload["result"]["name"] == "홍길순"          # 바뀐 후 상태

    # 화면 복원: 같은 entity가 생성·수정 2건, 수정 summary = "내담자 수정"
    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=created.id)
    assert listed.total == 2
    summaries = {item.action: item.summary for item in listed.items}
    assert summaries["updated"] == "내담자 수정"
    assert summaries["created"] == "내담자 생성"


@pytest.mark.asyncio
async def test_delete_client_emits_deleted_atomic(test_session):
    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    created = await create_client_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        data=ClientCreate(role=ClientRole.CLIENT, name="홍길동"),
        uow=uow,
        actor_id=actor_id,
    )
    await uow.commit()

    await delete_client_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        client_id=created.id,
        uow=uow,
        actor_id=actor_id,
    )
    await uow.commit()

    # deleted atomic의 payload는 {data} 한 덩어리 (create와 동형)
    atomics, page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id,
        act="deleted",
    )
    assert page["total"] == 1
    deleted = atomics[0]
    assert deleted.act == "deleted"
    assert deleted.entity_id == created.id
    assert deleted.payload["data"]["name"] == "홍길동"

    # 화면 복원: summary = "내담자 삭제"
    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=created.id)
    actions = {item.action: item.summary for item in listed.items}
    assert actions["deleted"] == "내담자 삭제"


@pytest.mark.asyncio
async def test_create_clients_emits_one_event_with_atomics(test_session):
    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    await create_clients_handler(
        center_id=center_id,
        data=CreateClientsRequest(
            guardians=[GuardianInput(name="박엄마", phone="010-2222-3333", is_primary=True)],
            children=[ChildInput(name="박첫째", birth_date=date(2014, 5, 1), gender=Gender.MALE)],
        ),
        uow=uow,
        actor_id=actor_id,
        event_group_id=str(uuid4()),
    )

    # 보호자 + 자녀 = created atomic 2개 (한 event, N atomics)
    atomics, page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id,
        act="created",
    )
    assert page["total"] == 2
    assert {a.payload["data"]["name"] for a in atomics} == {"박엄마", "박첫째"}

    listed = await list_activity_handler(uow=uow, center_id=center_id)
    assert listed.total == 1
    assert len(listed.items[0].changes) == 2
    assert {change.entity_type for change in listed.items[0].changes} == {"client"}


@pytest.mark.asyncio
async def test_delete_schedule_emits_deleted_atomic(test_session):
    from datetime import datetime
    from app.modules.schedule.schedule.models import Schedule
    from app.modules.schedule.schedule.handlers.delete_schedule import delete_schedule_handler

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    # seed a schedule
    schedule = Schedule(
        center_id=center_id,
        schedule_type="meeting",
        title="주간 회의",
        start=datetime(2026, 7, 1, 10, 0),
        end=datetime(2026, 7, 1, 11, 0),
    )
    test_session.add(schedule)
    await test_session.flush()
    schedule_id = schedule.id

    # delete → emit (event_atomics, 같은 tx)
    result = await delete_schedule_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        schedule_id=schedule_id,
        uow=uow,
        actor_id=actor_id,
    )
    await uow.commit()

    assert result.message == "일정이 삭제되었습니다"

    # deleted atomic 한 줄 (payload = 엔티티 dump)
    atomics, page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id,
        act="deleted",
    )
    assert page["total"] == 1
    atomic = atomics[0]
    assert atomic.act == "deleted"
    assert atomic.entity_name == "schedule"
    assert atomic.entity_id == schedule_id
    assert atomic.actor_id == actor_id
    assert atomic.payload["data"]["title"] == "주간 회의"

    # 화면 복원: category=schedule, summary="일정 삭제"
    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=schedule_id)
    assert listed.total == 1
    item = listed.items[0]
    assert item.category == "schedule"
    assert item.action == "deleted"
    assert item.entity_type == "schedule"
    assert item.summary == "일정 삭제"


@pytest.mark.asyncio
async def test_create_and_update_role_emit_atomics(test_session):
    from app.modules.role.role_permission.handlers.create_role import create_role_handler
    from app.modules.role.role_permission.handlers.update_role import update_role_handler
    from app.modules.role.role.schemas import RoleCreate, RoleUpdate

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    created = await create_role_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        data=RoleCreate(name="상담매니저", description="상담 관리", permission_ids=[], access_level="own"),
        uow=uow,
        actor_id=actor_id,
    )
    await uow.commit()

    assert created.role_name == "상담매니저"
    role_code = created.role_code

    # created atomic
    atomics, page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert page["total"] == 1
    created_atomic = atomics[0]
    assert created_atomic.act == "created"
    assert created_atomic.entity_name == "role"
    assert created_atomic.actor_id == actor_id
    assert created_atomic.payload["data"]["name"] == "상담매니저"
    role_entity_id = created_atomic.entity_id

    # update name → updated atomic with input delta + result
    await update_role_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        role_code=role_code,
        data=RoleUpdate(name="상담팀장", description="상담 관리", permission_ids=[], access_level="own"),
        uow=uow,
        actor_id=actor_id,
    )
    await uow.commit()

    upd, upage = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert upage["total"] == 1
    updated_atomic = upd[0]
    assert updated_atomic.act == "updated"
    assert updated_atomic.entity_name == "role"
    assert updated_atomic.entity_id == role_entity_id
    assert updated_atomic.payload["input"]["name"] == "상담팀장"      # exclude_unset 델타
    assert updated_atomic.payload["result"]["name"] == "상담팀장"     # 변경 후 상태

    # 화면 복원: 생성·수정 2건
    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=role_entity_id)
    summaries = {item.action: item.summary for item in listed.items}
    assert summaries["created"] == "권한 생성"
    assert summaries["updated"] == "권한 수정"


@pytest.mark.asyncio
async def test_field_note_update_and_delete_emit_atomics(test_session):
    from app.modules.field_note.field_note.models import FieldNote
    from app.modules.field_note.field_note.handlers.update_speaker_map import update_speaker_map_handler
    from app.modules.field_note.field_note.handlers.delete_field_note import delete_field_note_handler
    from app.modules.field_note.field_note.schemas import FieldNoteSpeakerMapUpdate

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    # seed two field notes (update target + delete target)
    note_upd = FieldNote(center_id=center_id, author_id=actor_id)
    note_del = FieldNote(center_id=center_id, author_id=actor_id)
    test_session.add(note_upd)
    test_session.add(note_del)
    await test_session.flush()
    upd_id, del_id = note_upd.id, note_del.id

    # update speaker_map → updated atomic (핸들러가 내부 commit)
    await update_speaker_map_handler(
        event_group_id=str(uuid4()),
        field_note_id=upd_id,
        center_id=center_id,
        data=FieldNoteSpeakerMapUpdate(speaker_map={"spk_0": "상담사"}),
        uow=uow,
        actor_id=actor_id,
    )

    upd_atomics, upd_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert upd_page["total"] == 1
    ua = upd_atomics[0]
    assert ua.entity_name == "field_note"
    assert ua.entity_id == upd_id
    assert ua.actor_id == actor_id
    assert ua.payload["input"]["speaker_map"] == {"spk_0": "상담사"}

    # delete → deleted atomic
    await delete_field_note_handler(
        event_group_id=str(uuid4()),
        field_note_id=del_id,
        center_id=center_id,
        uow=uow,
        actor_id=actor_id,
    )

    del_atomics, del_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deleted",
    )
    assert del_page["total"] == 1
    da = del_atomics[0]
    assert da.entity_name == "field_note"
    assert da.entity_id == del_id

    # 화면 복원
    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=upd_id)
    assert listed.items[0].category == "field_note"
    assert listed.items[0].summary == "현장노트 수정"


@pytest.mark.asyncio
async def test_message_template_crud_emit_atomics(test_session):
    from app.modules.messaging.message_template.handlers.create_message_template import create_message_template_handler
    from app.modules.messaging.message_template.handlers.update_message_template import update_message_template_handler
    from app.modules.messaging.message_template.handlers.delete_message_template import delete_message_template_handler
    from app.modules.messaging.message_template.schemas import MessageTemplateCreate, MessageTemplateUpdate
    from app.modules.messaging.message_template.constants import TemplateType

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    # create (핸들러가 내부 commit)
    created = await create_message_template_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        data=MessageTemplateCreate(
            template_type=TemplateType.SESSION_REMINDER,
            name="알림 양식",
            content="안녕하세요 {name}님",
        ),
        uow=uow,
        actor_id=actor_id,
    )
    tpl_id = created.id

    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, entity_names=["message_template"], act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "message_template"
    assert c_atomics[0].actor_id == actor_id
    assert c_atomics[0].payload["data"]["name"] == "알림 양식"

    # update name → updated atomic with delta
    await update_message_template_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        template_id=tpl_id,
        data=MessageTemplateUpdate(name="수정된 양식"),
        uow=uow,
        actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, entity_names=["message_template"], act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].payload["input"] == {"name": "수정된 양식"}
    assert u_atomics[0].payload["result"]["name"] == "수정된 양식"

    # delete → deleted atomic
    await delete_message_template_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        template_id=tpl_id,
        uow=uow,
        actor_id=actor_id,
    )
    d_atomics, d_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deleted",
    )
    assert d_page["total"] == 1
    assert d_atomics[0].entity_id == tpl_id

    # 화면 복원: category=messaging, summary=문자 양식 ...
    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=tpl_id)
    cats = {item.action: (item.category, item.summary) for item in listed.items}
    assert cats["created"] == ("messaging", "문자 양식 생성")
    assert cats["deleted"] == ("messaging", "문자 양식 삭제")


@pytest.mark.asyncio
async def test_document_lifecycle_and_share_token_emit_atomics(test_session):
    from datetime import datetime
    from app.modules.document.document.models import Document
    from app.modules.document.document.handlers.update_document import update_document_handler
    from app.modules.document.document.handlers.delete_document import delete_document_handler
    from app.modules.document.document.handlers.restore_document import restore_document_handler
    from app.modules.document.document.schemas import DocumentUpdate
    from app.modules.document.share_token.handlers.create_share_token import create_share_token_handler
    from app.modules.document.share_token.schemas import ShareTokenCreate

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"
    account_id = "acc-1"

    doc = Document(
        center_id=center_id,
        uploader_id=actor_id,
        name="원본.pdf",
        storage_path="s3://bucket/center-1/orig.pdf",
        file_type="application/pdf",
        file_size=1024,
        checksum="abc123",
    )
    test_session.add(doc)
    await test_session.flush()
    doc_id = doc.id

    # update → updated atomic (delta)
    await update_document_handler(
        event_group_id=str(uuid4()), document_id=doc_id,
        data=DocumentUpdate(name="수정본.pdf"),
        center_id=center_id, account_id=account_id, ip_address="1.2.3.4", user_agent="pytest",
        uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].entity_name == "document"
    assert u_atomics[0].payload["input"] == {"name": "수정본.pdf"}
    assert u_atomics[0].payload["result"]["name"] == "수정본.pdf"

    # delete → deleted atomic
    await delete_document_handler(
        event_group_id=str(uuid4()), document_id=doc_id,
        center_id=center_id, account_id=account_id, ip_address="1.2.3.4", user_agent="pytest",
        uow=uow, actor_id=actor_id,
    )
    d_atomics, d_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deleted",
    )
    assert d_page["total"] == 1
    assert d_atomics[0].entity_id == doc_id

    # restore → restored atomic
    await restore_document_handler(
        event_group_id=str(uuid4()), document_id=doc_id,
        center_id=center_id, account_id=account_id, ip_address="1.2.3.4", user_agent="pytest",
        uow=uow, actor_id=actor_id,
    )
    r_atomics, r_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="restored",
    )
    assert r_page["total"] == 1
    assert r_atomics[0].entity_name == "document"
    assert r_atomics[0].entity_id == doc_id

    # share_token create → created atomic (token 민감값 제외)
    st = await create_share_token_handler(
        event_group_id=str(uuid4()),
        data=ShareTokenCreate(
            document_id=doc_id, created_by=actor_id,
            expires_at=datetime(2027, 1, 1), max_downloads=5,
        ),
        center_id=center_id, member_id=actor_id, account_id="account-1", uow=uow,
    )
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    ca = c_atomics[0]
    assert ca.entity_name == "share_token"
    assert ca.entity_id == st.id
    assert ca.actor_id == actor_id
    assert "token" not in ca.payload["data"]
    assert ca.payload["data"]["document_id"] == doc_id

    # 화면 복원: document restored summary
    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=doc_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["updated"][0] == "document"
    assert acts["restored"] == ("document", "문서 복원")


@pytest.mark.asyncio
async def test_client_voucher_update_delete_emit_atomics(test_session):
    from app.modules.voucher.client_voucher.models import ClientVoucher
    from app.modules.voucher.client_voucher.handlers.update_client_voucher import update_client_voucher_handler
    from app.modules.voucher.client_voucher.handlers.delete_client_voucher import delete_client_voucher_handler
    from app.modules.voucher.client_voucher.schemas import ClientVoucherUpdate

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    cv = ClientVoucher(
        center_id=center_id, client_id="client-1", center_voucher_id="cvouch-1",
        total_sessions=10, remaining_sessions=10, created_by=actor_id,
    )
    test_session.add(cv)
    await test_session.flush()
    cv_id = cv.id

    # update remaining_sessions → updated atomic (delta)
    await update_client_voucher_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        client_voucher_id=cv_id,
        data=ClientVoucherUpdate(remaining_sessions=8),
        uow=uow,
        actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].entity_name == "client_voucher"
    assert u_atomics[0].entity_id == cv_id
    assert u_atomics[0].actor_id == actor_id
    assert u_atomics[0].payload["input"] == {"remaining_sessions": 8}
    assert u_atomics[0].payload["result"]["remaining_sessions"] == 8

    # delete → deleted atomic
    await delete_client_voucher_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        client_voucher_id=cv_id,
        uow=uow,
        actor_id=actor_id,
    )
    d_atomics, d_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deleted",
    )
    assert d_page["total"] == 1
    assert d_atomics[0].entity_id == cv_id

    # 화면 복원
    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=cv_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["updated"] == ("voucher", "내담자 바우처 수정")
    assert acts["deleted"] == ("voucher", "내담자 바우처 삭제")


@pytest.mark.asyncio
async def test_form_instance_and_signature_emit_atomics(test_session):
    from app.modules.form.template.models import FormTemplate
    from app.modules.form.form.handlers.create_instance import create_instance_handler
    from app.modules.form.form.handlers.delete_instance import delete_instance_handler
    from app.modules.form.form.handlers.create_signature import create_signature_handler
    from app.modules.form.form.schemas import FormCreate
    from app.modules.form.signature.schemas import SignatureCreate

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    # seed a draft template to create instances against
    template = FormTemplate(
        center_id=center_id, name="동의서", version=1,
        schema={"fields": {}}, is_active=True, status="draft",
    )
    test_session.add(template)
    await test_session.flush()
    template_id = template.id

    # create instance → created atomic (entity=form)
    created = await create_instance_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        data=FormCreate(template_id=template_id),
        uow=uow,
        created_by=actor_id,
        actor_id=actor_id,
    )
    instance_id = created.id

    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "form"
    assert c_atomics[0].entity_id == instance_id
    assert c_atomics[0].actor_id == actor_id
    assert c_atomics[0].payload["data"]["template_id"] == template_id

    # create signature → created atomic (entity=signature, 같은 event group은 아님)
    sig = await create_signature_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        data=SignatureCreate(
            instance_id=instance_id, field_id="sig_1",
            signature_data="data:image/png;base64,AAAA", signer_name="홍길동",
        ),
        uow=uow,
        ip_address="1.2.3.4",
        actor_id=actor_id,
    )
    sig_atomics, sig_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created", entity_names=["signature"],
    )
    assert sig_page["total"] == 1
    assert sig_atomics[0].entity_id == sig.id
    assert sig_atomics[0].payload["data"]["signer_name"] == "홍길동"

    # delete instance → deleted atomic (entity dump = 의도된 redefinition)
    await delete_instance_handler(
        event_group_id=str(uuid4()),
        instance_id=instance_id,
        center_id=center_id,
        uow=uow,
        actor_id=actor_id,
    )
    d_atomics, d_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deleted",
    )
    assert d_page["total"] == 1
    assert d_atomics[0].entity_name == "form"
    assert d_atomics[0].entity_id == instance_id

    # 화면 복원: category=form, 양식/서명 summary
    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=instance_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["created"] == ("form", "양식 생성")
    assert acts["deleted"] == ("form", "양식 삭제")

    sig_listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=sig.id)
    assert sig_listed.items[0].category == "form"
    assert sig_listed.items[0].summary == "서명 생성"


@pytest.mark.asyncio
async def test_form_template_lifecycle_emit_atomics(test_session):
    from app.modules.form.template.handlers.create_form_template import create_form_template_handler
    from app.modules.form.template.handlers.create_form_template_version import (
        create_form_template_version_handler,
    )
    from app.modules.form.template.handlers.update_form_template_draft import (
        update_form_template_draft_handler,
    )
    from app.modules.form.template.handlers.publish_form_template import publish_form_template_handler
    from app.modules.form.template.schemas import (
        TemplateCreate, TemplateDraftUpdate, TemplateVersionCreate,
    )

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"
    repo = EventAtomicRepository(test_session)

    # create → created atomic (entity=form_template)
    created = await create_form_template_handler(
        event_group_id=str(uuid4()),
        center_id=center_id,
        data=TemplateCreate.model_validate({"name": "동의서", "schema": {"fields": {}}}),
        uow=uow,
        actor_id=actor_id,
    )
    tpl_id = created.id

    c_atomics, _ = await repo.list_audit_in_center_with_page(
        center_id=center_id, act="created", entity_names=["form_template"],
    )
    assert len(c_atomics) == 1
    assert c_atomics[0].entity_id == tpl_id
    assert c_atomics[0].actor_id == actor_id
    assert c_atomics[0].payload["data"]["name"] == "동의서"

    # update draft → updated atomic (input delta = schema_)
    await update_form_template_draft_handler(
        event_group_id=str(uuid4()),
        template_id=tpl_id,
        center_id=center_id,
        data=TemplateDraftUpdate.model_validate({"schema": {"fields": {"a": {"type": "text", "label": "이름"}}}}),
        uow=uow,
        actor_id=actor_id,
    )

    # publish → updated atomic (input = status transition)
    await publish_form_template_handler(
        event_group_id=str(uuid4()),
        template_id=tpl_id,
        center_id=center_id,
        uow=uow,
        actor_id=actor_id,
    )

    u_atomics, u_page = await repo.list_audit_in_center_with_page(
        center_id=center_id, act="updated", entity_id=tpl_id,
    )
    assert u_page["total"] == 2
    inputs = [a.payload["input"] for a in u_atomics]
    assert {"schema_": {"fields": {"a": {"type": "text", "label": "이름"}}}} in inputs
    assert {"status": "published"} in inputs

    # create version → created atomic (entity=form_template_version, 별 엔티티)
    version = await create_form_template_version_handler(
        event_group_id=str(uuid4()),
        template_id=tpl_id,
        center_id=center_id,
        data=TemplateVersionCreate.model_validate({"schema": {"fields": {"b": {"type": "text", "label": "주소"}}}}),
        uow=uow,
        actor_id=actor_id,
    )
    v_atomics, _ = await repo.list_audit_in_center_with_page(
        center_id=center_id, act="created", entity_names=["form_template_version"],
    )
    assert len(v_atomics) == 1
    assert v_atomics[0].entity_id == version.id

    # 화면 복원: form_template = 양식 템플릿, form_template_version = 양식 버전, 둘 다 category=form
    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=tpl_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["created"] == ("form", "양식 템플릿 생성")
    assert acts["updated"] == ("form", "양식 템플릿 수정")

    v_listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=version.id)
    assert v_listed.items[0].category == "form"
    assert v_listed.items[0].summary == "양식 버전 생성"


@pytest.mark.asyncio
async def test_center_voucher_crud_emit_atomics(test_session):
    from app.modules.voucher.voucher.models import Voucher
    from app.modules.voucher.center_voucher.handlers.create_center_voucher import create_center_voucher_handler
    from app.modules.voucher.center_voucher.handlers.update_center_voucher import update_center_voucher_handler
    from app.modules.voucher.center_voucher.handlers.delete_center_voucher import delete_center_voucher_handler
    from app.modules.voucher.center_voucher.schemas import CenterVoucherCreate, CenterVoucherUpdate

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"
    account_id = "acc-1"

    catalog = Voucher(name="바우처A", program_name="프로그램", program_organization="기관", program_year=2026)
    test_session.add(catalog)
    await test_session.flush()
    catalog_id = catalog.id

    # create → created atomic
    created = await create_center_voucher_handler(
        event_group_id=str(uuid4()), center_id=center_id, account_id=account_id,
        data=CenterVoucherCreate(catalog_id=catalog_id, unit_price=50000, default_total_sessions=10, is_active=True),
        uow=uow, actor_id=actor_id,
    )
    cv_id = created.id
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "center_voucher"
    assert c_atomics[0].actor_id == actor_id
    assert c_atomics[0].payload["data"]["catalog_id"] == catalog_id

    # update → updated atomic (delta)
    await update_center_voucher_handler(
        event_group_id=str(uuid4()), center_id=center_id, center_voucher_id=cv_id,
        data=CenterVoucherUpdate(unit_price=60000), uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].payload["input"] == {"unit_price": 60000}
    assert u_atomics[0].payload["result"]["unit_price"] == 60000

    # delete → deleted atomic
    await delete_center_voucher_handler(
        event_group_id=str(uuid4()), center_id=center_id, center_voucher_id=cv_id,
        uow=uow, actor_id=actor_id,
    )
    d_atomics, d_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deleted",
    )
    assert d_page["total"] == 1
    assert d_atomics[0].entity_id == cv_id

    # 화면 복원
    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=cv_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["created"] == ("voucher", "센터 바우처 생성")
    assert acts["updated"] == ("voucher", "센터 바우처 수정")
    assert acts["deleted"] == ("voucher", "센터 바우처 삭제")


@pytest.mark.asyncio
async def test_price_list_crud_emit_atomics(test_session):
    from app.modules.billing.price_list.handlers.create_price_list import create_price_list_handler
    from app.modules.billing.price_list.handlers.update_price_list import update_price_list_handler
    from app.modules.billing.price_list.handlers.delete_price_list import delete_price_list_handler
    from app.modules.billing.price_list.schemas import PriceListCreate, PriceListUpdate, ServiceType

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"
    account_id = "acc-1"

    # create → created atomic
    created = await create_price_list_handler(
        event_group_id=str(uuid4()), center_id=center_id, account_id=account_id,
        data=PriceListCreate(service_type=ServiceType.COUNSELING, service_name="개인상담", unit_price=50000),
        uow=uow, actor_id=actor_id,
    )
    pl_id = created.id
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "price_list"
    assert c_atomics[0].actor_id == actor_id
    assert c_atomics[0].payload["data"]["unit_price"] == 50000

    # update → updated atomic (delta)
    await update_price_list_handler(
        event_group_id=str(uuid4()), center_id=center_id, price_list_id=pl_id,
        data=PriceListUpdate(unit_price=60000), uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].payload["input"] == {"unit_price": 60000}
    assert u_atomics[0].payload["result"]["unit_price"] == 60000

    # delete → deleted atomic
    await delete_price_list_handler(
        event_group_id=str(uuid4()), center_id=center_id, price_list_id=pl_id,
        uow=uow, actor_id=actor_id,
    )
    d_atomics, d_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deleted",
    )
    assert d_page["total"] == 1
    assert d_atomics[0].entity_id == pl_id

    # 화면 복원
    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=pl_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["created"] == ("billing", "단가 생성")
    assert acts["updated"] == ("billing", "단가 수정")
    assert acts["deleted"] == ("billing", "단가 삭제")


@pytest.mark.asyncio
async def test_payment_created_emits_atomic(test_session):
    from datetime import datetime
    from app.modules.billing.billable.models import Billable
    from app.modules.billing.payment.handlers.create_payment import create_payment_handler
    from app.modules.billing.payment.schemas import PaymentCreate, PaymentMethod

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"
    account_id = "acc-1"

    billable = Billable(
        center_id=center_id, client_id="client-1", billable_date=date(2026, 6, 1),
        total_amount=100000, paid_amount=0, unpaid_amount=100000, status="issued",
        created_by=account_id,
    )
    test_session.add(billable)
    await test_session.flush()

    created = await create_payment_handler(
        event_group_id=str(uuid4()), center_id=center_id, account_id=account_id,
        billable_id=billable.id,
        data=PaymentCreate(amount=50000, payment_method=PaymentMethod.CARD, paid_at=datetime(2026, 6, 2, 10, 0)),
        uow=uow, actor_id=actor_id,
    )
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "payment"
    assert c_atomics[0].entity_id == created.id
    assert c_atomics[0].actor_id == actor_id
    assert c_atomics[0].payload["data"]["amount"] == 50000

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=created.id)
    assert listed.items[0].category == "billing"
    assert listed.items[0].summary == "결제 생성"


@pytest.mark.asyncio
async def test_counseling_note_crud_emit_atomics(test_session):
    from app.modules.counseling.counseling_case.models import CounselingCase
    from app.modules.counseling.counseling_session.models import CounselingSession
    from app.modules.counseling.counseling_note.handlers.create_note import create_note_handler
    from app.modules.counseling.counseling_note.handlers.update_note import update_note_handler
    from app.modules.counseling.counseling_note.handlers.delete_note import delete_note_handler
    from app.modules.counseling.counseling_note.schemas import (
        CounselingNoteCreate,
        CounselingNoteUpdate,
        NoteContent,
    )

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    case = CounselingCase(
        center_id=center_id, program_id="prog-1", counselor_id=actor_id, case_code="CASE01",
        status="active",
    )
    test_session.add(case)
    await test_session.flush()
    session = CounselingSession(
        center_id=center_id, counseling_case_id=case.id, schedule_id="sched-1", status="scheduled",
    )
    test_session.add(session)
    await test_session.flush()

    # create → created atomic (private_notes 제외)
    created = await create_note_handler(
        event_group_id=str(uuid4()), session_id=session.id, client_id="client-1",
        center_id=center_id, author_id=actor_id, counselor_id=None,
        data=CounselingNoteCreate(
            client_id="client-1",
            content=NoteContent(main_topic="불안", private_notes="비밀"),
            summary="첫 회기",
        ),
        uow=uow, actor_id=actor_id,
    )
    note_id = created.id
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "counseling_note"
    assert c_atomics[0].payload["data"]["content"]["main_topic"] == "불안"
    assert "private_notes" not in c_atomics[0].payload["data"]["content"]

    # update → updated atomic (delta, private_notes 제외)
    await update_note_handler(
        event_group_id=str(uuid4()), note_id=note_id, center_id=center_id,
        counselor_id=None, viewer_member_id=actor_id,
        data=CounselingNoteUpdate(
            content=NoteContent(main_topic="우울", private_notes="갱신비밀"), summary="갱신요약"
        ),
        uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].payload["input"]["content"]["main_topic"] == "우울"
    assert "private_notes" not in u_atomics[0].payload["input"]["content"]
    assert "private_notes" not in u_atomics[0].payload["result"]["content"]

    # delete → deleted atomic
    await delete_note_handler(
        event_group_id=str(uuid4()), note_id=note_id, center_id=center_id,
        counselor_id=None, uow=uow, actor_id=actor_id,
    )
    d_atomics, d_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deleted",
    )
    assert d_page["total"] == 1
    assert d_atomics[0].entity_id == note_id

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=note_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["created"] == ("counseling", "상담 일지 생성")
    assert acts["updated"] == ("counseling", "상담 일지 수정")
    assert acts["deleted"] == ("counseling", "상담 일지 삭제")


@pytest.mark.asyncio
async def test_counseling_session_lifecycle_emit_atomics(test_session):
    from datetime import datetime
    from app.modules.counseling.counseling_case.models import CounselingCase
    from app.modules.counseling.counseling_case_participant.models import CounselingCaseParticipant
    from app.modules.counseling.counseling_session.handlers.create_counseling_session import create_counseling_session_handler
    from app.modules.counseling.counseling_session.handlers.update_counseling_session import update_counseling_session_handler
    from app.modules.counseling.counseling_session.handlers.cancel_counseling_session import cancel_counseling_session_handler
    from app.modules.counseling.counseling_session.schemas import (
        CounselingSessionCreate,
        CounselingSessionUpdate,
        SessionStatus,
    )

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    case = CounselingCase(
        center_id=center_id, program_id="prog-1", counselor_id=actor_id, case_code="CASE02",
        status="active",
    )
    test_session.add(case)
    await test_session.flush()
    test_session.add(CounselingCaseParticipant(
        center_id=center_id, counseling_case_id=case.id, participant_id="client-1",
        participant_type="client", is_active=True, joined_at=datetime(2026, 6, 1, 9, 0),
    ))
    await test_session.flush()

    # create → created atomic
    created = await create_counseling_session_handler(
        event_group_id=str(uuid4()), center_id=center_id, owner_scope=None,
        data=CounselingSessionCreate(counseling_case_id=case.id, schedule_id="sched-A"),
        uow=uow, actor_id=actor_id,
    )
    sess_id = created.id
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, entity_names=["counseling_session"], act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "counseling_session"
    assert c_atomics[0].entity_id == sess_id
    assert c_atomics[0].actor_id == actor_id

    # update → updated atomic (delta)
    await update_counseling_session_handler(
        event_group_id=str(uuid4()), session_id=sess_id, center_id=center_id,
        owner_scope=None, data=CounselingSessionUpdate(status=SessionStatus.COMPLETED),
        uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, entity_names=["counseling_session"], act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].payload["input"] == {"status": "completed"}
    assert u_atomics[0].payload["result"]["status"] == "completed"

    # cancel → cancelled atomic
    await cancel_counseling_session_handler(
        event_group_id=str(uuid4()), session_id=sess_id, center_id=center_id,
        owner_scope=None, uow=uow, actor_id=actor_id, cancel_reason="사정",
    )
    x_atomics, x_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, entity_names=["counseling_session"], act="cancelled",
    )
    assert x_page["total"] == 1
    assert x_atomics[0].payload["data"]["cancel_reason"] == "사정"

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=sess_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["created"] == ("counseling", "상담 세션 생성")
    assert acts["updated"] == ("counseling", "상담 세션 수정")
    assert acts["cancelled"] == ("counseling", "상담 세션 취소")


@pytest.mark.asyncio
async def test_session_participant_attendance_emit_atomic(test_session):
    from app.modules.counseling.counseling_case.models import CounselingCase
    from app.modules.counseling.counseling_session.models import CounselingSession
    from app.modules.counseling.counseling_session_participant.models import CounselingSessionParticipant
    from app.modules.counseling.counseling_session.handlers.update_attendance import update_attendance_handler
    from app.modules.counseling.counseling_session_participant.schemas import (
        SessionParticipantUpdate,
        AttendanceStatus,
    )

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    case = CounselingCase(
        center_id=center_id, program_id="prog-1", counselor_id=actor_id, case_code="CASE03",
        status="active",
    )
    test_session.add(case)
    await test_session.flush()
    session = CounselingSession(
        center_id=center_id, counseling_case_id=case.id, schedule_id="sched-B", status="scheduled",
    )
    test_session.add(session)
    await test_session.flush()
    participant = CounselingSessionParticipant(
        center_id=center_id, session_id=session.id, participant_type="client",
        participant_id="client-1", attendance_status="scheduled", is_consumed=False,
    )
    test_session.add(participant)
    await test_session.flush()
    p_id = participant.id

    await update_attendance_handler(
        event_group_id=str(uuid4()), session_participant_id=p_id, center_id=center_id,
        member_id=None,
        data=SessionParticipantUpdate(attendance_status=AttendanceStatus.ATTENDED, is_consumed=True, note="출석"),
        uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].entity_name == "session_participant"
    assert u_atomics[0].entity_id == p_id
    assert u_atomics[0].payload["input"]["attendance_status"] == "attended"
    assert u_atomics[0].payload["result"]["attendance_status"] == "attended"

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=p_id)
    assert listed.items[0].category == "counseling"
    assert listed.items[0].summary == "세션 참여자 수정"


@pytest.mark.asyncio
async def test_case_analysis_trigger_emits_atomic(test_session):
    from fastapi import BackgroundTasks
    from app.modules.counseling.counseling_case.models import CounselingCase
    from app.modules.counseling.counseling_session.models import CounselingSession
    from app.modules.counseling.counseling_case_analysis.handlers.create_case_analysis import (
        create_case_analysis_handler,
    )

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    case = CounselingCase(
        center_id=center_id, program_id="prog-1", counselor_id=actor_id, case_code="CASE04",
        status="active",
    )
    test_session.add(case)
    await test_session.flush()
    test_session.add(CounselingSession(
        center_id=center_id, counseling_case_id=case.id, schedule_id="sched-C",
        status="completed", session_number=1,
    ))
    await test_session.flush()

    result = await create_case_analysis_handler(
        event_group_id=str(uuid4()), case_id=case.id, center_id=center_id,
        member_id=actor_id, account_id="account-1", uow=uow, actor_id=actor_id,
    )
    assert result.status == "started"

    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "case_analysis"
    # entity_id = pre-create된 분석 행 id(실 레코드가 foreground에서 생김), 케이스는 payload로
    assert c_atomics[0].payload["data"]["counseling_case_id"] == case.id
    assert c_atomics[0].actor_id == actor_id
    assert c_atomics[0].payload["data"]["status"] == "processing"
    analysis_entity_id = c_atomics[0].entity_id

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=analysis_entity_id)
    assert listed.items[0].category == "counseling"
    assert listed.items[0].summary == "사례 분석 생성"


@pytest.mark.asyncio
async def test_center_assessment_create_update_emit_atomics(test_session):
    from app.modules.assessment.center_assessment.handlers.create_center_assessment import (
        create_center_assessment_handler,
    )
    from app.modules.assessment.center_assessment.handlers.update_center_assessment import (
        update_center_assessment_handler,
    )
    from app.modules.assessment.center_assessment.schemas import CenterAssessmentUpdate

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    created = await create_center_assessment_handler(
        event_group_id=str(uuid4()), center_id=center_id, assessment_id="assess-1",
        uow=uow, actor_id=actor_id,
    )
    assert created.is_active is True
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "center_assessment"
    assert c_atomics[0].actor_id == actor_id
    assert c_atomics[0].payload["data"]["assessment_id"] == "assess-1"

    await update_center_assessment_handler(
        event_group_id=str(uuid4()), center_id=center_id, assessment_id="assess-1",
        data=CenterAssessmentUpdate(is_active=False), uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].payload["input"] == {"is_active": False}
    assert u_atomics[0].payload["result"]["is_active"] is False

    ca_id = c_atomics[0].entity_id
    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=ca_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["created"] == ("assessment", "센터 검사 생성")
    assert acts["updated"] == ("assessment", "센터 검사 수정")


@pytest.mark.asyncio
async def test_assessment_task_cancel_and_opinion_emit_atomics(test_session):
    from app.modules.assessment.assessment_case.models import AssessmentCase
    from app.modules.assessment.assessment_task.models import AssessmentTask
    from app.modules.assessment.assessment_task.handlers.cancel_task import cancel_task_handler
    from app.modules.assessment.assessment_task.handlers.update_task_opinion import update_task_opinion_handler
    from app.modules.assessment.assessment_task.schemas import TaskCancel

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    case = AssessmentCase(
        center_id=center_id, case_code="ACASE01", counselor_id=actor_id, status="processing",
    )
    test_session.add(case)
    await test_session.flush()
    task = AssessmentTask(
        center_id=center_id, case_id=case.id, assessment_id="assess-1",
        execution_method="onsite", status="pending",
    )
    test_session.add(task)
    await test_session.flush()
    task_id = task.id

    # update opinion → updated atomic
    await update_task_opinion_handler(
        event_group_id=str(uuid4()), center_id=center_id, task_id=task_id,
        opinion="양호함", uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].entity_name == "assessment_task"
    assert u_atomics[0].payload["input"] == {"opinion": "양호함"}
    assert u_atomics[0].payload["result"]["opinion"] == "양호함"

    # cancel → cancelled atomic
    await cancel_task_handler(
        event_group_id=str(uuid4()), task_id=task_id, center_id=center_id,
        data=TaskCancel(reason="중단"), uow=uow, actor_id=actor_id,
    )
    x_atomics, x_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="cancelled",
    )
    assert x_page["total"] == 1
    assert x_atomics[0].entity_id == task_id
    assert x_atomics[0].payload["data"]["status"] == "cancelled"

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=task_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["updated"] == ("assessment", "검사 과제 수정")
    assert acts["cancelled"] == ("assessment", "검사 과제 취소")


@pytest.mark.asyncio
async def test_assessment_set_deleted_emits_atomic(test_session):
    from app.modules.assessment.assessment_set.models import AssessmentSet
    from app.modules.assessment.assessment_set.handlers.delete_set import delete_set_handler

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    aset = AssessmentSet(center_id=center_id, name="기초 세트", assessment_summary=[])
    test_session.add(aset)
    await test_session.flush()
    set_id = aset.id

    await delete_set_handler(
        event_group_id=str(uuid4()), center_id=center_id, set_id=set_id,
        uow=uow, actor_id=actor_id,
    )
    d_atomics, d_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deleted",
    )
    assert d_page["total"] == 1
    assert d_atomics[0].entity_name == "assessment_set"
    assert d_atomics[0].entity_id == set_id
    assert d_atomics[0].payload["data"]["name"] == "기초 세트"

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=set_id)
    assert listed.items[0].category == "assessment"
    assert listed.items[0].summary == "검사 세트 삭제"


@pytest.mark.asyncio
async def test_assessment_session_lifecycle_emit_atomics(test_session):
    from app.modules.assessment.assessment_case.models import AssessmentCase
    from app.modules.assessment.assessment_session.handlers.create_assessment_session import create_assessment_session_handler
    from app.modules.assessment.assessment_session.handlers.update_assessment_session import update_assessment_session_handler
    from app.modules.assessment.assessment_session.handlers.cancel_assessment_session import cancel_assessment_session_handler
    from app.modules.assessment.assessment_session.schemas import (
        AssessmentSessionCreate,
        AssessmentSessionUpdate,
        SessionStatus,
    )

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    case = AssessmentCase(
        center_id=center_id, case_code="ACASE02", counselor_id=actor_id, status="processing",
    )
    test_session.add(case)
    await test_session.flush()

    # create → created atomic
    created = await create_assessment_session_handler(
        event_group_id=str(uuid4()), center_id=center_id, case_id=case.id,
        data=AssessmentSessionCreate(schedule_id="sched-X"), uow=uow, actor_id=actor_id,
    )
    sess_id = created.id
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "assessment_session"
    assert c_atomics[0].actor_id == actor_id

    # update → updated atomic
    await update_assessment_session_handler(
        event_group_id=str(uuid4()), center_id=center_id, session_id=sess_id,
        data=AssessmentSessionUpdate(status=SessionStatus.NO_SHOW), uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].payload["input"] == {"status": "no_show"}
    assert u_atomics[0].payload["result"]["status"] == "no_show"

    # cancel → cancelled atomic
    await cancel_assessment_session_handler(
        event_group_id=str(uuid4()), center_id=center_id, session_id=sess_id,
        uow=uow, actor_id=actor_id, cancel_reason="사정",
    )
    x_atomics, x_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="cancelled",
    )
    assert x_page["total"] == 1
    assert x_atomics[0].entity_id == sess_id
    assert x_atomics[0].payload["data"]["cancel_reason"] == "사정"

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=sess_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["created"] == ("assessment", "검사 세션 생성")
    assert acts["updated"] == ("assessment", "검사 세션 수정")
    assert acts["cancelled"] == ("assessment", "검사 세션 취소")


@pytest.mark.asyncio
async def test_client_link_request_created_emits_atomic(test_session):
    from datetime import datetime
    from app.modules.client.link.handlers.create_link_request import create_link_request_handler
    from app.modules.client.link.schemas import ClientLinkRequestCreate

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    created = await create_link_request_handler(
        event_group_id=str(uuid4()),
        data=ClientLinkRequestCreate(
            person_id="person-1", phone="010-1234-5678", requested_at=datetime(2026, 6, 1, 9, 0),
        ),
        center_id=center_id, uow=uow, actor_id=actor_id,
    )
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "client_link_request"
    assert c_atomics[0].entity_id == created.id
    assert c_atomics[0].payload["data"]["person_id"] == "person-1"

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=created.id)
    assert listed.items[0].category == "client"
    assert listed.items[0].summary == "내담자 연동 요청 생성"


@pytest.mark.asyncio
async def test_client_deactivate_emits_atomic(test_session):
    from app.modules.client.profile.models import Client
    from app.modules.client.profile.handlers.deactivate_client import deactivate_client_handler

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    client = Client(center_id=center_id, code="C00001", role="child", name="홍길동", status="active")
    test_session.add(client)
    await test_session.flush()
    client_id = client.id

    await deactivate_client_handler(
        event_group_id=str(uuid4()), center_id=center_id, client_id=client_id,
        uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deactivated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].entity_name == "client"
    assert u_atomics[0].entity_id == client_id
    assert u_atomics[0].payload["data"]["status"] == "inactive"

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=client_id)
    assert listed.items[0].category == "client"
    assert listed.items[0].summary == "내담자 비활성화"


@pytest.mark.asyncio
async def test_room_crud_emit_atomics(test_session):
    from app.modules.center.room.handlers.create_room import create_room_handler
    from app.modules.center.room.handlers.update_room import update_room_handler
    from app.modules.center.room.handlers.delete_room import delete_room_handler
    from app.modules.center.room.schemas import RoomCreate, RoomUpdate

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    created = await create_room_handler(
        event_group_id=str(uuid4()), center_id=center_id,
        data=RoomCreate(name="1번 상담실"), uow=uow, actor_id=actor_id,
    )
    room_id = created.id
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "room"
    assert c_atomics[0].payload["data"]["name"] == "1번 상담실"

    await update_room_handler(
        event_group_id=str(uuid4()), center_id=center_id, room_id=room_id,
        data=RoomUpdate(name="2번 상담실"), uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].payload["input"] == {"name": "2번 상담실"}
    assert u_atomics[0].payload["result"]["name"] == "2번 상담실"

    await delete_room_handler(
        event_group_id=str(uuid4()), center_id=center_id, room_id=room_id,
        uow=uow, actor_id=actor_id,
    )
    d_atomics, d_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deleted",
    )
    assert d_page["total"] == 1
    assert d_atomics[0].entity_id == room_id

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=room_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["created"] == ("center", "상담실 생성")
    assert acts["updated"] == ("center", "상담실 수정")
    assert acts["deleted"] == ("center", "상담실 삭제")


@pytest.mark.asyncio
async def test_program_crud_emit_atomics(test_session):
    from app.modules.center.program.handlers.create_program import create_program_handler
    from app.modules.center.program.handlers.update_program import update_program_handler
    from app.modules.center.program.handlers.delete_program import delete_program_handler
    from app.modules.center.program.schemas import ProgramCreate, ProgramUpdate, ProgramType

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    created = await create_program_handler(
        event_group_id=str(uuid4()), center_id=center_id,
        data=ProgramCreate(
            name="언어치료", member_ids=["m1"], program_type=ProgramType.INDIVIDUAL,
            price=30000, duration_minutes=50,
        ),
        uow=uow, actor_id=actor_id,
    )
    prog_id = created.id
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "program"
    assert c_atomics[0].payload["data"]["name"] == "언어치료"

    await update_program_handler(
        event_group_id=str(uuid4()), center_id=center_id, program_id=prog_id,
        data=ProgramUpdate(name="놀이치료"), uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].payload["input"] == {"name": "놀이치료"}
    assert u_atomics[0].payload["result"]["name"] == "놀이치료"

    await delete_program_handler(
        event_group_id=str(uuid4()), center_id=center_id, program_id=prog_id,
        uow=uow, actor_id=actor_id,
    )
    d_atomics, d_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deleted",
    )
    assert d_page["total"] == 1
    assert d_atomics[0].entity_id == prog_id

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=prog_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["created"] == ("program", "프로그램 생성")
    assert acts["updated"] == ("program", "프로그램 수정")
    assert acts["deleted"] == ("program", "프로그램 삭제")


@pytest.mark.asyncio
async def test_center_update_emits_atomic(test_session):
    from app.modules.center.center.models import Center
    from app.modules.center.center.handlers.update_center import update_center_handler
    from app.modules.center.center.schemas import CenterUpdate

    uow = UnitOfWork(test_session)
    actor_id = "member-1"
    center = Center(name="옛이름", code="CEN001", is_active=True)
    test_session.add(center)
    await test_session.flush()
    center_id = center.id

    await update_center_handler(
        event_group_id=str(uuid4()), center_id=center_id,
        data=CenterUpdate(name="새이름"), uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].entity_name == "center"
    assert u_atomics[0].payload["input"] == {"name": "새이름"}
    assert u_atomics[0].payload["result"]["name"] == "새이름"

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=center_id)
    assert listed.items[0].summary == "센터 수정"


@pytest.mark.asyncio
async def test_member_update_emits_atomic(test_session):
    from app.modules.center.member.models import Member
    from app.modules.center.member.handlers.update_member import update_member_handler
    from app.modules.center.member.schemas import MemberUpdate

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"
    member = Member(
        center_id=center_id, person_id="person-1", role_id="role-1",
        status="active", employment_type="FULLTIME",
    )
    test_session.add(member)
    await test_session.flush()
    member_id = member.id

    await update_member_handler(
        event_group_id=str(uuid4()), center_id=center_id, member_id=member_id,
        data=MemberUpdate(memo="신규메모"), uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].entity_name == "member"
    assert u_atomics[0].payload["input"] == {"memo": "신규메모"}
    assert u_atomics[0].payload["result"]["memo"] == "신규메모"

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=member_id)
    assert listed.items[0].summary == "구성원 수정"


@pytest.mark.asyncio
async def test_member_invitation_cancel_emits_atomic(test_session):
    from datetime import datetime
    from app.modules.center.member_invitation.models import MemberInvitation
    from app.modules.center.member_invitation.handlers.cancel_member_invitation import (
        cancel_member_invitation_handler,
    )

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"
    invitation = MemberInvitation(
        invited_by=actor_id, center_id=center_id, role_id="role-1",
        name="신규자", email="new@example.com", expires_at=datetime(2030, 1, 1),
    )
    test_session.add(invitation)
    await test_session.flush()
    inv_id = invitation.id

    await cancel_member_invitation_handler(
        event_group_id=str(uuid4()), center_id=center_id, invitation_id=inv_id,
        uow=uow, actor_id=actor_id,
    )
    x_atomics, x_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="cancelled",
    )
    assert x_page["total"] == 1
    assert x_atomics[0].entity_name == "member_invitation"
    assert x_atomics[0].entity_id == inv_id
    assert x_atomics[0].payload["data"]["email"] == "new@example.com"

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=inv_id)
    assert listed.items[0].summary == "구성원 초대 취소"


@pytest.mark.asyncio
async def test_member_non_working_time_crud_emit_atomics(test_session):
    from app.modules.center.member_non_working_time.handlers.create_member_non_working_time import (
        create_member_non_working_time_handler,
    )
    from app.modules.center.member_non_working_time.handlers.update_member_non_working_time import (
        update_member_non_working_time_handler,
    )
    from app.modules.center.member_non_working_time.handlers.delete_member_non_working_time import (
        delete_member_non_working_time_handler,
    )
    from app.modules.center.member_non_working_time.schemas import (
        MemberNonWorkingTimeCreate,
        MemberNonWorkingTimeUpdate,
        MemberNonWorkingTimeReason,
    )

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    created = await create_member_non_working_time_handler(
        event_group_id=str(uuid4()), center_id=center_id, member_id="member-9",
        data=MemberNonWorkingTimeCreate(year=2026, month=6, day=1, reason=MemberNonWorkingTimeReason.ANNUAL_LEAVE),
        confirm=True, uow=uow, actor_id=actor_id,
    )
    nwt_id = created.id
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "member_non_working_time"

    await update_member_non_working_time_handler(
        event_group_id=str(uuid4()), center_id=center_id, member_id="member-9",
        non_working_time_id=nwt_id,
        data=MemberNonWorkingTimeUpdate(reason=MemberNonWorkingTimeReason.SICK_LEAVE),
        confirm=True, uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].payload["input"] == {"reason": "SICK_LEAVE"}

    await delete_member_non_working_time_handler(
        event_group_id=str(uuid4()), center_id=center_id, member_id="member-9",
        non_working_time_id=nwt_id, uow=uow, actor_id=actor_id,
    )
    d_atomics, d_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deleted",
    )
    assert d_page["total"] == 1
    assert d_atomics[0].entity_id == nwt_id

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=nwt_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["created"] == ("center", "비근무 시간 생성")
    assert acts["updated"] == ("center", "비근무 시간 수정")
    assert acts["deleted"] == ("center", "비근무 시간 삭제")


@pytest.mark.asyncio
async def test_non_operating_time_crud_emit_atomics(test_session):
    from app.modules.center.center_non_operating_time.handlers.create_center_non_operating_time import (
        create_center_non_operating_time_handler,
    )
    from app.modules.center.center_non_operating_time.handlers.update_center_non_operating_time import (
        update_center_non_operating_time_handler,
    )
    from app.modules.center.center_non_operating_time.handlers.delete_center_non_operating_time import (
        delete_center_non_operating_time_handler,
    )
    from app.modules.center.center_non_operating_time.schemas import (
        NonOperatingTimeCreate,
        NonOperatingTimeUpdate,
    )

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    created = await create_center_non_operating_time_handler(
        event_group_id=str(uuid4()), center_id=center_id,
        data=NonOperatingTimeCreate(year=2026, month=6, day=1, reason="설날"),
        confirm=True, uow=uow, actor_id=actor_id, account_id="account-1",
    )
    nop_id = created.id
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "non_operating_time"

    await update_center_non_operating_time_handler(
        event_group_id=str(uuid4()), center_id=center_id, non_operating_time_id=nop_id,
        data=NonOperatingTimeUpdate(reason="추석"), confirm=True, uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].payload["input"] == {"reason": "추석"}

    await delete_center_non_operating_time_handler(
        event_group_id=str(uuid4()), center_id=center_id, non_operating_time_id=nop_id,
        uow=uow, actor_id=actor_id,
    )
    d_atomics, d_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deleted",
    )
    assert d_page["total"] == 1
    assert d_atomics[0].entity_id == nop_id

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=nop_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["created"] == ("center", "비운영 시간 생성")
    assert acts["updated"] == ("center", "비운영 시간 수정")
    assert acts["deleted"] == ("center", "비운영 시간 삭제")


@pytest.mark.asyncio
async def test_relation_unified_emit_atomics(test_session):
    from app.modules.client.profile.models import Client
    from app.modules.client.relation.handlers.create_relation import create_relation_handler
    from app.modules.client.relation.handlers.delete_relation import delete_relation_handler
    from app.modules.client.relation.schemas import RelationCreateRequest, RelationType

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    def _client(code, role, name):
        c = Client(center_id=center_id, code=code, role=role, name=name)
        test_session.add(c)
        return c

    child = _client("RCH001", "client", "아이")
    g1 = _client("RGD001", "guardian", "엄마")
    s1 = _client("RSB001", "client", "동생")
    await test_session.flush()

    # unified guardian → entity_name="relation"
    created = await create_relation_handler(
        event_group_id=str(uuid4()), center_id=center_id, client_id=child.id,
        data=RelationCreateRequest(
            relation_category="guardian", related_client_id=g1.id,
            relation_type=RelationType.GUARDIAN, is_primary=False,
        ),
        uow=uow, actor_id=actor_id,
    )
    rel_id = created.id
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "relation"
    assert c_atomics[0].entity_id == rel_id

    # unified delete → entity_name="relation"
    await delete_relation_handler(
        event_group_id=str(uuid4()), center_id=center_id, relation_id=rel_id,
        uow=uow, actor_id=actor_id,
    )
    d_atomics, d_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deleted",
    )
    assert d_page["total"] == 1
    assert d_atomics[0].entity_name == "relation"

    # unified sibling → entity_name="relation"
    sib = await create_relation_handler(
        event_group_id=str(uuid4()), center_id=center_id, client_id=child.id,
        data=RelationCreateRequest(relation_category="sibling", related_client_id=s1.id),
        uow=uow, actor_id=actor_id,
    )

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=rel_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["created"] == ("client", "관계 생성")
    assert acts["deleted"] == ("client", "관계 삭제")
    sib_listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=sib.id)
    assert sib_listed.items[0].summary == "관계 생성"


@pytest.mark.asyncio
async def test_schedule_create_update_emit_atomics(test_session):
    from datetime import datetime
    from app.application.handlers.schedule.create_schedule import create_schedule_handler
    from app.application.handlers.schedule.update_schedule import update_schedule_handler
    from app.modules.schedule.schedule.schemas import ScheduleCreate, ScheduleUpdate, ScheduleType

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    created = await create_schedule_handler(
        event_group_id=str(uuid4()), center_id=center_id,
        data=ScheduleCreate(
            schedule_type=ScheduleType.MEETING, title="주간회의",
            start=datetime(2026, 6, 1, 10, 0), end=datetime(2026, 6, 1, 11, 0),
        ),
        uow=uow, actor_id=actor_id,
    )
    sch_id = created.id
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "schedule"
    assert c_atomics[0].payload["data"]["title"] == "주간회의"

    await update_schedule_handler(
        event_group_id=str(uuid4()), center_id=center_id, schedule_id=sch_id,
        data=ScheduleUpdate(title="월간회의"), uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].payload["input"] == {"title": "월간회의"}
    assert u_atomics[0].payload["result"]["title"] == "월간회의"

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=sch_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["created"] == ("schedule", "일정 생성")
    assert acts["updated"] == ("schedule", "일정 수정")


@pytest.mark.asyncio
async def test_counseling_session_delete_app_emit_atomic(test_session):
    from fastapi import BackgroundTasks
    from app.modules.counseling.counseling_case.models import CounselingCase
    from app.modules.counseling.counseling_session.models import CounselingSession
    from app.application.handlers.counseling.delete_session import delete_session_handler

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    case = CounselingCase(
        center_id=center_id, program_id="prog-1", counselor_id=actor_id, case_code="DCASE1",
        status="active",
    )
    test_session.add(case)
    await test_session.flush()
    session = CounselingSession(
        center_id=center_id, counseling_case_id=case.id, schedule_id="sched-del-1", status="scheduled",
    )
    test_session.add(session)
    await test_session.flush()
    sess_id = session.id

    await delete_session_handler(
        event_group_id=str(uuid4()), session_id=sess_id, center_id=center_id,
        owner_scope=None, uow=uow, actor_id=actor_id,
    )
    d_atomics, d_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deleted",
    )
    assert d_page["total"] == 1
    assert d_atomics[0].entity_name == "counseling_session"
    assert d_atomics[0].entity_id == sess_id

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=sess_id)
    assert listed.items[0].summary == "상담 세션 삭제"


@pytest.mark.asyncio
async def test_field_note_create_app_emit_atomic(test_session):
    from app.application.handlers.field_note.create_field_note import create_field_note_handler

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    created = await create_field_note_handler(
        event_group_id=str(uuid4()), center_id=center_id, author_id=actor_id,
        uow=uow, actor_id=actor_id,
    )
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "field_note"
    assert c_atomics[0].entity_id == created.id

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=created.id)
    assert listed.items[0].summary == "현장노트 생성"


@pytest.mark.asyncio
async def test_client_voucher_create_app_emit_atomic(test_session):
    from app.modules.client.profile.models import Client
    from app.modules.voucher.center_voucher.models import CenterVoucher
    from app.application.handlers.voucher.create_client_voucher import create_client_voucher_handler
    from app.modules.voucher.client_voucher.schemas import ClientVoucherCreate

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    client = Client(center_id=center_id, code="CV0001", role="client", name="아이")
    test_session.add(client)
    cv = CenterVoucher(center_id=center_id, catalog_id="cat-1", created_by="acc-1")
    test_session.add(cv)
    await test_session.flush()

    created = await create_client_voucher_handler(
        event_group_id=str(uuid4()), center_id=center_id, account_id="acc-1",
        data=ClientVoucherCreate(client_id=client.id, center_voucher_id=cv.id, total_sessions=10),
        uow=uow, actor_id=actor_id,
    )
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "client_voucher"
    assert c_atomics[0].entity_id == created.id

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=created.id)
    assert listed.items[0].summary == "내담자 바우처 생성"


@pytest.mark.asyncio
async def test_assessment_set_create_update_app_emit_atomics(test_session):
    from app.application.handlers.assessment.create_set import create_set_handler
    from app.application.handlers.assessment.update_set import update_set_handler
    from app.modules.assessment.assessment_set.schemas import AssessmentSetCreate, AssessmentSetUpdate

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    created = await create_set_handler(
        event_group_id=str(uuid4()), center_id=center_id,
        data=AssessmentSetCreate(name="기초세트", assessment_ids=["a1"]),
        uow=uow, actor_id=actor_id,
    )
    set_id = created.id
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "assessment_set"
    assert c_atomics[0].payload["data"]["name"] == "기초세트"

    await update_set_handler(
        event_group_id=str(uuid4()), center_id=center_id, set_id=set_id,
        data=AssessmentSetUpdate(name="심화세트"), uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].payload["input"] == {"name": "심화세트"}
    assert u_atomics[0].payload["result"]["name"] == "심화세트"

    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=set_id)
    acts = {item.action: (item.category, item.summary) for item in listed.items}
    assert acts["created"] == ("assessment", "검사 세트 생성")
    assert acts["updated"] == ("assessment", "검사 세트 수정")


@pytest.mark.asyncio
async def test_member_status_and_delete_app_emit_atomics(test_session):
    from app.modules.center.member.models import Member
    from app.application.handlers.center.deactivate_member import deactivate_member_handler
    from app.application.handlers.center.delete_member import delete_member_handler

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    m1 = Member(center_id=center_id, person_id="p1", role_id="role-x", status="active", employment_type="FULLTIME")
    m2 = Member(center_id=center_id, person_id="p2", role_id="role-x", status="active", employment_type="FULLTIME")
    test_session.add(m1)
    test_session.add(m2)
    await test_session.flush()

    await deactivate_member_handler(
        event_group_id=str(uuid4()), center_id=center_id, member_id=m1.id,
        uow=uow, actor_id=actor_id,
    )
    u_atomics, u_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert u_page["total"] == 1
    assert u_atomics[0].entity_name == "member"
    assert u_atomics[0].payload["input"] == {"status": "inactive"}

    await delete_member_handler(
        event_group_id=str(uuid4()), center_id=center_id, member_id=m2.id,
        uow=uow, actor_id=actor_id,
    )
    d_atomics, d_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="deleted",
    )
    assert d_page["total"] == 1
    assert d_atomics[0].entity_name == "member"
    assert d_atomics[0].entity_id == m2.id

    listed_u = await list_activity_handler(uow=uow, center_id=center_id, entity_id=m1.id)
    assert listed_u.items[0].summary == "구성원 수정"
    listed_d = await list_activity_handler(uow=uow, center_id=center_id, entity_id=m2.id)
    assert listed_d.items[0].summary == "구성원 삭제"


@pytest.mark.asyncio
async def test_member_invitation_create_app_emit_atomic(test_session):
    from fastapi import BackgroundTasks
    from app.modules.center.center.models import Center
    from app.modules.role.role.models import Role
    from app.application.handlers.center.create_member_invitation import create_member_invitation_handler
    from app.modules.center.member_invitation.schemas import (
        MemberInvitationCreate, RoleCode, EmploymentType,
    )

    uow = UnitOfWork(test_session)
    actor_id = "member-1"
    center = Center(name="센터", code="CEN999", is_active=True)
    test_session.add(center)
    await test_session.flush()
    test_session.add(Role(center_id=center.id, code="MANAGER", name="매니저"))
    await test_session.flush()

    created = await create_member_invitation_handler(
        event_group_id=str(uuid4()), center_id=center.id,
        data=MemberInvitationCreate(
            name="신규", email="x@example.com", role_code=RoleCode.MANAGER,
            employment_type=EmploymentType.FULLTIME,
        ),
        invited_by="account-1", uow=uow, actor_id=actor_id,
    )
    c_atomics, c_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center.id, act="created",
    )
    assert c_page["total"] == 1
    assert c_atomics[0].entity_name == "member_invitation"
    assert c_atomics[0].entity_id == created.id

    listed = await list_activity_handler(uow=uow, center_id=center.id, entity_id=created.id)
    assert listed.items[0].summary == "구성원 초대 생성"


@pytest.mark.asyncio
async def test_billing_app_emit_atomics(test_session):
    from datetime import date as date_type
    from app.modules.billing.billable.models import Billable
    from app.application.handlers.billing.create_billable import create_billable_handler
    from app.application.handlers.billing.update_billable import update_billable_handler
    from app.application.handlers.billing.complete_billable import complete_billable_handler
    from app.modules.billing.billable.schemas import (
        BillableCreate, BillableItemCreate, BillableItemType, BillableUpdate,
    )

    uow = UnitOfWork(test_session)
    center_id = "center-1"
    actor_id = "member-1"

    # create_billable (voucher 미연결 → consume no-op)
    bill = await create_billable_handler(
        event_group_id=str(uuid4()), center_id=center_id, account_id="acc-1",
        data=BillableCreate(
            client_id="client-1", billable_date=date_type(2026, 6, 1),
            items=[BillableItemCreate(item_type=BillableItemType.SERVICE, description="상담", unit_price=50000)],
        ),
        uow=uow, actor_id=actor_id,
    )
    cb_atomics, cb_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="created",
    )
    assert cb_page["total"] == 1
    assert cb_atomics[0].entity_name == "billable"

    # update_billable (memo 변경)
    bobj = Billable(
        center_id=center_id, client_id="client-1", billable_date=date_type(2026, 6, 2),
        total_amount=100000, paid_amount=0, unpaid_amount=100000, status="issued", created_by="acc-1",
    )
    test_session.add(bobj)
    await test_session.flush()
    await update_billable_handler(
        event_group_id=str(uuid4()), center_id=center_id, billable_id=bobj.id,
        data=BillableUpdate(memo="수정메모"), uow=uow, actor_id=actor_id,
    )
    ub_atomics, ub_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert ub_page["total"] == 1
    assert ub_atomics[0].entity_name == "billable"
    assert ub_atomics[0].payload["input"] == {"memo": "수정메모"}

    # complete_billable (완납 처리)
    await complete_billable_handler(
        event_group_id=str(uuid4()), center_id=center_id, billable_id=bobj.id,
        uow=uow, actor_id=actor_id,
    )
    us_atomics, us_page = await EventAtomicRepository(test_session).list_audit_in_center_with_page(
        center_id=center_id, act="updated",
    )
    assert us_page["total"] == 2
    listed = await list_activity_handler(uow=uow, center_id=center_id, entity_id=bobj.id)
    acts = {item.action for item in listed.items}
    assert "updated" in acts
    assert listed.items[0].category == "billing"
