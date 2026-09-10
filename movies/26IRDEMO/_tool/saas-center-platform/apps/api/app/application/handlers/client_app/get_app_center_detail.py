from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import CenterFacade, OperatingTimeFacade
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client_app.schemas import AppCenterDetailResponse, AppOperatingTime
from app.modules.family.facade import FamilyFacade


def _hhmm(value) -> str | None:
    return value.strftime("%H:%M") if value else None


async def get_app_center_detail_handler(
    *,
    person_id: uuid_str,
    center_id: uuid_str,
    uow: UnitOfWork,
) -> AppCenterDetailResponse:
    async with uow:
        family = await FamilyFacade(uow).ensure_family(person_id=person_id)
        links = await CenterLinkFacade(uow).list_links_by_family(
            family_id=family.id, alive_only=True
        )
        # 활성 링크가 없는 센터는 존재를 드러내지 않는다 (읽기 투영 게이트)
        linked = any(
            link.center_id == center_id and link.status == "active" for link in links
        )
        if not linked:
            raise EntityNotFoundException("센터를 찾을 수 없습니다")

        centers = await CenterFacade(uow).get_active_by_ids([center_id])
        center = centers.get(center_id)
        if center is None:
            raise EntityNotFoundException("센터를 찾을 수 없습니다")

        # address JSONB(AddressInfo) → 한 줄 문자열
        address = center.address or {}
        parts = [address.get("address"), address.get("detail")]
        address_str = " ".join(p for p in parts if p) or None

        # 커버 = 센터 이미지 첫 장, 없으면 로고
        images = center.image_urls or []
        image_url = images[0] if images else center.logo_url

        # 요일별 운영시간 (영업중 판정은 클라가 기기 시각으로)
        ots = await OperatingTimeFacade(uow).list_with_response(center_id)
        operating_times = [
            AppOperatingTime(
                weekday=ot.weekday.value,
                open_time=_hhmm(ot.open_time),
                close_time=_hhmm(ot.close_time),
                break_start_time=_hhmm(ot.break_start_time),
                break_end_time=_hhmm(ot.break_end_time),
            )
            for ot in ots
        ]

        return AppCenterDetailResponse(
            id=center.id,
            name=center.name,
            phone=center.phone,
            address=address_str,
            image_url=image_url,
            operating_times=operating_times,
        )
