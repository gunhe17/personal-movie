from typing import Any, Protocol


class TaskDispatcher(Protocol):
    async def dispatch(
        self,
        job_type: str,
        *,
        field_note_id: str,
        center_id: str,
        params: dict[str, Any] | None = None,
    ) -> None: ...
