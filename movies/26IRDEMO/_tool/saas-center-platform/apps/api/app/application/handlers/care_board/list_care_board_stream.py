# 케어보드 스트림 조회 — 단일 테이블 커서 조회 + 표시명 해소.
#
# 스코프는 2단이다(docs/careboard/domain.md §7-1):
#   ① 보드 진입 — 이 내담자에 접근 가능한가 (사람 축, 1회)
#   ② 행 표시   — 이 종류의 정보를 볼 수 있는가 (정보 축, kind 필터)
# ①을 통과하면 그 내담자의 전 이력을 본다. 누가 썼는지로 거르지 않는다 — 그래야 인계가 성립한다.

from datetime import datetime

from app.core.datetime_utils import parse_datetime
from app.core.exceptions import EntityNotFoundException
from app.core.permissions import Permission
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.care_board.entry.models import CareBoardKind
from app.modules.care_board.entry.schemas import (
    CareBoardStreamResponse,
    CareBoardStreamRow,
)
from app.modules.care_board.facade import CareBoardFacade
from app.modules.center.facade import MemberFacade
from app.modules.person.facade import PersonFacade

# kind → 그 행을 보려면 있어야 하는 권한. 없으면 정보 축에서 걸러진다(게이트 ②).
KIND_PERMISSION: dict[str, str] = {
    CareBoardKind.COUNSELING.value: Permission.READ_COUNSELING,
    CareBoardKind.ASSESSMENT.value: Permission.READ_ASSESSMENT_CASE,
    CareBoardKind.DOCUMENT.value: Permission.READ_DOCUMENT,
    CareBoardKind.VOUCHER.value: Permission.READ_VOUCHER,
    # 필드노트·인계는 상담 맥락이다 — 상담 열람권이 없으면 보이지 않는다
    CareBoardKind.FIELDNOTE.value: Permission.READ_COUNSELING,
    CareBoardKind.HANDOVER.value: Permission.READ_COUNSELING,
}


async def list_care_board_stream_handler(
    *,
    center_id: str,
    client_id: str,
    member_id: str,
    permissions: list[str],
    owner_scope: str | None,
    uow: UnitOfWork,
    kinds: list[str] | None = None,
    cursor: str | None = None,
    limit: int = 50,
) -> CareBoardStreamResponse:
    await assert_client_accessible(
        center_id=center_id, client_id=client_id, owner_scope=owner_scope, uow=uow
    )

    allowed = _allowed_kinds(permissions)
    # 요청한 종류가 전부 권한 밖이면 "지정 안 함"이 아니라 "보여줄 게 없음"이다 —
    # 빈 목록을 전체로 되돌리면 필터를 누른 결과가 전체 목록이 된다
    requested = [k for k in kinds if k in allowed] if kinds else allowed

    board = CareBoardFacade(uow)
    before_at, before_id = _parse_cursor(cursor)
    entries, has_more = (
        await board.list_entries(
            center_id=center_id,
            client_id=client_id,
            kinds=requested,
            before_at=before_at,
            before_id=before_id,
            limit=limit,
        )
        if requested
        else ([], False)
    )
    pinned = [
        entry
        for entry in await board.list_pinned(center_id=center_id, client_id=client_id)
        if entry.kind in allowed
    ]

    read = await board.find_read(
        center_id=center_id, client_id=client_id, member_id=member_id
    )
    last_seen_at = read.last_seen_at if read else None
    # 기준 시점이 없으면 "새 것"도 없다 — 첫 방문에 전 이력을 안 읽음으로 세지 않는다
    unread = (
        await board.count_since(
            center_id=center_id,
            client_id=client_id,
            since=last_seen_at,
            # 배지는 "내가 볼 수 있는 남의 새 기록" 수다 — 못 보는 종류와
            # 내가 주체인 기록(내가 쓴 메모·내 회기)을 세면 열어도 새 게 없다
            kinds=allowed,
            exclude_actor_id=member_id,
        )
        if last_seen_at is not None
        else 0
    )

    names = await _resolve_member_names(
        uow,
        [e.actor_id for e in entries]
        + [e.pinned_by for e in entries]
        + [e.actor_id for e in pinned]
        + [e.pinned_by for e in pinned],
    )

    return CareBoardStreamResponse(
        rows=[_to_row(entry, names) for entry in entries],
        next_cursor=_build_cursor(entries[-1]) if has_more and entries else None,
        pinned=[_to_row(entry, names) for entry in pinned],
        unread_count=unread,
        last_seen_at=last_seen_at,
    )


