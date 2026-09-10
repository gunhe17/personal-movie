"""Form Extraction E2E — 실 Postgres(test DB) 대상.

경로: 업로드/문서지정 → (실 executor: 렌더+추출, LLM/스토리지만 fake) → 확정(form_template).

voucher e2e 와 달리 워커를 시뮬레이션하지 않고 **실제 executor(process_form_extract)**
를 테스트 DB(settings.DATABASE_URL == TEST_DB)에서 구동한다 — 멀티모달 LLM 과
스토리지만 결정적 fake 로 대체. 렌더(fitz/PIL)·서비스·스키마 조립/검증·status 전환은
실제 코드가 돈다.

실행: cd apps/api && uv run python tests/scenarios/run_form_extraction_e2e.py
사전: docker compose up -d postgres (localhost:3501)
"""
import asyncio
import io

import fitz  # PyMuPDF
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from starlette.datastructures import Headers, UploadFile

import app.main  # noqa: F401 — 모든 모델 registry 등록
from app.core.exceptions import InvalidOperationException
from app.infrastructure.persistence.models import BaseModel
from app.infrastructure.persistence.unit_of_work import UnitOfWork

TEST_DB = "postgresql+asyncpg://imomtae:imomtae_dev@localhost:3501/imomtae"


# #
# fakes (외부 의존: 스토리지 / 멀티모달 LLM / 큐 / audit)

class _Storage:
    """인메모리 스토리지 — upload 한 바이트를 path 로 보관, download 로 반환."""

    def __init__(self):
        self._store: dict[str, bytes] = {}

    async def upload_file(self, *, file_data, path, content_type):
        self._store[path] = file_data
        return {"path": path}

    async def download_file(self, path):
        return self._store[path]

    async def delete_file(self, path):
        self._store.pop(path, None)


class _Audit:
    async def log(self, **kwargs):
        return None


class _Dispatcher:
    def __init__(self):
        self.calls = []

    async def dispatch(self, job_type, *, field_note_id, center_id, params):
        self.calls.append((job_type, field_note_id))


class _FakeExtractor:
    """결정적 FormSchema(fields/elements) 추출기 — LLM 대체."""

    def __init__(self):
        self.calls = 0

    async def extract(self, *, png_bytes, page_w, page_h, extraction_id):
        self.calls += 1
        return {
            "fields": {
                "applicant_name": {
                    "type": "text", "label": "성명", "required": True
                },
            },
            "elements": [
                {
                    "id": "e_name", "page": 1,
                    "rect": [0.12, 0.08, 0.30, 0.03], "z": 1,
                    "widget": "text", "field_refs": ["applicant_name"],
                },
            ],
        }


def _upload_file(data: bytes, filename: str, content_type: str) -> UploadFile:
    return UploadFile(
        file=io.BytesIO(data),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )


def _png_bytes(w=600, h=850) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), "white").save(buf, "PNG")
    return buf.getvalue()


def _pdf_bytes(pages: int) -> bytes:
    d = fitz.open()
    for _ in range(pages):
        d.new_page(width=595, height=842)
    out = d.tobytes()
    d.close()
    return out


# #
# assertions

PASS, FAIL = "✅ PASS", "❌ FAIL"
_failures: list[str] = []


def check(label: str, cond: bool, detail: str = ""):
    print(f"  {PASS if cond else FAIL}  {label}" + (f"  — {detail}" if detail else ""))
    if not cond:
        _failures.append(label)


# #
# e2e

