"""s3_partition_batch·s3_ground_batch — 실제 CV 파이프라인(segment/atoms/carve)을
통과시켜 build/apply 왕복이 라이브 서비스(test_form_schema_extract.py)와 같은
결과를 내는지 고정한다. LLM 호출만 UnitResult 로 대체."""
from __future__ import annotations

import json

import fitz

from app.modules.form.template.form_schema import validate_form_schema
from app.runtime.voucher_document.batch_unit import UnitResult
from app.runtime.voucher_document.document_to_form.ground_batch import (
    apply_ground_results,
    build_ground_units,
)
from app.runtime.voucher_document.document_to_form.partition_batch import (
    apply_partition_results,
    build_partition_units,
)


def _table_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=400, height=400)
    page.draw_rect(fitz.Rect(40, 40, 360, 120), color=(0, 0, 0), width=1)
    page.draw_line(fitz.Point(40, 80), fitz.Point(360, 80), color=(0, 0, 0), width=1)
    return doc.tobytes()


class TestPartitionBatch:
    def test_build_one_unit_for_form_page(self):
        units, no_atoms = build_partition_units(
            pdf_bytes=_table_pdf(), form_pages=["p-001"], model="m"
        )
        assert no_atoms == []
        assert len(units) == 1
        assert units[0].key == "p-001"
        assert units[0].model == "m"

    def test_apply_no_groups_falls_back_to_page_mode(self):
        pdf = _table_pdf()
        results = {"p-001": UnitResult(ok=True, content=json.dumps({"groups": None}))}
        partitions = apply_partition_results(results, pdf_bytes=pdf)
        assert partitions["p-001"] is None

    def test_apply_failed_call_is_none(self):
        results = {"p-001": UnitResult(ok=False, error="boom")}
        partitions = apply_partition_results(results, pdf_bytes=_table_pdf())
        assert partitions["p-001"] is None

    def test_invalid_page_reports_no_atoms(self):
        units, no_atoms = build_partition_units(
            pdf_bytes=_table_pdf(), form_pages=["p-099"], model="m"
        )
        assert units == []
        assert no_atoms == ["p-099"]

    def test_unit_carries_strict_groups_schema(self):
        units, _ = build_partition_units(
            pdf_bytes=_table_pdf(), form_pages=["p-001"], model="m"
        )
        rf = units[0].response_format
        assert rf["type"] == "json_schema"
        assert rf["json_schema"]["strict"] is True
        assert rf["json_schema"]["schema"]["required"] == ["groups"]


class TestGroundBatch:
    def test_page_mode_unit_built_when_partition_none(self):
        units = build_ground_units(
            pdf_bytes=_table_pdf(), form_pages=["p-001"], partitions={"p-001": None}, model="m"
        )
        assert len(units) == 1
        assert units[0].key == "p-001:page"

    def test_page_mode_apply_produces_schema_with_element(self):
        pdf = _table_pdf()
        ground_response = json.dumps(
            {
                "elements": [
                    {"region": 0, "label": "성명", "type": "text", "box": [100, 100, 200, 400]}
                ]
            },
            ensure_ascii=False,
        )
        results = {"p-001:page": UnitResult(ok=True, content=ground_response)}
        forms = apply_ground_results(
            results, pdf_bytes=pdf, form_pages=["p-001"], no_atoms_pages=[]
        )
        assert "p-001" in forms
        schema = forms["p-001"]
        fields = schema["fields"]
        assert len(fields) == 1
        assert next(iter(fields.values()))["label"] == "성명"
        validate_form_schema(schema)

    def test_no_atoms_page_gets_empty_schema(self):
        forms = apply_ground_results(
            {}, pdf_bytes=_table_pdf(), form_pages=["p-001"], no_atoms_pages=["p-001"]
        )
        assert forms["p-001"]["fields"] == {}

    def test_ground_unit_carries_strict_element_schema(self):
        # Google response_json_schema 호환 — region은 plain integer(enum 봉쇄 불가),
        # 전 property required. 블록 밖 차단은 focus_head + 사후 clamp가 담당.
        units = build_ground_units(
            pdf_bytes=_table_pdf(), form_pages=["p-001"], partitions={"p-001": None}, model="m"
        )
        item = units[0].response_format["json_schema"]["schema"][
            "properties"]["elements"]["items"]
        assert item["properties"]["region"] == {"type": "integer", "description": "SoM 영역 번호"}
        assert set(item["required"]) == {"region", "label", "type", "option", "unit", "box"}

    def test_block_mode_builds_one_unit_per_group_and_merges(self):
        pdf = _table_pdf()
        # 이 fixture PDF는 atom 2개(0,1) — 각각 별 블록으로 강제해 블록 경로를 태운다.
        partitions = {"p-001": [[0], [1]]}
        units = build_ground_units(pdf_bytes=pdf, form_pages=["p-001"], partitions=partitions, model="m")
        assert [u.key for u in units] == ["p-001:0", "p-001:1"]

        # box는 각 atom 자기 region1000 안이어야 clamp에서 살아남는다(atom0≈[101,101,197,896], atom1≈[202,101,297,896]).
        results = {
            "p-001:0": UnitResult(
                ok=True,
                content=json.dumps(
                    {"elements": [{"region": 0, "label": "성명", "type": "text", "box": [110, 110, 150, 300]}]},
                    ensure_ascii=False,
                ),
            ),
            "p-001:1": UnitResult(
                ok=True,
                content=json.dumps(
                    {"elements": [{"region": 1, "label": "생년월일", "type": "date", "box": [210, 110, 250, 300]}]},
                    ensure_ascii=False,
                ),
            ),
        }
        forms = apply_ground_results(
            results, pdf_bytes=pdf, form_pages=["p-001"], no_atoms_pages=[]
        )
        labels = {f["label"] for f in forms["p-001"]["fields"].values()}
        assert labels == {"성명", "생년월일"}
        validate_form_schema(forms["p-001"])

    def test_full_roundtrip_matches_live_service_shape(self):
        """test_form_schema_extract.py::test_document_to_form_detect_then_extract 와 동일 입력·기대값."""
        pdf = _table_pdf()
        _, no_atoms = build_partition_units(pdf_bytes=pdf, form_pages=["p-001"], model="m")
        assert no_atoms == []

        partitions = apply_partition_results(
            {"p-001": UnitResult(ok=True, content=json.dumps({"groups": None}))},
            pdf_bytes=pdf,
        )
        assert partitions == {"p-001": None}

        units = build_ground_units(
            pdf_bytes=pdf, form_pages=["p-001"], partitions=partitions, model="m"
        )
        assert [u.key for u in units] == ["p-001:page"]

        ground_response = json.dumps(
            {
                "elements": [
                    {"region": 0, "label": "성명", "type": "text", "box": [100, 100, 200, 400]}
                ]
            },
            ensure_ascii=False,
        )
        forms = apply_ground_results(
            {"p-001:page": UnitResult(ok=True, content=ground_response)},
            pdf_bytes=pdf,
            form_pages=["p-001"],
            no_atoms_pages=[],
        )
        assert next(iter(forms["p-001"]["fields"].values()))["label"] == "성명"
