"""query_client_voucher — 내담자 바우처 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11).

group_by는 SQL GROUP BY로 구현 — 이 구역의 허용 사항(query.md §3).
"""

from datetime import date, datetime, time

from sqlalchemy import select
from sqlalchemy.sql import func

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client.profile.models import Client
from app.modules.voucher.center_voucher.models import CenterVoucher
from app.modules.voucher.client_voucher.models import ClientVoucher
from app.modules.voucher.voucher.models import Voucher
from app.infrastructure.persistence.agent_query import fetch


async def query_client_voucher_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 바우처는 read:voucher 게이트의 센터 단위 조회
    client_id: str | None = None,
    center_voucher_id: str | None = None,
    total_sessions_min: int | None = None,
    total_sessions_max: int | None = None,
    remaining_sessions_min: int | None = None,
    remaining_sessions_max: int | None = None,
    total_amount_min: int | None = None,
    total_amount_max: int | None = None,
    remaining_amount_min: int | None = None,
    remaining_amount_max: int | None = None,
    valid_until_from: str | date | None = None,
    valid_until_to: str | date | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    id: str | None = None,
    ids: list[str] | None = None,
    client_ids: list[str] | None = None,
    center_voucher_ids: list[str] | None = None,
    sort: str | None = None,
    limit: int | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    group_by: str | None = None,
    namespaced: bool = True,
) -> dict:
    namespace = "client_voucher"
    # D13 쌍 — client_name·center_voucher_name의 원천 id는 fields 절삭과 무관하게 동반
    identity = (
        "id",
        "client_id",
        "center_voucher_id",
    )
    opt_in = ()

    allowed_group_by = frozenset({
        "center_voucher_id",
        "client_id",
    })

    # 정렬 어휘 SSOT — TOOL sort enum도 여기서 나온다
    sorts = {
        "latest": ClientVoucher.created_at.desc(),
        "oldest": ClientVoucher.created_at.asc(),
        "total_sessions_high": ClientVoucher.total_sessions.desc(),
        "total_sessions_low": ClientVoucher.total_sessions.asc(),
        "remaining_sessions_high": ClientVoucher.remaining_sessions.desc(),
        "remaining_sessions_low": ClientVoucher.remaining_sessions.asc(),
        "total_amount_high": ClientVoucher.total_amount.desc(),
        "total_amount_low": ClientVoucher.total_amount.asc(),
        "remaining_amount_high": ClientVoucher.remaining_amount.desc(),
        "remaining_amount_low": ClientVoucher.remaining_amount.asc(),
        "valid_until_earliest": ClientVoucher.valid_until.asc(),
        "valid_until_latest": ClientVoucher.valid_until.desc(),
    }

    def _where() -> list:
        where = [
            ClientVoucher.center_id == center_id,
            ClientVoucher.deleted_at.is_(None),
        ]
        all_ids = [*(ids or []), *([id] if id else [])]
        if all_ids:
            where.append(ClientVoucher.id.in_(all_ids))
        cids = {*(client_ids or []), *([client_id] if client_id else [])}
        if cids:
            where.append(ClientVoucher.client_id.in_(cids))
        cvids = {*(center_voucher_ids or []), *([center_voucher_id] if center_voucher_id else [])}
        if cvids:
            where.append(ClientVoucher.center_voucher_id.in_(cvids))
        for col, lo, hi in (
            (ClientVoucher.total_sessions, total_sessions_min, total_sessions_max),
            (ClientVoucher.remaining_sessions, remaining_sessions_min, remaining_sessions_max),
            (ClientVoucher.total_amount, total_amount_min, total_amount_max),
            (ClientVoucher.remaining_amount, remaining_amount_min, remaining_amount_max),
        ):
            if lo is not None:
                where.append(col >= lo)
            if hi is not None:
                where.append(col <= hi)
        if valid_until_from or valid_until_to:
            where.append(ClientVoucher.valid_until.is_not(None))
            if valid_until_from:
                where.append(ClientVoucher.valid_until >= coerce_date(valid_until_from, "valid_until_from"))
            if valid_until_to:
                where.append(ClientVoucher.valid_until <= coerce_date(valid_until_to, "valid_until_to"))
        if date_from:
            where.append(ClientVoucher.created_at >= datetime.combine(coerce_date(date_from, "date_from"), time.min))
        if date_to:
            where.append(ClientVoucher.created_at <= datetime.combine(coerce_date(date_to, "date_to"), time.max))
        return where

    # filters
    where = _where()

    # project
    # 센터 바우처의 정본 표시 문자열은 카탈로그(Voucher) name — CenterVoucherFacade.get_center_voucher_summaries_by_ids 동치
    cv_name = (
        select(Voucher.name)
        .select_from(CenterVoucher)
        .join(Voucher, Voucher.id == CenterVoucher.catalog_id)
        .where(CenterVoucher.id == ClientVoucher.center_voucher_id)
        .correlate(ClientVoucher)
        .scalar_subquery()
    )
    client_name = (
        select(Client.name)
        .where(Client.id == ClientVoucher.client_id)
        .correlate(ClientVoucher)
        .scalar_subquery()
    )

    # group
    if group_by is not None:
        if group_by not in allowed_group_by:
            raise ValueError(f"unsupported group_by: {group_by}")
        dim = getattr(ClientVoucher, group_by)
        label = cv_name if group_by == "center_voucher_id" else client_name
        name_key = "center_voucher_name" if group_by == "center_voucher_id" else "client_name"
        stmt = (
            select(
                dim.label(group_by),
                label.label(name_key),
                func.count().label("count"),
            )
            .where(*where)
            .group_by(dim)
            .order_by(func.count().desc(), dim)
        )
        rows = [dict(r) for r in (await uow.session.execute(stmt)).mappings().all()]
        # aggregate.count = 그룹 수가 아니라 필터 통과 원자 행 총수
        total = await uow.session.scalar(
            select(func.count()).select_from(ClientVoucher).where(*where)
        )
        return {
            "rows": rows,
            "aggregate": {"count": total or 0, "exact": True, "group_by": group_by},
        }

    # return
    stmt = (
        select(
            ClientVoucher.id,
            ClientVoucher.client_id,
            ClientVoucher.center_voucher_id,
            ClientVoucher.total_sessions,
            ClientVoucher.remaining_sessions,
            ClientVoucher.total_amount,
            ClientVoucher.remaining_amount,
            ClientVoucher.valid_from,
            ClientVoucher.valid_until,
            client_name.label("client_name"),
            cv_name.label("center_voucher_name"),
        )
        .where(*where)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), ClientVoucher.id)
    )

    rows, count = await fetch(
        uow.session,
        stmt,
        namespace=namespace if namespaced else None,
        identity=identity,
        fields=fields,
        opt_in=opt_in,
        limit=limit,
    )

    return {
        "rows": rows,
        "aggregate": {
            "count": count,
            "exact": True,
        },
    }

