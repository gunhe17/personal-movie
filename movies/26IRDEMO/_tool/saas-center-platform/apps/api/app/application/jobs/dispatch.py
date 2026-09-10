from typing import Any, Awaitable, Callable

from app.application.subscription_period_roller import period_roller


async def dispatch_job(
    *,
    job_type: str,
    target_id: str,
    center_id: str,
    params: dict | None,
    table: dict[str, Callable[..., Awaitable[Any]]],
) -> None:
    handler = table.get(job_type)
    if handler is None:
        raise ValueError(f"Unknown job type: {job_type}. Known: {list(table)}")

    # 과금 AI 소비 직전 기간 정산 시임(ai-calling.md) — 전 잡 통과 지점이라 신규 잡도 자동 커버.
    # 무료·admin(center_id="") 잡에도 돌지만 멱등 no-op(구독 부재 시 즉시 반환)이라 무해.
    await period_roller.ensure_current_period(center_id)

    # 첫 인자 positional — executor가 자기 도메인 파라미터명(field_note_id·extraction_id 등)을 유지
    await handler(target_id, center_id=center_id, **(params or {}))
