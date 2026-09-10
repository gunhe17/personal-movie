from dataclasses import dataclass
from datetime import date

from ..repository import ClientRepository
from ..models import Client


@dataclass(frozen=True)
class DuplicateClientItem:
    name: str
    birth_date: date | None
    guardian_phone: str | None = None
    guardian_birth_date: date | None = None


@dataclass(frozen=True)
class DuplicateClientResult:
    index: int
    duplicate_level: str  # "high" | "low" | "none"
    matched_client: Client | None


class ValidateDuplicateClientsService:
    def __init__(self, repo: ClientRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        items: list[DuplicateClientItem],
    ) -> list[DuplicateClientResult]:
        # load
        candidates = [
            (item.name, item.birth_date)
            for item in items
            if item.birth_date is not None
        ]

        existing = await self.repo.list_by_names_and_births(
            center_id=center_id,
            candidates=candidates,
        )

        client_ids = [c.id for c in existing]
        guardian_phones_map = await self.repo.aggregate_guardian_phones_by_client_ids(
            center_id=center_id,
            client_ids=client_ids,
        )
        guardian_births_map = await self.repo.aggregate_guardian_births_by_client_ids(
            center_id=center_id,
            client_ids=client_ids,
        )

        # (name, birth_date) → [Client] 매핑 (동명이인 대비)
        existing_map: dict[tuple, list[Client]] = {}
        for client in existing:
            key = (client.name, client.birth_date)
            existing_map.setdefault(key, []).append(client)

        results: list[DuplicateClientResult] = []
        for idx, item in enumerate(items):
            if item.birth_date is None:
                results.append(DuplicateClientResult(idx, "none", None))
                continue

            key = (item.name, item.birth_date)
            matches = existing_map.get(key, [])

            if not matches:
                results.append(DuplicateClientResult(idx, "none", None))
                continue

            best_match = matches[0]
            level = "low"

            if item.guardian_phone or item.guardian_birth_date:
                phone_normalized = item.guardian_phone.replace("-", "") if item.guardian_phone else None
                for candidate in matches:
                    guardian_phones = guardian_phones_map.get(candidate.id, [])
                    guardian_births = guardian_births_map.get(candidate.id, [])

                    phone_match = phone_normalized and any(
                        p.replace("-", "") == phone_normalized for p in guardian_phones
                    )
                    birth_match = item.guardian_birth_date and item.guardian_birth_date in guardian_births

                    if phone_match or birth_match:
                        best_match = candidate
                        level = "high"
                        break

            results.append(DuplicateClientResult(idx, level, best_match))

        return results
