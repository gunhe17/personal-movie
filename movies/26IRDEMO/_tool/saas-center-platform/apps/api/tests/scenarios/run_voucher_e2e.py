"""Voucher 가공→확정 E2E — 실 Postgres(격리 test DB) 대상.

경로: 업로드 → (실 executor 로 가공, **가공 AI 는 mock**) → 확정(confirm) → 센터 서빙.
입력/산출 문서 분리(source_document_ids / artifact_document_ids)를 검증한다.

- 외부 의존(스토리지/LLM)은 스텁/모킹한다.
- 가공 AI(ExtractVouchersFromDocumentService)는 가짜로 교체:
  · 산출물(md) global_document 1건을 artifact_document_ids 에 추가 (save_markdown side effect 모사)
  · 고정된 ExtractedVoucher 1건 반환
- 워커 진입점 process_extract 는 **실제 코드**를 실행한다(결과 조립·status 전이·트랜잭션).

격리: dev DB(imomtae) 를 건드리지 않도록 별도 imomtae_test DB 사용(drop/create_all).
실행: cd apps/api && uv run python tests/scenarios/run_voucher_e2e.py
사전: docker compose up -d postgres (localhost:3501) + CREATE DATABASE imomtae_test
"""
import asyncio
import io

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from starlette.datastructures import Headers, UploadFile

import app.main  # noqa: F401 — 모든 모델 registry 등록
from app.infrastructure.persistence.models import BaseModel
from app.infrastructure.persistence.unit_of_work import UnitOfWork

# dev(imomtae) 와 분리된 격리 test DB
TEST_DB = "postgresql+asyncpg://imomtae:imomtae_dev@localhost:3501/imomtae_test"


# #
# stubs / mocks (외부 의존)

class _Storage:
    async def upload_file(self, *, file_data, path, content_type):
        return {"path": path}

    async def download_file(self, path):
        return b"%PDF-1.4 fake"

    async def get_presigned_url(self, *, path, expires_in=3600, **kw):
        return f"https://stub.example/{path}"


class _Audit:
    async def log(self, **kwargs):
        return None


class _Dispatcher:
    def __init__(self):
        self.calls = []

    async def dispatch(self, job_type, *, field_note_id, center_id, params):
        self.calls.append((job_type, field_note_id))


