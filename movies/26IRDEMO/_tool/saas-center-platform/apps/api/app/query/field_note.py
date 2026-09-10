"""query_field_note — 필드노트 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import literal_column, select
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.orm import aliased
from sqlalchemy.sql import func

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.assessment.models import Assessment
from app.modules.assessment.assessment_case.models import AssessmentCase
from app.modules.assessment.assessment_case_participant.models import (
    AssessmentCaseParticipant,
)
from app.modules.assessment.assessment_session.models import AssessmentSession
from app.modules.assessment.assessment_task.models import AssessmentTask
from app.modules.center.member.models import Member
from app.modules.client.profile.models import Client
from app.modules.counseling.counseling_case_participant.models import (
    CaseParticipantType,
    CounselingCaseParticipant,
)
from app.modules.counseling.counseling_session.models import CounselingSession
from app.modules.field_note.field_note.models import FieldNote
from app.modules.person.person.models import Person
from app.modules.schedule.schedule.models import Schedule
from app.infrastructure.persistence.agent_query import fetch


async def query_field_note_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,
    status: str | None = None,
    processing_status: str | None = None,
    keyword: str | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    schedule_id: str | None = None,
    author_id: str | None = None,
    task_id: str | None = None,
    client_id: str | None = None,
    sort: str | None = None,
    limit: int | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "field_note"
    # D13 쌍 — author_name·schedule_name·task_name·client_names의 원천 id는 fields 절삭과 무관하게 동반
    identity = (
        "id",
        "summary",
        "author_id",
        "schedule_id",
        "task_id",
    )
    opt_in = (  # select엔 있으나 기본 출력에선 빠짐 — fields로만
        "processing_step",
        "failed_step",
        "transcribe_status",
        "refine_status",
        "note_status",
        "summary_status",
        "summary_generated_at",
        "summary_model",
        "total_duration",
        "refined_transcript",
        "speaker_map",
    )
    sorts = {
        "latest": FieldNote.created_at.desc(),
        "oldest": FieldNote.created_at.asc(),
    }
    cancelled = "cancelled"

    def client_schedule_ids(client_id: str):
        """내담자가 참여한 회기의 일정 id (J6 흡수) — 구 구현은 회기를 40건에서 잘랐다."""
        CounselingClientParticipant = aliased(CounselingCaseParticipant)
        AssessmentClientParticipant = aliased(AssessmentCaseParticipant)
        return select(CounselingSession.schedule_id).where(
            CounselingSession.center_id == center_id,
            CounselingSession.schedule_id.isnot(None),
            CounselingSession.deleted_at.is_(None),
            CounselingSession.counseling_case_id.in_(
                select(CounselingClientParticipant.counseling_case_id).where(
                    CounselingClientParticipant.center_id == center_id,
                    CounselingClientParticipant.participant_id == client_id,
                    CounselingClientParticipant.participant_type
                    == CaseParticipantType.CLIENT.value,
                    CounselingClientParticipant.deleted_at.is_(None),
                )
            ),
        ).union(
            select(AssessmentSession.schedule_id).where(
                AssessmentSession.center_id == center_id,
                AssessmentSession.schedule_id.isnot(None),
                AssessmentSession.deleted_at.is_(None),
                AssessmentSession.case_id.in_(
                    select(AssessmentClientParticipant.case_id).where(
                        AssessmentClientParticipant.center_id == center_id,
                        AssessmentClientParticipant.participant_id == client_id,
                        AssessmentClientParticipant.participant_type == "client",
                        AssessmentClientParticipant.deleted_at.is_(None),
                    )
                ),
            )
        )

    def client_names():
        """J4/J6 — 필드노트의 일정 → 회기 → 케이스 → 참여 내담자(상담·검사 두 경로)."""
        # 두 경로를 union으로 감싸면 바깥 FieldNote와의 correlate가 끊긴다 —
        # 경로별 상관 스칼라 서브쿼리 + array_cat으로 유지한다.
        CounselingSess = aliased(CounselingSession)
        CounselingClientParticipant = aliased(CounselingCaseParticipant)
        CounselingClient = aliased(Client)
        counseling = (
            select(
                func.coalesce(
                    func.array_remove(
                        func.array_agg(
                            aggregate_order_by(CounselingClient.name, CounselingClient.id)
                        ),
                        None,
                    ),
                    literal_column("'{}'::text[]"),
                )
            )
            .select_from(CounselingSess)
            .join(
                CounselingClientParticipant,
                (
                    CounselingClientParticipant.counseling_case_id
                    == CounselingSess.counseling_case_id
                )
                & (
                    CounselingClientParticipant.participant_type
                    == CaseParticipantType.CLIENT.value
                )
                & CounselingClientParticipant.is_active.is_(True)
                & CounselingClientParticipant.deleted_at.is_(None),
            )
            .join(
                CounselingClient,
                CounselingClient.id == CounselingClientParticipant.participant_id,
            )
            .where(
                CounselingSess.schedule_id == FieldNote.schedule_id,
                CounselingSess.status != cancelled,
                CounselingSess.deleted_at.is_(None),
            )
            .correlate(FieldNote)
            .scalar_subquery()
        )
        AssessmentSess = aliased(AssessmentSession)
        AssessmentClientParticipant = aliased(AssessmentCaseParticipant)
        AssessmentClient = aliased(Client)
        assessment = (
            select(
                func.coalesce(
                    func.array_remove(
                        func.array_agg(
                            aggregate_order_by(AssessmentClient.name, AssessmentClient.id)
                        ),
                        None,
                    ),
                    literal_column("'{}'::text[]"),
                )
            )
            .select_from(AssessmentSess)
            .join(
                AssessmentClientParticipant,
                (AssessmentClientParticipant.case_id == AssessmentSess.case_id)
                & (AssessmentClientParticipant.participant_type == "client")
                & AssessmentClientParticipant.deleted_at.is_(None),
            )
            .join(
                AssessmentClient,
                AssessmentClient.id == AssessmentClientParticipant.participant_id,
            )
            .where(
                AssessmentSess.schedule_id == FieldNote.schedule_id,
                AssessmentSess.status != cancelled,
                AssessmentSess.deleted_at.is_(None),
            )
            .correlate(FieldNote)
            .scalar_subquery()
        )
        return func.array_cat(counseling, assessment)

    # scope
    if owner_scope is not None:
        author_id = owner_scope  # own = 본인이 작성한 필드노트 (케이스 담당 범위와 다르다)

    # 앵커 없이는 센터 전체 녹음 덤프가 된다(구 repo 규약) — 빈 봉투로 단락.
    # 이 반환은 `# filters`의 coerce_date보다 **먼저**여야 한다: 순서가 뒤집히면
    # "앵커 없음 + 잘못된 날짜"가 빈 봉투 대신 예외가 된다.
    if not (author_id or schedule_id or client_id):
        return {"rows": [], "aggregate": {"count": 0, "exact": True}}

    # filters
    where = [
        FieldNote.center_id == center_id,
        FieldNote.deleted_at.is_(None),
    ]

    if author_id:
        where.append(FieldNote.author_id == author_id)
    if schedule_id:
        where.append(FieldNote.schedule_id == schedule_id)
    if client_id:
        where.append(FieldNote.schedule_id.in_(client_schedule_ids(client_id)))
    if task_id is not None:
        where.append(FieldNote.task_id == task_id)
    if status:
        where.append(FieldNote.status == status)
    if processing_status:
        where.append(FieldNote.processing_status == processing_status)
    if keyword:
        where.append(FieldNote.summary.ilike(f"%{keyword}%"))
    if date_from:
        where.append(
            FieldNote.created_at
            >= datetime.combine(coerce_date(date_from, "date_from"), time.min)
        )
    if date_to:
        where.append(
            FieldNote.created_at
            <= datetime.combine(coerce_date(date_to, "date_to"), time.max)
        )

    # project
    # "MM-DD HH:MM · {title}" — ScheduleFacade.get_schedule_summaries_by_ids 동치
    schedule_name = func.to_char(Schedule.start, "MM-DD HH24:MI").concat(
        func.coalesce(literal_column("' · '").concat(Schedule.title), "")
    )
    # "{case_code} · {kor_name}" — AssessmentTaskFacade.get_assessment_task_summaries_by_ids 동치.
    # concat_ws는 인자가 전부 NULL이면 ''를 준다 — 구 구현은 파트가 없으면 None이었다.
    task_name = func.nullif(
        func.concat_ws(" · ", AssessmentCase.case_code, Assessment.kor_name), ""
    )

    stmt = (
        select(
            FieldNote.id,
            FieldNote.summary,
            FieldNote.schedule_id,
            FieldNote.author_id,
            FieldNote.task_id,
            FieldNote.status,
            FieldNote.processing_status,
            FieldNote.processing_step,
            FieldNote.failed_step,
            FieldNote.transcribe_status,
            FieldNote.refine_status,
            FieldNote.note_status,
            FieldNote.summary_status,
            FieldNote.summary_generated_at,
            FieldNote.summary_model,
            FieldNote.total_duration,
            FieldNote.refined_transcript,
            FieldNote.speaker_map,
            Person.name.label("author_name"),
            schedule_name.label("schedule_name"),
            task_name.label("task_name"),
            client_names().label("client_names"),
        )
        .outerjoin(Member, Member.id == FieldNote.author_id)
        .outerjoin(Person, Person.id == Member.person_id)
        .outerjoin(Schedule, Schedule.id == FieldNote.schedule_id)
        .outerjoin(AssessmentTask, AssessmentTask.id == FieldNote.task_id)
        .outerjoin(AssessmentCase, AssessmentCase.id == AssessmentTask.case_id)
        .outerjoin(Assessment, Assessment.id == AssessmentTask.assessment_id)
        .where(*where)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), FieldNote.id)
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
    "name": "query_field_note_handler",
    "permission": "read:counseling_note",
    "purpose": "필드노트(상담 녹음/전사)를 상태·키워드·기간·관련 내담자로 유연 조회한다.",
    "keywords": [
        "query field note",
        "필드노트",
        "녹음 조회",
        "전사 기록",
        "녹음 내용",
        "내담자 필드노트",
        "관련 필드노트",
    ],
    "boundaries": (
        "client_id=내담자 UUID(관계 흡수 — 이름→query_client 후). "
        "author_id=작성 상담사 UUID only. schedule_id=일정 UUID only. "
        "author_id·schedule_id·client_id·ids 중 필터 앵커 필요(본인 조회는 author 자동). "
        "상담 노트는 query_counseling_note_handler."
    ),
    "output": (
        "{rows: 필드노트 dict 배열 (fields로 절삭). 기본 정렬: created_at 최신순. "
        "행에 author_name·schedule_name·task_name(연결 검사)·client_names(참여 내담자) 동반., "
        "aggregate: {count, exact(false면 하한)}}"
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {"type": "string", "title": "상태"},
            "processing_status": {"type": "string", "title": "처리 상태"},
            "keyword": {"type": "string", "title": "키워드 검색"},
            "date_from": {"type": "string", "format": "date", "title": "기간 시작일"},
            "date_to": {"type": "string", "format": "date", "title": "기간 종료일"},
            "schedule_id": {"type": "string", "format": "uuid", "title": "일정 UUID"},
            "author_id": {
                "type": "string",
                "format": "uuid",
                "title": "작성 상담사 UUID",
                "description": "멤버 UUID only. 내담자 id 금지.",
            },
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "내담자 UUID",
                "description": (
                    "query_client로 이름 해소 후. 참여 일정의 필드노트 직행(서버 조인)."
                ),
            },
            "task_id": {
                "type": "string",
                "title": "검사 작업 id",
                "description": "연결된 검사 작업으로 필터.",
            },
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
