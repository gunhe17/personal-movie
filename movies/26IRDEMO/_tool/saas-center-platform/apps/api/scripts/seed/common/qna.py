"""FAQ 시드 데이터 생성 스크립트"""
import asyncio
from sqlalchemy import select
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.modules.platform_admin.faq.models import FAQ
from app.modules.platform_admin.admin_account.models import AdminAccount


FAQS = [
    {
        "category": "getting_started",
        "question": "일정은 어떻게 관리하나요?",
        "answer": "스케줄 메뉴에서 상담 및 검사 일정을 캘린더로 확인하고 관리할 수 있습니다. 새 일정을 추가하거나, 기존 일정의 상세 화면에서 시간 변경 및 상태를 수정할 수 있습니다.",
        "is_published": True,
        "sort_order": 0,
    },
    {
        "category": "getting_started",
        "question": "상담일지는 언제 작성할 수 있나요?",
        "answer": "상담 메뉴에서 세션 상세 화면에 진입하면 내담자별로 상담일지를 작성할 수 있습니다. 세션이 완료된 이후에도 언제든지 일지를 수정할 수 있으므로, 상담 후 여유 있게 정리하셔도 됩니다.",
        "is_published": True,
        "sort_order": 1,
    },
    {
        "category": "getting_started",
        "question": "심리검사는 어떻게 진행하나요?",
        "answer": "설정 > 검사 관리에서 센터에서 사용할 검사 항목을 등록한 후, 검사 메뉴에서 내담자에게 검사를 배정하고 결과를 관리할 수 있습니다.",
        "is_published": True,
        "sort_order": 2,
    },
    {
        "category": "general",
        "question": "여러 상담사가 함께 사용할 수 있나요?",
        "answer": "네, 구성원 메뉴에서 상담사를 등록하고 역할을 설정할 수 있습니다. 설정 > 권한 설정에서 관리자, 상담사 등 역할에 따라 접근 가능한 메뉴와 기능을 다르게 적용할 수 있습니다.",
        "is_published": True,
        "sort_order": 0,
    },
    {
        "category": "general",
        "question": "내담자 등록 시 보호자도 함께 등록할 수 있나요?",
        "answer": "네, 내담자 등록 화면에서 보호자 추가를 선택하면 보호자 정보를 함께 입력할 수 있습니다. 이미 등록된 내담자도 상세 화면에서 보호자를 추가할 수 있습니다.",
        "is_published": True,
        "sort_order": 1,
    },
    {
        "category": "general",
        "question": "센터 상담실은 어떻게 설정하나요?",
        "answer": "설정 > 상담실 관리에서 센터의 상담실을 등록하고 관리할 수 있습니다. 등록된 상담실은 일정을 생성할 때 선택할 수 있어 공간 배정이 편리해집니다.",
        "is_published": True,
        "sort_order": 2,
    },
]


async def seed_faqs(session):
    """FAQ 시드 데이터 생성"""
    print("\n📋 FAQ 시드 데이터 생성 중...")

    # super_admin 계정 조회 (created_by에 사용)
    result = await session.execute(
        select(AdminAccount).where(AdminAccount.role == "super_admin").limit(1)
    )
    admin = result.scalar_one_or_none()
    created_by = admin.id if admin else "system"

    created_count = 0
    for faq_data in FAQS:
        # 동일 질문 이미 존재하면 스킵
        result = await session.execute(
            select(FAQ).where(
                FAQ.question == faq_data["question"],
                FAQ.deleted_at.is_(None),
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"  ⏭️  FAQ '{faq_data['question'][:30]}...' 이미 존재")
            continue

        faq = FAQ(
            category=faq_data["category"],
            question=faq_data["question"],
            answer=faq_data["answer"],
            is_published=faq_data["is_published"],
            sort_order=faq_data["sort_order"],
            created_by=created_by,
        )
        session.add(faq)
        created_count += 1
        print(f"  ✅ FAQ '{faq_data['question'][:40]}' 생성")

    await session.commit()
    print(f"✅ FAQ 시드 데이터 생성 완료 (신규: {created_count}개)\n")


async def main():
    """메인 실행 함수"""
    print("=" * 70)
    print("FAQ 시드 데이터 생성 스크립트")
    print("=" * 70)

    async with AsyncSessionLocal() as session:
        try:
            await seed_faqs(session)

            print("=" * 70)
            print("✅ FAQ 시드 데이터 생성 완료!")
            print("=" * 70)
            print(f"\n총 FAQ 수: {len(FAQS)}개")
            print("=" * 70)

        except Exception as e:
            print(f"\n❌ 오류 발생: {e}")
            import traceback
            traceback.print_exc()
            await session.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())