class _FakeExtractService:
    """가공 AI mock — 실제 LLM 파이프라인(S1~S3) 대신:
    1) 산출 md + 서식 png global_document 를 artifact_document_ids 에 추가
       (save_markdown / save_form_pages side effect 모사)
    2) spec §6 구조의 DocumentProcessingResult 반환
    (executor 가 이 결과로 completed 를 조립하고 status=completed 로 전이)
    """

    def __init__(self, *, gdoc_facade, storage, ai_gateway, **_):
        from app.modules.document.global_document.repository import (
            GlobalDocumentRepository,
        )
        self._gdoc_repo = gdoc_facade._uow.repo(GlobalDocumentRepository)

    async def _add_artifact(self, extraction, *, name, file_type, path):
        from sqlalchemy.orm.attributes import flag_modified

        doc = await self._gdoc_repo.create(
            {"name": name, "file_type": file_type, "storage_path": path,
             "file_size": 1234, "uploader_id": None}
        )
        await self._gdoc_repo._session.flush()
        arts = list(extraction.artifact_document_ids or [])
        arts.append(doc.id)
        extraction.artifact_document_ids = arts
        flag_modified(extraction, "artifact_document_ids")
        return doc

    async def execute(self, *, extraction):
        from app.runtime.voucher_document.extract_job.schemas import (
            DocumentProcessingResult,
        )

        await self._add_artifact(
            extraction,
            name="2026 우리아이 심리지원 안내 (가공 md)", file_type="md",
            path=f"global-documents/{extraction.id}-merged.md",
        )
        png = await self._add_artifact(
            extraction,
            name="2026 우리아이 심리지원 안내 서식 p-016", file_type="png",
            path=f"global-documents/{extraction.id}-p016.png",
        )

        return DocumentProcessingResult(
            vouchers=[
                {
                    "no": "1",
                    "name": "우리아이심리지원",
                    "code": "010109",
                    "span": ["p-012", "p-018"],
                    # 최신 명세: 값마다 {value,page,quote} + S2c 스냅(quote_pdf·match)
                    "fields": {
                        "purpose": {"value": "아동 심리지원 서비스 제공", "page": "p-012",
                                    "quote": "심리·행동 문제의 조기 개입",
                                    "quote_pdf": "심리･행동 문제의 조기 개입", "match": "snapped"},
                        "region": {"value": ["수원", "성남"], "page": "p-013",
                                   "items": [{"시군": "수원", "mark": "○"},
                                             {"시군": "성남", "mark": "○"},
                                             {"시군": "부천", "mark": "X"}]},
                        "target_income": {"value": "기준중위소득 120% 이하", "page": "p-013",
                                          "quote": "기준중위소득 120% 이하 가구",
                                          "quote_pdf": "기준중위소득 120% 이하 가구", "match": "exact"},
                        "target_age": {"value": "만 7세~12세", "page": "p-013",
                                       "quote": "만 7세 ~ 12세 이하 아동",
                                       "quote_pdf": "만 7세 ~ 12세 이하 아동", "match": "exact"},
                        "target_need": None,
                        "target_dup": None,
                        "service": {"기본": [{"value": "심리상담", "page": "p-014",
                                             "quote": "주 1회 50분 심리상담 제공",
                                             "quote_pdf": "주 1회 50분 심리상담 제공",
                                             "match": "exact"}],
                                    "부가": []},
                        "staff": None,
                        "price": {"회차": {"value": "월 4회", "page": "p-015",
                                          "quote": "월 4회", "quote_pdf": "월 4회",
                                          "match": "exact"}},
                        "copay": [{"등급": "1", "value": {"최소": 20000, "최대": 40000},
                                   "page": "p-015", "quote": "20,000~40,000원",
                                   "quote_pdf": "20,000~40,000원", "match": "exact"}],
                        "gov": [{"등급": "1", "value": {"최소": 160000, "최대": 180000},
                                 "page": "p-015", "quote": "160~180천원",
                                 "quote_pdf": None, "match": "none"}],
                        "voucher": None,
                    },
                }
            ],
            forms=[
                {"page": "p-016", "title": "이용신청서", "kind": "신청서",
                 "global_document_id": png.id},
            ],
        )


def _upload_file(name: str, ext: str, content_type: str) -> UploadFile:
    return UploadFile(
        file=io.BytesIO(f"fake-{ext}-bytes".encode()),
        filename=f"{name}.{ext}",
        headers=Headers({"content-type": content_type}),
    )


# #
# assertions

