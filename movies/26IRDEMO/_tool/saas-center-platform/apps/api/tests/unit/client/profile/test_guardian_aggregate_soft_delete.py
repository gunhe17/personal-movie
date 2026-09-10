"""ClientRepository guardian-aggregate soft-delete filter regression tests"""

from app.modules.client.client_relation.repository import ClientRelationRepository
from app.modules.client.profile.repository import ClientRepository
from app.modules.client.profile.schemas import ClientCreate, ClientRole
from app.modules.client.profile.services import CreateClientService


async def test_aggregate_guardian_phones_excludes_soft_deleted_relation(test_session):
    """guardian 관계가 soft-delete되면 그 보호자 전화는 집계에서 제외된다."""
    # Given: 내담자 1명 + 보호자 2명, guardian 관계 2건(전화 보유)
    client_repo = ClientRepository(test_session)
    relation_repo = ClientRelationRepository(test_session)
    create_service = CreateClientService(client_repo)

    _, child = await create_service.execute(
        center_id="center-1",
        **ClientCreate(role=ClientRole.CLIENT, name="김아이").model_dump(),
    )
    _, kept_guardian = await create_service.execute(
        center_id="center-1",
        **ClientCreate(role=ClientRole.GUARDIAN, name="엄마", phone="010-1111-1111").model_dump(),
    )
    _, removed_guardian = await create_service.execute(
        center_id="center-1",
        **ClientCreate(role=ClientRole.GUARDIAN, name="아빠", phone="010-2222-2222").model_dump(),
    )

    await relation_repo.add(
        center_id="center-1",
        client_id=child.id,
        related_client_id=kept_guardian.id,
        relation_type="guardian",
    )
    removed_relation = await relation_repo.add(
        center_id="center-1",
        client_id=child.id,
        related_client_id=removed_guardian.id,
        relation_type="guardian",
    )

    # When: 한 guardian 관계를 soft-delete
    await relation_repo.remove_by_id(removed_relation.id)

    mapping = await client_repo.aggregate_guardian_phones_by_client_ids(
        center_id="center-1",
        client_ids=[child.id],
    )

    # Then: 살아있는 관계의 보호자 전화만 집계된다
    assert mapping == {child.id: ["010-1111-1111"]}
