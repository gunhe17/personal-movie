import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass
class JobMessage:
    # Redis Stream 저장 단위 — 모든 필드는 문자열로 직렬화 가능해야 함.
    # target_id = 잡의 대상 리소스 id(job_type이 종류를 판별) — U12 범용 봉투.
    job_type: str
    target_id: str
    center_id: str
    params: dict[str, Any] = field(default_factory=dict)
    job_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: float = field(default_factory=time.time)

    def to_redis(self) -> dict[str, str]:
        return {
            "job_id": self.job_id,
            "job_type": self.job_type,
            "target_id": self.target_id,
            "center_id": self.center_id,
            "params": json.dumps(self.params, ensure_ascii=False),
            "created_at": str(self.created_at),
        }

    @classmethod
    def from_redis(cls, data: dict[str, str]) -> "JobMessage":
        return cls(
            job_id=data["job_id"],
            job_type=data["job_type"],
            # 배포 중 스트림 잔여(구 봉투) 호환 — 구 키 fallback
            target_id=data.get("target_id") or data["field_note_id"],
            center_id=data["center_id"],
            params=json.loads(data.get("params", "{}")),
            created_at=float(data.get("created_at", 0)),
        )
