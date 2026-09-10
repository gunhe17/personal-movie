"""근방 센터 조회: 바운딩박스 프리필터 + Haversine 반경 필터·거리 정렬 검증.
서울시청(37.5665, 126.9780) 기준 — 명동성당 ~1.1km / 강남역 ~8.6km / 부산 ~325km."""
from app.modules.directory_center.directory_center.repository import (
    DirectoryCenterRepository,
)

SEOUL_CITY_HALL = (37.5665, 126.9780)


async def _add(
    repo,
    source_id,
    name,
    lat,
    lng,
):
    return await repo.add(
        source_id=source_id,
        name=name,
        address="주소",
        latitude=lat,
        longitude=lng,
        category="센터",
    )


async def test_list_nearby_filters_and_sorts_by_distance(test_session):
    repo = DirectoryCenterRepository(test_session)
    await _add(repo, 1, "명동", 37.5633, 126.9873)
    await _add(repo, 2, "강남", 37.4979, 127.0276)
    await _add(repo, 3, "부산", 35.1796, 129.0756)

    lat, lng = SEOUL_CITY_HALL
    rows = await repo.list_nearby(latitude=lat, longitude=lng, radius_m=10_000, limit=30)

    assert [r.name for r in rows] == ["명동", "강남"]  # 반경 밖(부산) 제외, 가까운 순

    rows = await repo.list_nearby(latitude=lat, longitude=lng, radius_m=3_000, limit=30)
    assert [r.name for r in rows] == ["명동"]


async def test_list_nearby_excludes_soft_deleted(test_session):
    repo = DirectoryCenterRepository(test_session)
    kept = await _add(repo, 1, "유지", 37.5633, 126.9873)
    removed = await _add(repo, 2, "삭제", 37.5650, 126.9800)
    await repo.remove_by_id(removed.id)

    lat, lng = SEOUL_CITY_HALL
    rows = await repo.list_nearby(latitude=lat, longitude=lng, radius_m=10_000, limit=30)
    assert [r.id for r in rows] == [kept.id]


async def test_list_nearby_respects_limit(test_session):
    repo = DirectoryCenterRepository(test_session)
    for i in range(5):
        await _add(repo, i + 1, f"센터{i}", 37.5633 + i * 0.001, 126.9873)

    lat, lng = SEOUL_CITY_HALL
    rows = await repo.list_nearby(latitude=lat, longitude=lng, radius_m=10_000, limit=2)
    assert len(rows) == 2
