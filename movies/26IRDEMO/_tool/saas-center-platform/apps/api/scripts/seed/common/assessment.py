"""심리 검사 시드 데이터 생성 스크립트"""
import asyncio
from sqlalchemy import select
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.modules.assessment.assessment.models import Assessment


# ==================== 심리 검사 정의 ====================
ASSESSMENTS = [
    {
        "code": "SMARTPHONE_ADDICTION",
        "version": "S-척도",
        "kor_name": "스마트폰중독검사",
        "eng_name": "Smartphone Addiction Scale",
        "assessment_type": "objective",
        "description": """
청소년의 스마트폰 중독 위험 수준을 평가하는 자가진단 검사입니다.
일상생활장애, 가상세계지향성, 금단, 내성 등 4개 하위요인(15문항)으로 구성되어 있으며,
고위험사용자군, 잠재적위험사용자군, 일반사용자군으로 분류합니다.
        """.strip(),
        "duration": 10,
        "age": "만 10-19세",
        "status": "public",
        "workflow_type": "self_report",
        "external_url": None,
        "supports_online": True,  # 자가보고식 검사 - 센터 방문 + 태블릿 가능
        "definition": {
            "questions": [
                {"number": 1, "text": "스마트폰의 지나친 사용으로 학교성적이 떨어졌다"},
                {"number": 2, "text": "가족이나 친구들과 함께 있는 것보다 스마트폰을 사용하고 있는 것이 즐겁다"},
                {"number": 3, "text": "스마트폰을 사용할 수 없게 된다면 견디기 힘들 것이다"},
                {"number": 4, "text": "스마트폰 사용시간을 줄이려고 해보았지만 실패한다"},
                {"number": 5, "text": "스마트폰 사용으로 계획한 일(공부, 숙제 또는 학원수강 등)을 하기 어렵다"},
                {"number": 6, "text": "스마트폰을 사용하지 못하면 온 세상을 잃을 것 같은 생각이 든다"},
                {"number": 7, "text": "스마트폰이 없으면 안절부절 못하고 초조해진다"},
                {"number": 8, "text": "스마트폰 사용시간을 스스로 조절할 수 있다"},
                {"number": 9, "text": "수시로 스마트폰을 사용하다가 지적을 받은 적이 있다"},
                {"number": 10, "text": "스마트폰이 없어도 불안하지 않다"},
                {"number": 11, "text": "스마트폰을 사용할 때 그만해야지 라고 생각은 하면서도 계속한다"},
                {"number": 12, "text": "스마트폰을 너무 자주 또는 오래한다고 가족이나 친구들로부터 불평을 들은 적이 있다"},
                {"number": 13, "text": "스마트폰 사용이 지금 하고 있는 공부에 방해가 되지 않는다"},
                {"number": 14, "text": "스마트폰을 사용할 수 없을 때 패닉상태에 빠진다"},
                {"number": 15, "text": "스마트폰 사용에 많은 시간을 보내는 것이 습관이 되었다"},
            ]
        },
    },
    {
        "code": "SMARTPHONE_OVERDEPENDENCE_ADULT",
        "version": "1.0",
        "kor_name": "스마트폰 과의존 성인·고령층 척도",
        "eng_name": "Smartphone Overdependence Scale for Adults and Elderly",
        "assessment_type": "objective",
        "description": """
성인 및 고령층의 스마트폰 과의존 위험 수준을 평가하는 자가진단 검사입니다.
조절실패, 현저성, 문제적 결과 등 3개 하위요인(10문항)으로 구성되어 있으며,
연령대(성인 만20~59세 / 고령층 만60세 이상)에 따라 다른 기준점을 적용하여
고위험사용자군, 잠재적위험사용자군, 일반사용자군으로 분류합니다.
        """.strip(),
        "duration": 10,
        "age": "만 20세 이상",
        "status": "public",
        "workflow_type": "self_report",
        "external_url": None,
        "supports_online": True,
        "definition": {
            "scale": {
                "min": 1,
                "max": 4,
                "labels": ["전혀 그렇지 않다", "그렇지 않다", "그렇다", "매우 그렇다"],
            },
            "options": [
                {"value": 1, "label": "전혀 그렇지 않다"},
                {"value": 2, "label": "그렇지 않다"},
                {"value": 3, "label": "그렇다"},
                {"value": 4, "label": "매우 그렇다"},
            ],
            "questions": [
                {"number": 1, "text": "스마트폰 이용시간을 줄이려 할 때마다 실패한다", "factor": "조절실패", "options": [{"value": 1, "label": "전혀 그렇지 않다"}, {"value": 2, "label": "그렇지 않다"}, {"value": 3, "label": "그렇다"}, {"value": 4, "label": "매우 그렇다"}]},
                {"number": 2, "text": "스마트폰 이용시간을 조절하는 것이 어렵다", "factor": "조절실패", "options": [{"value": 1, "label": "전혀 그렇지 않다"}, {"value": 2, "label": "그렇지 않다"}, {"value": 3, "label": "그렇다"}, {"value": 4, "label": "매우 그렇다"}]},
                {"number": 3, "text": "적절한 스마트폰 이용시간을 지키는 것이 어렵다", "factor": "조절실패", "options": [{"value": 1, "label": "전혀 그렇지 않다"}, {"value": 2, "label": "그렇지 않다"}, {"value": 3, "label": "그렇다"}, {"value": 4, "label": "매우 그렇다"}]},
                {"number": 4, "text": "스마트폰이 옆에 없으면 하루종일 불안하다", "factor": "현저성", "options": [{"value": 1, "label": "전혀 그렇지 않다"}, {"value": 2, "label": "그렇지 않다"}, {"value": 3, "label": "그렇다"}, {"value": 4, "label": "매우 그렇다"}]},
                {"number": 5, "text": "스마트폰 생각이 머리에서 떠나지 않는다", "factor": "현저성", "options": [{"value": 1, "label": "전혀 그렇지 않다"}, {"value": 2, "label": "그렇지 않다"}, {"value": 3, "label": "그렇다"}, {"value": 4, "label": "매우 그렇다"}]},
                {"number": 6, "text": "스마트폰을 이용하고 싶은 충동을 강하게 느낀다", "factor": "현저성", "options": [{"value": 1, "label": "전혀 그렇지 않다"}, {"value": 2, "label": "그렇지 않다"}, {"value": 3, "label": "그렇다"}, {"value": 4, "label": "매우 그렇다"}]},
                {"number": 7, "text": "스마트폰 이용 때문에 건강에 문제가 생긴 적이 있다", "factor": "문제적 결과", "options": [{"value": 1, "label": "전혀 그렇지 않다"}, {"value": 2, "label": "그렇지 않다"}, {"value": 3, "label": "그렇다"}, {"value": 4, "label": "매우 그렇다"}]},
                {"number": 8, "text": "스마트폰 이용 때문에 가족과 심하게 다툰 적이 있다", "factor": "문제적 결과", "options": [{"value": 1, "label": "전혀 그렇지 않다"}, {"value": 2, "label": "그렇지 않다"}, {"value": 3, "label": "그렇다"}, {"value": 4, "label": "매우 그렇다"}]},
                {"number": 9, "text": "스마트폰 이용 때문에 친구 혹은 동료, 사회적 관계에서 심한 갈등을 경험한 적이 있다", "factor": "문제적 결과", "options": [{"value": 1, "label": "전혀 그렇지 않다"}, {"value": 2, "label": "그렇지 않다"}, {"value": 3, "label": "그렇다"}, {"value": 4, "label": "매우 그렇다"}]},
                {"number": 10, "text": "스마트폰 때문에 업무(학업 혹은 직업 등) 수행에 어려움이 있다", "factor": "문제적 결과", "options": [{"value": 1, "label": "전혀 그렇지 않다"}, {"value": 2, "label": "그렇지 않다"}, {"value": 3, "label": "그렇다"}, {"value": 4, "label": "매우 그렇다"}]},
            ],
        },
    },
    {
        "code": "SMART_BODY_CHECKER",
        "version": "1.0",
        "kor_name": "스마트 바디체커",
        "eng_name": "Smart Body Checker",
        "assessment_type": "objective",
        "description": """
외부 서비스를 통해 신체 계측 및 분석을 수행하는 검사입니다.
외부 플랫폼에서 측정 후 결과 보고서를 업로드하는 방식으로 진행됩니다.
        """.strip(),
        "duration": 15,
        "age": "만 6세 이상",
        "status": "public",
        "workflow_type": "external_service",
        "external_url": "https://smartbodychecker.example.com",
        "supports_online": False,  # 외부 서비스 - 오프라인만 가능
        "definition": {},
    },
    # ==================== 외부 보고서(PDF) 업로드형 ====================
    {
        "code": "J_TCI",
        "version": "1.0",
        "kor_name": "기질 및 성격 검사 - 청소년용",
        "eng_name": "Junior Temperament and Character Inventory",
        "assessment_type": "objective",
        "description": (
            "자기보고식 문항을 통해 청소년의 기질(자극추구·위험회피·사회적민감성·인내력)과 "
            "성격(자율성·연대감·자기초월)을 평가하는 검사입니다. 외부에서 검사한 결과 보고서를 "
            "업로드하면 AI가 자동 분석하고 종합 해석을 생성합니다."
        ),
        "duration": 30,
        "age": "만 12-18세",
        "status": "public",
        "workflow_type": "external_service",
        "external_url": None,
        "supports_online": False,
        "definition": {},
    },
    {
        "code": "K_BAYLEY_3",
        "version": "3판",
        "kor_name": "한국형 베일리 영유아 발달검사 3판",
        "eng_name": "Korean Bayley Scales of Infant and Toddler Development - 3rd Edition",
        "assessment_type": "objective",
        "description": (
            "놀이 상황과 관찰 과제를 통해 영유아의 인지·언어·운동·사회정서·적응행동 발달 수준을 "
            "평가하는 검사입니다. 외부에서 검사한 결과 보고서를 업로드하면 AI가 자동 분석하고 "
            "종합 해석을 생성합니다."
        ),
        "duration": 60,
        "age": "생후 16일-42개월",
        "status": "public",
        "workflow_type": "external_service",
        "external_url": None,
        "supports_online": False,
        "definition": {},
    },
    {
        "code": "K_CBCL",
        "version": "1.0",
        "kor_name": "아동·청소년 행동평가척도",
        "eng_name": "Korean Child Behavior Checklist",
        "assessment_type": "objective",
        "description": (
            "부모 보고를 통해 아동·청소년의 정서·행동 문제와 사회적 적응 능력을 평가하는 "
            "검사입니다. 외부에서 검사한 결과 보고서를 업로드하면 AI가 자동 분석하고 "
            "종합 해석을 생성합니다."
        ),
        "duration": 30,
        "age": "만 6-18세",
        "status": "public",
        "workflow_type": "external_service",
        "external_url": None,
        "supports_online": False,
        "definition": {},
    },
    {
        "code": "K_WISC_IV",
        "version": "4판",
        "kor_name": "한국 웩슬러 아동지능검사 4판",
        "eng_name": "Korean Wechsler Intelligence Scale for Children - 4th Edition",
        "assessment_type": "objective",
        "description": (
            "다양한 인지 과제 수행을 통해 6~16세 아동·청소년의 지능과 언어이해·지각추론·작업기억·"
            "처리속도를 평가하는 검사입니다. 외부에서 검사한 결과 보고서를 업로드하면 AI가 자동 "
            "분석하고 종합 해석을 생성합니다."
        ),
        "duration": 90,
        "age": "만 6-16세",
        "status": "public",
        "workflow_type": "external_service",
        "external_url": None,
        "supports_online": False,
        "definition": {},
    },
    {
        "code": "MMPI_2",
        "version": "2판",
        "kor_name": "다면적 인성검사 2판",
        "eng_name": "Minnesota Multiphasic Personality Inventory - 2",
        "assessment_type": "objective",
        "description": (
            "자기보고식 문항을 통해 성인의 성격 특성과 정신병리(우울·불안·편집·조현 등)를 다면적으로 "
            "평가하는 검사입니다. 외부에서 검사한 결과 보고서를 업로드하면 AI가 자동 분석하고 "
            "종합 해석을 생성합니다."
        ),
        "duration": 90,
        "age": "만 19세 이상",
        "status": "public",
        "workflow_type": "external_service",
        "external_url": None,
        "supports_online": False,
        "definition": {},
    },
    {
        "code": "MMPI_A",
        "version": "1.0",
        "kor_name": "청소년용 다면적 인성검사",
        "eng_name": "Minnesota Multiphasic Personality Inventory - Adolescent",
        "assessment_type": "objective",
        "description": (
            "자기보고식 문항을 통해 청소년의 성격 특성과 정신병리를 다면적으로 평가하는 "
            "검사입니다. 외부에서 검사한 결과 보고서를 업로드하면 AI가 자동 분석하고 "
            "종합 해석을 생성합니다."
        ),
        "duration": 60,
        "age": "만 13-18세",
        "status": "public",
        "workflow_type": "external_service",
        "external_url": None,
        "supports_online": False,
        "definition": {},
    },
    {
        "code": "PAT",
        "version": "1.0",
        "kor_name": "부모양육태도 검사",
        "eng_name": "Parenting Attitude Test",
        "assessment_type": "objective",
        "description": (
            "자기보고식 문항을 통해 부모의 양육 태도(애정·통제·자율성 등)를 평가하는 "
            "검사입니다. 외부에서 검사한 결과 보고서를 업로드하면 AI가 자동 분석하고 "
            "종합 해석을 생성합니다."
        ),
        "duration": 20,
        "age": "성인 부모",
        "status": "public",
        "workflow_type": "external_service",
        "external_url": None,
        "supports_online": False,
        "definition": {},
    },
    {
        "code": "RAVEN",
        "version": "1.0",
        "kor_name": "레이븐 누진행렬 지능검사",
        "eng_name": "Raven's Progressive Matrices",
        "assessment_type": "objective",
        "description": (
            "도형 패턴에서 빠진 부분을 추론하는 과제를 통해 언어에 의존하지 않는 일반 추론 능력을 "
            "평가하는 검사입니다. 외부에서 검사한 결과 보고서를 업로드하면 AI가 자동 분석하고 "
            "종합 해석을 생성합니다."
        ),
        "duration": 45,
        "age": "만 5세 이상",
        "status": "public",
        "workflow_type": "external_service",
        "external_url": None,
        "supports_online": False,
        "definition": {},
    },
    {
        "code": "TCI",
        "version": "1.0",
        "kor_name": "기질 및 성격 검사 - 성인용",
        "eng_name": "Temperament and Character Inventory",
        "assessment_type": "objective",
        "description": (
            "자기보고식 문항을 통해 성인의 기질과 성격을 평가하는 검사입니다. 외부에서 검사한 결과 "
            "보고서를 업로드하면 AI가 자동 분석하고 종합 해석을 생성합니다."
        ),
        "duration": 30,
        "age": "만 19세 이상",
        "status": "public",
        "workflow_type": "external_service",
        "external_url": None,
        "supports_online": False,
        "definition": {},
    },
    {
        "code": "WPPSI",
        "version": "1.0",
        "kor_name": "한국 웩슬러 유아지능검사",
        "eng_name": "Wechsler Preschool and Primary Scale of Intelligence",
        "assessment_type": "objective",
        "description": (
            "다양한 인지 과제 수행을 통해 만 2세 6개월~7세 7개월 유아의 지능과 인지 능력을 평가하는 "
            "검사입니다. 외부에서 검사한 결과 보고서를 업로드하면 AI가 자동 분석하고 종합 해석을 "
            "생성합니다."
        ),
        "duration": 60,
        "age": "만 2세 6개월-7세 7개월",
        "status": "public",
        "workflow_type": "external_service",
        "external_url": None,
        "supports_online": False,
        "definition": {},
    },
    {
        "code": "BGT",
        "version": "2판",
        "kor_name": "벤더 게슈탈트 검사",
        "eng_name": "Bender Visual-Motor Gestalt Test",
        "assessment_type": "projective",
        "description": (
            "도형을 따라 그리는 과정을 통해 아동의 시각·운동 협응력과 인지적 균형감을 평가하는 "
            "검사입니다. 외부에서 검사한 결과 보고서를 업로드하면 AI가 자동 분석하고 종합 해석을 "
            "생성합니다."
        ),
        "duration": 30,
        "age": "만 4세 이상",
        "status": "public",
        "workflow_type": "external_service",
        "external_url": None,
        "supports_online": False,
        "definition": {},
    },
    {
        "code": "HTP",
        "version": "1.0",
        "kor_name": "집-나무-사람 그림검사",
        "eng_name": "House-Tree-Person Test",
        "assessment_type": "projective",
        "description": (
            "집·나무·사람을 그리는 과정을 통해 개인의 자아상·가족관·대인관계와 내적 갈등을 평가하는 "
            "검사입니다. 외부에서 검사한 결과 보고서를 업로드하면 AI가 자동 분석하고 종합 해석을 "
            "생성합니다."
        ),
        "duration": 40,
        "age": "만 4세 이상",
        "status": "public",
        "workflow_type": "external_service",
        "external_url": None,
        "supports_online": False,
        "definition": {},
    },
    {
        "code": "KFD",
        "version": "1.0",
        "kor_name": "동적 가족화 검사",
        "eng_name": "Kinetic Family Drawing",
        "assessment_type": "projective",
        "description": (
            "가족이 무언가를 함께 하는 장면을 그리는 과정을 통해 가족 관계와 가족 내 역동을 "
            "평가하는 검사입니다. 외부에서 검사한 결과 보고서를 업로드하면 AI가 자동 분석하고 "
            "종합 해석을 생성합니다."
        ),
        "duration": 30,
        "age": "만 5세 이상",
        "status": "public",
        "workflow_type": "external_service",
        "external_url": None,
        "supports_online": False,
        "definition": {},
    },
    {
        "code": "RORSCHACH",
        "version": "1.0",
        "kor_name": "로르샤흐 검사",
        "eng_name": "Rorschach Inkblot Test",
        "assessment_type": "projective",
        "description": (
            "좌우대칭 잉크 반점 카드에 대한 반응을 통해 개인의 사고·정서·대인관계 등 성격 전반을 "
            "평가하는 검사입니다. 외부에서 검사한 결과 보고서를 업로드하면 AI가 자동 분석하고 "
            "종합 해석을 생성합니다."
        ),
        "duration": 90,
        "age": "만 5세 이상",
        "status": "public",
        "workflow_type": "external_service",
        "external_url": None,
        "supports_online": False,
        "definition": {},
    },
    {
        "code": "SCT",
        "version": "1.0",
        "kor_name": "문장완성검사",
        "eng_name": "Sentence Completion Test",
        "assessment_type": "projective",
        "description": (
            "미완성 문장을 완성하는 과정을 통해 자기·가족·대인·이성 영역에 대한 태도와 내적 갈등을 "
            "평가하는 검사입니다. 외부에서 검사한 결과 보고서를 업로드하면 AI가 자동 분석하고 "
            "종합 해석을 생성합니다."
        ),
        "duration": 30,
        "age": "만 10세 이상",
        "status": "public",
        "workflow_type": "external_service",
        "external_url": None,
        "supports_online": False,
        "definition": {},
    },
]


