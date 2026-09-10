from sqlalchemy import select

from app.core.exceptions import EntityNotFoundException
from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import FormSignature


class FormSignatureRepository(PostgresRepository[FormSignature]):
    model = FormSignature

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        instance_id: uuid_str,
        field_id: str,
        storage_type: str,
        signature_data: str | None,
        signer_name: str,
        signed_at: utc_dt,
        signer_ip: str | None = None,
        storage_path: str | None = None,
    ) -> FormSignature:
        return await super().add(
            FormSignature(
                center_id=center_id,
                instance_id=instance_id,
                field_id=field_id,
                storage_type=storage_type,
                signature_data=signature_data,
                signer_name=signer_name,
                signed_at=signed_at,
                signer_ip=signer_ip,
                storage_path=storage_path,
            )
        )

    # #
    # query

    @typecheck
    async def get_in_center(
        self,
        signature_id: uuid_str,
        center_id: uuid_str,
    ) -> FormSignature:
        signature = await self._find(
            where=[
                FormSignature.id == signature_id,
                FormSignature.center_id == center_id,
            ]
        )
        if signature is None:
            raise EntityNotFoundException(f"FormSignature not found: {signature_id}")
        return signature

    @typecheck
    async def list_by_instance(
        self,
        instance_id: uuid_str,
    ) -> list[FormSignature]:
        return await self._filter(
            where=[FormSignature.instance_id == instance_id],
            order_by="signed_at",
            descending=True,
        )


    @typecheck
    async def list_latest_per_field(
        self,
        instance_id: uuid_str,
    ) -> list[FormSignature]:
        stmt = (
            select(FormSignature)
            .where(
                FormSignature.instance_id == instance_id,
                FormSignature.deleted_at.is_(None),
            )
            .distinct(FormSignature.field_id)
            .order_by(FormSignature.field_id, FormSignature.signed_at.desc())
        )
        return await self._scalars(stmt)
