from datetime import date
from types import SimpleNamespace
from typing import get_type_hints
from unittest.mock import AsyncMock

import app.application.handlers.field_note.generate_counseling_note as note_module
import app.application.handlers.center_application.approve_center_application_app as approval_module
import app.modules.center.facade.member_facade as member_module
import app.modules.center.facade.member_non_working_time_facade as non_working_module
import app.modules.center.facade.operating_time_facade as operating_module
import app.modules.center.facade.room_facade as room_module
import app.modules.client.facade.profile_facade as profile_module
import app.modules.llm.facade.credit_facade as credit_module
import app.modules.role.facade.role_facade as role_module
from app.core.type import unset
from app.modules.role.role_permission.services.copy_role_permissions_from_global import (
    CopyRolePermissionsFromGlobalService,
)


async def test_operating_time_initializer_passes_through_service_result(monkeypatch):
    expected = (object(), [object()])
    execute = AsyncMock(return_value=expected)
    monkeypatch.setattr(
        operating_module,
        "BulkUpdateOperatingTimesService",
        lambda repo: SimpleNamespace(execute=execute),
    )
    uow = SimpleNamespace(repo=lambda repo_type: object())

    result = await operating_module.OperatingTimeFacade(
        uow
    ).initialize_default_operating_times("center-1")

    assert result == expected


async def test_copy_role_permissions_returns_role_atomic():
    repo = SimpleNamespace(copy_permissions=AsyncMock())
    role = SimpleNamespace(id="role-1")

    atomic, returned_role = await CopyRolePermissionsFromGlobalService(repo).execute(
        "global-role-1",
        role,
    )

    assert returned_role is role
    assert atomic.act() == "updated"
    assert atomic._changed == {
        "permissions_copied_from_role_id": "global-role-1"
    }


async def test_role_initializer_returns_create_and_permission_atomics(monkeypatch):
    global_role = SimpleNamespace(
        id="global-role-1",
        code="ADMIN",
        name="관리자",
        description=None,
        access_level="all",
    )
    role = SimpleNamespace(id="role-1")
    role_atomic = object()
    permission_atomic = object()
    monkeypatch.setattr(
        role_module,
        "ListGlobalRolesService",
        lambda repo: SimpleNamespace(
            execute=AsyncMock(return_value=[global_role])
        ),
    )
    monkeypatch.setattr(
        role_module,
        "CreateRoleService",
        lambda repo: SimpleNamespace(
            execute=AsyncMock(return_value=(role_atomic, role))
        ),
    )
    monkeypatch.setattr(
        role_module,
        "CopyRolePermissionsFromGlobalService",
        lambda repo: SimpleNamespace(
            execute=AsyncMock(return_value=(permission_atomic, role))
        ),
    )
    uow = SimpleNamespace(repo=lambda repo_type: object())

    atomics, count = await role_module.RoleFacade(
        uow
    ).initialize_center_roles_and_permissions("center-1")

    assert atomics == [role_atomic, permission_atomic]
    assert count == 1


async def test_find_balance_returns_rollover_atomics(monkeypatch):
    balance = object()
    atomic = object()
    monkeypatch.setattr(
        credit_module,
        "FindActiveBalanceService",
        lambda repo: SimpleNamespace(execute=AsyncMock(return_value=None)),
    )
    monkeypatch.setattr(
        credit_module,
        "RollCreditPeriodService",
        lambda repo: SimpleNamespace(
            execute=AsyncMock(return_value=(atomic, balance))
        ),
    )
    uow = SimpleNamespace(repo=lambda repo_type: object())

    atomics, found = await credit_module.CreditFacade(uow).find_balance("center-1")

    assert atomics == [atomic]
    assert found is balance


async def test_room_facade_passes_explicit_null_and_omits_unset(monkeypatch):
    execute = AsyncMock(return_value=(object(), object()))
    monkeypatch.setattr(
        room_module,
        "UpdateRoomService",
        lambda repo: SimpleNamespace(execute=execute),
    )

    await room_module.RoomFacade(
        SimpleNamespace(repo=lambda repo_type: object())
    ).update_room(
        room_id="room-1",
        center_id="center-1",
        description=None,
    )

    assert execute.await_args.kwargs["description"] is None
    assert execute.await_args.kwargs["memo"] is unset
    assert execute.await_args.kwargs["changed"] == {"description": None}


async def test_member_facade_passes_explicit_null_and_resolves_date_annotation(
    monkeypatch,
):
    execute = AsyncMock(return_value=(object(), object()))
    monkeypatch.setattr(
        member_module,
        "UpdateMemberService",
        lambda repo: SimpleNamespace(execute=execute),
    )

    await member_module.MemberFacade(
        SimpleNamespace(repo=lambda repo_type: object())
    ).update_member(
        member_id="member-1",
        center_id="center-1",
        hire_date=date(2026, 7, 15),
        memo=None,
    )

    assert execute.await_args.kwargs["memo"] is None
    assert execute.await_args.kwargs["hire_date"] == date(2026, 7, 15)
    assert execute.await_args.kwargs["changed"] == {
        "hire_date": "2026-07-15",
        "memo": None,
    }
    assert "date" in str(get_type_hints(member_module.MemberFacade.update_member)["hire_date"])


async def test_profile_facade_passes_explicit_null_and_omits_unset(monkeypatch):
    execute = AsyncMock(return_value=(object(), object()))
    monkeypatch.setattr(
        profile_module,
        "UpdateClientService",
        lambda repo: SimpleNamespace(execute=execute),
    )

    await profile_module.ProfileFacade(
        SimpleNamespace(repo=lambda repo_type: object())
    ).update_client(
        center_id="center-1",
        client_id="client-1",
        phone=None,
    )

    assert execute.await_args.kwargs["phone"] is None
    assert execute.await_args.kwargs["email"] is unset
    assert execute.await_args.kwargs["changed"] == {"phone": None}


