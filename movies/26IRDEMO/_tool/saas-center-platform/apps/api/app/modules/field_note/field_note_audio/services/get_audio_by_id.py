from app.core.exceptions import EntityNotFoundException
from ..repository import FieldNoteAudioRepository
from ..models import FieldNoteAudio


class GetAudioByIdService:
    def __init__(self, repo: FieldNoteAudioRepository):
        self.repo = repo

    async def execute(
        self,
        audio_id: str,
        field_note_id: str,
    ) -> FieldNoteAudio:
        # load
        audio = await self.repo.find_by_id(audio_id)

        # verify
        if not audio or audio.field_note_id != field_note_id:
            raise EntityNotFoundException(f"오디오를 찾을 수 없습니다: {audio_id}")

        # return
        return audio