PASS, FAIL = "✅ PASS", "❌ FAIL"
_failures = []


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

    # ── 모킹 주입 ──
    # 업로드 핸들러: 모듈 레벨 get_storage_client
    import app.modules.platform_admin.voucher.handlers.upload_voucher_extraction as up_mod
    up_mod.get_storage_client = lambda: _Storage()

    # executor: 자체 세션을 test DB 로, 외부 의존/가공 AI 를 mock
    import app.runtime.voucher_document.executor as ex_mod
    ex_mod.AsyncSessionLocal = Session
    ex_mod.get_storage_client = lambda: _Storage()
    ex_mod.create_ai_gateway = lambda: None
    ex_mod.ExtractVouchersFromDocumentService = _FakeExtractService

    from app.application.handlers.voucher.upload_voucher_extraction import (
        upload_voucher_extraction_handler,
    )
    from app.application.handlers.voucher.confirm_voucher_extraction import (
        confirm_voucher_extraction_handler,
    )
    from app.modules.platform_admin.voucher.handlers.get_voucher_extraction import (
        get_voucher_extraction_handler,
    )
    from app.modules.platform_admin.voucher.schemas import (
        ConfirmExtractionRequest,
        ConfirmExtractionVoucherItem,
        VoucherFileType,
    )
    from app.modules.voucher.voucher_extraction.models import (
        VoucherExtractionStatus,
    )
    from app.modules.voucher.voucher_extraction.repository import (
        VoucherExtractionRepository,
    )
    from app.modules.document.global_document.repository import (
        GlobalDocumentRepository,
    )
    from app.modules.voucher.voucher_document.repository import (
        VoucherDocumentRepository,
    )
    from app.modules.voucher.center_voucher.repository import (
        CenterVoucherRepository,
    )
    from app.modules.voucher.facade.center_voucher_facade import (
        CenterVoucherFacade,
    )

    audit, dispatcher = _Audit(), _Dispatcher()

    async with Session() as session:
        uow = UnitOfWork(session)

        # ── 1. 업로드 → global_documents(pdf+hwpx) + extraction(started) ──
        print("\n[1] 업로드 → 가공 시작 (source/artifact 분리)")
        accepted = await upload_voucher_extraction_handler(
            name="2026 우리아이 심리지원 안내",
            type=VoucherFileType.MANUAL,
            source_url="https://example.gov/guide",
            files=[
                _upload_file("guide", "pdf", "application/pdf"),
                _upload_file("guide", "hwpx", "application/x-hwpx"),
            ],
            uow=uow,
            audit=audit,
            dispatcher=dispatcher,
            uploader_id="admin-1",
        )
        ext_id = accepted.id
        ext = await uow.repo(VoucherExtractionRepository).get_by_id(ext_id)
        check("status=processing", ext.status == VoucherExtractionStatus.PROCESSING, ext.status)
        check("source_document_ids 2건(pdf+hwpx)", len(ext.source_document_ids) == 2, str(ext.source_document_ids))
        check("artifact_document_ids 0건(가공 전)", len(ext.artifact_document_ids) == 0)
        check("dispatch 호출됨", dispatcher.calls == [("voucher_extract", ext_id)], str(dispatcher.calls))

        # ── 2. 실 executor 로 가공 (가공 AI 는 mock) ──
        print("\n[2] 가공 (real executor + mock AI)")
        await ex_mod.process_extract(field_note_id=ext_id, center_id="")

        session.expire_all()  # executor 가 별도 세션으로 커밋 → 최신값 재로딩
        ext = await uow.repo(VoucherExtractionRepository).get_by_id(ext_id)
        check("status=completed", ext.status == VoucherExtractionStatus.COMPLETED, ext.status)
        check("source 2건 유지", len(ext.source_document_ids) == 2)
        check("artifact 2건 추가(가공 md + 서식 png)", len(ext.artifact_document_ids) == 2, str(ext.artifact_document_ids))
        check("all_document_ids 4건", len(ext.all_document_ids) == 4)

        # completed = spec §6 구조: vouchers(no/name/code/span/fields 12키) + forms
        vouchers = (ext.completed or {}).get("vouchers") or []
        check("completed.vouchers 1건", len(vouchers) == 1, f"{len(vouchers)}건")
        v0 = vouchers[0] if vouchers else {}
        check("voucher 식별자(no/name/code)",
              (v0.get("no"), v0.get("name"), v0.get("code")) == ("1", "우리아이심리지원", "010109"))
        check("voucher span", v0.get("span") == ["p-012", "p-018"], str(v0.get("span")))
        fields = v0.get("fields") or {}
        check("값마다 {value,page,quote(+quote_pdf,match)} 동반",
              fields.get("purpose", {}).get("value") == "아동 심리지원 서비스 제공"
              and fields.get("purpose", {}).get("page") == "p-012"
              and fields.get("purpose", {}).get("match") == "snapped"
              and "조기 개입" in (fields.get("purpose", {}).get("quote_pdf") or ""))
        check("region 시군별 items {시군,mark}",
              fields.get("region", {}).get("value") == ["수원", "성남"]
              and [i["mark"] for i in fields.get("region", {}).get("items", [])] == ["○", "○", "X"])
        check("copay 등급별 배열 + 금액 정수 환산",
              fields.get("copay", [{}])[0].get("value") == {"최소": 20000, "최대": 40000})
        check("빈 필드는 노드 null", fields.get("target_need") is None and fields.get("voucher") is None)
        forms = (ext.completed or {}).get("forms") or []
        check("completed.forms 1건(신청서, gdoc id 참조)",
              len(forms) == 1 and forms[0].get("kind") == "신청서"
              and forms[0].get("global_document_id") in ext.artifact_document_ids,
              str(forms))

        # 가공 산출물이 실제 global_document 로 존재 (md + png)
        art_docs = await uow.repo(GlobalDocumentRepository).list_many_by_ids(
            ext.artifact_document_ids
        )
        check("artifact global_documents 존재(md+png)",
              sorted(d.file_type for d in art_docs) == ["md", "png"],
              str(sorted(d.file_type for d in art_docs)))

        # 상세 API — 입력/산출 분리 노출 검증
        detail = await get_voucher_extraction_handler(ext_id, uow, _Storage())
        check("상세 source_documents 2건(pdf+hwpx)",
              sorted(d.file_type for d in detail.source_documents) == ["hwpx", "pdf"],
              str([d.file_type for d in detail.source_documents]))
        check("상세 artifact_documents 2건(md+png)",
              sorted(d.file_type for d in detail.artifact_documents) == ["md", "png"])

        # ── 3. 확정 — 편집 payload → Voucher + voucher_documents(전 문서) ──
        print("\n[3] 확정 (편집 payload → 카탈로그 + 링크)")
        confirm_res = await confirm_voucher_extraction_handler(
            ext_id,
            ConfirmExtractionRequest(vouchers=[
                ConfirmExtractionVoucherItem(
                    name="우리아이심리지원",
                    program_name="우리아이 심리지원사업",
                    program_organization="보건복지부",
                    program_year=2026,
                    page_range=(12, 18),
                )
            ]),
            uow,
            audit,
        )
        check("voucher 1건 생성", confirm_res.voucher_created_count == 1)
        check("voucher_documents 4건 링크(source 2+artifact 2)", confirm_res.link_created_count == 4, str(confirm_res.link_created_count))
        voucher_id = confirm_res.items[0].voucher_id
        links = await uow.repo(VoucherDocumentRepository).list_by_voucher(voucher_id)
        check("DB voucher_documents 4건", len(links) == 4, f"{len(links)}건")

        # 멱등: 재확정 시 중복 링크 없음
        confirm_res2 = await confirm_voucher_extraction_handler(
            ext_id,
            ConfirmExtractionRequest(vouchers=[
                ConfirmExtractionVoucherItem(
                    name="우리아이심리지원", program_name="우리아이 심리지원사업",
                    program_organization="보건복지부", program_year=2026,
                    page_range=(12, 18),
                )
            ]),
            uow, audit,
        )
        check("재확정 멱등(voucher 재사용·링크 0)",
              confirm_res2.voucher_reused_count == 1 and confirm_res2.link_created_count == 0,
              f"reused={confirm_res2.voucher_reused_count} new_links={confirm_res2.link_created_count}")

        # ── 4. 센터 서빙 — MD 필터(원본만 노출) ──
        print("\n[4] 센터 서빙 (가공 md 미노출)")
        cv = await uow.repo(CenterVoucherRepository).create(
            {"center_id": "center-1", "catalog_id": voucher_id,
             "is_active": True, "created_by": "admin-1"}
        )
        await uow.commit()
        files_res = await CenterVoucherFacade(uow).get_voucher_documents_with_response(
            center_id="center-1", center_voucher_id=cv.id,
        )
        served_types = sorted(i.file_type for i in files_res.items)
        # 가공 md 는 내부 산출물이라 제외, 서식 png 는 제출용 자료라 서빙
        check("센터 서빙 3건(pdf+hwpx+서식png, md 제외)", served_types == ["hwpx", "pdf", "png"], str(served_types))

    await engine.dispose()

    print("\n" + ("=" * 50))
    if _failures:
        print(f"E2E FAILED — {len(_failures)} check(s): {_failures}")
        raise SystemExit(1)
    print("E2E ALL GREEN ✅")


if __name__ == "__main__":
    asyncio.run(main())
