from app.modules.assessment.center_assessment.schemas import CenterAssessmentWithAssessment
from app.modules.platform_admin.center_assessment.repository import AdminCenterAssessmentRepository


class ListCenterAssessmentsService:
    def __init__(self, repo: AdminCenterAssessmentRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        search: str | None = None,
        is_active: bool | None = None,
    ) -> list[CenterAssessmentWithAssessment]:
        # 1. CenterAssessment 목록
        ca_rows = await self.repo.list_by_center(center_id, is_active=is_active)
        if not ca_rows:
            return []

        # 2. Assessment 정보 조인
        assessment_ids = [ca.assessment_id for ca in ca_rows]
        a_map = await self.repo.aggregate_assessments_by_ids(assessment_ids)

        # 3. 조합 + 검색 필터
        results = []
        for ca in ca_rows:
            a = a_map.get(ca.assessment_id)
            if not a:
                continue

            if search:
                term = search.lower()
                if (
                    term not in (a.kor_name or "").lower()
                    and term not in (a.eng_name or "").lower()
                    and term not in (a.code or "").lower()
                ):
                    continue

            results.append(CenterAssessmentWithAssessment(
                center_id=ca.center_id,
                assessment_id=ca.assessment_id,
                is_active=ca.is_active,
                code=a.code,
                kor_name=a.kor_name,
                eng_name=a.eng_name,
                assessment_type=a.assessment_type,
                duration=a.duration,
                status=a.status,
                supports_online=a.supports_online,
                created_at=ca.created_at,
                updated_at=ca.updated_at,
            ))

        return results
