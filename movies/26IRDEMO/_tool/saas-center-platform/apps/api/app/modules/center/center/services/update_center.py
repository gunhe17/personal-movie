from app.core.type import unset
from ..events import CenterAtomic
from ..models import Center
from ..repository import CenterRepository


class UpdateCenterService:
    def __init__(self, repo: CenterRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        changed: dict,
        name: str = unset,
        phone: str | None = unset,
        address: dict | None = unset,
        description: str | None = unset,
        logo_url: str | None = unset,
        image_urls: list[str] | None = unset,
        business_registration_number: str | None = unset,
        representative_name: str | None = unset,
    ) -> tuple[CenterAtomic, Center]:
        # load
        center = await self.repo.get_active(id=center_id)

        # update
        update_data = {
            k: v
            for k, v in {
                "name": name,
                "phone": phone,
                "address": address,
                "description": description,
                "logo_url": logo_url,
                "image_urls": image_urls,
                "business_registration_number": business_registration_number,
                "representative_name": representative_name,
            }.items()
            if v is not unset
        }
        if not update_data:
            return CenterAtomic.updated(center=center, changed=changed)

        updated = await self.repo.update_in_place(center_id, **update_data)
        assert updated is not None
        return CenterAtomic.updated(center=updated, changed=changed)
