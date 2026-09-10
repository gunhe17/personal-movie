"""2026 경기도 지역사회서비스투자사업 표준매뉴얼 기반 시드 (완성 바우처 3개)

경기도 매뉴얼의 아동영역 서비스 3개를 카탈로그(vouchers)로 등록하고 출처 문서에 연결.
아동정서발달지원서비스는 카탈로그에 두지 않는다 — 그건 AI 추출(가공 완료) 데모용으로
voucher_extraction 시드가 voucher_extractions 로 따로 시드한다(추출→확정 흐름 구분).

사용법:
  cd apps/api && uv run python -m scripts.seed.common.voucher

멱등성:
  - vouchers: (name, program_year)로 중복 체크
  - voucher_documents: (voucher_id, global_document_id)로 중복 체크
"""
from __future__ import annotations

import asyncio
from datetime import date

from sqlalchemy import select

from app.infrastructure.persistence.database import AsyncSessionLocal
from app.modules.document.global_document.models import GlobalDocument
from app.modules.voucher.voucher.models import Voucher
from app.modules.voucher.voucher_document.models import VoucherDocument


# ════════════════════════════════════════════════════════════════════════════
# 2026 경기도 지역사회서비스투자사업 — 아동영역 4개 서비스
# ════════════════════════════════════════════════════════════════════════════

# eligibility: 내담자앱 자가진단 매칭 룰. 연령은 support_target에서 도출,
# 소득(기준중위소득 140%)·증빙은 데모 기준값 — 실기준은 지자체 공고가 정본.
SERVICES_2026 = [
    {
        "name": "우리아이심리지원서비스",
        "category": "아동영역",
        "program_year": 2026,
        "support_amount": {
            "통화": "KRW",
            "월총액": {"최소": 160000, "최대": 160000},
            "정부지원금": 144000,
            "본인부담금": 16000,
            "가격탄력제": False,
        },
        "support_target": "만 12세 이하 아동",
        "eligibility": {
            "min_age": None,
            "max_age": 12,
            "income_max_pct": 140,
            "need_evidence": False,
        },
    },
    {
        "name": "아동비전형성지원서비스",
        "category": "아동영역",
        "program_year": 2026,
        "support_amount": {
            "통화": "KRW",
            "월총액": {"최소": 200000, "최대": 200000},
            "정부지원금": 180000,
            "본인부담금": 20000,
            "가격탄력제": False,
        },
        "support_target": "만 9~18세 아동·청소년",
        "eligibility": {
            "min_age": 9,
            "max_age": 18,
            "income_max_pct": 140,
            "need_evidence": False,
        },
    },
    {
        "name": "아동주의집중력향상서비스",
        "category": "아동영역",
        "program_year": 2026,
        "support_amount": {
            "통화": "KRW",
            "월총액": {"최소": 200000, "최대": 200000},
            "정부지원금": None,
            "본인부담금": None,
            "가격탄력제": False,
        },
        "support_target": "주의력 결핍 아동",
        "eligibility": {
            "min_age": None,
            "max_age": None,
            "income_max_pct": 140,
            "need_evidence": True,
        },
    },
]


async def main() -> None:
    print("=" * 80)
    print("2026 경기도 지역사회서비스투자사업 표준매뉴얼 시드")
    print("=" * 80)

    async with AsyncSessionLocal() as session:
        # [1/3] global_document(pdf) 조회
        print(f"\n[1/3] global_document(pdf) 조회")
        doc_stmt = select(GlobalDocument).where(
            GlobalDocument.name == "2026년 경기도 지역사회서비스투자사업 표준매뉴얼",
            GlobalDocument.file_type == "pdf",
            GlobalDocument.deleted_at.is_(None),
        )
        document = (await session.execute(doc_stmt)).scalars().first()

        if not document:
            raise RuntimeError(
                "global_document '2026년 경기도 지역사회서비스투자사업 표준매뉴얼'(pdf)을(를) "
                "찾을 수 없습니다. 먼저 scripts.seed.common.document 를 실행하세요."
            )

        print(f"  ✅ 문서 사용 (id={document.id})")

        # [2/3] Voucher (카탈로그) 등록
        print(f"\n[2/3] Voucher 카탈로그 등록 (아동영역 {len(SERVICES_2026)}개)")
        vouchers_by_name: dict[str, Voucher] = {}
        created_count = 0

        for service in SERVICES_2026:
            stmt = select(Voucher).where(
                Voucher.name == service["name"],
                Voucher.program_year == service["program_year"],
            )
            voucher = (await session.execute(stmt)).scalar_one_or_none()

            if voucher:
                if voucher.eligibility is None and service.get("eligibility"):
                    voucher.eligibility = service["eligibility"]
                    print(f"  🔄 '{service['name']}' eligibility 백필")
                else:
                    print(f"  ⏭️  '{service['name']}' 이미 존재")
            else:
                voucher = Voucher(
                    name=service["name"],
                    program_name="지역사회서비스투자사업",
                    program_organization="경기도",
                    program_year=service["program_year"],
                    usage_start_date=date(2026, 1, 1),
                    usage_end_date=date(2026, 12, 31),
                    application_method="주소지 읍·면·동 행정복지센터 방문 또는 복지로(bokjiro.go.kr) 신청",
                    application_start_date=date(2026, 1, 1),
                    application_end_date=date(2026, 12, 31),
                    support_amount=service["support_amount"],
                    support_scope=f"[{service['category']}] {service['name']}",
                    support_target=service["support_target"],
                    contact="보건복지상담센터 ☎ 129",
                    eligibility=service.get("eligibility"),
                )
                session.add(voucher)
                await session.flush()
                await session.refresh(voucher)
                print(f"  ✅ '{service['name']}' 생성")
                created_count += 1

            vouchers_by_name[service["name"]] = voucher

        print(f"  📊 신규 생성: {created_count}건, 기존: {len(SERVICES_2026) - created_count}건")

        # [3/3] voucher_documents 연결
        print(f"\n[3/3] voucher_documents 연결 ({len(vouchers_by_name)}건)")
        linked_count = 0

        for name, voucher in vouchers_by_name.items():
            stmt = select(VoucherDocument).where(
                VoucherDocument.voucher_id == voucher.id,
                VoucherDocument.global_document_id == document.id,
            )
            existing = (await session.execute(stmt)).scalar_one_or_none()

            if existing:
                # 이미 연결됨 — 스킵
                continue
            else:
                link = VoucherDocument(
                    voucher_id=voucher.id,
                    global_document_id=document.id,
                    page_range=None,
                )
                session.add(link)
                linked_count += 1

        if linked_count > 0:
            print(f"  ✅ {linked_count}건 새로 연결")
        else:
            print(f"  ⏭️  모두 이미 연결됨")

        await session.commit()

    print("\n" + "=" * 80)
    print("✅ 시드 완료")
    print(f"   - Document: {document.id}")
    print(f"   - Vouchers: {len(SERVICES_2026)}개 (아동영역)")
    for s in SERVICES_2026:
        print(f"     • {s['name']}")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
