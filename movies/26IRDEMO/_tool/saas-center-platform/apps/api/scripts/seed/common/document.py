"""2026 경기도 지역사회서비스투자사업 표준매뉴얼 — 카탈로그 연결용 원본 문서.

S3 에 이미 업로드된 원본 PDF 를 global_document 로 등록한다(추출 잡은 만들지 않음).
이 문서는 카탈로그 voucher(voucher 시드)들이 연결하는 출처 문서다.
바우처 정보 AI 추출(voucher_extractions)은 아동정서발달지원서비스 1건만 둔다
(voucher_extraction 시드).

파일 경로(S3, 사전 업로드 가정):
  - PDF: voucher-documents/2026-local-service/2026-manual.pdf

사용법:
  cd apps/api && uv run python -m scripts.seed.common.document

멱등성:
  - global_documents: storage_path(unique) 로 중복 체크
"""
from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.infrastructure.persistence.database import AsyncSessionLocal
from app.modules.document.global_document.models import GlobalDocument

PDF_PATH = "voucher-documents/2026-local-service/2026-manual.pdf"
DOC_NAME = "2026년 경기도 지역사회서비스투자사업 표준매뉴얼"


async def main() -> None:
    print("=" * 80)
    print("2026 경기도 표준매뉴얼 — 카탈로그 연결용 원본 문서 시드")
    print("=" * 80)

    async with AsyncSessionLocal() as session:
        # 멱등 — pdf storage_path 로 중복 체크
        existing = (
            await session.execute(
                select(GlobalDocument).where(
                    GlobalDocument.storage_path == PDF_PATH
                )
            )
        ).scalar_one_or_none()
        if existing:
            print(f"\n✅ 이미 존재 (pdf global_document id={existing.id})")
            return

        pdf = GlobalDocument(
            name=DOC_NAME,
            file_type="pdf",
            storage_path=PDF_PATH,
            file_size=0,  # 메타 시드 — 실제 크기 미상
        )
        session.add(pdf)
        await session.flush()
        await session.refresh(pdf)
        await session.commit()

        print(f"\n✅ 생성 — pdf id={pdf.id} path={PDF_PATH}")

    print("\n" + "=" * 80)
    print("✅ 완료")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
