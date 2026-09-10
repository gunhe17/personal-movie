"""Form 모듈 재설계 E2E — 실 Postgres(test DB) 대상.

경로: 템플릿 생성(draft) → in-place 수정 → 발행(published, 동결) →
      폼(form) 생성(created_by) → 값 저장(field_key·group_index·다중값·반복섹션·UPSERT) →
      제출(submitted_by, 필수검증) → 제출 후 불변 가드.

핸들러를 직접 구동(HTTP/auth 우회) — CLAUDE.md 의 E2E(Handler→DB) 경계.
실행: cd apps/api && uv run python tests/scenarios/run_form_e2e.py
사전: docker compose up -d postgres (localhost:3501)
"""
import asyncio
import sys

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.main  # noqa: F401 — 모든 모델 registry 등록
from app.core.exceptions import InvalidOperationException
from app.infrastructure.persistence.models import BaseModel
from app.infrastructure.persistence.unit_of_work import UnitOfWork

TEST_DB = "postgresql+asyncpg://imomtae:imomtae_dev@localhost:3501/imomtae"

CENTER = "center-e2e"
PERSON = "person-e2e"


# #
# assertions

PASS, FAIL = "✅ PASS", "❌ FAIL"
_failures: list[str] = []


def check(label: str, cond: bool, detail: str = "") -> None:
    print(f"  {PASS if cond else FAIL}  {label}" + (f"  — {detail}" if detail else ""))
    if not cond:
        _failures.append(label)


async def expect_raises(label: str, coro) -> None:
    try:
        await coro
        check(label, False, "예외가 발생하지 않음")
    except InvalidOperationException as e:
        check(label, True, str(e)[:60])


# #
# 양식 스키마 (pages + fields + elements, 0~n:n)

SCHEMA = {
    "pages": [{"no": 1, "image": "s3://forms/p1.png", "w": 2480, "h": 3508}],
    "fields": {
        "applicant_name": {"type": "text", "label": "성명", "required": True},
        "disability_types": {
            "type": "checkbox_group", "label": "장애유형",
            "options": [
                {"value": "physical", "label": "지체"},
                {"value": "visual", "label": "시각"},
                {"value": "other", "label": "기타", "allow_text": True},
            ],
        },
        "consent_privacy": {"type": "consent", "label": "개인정보 수집 동의", "required": True},
        "applicant_sign": {"type": "signature", "label": "신청인 서명"},
    },
    "elements": [
        {"id": "e_name", "page": 1, "rect": [0.12, 0.08, 0.30, 0.03], "z": 1,
         "widget": "text", "field_refs": ["applicant_name"]},
        {"id": "e_dis_phys", "page": 1, "rect": [0.12, 0.20, 0.02, 0.02], "z": 1,
         "widget": "checkbox", "field_refs": ["disability_types"], "option": "physical"},
        {"id": "e_dis_vis", "page": 1, "rect": [0.12, 0.24, 0.02, 0.02], "z": 1,
         "widget": "checkbox", "field_refs": ["disability_types"], "option": "visual"},
        {"id": "e_sign", "page": 1, "rect": [0.12, 0.85, 0.20, 0.05], "z": 2,
         "widget": "signature", "field_refs": ["applicant_sign"]},
        {"id": "e_title", "page": 1, "rect": [0.10, 0.04, 0.80, 0.02], "z": 0,
         "widget": "heading", "field_refs": []},  # 0 field = 장식
    ],
}


# #
# e2e

