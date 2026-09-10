from app.modules.client.profile.schemas import ClientRole, ClientStatus, Gender
import math
from datetime import datetime
from app.core.datetime_utils import utc_now

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client.profile.schemas import (
    ClientListResponse,
    ClientSummary,
    ClientVoucherBrief,
)
from app.modules.client.facade.profile_facade import ProfileFacade


async def list_clients_handler(
    center_id: str,
    skip: int,
    limit: int,
    role: str | None,
    status: str | None,
    gender: str | None,
    search: str | None,
    sort: str | None,
    uow: UnitOfWork,
    viewer_person_id: str | None = None,
    owner_scope: str | None = None,
) -> ClientListResponse:
    # owner_scope(access_level=own)면 담당 내담자만 — "담당"은 Client가 아니라 케이스에
    # 정의되므로 상담/검사 모듈에서 cross-module로 client_id 집합을 도출해 필터로 넘긴다.
    # sort="next_session"은 정렬 키가 타 모듈(Counseling→Schedule)에 있어 별도 경로로 분기.
    if sort == "next_session":
        return await _list_clients_by_next_session(
            center_id,
            skip,
            limit,
            role,
            status,
            gender,
            search,
            uow,
            viewer_person_id=viewer_person_id,
            owner_scope=owner_scope,
        )

    client_ids_filter: list[str] | None = None
    if owner_scope is not None:
        client_ids_filter = await _resolve_assigned_client_ids(
            center_id, owner_scope, uow
        )
        if not client_ids_filter:
            return _empty_response(limit)

    facade = ProfileFacade(uow)
    response = await facade.list_with_response(
        center_id,
        skip,
        limit,
        role,
        status,
        gender,
        search,
        sort,
        viewer_person_id=viewer_person_id,
        ids=client_ids_filter,
    )
    await _enrich_next_sessions(response.items, center_id, uow)
    await _enrich_vouchers(response.items, center_id, uow)
    return response


def _empty_response(limit: int) -> ClientListResponse:
    return ClientListResponse(items=[], total=0, page=1, size=limit, pages=0)


async def _resolve_assigned_client_ids(
    center_id: str,
    counselor_id: str,
    uow: UnitOfWork,
) -> list[str]:
    # 상담 + 검사 모듈의 담당 내담자(주담당+보조, 종료/탈퇴 포함) 집합을 union.
    # 호출자는 활성 uow 컨텍스트(behavior 요청 tx) 안에서 호출해야 한다.
    from app.modules.counseling.facade import CounselingCaseFacade
    from app.modules.assessment.facade import AssessmentCaseFacade

    counseling_ids = await CounselingCaseFacade(uow).list_client_ids_by_counselor(
        center_id, counselor_id
    )
    assessment_ids = await AssessmentCaseFacade(uow).list_client_ids_by_counselor(
        center_id, counselor_id
    )
    return list(counseling_ids | assessment_ids)


async def _enrich_next_sessions(
    summaries: list[ClientSummary],
    center_id: str,
    uow: UnitOfWork,
) -> None:
    # 각 ClientSummary.next_session_at(최임박 미래 회기)를 in-place로 채운다.
    from app.modules.counseling.facade.counseling_session_facade import (
        CounselingSessionFacade,
    )
    from app.modules.schedule.facade import ScheduleFacade

    client_ids = [c.id for c in summaries]
    if not client_ids:
        return

    session_facade = CounselingSessionFacade(uow)
    sched_ids_by_client = (
        await session_facade.aggregate_scheduled_schedule_ids_per_client(
            center_id,
            client_ids,
        )
    )

    all_sched_ids = list({sid for sids in sched_ids_by_client.values() for sid in sids})
    if not all_sched_ids:
        return

    now = utc_now()
    schedule_facade = ScheduleFacade(uow)
    schedules = await schedule_facade.list_schedules_by_ids(all_sched_ids)
    start_by_sched = {
        s.id: s.start for s in schedules if s.start is not None and s.start >= now
    }

    for c in summaries:
        starts = [
            start_by_sched[sid]
            for sid in sched_ids_by_client.get(c.id, [])
            if sid in start_by_sched
        ]
        c.next_session_at = min(starts) if starts else None


