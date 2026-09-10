# 케어보드 쓰기 — 메모 CRUD · 핀 토글 · 읽음 표시.
#
# 권한(§8): 작성 = 접근자 전원(관리자 포함) / 수정·삭제 = 작성자 본인 + 관리자 / 핀 = 접근자 누구나.
# 관계 판정(담당 이력)만으로 write를 여는 첫 사례라, 라우터는 READ_CLIENT로 카탈로그 체계를
# 유지하고 실제 게이트는 assert_client_accessible이 담당한다.

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.care_board.entry.models import CareBoardKind, CareBoardShareClass
from app.modules.care_board.facade import CareBoardFacade
from app.modules.care_board.memo.schemas import CareMemoResponse
from app.modules.client.facade import ClientFacade
from app.modules.event import emit

from .list_care_board_stream import assert_client_accessible

BODY_SNAPSHOT_LIMIT = 300


async def create_care_memo_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    client_id: str,
    member_id: str,
    body: str,
    owner_scope: str | None,
    actor_id: str | None,
    uow: UnitOfWork,
) -> CareMemoResponse:
    await assert_client_accessible(
        center_id=center_id, client_id=client_id, owner_scope=owner_scope, uow=uow
    )

    board = CareBoardFacade(uow)
    memo_atomic, memo = await board.create_memo(
        center_id=center_id,
        client_id=client_id,
        author_id=member_id,
        body=body,
    )
    entry_atomic, _ = await _record_memo_entry(uow, board, memo)

    await emit(
        uow,
        "care_memo_created",
        event_group_id=event_group_id,
        atomics=[memo_atomic, entry_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return CareMemoResponse.model_validate(memo)


async def update_care_memo_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    client_id: str,
    memo_id: str,
    member_id: str,
    body: str,
    is_manager: bool,
    owner_scope: str | None,
    actor_id: str | None,
    uow: UnitOfWork,
) -> CareMemoResponse:
    await assert_client_accessible(
        center_id=center_id, client_id=client_id, owner_scope=owner_scope, uow=uow
    )

    board = CareBoardFacade(uow)
    memo_atomic, memo = await board.update_memo(
        memo_id=memo_id,
        center_id=center_id,
        member_id=member_id,
        body=body,
        is_manager=is_manager,
    )
    entry_atomic, _ = await _record_memo_entry(uow, board, memo)

    await emit(
        uow,
        "care_memo_updated",
        event_group_id=event_group_id,
        atomics=[memo_atomic, entry_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return CareMemoResponse.model_validate(memo)


async def delete_care_memo_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    client_id: str,
    memo_id: str,
    member_id: str,
    is_manager: bool,
    owner_scope: str | None,
    actor_id: str | None,
    uow: UnitOfWork,
) -> None:
    await assert_client_accessible(
        center_id=center_id, client_id=client_id, owner_scope=owner_scope, uow=uow
    )

    board = CareBoardFacade(uow)
    memo_atomic, memo = await board.delete_memo(
        memo_id=memo_id,
        center_id=center_id,
        member_id=member_id,
        is_manager=is_manager,
    )
    entry_atomics = await board.mark_source_deleted(
        source_table="care_memos", source_id=memo.id
    )

    await emit(
        uow,
        "care_memo_deleted",
        event_group_id=event_group_id,
        atomics=[memo_atomic, *entry_atomics],
        center_id=center_id,
        actor_id=actor_id,
    )


async def toggle_care_board_pin_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    client_id: str,
    entry_id: str,
    member_id: str,
    pinned: bool,
    owner_scope: str | None,
    actor_id: str | None,
    uow: UnitOfWork,
) -> None:
    await assert_client_accessible(
        center_id=center_id, client_id=client_id, owner_scope=owner_scope, uow=uow
    )

    atomic, _ = await CareBoardFacade(uow).toggle_pin(
        entry_id=entry_id,
        center_id=center_id,
        member_id=member_id,
        pinned=pinned,
    )
    await emit(
        uow,
        "care_board_entry_pinned",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


async def mark_care_board_read_handler(
    *,
    center_id: str,
    client_id: str,
    member_id: str,
    owner_scope: str | None,
    uow: UnitOfWork,
) -> None:
    await assert_client_accessible(
        center_id=center_id, client_id=client_id, owner_scope=owner_scope, uow=uow
    )
    await CareBoardFacade(uow).mark_read(
        center_id=center_id, client_id=client_id, member_id=member_id
    )


async def _record_memo_entry(uow: UnitOfWork, board: CareBoardFacade, memo):
    client = await ClientFacade(uow).get_client_in_center(
        center_id=memo.center_id, client_id=memo.client_id
    )
    flat = " ".join(memo.body.split())
    return await board.record_entry(
        center_id=memo.center_id,
        client_id=memo.client_id,
        person_id=client.person_id,
        kind=CareBoardKind.MEMO.value,
        occurred_at=memo.created_at,
        source_table="care_memos",
        source_id=memo.id,
        # 다른 상담사에게 하는 내부 발화 — 내담자에게도 타 센터에도 나가지 않는다(§16-3)
        share_class=CareBoardShareClass.INTERNAL.value,
        actor_id=memo.author_id,
        body=flat[:BODY_SNAPSHOT_LIMIT],
    )


TOOL = {
    "name": "create_care_memo_handler",
    "permission": "read:client",
    "purpose": "내담자 케어보드에 공유 메모를 남긴다.",
    "keywords": ["케어보드 메모", "내담자 메모", "care memo"],
    "boundaries": "해당 내담자에 접근 가능한 구성원이면 누구나 작성한다. 수정·삭제는 작성자 본인과 관리자만.",
    "output": "생성된 메모 (CareMemoResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "메모를 남길 내담자의 UUID.",
            },
            "body": {
                "type": "string",
                "minLength": 1,
                "title": "메모 본문",
                "description": "센터 내부 공유 메모. 내담자·타 센터에 노출되지 않는다.",
            },
        },
        "required": ["client_id", "body"],
    },
}
