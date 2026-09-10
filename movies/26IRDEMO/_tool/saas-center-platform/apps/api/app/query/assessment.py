"""query_assessment — 센터 활성 검사 카탈로그 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import or_, select

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.assessment.models import Assessment
from app.modules.assessment.center_assessment.models import CenterAssessment
from app.infrastructure.persistence.agent_query import fetch


async def query_assessment_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 센터 공용 카탈로그, 행 필터 없음
    name: str | None = None,
    code: str | None = None,
    assessment_type: str | None = None,
    workflow_type: str | None = None,
    version: int | None = None,
    supports_online: bool | None = None,
    limit: int | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    sort: str | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "assessment"
    identity = (
        "id",
        "name",
    )
    opt_in = (  # select엔 있으나 기본 출력에선 빠짐 — fields로만
        "kor_name",
        "eng_name",
        "description",
        "duration",
    )
    sorts = {
        "latest": Assessment.created_at.desc(),
        "oldest": Assessment.created_at.asc(),
    }

    # 센터가 활성화한 검사만 — ListCenterAssessmentsService(is_active=True) 동치
    active_assessment_ids = (
        select(CenterAssessment.assessment_id)
        .where(
            CenterAssessment.center_id == center_id,
            CenterAssessment.is_active.is_(True),
            CenterAssessment.deleted_at.is_(None),
        )
    )

    # filters
    where = [
        Assessment.id.in_(active_assessment_ids),
        Assessment.deleted_at.is_(None),
    ]

    if name:
        where.append(
            or_(
                Assessment.kor_name.ilike(f"%{name}%"),
                Assessment.eng_name.ilike(f"%{name}%"),
            )
        )
    if code:
        where.append(Assessment.code.ilike(f"%{code}%"))
    if assessment_type:
        where.append(Assessment.assessment_type == assessment_type)
    if workflow_type:
        where.append(Assessment.workflow_type == workflow_type)
    if version is not None:
        where.append(Assessment.version == str(version))
    if supports_online is not None:
        where.append(Assessment.supports_online.is_(supports_online))
    if date_from:
        where.append(Assessment.created_at >= coerce_date(date_from, "date_from"))
    if date_to:
        where.append(Assessment.created_at <= datetime.combine(coerce_date(date_to, "date_to"), time.max))

    # scope
    # 센터 활성 카탈로그 — owner_scope 행 필터 없음

    # project
    # name = kor_name 표시 별칭(구 facade AVAILABLE의 name; 모델 컬럼은 kor_name)
    # sort 미지정 기본 = kor_name ASC (repo resolve_sort default_col="kor_name")
    stmt = (
        select(
            Assessment.id,
            Assessment.kor_name.label("name"),
            Assessment.code,
            Assessment.assessment_type,
            Assessment.workflow_type,
            Assessment.status,
            Assessment.supports_online,
            Assessment.kor_name,
            Assessment.eng_name,
            Assessment.description,
            Assessment.duration,
        )
        .where(*where)
        .order_by(sorts.get(sort, Assessment.kor_name.asc()), Assessment.id)
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
    "name": "query_assessment_handler",
    "permission": "read:center_assessment",
    "purpose": "센터가 운영하는 심리검사 종류(카탈로그)를 유연 조회한다.",
    "keywords": [
        "query assessment catalog",
        "검사 종류",
        "검사 카탈로그",
        "심리검사 목록",
        "K-WISC",
    ],
    "boundaries": "검사 '종류'만 — 실시 일정 개념은 없음(등록일 필터는 date_from/to). 활성 검사만 조회 — 센터가 활성화한 검사만 나오고 비활성은 대상 아님. 수검자별 검사 건은 query_assessment_case_handler, 실시 일정은 query_assessment_session_handler.",
    "output": "{rows: 검사 정의 dict 배열 (fields로 절삭)., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "title": "검사명 검색"},
            "code": {"type": "string", "title": "검사 코드. 예: K-WISC"},
            "assessment_type": {"type": "string", "title": "검사 유형"},
            "workflow_type": {
                "type": "string",
                "title": "워크플로우",
                "enum": ["self_report", "administered"],
            },
            "version": {"type": "integer", "title": "버전"},
            "supports_online": {"type": "boolean", "title": "온라인 실시 지원 여부"},
            "limit": {"type": "integer", "title": "최대 개수"},
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
