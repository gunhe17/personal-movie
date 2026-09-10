from dataclasses import dataclass

from app.core.type import uuid_str

from .models import SiblingRelation
from ..relation.schemas import SiblingRelationResponse


@dataclass(frozen=True, kw_only=True)
class SiblingRelationAtomic:
    _act: str
    relation: SiblingRelation
    _entity_name: str

    @classmethod
    def created(cls, *, relation: SiblingRelation, entity_name: str) -> tuple["SiblingRelationAtomic", SiblingRelation]:
        return cls(_act="created", relation=relation, _entity_name=entity_name), relation

    @classmethod
    def deleted(cls, *, relation: SiblingRelation, entity_name: str) -> tuple["SiblingRelationAtomic", SiblingRelation]:
        return cls(_act="deleted", relation=relation, _entity_name=entity_name), relation

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        # caller 주입 — unified 엔드포인트는 "relation", specific은 "sibling_relation"
        return self._entity_name

    def act_entity_id(self) -> uuid_str:
        return self.relation.id

    def payload(self) -> dict:
        dump = SiblingRelationResponse.model_validate(self.relation).model_dump(mode="json")
        return {"data": dump}