async def _enrich_vouchers(
    summaries: list[ClientSummary],
    center_id: str,
    uow: UnitOfWork,
) -> None:
    # 각 ClientSummary에 보유 바우처 요약을 in-place로 채운다.
    # 센터 바우처를 한 번에 받아 client_id로 그룹화해 N+1을 피한다.
    from datetime import date as _date
    from app.modules.voucher.facade.client_voucher_facade import (
        ClientVoucherFacade,
    )

    client_ids = {c.id for c in summaries}
    if not client_ids:
        return

    voucher_facade = ClientVoucherFacade(uow)
    # client_id=None → 센터 전체 바우처. size는 충분히 크게(페이지 내담자들의 합).
    response = await voucher_facade.list_client_vouchers_with_response(
        center_id=center_id,
        client_id=None,
        page=1,
        size=1000,
    )

    today = _date.today()

    def _voucher_name(item) -> str:
        # 바우처명은 catalog(원천 카탈로그)에 있음. center_voucher엔 name 없음.
        cat = getattr(item, "catalog", None)
        if cat and getattr(cat, "name", None):
            return cat.name
        return "바우처"

    def _is_valid(item) -> bool:
        vu = getattr(item, "valid_until", None)
        return vu is None or vu >= today

    by_client: dict[str, list] = {}
    for item in response.items:
        if item.client_id in client_ids:
            by_client.setdefault(item.client_id, []).append(item)

    for c in summaries:
        items = by_client.get(c.id, [])
        if not items:
            continue
        # 가장 활성: 유효한 것 우선, 그 안에서 잔여회기 많은 순
        items.sort(key=lambda it: (_is_valid(it), it.remaining_sessions), reverse=True)
        briefs = [
            ClientVoucherBrief(
                name=_voucher_name(it),
                remaining_sessions=it.remaining_sessions,
                total_sessions=it.total_sessions,
            )
            for it in items
        ]
        c.vouchers = briefs
        c.voucher_count = len(briefs)
        c.voucher_primary = briefs[0]


async def _list_clients_by_next_session(
    center_id: str,
    skip: int,
    limit: int,
    role: str | None,
    status: str | None,
    gender: str | None,
    search: str | None,
    uow: UnitOfWork,
    *,
    viewer_person_id: str | None = None,
    owner_scope: str | None = None,
) -> ClientListResponse:
    # 회기 임박순은 정렬 키가 타 모듈에 있어 전체를 cap 내로 받아 메모리 정렬 후 페이징한다.
    client_ids_filter: list[str] | None = None
    if owner_scope is not None:
        client_ids_filter = await _resolve_assigned_client_ids(
            center_id, owner_scope, uow
        )
        if not client_ids_filter:
            return _empty_response(limit)

    profile_facade = ProfileFacade(uow)
    summaries, total = await profile_facade.list_all_summaries_for_sort(
        center_id,
        role,
        status,
        gender,
        search,
        viewer_person_id=viewer_person_id,
        ids=client_ids_filter,
    )
    await _enrich_next_sessions(summaries, center_id, uow)

    # 정렬: 활성 먼저 → 임박 회기 있는 사람 먼저(시각 오름차순), 없으면 뒤로, 동률은 최신 등록순.
    # stable sort 3-pass: 보조키(등록 최신순) → 임박순(None은 뒤로) → 주키(활성 여부).
    # 활성 여부가 1순위인 것은 DB 정렬 경로(ClientRepository.list_in_center_with_page)와 같은 규칙.
    summaries.sort(key=lambda c: c.created_at or datetime.min, reverse=True)
    summaries.sort(
        key=lambda c: (c.next_session_at is None, c.next_session_at or datetime.max)
    )
    summaries.sort(key=lambda c: 0 if c.status == "active" else 1)

    paged: list[ClientSummary] = summaries[skip : skip + limit]

    # 바우처는 표시용이므로 페이징된 항목만 enrich (불필요한 전체 조회 방지)
    await _enrich_vouchers(paged, center_id, uow)

    page = (skip // limit) + 1 if limit > 0 else 1
    pages = math.ceil(total / limit) if limit > 0 else 1

    return ClientListResponse(
        items=paged,
        total=total,
        page=page,
        size=limit,
        pages=pages,
    )


TOOL = {
    "name": "list_clients_handler",
    "agent_exposed": False,
    "permission": "read:client",
    "purpose": "센터의 내담자 목록을 역할·상태·성별·검색어로 거르고 페이지 단위로 조회한다.",
    "keywords": [
        "list clients",
        "내담자 목록",
        "고객 목록",
        "내담자 검색",
        "고객 찾기",
        "client 리스트",
        "담당 내담자",
    ],
    "boundaries": "여러 내담자를 목록으로 조회(읽기 전용). 한 명 지표는 get_client_metrics_handler, 즐겨찾기는 list_favorites_handler.",
    "output": "내담자 목록 (ClientListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "role": {
                "type": "string",
                "title": "역할 필터",
                "enum": [r.value for r in ClientRole],
                "description": "역할 필터(선택).",
            },
            "status": {
                "type": "string",
                "title": "상태 필터",
                "enum": [s.value for s in ClientStatus],
                "description": "상태 필터(선택).",
            },
            "gender": {
                "type": "string",
                "title": "성별 필터",
                "enum": [g.value for g in Gender],
                "description": "성별 필터(선택).",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "이름 등 검색어(선택).",
            },
            "sort": {
                "type": "string",
                "title": "정렬 기준",
                "description": "정렬 기준(선택).",
            },
            "skip": {
                "type": "integer",
                "title": "오프셋",
                "description": "건너뛸 개수.",
            },
            "limit": {
                "type": "integer",
                "title": "최대 개수",
                "description": "가져올 최대 개수.",
            },
        },
        "required": ["skip", "limit"],
    },
}
