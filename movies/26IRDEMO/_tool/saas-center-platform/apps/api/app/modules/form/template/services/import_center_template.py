from app.core.type import uuid_str

from ..events import FormTemplateAtomic
from ..models import FormTemplate, FormTemplateStatus
from ..repository import FormTemplateRepository


class ImportCenterTemplateService:
    def __init__(self, repo: FormTemplateRepository):
        self.repo = repo

    async def execute(
        self,
        template_id: uuid_str,
        center_id: uuid_str,
    ) -> tuple[FormTemplateAtomic | None, FormTemplate]:
        # load
        source = await self.repo.get_by_id_with_center(
            template_id=template_id,
            center_id=center_id,
        )
        if source.center_id == center_id:
            return None, source

        # 동일성의 근거는 이름이 아니라 출처다 — 들여온 뒤 이름을 바꾸거나 내용을
        # 고쳐도 같은 서식으로 인식되고, 이름만 같은 남의 양식을 집지 않는다.
        origin = source.source_template_id or source.id
        owned = await self.repo.find_active_by_center_and_source(
            center_id=center_id,
            source_template_id=origin,
        )
        if owned is not None:
            return None, owned

        # verify — 출처가 다른 동명 양식이 이미 있으면 접미를 붙인다(이름은 센터 안 유일)
        name = source.name
        if await self.repo.find_active_by_center_and_name(
            center_id=center_id, name=name
        ) is not None:
            name = f"{name} {source.id[:4]}"

        # return
        imported = await self.repo.add(
            center_id=center_id,
            name=name,
            version=1,
            schema=source.schema,
            is_active=True,
            status=FormTemplateStatus.DRAFT,
            source_template_id=origin,
        )
        # cloned() 가 (atomic, template) 을 함께 돌려준다
        return FormTemplateAtomic.cloned(template=imported)