async def seed_assessments(session):
    """심리 검사 시드 데이터 생성"""
    print("\n📋 심리 검사 시드 데이터 생성 중...")

    for assessment_data in ASSESSMENTS:
        # 기존 데이터 확인
        result = await session.execute(
            select(Assessment).where(Assessment.code == assessment_data["code"])
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"  ⏭️  검사 '{assessment_data['kor_name']}' 이미 존재 (Code: {existing.code})")
            continue

        # 새 검사 생성
        assessment = Assessment(
            code=assessment_data["code"],
            version=assessment_data["version"],
            kor_name=assessment_data["kor_name"],
            eng_name=assessment_data["eng_name"],
            assessment_type=assessment_data["assessment_type"],
            description=assessment_data["description"],
            duration=assessment_data["duration"],
            age=assessment_data["age"],
            status=assessment_data["status"],
            workflow_type=assessment_data["workflow_type"],
            external_url=assessment_data["external_url"],
            supports_online=assessment_data.get("supports_online", False),
            definition=assessment_data["definition"],
        )
        session.add(assessment)
        print(f"  ✅ 검사 '{assessment_data['kor_name']}' 생성 완료 (Code: {assessment_data['code']})")

    await session.commit()
    print("✅ 심리 검사 시드 데이터 생성 완료\n")


