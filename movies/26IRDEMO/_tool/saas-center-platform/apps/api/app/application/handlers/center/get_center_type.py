from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import CenterFacade

# 컬럼이 생기면 이 값집합은 centers/models.py로 내려간다(enum 정본 = models.py 공존).
CENTER_TYPES = ("counseling", "school", "military", "hospital")


async def get_center_type_handler(
    center_id: str,
    uow: UnitOfWork,
) -> str:
    center = await CenterFacade(uow).get_center(center_id)
    # ponytail: centers.center_type 컬럼(ontology/DECISIONS.md D4) 전까지 getattr — 컬럼이 생기면 center.center_type
    center_type = getattr(center, "center_type", None)

    if center_type is None:
        return "counseling"

    if center_type not in CENTER_TYPES:
        raise ValueError(f"알 수 없는 기관 종류: {center_type}")

    return center_type
