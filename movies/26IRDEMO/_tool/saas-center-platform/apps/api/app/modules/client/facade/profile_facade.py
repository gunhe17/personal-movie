from datetime import date

from app.core.datetime_utils import parse_date
from app.core.exceptions import InvalidOperationException
from app.core.type import unset
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..profile.events import ClientAtomic
from ..profile.models import Client
from ..profile.repository import ClientRepository
from ..profile.schemas_excel import (
    ImportClientsFromExcelRequest,
    ImportClientsFromExcelResponse,
    ExcelClientResult,
)
from ..profile.schemas import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    ClientSummary,
    ClientListResponse,
    ClientRole,
    Gender,
    CreateClientsRequest,
    CreateClientsResponse,
    BatchRelationsSummary,
    ClientWithRelationsSummary,
    ClientWithRelationsListResponse,
    UpdateClientWithRelationsRequest,
    UpdateClientWithRelationsResponse,
    UpdateClientWithRelationsChangesSummary,
    ValidateDuplicateClientsRequest,
    ValidateDuplicateClientsResponse,
    DuplicateClientResult,
    MatchedClientInfo,
)
from ..profile.services import (
    CreateClientService,
    CreateClientsService,
    FindClientByNameBirthService,
    GetClientService,
    GetClientByIdService,
    ListClientsService,
    UpdateClientService,
    DeleteClientService,
    ListClientsByFiltersService,
    ListClientsByIdsService,
    ValidateDuplicateClientsService,
    DuplicateClientItem,
)
from ..client_relation.repository import ClientRelationRepository
from ..sibling_relation.repository import SiblingRelationRepository
from ..favorite.repository import ClientFavoriteRepository
from ..favorite.services import ListFavoriteClientIdsService, IsFavoritedService
from ..client_relation.services import (
    CreateGuardianRelationService,
    DeleteGuardianRelationPairService,
    ListGuardiansService,
    ListRelationsByClientIdsService,
)
from ..sibling_relation.services import (
    CreateSiblingRelationService,
    ListSiblingsByClientIdsService,
)
from ..relation.schemas import (
    ClientRelationCreate,
    GuardianRelationDetail,
    SiblingRelationCreate,
)


class ProfileFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _determine_active_roles(
        self, client_role: str, guardian_count: int
    ) -> list[str]:
        if client_role == "both":
            return ["client", "guardian"]
        elif client_role == "client":
            # 보호자 있는 내담자=아동(child), 없으면 성인(adult)
            return ["child_client"] if guardian_count > 0 else ["adult_client"]
        else:  # guardian
            return ["guardian"]

    def _calculate_priority(self, client_role: str) -> int:
        # 내담자 속성 보유(client·both)=1순위, 보호자만=2순위 (정렬 키)
        return 1 if client_role in ["client", "both"] else 2

    async def create_client(
        self,
        center_id: str,
        name: str,
        role: str = "client",
        phone: str | None = None,
        birth_date: str | date | None = None,
        gender: str | None = None,
        email: str | None = None,
        address: str | None = None,
        memo: str | None = None,
        profile_image_url: str | None = None,
    ) -> tuple[ClientAtomic, Client]:
        data = ClientCreate(
            role=ClientRole(role),
            name=name,
            phone=phone,
            birth_date=parse_date(birth_date, "birth_date")
            if isinstance(birth_date, str)
            else birth_date,
            gender=Gender(gender) if gender else None,
            email=email,
            address=address,
            memo=memo,
            profile_image_url=profile_image_url,
        )
        repo = self._uow.repo(ClientRepository)
        return await CreateClientService(repo).execute(
            center_id=center_id, **data.model_dump()
        )

    async def get_with_response(
        self,
        center_id: str,
        client_id: str,
        viewer_person_id: str | None = None,
    ) -> ClientResponse:
        repo = self._uow.repo(ClientRepository)
        service = GetClientService(repo)
        client = await service.execute(center_id, client_id)

        response = ClientResponse.model_validate(client)
        if viewer_person_id:
            favorite_repo = self._uow.repo(ClientFavoriteRepository)
            is_favorited_service = IsFavoritedService(favorite_repo)
            response.is_favorited = await is_favorited_service.execute(
                viewer_person_id, client_id
            )
        return response

    async def get_center_id(self, *, client_id: str) -> str:
        # client 의 소유 center 해석(업로드 권한 검증용) — 없으면 404
        repo = self._uow.repo(ClientRepository)
        client = await GetClientByIdService(repo).execute(client_id)
        return client.center_id

    async def list_by_filters_with_response(
        self,
        center_id: str,
        name: str | None = None,
        phone: str | None = None,
        birth_date: str | date | None = None,
        role: str | None = None,
    ) -> list[ClientResponse]:
        birth_date = (
            parse_date(birth_date, "birth_date") if isinstance(birth_date, str) else birth_date
        )
        repo = self._uow.repo(ClientRepository)
        service = ListClientsByFiltersService(repo)
        clients = await service.execute(
            center_id=center_id,
            name=name,
            phone=phone,
            birth_date=birth_date,
            role=role,
        )

        return [ClientResponse.model_validate(c) for c in clients]

    async def list_with_response(
        self,
        center_id: str,
        skip: int,
        limit: int,
        role: str | None,
        status: str | None,
        gender: str | None = None,
        search: str | None = None,
        sort: str | None = None,
        viewer_person_id: str | None = None,
        ids: list[str] | None = None,
    ) -> ClientListResponse:
        # ids 도출(상담사 담당 내담자 등 cross-module)은 Handler 책임 — 여기선 받은 집합을 그대로 SQL 필터에 적용
        repo = self._uow.repo(ClientRepository)
        service = ListClientsService(repo)
        clients, page_meta = await service.execute(
            center_id=center_id,
            skip=skip,
            limit=limit,
            role=role,
            status=status,
            gender=gender,
            search=search,
            sort=sort,
            ids=ids,
        )

        favorite_ids: set[str] = set()
        if viewer_person_id:
            favorite_repo = self._uow.repo(ClientFavoriteRepository)
            ids_service = ListFavoriteClientIdsService(favorite_repo)
            favorite_ids = await ids_service.execute(viewer_person_id, center_id)

        items: list[ClientSummary] = []
        for c in clients:
            summary = ClientSummary.model_validate(c)
            summary.is_favorited = c.id in favorite_ids
            items.append(summary)

        await self._attach_primary_guardian(items, clients, center_id)

        return ClientListResponse(
            items=items,
            **page_meta,
        )

    async def list_all_summaries_for_sort(
        self,
        center_id: str,
        role: str | None,
        status: str | None,
        gender: str | None = None,
        search: str | None = None,
        *,
        viewer_person_id: str | None = None,
        cap: int = 2000,
        ids: list[str] | None = None,
    ) -> tuple[list[ClientSummary], int]:
        # 정렬 키가 타 모듈에 있어 SQL 페이지네이션 불가 — Handler가 메모리에서 정렬·페이징하도록
        # cap 상한 내 전체를 반환한다(is_favorited 까지 채워 단일 모듈 책임으로 끝냄).
        repo = self._uow.repo(ClientRepository)
        service = ListClientsService(repo)
        clients, page_meta = await service.execute(
            center_id=center_id,
            skip=0,
            limit=cap,
            role=role,
            status=status,
            gender=gender,
            search=search,
            sort="desc",
            ids=ids,
        )
        total = page_meta["total"]

        favorite_ids: set[str] = set()
        if viewer_person_id:
            favorite_repo = self._uow.repo(ClientFavoriteRepository)
            ids_service = ListFavoriteClientIdsService(favorite_repo)
            favorite_ids = await ids_service.execute(viewer_person_id, center_id)

        items: list[ClientSummary] = []
        for c in clients:
            summary = ClientSummary.model_validate(c)
            summary.is_favorited = c.id in favorite_ids
            items.append(summary)

        await self._attach_primary_guardian(items, clients, center_id)

        return items, total

    async def _attach_primary_guardian(
        self,
        items: list[ClientSummary],
        clients: list,
        center_id: str,
    ) -> None:
        client_ids = [c.id for c in clients]
        if not client_ids:
            return
        relation_repo = self._uow.repo(ClientRelationRepository)
        relations = await ListRelationsByClientIdsService(relation_repo).execute(
            client_ids, center_id
        )
        primary_guardian = {
            rel.client_id: (rel.related_client_id, rel.relation_detail)
            for rel in relations
            if rel.relation_type == "guardian" and rel.is_primary
        }
        guardian_ids = {gid for gid, _ in primary_guardian.values()}
        guardian_names: dict[str, str] = {}
        if guardian_ids:
            repo = self._uow.repo(ClientRepository)
            related = await ListClientsByIdsService(repo).execute(list(guardian_ids))
            guardian_names = {gc.id: gc.name for gc in related}
        for summary in items:
            pg = primary_guardian.get(summary.id)
            if pg:
                summary.guardian_name = guardian_names.get(pg[0])
                summary.guardian_relationship = pg[1]

    async def list_with_relations_response(
        self,
        center_id: str,
        skip: int,
        limit: int,
        role: str | None,
        status: str | None,
    ) -> ClientWithRelationsListResponse:
        client_repo = self._uow.repo(ClientRepository)
        list_service = ListClientsService(client_repo)
        clients, page_meta = await list_service.execute(
            center_id=center_id,
            skip=skip,
            limit=limit,
            role=role,
            status=status,
        )

        if not clients:
            return ClientWithRelationsListResponse(
                items=[],
                total=0,
                page=1,
                size=limit,
                pages=0,
            )

        client_ids = [c.id for c in clients]

        relation_repo = self._uow.repo(ClientRelationRepository)
        sibling_repo = self._uow.repo(SiblingRelationRepository)

        list_relations_service = ListRelationsByClientIdsService(relation_repo)
        list_siblings_service = ListSiblingsByClientIdsService(sibling_repo)

        relations = await list_relations_service.execute(client_ids, center_id)
        siblings = await list_siblings_service.execute(client_ids, center_id)

        related_client_ids = set()
        for rel in relations:
            if rel.relation_type == "guardian" and rel.is_primary:
                related_client_ids.add(rel.related_client_id)

        related_clients = []
        if related_client_ids:
            list_by_ids_service = ListClientsByIdsService(client_repo)
            related_clients = await list_by_ids_service.execute(
                list(related_client_ids)
            )

        guardian_phone_map = {c.id: c.phone for c in related_clients}

        guardian_counts = {}
        child_counts = {}
        sibling_counts = {}

        for rel in relations:
            if rel.relation_type == "guardian":
                guardian_counts[rel.client_id] = (
                    guardian_counts.get(rel.client_id, 0) + 1
                )
            elif rel.relation_type == "child":
                child_counts[rel.client_id] = child_counts.get(rel.client_id, 0) + 1

        for sib in siblings:
            sibling_counts[sib.client_id] = sibling_counts.get(sib.client_id, 0) + 1

        primary_guardian_map = {}
        for rel in relations:
            if rel.relation_type == "guardian" and rel.is_primary:
                primary_guardian_map[rel.client_id] = rel.related_client_id

        items = []
        for client in clients:
            primary_guardian_id = primary_guardian_map.get(client.id)
            primary_guardian_phone = (
                guardian_phone_map.get(primary_guardian_id)
                if primary_guardian_id
                else None
            )
            guardian_count = guardian_counts.get(client.id, 0)

            active_roles = self._determine_active_roles(client.role, guardian_count)
            priority = self._calculate_priority(client.role)

            items.append(
                ClientWithRelationsSummary(
                    id=client.id,
                    code=client.code,
                    name=client.name,
                    role=client.role,
                    phone=client.phone,
                    primary_guardian_phone=primary_guardian_phone,
                    status=client.status,
                    active_roles=active_roles,
                    priority=priority,
                    guardian_count=guardian_count,
                    child_count=child_counts.get(client.id, 0),
                    sibling_count=sibling_counts.get(client.id, 0),
                )
            )

        items.sort(key=lambda x: (x.priority, x.name))

        return ClientWithRelationsListResponse(
            items=items,
            **page_meta,
        )

    async def update_client(
        self,
        center_id: str,
        client_id: str,
        name: str = unset,
        role: str = unset,
        birth_date: str | date | None = unset,
        gender: str | None = unset,
        phone: str | None = unset,
        email: str | None = unset,
        address: str | None = unset,
        status: str = unset,
        memo: str | None = unset,
        profile_image_url: str | None = unset,
        changed: dict | None = None,
    ) -> tuple[ClientAtomic, Client]:
        parsed_birth_date = (
            parse_date(birth_date, "birth_date") if isinstance(birth_date, str) else birth_date
        )
        fields = {
            "name": name,
            "role": role,
            "birth_date": parsed_birth_date,
            "gender": gender,
            "phone": phone,
            "email": email,
            "address": address,
            "status": status,
            "memo": memo,
            "profile_image_url": profile_image_url,
        }
        repo = self._uow.repo(ClientRepository)
        return await UpdateClientService(repo).execute(
            center_id=center_id,
            client_id=client_id,
            changed=changed
            if changed is not None
            else {
                key: value.isoformat() if isinstance(value, date) else value
                for key, value in fields.items()
                if value is not unset
            },
            **fields,
        )

    async def activate_client(
        self,
        center_id: str,
        client_id: str,
    ) -> tuple[ClientAtomic, Client]:
        from ..profile.services.activate_client import ActivateClientService

        return await ActivateClientService(self._uow.repo(ClientRepository)).execute(
            center_id, client_id
        )

    async def deactivate_client(
        self,
        center_id: str,
        client_id: str,
    ) -> tuple[ClientAtomic, Client]:
        from ..profile.services.deactivate_client import DeactivateClientService

        return await DeactivateClientService(self._uow.repo(ClientRepository)).execute(
            center_id, client_id
        )

    async def archive_client(
        self,
        center_id: str,
        client_id: str,
    ) -> tuple[ClientAtomic, Client]:
        from ..profile.services.archive_client import ArchiveClientService

        return await ArchiveClientService(self._uow.repo(ClientRepository)).execute(
            center_id, client_id
        )

    async def delete_client(
        self,
        center_id: str,
        client_id: str,
    ) -> tuple[ClientAtomic, Client]:
        return await DeleteClientService(
            self._uow.repo(ClientRepository),
            self._uow.repo(ClientRelationRepository),
        ).execute(center_id, client_id)

    async def create_clients_with_response(
        self,
        center_id: str,
        data: CreateClientsRequest,
    ) -> tuple[list[ClientAtomic], CreateClientsResponse]:
        atomics, batch = await CreateClientsService(
            self._uow.repo(ClientRepository),
            self._uow.repo(ClientRelationRepository),
            self._uow.repo(SiblingRelationRepository),
        ).execute(center_id, data)

        return atomics, CreateClientsResponse(
            guardians=[ClientResponse.model_validate(g) for g in batch.guardians],
            children=[ClientResponse.model_validate(c) for c in batch.children],
            relations=BatchRelationsSummary(
                client_relations=batch.client_relation_count,
                sibling_relations=batch.sibling_relation_count,
            ),
        )

    async def update_client_with_relations_with_response(
        self,
        center_id: str,
        client_id: str,
        data: UpdateClientWithRelationsRequest,
    ) -> tuple[list[ClientAtomic], UpdateClientWithRelationsResponse]:
        client_repo = self._uow.repo(ClientRepository)
        relation_repo = self._uow.repo(ClientRelationRepository)

        update_client_service = UpdateClientService(client_repo)
        create_client_service = CreateClientService(client_repo)
        create_relation_service = CreateGuardianRelationService(relation_repo)
        list_guardians_service = ListGuardiansService(relation_repo)

        atomics: list[ClientAtomic] = []
        atomic, updated_client = await update_client_service.execute(
            center_id=center_id,
            client_id=client_id,
            changed=data.client.model_dump(mode="json", exclude_unset=True),
            **data.client.model_dump(exclude_unset=True),
        )
        atomics.append(atomic)

        existing_relations = await list_guardians_service.execute(center_id, client_id)
        existing_guardian_map = {
            rel.related_client_id: rel for rel in existing_relations
        }

        requested_ids = {g.client_id for g in data.guardians if g.client_id is not None}
        existing_ids = set(existing_guardian_map.keys())

        ids_to_update = requested_ids & existing_ids
        ids_to_remove = existing_ids - requested_ids

        guardians_added = 0
        guardians_updated = 0
        guardians_removed = 0

        # 추가/수정을 제거보다 먼저 처리해야 "주 보호자 1명" 제약을 위반하지 않는다
        for guardian_input in data.guardians:
            relation_detail_enum: GuardianRelationDetail | None = None
            if guardian_input.relation_detail:
                try:
                    relation_detail_enum = GuardianRelationDetail(
                        guardian_input.relation_detail
                    )
                except ValueError:
                    relation_detail_enum = GuardianRelationDetail.CAREGIVER

            if guardian_input.client_id is None:
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
                atomic, new_guardian = await create_client_service.execute(
                    center_id=center_id, **guardian_create.model_dump()
                )
                atomics.append(atomic)

                relation_create = ClientRelationCreate(
                    client_id=client_id,
                    related_client_id=new_guardian.id,
                    relation_type="guardian",
                    relation_detail=relation_detail_enum,
                    is_primary=guardian_input.is_primary,
                )
                await create_relation_service.execute(
                    center_id=center_id, **relation_create.model_dump()
                )
                guardians_added += 1

            elif guardian_input.client_id in ids_to_update:
                guardian_update = ClientUpdate(
                    name=guardian_input.name,
                    birth_date=guardian_input.birth_date,
                    gender=guardian_input.gender,
                    phone=guardian_input.phone,
                    email=guardian_input.email,
                    address=guardian_input.address,
                    memo=guardian_input.memo,
                )
                atomic, _ = await update_client_service.execute(
                    center_id=center_id,
                    client_id=guardian_input.client_id,
                    changed=guardian_update.model_dump(mode="json", exclude_unset=True),
                    **guardian_update.model_dump(exclude_unset=True),
                )
                atomics.append(atomic)

                existing_rel = existing_guardian_map[guardian_input.client_id]
                rel_changed = existing_rel.is_primary != guardian_input.is_primary or (
                    existing_rel.relation_detail or None
                ) != (guardian_input.relation_detail or None)

                if rel_changed:
                    # is_primary 해제가 선행돼야 하므로 양방향 관계를 삭제 후 재생성
                    await DeleteGuardianRelationPairService(relation_repo).execute(
                        center_id,
                        relation=existing_rel,
                    )

                    relation_create = ClientRelationCreate(
                        client_id=client_id,
                        related_client_id=guardian_input.client_id,
                        relation_type="guardian",
                        relation_detail=relation_detail_enum,
                        is_primary=guardian_input.is_primary,
                    )
                    await create_relation_service.execute(
                        center_id=center_id, **relation_create.model_dump()
                    )

                guardians_updated += 1

        # 제거는 관계만 삭제하고 보호자 Client 자체는 유지한다.
        # 새 주 보호자가 이미 설정돼 is_primary 해제 상태이므로 primary-guard 우회 pair 삭제.
        for guardian_id in ids_to_remove:
            rel = existing_guardian_map[guardian_id]
            await DeleteGuardianRelationPairService(relation_repo).execute(
                center_id,
                relation=rel,
            )
            guardians_removed += 1

        final_relations = await list_guardians_service.execute(center_id, client_id)
        guardian_ids = [rel.related_client_id for rel in final_relations]

        final_guardians = []
        if guardian_ids:
            list_by_ids_service = ListClientsByIdsService(client_repo)
            final_guardians = await list_by_ids_service.execute(guardian_ids)

        return atomics, UpdateClientWithRelationsResponse(
            client=ClientResponse.model_validate(updated_client),
            guardians=[ClientResponse.model_validate(g) for g in final_guardians],
            changes=UpdateClientWithRelationsChangesSummary(
                guardians_added=guardians_added,
                guardians_updated=guardians_updated,
                guardians_removed=guardians_removed,
            ),
        )

    async def import_clients_from_excel_with_response(
        self,
        center_id: str,
        data: ImportClientsFromExcelRequest,
    ) -> tuple[list[ClientAtomic], ImportClientsFromExcelResponse]:
        # 이름+생년월일 중복 자녀는 등록을 건너뛰고 기존 내담자를 반환(skipped=True). 응답은 요청 순서 보장.
        from datetime import date as date_type

        client_repo = self._uow.repo(ClientRepository)
        create_client_service = CreateClientService(client_repo)

        atomics: list[ClientAtomic] = []
        results: list[ExcelClientResult] = []

        relation_repo = self._uow.repo(ClientRelationRepository)
        create_client_service = CreateClientService(client_repo)
        create_relation_service = CreateGuardianRelationService(relation_repo)

        for idx, row in enumerate(data.clients):
            birth_date = date_type.fromisoformat(row.birth_date)

            skipped = False

            existing_child = await FindClientByNameBirthService(client_repo).execute(
                center_id,
                name=row.name,
                birth_date=birth_date,
            )

            if existing_child:
                child = ClientResponse.model_validate(existing_child)
                skipped = True
            elif row.guardian_name:
                guardian_birth_date = None
                if row.guardian_birth_date:
                    guardian_birth_date = date_type.fromisoformat(
                        row.guardian_birth_date
                    )
                guardian_create = ClientCreate(
                    person_id=None,
                    role=ClientRole.GUARDIAN,
                    name=row.guardian_name,
                    birth_date=guardian_birth_date,
                    gender=row.guardian_gender or None,
                    phone=row.guardian_phone or None,
                )
                atomic, guardian = await create_client_service.execute(
                    center_id=center_id, **guardian_create.model_dump()
                )
                atomics.append(atomic)

                child_create = ClientCreate(
                    person_id=None,
                    role=ClientRole.CLIENT,
                    name=row.name,
                    birth_date=birth_date,
                    gender=row.gender,
                )
                atomic, child_entity = await create_client_service.execute(
                    center_id=center_id, **child_create.model_dump()
                )
                atomics.append(atomic)

                relation_detail_enum = None
                if row.guardian_relationship:
                    from ..relation.schemas import GuardianRelationDetail

                    try:
                        relation_detail_enum = GuardianRelationDetail(
                            row.guardian_relationship
                        )
                    except ValueError:
                        relation_detail_enum = GuardianRelationDetail.CAREGIVER

                relation_create = ClientRelationCreate(
                    client_id=child_entity.id,
                    related_client_id=guardian.id,
                    relation_type="guardian",
                    relation_detail=relation_detail_enum,
                    is_primary=True,
                )
                await create_relation_service.execute(
                    center_id=center_id, **relation_create.model_dump()
                )

                child = ClientResponse.model_validate(child_entity)
            else:
                child_create = ClientCreate(
                    person_id=None,
                    role=ClientRole.CLIENT,
                    name=row.name,
                    birth_date=birth_date,
                    gender=row.gender,
                )
                atomic, child_entity = await create_client_service.execute(
                    center_id=center_id, **child_create.model_dump()
                )
                atomics.append(atomic)
                child = ClientResponse.model_validate(child_entity)

            results.append(ExcelClientResult(index=idx, client=child, skipped=skipped))

        return atomics, ImportClientsFromExcelResponse(
            results=results, total=len(results)
        )

    async def validate_duplicates_with_response(
        self,
        center_id: str,
        data: ValidateDuplicateClientsRequest,
    ) -> ValidateDuplicateClientsResponse:
        client_repo = self._uow.repo(ClientRepository)
        service = ValidateDuplicateClientsService(client_repo)

        items = [
            DuplicateClientItem(
                name=item.name,
                birth_date=item.birth_date,
                guardian_phone=item.guardian_phone,
                guardian_birth_date=item.guardian_birth_date,
            )
            for item in data.clients
        ]

        results = await service.execute(center_id, items)

        return ValidateDuplicateClientsResponse(
            results=[
                DuplicateClientResult(
                    index=r.index,
                    duplicate_level=r.duplicate_level,
                    matched_client=MatchedClientInfo.model_validate(r.matched_client)
                    if r.matched_client
                    else None,
                )
                for r in results
            ]
        )
