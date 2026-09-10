"""UpdateRoleService 낙관적 동시성 가드 회귀 테스트.

expected_version 제공 시:
- version 일치 → 업데이트 + version 증가
- version 불일치(stale) → ConflictException

expected_version 생략 시:
- 기존 update_in_place 경로 유지 (back-compat)
"""

import pytest

from app.core.exceptions import ConflictException
from app.modules.role.role.services.update_role import UpdateRoleService


class FakeRole:
    def __init__(self, id, code, name, version, access_level="own", description=None):
        self.id = id
        self.code = code
        self.name = name
        self.version = version
        self.access_level = access_level
        self.description = description


class FakeRoleRepo:
    """update_with_version_guard의 WHERE version=expected 시맨틱을 인메모리로 모사."""

    def __init__(self, role: FakeRole):
        self.role = role
        self.update_in_place_calls = []

    async def get_by_id(self, role_id):
        return self.role

    async def update_with_version_guard(
        self, id, *, expected_version, name, description, access_level
    ):
        from app.core.type import unset

        if self.role.version != expected_version:
            return None  # version mismatch → no row matched

        if name is not unset:
            self.role.name = name
        if description is not unset:
            self.role.description = description
        if access_level is not unset:
            self.role.access_level = access_level
        self.role.version += 1
        return self.role

    async def update_in_place(self, id, *, name, description, access_level, version):
        from app.core.type import unset

        self.update_in_place_calls.append(version)
        if name is not unset:
            self.role.name = name
        self.role.version = version
        return self.role


@pytest.fixture
def role():
    return FakeRole(id="role-1", code="CUSTOM", name="원래이름", version=1)


@pytest.fixture
def repo(role):
    return FakeRoleRepo(role)


@pytest.fixture
def service(repo):
    return UpdateRoleService(repo)


class TestVersionGuard:
    async def test_concurrent_first_wins_second_conflicts(self, service, repo):
        # 첫 업데이트: expected_version=1 → 성공, version → 2
        _, updated = await service.execute(
            role_id="role-1", changed={"name": "새이름"}, name="새이름", expected_version=1
        )
        assert updated.version == 2
        assert updated.name == "새이름"

        # 두 번째 업데이트: stale expected_version=1 → 충돌
        with pytest.raises(ConflictException):
            await service.execute(
                role_id="role-1", changed={"name": "다른이름"}, name="다른이름", expected_version=1
            )

        # 충돌 후 상태는 첫 업데이트 그대로 유지
        assert repo.role.version == 2
        assert repo.role.name == "새이름"

    async def test_omitting_expected_version_still_updates(self, service, repo):
        # back-compat: expected_version 없으면 update_in_place 경로
        _, updated = await service.execute(role_id="role-1", changed={"name": "새이름"}, name="새이름")
        assert updated.name == "새이름"
        assert updated.version == 2  # role.version + 1
        assert repo.update_in_place_calls == [2]
