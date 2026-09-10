"""query_document — 문서 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import select

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.member.models import Member
from app.modules.document.document.models import Document
from app.modules.person.person.models import Person
from app.infrastructure.persistence.agent_query import fetch


async def query_document_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,
    name: str | None = None,
    file_type: str | None = None,
    access_level: str | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    uploader_id: str | None = None,
    file_size_min: int | None = None,
    file_size_max: int | None = None,
    sort: str | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "document"
    # D13 쌍 — uploader_name→uploader_id
    identity = (
        "id",
        "name",
        "uploader_id",
    )
    opt_in = (
        "description",
        "checksum",
        "storage_path",
        "center_id",
    )
    sorts = {
        "latest": Document.created_at.desc(),
        "oldest": Document.created_at.asc(),
        "file_size_high": Document.file_size.desc(),
        "file_size_low": Document.file_size.asc(),
    }

    # scope — own이면 타인 private 비노출: 본인 업로드가 아니면 center 공개분만
    if owner_scope is not None and uploader_id != owner_scope:
        access_level = "center"

    # filters
    where = [
        Document.center_id == center_id,
        Document.deleted_at.is_(None),
    ]

    if name:
        where.append(Document.name.ilike(f"%{name}%"))
    if file_type:
        where.append(Document.file_type.ilike(f"%{file_type}%"))
    if access_level:
        where.append(Document.access_level == access_level)
    if uploader_id:
        where.append(Document.uploader_id == uploader_id)
    if file_size_min is not None:
        where.append(Document.file_size >= file_size_min)
    if file_size_max is not None:
        where.append(Document.file_size <= file_size_max)
    if date_from:
        where.append(
            Document.created_at
            >= datetime.combine(coerce_date(date_from, "date_from"), time.min)
        )
    if date_to:
        where.append(
            Document.created_at
            <= datetime.combine(coerce_date(date_to, "date_to"), time.max)
        )

    # project
    stmt = (
        select(
            Document.id,
            Document.center_id,
            Document.name,
            Document.uploader_id,
            Document.file_type,
            Document.original_name,
            Document.access_level,
            Document.file_size,
            Document.description,
            Document.checksum,
            Document.storage_path,
            Person.name.label("uploader_name"),
        )
        .outerjoin(Member, Member.id == Document.uploader_id)
        .outerjoin(Person, Person.id == Member.person_id)
        .where(*where)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), Document.id)
    )

    # return
    rows, count = await fetch(
        uow.session,
        stmt,
        limit=50,  # 구 facade 상한 — TOOL에 limit이 없어 모델이 못 준다
        namespace=namespace if namespaced else None,
        identity=identity,
        fields=fields,
        opt_in=opt_in,
    )

    return {
        "rows": rows,
        "aggregate": {
            "count": count,
            "exact": True,
        },
    }


TOOL = {
    "name": "query_document_handler",
    "permission": "read:document",
    "purpose": "문서(파일)를 이름·유형·공개범위·기간으로 유연 조회한다.",
    "keywords": [
        "query document",
        "문서 조회",
        "파일 목록",
        "자료 찾기",
        "업로드 문서",
    ],
    "boundaries": "읽기 전용 문서 유연 조회. 파일 내용/다운로드는 별도 도구.",
    "output": "{rows: 문서 dict 배열 (fields로 절삭). 기본 정렬: created_at 최신순. 행에 uploader_name 동반., aggregate: {count, exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "title": "문서명 검색"},
            "file_type": {"type": "string", "title": "파일 유형. 예: pdf, image"},
            "access_level": {
                "type": "string",
                "title": "공개 범위",
                "enum": ["center", "private"],
            },
            "date_from": {"type": "string", "format": "date", "title": "업로드 시작일"},
            "date_to": {"type": "string", "format": "date", "title": "업로드 종료일"},
            "uploader_id": {"type": "string", "format": "uuid", "title": "업로더 UUID"},
            "file_size_min": {"type": "integer", "title": "파일 크기 하한 (bytes)"},
            "file_size_max": {"type": "integer", "title": "파일 크기 상한 (bytes)"},
            "sort": {
                "type": "string",
                "title": "정렬",
                "enum": ["latest", "oldest", "file_size_high", "file_size_low"],
                "description": "'최신순'→latest, '큰 파일순'→file_size_high",
            },
            "fields": {
                "type": "array",
                "items": {"type": "string"},
                "title": "반환 필드",
            },
        },
        "required": [],
    },
}
