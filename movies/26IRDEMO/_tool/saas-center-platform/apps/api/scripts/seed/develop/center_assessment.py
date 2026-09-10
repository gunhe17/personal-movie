"""센터별 검사 운영 설정(CenterAssessment) 픽스처."""
from sqlalchemy import select

from app.modules.assessment.assessment.models import Assessment
from app.modules.assessment.center_assessment.models import CenterAssessment

from scripts.seed.develop import gen_id


async def seed_center_assessments(session, center_id: str):
    """센터별 검사 운영 설정 생성 (모든 Assessment를 활성화 상태로)"""
    print("\n🧪 센터별 검사 운영 설정 생성 중...")

    # 모든 Assessment 조회
    result = await session.execute(select(Assessment))
    assessments = result.scalars().all()

    if not assessments:
        print("  ⚠️  Assessment가 없습니다. seed_assessments를 먼저 실행하세요.")
        return

    for assessment in assessments:
        # 중복 확인
        existing = await session.execute(
            select(CenterAssessment).where(
                CenterAssessment.center_id == center_id,
                CenterAssessment.assessment_id == assessment.id,
            )
        )
        if existing.scalar_one_or_none():
            print(f"  ⏭️  {assessment.kor_name} 이미 존재")
            continue

        ca = CenterAssessment(
            id=gen_id(),
            center_id=center_id,
            assessment_id=assessment.id,
            is_active=True,  # 개발용: 모든 검사 활성화
        )
        session.add(ca)
        print(f"  ✅ {assessment.kor_name} (is_active=True)")

    await session.flush()
    print(f"  총 {len(assessments)}개 검사 매핑 완료")
