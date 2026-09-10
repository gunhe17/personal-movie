"""케어보드 시간축 백필 · 정합 재구축.

`(source_table, source_id, client_id)` partial unique 덕에 **멱등**이다 — 소급 이행과
정합 크론이 같은 스크립트다. 반응 배선이 누락돼 생긴 구멍도 다음 실행에서 메워진다.

    uv run python -m scripts.backfill_care_board                 # 전 센터
    uv run python -m scripts.backfill_care_board --center <id>   # 한 센터
    uv run python -m scripts.backfill_care_board --client <id>   # 한 내담자
"""

import argparse
import asyncio

from sqlalchemy import text

from app.application.handlers.care_board import rebuild_care_board_handler
from app.infrastructure.persistence.unit_of_work import transactional_uow


async def _targets(uow, center_id: str | None, client_id: str | None) -> list[tuple[str, str]]:
    if client_id:
        row = (
            await uow.session.execute(
                text("SELECT center_id, id FROM clients WHERE id = :c AND deleted_at IS NULL"),
                {"c": client_id},
            )
        ).first()
        return [(row[0], row[1])] if row else []

    stmt = "SELECT center_id, id FROM clients WHERE deleted_at IS NULL"
    params: dict = {}
    if center_id:
        stmt += " AND center_id = :center"
        params["center"] = center_id
    stmt += " ORDER BY created_at"
    return [(r[0], r[1]) for r in (await uow.session.execute(text(stmt), params)).all()]


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--center")
    parser.add_argument("--client")
    args = parser.parse_args()

    async with transactional_uow() as uow:
        targets = await _targets(uow, args.center, args.client)

    print(f"대상 내담자 {len(targets)}명")
    total = 0
    failed: list[str] = []
    for index, (center, client) in enumerate(targets, start=1):
        # 내담자당 독립 트랜잭션 — 한 명이 실패해도 나머지가 멈추지 않는다
        try:
            async with transactional_uow() as uow:
                total += await rebuild_care_board_handler(
                    center_id=center, client_id=client, uow=uow
                )
        except Exception as error:
            failed.append(f"{client}: {error}")
        if index % 20 == 0:
            print(f"  {index}/{len(targets)} · 누적 {total}행")

    print(f"완료 — {total}행 기록, 실패 {len(failed)}건")
    for line in failed[:10]:
        print("  실패:", line)


if __name__ == "__main__":
    asyncio.run(main())