TOOL = {
    "name": "query_client_voucher_handler",
    "permission": "read:voucher",
    "purpose": "내담자 보유 바우처를 내담자·센터 바우처·잔여 회기·잔여 금액·유효기간으로 유연 조회한다.",
    "keywords": [
        "query client voucher",
        "내담자 바우처",
        "보유 바우처",
        "바우처 잔여",
        "잔여 회기",
        "바우처 유효기간",
    ],
    "boundaries": "읽기 전용 내담자 바우처 유연 조회. 내담자 이름은 query_client_handler로 id를 얻어 client_id/client_ids로 전달. 센터 취급 바우처(카탈로그·단가)는 query_center_voucher_handler. 종류별 건수만 group_by=center_voucher_id — 미선언 축은 병렬 조회.",
    "output": "{rows: list면 내담자 바우처(fields 절삭, client_name·center_voucher_name 동반). group_by 시 버킷 {center_voucher_id,center_voucher_name,count}., aggregate: {count(원자 총수), exact, group_by?}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "내담자 필터",
                "description": "이름은 query_client_handler로 id 확인 후 넘긴다.",
            },
            "client_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "내담자 필터 복수",
            },
            "center_voucher_id": {
                "type": "string",
                "format": "uuid",
                "title": "센터 바우처 필터",
            },
            "center_voucher_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "센터 바우처 필터 복수",
            },
            "total_sessions_min": {"type": "integer", "title": "총 회기 수 하한"},
            "total_sessions_max": {"type": "integer", "title": "총 회기 수 상한"},
            "remaining_sessions_min": {
                "type": "integer",
                "title": "잔여 회기 수 하한",
                "description": "'잔여 회기 있는'→1",
            },
            "remaining_sessions_max": {
                "type": "integer",
                "title": "잔여 회기 수 상한",
                "description": "'다 쓴/소진된'→0",
            },
            "total_amount_min": {"type": "integer", "title": "총 금액 하한 (원)"},
            "total_amount_max": {"type": "integer", "title": "총 금액 상한 (원)"},
            "remaining_amount_min": {"type": "integer", "title": "잔여 금액 하한 (원)"},
            "remaining_amount_max": {"type": "integer", "title": "잔여 금액 상한 (원)"},
            "valid_until_from": {
                "type": "string",
                "format": "date",
                "title": "유효기간 만료일 시작",
            },
            "valid_until_to": {
                "type": "string",
                "format": "date",
                "title": "유효기간 만료일 종료",
                "description": "'이번 달 만료'→이번 달 말일",
            },
            "date_from": {"type": "string", "format": "date", "title": "등록일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "등록일 종료"},
            "id": {"type": "string", "format": "uuid", "title": "내담자 바우처 ID"},
            "ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "내담자 바우처 ID 복수",
            },
            "sort": {
                "type": "string",
                "enum": [
                    "latest",
                    "oldest",
                    "total_sessions_high",
                    "total_sessions_low",
                    "remaining_sessions_high",
                    "remaining_sessions_low",
                    "total_amount_high",
                    "total_amount_low",
                    "remaining_amount_high",
                    "remaining_amount_low",
                    "valid_until_earliest",
                    "valid_until_latest",
                ],
                "title": "정렬",
                "description": "'최신순'→latest(기본), '잔여 회기 많은순'→remaining_sessions_high, '잔여 금액 큰순'→remaining_amount_high, '유효기간 임박순'→valid_until_earliest, '유효기간 여유순'→valid_until_latest",
            },
            "limit": {"type": "integer", "title": "최대 개수"},
            "fields": {
                "type": "array",
                "items": {"type": "string"},
                "title": "반환 필드",
            },
            "group_by": {
                "type": "string",
                "enum": ["center_voucher_id", "client_id"],
                "title": "분할 요약 차원",
                "description": "센터바우처(종류)별·내담자별 건수. 전체·한 집합 건수에는 넣지 말고 aggregate.count를 읽는다.",
            },
        },
        "required": [],
    },
}
