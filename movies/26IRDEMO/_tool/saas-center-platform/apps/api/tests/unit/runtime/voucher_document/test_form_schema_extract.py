"""document_to_form — FormSchema 조립·타입 정규화 단위 테스트."""

from __future__ import annotations

from app.modules.form.template.form_schema import validate_form_schema
from app.runtime.voucher_document.document_to_form import pipeline


def test_to_form_schema_maps_consent_and_validates():
    built = {
        "page": {"w": 1000, "h": 1000},
        "elements": [
            {
                "key": "agree",
                "label": "개인정보 수집 동의",
                "type": "consent",
                "option": None,
                "unit": None,
                "rect": (100, 100, 50, 50),
            },
            {
                "key": "gender",
                "label": "성별",
                "type": "radio",
                "option": "남",
                "unit": None,
                "rect": (200, 200, 40, 20),
            },
            {
                "key": "gender",
                "label": "성별",
                "type": "radio",
                "option": "여",
                "unit": None,
                "rect": (260, 200, 40, 20),
            },
        ],
    }
    schema = pipeline.to_form_schema(built, image_name="p-001.png")
    assert schema["fields"]["agree"]["type"] == "checkbox_group"
    assert schema["fields"]["gender"]["type"] == "radio"
    assert {o["value"] for o in schema["fields"]["gender"]["options"]} == {"남", "여"}
    validate_form_schema(schema)
