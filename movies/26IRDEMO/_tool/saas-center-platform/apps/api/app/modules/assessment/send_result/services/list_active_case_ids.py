from ..repository import AssessmentSendResultRepository


class ListActiveCaseIdsService:
    # 캐러셀 "검사 결과 미공유" 신호에서 차집합 판정에 사용.

    def __init__(self, repo: AssessmentSendResultRepository):
        self.repo = repo

    async def execute(self, case_ids: list[str]) -> set[str]:
        # return
        return await self.repo.list_active_case_id_set(case_ids=case_ids)
