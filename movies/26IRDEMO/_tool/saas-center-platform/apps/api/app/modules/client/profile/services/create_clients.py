from dataclasses import dataclass

from ..events import ClientAtomic
from ..models import Client
from ..repository import ClientRepository
from ..schemas import (
    ClientCreate,
    ClientRole,
    ClientUpdate,
    CreateClientsRequest,
)
from .create_client import CreateClientService
from .get_client import GetClientService
from .update_client import UpdateClientService
from ...client_relation.repository import ClientRelationRepository
from ...client_relation.services import CreateGuardianRelationService
from ...sibling_relation.repository import SiblingRelationRepository
from ...sibling_relation.services import CreateSiblingRelationService
from ...relation.schemas import (
    ClientRelationCreate,
    GuardianRelationDetail,
    SiblingRelationCreate,
)


@dataclass
class CreateClientsBatchResult:
    guardians: list[Client]
    children: list[Client]
    client_relation_count: int
    sibling_relation_count: int


class CreateClientsService:
    def __init__(
        self,
        client_repo: ClientRepository,
        relation_repo: ClientRelationRepository,
        sibling_repo: SiblingRelationRepository,
    ):
        self._client_repo = client_repo
        self._relation_repo = relation_repo
        self._sibling_repo = sibling_repo

    async def execute(
        self,
        center_id: str,
        data: CreateClientsRequest,
    ) -> tuple[list[ClientAtomic], CreateClientsBatchResult]:
        create_client_service = CreateClientService(self._client_repo)
        get_client_service = GetClientService(self._client_repo)
        update_client_service = UpdateClientService(self._client_repo)
        create_relation_service = CreateGuardianRelationService(self._relation_repo)
        create_sibling_service = CreateSiblingRelationService(self._sibling_repo)

        atomics: list[ClientAtomic] = []
        created_guardians = []
        for guardian_input in data.guardians:
            if guardian_input.existing_client_id:
                guardian = await get_client_service.execute(
                    center_id,
                    guardian_input.existing_client_id,
                )

                if guardian.role == "client":
                    promote_update = ClientUpdate(role=ClientRole.BOTH)
                    atomic, guardian = await update_client_service.execute(
                        center_id=center_id,
                        client_id=guardian.id,
                        changed=promote_update.model_dump(
                            mode="json", exclude_unset=True
                        ),
                        **promote_update.model_dump(exclude_unset=True),
                    )
                    atomics.append(atomic)

                created_guardians.append(guardian)
            else:
                guardian_create = ClientCreate(
                    person_id=None,
                    role=ClientRole.GUARDIAN,
                    name=guardian_input.name,
                    birth_date=guardian_input.birth_date,
                    gender=guardian_input.gender,
                    phone=guardian_input.phone,
                    email=guardian_input.email,
                    address=guardian_input.address,
                    memo=guardian_input.memo,
                )
                atomic, guardian = await create_client_service.execute(
                    center_id=center_id,
                    **guardian_create.model_dump(),
                )
                atomics.append(atomic)
                created_guardians.append(guardian)

        created_children = []
        for child_input in data.children:
            child_create = ClientCreate(
                person_id=None,
                role=ClientRole.CLIENT,
                name=child_input.name,
                birth_date=child_input.birth_date,
                gender=child_input.gender,
                phone=child_input.phone,
                memo=child_input.memo,
            )
            atomic, child = await create_client_service.execute(
                center_id=center_id,
                **child_create.model_dump(),
            )
            atomics.append(atomic)
            created_children.append(child)

        client_relation_count = 0
        for idx, guardian in enumerate(created_guardians):
            guardian_input = data.guardians[idx]
            is_primary = guardian_input.is_primary
            relation_detail_enum: GuardianRelationDetail | None = None
            if guardian_input.relation_detail:
                try:
                    relation_detail_enum = GuardianRelationDetail(
                        guardian_input.relation_detail
                    )
                except ValueError:
                    relation_detail_enum = GuardianRelationDetail.CAREGIVER

            for child in created_children:
                relation_create = ClientRelationCreate(
                    client_id=child.id,
                    related_client_id=guardian.id,
                    relation_type="guardian",
                    relation_detail=relation_detail_enum,
                    is_primary=is_primary,
                )
                await create_relation_service.execute(
                    center_id=center_id,
                    **relation_create.model_dump(),
                )
                client_relation_count += 2

        sibling_relation_count = 0
        if len(created_children) > 1:
            for i, client_a in enumerate(created_children):
                for client_b in created_children[i + 1 :]:
                    sibling_create = SiblingRelationCreate(
                        client_id=client_a.id,
                        sibling_id=client_b.id,
                    )
                    await create_sibling_service.execute(
                        center_id=center_id,
                        **sibling_create.model_dump(),
                    )
                    sibling_relation_count += 2

        return atomics, CreateClientsBatchResult(
            guardians=created_guardians,
            children=created_children,
            client_relation_count=client_relation_count,
            sibling_relation_count=sibling_relation_count,
        )