async def main() -> None:
    engine = create_async_engine(TEST_DB, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.drop_all)
        await conn.run_sync(BaseModel.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    from app.modules.form.template.handlers.create_form_template import create_form_template_handler
    from app.modules.form.template.handlers.update_form_template_draft import update_form_template_draft_handler
    from app.modules.form.template.handlers.publish_form_template import publish_form_template_handler
    from app.modules.form.template.schemas import TemplateCreate, TemplateDraftUpdate
    from app.modules.form.form.handlers.create_instance import create_instance_handler
    from app.modules.form.form.handlers.upsert_answers import upsert_answers_handler
    from app.modules.form.form.handlers.submit_instance import submit_instance_handler
    from app.modules.form.form.schemas import FormCreate
    from app.modules.form.value.schemas import ValuesUpsertRequest
    from app.modules.form.facade.form_facade import FormFacade
    from app.modules.form.form.repository import FormRepository
    from app.modules.form.value.repository import FormValueRepository

    async with Session() as session:
        uow = UnitOfWork(session)

        # ── 1. 템플릿 생성(draft) + 스키마 계약 검증 ──
        print("\n[1] 템플릿 생성 (draft) — FormSchema 계약 검증")
        tpl = await create_form_template_handler(
            CENTER,
            TemplateCreate.model_validate({"name": "장애인 지원 신청서", "schema": SCHEMA}),
            uow,
        )
        check("status=draft", tpl.status == "draft", tpl.status)
        check("version=1", tpl.version == 1, str(tpl.version))
        check("schema.fields 4개", len(tpl.schema_["fields"]) == 4)
        check("schema.elements 5개 (장식 1 포함)", len(tpl.schema_["elements"]) == 5)
        template_id = tpl.id

        # 잘못된 스키마는 거부 (element.field_refs → 미존재 필드)
        bad = {"fields": {"a": {"type": "text", "label": "A"}},
               "elements": [{"id": "x", "page": 1, "rect": [0, 0, 1, 1],
                             "widget": "text", "field_refs": ["NOPE"]}]}
        await expect_raises(
            "잘못된 스키마(미존재 field_ref) 거부",
            create_form_template_handler(CENTER, TemplateCreate.model_validate({"name": "bad", "schema": bad}), uow),
        )

        # ── 2. draft in-place 수정 (새 version 아님) ──
        print("\n[2] draft in-place 수정")
        edited = dict(SCHEMA)
        edited["fields"] = dict(SCHEMA["fields"])
        edited["fields"]["applicant_name"] = {"type": "text", "label": "신청인 성명", "required": True}
        upd = await update_form_template_draft_handler(
            template_id, CENTER, TemplateDraftUpdate.model_validate({"schema": edited}), uow,
        )
        check("in-place: version 유지(1)", upd.version == 1, str(upd.version))
        check("in-place: 라벨 반영", upd.schema_["fields"]["applicant_name"]["label"] == "신청인 성명")
        check("in-place: status 여전히 draft", upd.status == "draft", upd.status)

        # ── 3. 발행 (draft → published, 동결) ──
        print("\n[3] 발행 (publish)")
        pub = await publish_form_template_handler(template_id, CENTER, uow)
        check("status=published", pub.status == "published", pub.status)

        # 발행 후 in-place 수정은 거부
        await expect_raises(
            "published 템플릿 in-place 수정 거부",
            update_form_template_draft_handler(
                template_id, CENTER, TemplateDraftUpdate.model_validate({"schema": edited}), uow),
        )

        # ── 4. 폼(form) 생성 — created_by ──
        print("\n[4] 폼 생성 (created_by)")
        form = await create_instance_handler(CENTER, FormCreate(template_id=template_id), uow, PERSON)
        check("form.status=draft", form.status == "draft", form.status)
        check("created_by=person", form.created_by == PERSON, str(form.created_by))
        check("submitted_by=None", form.submitted_by is None)
        instance_id = form.id

        # ── 5. 값 저장 — field_key·group_index·다중값·반복섹션 ──
        print("\n[5] 값 저장 (field_key / group_index / 다중값 / 반복섹션)")
        await upsert_answers_handler(
            instance_id, CENTER,
            ValuesUpsertRequest.model_validate({"values": [
                {"field_key": "applicant_name", "value": {"value": "홍길동"}},
                {"field_key": "disability_types", "value": {"value": ["physical", "visual"], "other_text": None}},
                {"field_key": "consent_privacy", "value": {"value": True}},
                # 반복 섹션: 같은 field_key 를 group_index 로 구분
                {"field_key": "family_name", "group_index": 0, "value": {"value": "홍부모"}},
                {"field_key": "family_name", "group_index": 1, "value": {"value": "홍형제"}},
            ]}),
            uow,
        )
        rows = await uow.repo(FormValueRepository).list_by_instance(instance_id)
        by_key: dict[str, list] = {}
        for r in rows:
            by_key.setdefault(r.field_key, []).append(r)
        check("총 5개 값 row", len(rows) == 5, str(len(rows)))
        check("다중선택 value 배열", by_key["disability_types"][0].value["value"] == ["physical", "visual"])
        check("반복섹션 family_name 2 row(group 0·1)",
              len(by_key["family_name"]) == 2 and {r.group_index for r in by_key["family_name"]} == {0, 1})

        # UPSERT: 같은 (instance, field_key, group_index) 덮어쓰기 → row 증가 없음
        await upsert_answers_handler(
            instance_id, CENTER,
            ValuesUpsertRequest.model_validate({"values": [
                {"field_key": "applicant_name", "value": {"value": "김상담"}},
            ]}),
            uow,
        )
        uow.session.expire_all()  # 단일 세션 재사용 → identity-map 캐시 무효화 (HTTP는 요청별 새 세션)
        rows2 = await uow.repo(FormValueRepository).list_by_instance(instance_id)
        name_rows = [r for r in rows2 if r.field_key == "applicant_name"]
        check("UPSERT: applicant_name 여전히 1 row", len(name_rows) == 1, str(len(name_rows)))
        check("UPSERT: value 덮어쓰기됨", name_rows[0].value["value"] == "김상담")
        check("UPSERT: 총 row 5 유지", len(rows2) == 5, str(len(rows2)))

        # ── 6. 제출 — submitted_by + 필수검증 ──
        print("\n[6] 제출 (submitted_by, 필수검증)")
        submitted = await submit_instance_handler(instance_id, CENTER, uow, PERSON)
        check("status=submitted", submitted.status == "submitted", submitted.status)
        check("submitted_by=person", submitted.submitted_by == PERSON, str(submitted.submitted_by))
        check("submitted_at 기록", submitted.submitted_at is not None)
        check("응답에 values 포함", len(submitted.values) == 5, str(len(submitted.values)))

        # ── 7. 제출 후 불변 가드 ──
        print("\n[7] 제출 후 불변 가드")
        await expect_raises(
            "submitted 폼에 값 저장 거부",
            upsert_answers_handler(
                instance_id, CENTER,
                ValuesUpsertRequest.model_validate({"values": [{"field_key": "applicant_name", "value": {"value": "x"}}]}),
                uow),
        )

        # ── 8. 필수 누락 시 제출 거부 ──
        print("\n[8] 필수 필드 누락 → 제출 거부")
        form2 = await create_instance_handler(CENTER, FormCreate(template_id=template_id), uow, PERSON)
        await upsert_answers_handler(
            form2.id, CENTER,
            ValuesUpsertRequest.model_validate({"values": [
                {"field_key": "applicant_name", "value": {"value": "이름만"}},  # consent_privacy 누락
            ]}),
            uow,
        )
        await expect_raises(
            "필수(consent_privacy) 누락 제출 거부",
            submit_instance_handler(form2.id, CENTER, uow, PERSON),
        )
        f2 = await uow.repo(FormRepository).get_by_id_and_center(form2.id, CENTER)
        check("거부 후 status 여전히 draft", f2.status == "draft", f2.status)

    await engine.dispose()

    print("\n" + "=" * 50)
    if _failures:
        print(f"❌ {len(_failures)} 실패: {_failures}")
        sys.exit(1)
    print("✅ 전체 통과")


if __name__ == "__main__":
    asyncio.run(main())
