from datetime import date, datetime, time

from sqlalchemy import func, select

from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import (
    FieldNote,
    FieldNoteDiarizationStatus,
    FieldNoteNoteStatus,
    FieldNotePipelineStep,
    FieldNoteProcessingStatus,
    FieldNoteRefineStatus,
    FieldNoteStatus,
    FieldNoteSummaryStatus,
    FieldNoteTranscribeStatus,
)
from ..field_note_audio.models import FieldNoteAudio


class FieldNoteRepository(PostgresRepository[FieldNote]):
    model = FieldNote

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        author_id: uuid_str,
        schedule_id: uuid_str | None = None,
        task_id: uuid_str | None = None,
        note_number: int | None = None,
        status: FieldNoteStatus = FieldNoteStatus.RECORDING,
        total_duration: float = 0.0,
    ) -> FieldNote:
        return await super().add(
            FieldNote(
                center_id=center_id,
                author_id=author_id,
                schedule_id=schedule_id,
                task_id=task_id,
                note_number=note_number,
                status=status,
                total_duration=total_duration,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        field_note_id: uuid_str,
        center_id: uuid_str,
        *,
        schedule_id: uuid_str | None = unset,
        task_id: uuid_str | None = unset,
        status: FieldNoteStatus = unset,
        total_duration: float = unset,
        note_template_type: str | None = unset,
        processing_status: FieldNoteProcessingStatus = unset,
        processing_step: FieldNotePipelineStep | None = unset,
        failed_step: FieldNotePipelineStep | None = unset,
        speaker_map: str | None = unset,
        summary: str | None = unset,
        summary_status: FieldNoteSummaryStatus = unset,
        summary_generated_at: utc_dt | None = unset,
        summary_model: str | None = unset,
        analysis: str | None = unset,
        transcribe_status: FieldNoteTranscribeStatus = unset,
        refine_status: FieldNoteRefineStatus = unset,
        refined_transcript: str | None = unset,
        refinement_model: str | None = unset,
        diarization_status: FieldNoteDiarizationStatus = unset,
        note_status: FieldNoteNoteStatus = unset,
        nonverbal_markers: str | None = unset,
    ) -> FieldNote:
        await self.get_in_center(field_note_id=field_note_id, center_id=center_id)
        updated = await self.update_fields(
            field_note_id,
            schedule_id=schedule_id,
            task_id=task_id,
            status=status,
            total_duration=total_duration,
            note_template_type=note_template_type,
            processing_status=processing_status,
            processing_step=processing_step,
            failed_step=failed_step,
            speaker_map=speaker_map,
            summary=summary,
            summary_status=summary_status,
            summary_generated_at=summary_generated_at,
            summary_model=summary_model,
            analysis=analysis,
            transcribe_status=transcribe_status,
            refine_status=refine_status,
            refined_transcript=refined_transcript,
            refinement_model=refinement_model,
            diarization_status=diarization_status,
            note_status=note_status,
            nonverbal_markers=nonverbal_markers,
        )
        assert updated is not None
        return updated

    @typecheck
    async def remove_in_center(
        self,
        field_note_id: uuid_str,
        center_id: uuid_str,
    ) -> FieldNote | None:
        field_note = await self.find_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
        )
        if field_note is None:
            return None
        return await self.remove_by_id(field_note_id)

    # #
    # query

    @typecheck
    async def find_in_center(
        self,
        field_note_id: uuid_str,
        center_id: uuid_str,
    ) -> FieldNote | None:
        return await self._find(
            where=[
                FieldNote.id == field_note_id,
                FieldNote.center_id == center_id,
            ]
        )

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        status: str | None = None,
        processing_status: str | None = None,
        has_summary: bool | None = None,
        keyword: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        ids: list[str] | None = None,
        author_ids: list[str] | None = None,
        schedule_ids: list[str] | None = None,
        task_id: str | None = None,
    ) -> tuple[list[FieldNote], int]:
        # dependent 엔티티 — 앵커(author/schedule/id) 없이는 센터 전체 녹음 덤프 금지
        if not (ids or author_ids or schedule_ids):
            return [], 0
        where = [FieldNote.center_id == center_id]
        if ids:
            where.append(FieldNote.id.in_(ids))
        if author_ids:
            where.append(FieldNote.author_id.in_(author_ids))
        if schedule_ids:
            where.append(FieldNote.schedule_id.in_(schedule_ids))
        if task_id is not None:
            where.append(FieldNote.task_id == task_id)
        if status:
            where.append(FieldNote.status == status)
        if processing_status:
            where.append(FieldNote.processing_status == processing_status)
        if has_summary is True:
            where.append(FieldNote.summary.isnot(None))
        elif has_summary is False:
            where.append(FieldNote.summary.is_(None))
        if keyword:
            where.append(FieldNote.summary.ilike(f"%{keyword}%"))
        if date_from:
            where.append(FieldNote.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(FieldNote.created_at <= datetime.combine(date_to, time.max))
        col, descending = resolve_sort(sort)
        rows = await self._filter(
            where=where, order_by=col, descending=descending, limit=limit
        )
        total = await self._count(where=where)
        return rows, total

    @typecheck
    async def get_in_center(
        self,
        field_note_id: uuid_str,
        center_id: uuid_str,
    ) -> FieldNote:
        field_note = await self.find_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
        )
        if field_note is None:
            raise EntityNotFoundException(
                f"필드노트를 찾을 수 없습니다: {field_note_id}"
            )
        return field_note

    @typecheck
    async def find_by_schedule_in_center(
        self,
        schedule_id: uuid_str,
        center_id: uuid_str,
    ) -> FieldNote | None:
        return await self._find(
            where=[
                FieldNote.schedule_id == schedule_id,
                FieldNote.center_id == center_id,
            ]
        )

    @typecheck
    async def find_by_task_in_center(
        self,
        task_id: uuid_str,
        center_id: uuid_str,
    ) -> FieldNote | None:
        return await self._find(
            where=[
                FieldNote.task_id == task_id,
                FieldNote.center_id == center_id,
            ]
        )

    @typecheck
    async def list_by_task_in_center(
        self,
        task_id: uuid_str,
        center_id: uuid_str,
    ) -> list[FieldNote]:
        return await self._filter(
            where=[
                FieldNote.task_id == task_id,
                FieldNote.center_id == center_id,
            ],
            order_by="created_at",
            descending=True,
        )


    @typecheck
    async def list_linked_task_ids(
        self,
        center_id: uuid_str,
    ) -> set[str]:
        stmt = select(FieldNote.task_id).where(
            FieldNote.task_id.is_not(None),
            FieldNote.center_id == center_id,
            FieldNote.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return {row[0] for row in result.all()}

    @typecheck
    async def next_note_number(
        self,
        center_id: uuid_str,
        author_id: uuid_str,
    ) -> int:
        # max는 삭제분 포함(deleted_at 필터 없음) — 번호 재사용 방지(단조 증가)
        stmt = select(func.max(FieldNote.note_number)).where(
            FieldNote.center_id == center_id,
            FieldNote.author_id == author_id,
        )
        result = await self._session.execute(stmt)
        return result.scalar() or 0

    @typecheck
    async def list_unlinked_in_center(
        self,
        center_id: uuid_str,
        *,
        author_id: uuid_str | None = None,
        analysis_state: str | None = None,
    ) -> list[FieldNote]:
        where = [
            FieldNote.center_id == center_id,
            FieldNote.schedule_id.is_(None),
            FieldNote.task_id.is_(None),
        ]
        if author_id:
            where.append(FieldNote.author_id == author_id)
        if analysis_state:
            self._apply_analysis_state(where, analysis_state)
        return await self._filter(
            where=where,
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_statuses_by_schedule_ids_in_center(
        self,
        schedule_ids: list[str],
        center_id: uuid_str,
    ) -> list[FieldNote]:
        if not schedule_ids:
            return []
        return await self._filter(
            where=[
                FieldNote.schedule_id.in_(schedule_ids),
                FieldNote.center_id == center_id,
            ],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_completed_with_summary_by_schedule_ids_in_center(
        self,
        schedule_ids: list[str],
        center_id: uuid_str,
        *,
        limit: int = 3,
    ) -> list[FieldNote]:
        if not schedule_ids:
            return []
        return await self._filter(
            where=[
                FieldNote.schedule_id.in_(schedule_ids),
                FieldNote.center_id == center_id,
                FieldNote.status == "completed",
                FieldNote.summary.isnot(None),
                FieldNote.summary != "",
            ],
            order_by="created_at",
            descending=True,
            limit=limit,
        )

    @typecheck
    async def list_by_author_ids_in_center(
        self,
        author_ids: list[str],
        center_id: uuid_str,
    ) -> list[FieldNote]:
        if not author_ids:
            return []
        return await self._filter(
            where=[
                FieldNote.author_id.in_(author_ids),
                FieldNote.center_id == center_id,
            ],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_in_center_with_page(
        self,
        center_id: uuid_str,
        *,
        status: str | None = None,
        processing_status: str | None = None,
        analysis_state: str | None = None,
        linked: bool | None = None,
        link_type: str | None = None,
        author_id: uuid_str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[FieldNote], Page]:
        where = [FieldNote.center_id == center_id]
        if status:
            where.append(FieldNote.status == status)
        if analysis_state:
            self._apply_analysis_state(where, analysis_state)
        elif processing_status:
            statuses = [s.strip() for s in processing_status.split(",")]
            if len(statuses) == 1:
                where.append(FieldNote.processing_status == statuses[0])
            else:
                where.append(FieldNote.processing_status.in_(statuses))
        if link_type == "schedule":
            where.append(FieldNote.schedule_id.isnot(None))
        elif link_type == "task":
            where.append(FieldNote.task_id.isnot(None))
        elif link_type == "none":
            where.append(FieldNote.schedule_id.is_(None) & FieldNote.task_id.is_(None))
        elif linked is True:
            where.append(FieldNote.schedule_id.isnot(None) | FieldNote.task_id.isnot(None))
        elif linked is False:
            where.append(FieldNote.schedule_id.is_(None) & FieldNote.task_id.is_(None))
        if author_id:
            where.append(FieldNote.author_id == author_id)
        return await self._page(
            where=where,
            order_by="created_at",
            descending=True,
            page=page,
            size=size,
        )


    @typecheck
    async def aggregate_audio_candidates_for_lab(
        self,
        *,
        limit: int = 50,
    ) -> list[tuple]:
        stmt = (
            select(
                FieldNoteAudio.field_note_id.label("field_note_id"),
                func.count().label("chunk_count"),
                func.coalesce(func.sum(FieldNoteAudio.duration), 0).label("duration"),
                func.max(FieldNote.transcribe_status).label("transcribe_status"),
                func.max(FieldNote.diarization_status).label("diarization_status"),
                func.max(FieldNote.created_at).label("created_at"),
            )
            .join(FieldNote, FieldNote.id == FieldNoteAudio.field_note_id)
            .where(
                FieldNoteAudio.storage_path.isnot(None),
                FieldNoteAudio.duration > 0,
                FieldNoteAudio.deleted_at.is_(None),
                FieldNote.transcribe_status == "completed",
                FieldNote.deleted_at.is_(None),
            )
            .group_by(FieldNoteAudio.field_note_id)
            .order_by(func.max(FieldNote.created_at).desc())
            .limit(limit)
        )
        return list((await self._session.execute(stmt)).all())

    # #
    # helpers

    @staticmethod
    def _apply_analysis_state(where: list, analysis_state: str) -> None:
        if analysis_state == "completed":
            where.append(FieldNote.transcribe_status == "completed")
            where.append(FieldNote.processing_status.notin_(["processing", "failed"]))
        elif analysis_state == "processing":
            where.append(FieldNote.processing_status == "processing")
        elif analysis_state == "unanalyzed":
            where.append(FieldNote.transcribe_status != "completed")
            where.append(FieldNote.processing_status.notin_(["processing", "failed"]))
        elif analysis_state == "failed":
            where.append(FieldNote.processing_status == "failed")
