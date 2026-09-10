"""Voucher 추출 worker executor — job_type="voucher_extract".

**왜 워커인가** (2026-08-31 실측):
전진을 상세 조회(폴링) 안에서 돌리던 구조는 요청 수명이 곧 작업 수명이었다. 브라우저 axios
30초 타임아웃·`--reload` 재시작·세션 만료 중 하나만 걸려도 스테이지가 통째로 죽어, LLM 을
225건 다 호출하고도 결과를 못 남겼다(세 번 연속 재현). 중복 실행(field 6배)도 같은 뿌리 —
죽은 전진을 다음 폴링이 다시 시작하는 것이 유일한 완주 수단이었다.

**start / stop / resume**
- start  : upload·retry 가 이 잡을 큐에 넣는다. 1단계는 review 게이트까지, 2단계는
           confirm-layout 이 다시 넣은 잡이 done 까지 돈다.
- stop   : status 를 paused 로 바꾸면 **다음 전진 경계**의 status 확인에서 멈춘다.
           진행분(progress.data)은 그대로 두므로 태운 토큰이 버려지지 않는다.
           (progress 안 표식은 안 쓴다 — 전진 커밋이 progress 를 통째로 다시 쓰며 지운다)
- resume : 표식을 지우고 잡을 다시 넣으면 멈춘 지점부터 이어간다.

전진 1회마다 커밋한다 — 죽어도 그 직전까지는 남는다. 긴 스테이지(field·s3_detect)는 runner
가 청크로 잘라 같은 stage 를 되돌려주므로 손실 상한이 청크 하나다.

실행권(claim)은 여기서 잡는다 — 워커가 겹쳐 배달되거나 cron 안전망과 만나도 한 실행자만
전진한다. 긴 작업 전에 커밋돼야 보이므로 자체 세션에서 즉시 커밋한다(executor 는
자체 세션이 구조 필수인 슬롯 — runtime.md §3).
"""
from __future__ import annotations

from app.core.logger import get_logger
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client
from app.modules.document.facade import GlobalDocumentFacade
from app.modules.llm.facade.ai_facade import create_ai_facade
from app.modules.voucher.facade.voucher_facade import VoucherFacade
from app.runtime.voucher_document.extract_job.advance_batch_stage import (
    advance_batch_stage_if_ready,
)

logger = get_logger(__name__)

# 한 잡이 도는 최대 전진 수 — 무한루프 방어. 25바우처 + 213쪽/15 + 나머지에 여유.
MAX_ADVANCES = 200


async def _claim(
    extraction_id: str,
    stage: str,
) -> bool:
    try:
        async with AsyncSessionLocal() as session:
            got = await VoucherFacade(UnitOfWork(session)).claim_extraction_stage(
                extraction_id, stage=stage
            )
            await session.commit()
        return got
    except Exception:  # noqa: BLE001
        # 선점 실패는 전진을 막지 않는다 — 최악이 종전(중복 실행)이라 진행이 안전하다
        logger.warning(
            "voucher_extract: extraction=%s [%s] 선점 실패 — 그대로 진행",
            extraction_id,
            stage,
            exc_info=True,
        )
        return True


async def _release(
    extraction_id: str,
    stage: str,
) -> None:
    async with AsyncSessionLocal() as session:
        await VoucherFacade(UnitOfWork(session)).release_extraction_stage(
            extraction_id, stage=stage
        )
        await session.commit()


async def process_voucher_extract(
    extraction_id: str,
    center_id: str = "",
    **params,
) -> None:
    logger.info("voucher_extract 시작: extraction=%s", extraction_id)
    storage = get_storage_client()
    ai_facade = create_ai_facade()

    for _ in range(MAX_ADVANCES):
        async with AsyncSessionLocal() as session:
            uow = UnitOfWork(session)
            voucher_facade = VoucherFacade(uow)
            extraction = await voucher_facade.find_extraction_including_deleted(extraction_id)

            if extraction is None or extraction.deleted_at is not None:
                logger.info("voucher_extract: extraction=%s 사라짐, 중단", extraction_id)
                return
            if not extraction.is_processing:
                logger.info(
                    "voucher_extract: extraction=%s status=%s — 종료",
                    extraction_id,
                    extraction.status,
                )
                return

            progress = extraction.progress or {}
            stage = progress.get("stage")
            if not stage or stage == "done":
                return

            # 확정 게이트 — 1단계(영역·서식 정의)가 끝난 자리. 실행할 것이 없고,
            # 운영자가 confirm-layout 으로 2단계를 깨울 때까지 status=review 로 기다린다.
            if stage == "review":
                await voucher_facade.mark_extraction_review(extraction_id)
                await session.commit()
                logger.info(
                    "voucher_extract: extraction=%s 1단계 완료 — 영역 확정 대기", extraction_id
                )
                return

            if not await _claim(extraction_id, stage):
                logger.info(
                    "voucher_extract: extraction=%s [%s] 다른 실행자 점유 — 종료",
                    extraction_id,
                    stage,
                )
                return

            try:
                await advance_batch_stage_if_ready(
                    ai_facade=ai_facade,
                    voucher_facade=voucher_facade,
                    gdoc_facade=GlobalDocumentFacade(uow, storage),
                    storage=storage,
                    extraction=extraction,
                )
                await session.commit()
            except Exception:  # noqa: BLE001
                await session.rollback()
                logger.exception(
                    "voucher_extract: extraction=%s [%s] 전진 실패", extraction_id, stage
                )
                raise
            finally:
                await _release(extraction_id, stage)

    logger.warning(
        "voucher_extract: extraction=%s 전진 상한(%d) 도달 — 다음 잡이 이어받는다",
        extraction_id,
        MAX_ADVANCES,
    )