async def assert_client_accessible(
    *,
    center_id: str,
    client_id: str,
    owner_scope: str | None,
    uow: UnitOfWork,
) -> None:
    """게이트 ① — 담당 이력(종료·탈퇴 포함) 또는 관리자.

    get_client_scoped_handler와 같은 기준을 쓴다 — 내담자 상세는 열리는데 그 안의
    보드만 안 열리는 상태를 만들지 않기 위해서다. application 공유 `_` 파일 금지 규칙에
    따라 같은 연쇄를 인라인한다.
    """
    if owner_scope is None:
        return

    from app.modules.assessment.facade import AssessmentCaseFacade
    from app.modules.counseling.facade import CounselingCaseFacade

    counseling_ids = await CounselingCaseFacade(uow).list_client_ids_by_counselor(
        center_id, owner_scope
    )
    assessment_ids = await AssessmentCaseFacade(uow).list_client_ids_by_counselor(
        center_id, owner_scope
    )
    if client_id not in set(counseling_ids) | set(assessment_ids):
        raise EntityNotFoundException(f"내담자를 찾을 수 없습니다: {client_id}")


# 커서 = "{occurred_at}|{id}" — 같은 시각 행이 여럿일 때 경계에서 누락되지 않도록
# 정렬 키(occurred_at, id) 전체를 담는다. id 없는 옛 커서도 계속 받는다.
def _parse_cursor(cursor: str | None) -> tuple[datetime | None, str | None]:
    if not cursor:
        return None, None
    occurred_at, _, entry_id = cursor.partition("|")
    return parse_datetime(occurred_at), entry_id or None


def _build_cursor(entry) -> str:
    return f"{entry.occurred_at.isoformat()}|{entry.id}"


def _allowed_kinds(permissions: list[str]) -> list[str]:
    if "*" in permissions:
        return [kind.value for kind in CareBoardKind]
    granted = set(permissions)
    return [
        kind.value
        for kind in CareBoardKind
        if KIND_PERMISSION.get(kind.value) is None
        or KIND_PERMISSION[kind.value] in granted
    ]


def _to_row(entry, names: dict[str, str | None]) -> CareBoardStreamRow:
    row = CareBoardStreamRow.model_validate(entry)
    row.actor_name = names.get(entry.actor_id) if entry.actor_id else None
    row.pinned_by_name = names.get(entry.pinned_by) if entry.pinned_by else None
    return row


async def _resolve_member_names(
    uow: UnitOfWork, member_ids: list[str | None]
) -> dict[str, str | None]:
    unique = list({mid for mid in member_ids if mid})
    if not unique:
        return {}
    members = await MemberFacade(uow).get_members_by_ids(unique)
    persons = await PersonFacade(uow).get_persons_by_ids(
        [m.person_id for m in members.values()]
    )
    return {
        member_id: (
            persons[member.person_id].name if member.person_id in persons else None
        )
        for member_id, member in members.items()
    }


TOOL = {
    "name": "list_care_board_stream_handler",
    "permission": "read:client",
    "purpose": "한 내담자의 케어보드 타임라인(상담·검사·문서·필드노트·바우처·메모)을 시간 역순으로 조회한다.",
    "keywords": ["케어보드", "care board", "내담자 타임라인", "내담자 이력"],
    "boundaries": "읽기 전용. 담당 이력이 없는 상담사는 접근 불가(관리자는 전체). 메모 작성은 create_care_memo_handler.",
    "output": "스트림 행·고정 항목·안 읽음 수 (CareBoardStreamResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "케어보드를 조회할 내담자의 UUID.",
            },
            "kinds": {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": [kind.value for kind in CareBoardKind],
                },
                "title": "종류 필터",
                "description": "지정하지 않으면 권한이 허용하는 전 종류.",
            },
            "cursor": {
                "type": "string",
                "title": "커서",
                "description": "이전 응답의 next_cursor를 그대로 넘긴다. 이보다 이전 행을 반환한다.",
            },
            "limit": {
                "type": "integer",
                "minimum": 1,
                "maximum": 100,
                "title": "최대 개수",
                "description": "한 페이지 행 수 (기본 50).",
            },
        },
        "required": ["client_id"],
    },
}
