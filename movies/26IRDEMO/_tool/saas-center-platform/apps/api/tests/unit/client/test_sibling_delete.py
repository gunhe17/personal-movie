"""C-H3 회귀: 형제 관계 삭제는 양방향 행(A→B, B→A)을 모두 제거해야 한다.
이전엔 service 가 client/sibling 을 미리 스왑하고 repo 도 다시 스왑해(이중 스왑)
삭제 대상 행을 역방향으로 오인 → B→A 가 orphan 으로 남아 재생성이 막혔다."""
from app.modules.client.sibling_relation.repository import SiblingRelationRepository
from app.modules.client.sibling_relation.services.delete_sibling_relation import (
    DeleteSiblingRelationService,
)


async def test_delete_removes_both_directions(test_session):
    repo = SiblingRelationRepository(test_session)
    forward = await repo.add(center_id="c1", client_id="A", sibling_id="B")
    await repo.add(center_id="c1", client_id="B", sibling_id="A")

    await DeleteSiblingRelationService(repo).execute(
        relation_id=forward.id, center_id="c1"
    )

    # 양방향 모두 제거됨 → 재생성 차단 없음
    assert await repo.list_siblings(center_id="c1", client_id="A") == []
    assert await repo.list_siblings(center_id="c1", client_id="B") == []
    assert await repo.exists_sibling(center_id="c1", client_id="A", sibling_id="B") is False
