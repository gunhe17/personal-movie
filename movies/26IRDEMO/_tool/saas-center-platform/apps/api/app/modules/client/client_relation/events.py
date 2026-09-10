from dataclasses import dataclass

from app.core.type import uuid_str

from .models import ClientRelation
from ..relation.schemas import ClientRelationResponse


@dataclass(frozen=True, kw_only=True)
class ClientRelationAtomic:
    _act: str
    relation: ClientRelation
    _entity_name: str

    @classmethod
    def created(cls, *, relation: ClientRelation, entity_name: str) -> tuple["ClientRelationAtomic", ClientRelation]:
        return cls(_act="created", relation=relation, _entity_name=entity_name), relation

    @classmethod
    def deleted(cls, *, relation: ClientRelation, entity_name: str) -> tuple["ClientRelationAtomic", ClientRelation]:
        return cls(_act="deleted", relation=relation, _entity_name=entity_name), relation

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        # caller 주입 — unified 엔드포인트는 "relation", specific은 "guardian_relation"
        return self._entity_name

    def act_entity_id(self) -> uuid_str:
        return self.relation.id

    def payload(self) -> dict:
        dump = ClientRelationResponse.model_validate(self.relation).model_dump(mode="json")
        return {"data": dump}
