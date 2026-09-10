"""query_form_instance — 양식 제출 건 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import select
from sqlalchemy.orm import aliased
from sqlalchemy.sql import func

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.form.form.models import Form
from app.modules.form.template.models import FormTemplate
from app.modules.person.person.models import Person
from app.infrastructure.persistence.agent_query import fetch


async def query_form_instance_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — read:form_instance 게이트의 센터 단위 조회
    status: str | None = None,
    template_id: str | None = None,
    submitted_from: str | date | None = None,
    submitted_to: str | date | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    sort: str | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "form_instance"
    # D13 쌍 — submitted_by_name 원천. template_name은 facade identity. created_by는 이름 opt-in용
    identity = (
        "id",
        "template_name",
        "submitted_by",
        "created_by",
    )
    opt_in = (
        "created_by",
        "created_by_name",
    )

    sorts = {
        "latest": Form.created_at.desc(),
        "oldest": Form.created_at.asc(),
        "submitted_earliest": Form.submitted_at.asc(),
        "submitted_latest": Form.submitted_at.desc(),
    }

    SubmittedBy = aliased(Person)
    CreatedByPerson = aliased(Person)

    created_from = coerce_date(date_from, "date_from")
    created_to = coerce_date(date_to, "date_to")

    # 앵커(status/template_id/date) 없이는 센터 전체 제출물 스캔 금지 (구 repo 동치)
    if not (status or template_id or created_from or created_to):
        return {"rows": [], "aggregate": {"count": 0, "exact": True}}

    # filters
    where = [
        Form.center_id == center_id,
        Form.deleted_at.is_(None),
    ]

    if status:
        where.append(Form.status == status)
    if template_id:
        where.append(Form.template_id == template_id)
    if created_from:
        where.append(Form.created_at >= datetime.combine(created_from, time.min))
    if created_to:
        where.append(Form.created_at <= datetime.combine(created_to, time.max))

    sub_from = coerce_date(submitted_from, "submitted_from")
    sub_to = coerce_date(submitted_to, "submitted_to")
    if sub_from:
        where.append(Form.submitted_at >= datetime.combine(sub_from, time.min))
    if sub_to:
        where.append(Form.submitted_at <= datetime.combine(sub_to, time.max))

    # scope
    # 센터 단위 조회 — owner_scope 행 필터 없음

    # project
    stmt = (
        select(
            Form.id,
            Form.status,
            Form.submitted_at,
            Form.submitted_by,
            Form.created_by,
            func.coalesce(FormTemplate.name, "").label("template_name"),
            SubmittedBy.name.label("submitted_by_name"),
            CreatedByPerson.name.label("created_by_name"),
        )
        .outerjoin(FormTemplate, FormTemplate.id == Form.template_id)
        .outerjoin(SubmittedBy, SubmittedBy.account_id == Form.submitted_by)
        .outerjoin(CreatedByPerson, CreatedByPerson.account_id == Form.created_by)
        .where(*where)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), Form.id)
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
    "name": "query_form_instance_handler",
    "permission": "read:form_instance",
    "purpose": "작성/제출된 양식 건을 상태·템플릿·기간으로 유연 조회한다.",
    "keywords": [
        "query form instance",
        "제출된 양식",
        "양식 작성 현황",
        "동의서 제출",
        "미제출 양식",
    ],
    "boundaries": "상태·템플릿·기간 중 하나는 필요(무조건 전체 조회 미지원). 양식 원본은 query_form_template_handler.",
    "output": "{rows: 양식 건 dict 배열 (fields로 절삭). 기본 정렬: created_at 최신순. 행에 submitted_by_name(제출자) 동반., aggregate: {count, exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "상태",
                "description": "'제출됨'→submitted, '작성 중'→draft",
            },
            "template_id": {"type": "string", "format": "uuid", "title": "템플릿 UUID"},
            "submitted_from": {
                "type": "string",
                "format": "date",
                "title": "제출일 시작",
            },
            "submitted_to": {
                "type": "string",
                "format": "date",
                "title": "제출일 종료",
            },
            "date_from": {"type": "string", "format": "date", "title": "기간 시작일"},
            "date_to": {"type": "string", "format": "date", "title": "기간 종료일"},
            "sort": {
                "type": "string",
                "title": "정렬",
                "enum": ["latest", "oldest", "submitted_earliest", "submitted_latest"],
                "description": "'최신순'→latest, '오래된 순'→oldest, '제출 이른순'→submitted_earliest, '제출 최근순'→submitted_latest",
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
