from app.modules.counseling.counseling_case.models import CounselingCaseStatus
from ..events import CounselingCaseAtomic
from ..repository import CounselingCaseRepository
from ..models import CounselingCase
from ..schemas import CreateCounselingCaseCommand


class CreateCounselingCaseService:
    def __init__(self, repo: CounselingCaseRepository):
        self.repo = repo

    async def execute(
        self, command: CreateCounselingCaseCommand
    ) -> tuple[CounselingCaseAtomic, CounselingCase]:
        # load
        case_code = await self.repo.next_case_code(center_id=command.center_id)

        # create
        case = await self.repo.add(
            center_id=command.center_id,
            program_id=command.program_id,
            counselor_id=command.counselor_id,
            case_code=case_code,
            status=CounselingCaseStatus.ACTIVE,
            chief_complaint=command.chief_complaint,
            memo=command.memo,
            total_sessions=command.total_sessions,
            session_rule=command.session_rule,
        )

        # return
        return CounselingCaseAtomic.created(case=case)
