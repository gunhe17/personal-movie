from typing import Iterable

from app.modules.assessment.assessment.models import Assessment
from ..schemas import CenterAssessmentWithAssessmentData
from ..models import CenterAssessment


class BuildCenterAssessmentsService:
    def execute(
        self,
        center_assessments: Iterable[CenterAssessment],
        assessments: Iterable[Assessment],
        search: str | None,
        assessment_type: str | None,
    ) -> list[CenterAssessmentWithAssessmentData]:
        assessment_map = {assessment.id: assessment for assessment in assessments}

        combined: list[CenterAssessmentWithAssessmentData] = []
        for center_assessment in center_assessments:
            assessment = assessment_map.get(center_assessment.assessment_id)
            if not assessment:
                continue

            combined.append(
                CenterAssessmentWithAssessmentData(
                    center_id=center_assessment.center_id,
                    assessment_id=center_assessment.assessment_id,
                    is_active=center_assessment.is_active,
                    code=assessment.code,
                    kor_name=assessment.kor_name,
                    eng_name=assessment.eng_name,
                    assessment_type=assessment.assessment_type,
                    duration=assessment.duration,
                    status=assessment.status,
                    supports_online=assessment.supports_online,
                    created_at=center_assessment.created_at,
                    updated_at=center_assessment.updated_at,
                )
            )

        if search:
            search_lower = search.lower()
            combined = [
                item
                for item in combined
                if search_lower in (item.kor_name or "").lower()
                or search_lower in (item.eng_name or "").lower()
                or search_lower in (item.code or "").lower()
            ]

        if assessment_type:
            combined = [item for item in combined if item.assessment_type == assessment_type]

        return combined
