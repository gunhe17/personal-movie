from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..favorite.models import ClientFavorite
from ..favorite.repository import ClientFavoriteRepository
from ..favorite.services import BuildClientSignalsService, ListFavoritesService
from ..profile.repository import ClientRepository
from ..profile.services import GetClientService, ListClientsByIdsService
from ..profile.models import Client


class ClientInfo:
    def __init__(
        self,
        client_id: str,
        name: str,
        code: str | None = None,
        gender: str | None = None,
        birth_date=None,
        profile_image_url: str | None = None,
    ):
        self.client_id = client_id
        self.name = name
        self.code = code
        self.gender = gender
        self.birth_date = birth_date
        self.profile_image_url = profile_image_url


class ClientFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def lookup_agent_ref(self, center_id: str, value: str) -> dict | None:
        ids = await self.list_client_ids_by_name(center_id, value)
        if not ids:
            return None
        info_map = await self.get_clients_by_ids(ids[:1])
        info = info_map.get(ids[0])
        if not info:
            return None
        return {"id": info.client_id, "name": info.name}

    async def find_client_info(self, client_id: str) -> ClientInfo | None:
        result = await self.get_clients_by_ids([client_id])
        return result.get(client_id)

    async def get_client_summaries_by_ids(self, client_ids: list[str]) -> dict[str, str]:
        info_map = await self.get_clients_by_ids(client_ids)
        return {cid: info.name for cid, info in info_map.items()}

    async def get_clients_by_ids(self, client_ids: list[str]) -> dict[str, ClientInfo]:
        if not client_ids:
            return {}

        repo = self._uow.repo(ClientRepository)
        service = ListClientsByIdsService(repo)
        clients = await service.execute(client_ids)

        return {
            client.id: ClientInfo(
                client_id=client.id,
                name=client.name,
                code=client.code,
                gender=client.gender,
                birth_date=client.birth_date,
                profile_image_url=client.profile_image_url,
            )
            for client in clients
        }

    async def list_client_ids_by_name(
        self,
        center_id: str,
        name: str,
    ) -> list[str]:
        from ..profile.services import ListClientsByFiltersService
        repo = self._uow.repo(ClientRepository)
        service = ListClientsByFiltersService(repo)
        clients = await service.execute(center_id=center_id, name=name)
        return [c.id for c in clients]

    async def list_clients_by_ids(self, client_ids: list[str]) -> list[Client]:
        if not client_ids:
            return []

        repo = self._uow.repo(ClientRepository)
        service = ListClientsByIdsService(repo)
        return await service.execute(client_ids)

    async def list_favorites(
        self,
        person_id: str,
        center_id: str,
    ) -> list[ClientFavorite]:
        return await ListFavoritesService(
            self._uow.repo(ClientFavoriteRepository)
        ).execute(person_id, center_id)

    def build_client_signals(
        self,
        *,
        today_sessions,
        unlogged_sessions,
        unshared_assessments,
    ) -> dict:
        # 입력은 크로스모듈 로드 결과 — application handler가 주입(pure-logic)
        return BuildClientSignalsService().execute(
            today_sessions=today_sessions,
            unlogged_sessions=unlogged_sessions,
            unshared_assessments=unshared_assessments,
        )

    async def get_client_in_center(self, *, center_id: str, client_id: str) -> Client:
        repo = self._uow.repo(ClientRepository)
        return await GetClientService(repo).execute(
            center_id=center_id, client_id=client_id
        )

    async def list_children_of_guardian(
        self,
        *,
        center_id: str,
        guardian_client_id: str,
    ) -> list[Client]:
        from ..client_relation.repository import ClientRelationRepository
        from ..client_relation.services import ListChildrenService

        relations = await ListChildrenService(
            self._uow.repo(ClientRelationRepository)
        ).execute(
            center_id=center_id,
            guardian_id=guardian_client_id,
        )
        child_ids = [r.related_client_id for r in relations]
        if not child_ids:
            return []
        return await ListClientsByIdsService(self._uow.repo(ClientRepository)).execute(
            child_ids
        )
