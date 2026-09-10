"""query_counseling_note — 상담 노트 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date

from sqlalchemy import Date as SQLDate
from sqlalchemy import String, cast, literal, select
from sqlalchemy.sql import case, func

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.member.models import Member
from app.modules.client.profile.models import Client
from app.modules.counseling.counseling_case.models import CounselingCase
from app.modules.counseling.counseling_note.models import CounselingNote
from app.modules.counseling.counseling_session.models import CounselingSession
from app.modules.person.person.models import Person
from app.infrastructure.persistence.agent_query import fetch


async def query_counseling_note_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,
    keyword: str | None = None,
    client_id: str | None = None,
    client_ids: list[str] | None = None,
    author_id: str | None = None,
    counseling_session_id: str | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    sort: str | None = None,
    limit: int | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "note"
    # D13 쌍 — client_name·author_name의 원천 id는 fields 절삭과 무관하게 동반
    identity = (
        "id",
        "summary",
        "created_at",
        "client_id",
        "author_id",
    )
    opt_in = ("content",)  # select엔 있으나 기본 출력에선 빠짐 — fields로만
    sorts = {
        "latest": CounselingNote.created_at.desc(),
        "oldest": CounselingNote.created_at.asc(),
    }
    out_of_scope = (
        "요청한 대상은 내 조회 권한 범위 밖입니다 — 본인 담당/작성 데이터만 조회됩니다. "
        "그대로 사용자에게 알리세요."
    )

    # scope — own = 본인 작성. 타인 author_id는 빈 봉투+notice (조용한 치환 금지, L2)
    if owner_scope is not None:
        if author_id and author_id != owner_scope:
            return {
                "rows": [],
                "aggregate": {"count": 0, "exact": True},
                "notice": out_of_scope,
            }
        author_id = owner_scope

    # 앵커 없이는 센터 전체 노트 덤프 금지 (구 repo 규약)
    all_client_ids = [*(client_ids or []), *([client_id] if client_id else [])]
    if not (author_id or counseling_session_id or all_client_ids):
        return {"rows": [], "aggregate": {"count": 0, "exact": True}}

    # filters
    where = [
        CounselingNote.center_id == center_id,
        CounselingNote.deleted_at.is_(None),
    ]

    if author_id:
        where.append(CounselingNote.author_id == author_id)
    if counseling_session_id:
        where.append(CounselingNote.counseling_session_id == counseling_session_id)
    if all_client_ids:
        where.append(CounselingNote.client_id.in_(all_client_ids))
    if keyword:
        where.append(CounselingNote.summary.ilike(f"%{keyword}%"))
    if date_from:
        where.append(
            cast(CounselingNote.created_at, SQLDate) >= coerce_date(date_from, "date_from")
        )
    if date_to:
        where.append(
            cast(CounselingNote.created_at, SQLDate) <= coerce_date(date_to, "date_to")
        )

    # project
    # "{case_code} · {n}회기" — CounselingAgentFacade._resolve_session_names 동치
    session_part = case(
        (
            CounselingSession.session_number.isnot(None),
            cast(CounselingSession.session_number, String).concat(literal("회기")),
        ),
    )
    counseling_session_name = func.nullif(
        func.concat_ws(" · ", CounselingCase.case_code, session_part),
        "",
    )

    stmt = (
        select(
            CounselingNote.id,
            CounselingNote.summary,
            CounselingNote.content,
            CounselingNote.created_at,
            CounselingNote.counseling_session_id,
            CounselingNote.client_id,
            CounselingNote.author_id,
            Client.name.label("client_name"),
            Person.name.label("author_name"),
            counseling_session_name.label("counseling_session_name"),
        )
        .outerjoin(Client, Client.id == CounselingNote.client_id)
        .outerjoin(Member, Member.id == CounselingNote.author_id)
        .outerjoin(Person, Person.id == Member.person_id)
        .outerjoin(
            CounselingSession,
            CounselingSession.id == CounselingNote.counseling_session_id,
        )
        .outerjoin(
            CounselingCase,
            CounselingCase.id == CounselingSession.counseling_case_id,
        )
        .where(*where)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), CounselingNote.id)
    )

    # return
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
    "name": "query_counseling_note_handler",
    "permission": "read:counseling_note",
    "purpose": "상담 노트를 내담자·작성자·키워드·기간으로 유연 조회한다.",
    "keywords": [
        "query counseling note",
        "상담 노트",
        "노트 조회",
        "상담 기록",
        "회기 노트",
    ],
    "boundaries": "읽기 전용 노트 조회. 노트는 client_id를 직접 가지므로 내담자→노트는 participant 경유 없이 client_id로 1홉 직행(query_client_handler로 id 확인 후). author_id는 '~가 쓴' 표현일 때만.",
    "output": "{rows: 노트 dict 배열 (fields로 절삭). 기본 정렬: created_at 최신순(desc). 행에 author_name·client_name·counseling_session_name(케이스코드·회기) 동반., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "keyword": {"type": "string", "title": "요약 키워드 검색"},
            "client_id": {"type": "string", "format": "uuid", "title": "내담자 UUID"},
            "client_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "내담자 UUID 목록",
            },
            "author_id": {
                "type": "string",
                "format": "uuid",
                "title": "작성 상담사 UUID",
                "description": "'~가 쓴' 표현일 때만",
            },
            "counseling_session_id": {
                "type": "string",
                "format": "uuid",
                "title": "회기 UUID",
            },
            "date_from": {"type": "string", "format": "date", "title": "기간 시작일"},
            "date_to": {"type": "string", "format": "date", "title": "기간 종료일"},
            "sort": {
                "type": "string",
                "enum": ["latest", "oldest"],
                "title": "정렬",
                "description": "'최신순/마지막'→latest(기본), '오래된 순'→oldest",
            },
            "limit": {
                "type": "integer",
                "title": "최대 개수",
                "description": "'마지막/최근 노트'는 limit 1",
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
