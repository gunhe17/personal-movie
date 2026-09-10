"""query_form_template — 양식 템플릿 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import or_, select

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.form.template.models import FormTemplate
from app.infrastructure.persistence.agent_query import fetch


async def query_form_template_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 센터 공용 양식, 행 필터 없음
    name: str | None = None,
    is_active: bool | None = None,
    status: str | None = None,
    version: int | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    sort: str | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "form_template"
    identity = (
        "id",
        "name",
    )
    opt_in = (  # select엔 있으나 기본 출력에선 빠짐 — fields로만
        "version",
    )
    sorts = {
        "latest": FormTemplate.created_at.desc(),
        "oldest": FormTemplate.created_at.asc(),
    }

    # filters — include_system=True 고정(구 facade 기본): 센터 + 시스템(center_id IS NULL)
    where = [
        FormTemplate.deleted_at.is_(None),
        or_(
            FormTemplate.center_id == center_id,
            FormTemplate.center_id.is_(None),
        ),
    ]

    if name:
        where.append(FormTemplate.name.ilike(f"%{name}%"))
    if is_active is not None:
        where.append(FormTemplate.is_active == is_active)
    if status:
        where.append(FormTemplate.status == status)
    if version is not None:
        where.append(FormTemplate.version == version)
    if date_from:
        where.append(FormTemplate.created_at >= coerce_date(date_from, "date_from"))
    if date_to:
        where.append(FormTemplate.created_at <= datetime.combine(coerce_date(date_to, "date_to"), time.max))

    # scope
    # 센터 공용(+시스템) — owner_scope 행 필터 없음

    # project
    # sort 미지정 기본 = name → version DESC (repo 동치)
    if sort in sorts:
        order = (sorts[sort], FormTemplate.id)
    else:
        order = (FormTemplate.name.asc(), FormTemplate.version.desc(), FormTemplate.id)

    stmt = (
        select(
            FormTemplate.id,
            FormTemplate.name,
            FormTemplate.version,
            FormTemplate.is_active,
        )
        .where(*where)
        .order_by(*order)
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
    "name": "query_form_template_handler",
    "permission": "read:form_template",
    "purpose": "양식 템플릿을 이름·활성 여부·버전으로 유연 조회한다.",
    "keywords": [
        "query form template",
        "양식 템플릿",
        "양식 목록",
        "서식 조회",
        "동의서 양식",
    ],
    "boundaries": "양식 '원본'만. 작성/제출된 건은 query_form_instance_handler.",
    "output": "{rows: 템플릿 dict 배열 (fields로 절삭). 정렬: 이름 → 버전 내림차순., aggregate: {count, exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "title": "템플릿 이름 검색"},
            "is_active": {"type": "boolean", "title": "활성 여부"},
            "status": {"type": "string", "title": "상태"},
            "version": {"type": "integer", "title": "버전"},
            "date_from": {"type": "string", "format": "date", "title": "생성일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "생성일 종료"},
            "sort": {
                "type": "string",
                "title": "정렬",
                "enum": ["latest", "oldest"],
                "description": "'최신순'→latest, '오래된 순'→oldest",
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
