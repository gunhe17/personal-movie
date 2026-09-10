import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings
from app.models.global_.assessment import Assessment, AssessmentType, AssessmentStatus


async def seed_initial_assessments():
    """초기 검사 데이터 생성"""
    
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    assessments_data = [
        {
            "code": "SMARTPHONE_ADDICTION",
            "eng_name": "Smartphone Addiction Scale",
            "kor_name": "스마트폰중독척도",
            "description": "스마트폰 과의존 및 중독 위험도를 평가하는 자기보고식 검사",
            "is_online_available": True,
            "is_ai_supported": True,
            "assessment_type": AssessmentType.OBJECTIVE,
            "target_age_group": "청소년 및 성인",
            "estimated_duration_minutes": 10,
            "has_standard_report": True,
            "supports_self_scoring": True,
            "supports_report_upload": False,
            "external_assessment_url": None,
            "status": AssessmentStatus.PUBLIC,
            "modified_by_account": "system",
        },
        {
            "code": "NEOFECT_SMART_BALANCE",
            "eng_name": "NEOFECT Smart Balance",
            "kor_name": "네오팩트-스마트 밸런스",
            "description": "타업체 오프라인 균형 능력 평가 검사 (결과 보고서 업로드 전용)",
            "is_online_available": False,
            "is_ai_supported": False,
            "assessment_type": AssessmentType.OBJECTIVE,
            "target_age_group": "전 연령",
            "estimated_duration_minutes": 15,
            "has_standard_report": False,
            "supports_self_scoring": False,
            "supports_report_upload": True,
            "external_assessment_url": "https://www.neofect.com",
            "status": AssessmentStatus.PUBLIC,
            "modified_by_account": "system",
        },
    ]
    
    async with AsyncSessionLocal() as session:
        print("=== 초기 검사 데이터 생성 시작 ===\n")
        
        for data in assessments_data:
            existing = await session.execute(
                f"SELECT * FROM public.assessments WHERE code = '{data['code']}'"
            )
            if existing.fetchone():
                print(f"⚠️  {data['code']} - 이미 존재합니다. 건너뜁니다.")
                continue
            
            assessment = Assessment(**data)
            session.add(assessment)
            print(f"✓ {data['code']} ({data['kor_name']}) - 생성됨")
            print(f"  - 유형: {data['assessment_type'].value}")
            print(f"  - 온라인: {data['is_online_available']}")
            print(f"  - AI 지원: {data['is_ai_supported']}")
            print(f"  - 보고서 업로드: {data['supports_report_upload']}")
            print()
        
        await session.commit()
        print("\n=== 초기 검사 데이터 생성 완료 ===")
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_initial_assessments())
