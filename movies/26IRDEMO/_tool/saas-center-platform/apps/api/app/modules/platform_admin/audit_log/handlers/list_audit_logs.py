import json
from datetime import datetime

from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...admin_account.repository import AdminAccountRepository
from ..repository import AdminAuditReadRepository
from ..schemas import AdminAuditLogListResponse, AdminAuditLogResponse


def _summarize(payload: dict) -> str:
    # 구 테이블의 수기 summary 대체 — payload의 data를 짧은 표시 문자열로
    data = payload.get("data") or payload.get("result") or {}
    if not isinstance(data, dict):
        return ""
    parts = [f"{k}={v}" for k, v in data.items() if k != "id" and not isinstance(v, (dict, list))]
    text = ", ".join(parts) if parts else json.dumps(data, ensure_ascii=False)
    return text[:120]


async def list_audit_logs_handler(
    uow: UnitOfWork,
    *,
    search: str | None = None,
    target_type: str | None = None,
    admin_account_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = 1,
    size: int = 20,
) -> AdminAuditLogListResponse:
    account_repo = uow.repo(AdminAccountRepository)

    # 이메일 검색은 계정 선조회 → actor_id 매칭 (구 admin_email ilike 동작 보존)
    search_actor_ids: list[str] = []
    if search:
        search_actor_ids = await account_repo.list_ids_by_email_ilike(search=search)

    rows, total = await uow.repo(AdminAuditReadRepository).list_admin_atomics_with_page(
        search=search,
        search_actor_ids=search_actor_ids,
        target_type=target_type,
        admin_account_id=admin_account_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        size=size,
    )

    actor_ids = list({event.actor_id for _atomic, event in rows if event.actor_id})
    email_map = await account_repo.aggregate_email_map_by_ids(ids=actor_ids)

    items = [
        AdminAuditLogResponse(
            id=atomic.id,
            admin_account_id=event.actor_id or "",
            admin_email=email_map.get(event.actor_id, ""),
            action=f"{atomic.entity_name}.{atomic.act}",
            target_type=atomic.entity_name,
            target_id=atomic.entity_id,
            summary=_summarize(atomic.payload or {}),
            ip_address=event.ip_address,
            extra=atomic.payload,
            created_at=atomic.created_at,
        )
        for atomic, event in rows
    ]
    pages = (total + size - 1) // size if size else 0
    return AdminAuditLogListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


TOOL = {
    "name": "list_audit_logs_handler",
    "permission": None,
    "purpose": "운영자 감사 로그를 검색·기간으로 거르고 조회한다.",
    "keywords": ["감사 로그", "audit log", "운영 기록", "어드민 활동 로그"],
    "boundaries": "운영자 전용 — 감사 로그 목록(읽기, event outbox 기반). 운영자 행위 추적용.",
    "output": "감사 로그 목록 (AdminAuditLogListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "search": {'type': 'string', 'title': '검색어', 'description': '검색어(선택).'},
            "target_type": {'type': 'string', 'title': '대상 유형 필터', 'description': '대상 유형 필터(선택).'},
            "admin_account_id": {'type': 'string', 'format': 'uuid', 'title': '운영자 필터', 'description': '특정 운영자로 필터(선택).'},
            "date_from": {'type': 'string', 'format': 'date-time', 'title': '시작일', 'description': '조회 시작일(선택).'},
            "date_to": {'type': 'string', 'format': 'date-time', 'title': '종료일', 'description': '조회 종료일(선택).'},
            "page": {'type': 'integer', 'title': '페이지', 'minimum': 1, 'description': '페이지 번호(1부터).'},
            "size": {'type': 'integer', 'title': '페이지 크기', 'description': '페이지당 개수.'},
        },
        "required": [],
    },
}
