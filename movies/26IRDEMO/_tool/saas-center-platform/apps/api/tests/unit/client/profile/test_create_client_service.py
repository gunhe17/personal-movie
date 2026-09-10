"""CreateClientService Unit Tests"""
import pytest
from datetime import date

from app.core.exceptions import ConflictException
from app.modules.client.profile.services import CreateClientService
from app.modules.client.profile.repository import ClientRepository
from app.modules.client.profile.schemas import ClientCreate, ClientRole, ClientStatus, Gender


async def test_create_client_success(test_session):
    """Client 생성 성공 테스트"""
    # Given
    repo = ClientRepository(test_session)
    service = CreateClientService(repo)

    client_data = ClientCreate(
        person_id=None,
        role=ClientRole.CLIENT,
        name="김아이",
        birth_date=date(2015, 3, 15),
        gender=Gender.FEMALE,
        phone="010-1234-5678",
        email=None,
        address=None,
        status=ClientStatus.ACTIVE,
        memo=None
    )

    # When
    _, client = await service.execute(center_id="center-1", **client_data.model_dump())

    # Then
    assert client.id is not None
    assert client.center_id == "center-1"
    assert client.role == "client"
    assert client.name == "김아이"
    assert client.birth_date == date(2015, 3, 15)
    assert client.gender == "female"
    assert client.phone == "010-1234-5678"
    assert client.status == "active"


async def test_create_client_with_person_id(test_session):
    """Person 연동된 Client 생성 테스트"""
    # Given
    repo = ClientRepository(test_session)
    service = CreateClientService(repo)

    client_data = ClientCreate(
        person_id="person-uuid-123",
        role=ClientRole.GUARDIAN,
        name="김엄마",
        phone="010-1111-1111",
    )

    # When
    _, client = await service.execute(center_id="center-1", **client_data.model_dump())

    # Then
    assert client.person_id == "person-uuid-123"
    assert client.role == "guardian"


async def test_create_client_duplicate_person_id(test_session):
    """Person 중복 연동 시 에러 테스트"""
    # Given
    repo = ClientRepository(test_session)
    service = CreateClientService(repo)

    # 첫 번째 Client 생성
    first_client = ClientCreate(
        person_id="person-uuid-123",
        role=ClientRole.GUARDIAN,
        name="김엄마",
        phone="010-1111-1111",
    )
    await service.execute(center_id="center-1", **first_client.model_dump())

    # 같은 person_id로 두 번째 Client 생성 시도
    second_client = ClientCreate(
        person_id="person-uuid-123",  # 중복
        role=ClientRole.GUARDIAN,
        name="박엄마",
        phone="010-2222-2222",
    )

    # When & Then
    with pytest.raises(ConflictException, match="이미.*연동되어 있습니다"):
        await service.execute(center_id="center-1", **second_client.model_dump())


async def test_create_client_different_center_same_person_id(test_session):
    """다른 센터에서 같은 Person 연동 가능 테스트"""
    # Given
    repo = ClientRepository(test_session)
    service = CreateClientService(repo)

    # 센터 1에 Client 생성
    client1 = ClientCreate(
        person_id="person-uuid-123",
        role=ClientRole.GUARDIAN,
        name="김엄마",
        phone="010-1111-1111",
    )
    await service.execute(center_id="center-1", **client1.model_dump())

    # 센터 2에 같은 Person 연동
    client2 = ClientCreate(
        person_id="person-uuid-123",  # 같은 Person
        role=ClientRole.GUARDIAN,
        name="김엄마",
        phone="010-1111-1111",
    )

    # When
    _, result = await service.execute(center_id="center-2", **client2.model_dump())

    # Then (에러 없이 생성됨)
    assert result.center_id == "center-2"
    assert result.person_id == "person-uuid-123"
