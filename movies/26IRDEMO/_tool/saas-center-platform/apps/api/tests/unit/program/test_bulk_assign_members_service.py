from app.modules.center.program_member.repository import ProgramMemberRepository
from app.modules.center.program_member.services import (
    BulkAssignMembersService,
    AssignMembersService,
)


def _active_ids(members) -> set[str]:
    return {m.member_id for m in members if m.deleted_at is None}


async def test_sync_adds_new_members(test_session):
    repo = ProgramMemberRepository(test_session)
    service = BulkAssignMembersService(repo)

    atomics, result = await service.execute(
        program_id="prog-1", center_id="center-1", member_ids=["m1", "m2"]
    )

    assert _active_ids(result) == {"m1", "m2"}
    assert [a.act() for a in atomics] == ["assigned", "assigned"]
    assert _active_ids(await repo.list_by_program("prog-1")) == {"m1", "m2"}


async def test_sync_removes_missing_members(test_session):
    repo = ProgramMemberRepository(test_session)
    await AssignMembersService(repo).execute("prog-1", "center-1", ["m1", "m2", "m3"])

    atomics, _ = await BulkAssignMembersService(repo).execute(
        program_id="prog-1", center_id="center-1", member_ids=["m1"]
    )

    assert [a.act() for a in atomics] == ["unassigned", "unassigned"]
    assert _active_ids(await repo.list_by_program("prog-1")) == {"m1"}


async def test_sync_restores_soft_deleted(test_session):
    repo = ProgramMemberRepository(test_session)
    await AssignMembersService(repo).execute("prog-1", "center-1", ["m1"])
    # m1 해제
    await BulkAssignMembersService(repo).execute("prog-1", "center-1", [])
    assert _active_ids(await repo.list_by_program("prog-1")) == set()

    # m1 재배정 → soft-deleted 행 복원
    atomics, _ = await BulkAssignMembersService(repo).execute("prog-1", "center-1", ["m1"])

    assert [a.act() for a in atomics] == ["assigned"]
    active = await repo.list_by_program("prog-1")
    assert _active_ids(active) == {"m1"}
    # 동일 (program, member) 중복 활성 행이 없어야 함
    assert len([m for m in active if m.member_id == "m1"]) == 1


async def test_sync_empty_unassigns_all(test_session):
    repo = ProgramMemberRepository(test_session)
    await AssignMembersService(repo).execute("prog-1", "center-1", ["m1", "m2"])

    await BulkAssignMembersService(repo).execute("prog-1", "center-1", [])

    assert _active_ids(await repo.list_by_program("prog-1")) == set()


async def test_sync_is_idempotent(test_session):
    repo = ProgramMemberRepository(test_session)
    await BulkAssignMembersService(repo).execute("prog-1", "center-1", ["m1", "m2"])

    atomics, _ = await BulkAssignMembersService(repo).execute("prog-1", "center-1", ["m2", "m1"])

    assert atomics == []
    assert _active_ids(await repo.list_by_program("prog-1")) == {"m1", "m2"}