async def test_non_working_facade_passes_explicit_null_and_omits_unset(
    monkeypatch,
):
    execute = AsyncMock(return_value=(object(), object()))
    monkeypatch.setattr(
        non_working_module,
        "UpdateMemberNonWorkingTimeService",
        lambda repo: SimpleNamespace(execute=execute),
    )

    await non_working_module.MemberNonWorkingTimeFacade(
        SimpleNamespace(repo=lambda repo_type: object())
    ).update(
        member_id="member-1",
        non_working_time_id="non-working-1",
        description=None,
    )

    assert execute.await_args.kwargs["description"] is None
    assert execute.await_args.kwargs["effective_to"] is unset
    assert execute.await_args.kwargs["changed"] == {"description": None}


async def test_center_approval_emits_every_bootstrap_atomic(monkeypatch):
    center_atomic = object()
    application_atomic = object()
    assessment_atomic = object()
    role_atomics = [object(), object()]
    operating_atomic = object()
    subscription_atomic = object()
    credit_atomic = object()
    member_atomic = object()
    application = SimpleNamespace(
        center_id="center-1",
        created_by="account-1",
    )
    center_application = SimpleNamespace(
        approve_application=AsyncMock(
            return_value=([center_atomic, application_atomic], application)
        )
    )
    assessment = SimpleNamespace(
        initialize_center_assessments=AsyncMock(
            return_value=([assessment_atomic], [])
        )
    )
    role = SimpleNamespace(
        initialize_center_roles_and_permissions=AsyncMock(
            return_value=(role_atomics, 1)
        ),
        find_role_by_center_and_code=AsyncMock(
            return_value=SimpleNamespace(id="role-1")
        ),
    )
    operating = SimpleNamespace(
        initialize_default_operating_times=AsyncMock(
            return_value=(operating_atomic, [])
        )
    )
    subscription = SimpleNamespace(
        create_trial=AsyncMock(
            return_value=(
                subscription_atomic,
                SimpleNamespace(
                    plan="pro",
                    current_period_start=object(),
                    current_period_end=object(),
                ),
            )
        )
    )
    credit = SimpleNamespace(
        initialize_credit=AsyncMock(return_value=(credit_atomic, object()))
    )
    person = SimpleNamespace(
        find_person_by_account=AsyncMock(
            return_value=SimpleNamespace(id="person-1")
        )
    )
    member = SimpleNamespace(
        create_center_admin_member=AsyncMock(
            return_value=(member_atomic, object())
        )
    )
    emit = AsyncMock()
    monkeypatch.setattr(
        approval_module,
        "CenterApplicationFacade",
        lambda uow: center_application,
    )
    monkeypatch.setattr(approval_module, "AssessmentFacade", lambda uow: assessment)
    monkeypatch.setattr(approval_module, "RoleFacade", lambda uow: role)
    monkeypatch.setattr(approval_module, "OperatingTimeFacade", lambda uow: operating)
    monkeypatch.setattr(approval_module, "SubscriptionFacade", lambda uow: subscription)
    monkeypatch.setattr(approval_module, "CreditFacade", lambda uow: credit)
    monkeypatch.setattr(approval_module, "PersonFacade", lambda uow: person)
    monkeypatch.setattr(approval_module, "MemberFacade", lambda uow: member)
    monkeypatch.setattr(
        approval_module,
        "CenterApplicationResponse",
        SimpleNamespace(model_validate=lambda value: value),
    )
    monkeypatch.setattr(approval_module, "emit", emit)

    result = await approval_module.approve_center_application_app_handler(
        "application-1",
        "reviewer-1",
        object(),
        event_group_id="event-1",
    )

    assert result is application
    assert emit.await_args.kwargs["atomics"] == [
        center_atomic,
        application_atomic,
        assessment_atomic,
        *role_atomics,
        operating_atomic,
        subscription_atomic,
        credit_atomic,
        member_atomic,
    ]


async def test_note_precondition_failure_emits_prepare_and_clear_atomics(
    monkeypatch,
):
    note_atomic = object()
    clear_atomic = object()
    pipeline = SimpleNamespace(
        prepare_step=AsyncMock(
            return_value=(note_atomic, SimpleNamespace(status="started"))
        ),
        collect_note_data=AsyncMock(return_value={"schedule_id": "schedule-1"}),
    )
    counseling = SimpleNamespace(
        get_sessions_by_schedule_ids=AsyncMock(return_value=[])
    )
    field_note = SimpleNamespace(
        clear_note_status=AsyncMock(return_value=(clear_atomic, object()))
    )
    emit = AsyncMock()
    monkeypatch.setattr(note_module, "PipelineFacade", lambda uow: pipeline)
    monkeypatch.setattr(
        note_module,
        "CounselingSessionFacade",
        lambda uow: counseling,
    )
    monkeypatch.setattr(note_module, "FieldNoteFacade", lambda uow: field_note)
    monkeypatch.setattr(note_module, "emit", emit)

    result = await note_module.generate_counseling_note_handler(
        "field-note-1",
        "center-1",
        "author-1",
        object(),
        event_group_id="event-1",
    )

    assert result.status == "precondition_not_met"
    assert emit.await_args.args[1] == "counseling_note_generation_rejected"
    assert emit.await_args.kwargs["atomics"] == [note_atomic, clear_atomic]
