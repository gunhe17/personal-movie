from ..models import CounselingNoteDerivation
from ..repository import CounselingNoteDerivationRepository


class CreateDerivationService:
    """확정 일지에서 뽑아낸 제출 서류 초안 1건을 적재한다.

    공유문(UpsertAiShareService)과 달리 자리를 덮어쓰지 않는다 — 파생은 제출처마다
    한 장씩 생기고(kind 가 다르다), 같은 제출처로 다시 만들면 양식 인스턴스도 새로
    태어나므로 이력을 남기는 편이 맞다. 발행(published)은 한 note×kind 에 하나만
    설 수 있다(모델의 uq_note_derivation_published).
    """

    def __init__(self, repo: CounselingNoteDerivationRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        counseling_note_id: str,
        counseling_session_id: str,
        client_id: str,
        author_id: str,
        kind: str,
        generated_content: dict,
        content: dict,
        llm_call_id: str | None,
    ) -> CounselingNoteDerivation:
        return await self.repo.add(
            center_id=center_id,
            counseling_note_id=counseling_note_id,
            counseling_session_id=counseling_session_id,
            client_id=client_id,
            author_id=author_id,
            kind=kind,
            generated_content=generated_content,
            content=content,
            llm_call_id=llm_call_id,
        )
