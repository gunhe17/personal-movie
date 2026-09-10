from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assistant.facade.assistant_facade import AssistantFacade


async def test_create_assistant_conversation_with_response(test_session):
    # 회귀: facade가 repo @typecheck 계약을 어긴 인자로 호출하면 DevelopError(2026-07-10 라이브 발견)
    uow = UnitOfWork(test_session)

    response = await AssistantFacade(uow).create_assistant_conversation_with_response(
        center_id="center-1",
        member_id="member-1",
    )

    assert response.id
    assert response.title is None
