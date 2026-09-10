"""모든 *_id 컬럼이 분류돼 있는지 — info ref 마커거나, 명시 면제(EXEMPT_ID).

새 모델/컬럼이 *_id 를 추가하면서 ref 도 면제도 안 정하면 실패한다. silent gap 방어.
"""

from app.infrastructure.persistence.relations import unclassified_id_columns
from app.infrastructure.persistence.schema_doc import import_all_models


def test_all_id_columns_classified():
    import_all_models()
    gaps = unclassified_id_columns()
    assert not gaps, (
        "분류 안 된 *_id 컬럼:\n  "
        + "\n  ".join(gaps)
        + "\n→ info={'ref': ...} 추가하거나 relations.py 의 NON_NAV_ID 에 등록"
    )
