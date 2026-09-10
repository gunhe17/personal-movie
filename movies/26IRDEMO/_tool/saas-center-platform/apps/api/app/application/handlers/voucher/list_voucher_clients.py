import math
from datetime import date, datetime, timedelta

from app.application.schemas import (
    VoucherClientItem,
    VoucherClientListResponse,
    VoucherClientVoucherBrief,
)
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client.facade.client_facade import ClientFacade
from app.modules.voucher.facade.client_voucher_facade import ClientVoucherFacade

_LOAD_CAP = 3000

# 대시보드 시그널 정의의 SSOT — 대시보드 카운트는 이 엔드포인트를 signal+size=1로 호출해
# total을 읽으므로, 임계값 변경은 여기 한 곳이면 카운트·목록이 함께 움직인다.
_SIGNAL_LOW_REMAINING = 2
_SIGNAL_EXPIRING_DAYS = 14


def _signal_match(
    voucher,
    signal: str,
    today: date,
) -> bool:
    if signal == "low":
        return 0 < voucher.remaining_sessions <= _SIGNAL_LOW_REMAINING and (
            voucher.valid_until is None or voucher.valid_until >= today
        )
    if signal == "expiring":
        return (
            voucher.remaining_sessions > 0
            and voucher.valid_until is not None
            and today
            <= voucher.valid_until
            <= today + timedelta(days=_SIGNAL_EXPIRING_DAYS)
        )
    return False


def _program_name(voucher) -> str:
    cat = voucher.catalog
    if cat and cat.name:
        return cat.name
    return "바우처"


def _issued_in_range(
    voucher,
    date_from: date | None,
    date_to: date | None,
) -> bool:
    issued = voucher.created_at.date() if voucher.created_at else None
    if date_from and (issued is None or issued < date_from):
        return False
    if date_to and (issued is None or issued > date_to):
        return False
    return True


async def list_voucher_clients_handler(
    center_id: str,
    skip: int,
    limit: int,
    status_filter: str | None,
    search: str | None,
    date_from: date | None,
    date_to: date | None,
    sort: str | None,
    uow: UnitOfWork,
    signal: str | None = None,
) -> VoucherClientListResponse:
    # load — 센터 전체 발급 바우처(catalog 포함)를 cap 내로 한 번에.
    vouchers = await ClientVoucherFacade(uow).list_all_client_vouchers_with_response(
        center_id=center_id,
        cap=_LOAD_CAP,
    )

    by_client: dict[str, list] = {}
    for v in vouchers:
        if not _issued_in_range(v, date_from, date_to):
            continue
        by_client.setdefault(v.client_id, []).append(v)

    info_map = await ClientFacade(uow).get_clients_by_ids(list(by_client.keys()))

    # assemble — 상태 파생 + 검색(이름 OR 프로그램명) + 정렬/페이징
    today = date.today()
    needle = search.strip().lower() if search else None

    rows: list[tuple[datetime, VoucherClientItem]] = []
    for client_id, vs in by_client.items():
        info = info_map.get(client_id)
        if info is None:
            continue

        briefs = [
            VoucherClientVoucherBrief(
                client_voucher_id=v.id,
                program_name=_program_name(v),
                remaining_sessions=v.remaining_sessions,
                total_sessions=v.total_sessions,
                valid_until=v.valid_until,
            )
            for v in vs
        ]
        is_active = any(
            v.remaining_sessions > 0
            and (v.valid_until is None or v.valid_until >= today)
            for v in vs
        )
        status = "active" if is_active else "completed"
        if status_filter and status != status_filter:
            continue

        if signal and not any(_signal_match(v, signal, today) for v in vs):
            continue

        if needle:
            name_match = needle in (info.name or "").lower()
            program_match = any(needle in b.program_name.lower() for b in briefs)
            if not (name_match or program_match):
                continue

        latest = max((v.created_at for v in vs if v.created_at), default=datetime.min)
        rows.append(
            (
                latest,
                VoucherClientItem(
                    client_id=client_id,
                    name=info.name,
                    birth_date=info.birth_date,
                    gender=info.gender,
                    profile_image_url=info.profile_image_url,
                    status=status,
                    vouchers=briefs,
                ),
            )
        )

    rows.sort(key=lambda r: r[0], reverse=True)
    items_all = [item for _, item in rows]

    total = len(items_all)
    paged = items_all[skip : skip + limit]
    page = (skip // limit) + 1 if limit > 0 else 1
    pages = math.ceil(total / limit) if limit > 0 else 0

    return VoucherClientListResponse(
        items=paged,
        total=total,
        page=page,
        size=limit,
        pages=pages,
    )


# #
# main

TOOL = {
    "name": "list_voucher_clients_handler",
    "permission": "read:voucher",
    "purpose": "센터의 바우처 보유 내담자를 상태·검색·발급일로 거르고 페이지 단위로 조회한다.",
    "keywords": [
        "바우처 목록",
        "바우처 내담자",
        "바우처 현황",
        "이용권 내담자",
        "voucher clients",
    ],
    "boundaries": "바우처 보유 내담자를 내담자 단위로 집계 조회(읽기 전용). 특정 센터 바우처 사용자는 get_voucher_clients_handler.",
    "output": "바우처 보유 내담자 목록 (VoucherClientListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "상태 필터 (active | completed).",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "내담자 이름 또는 프로그램명(선택).",
            },
            "date_from": {
                "type": "string",
                "format": "date",
                "title": "발급일 시작",
                "description": "발급일 범위 시작(선택).",
            },
            "date_to": {
                "type": "string",
                "format": "date",
                "title": "발급일 종료",
                "description": "발급일 범위 종료(선택).",
            },
            "signal": {
                "type": "string",
                "title": "시그널 필터",
                "description": "대시보드 시그널 필터 (low: 잔여 2회 이하 소진 임박 | expiring: 14일 이내 만료 임박). 선택.",
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


def main() -> dict:
    return TOOL
