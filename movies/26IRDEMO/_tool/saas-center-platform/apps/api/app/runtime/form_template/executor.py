"""Form 서식 추출 worker executor — job_type="form_extract".

범용 batch 워커(ai:jobs:batch)가 job_type=form_extract 메시지를 받으면 JOB_HANDLERS
테이블(application/jobs/routes.py)로 이 executor 를 찾아 실행한다.

계약 (voucher_extract 평행):
- target_id = form_extraction id.
- 가공 상태/책임은 extraction 이 소유: status processing→completed/failed.
- COMPLETED 재배달은 멱등 skip(토큰 낭비 방지).
- 실패는 어떤 에러든 별도 트랜잭션으로 extraction.status=failed 마킹.
- LLM 호출은 AIGateway.generate_multimodal 경유 — api_key 는 게이트웨이가
  settings.OPENROUTER_API_KEY 로 직접 읽는다.
"""
from __future__ import annotations

from app.infrastructure.storage import get_storage_client
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.document.facade import GlobalDocumentFacade
from app.modules.form.facade import FormExtractionFacade
from app.modules.llm.facade.ai_facade import create_ai_facade
from app.runtime.form_template.constants import JOB_TYPE_FORM_EXTRACT
from app.runtime.form_template.extraction.schema_extraction import LLMFormSchemaExtractor
from app.runtime.form_template.extraction.service import ExtractFormSchemaService

logger = get_logger(__name__)


async def process_form_extract(
    extraction_id: str,
    center_id: str,
    **params,
) -> None:
    """원본(global_document) → 서식 PNG + FormSchema → extraction.completed 저장.
    """
    logger.info("form_extract 시작: extraction=%s", extraction_id)

    try:
        storage = get_storage_client()
        ai_gateway = create_ai_facade()
        extractor = LLMFormSchemaExtractor(ai_gateway=ai_gateway)

        async with AsyncSessionLocal() as session:
            uow = UnitOfWork(session)
            async with uow:
                form_facade = FormExtractionFacade(uow)
                extraction = await form_facade.find_extraction(extraction_id)
                if extraction is None:
                    logger.warning(
                        "form_extract: extraction=%s 사라짐, 중단", extraction_id
                    )
                    return

                # idempotent skip — 재배달된 완료 잡은 재추출하지 않음
                if extraction.is_completed:
                    logger.info(
                        "form_extract: extraction=%s 이미 완료, skip", extraction_id
                    )
                    return

                gdoc_facade = GlobalDocumentFacade(uow, storage)
                service = ExtractFormSchemaService(
                    gdoc_facade=gdoc_facade,
                    extraction_facade=form_facade,
                    storage=storage,
                    extractor=extractor,
                )
                schema = await service.execute(extraction=extraction)

                await form_facade.mark_extraction_completed(
                    extraction_id=extraction_id,
                    completed=schema,
                )
                await uow.commit()
                logger.info(
                    "form_extract 완료: extraction=%s fields=%d elements=%d",
                    extraction_id,
                    len(schema.get("fields") or {}),
                    len(schema.get("elements") or []),
                )
    except Exception as e:  # noqa: BLE001
        logger.exception("form_extract 실패: extraction=%s", extraction_id)
        await _mark_failed(extraction_id, reason=str(e)[:1000])


async def _mark_failed(
    extraction_id: str,
    *,
    reason: str,
) -> None:
    """별도 트랜잭션으로 status=failed 저장 (가공 실패 마킹)."""
    try:
        async with AsyncSessionLocal() as session:
            uow = UnitOfWork(session)
            async with uow:
                marked = await FormExtractionFacade(uow).mark_extraction_failed(
                    extraction_id, reason
                )
                if marked:
                    await uow.commit()
    except Exception:  # noqa: BLE001
        logger.exception(
            "_mark_failed 자체 실패: extraction=%s — status 동기화 불가",
            extraction_id,
        )
