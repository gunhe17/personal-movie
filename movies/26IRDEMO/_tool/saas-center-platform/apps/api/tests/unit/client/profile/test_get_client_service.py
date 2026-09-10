"""GetClientService Unit Tests"""
import pytest

from app.core.exceptions import EntityNotFoundException
from app.modules.client.profile.services import GetClientService, CreateClientService
from app.modules.client.profile.repository import ClientRepository
from app.modules.client.profile.schemas import ClientCreate, ClientRole


async def test_get_client_success(test_session):
    """Client 조회 성공 테스트"""
    # Given
    repo = ClientRepository(test_session)
    create_service = CreateClientService(repo)
    get_service = GetClientService(repo)

    client_data = ClientCreate(
        role=ClientRole.CLIENT,
        name="김아이",
    )
    _, created_client = await create_service.execute(center_id="center-1", **client_data.model_dump())

    # When
    retrieved_client = await get_service.execute("center-1", created_client.id)

    # Then
    assert retrieved_client.id == created_client.id
    assert retrieved_client.name == "김아이"


async def test_get_client_not_found(test_session):
    """존재하지 않는 Client 조회 시 에러 테스트"""
    # Given
    repo = ClientRepository(test_session)
    service = GetClientService(repo)

    # When & Then
    with pytest.raises(EntityNotFoundException, match="찾을 수 없습니다"):
        await service.execute("center-1", "nonexistent-id")


async def test_get_client_wrong_center(test_session):
    """다른 센터의 Client 조회 시 에러 테스트"""
    # Given: 센터 1에 Client 생성
    repo = ClientRepository(test_session)
    create_service = CreateClientService(repo)
    get_service = GetClientService(repo)

    client_data = ClientCreate(
        role=ClientRole.CLIENT,
        name="김아이",
    )
    _, created_client = await create_service.execute(center_id="center-1", **client_data.model_dump())

    # When: 센터 2에서 조회 시도
    with pytest.raises(EntityNotFoundException, match="찾을 수 없습니다"):
        await get_service.execute("center-2", created_client.id)  # 센터 2