async def main():
    engine = create_async_engine(TEST_DB, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.drop_all)
        await conn.run_sync(BaseModel.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    storage = _Storage()
    audit, dispatcher = _Audit(), _Dispatcher()

    # ── fake 주입: 핸들러/executor 의 모듈 레벨 의존 ──
    import app.modules.platform_admin.form.handlers.upload_form_extraction as up_mod
    up_mod.get_storage_client = lambda: storage

    import app.runtime.form_template.executor as ex_mod
    ex_mod.get_storage_client = lambda: storage
    ex_mod.LLMFormSchemaExtractor = lambda **kw: _FakeExtractor()

    from app.application.handlers.form.upload_form_extraction import (
        upload_form_extraction_handler,
    )
    from app.application.handlers.form.create_form_extraction_from_document import (
        create_form_extraction_from_document_handler,
    )
    from app.application.handlers.form.confirm_form_extraction import (
        confirm_form_extraction_handler,
    )
    from app.modules.platform_admin.form.schemas import (
        ConfirmFormExtractionRequest,
        FormExtractionFromDocumentRequest,
    )
    from app.modules.form.extraction.repository import FormExtractionRepository
    from app.modules.form.template.repository import FormTemplateRepository
    from app.modules.form.template.models import FormTemplate
    from app.modules.form.template.services.publish_template import (
        PublishTemplateService,
    )
    from app.modules.document.facade import GlobalDocumentFacade
    from app.modules.document.global_document.repository import (
        GlobalDocumentRepository,
    )

    async def load_ext(ext_id: str) -> dict:
        """fresh 세션으로 extraction 스냅샷(dict) 반환."""
        async with Session() as s:
            ext = await UnitOfWork(s).repo(FormExtractionRepository).get_by_id(ext_id)
            return {
                "status": ext.status,
                "image_document_id": ext.image_document_id,
                "completed": ext.completed,
                "failed": ext.failed,
                "center_id": ext.center_id,
                "name": ext.name,
            }

    async def active_templates(center_id, name) -> list[tuple]:
        """(center_id, name) 시리즈의 활성 템플릿 [(id, version, status)] (NULL-aware)."""
        async with Session() as s:
            cond = (
                FormTemplate.center_id.is_(None)
                if center_id is None
                else FormTemplate.center_id == center_id
            )
            rows = (await s.execute(
                select(FormTemplate).where(
                    cond,
                    FormTemplate.name == name,
                    FormTemplate.is_active == True,  # noqa: E712
                    FormTemplate.deleted_at.is_(None),
                )
            )).scalars().all()
            return [(r.id, r.version, r.status) for r in rows]

    # ── 1. 업로드(PNG) → started + source global_document ──
    print("\n[1] 업로드 (PNG) → started")
    async with Session() as s:
        uow = UnitOfWork(s)
        accepted = await upload_form_extraction_handler(
            name="장애인 등록 신청서",
            center_id="center-1",
            file=_upload_file(_png_bytes(), "form.png", "image/png"),
            uow=uow,
            audit=audit,
            dispatcher=dispatcher,
            uploader_id="admin-1",
        )
    ext_id = accepted.id
    snap = await load_ext(ext_id)
    check("status=started", snap["status"] == "started", snap["status"])
    check("dispatch 호출됨(form_extract, ext_id)",
          dispatcher.calls == [("form_extract", ext_id)], str(dispatcher.calls))
    check("아직 image_document_id 없음", snap["image_document_id"] is None)

    # ── 2. 실 executor 구동 (렌더+추출) → completed ──
    print("\n[2] executor (렌더+추출, LLM/스토리지 fake) → completed")
    await ex_mod.process_form_extract(field_note_id=ext_id, center_id="")
    snap = await load_ext(ext_id)
    check("status=completed", snap["status"] == "completed", snap["status"])
    check("image_document_id 설정됨", snap["image_document_id"] is not None)
    sc = snap["completed"] or {}
    check("completed.pages 1장", len(sc.get("pages") or []) == 1, str(sc.get("pages")))
    check("pages[0] image/w/h 존재",
          bool(sc.get("pages")) and all(k in sc["pages"][0] for k in ("image", "w", "h")))
    check("completed.fields 추출됨", "applicant_name" in (sc.get("fields") or {}))
    check("completed.elements 추출됨", len(sc.get("elements") or []) == 1)
    # 렌더 PNG 가 독립 global_document 로 선언됐는지
    async with Session() as s:
        img = await UnitOfWork(s).repo(GlobalDocumentRepository).get_by_id(
            snap["image_document_id"]
        )
    check("image global_document file_type=png", img is not None and img.file_type == "png",
          img.file_type if img else "none")

    # ── 2b. 멱등 재구동 → skip (image 그대로) ──
    print("\n[2b] executor 재구동 → 멱등 skip")
    prev_img = snap["image_document_id"]
    await ex_mod.process_form_extract(field_note_id=ext_id, center_id="")
    snap = await load_ext(ext_id)
    check("재구동해도 image_document_id 불변(skip)",
          snap["image_document_id"] == prev_img)

    # ── 3. 기존 문서(1-page PDF)에서 시작 → executor → completed ──
    print("\n[3] from-document (1-page PDF, page_range=1~1) → completed")
    async with Session() as s:
        uow = UnitOfWork(s)
        pdf_doc = await GlobalDocumentFacade(uow, storage).add_variant(
            name="이용신청서", data=_pdf_bytes(1), file_type="pdf",
            content_type="application/pdf",
        )
        await uow.commit()
        pdf_doc_id = pdf_doc.id
    async with Session() as s:
        uow = UnitOfWork(s)
        accepted3 = await create_form_extraction_from_document_handler(
            FormExtractionFromDocumentRequest(
                source_document_id=pdf_doc_id, name="이용신청서",
                center_id=None, page_range=(1, 1),
            ),
            uow, audit, dispatcher,
        )
    ext3 = accepted3.id
    await ex_mod.process_form_extract(field_note_id=ext3, center_id="")
    snap3 = await load_ext(ext3)
    check("from-document status=completed", snap3["status"] == "completed", snap3["status"])
    check("from-document image 생성", snap3["image_document_id"] is not None)
    check("from-document center_id=None(시스템)", snap3["center_id"] is None)

    # ── 4. 다중 페이지 가드 → status=failed ──
    print("\n[4] 다중 페이지(2-page PDF, page_range 없음) → failed")
    async with Session() as s:
        uow = UnitOfWork(s)
        pdf2_doc = await GlobalDocumentFacade(uow, storage).add_variant(
            name="다중서식", data=_pdf_bytes(2), file_type="pdf",
            content_type="application/pdf",
        )
        await uow.commit()
        pdf2_id = pdf2_doc.id
    async with Session() as s:
        uow = UnitOfWork(s)
        accepted4 = await create_form_extraction_from_document_handler(
            FormExtractionFromDocumentRequest(
                source_document_id=pdf2_id, name="다중서식",
                center_id=None, page_range=None,
            ),
            uow, audit, dispatcher,
        )
    ext4 = accepted4.id
    await ex_mod.process_form_extract(field_note_id=ext4, center_id="")
    snap4 = await load_ext(ext4)
    check("다중 페이지 status=failed", snap4["status"] == "failed", snap4["status"])
    check("failed 사유에 '다중 페이지'", "다중 페이지" in (snap4["failed"] or ""), snap4["failed"])

    # ── 5. 확정 → form_template draft 생성 ──
    print("\n[5] 확정 (편집된 FormSchema → form_template draft)")
    edited_schema = {
        "pages": [{"no": 1, "image": "s3://forms/edited-p1.png", "w": 600, "h": 850}],
        "fields": {
            "applicant_name": {"type": "text", "label": "성명", "required": True},
            "consent_privacy": {"type": "consent", "label": "개인정보 동의", "required": True},
        },
        "elements": [
            {"id": "e1", "page": 1, "rect": [0.12, 0.08, 0.30, 0.03], "z": 1,
             "widget": "text", "field_refs": ["applicant_name"]},
        ],
    }
    async with Session() as s:
        uow = UnitOfWork(s)
        confirm_res = await confirm_form_extraction_handler(
            ext_id,
            ConfirmFormExtractionRequest(name="장애인 등록 신청서", schema=edited_schema),
            uow, audit,
        )
    check("confirm status=draft", confirm_res.status == "draft", confirm_res.status)
    check("confirm version=1", confirm_res.version == 1)
    check("confirm created=True (신규 v1)", confirm_res.created is True)
    template_id = confirm_res.template_id
    async with Session() as s:
        tmpl = await UnitOfWork(s).repo(FormTemplateRepository).get_by_id(template_id)
    check("form_template DB 존재", tmpl is not None)
    check("form_template status=draft", tmpl is not None and tmpl.status == "draft")
    check("form_template center_id=center-1", tmpl is not None and tmpl.center_id == "center-1")
    check("form_template schema fields 보존",
          tmpl is not None and "consent_privacy" in (tmpl.schema.get("fields") or {}))

    # ── 5b. 재확정(같은 이름, draft) → in-place 덮어쓰기 (옵션 3) ──
    print("\n[5b] 재확정 (draft) → in-place 덮어쓰기")
    edited_schema_v2 = {
        "pages": [{"no": 1, "image": "s3://forms/edited-p1.png", "w": 600, "h": 850}],
        "fields": {
            "applicant_name": {"type": "text", "label": "성명(수정)", "required": True},
        },
        "elements": [],
    }
    async with Session() as s:
        reconfirm = await confirm_form_extraction_handler(
            ext_id,
            ConfirmFormExtractionRequest(name="장애인 등록 신청서", schema=edited_schema_v2),
            UnitOfWork(s), audit,
        )
    check("재확정 created=False (덮어쓰기)", reconfirm.created is False)
    check("재확정 같은 template_id", reconfirm.template_id == template_id,
          f"{reconfirm.template_id} vs {template_id}")
    check("재확정 version 유지=1", reconfirm.version == 1, str(reconfirm.version))
    async with Session() as s:
        tmpl2 = await UnitOfWork(s).repo(FormTemplateRepository).get_by_id(template_id)
    check("덮어쓴 schema 반영(label 수정)",
          tmpl2.schema["fields"]["applicant_name"]["label"] == "성명(수정)")
    actives = await active_templates("center-1", "장애인 등록 신청서")
    check("센터 활성 템플릿 여전히 1개", len(actives) == 1, str(actives))

    # ── 5c. published 후 재확정 → 버전 증가 (옵션 3) ──
    print("\n[5c] published 후 재확정 → version 증가")
    async with Session() as s:
        uow = UnitOfWork(s)
        await PublishTemplateService(
            uow.repo(FormTemplateRepository)
        ).execute(template_id, "center-1")
        await uow.commit()
    async with Session() as s:
        bumped = await confirm_form_extraction_handler(
            ext_id,
            ConfirmFormExtractionRequest(name="장애인 등록 신청서", schema=edited_schema),
            UnitOfWork(s), audit,
        )
    check("버전증가 created=True", bumped.created is True)
    check("버전증가 version=2", bumped.version == 2, str(bumped.version))
    check("버전증가 새 template_id", bumped.template_id != template_id)
    actives = await active_templates("center-1", "장애인 등록 신청서")
    check("버전증가 후 활성 1개(v2 draft)",
          actives == [(bumped.template_id, 2, "draft")], str(actives))
    async with Session() as s:
        old = await UnitOfWork(s).repo(FormTemplateRepository).get_by_id(template_id)
    check("이전 v1 비활성화+published",
          old.is_active is False and old.status == "published")

    # ── 5d. 시스템 템플릿(center_id=None) 재확정 → NULL 중복 없음 ──
    print("\n[5d] 시스템 템플릿 재확정 → NULL 중복 안 쌓임")
    sys_schema = {
        "pages": [{"no": 1, "image": "s3://forms/sys.png", "w": 595, "h": 842}],
        "fields": {"f1": {"type": "text", "label": "이름"}},
        "elements": [],
    }
    async with Session() as s:
        sys1 = await confirm_form_extraction_handler(
            ext3,  # from-document, center_id=None, name="이용신청서"
            ConfirmFormExtractionRequest(name="이용신청서", schema=sys_schema),
            UnitOfWork(s), audit,
        )
    check("시스템 첫 확정 created=True", sys1.created is True)
    async with Session() as s:
        sys2 = await confirm_form_extraction_handler(
            ext3,
            ConfirmFormExtractionRequest(name="이용신청서", schema=sys_schema),
            UnitOfWork(s), audit,
        )
    check("시스템 재확정 created=False (덮어쓰기, NULL-aware)", sys2.created is False)
    check("시스템 재확정 같은 template_id", sys2.template_id == sys1.template_id)
    sys_actives = await active_templates(None, "이용신청서")
    check("시스템 활성 템플릿 정확히 1개(중복 없음)", len(sys_actives) == 1, str(sys_actives))

    # ── 6. 확정 — 잘못된 schema 거부 ──
    print("\n[6] 확정 — 유효하지 않은 FormSchema 거부")
    bad_schema = {
        "pages": [], "fields": {},
        "elements": [
            {"id": "e_bad", "page": 1, "rect": [0.1, 0.1, 0.2, 0.2], "z": 1,
             "widget": "text", "field_refs": ["nonexistent_field"]},
        ],
    }
    raised = False
    try:
        async with Session() as s:
            await confirm_form_extraction_handler(
                ext_id,
                ConfirmFormExtractionRequest(name="불량서식", schema=bad_schema),
                UnitOfWork(s), audit,
            )
    except InvalidOperationException as e:
        raised = True
        detail = str(e)[:50]
    check("잘못된 schema → InvalidOperationException", raised, detail if raised else "")

    await engine.dispose()

    print("\n" + ("=" * 50))
    if _failures:
        print(f"E2E FAILED — {len(_failures)} check(s): {_failures}")
        raise SystemExit(1)
    print("E2E ALL GREEN ✅")


if __name__ == "__main__":
    asyncio.run(main())
