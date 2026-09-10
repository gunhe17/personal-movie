from dataclasses import dataclass

from app.core.exceptions import InvalidOperationException
from app.core.type import unset, uuid_str
from app.modules.center.center_note_preference.schemas import VALID_TEMPLATE_TYPES

from ...field_note.events import FieldNoteAtomic
from ...field_note.models import (
    FieldNoteDiarizationStatus,
    FieldNoteNoteStatus,
    FieldNotePipelineStep,
    FieldNoteProcessingStatus,
    FieldNoteRefineStatus,
    FieldNoteSummaryStatus,
    FieldNoteTranscribeStatus,
)
from ...field_note.repository import FieldNoteRepository

NOT_NULL = object()


@dataclass(frozen=True)
class StepResult:
    status: str
    step: str
    field_note_id: str
    message: str


@dataclass(frozen=True)
class _Require:
    field: str
    expected: object
    message: str


@dataclass(frozen=True)
class _Reject:
    field: str
    values: tuple[str, ...]
    status: str
    message: str


@dataclass(frozen=True)
class _StepDef:
    require: tuple[_Require, ...]
    reject: tuple[_Reject, ...]
    target: dict
    started_message: str


STEP_DEFS: dict[str, _StepDef] = {
    "transcribe": _StepDef(
        require=(
            _Require(
                "status", "completed", "녹음이 완료된 필드노트만 전사할 수 있습니다."
            ),
        ),
        reject=(
            _Reject(
                "transcribe_status",
                ("processing",),
                "already_processing",
                "이미 전사가 진행 중입니다.",
            ),
        ),
        target={
            "transcribe_status": FieldNoteTranscribeStatus.PROCESSING,
            "processing_status": FieldNoteProcessingStatus.PROCESSING,
            "processing_step": FieldNotePipelineStep.TRANSCRIBING,
        },
        started_message="음성 전사를 시작합니다.",
    ),
    "refine": _StepDef(
        require=(
            _Require(
                "transcribe_status",
                "completed",
                "전사가 완료된 필드노트만 보정할 수 있습니다.",
            ),
        ),
        reject=(
            _Reject(
                "refine_status",
                ("processing",),
                "already_processing",
                "이미 보정이 진행 중입니다.",
            ),
        ),
        target={"refine_status": FieldNoteRefineStatus.PROCESSING},
        started_message="LLM 전사 보정을 시작합니다.",
    ),
    "summary": _StepDef(
        require=(
            _Require(
                "status", "completed", "녹음이 완료된 필드노트만 요약할 수 있습니다."
            ),
            _Require(
                "transcribe_status",
                "completed",
                "전사가 완료된 필드노트만 요약할 수 있습니다.",
            ),
        ),
        reject=(
            _Reject(
                "summary_status",
                ("generating",),
                "already_processing",
                "이미 요약이 진행 중입니다.",
            ),
        ),
        target={"summary_status": FieldNoteSummaryStatus.GENERATING},
        started_message="AI 요약 생성을 시작합니다.",
    ),
    "diarize": _StepDef(
        require=(
            _Require(
                "transcribe_status",
                "completed",
                "전사가 완료된 필드노트만 화자분리할 수 있습니다.",
            ),
        ),
        reject=(
            _Reject(
                "diarization_status",
                ("completed",),
                "already_done",
                "이미 화자분리가 완료되었습니다.",
            ),
            _Reject(
                "diarization_status",
                ("processing",),
                "already_processing",
                "이미 화자분리가 진행 중입니다.",
            ),
        ),
        target={"diarization_status": FieldNoteDiarizationStatus.PROCESSING},
        started_message="화자분리를 시작합니다.",
    ),
    "counseling_note": _StepDef(
        require=(
            _Require(
                "status",
                "completed",
                "녹음이 완료된 필드노트만 상담일지를 생성할 수 있습니다.",
            ),
            _Require(
                "schedule_id",
                NOT_NULL,
                "일정에 연결된 필드노트만 상담일지를 생성할 수 있습니다.",
            ),
            _Require(
                "transcribe_status",
                "completed",
                "전사가 완료된 필드노트만 상담일지를 생성할 수 있습니다.",
            ),
        ),
        reject=(
            _Reject(
                "note_status",
                ("processing",),
                "already_processing",
                "이미 상담일지 생성이 진행 중입니다.",
            ),
        ),
        target={"note_status": FieldNoteNoteStatus.PROCESSING},
        started_message="상담일지 생성을 시작합니다.",
    ),
}


class PreparePipelineStepService:
    def __init__(
        self,
        repo: FieldNoteRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        field_note_id: uuid_str,
        center_id: uuid_str,
        *,
        step: str,
        note_template_type: str | None = None,
    ) -> tuple[FieldNoteAtomic | None, StepResult]:
        spec = STEP_DEFS[step]

        # load
        field_note = await self.repo.get_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
        )

        # verify
        for rule in spec.require:
            value = getattr(field_note, rule.field)
            satisfied = (
                value is not None
                if rule.expected is NOT_NULL
                else value == rule.expected
            )
            if not satisfied:
                return None, StepResult(
                    "precondition_not_met", step, field_note_id, rule.message
                )
        for reject in spec.reject:
            if getattr(field_note, reject.field) in reject.values:
                return None, StepResult(
                    reject.status, step, field_note_id, reject.message
                )
        if (
            step == "counseling_note"
            and note_template_type is not None
            and note_template_type not in VALID_TEMPLATE_TYPES
        ):
            raise InvalidOperationException(
                f"유효하지 않은 서식 타입입니다: {note_template_type}. "
                f"허용값: {', '.join(sorted(VALID_TEMPLATE_TYPES))}"
            )

        # transition
        updates = dict(spec.target)
        if step == "counseling_note":
            updates["note_template_type"] = (
                note_template_type if note_template_type is not None else unset
            )
        field_note = await self.repo.update_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
            **updates,
        )

        # return
        atomic, _ = FieldNoteAtomic.updated(
            field_note=field_note,
            changed={k: v for k, v in updates.items() if v is not unset},
        )
        return atomic, StepResult("started", step, field_note_id, spec.started_message)
