"""Examination Services"""
import math
from datetime import datetime, timedelta

from app.core.exceptions import EntityNotFoundException, PermissionDeniedException
from app.modules.examination.common.models import Examination
from app.modules.examination.common.repository import (
    ExaminationBatteryRepository,
    ExaminationRepository,
)
from app.modules.examination.common.schemas import (
    DashboardStats,
    ExaminationBatteryCreate,
    ExaminationBatteryResponse,
    ExaminationCreate,
    ExaminationListResponse,
    ExaminationListWithNamesResponse,
    ExaminationResponse,
    ExaminationSummary,
    ExaminationSummaryWithNames,
    ExaminationUpdate,
)


class ListExaminationsWithNamesService:
    """검사 목록 + 내담자/검사자 이름 조인 (검색 지원)"""

    def __init__(self, repo: ExaminationRepository):
        self.repo = repo

    async def execute(
        self,
        institution_id: str,
        *,
        page: int = 1,
        size: int = 20,
        status: str | None = None,
        exam_type: str | None = None,
        client_id: str | None = None,
        examiner_id: str | None = None,
        search: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> ExaminationListWithNamesResponse:
        skip = (page - 1) * size
        filters = dict(
            status=status, exam_type=exam_type, client_id=client_id,
            examiner_id=examiner_id, search=search,
            date_from=date_from, date_to=date_to,
        )

        rows = await self.repo.list_with_names_by_institution(
            institution_id, skip=skip, limit=size, **filters
        )
        total = await self.repo.count_with_search(institution_id, **filters)

        items = [
            ExaminationSummaryWithNames(
                id=row.exam.id,
                client_id=row.exam.client_id,
                client_name=row.client_name,
                client_birth_date=row.client_birth_date,
                client_gender=row.client_gender,
                examiner_id=row.exam.examiner_id,
                examiner_name=row.examiner_name,
                exam_type=row.exam.exam_type,
                status=row.exam.status,
                battery_id=row.exam.battery_id,
                scheduled_at=row.exam.scheduled_at,
                created_at=row.exam.created_at,
            )
            for row in rows
        ]

        return ExaminationListWithNamesResponse(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total > 0 else 1,
        )


class ListExaminationsService:
    """검사 목록 조회"""
    def __init__(self, repo: ExaminationRepository):
        self.repo = repo

    async def execute(
        self,
        institution_id: str,
        *,
        page: int = 1,
        size: int = 20,
        status: str | None = None,
        exam_type: str | None = None,
        client_id: str | None = None,
    ) -> ExaminationListResponse:
        skip = (page - 1) * size
        kwargs = dict(status=status, exam_type=exam_type, client_id=client_id)

        items = await self.repo.list_by_institution(
            institution_id, skip=skip, limit=size, **kwargs
        )
        total = await self.repo.count_by_institution(institution_id, **kwargs)

        return ExaminationListResponse(
            items=[ExaminationSummary.model_validate(e) for e in items],
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total > 0 else 1,
        )


class GetExaminationService:
    """검사 상세 조회"""
    def __init__(self, repo: ExaminationRepository):
        self.repo = repo

    async def fetch(
        self,
        exam_id: str,
        institution_id: str,
        *,
        require_examiner_id: str | None = None,
    ) -> Examination:
        """권한 검증까지 마친 ORM 객체를 돌려준다.

        진행 상황을 덧붙이려면 Facade가 원본 객체(exam_type, result_data)를
        봐야 해서 DTO 변환 전 단계를 열어 둔다.
        """
        exam = await self.repo.get(exam_id)
        if not exam:
            raise EntityNotFoundException(f"검사를 찾을 수 없습니다: {exam_id}")
        if exam.institution_id != institution_id:
            raise PermissionDeniedException("해당 기관의 검사가 아닙니다.")
        if require_examiner_id is not None and exam.examiner_id != require_examiner_id:
            raise PermissionDeniedException("본인이 담당하는 검사가 아닙니다.")
        return exam

    async def execute(
        self,
        exam_id: str,
        institution_id: str,
        *,
        require_examiner_id: str | None = None,
    ) -> ExaminationResponse:
        exam = await self.fetch(
            exam_id, institution_id, require_examiner_id=require_examiner_id
        )
        return ExaminationResponse.model_validate(exam)


class CreateExaminationService:
    """검사 생성"""
    def __init__(self, repo: ExaminationRepository):
        self.repo = repo

    async def execute(
        self,
        institution_id: str,
        data: ExaminationCreate,
        *,
        require_examiner_id: str | None = None,
    ) -> ExaminationResponse:
        if require_examiner_id is not None and data.examiner_id != require_examiner_id:
            raise PermissionDeniedException("본인 외에는 검사자로 지정할 수 없습니다.")
        exam = await self.repo.create({
            "institution_id": institution_id,
            "client_id": data.client_id,
            "examiner_id": data.examiner_id,
            "exam_type": data.exam_type,
            "status": "created",
            "scheduled_at": data.scheduled_at,
            "note": data.note,
        })
        return ExaminationResponse.model_validate(exam)


class CreateBatteryService:
    """검사 배터리 생성 — 배터리 1개 + 검사 유형별 검사 N개를 한 번에 생성"""
    def __init__(
        self,
        battery_repo: ExaminationBatteryRepository,
        exam_repo: ExaminationRepository,
    ):
        self.battery_repo = battery_repo
        self.exam_repo = exam_repo

    async def execute(
        self,
        institution_id: str,
        data: ExaminationBatteryCreate,
        *,
        require_examiner_id: str | None = None,
    ) -> ExaminationBatteryResponse:
        if require_examiner_id is not None and data.examiner_id != require_examiner_id:
            raise PermissionDeniedException("본인 외에는 검사자로 지정할 수 없습니다.")

        battery = await self.battery_repo.create({
            "institution_id": institution_id,
            "client_id": data.client_id,
            "examiner_id": data.examiner_id,
            "name": data.name,
            "status": "created",
            "note": data.note,
        })

        exams: list[ExaminationSummary] = []
        for exam_type in data.exam_types:
            exam = await self.exam_repo.create({
                "institution_id": institution_id,
                "client_id": data.client_id,
                "examiner_id": data.examiner_id,
                "exam_type": exam_type,
                "status": "created",
                "scheduled_at": data.scheduled_at,
                "note": data.note,
                "battery_id": battery.id,
            })
            exams.append(ExaminationSummary.model_validate(exam))

        return ExaminationBatteryResponse(
            id=battery.id,
            institution_id=battery.institution_id,
            client_id=battery.client_id,
            examiner_id=battery.examiner_id,
            name=battery.name,
            status=battery.status,
            examinations=exams,
            created_at=battery.created_at,
        )


class UpdateExaminationService:
    """검사 수정"""
    def __init__(self, repo: ExaminationRepository):
        self.repo = repo

    async def execute(
        self,
        exam_id: str,
        institution_id: str,
        data: ExaminationUpdate,
        *,
        require_examiner_id: str | None = None,
    ) -> ExaminationResponse:
        from app.modules.examination.common.state_machine import validate_transition

        exam = await self.repo.get(exam_id)
        if not exam:
            raise EntityNotFoundException(f"검사를 찾을 수 없습니다: {exam_id}")
        if exam.institution_id != institution_id:
            raise PermissionDeniedException("해당 기관의 검사가 아닙니다.")
        if require_examiner_id is not None and exam.examiner_id != require_examiner_id:
            raise PermissionDeniedException("본인이 담당하는 검사가 아닙니다.")

        update_data = data.model_dump(exclude_unset=True)

        if update_data:
            new_status = update_data.get("status")
            if new_status is not None and new_status != exam.status:
                validate_transition(exam.status, new_status)
            for key, value in update_data.items():
                setattr(exam, key, value)
            await self.repo.flush()
            await self.repo.refresh(exam)

        return ExaminationResponse.model_validate(exam)


class GetDashboardStatsService:
    """대시보드 통계 조회"""
    def __init__(self, repo: ExaminationRepository):
        self.repo = repo

    STALE_REVIEW_DAYS = 5

    async def execute(
        self,
        institution_id: str,
        *,
        examiner_id: str | None = None,
        now: datetime | None = None,
    ) -> DashboardStats:
        now = now or datetime.now()

        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        # 일요일 시작 기준 — weekday()는 월=0이라 (weekday()+1)%7 만큼 되돌린다
        week_start = today_start - timedelta(days=(today_start.weekday() + 1) % 7)
        stale_cutoff = now - timedelta(days=self.STALE_REVIEW_DAYS)

        status_counts = await self.repo.count_by_status(
            institution_id, examiner_id=examiner_id
        )
        today_scheduled = await self.repo.count_scheduled_between(
            institution_id, today_start, today_end, examiner_id=examiner_id
        )
        week_completed = await self.repo.count_completed_since(
            institution_id, week_start, examiner_id=examiner_id
        )
        stale_reviews = await self.repo.count_stale_reviews(
            institution_id, stale_cutoff, examiner_id=examiner_id
        )
        total = sum(status_counts.values())

        return DashboardStats(
            total=total,
            created=status_counts.get("created", 0),
            in_progress=status_counts.get("in_progress", 0),
            ai_draft_ready=status_counts.get("ai_draft_ready", 0),
            under_review=status_counts.get("under_review", 0),
            confirmed=status_counts.get("confirmed", 0),
            report_generated=status_counts.get("report_generated", 0),
            completed=status_counts.get("completed", 0),
            today_scheduled=today_scheduled,
            week_completed=week_completed,
            stale_reviews=stale_reviews,
        )
