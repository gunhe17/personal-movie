"""모델의 info={"reference_table_name": ...} 마커 → entity 관계 추출.

DB FK 제약 없이(모듈 독립성) 컬럼에 선언된 참조를 읽어 그래프의 원천을 만든다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.infrastructure.persistence.models import BaseModel


@dataclass(frozen=True)
class Relation:
    src: str       # 참조하는 entity (snake)
    col: str       # 그 컬럼명
    target: str    # 가리키는 entity


def _snake(camel: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", camel).lower()


def extract() -> list[Relation]:
    """등록된 모든 모델에서 info ref 마커 수집. 모델이 import된 상태 전제."""
    out: list[Relation] = []
    for mapper in BaseModel.registry.mappers:
        src = _snake(mapper.class_.__name__)
        for col in mapper.local_table.columns:
            ref = col.info.get("reference_table_name")
            if ref:
                out.append(Relation(src, col.name, ref))
                continue
            # 다형 참조 — 판별자(reference_type_field)로 갈림. 정적 매핑이 있으면 타깃별 edge.
            if col.info.get("reference_type_field"):
                for table in sorted(set(col.info.get("reference_tables", {}).values())):
                    out.append(Relation(src, col.name, table))
    return out


# #
# 완전성 — *_id 컬럼은 ref 마커가 있거나 아래 면제에 속해야 한다 (test_relations_completeness)

TENANT_ID = {"center_id"}

# *_id 이지만 nav 참조가 아님 — 완전성 린트가 면제로 인정.
NON_NAV_ID = {
    # 외부 시스템 id (entity 아님)
    "lgu_message_id", "toss_order_id", "s3_version_id", "trace_id", "provider_id",
    # 다형/모호 참조 잔여 — 마커 전환 안 된 것(billing·ai_lab=분리). 마킹되면 여기서 제거.
    # entity_id·reference_id 는 마커 전환 완료(D14 2026-07-14). target_id=admin_audit_logs
    # (개방 집합 + route 표면 없음 — 미전환 유지).
    "target_id", "source_id", "related_id",
    "related_case_id", "related_session_id", "item_id",
    "session_id", "field_id",
}

EXEMPT_ID = TENANT_ID | NON_NAV_ID


def unclassified_id_columns() -> list[str]:
    """*_id 인데 ref 마커도 없고 면제(EXEMPT_ID)도 아닌 컬럼. 모델 import 전제."""
    out = []
    for mapper in BaseModel.registry.mappers:
        for col in mapper.local_table.columns:
            if (
                col.name.endswith("_id")
                and col.name != "id"
                and "reference_table_name" not in col.info
                and "reference_type_field" not in col.info
                and col.name not in EXEMPT_ID
            ):
                out.append(f"{mapper.class_.__name__}.{col.name}")
    return sorted(out)