async def main():
    """메인 실행 함수"""
    print("=" * 70)
    print("심리 검사 시드 데이터 생성 스크립트")
    print("=" * 70)

    async with AsyncSessionLocal() as session:
        try:
            await seed_assessments(session)

            print("=" * 70)
            print("✅ 시드 데이터 생성 완료!")
            print("=" * 70)
            print("\n생성된 검사:")
            print("  1. SMARTPHONE_ADDICTION (스마트폰중독검사 - 청소년)")
            print("     - workflow: self_report, 자동채점")
            print("     - supports_online: True (센터 방문 + 태블릿 가능)")
            print("  2. SMARTPHONE_OVERDEPENDENCE_ADULT (스마트폰 과의존 - 성인·고령층)")
            print("     - workflow: self_report, 자동채점 (연령대별 기준)")
            print("     - supports_online: True (센터 방문 + 태블릿 가능)")
            print("  3. SMART_BODY_CHECKER (스마트 바디체커)")
            print("     - workflow: external_service, 보고서 업로드")
            print("     - supports_online: False (오프라인만)")
            print("  4. J_TCI (기질 및 성격 검사 - 청소년용)")
            print("     - workflow: external_service, PDF 보고서 업로드 분석")
            print("     - supports_online: False (오프라인만)")
            print("  5. K_BAYLEY_3 (한국형 베일리 영유아 발달검사 3판)")
            print("     - workflow: external_service, PDF 보고서 업로드 분석")
            print("     - supports_online: False (오프라인만)")
            print("  6. K_CBCL (아동·청소년 행동평가척도)")
            print("     - workflow: external_service, PDF 보고서 업로드 분석")
            print("     - supports_online: False (오프라인만)")
            print("  7. K_WISC_IV (한국 웩슬러 아동지능검사 4판)")
            print("     - workflow: external_service, PDF 보고서 업로드 분석")
            print("     - supports_online: False (오프라인만)")
            print("  8. MMPI_2 (다면적 인성검사 2판)")
            print("     - workflow: external_service, PDF 보고서 업로드 분석")
            print("     - supports_online: False (오프라인만)")
            print("  9. MMPI_A (청소년용 다면적 인성검사)")
            print("     - workflow: external_service, PDF 보고서 업로드 분석")
            print("     - supports_online: False (오프라인만)")
            print("  10. PAT (부모양육태도 검사)")
            print("     - workflow: external_service, PDF 보고서 업로드 분석")
            print("     - supports_online: False (오프라인만)")
            print("  11. RAVEN (레이븐 누진행렬 지능검사)")
            print("     - workflow: external_service, PDF 보고서 업로드 분석")
            print("     - supports_online: False (오프라인만)")
            print("  12. TCI (기질 및 성격 검사 - 성인용)")
            print("     - workflow: external_service, PDF 보고서 업로드 분석")
            print("     - supports_online: False (오프라인만)")
            print("  13. WPPSI (한국 웩슬러 유아지능검사)")
            print("     - workflow: external_service, PDF 보고서 업로드 분석")
            print("     - supports_online: False (오프라인만)")
            print("  14. BGT (벤더 게슈탈트 검사)")
            print("     - workflow: external_service, PDF 보고서 업로드 분석")
            print("     - supports_online: False (오프라인만)")
            print("  15. HTP (집-나무-사람 그림검사)")
            print("     - workflow: external_service, PDF 보고서 업로드 분석")
            print("     - supports_online: False (오프라인만)")
            print("  16. KFD (동적 가족화 검사)")
            print("     - workflow: external_service, PDF 보고서 업로드 분석")
            print("     - supports_online: False (오프라인만)")
            print("  17. RORSCHACH (로르샤흐 검사)")
            print("     - workflow: external_service, PDF 보고서 업로드 분석")
            print("     - supports_online: False (오프라인만)")
            print("  18. SCT (문장완성검사)")
            print("     - workflow: external_service, PDF 보고서 업로드 분석")
            print("     - supports_online: False (오프라인만)")
            print(f"\n총 검사 수: {len(ASSESSMENTS)}개")
            print("=" * 70)

        except Exception as e:
            print(f"\n❌ 오류 발생: {e}")
            import traceback

            traceback.print_exc()
            await session.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())
