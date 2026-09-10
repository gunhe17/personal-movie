"""UpdateClientService Unit Tests"""
import pytest

from app.core.exceptions import EntityNotFoundException
from app.modules.client.profile.services import UpdateClientService, CreateClientService
from app.modules.client.profile.repository import ClientRepository
from app.modules.client.profile.schemas import ClientCreate, ClientUpdate, ClientRole, ClientStatus


async def test_update_client_success(test_session):
    """Client 수정 성공 테스트"""
    # Given: Client 생성
    repo = ClientRepository(test_session)
    create_service = CreateClientService(repo)
    update_service = UpdateClientService(repo)

    client_data = ClientCreate(
        role=ClientRole.CLIENT,
        name="김아이",
        phone="010-1234-5678",
    )
    _, created_client = await create_service.execute(center_id="center-1", **client_data.model_dump())

    # When: Client 수정
    update_data = ClientUpdate(
        name="김철수",
        phone="010-9999-9999",
        status=ClientStatus.INACTIVE
    )
    _, updated_client = await update_service.execute(
        center_id="center-1", client_id=created_client.id,
        changed=update_data.model_dump(mode="json", exclude_unset=True),
        **update_data.model_dump(exclude_unset=True),
    )

    # Then
    assert updated_client.name == "김철수"
    assert updated_client.phone == "010-9999-9999"
    assert updated_client.status == "inactive"


async def test_update_client_not_found(test_session):
    """존재하지 않는 Client 수정 시 에러 테스트"""
    # Given
    repo = ClientRepository(test_session)
    service = UpdateClientService(repo)

    update_data = ClientUpdate(name="김철수")

    # When & Then
    with pytest.raises(EntityNotFoundException, match="찾을 수 없습니다"):
        await service.execute(
            center_id="center-1", client_id="nonexistent-id",
            changed=update_data.model_dump(mode="json", exclude_unset=True),
            **update_data.model_dump(exclude_unset=True),
        )


async def test_update_client_wrong_center(test_session):
    """다른 센터의 Client 수정 시도 시 에러 테스트"""
    # Given: 센터 1에 Client 생성
    repo = ClientRepository(test_session)
    create_service = CreateClientService(repo)
    update_service = UpdateClientService(repo)

    client_data = ClientCreate(
        role=ClientRole.CLIENT,
        name="김아이",
    )
    _, created_client = await create_service.execute(center_id="center-1", **client_data.model_dump())

    # When: 센터 2에서 수정 시도
    update_data = ClientUpdate(name="김철수")

    with pytest.raises(EntityNotFoundException, match="찾을 수 없습니다"):
        await update_service.execute(
            center_id="center-2", client_id=created_client.id,
            changed=update_data.model_dump(mode="json", exclude_unset=True),
            **update_data.model_dump(exclude_unset=True),
        )  # 센터 2


async def test_update_client_no_changes(test_session):
    """변경사항 없는 수정 요청 테스트"""
    # Given
    repo = ClientRepository(test_session)
    create_service = CreateClientService(repo)
    update_service = UpdateClientService(repo)

    client_data = ClientCreate(
        role=ClientRole.CLIENT,
        name="김아이",
    )
    _, created_client = await create_service.execute(center_id="center-1", **client_data.model_dump())

    # When: 빈 수정 요청
    update_data = ClientUpdate()
    _, result = await update_service.execute(
        center_id="center-1", client_id=created_client.id,
        changed=update_data.model_dump(mode="json", exclude_unset=True),
        **update_data.model_dump(exclude_unset=True),
    )

    # Then: 기존 Client 반환
    assert result.id == created_client.id
    assert result.name == created_client.name
