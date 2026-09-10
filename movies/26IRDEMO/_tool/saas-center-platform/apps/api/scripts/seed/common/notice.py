"""플랫폼 공지(Notice) 시드 — 웹 공지 화면용 기본 3건."""
import asyncio
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import select

from app.infrastructure.persistence.database import AsyncSessionLocal
from app.modules.notice.notice.models import Notice
from app.modules.platform_admin.admin_account.models import AdminAccount

# (category, title, days_ago, is_pinned, content)
NOTICES = [
    (
        "announcement",
        "상담센터 SaaS 정식 오픈 안내",
        30,
        True,
        "안녕하세요. 상담센터 운영을 위한 통합 플랫폼이 정식 오픈했습니다.\n\n"
        "상담·검사 관리, 일정, 결제/청구를 한 곳에서 처리하실 수 있습니다.\n"
        "이용 중 문의사항은 고객센터로 연락 주세요.",
    ),
    (
        "update",
        "AI 상담일지 생성 기능 업데이트",
        14,
        False,
        "필드노트 녹음에서 상담일지 초안을 자동 생성하는 기능이 개선되었습니다.\n\n"
        "- 화자분리 정확도 향상\n"
        "- 요약 길이 조정 옵션 추가\n"
        "- 생성된 초안의 항목별 재생성 지원",
    ),
    (
        "maintenance",
        "정기 서버 점검 안내 (매월 첫째 주 일요일)",
        7,
        False,
        "안정적인 서비스 제공을 위해 매월 첫째 주 일요일 02:00~04:00 정기 점검을 실시합니다.\n\n"
        "점검 시간 동안 서비스 이용이 일시 중단될 수 있습니다.",
    ),
]


async def main() -> None:
    print("📢 플랫폼 공지 시드")
    async with AsyncSessionLocal() as session:
        admin = (await session.execute(
            select(AdminAccount)
            .where(AdminAccount.email == "imomtae@insighter.co.kr")
            .order_by(AdminAccount.created_at)
        )).scalars().first()
        if not admin:
            print("  ⚠️  플랫폼 어드민 계정 없음 (admin_account 시드 선행 필요) - 스킵")
            return

        now = datetime.now()
        for category, title, days_ago, is_pinned, content in NOTICES:
            existing = (await session.execute(
                select(Notice).where(
                    Notice.title == title, Notice.deleted_at.is_(None)
                )
            )).scalar_one_or_none()
            if existing:
                print(f"  ⏭️  '{title}' 이미 존재")
                continue

            session.add(Notice(
                id=str(uuid4()),
                created_by=admin.id,
                category=category,
                title=title,
                published_at=now - timedelta(days=days_ago),
                is_published=True,
                is_pinned=is_pinned,
                content=content,
                attachments=[],
            ))
            print(f"  ✅ [{category}] {title}")

        await session.commit()


if __name__ == "__main__":
    asyncio.run(main())
