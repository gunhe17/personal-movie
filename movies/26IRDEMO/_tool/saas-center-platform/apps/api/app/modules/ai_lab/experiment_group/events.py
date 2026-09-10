from dataclasses import dataclass, field

from app.core.type import uuid_str

from .models import LabExperimentGroup


@dataclass(frozen=True, kw_only=True)
class ExperimentGroupAtomic:
    _act: str
    group: LabExperimentGroup
    # variants는 모델 미저장(총 개수만 저장) — 반응이 워커 params로 실어 나르도록 payload에 동봉
    _variants: list = field(default_factory=list)
    _changed: dict | None = None

    @classmethod
    def created(
        cls, *, group: LabExperimentGroup, variants: list
    ) -> tuple["ExperimentGroupAtomic", LabExperimentGroup]:
        return cls(_act="created", group=group, _variants=variants), group

    @classmethod
    def updated(
        cls, *, group: LabExperimentGroup, changed: dict
    ) -> tuple["ExperimentGroupAtomic", LabExperimentGroup]:
        return cls(_act="updated", group=group, _changed=changed), group

    @classmethod
    def deleted(
        cls, *, group: LabExperimentGroup
    ) -> tuple["ExperimentGroupAtomic", LabExperimentGroup]:
        return cls(_act="deleted", group=group), group

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "experiment_group"

    def act_entity_id(self) -> uuid_str:
        return self.group.id

    def payload(self) -> dict:
        if self._act == "created":
            return {
                "data": {
                    "id": self.group.id,
                    "name": self.group.name,
                    "experiment_type": self.group.experiment_type,
                    "sample_id": self.group.sample_id,
                    "variants": self._variants,
                }
            }
        dump = {
            "id": self.group.id,
            "name": self.group.name,
            "experiment_type": self.group.experiment_type,
            "status": self.group.status,
            "completed_runs": self.group.completed_runs,
            "failed_runs": self.group.failed_runs,
        }
        if self._act == "updated":
            return {"input": self._changed or {}, "result": dump}
        return {"data": dump}
