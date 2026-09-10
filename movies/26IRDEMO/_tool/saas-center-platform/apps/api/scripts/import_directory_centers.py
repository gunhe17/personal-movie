import argparse
import asyncio
import csv
from pathlib import Path

from sqlalchemy import select

from app.infrastructure.persistence.database import AsyncSessionLocal
from app.modules.directory_center.directory_center.models import DirectoryCenter

# 대한민국 좌표 범위 밖 = 지오코딩 오류로 간주
LAT_RANGE = (33.0, 39.0)
LNG_RANGE = (124.0, 132.0)


def parse_geocode(raw: str) -> tuple[float, float] | None:
    # 형식: "{35.2609685359454,128.631868872831}" (위도,경도)
    parts = raw.strip().strip("{}").split(",")
    if len(parts) != 2:
        return None
    try:
        lat, lng = float(parts[0]), float(parts[1])
    except ValueError:
        return None
    if not (LAT_RANGE[0] <= lat <= LAT_RANGE[1] and LNG_RANGE[0] <= lng <= LNG_RANGE[1]):
        return None
    return lat, lng


def parse_row(row: dict) -> dict | None:
    source_id_raw = row.get("id", "").strip()
    name = row.get("name", "").strip()
    address = row.get("address", "").strip()
    if not source_id_raw.isdigit() or not name or not address:
        return None

    geocode = parse_geocode(row.get("geocode", ""))
    if geocode is None:
        return None

    return {
        "source_id": int(source_id_raw),
        "name": name[:255],
        "address": address,
        "latitude": geocode[0],
        "longitude": geocode[1],
        "category": (row.get("category", "").strip() or "기타")[:20],
        "phone_number": row.get("phonenumber", "").strip()[:30] or None,
        "operating_hours_text": row.get("time", "").strip() or None,
        "website_url": row.get("link_url", "").strip() or None,
    }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, help="센터 디렉토리 CSV 경로")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise SystemExit(f"CSV 파일 없음: {csv_path}")

    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    inserted = updated = skipped = 0

    async with AsyncSessionLocal() as session:
        stmt = select(DirectoryCenter).where(DirectoryCenter.deleted_at.is_(None))
        existing = {
            dc.source_id: dc for dc in (await session.execute(stmt)).scalars()
        }

        for row in rows:
            data = parse_row(row)
            if data is None:
                skipped += 1
                continue

            found = existing.get(data["source_id"])
            if found is None:
                session.add(DirectoryCenter(**data))
                inserted += 1
            else:
                changed = False
                for key, value in data.items():
                    if getattr(found, key) != value:
                        setattr(found, key, value)
                        changed = True
                if changed:
                    updated += 1

        await session.commit()

    print(f"inserted={inserted} updated={updated} skipped={skipped} total={len(rows)}")


if __name__ == "__main__":
    asyncio.run(main())
