# PHQ-9 / GAD-7 검사 추가 플랜

---

## 1. PHQ-9 — 우울증 선별검사

### 검사 개요

- **코드**: PHQ-9
- **이름**: 우울증 선별검사 (Patient Health Questionnaire-9)
- **유형**: 객관 검사 (objective)
- **워크플로우**: 자가응답 + 자동채점 (self_report)
- **문항 유형**: 선택지형 (choice)
- **문항 수**: 9문항
- **척도**: 4점 리커트 (0~3)
- **총점 범위**: 0~27

### 공통 선택지

| value | label |
|-------|-------|
| 0 | 전혀 아님 |
| 1 | 며칠 동안 |
| 2 | 일주일 이상 |
| 3 | 거의 매일 |

### 문항

지난 2주 동안 다음의 문제로 얼마나 자주 방해를 받았습니까?

| # | 문항 |
|---|------|
| 1 | 일을 하는 것에 대한 흥미나 즐거움이 거의 없음 |
| 2 | 기분이 가라앉거나, 우울하거나, 희망이 없음 |
| 3 | 잠들기 어렵거나, 자꾸 깨거나, 너무 많이 잠 |
| 4 | 피곤하거나 기운이 거의 없음 |
| 5 | 식욕이 줄었거나 과식을 함 |
| 6 | 내 자신이 나쁜 사람이라는 느낌, 또는 자신을 실패자로 느끼거나 자신이나 가족을 실망시킴 |
| 7 | 신문을 읽거나 TV를 보는 것과 같은 일에 집중하기 어려움 |
| 8 | 남들이 알아챌 정도로 거동이나 말이 느림, 또는 반대로 안절부절 못하거나 평소보다 많이 돌아다님 |
| 9 | 자신이 죽는 것이 낫겠다는 생각, 또는 어떤 식으로든 자해하려는 생각 |

### 엔진 (PHQ9Engine)

**파일**: `apps/api/app/modules/assessment/engine/plugins/phq9.py`

- 역채점 없음
- 총점 = 9문항 합산 (0~27)
- 하위척도 없음 (단일 총점)

**심각도 기준:**

| 총점 | 심각도 | risk_level |
|------|--------|------------|
| 0~4 | 정상 | low |
| 5~9 | 경미한 우울 | low |
| 10~14 | 중등도 우울 | moderate |
| 15~19 | 중등도~중증 우울 | high |
| 20~27 | 중증 우울 | high |

**해석:**

| 심각도 | risk_label | summary | 권고사항 |
|--------|-----------|---------|----------|
| 정상 | 정상 | 우울 증상 없음 | 현재 상태 유지, 주기적 자가 점검 |
| 경미 | 경미한 우울 | 경미한 수준의 우울 증상 | 자기 관리, 증상 지속 시 상담 고려, 규칙적 운동/수면 |
| 중등도 | 중등도 우울 | 중등도 수준의 우울 증상 | 심리상담 권장, 주기적 모니터링, 사회적 활동 유지 |
| 중등도~중증 | 중등도~중증 우울 | 중등도에서 중증 수준의 우울 증상 | 전문 상담/치료 권장, 약물치료 상의, 규칙적 생활 유지 |
| 중증 | 중증 우울 | 중증 수준의 우울 증상 | 즉각적 전문 평가/치료 필요, 약물+심리치료 병행, 자해/자살 사고 확인 필수 |

---

## 2. GAD-7 — 범불안장애 선별검사

### 검사 개요

- **코드**: GAD-7
- **이름**: 범불안장애 선별검사 (Generalized Anxiety Disorder-7)
- **유형**: 객관 검사 (objective)
- **워크플로우**: 자가응답 + 자동채점 (self_report)
- **문항 유형**: 선택지형 (choice)
- **문항 수**: 7문항
- **척도**: 4점 리커트 (0~3), PHQ-9과 동일
- **총점 범위**: 0~21

### 공통 선택지

PHQ-9과 동일 (전혀 아님 / 며칠 동안 / 일주일 이상 / 거의 매일)

### 문항

지난 2주 동안 다음의 문제로 얼마나 자주 방해를 받았습니까?

| # | 문항 |
|---|------|
| 1 | 초조하거나 불안하거나 조마조마하게 느낌 |
| 2 | 걱정하는 것을 멈추거나 조절할 수가 없음 |
| 3 | 여러 가지 것들에 대해 걱정을 너무 많이 함 |
| 4 | 편하게 있기가 어려움 |
| 5 | 너무 안절부절 못해서 가만히 있기가 힘듦 |
| 6 | 쉽게 짜증이 나거나 쉽게 성을 냄 |
| 7 | 마치 끔찍한 일이 일어날 것처럼 두려움을 느낌 |

### 엔진 (GAD7Engine)

**파일**: `apps/api/app/modules/assessment/engine/plugins/gad7.py`

- 역채점 없음
- 총점 = 7문항 합산 (0~21)
- 하위척도 없음 (단일 총점)

**심각도 기준:**

| 총점 | 심각도 | risk_level |
|------|--------|------------|
| 0~4 | 정상 | low |
| 5~9 | 경미한 불안 | low |
| 10~14 | 중등도 불안 | moderate |
| 15~21 | 중증 불안 | high |

**해석:**

| 심각도 | risk_label | summary | 권고사항 |
|--------|-----------|---------|----------|
| 정상 | 정상 | 불안 증상 없음 | 현재 상태 유지, 주기적 자가 점검 |
| 경미 | 경미한 불안 | 경미한 수준의 불안 증상 | 자기 관리, 이완 훈련, 증상 지속 시 상담 고려 |
| 중등도 | 중등도 불안 | 중등도 수준의 불안 증상 | 심리상담 권장, 인지행동치료 고려, 주기적 모니터링 |
| 중증 | 중증 불안 | 중증 수준의 불안 증상 | 즉각적 전문 평가/치료 필요, 약물치료 병행 고려 |

---

## 3. 엔진 등록 방법

```python
# plugins/__init__.py
from .smartphone_addiction import SmartphoneAddictionEngine
from .phq9 import PHQ9Engine
from .gad7 import GAD7Engine

__all__ = ["SmartphoneAddictionEngine", "PHQ9Engine", "GAD7Engine"]
```

---

## 4. Seed 스크립트

> 개발 환경 전용. 프로덕션에서는 admin UI를 통해 등록.

`apps/api/scripts/seed_phq9.py` (파일명은 레거시, PHQ-9 + GAD-7 둘 다 포함)

```python
"""PHQ-9 / GAD-7 검사 시드 데이터 생성 스크립트"""
import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.modules.assessment.assessment.models import Assessment


ASSESSMENTS = [
    {
        "code": "PHQ-9",
        "version": "1.0",
        "kor_name": "우울증 선별검사 (PHQ-9)",
        "eng_name": "Patient Health Questionnaire-9",
        "type": "objective",
        "description": "지난 2주간 우울 증상의 빈도를 평가하는 9문항 자기보고식 검사입니다. 우울증 선별 및 심각도 평가에 널리 사용됩니다.",
        "duration": 5,
        "age": "만 13세 이상",
        "status": "private",
        "workflow_type": "self_report",
        "external_url": None,
        "supports_online": True,
        "definition": {
            "type": "choice",
            "common_options": [
                {"value": 0, "label": "전혀 아님"},
                {"value": 1, "label": "며칠 동안"},
                {"value": 2, "label": "일주일 이상"},
                {"value": 3, "label": "거의 매일"},
            ],
            "questions": [
                {"number": 1, "text": "일을 하는 것에 대한 흥미나 즐거움이 거의 없음"},
                {"number": 2, "text": "기분이 가라앉거나, 우울하거나, 희망이 없음"},
                {"number": 3, "text": "잠들기 어렵거나, 자꾸 깨거나, 너무 많이 잠"},
                {"number": 4, "text": "피곤하거나 기운이 거의 없음"},
                {"number": 5, "text": "식욕이 줄었거나 과식을 함"},
                {"number": 6, "text": "내 자신이 나쁜 사람이라는 느낌, 또는 자신을 실패자로 느끼거나 자신이나 가족을 실망시킴"},
                {"number": 7, "text": "신문을 읽거나 TV를 보는 것과 같은 일에 집중하기 어려움"},
                {"number": 8, "text": "남들이 알아챌 정도로 거동이나 말이 느림, 또는 반대로 안절부절 못하거나 평소보다 많이 돌아다님"},
                {"number": 9, "text": "자신이 죽는 것이 낫겠다는 생각, 또는 어떤 식으로든 자해하려는 생각"},
            ],
        },
    },
    {
        "code": "GAD-7",
        "version": "1.0",
        "kor_name": "범불안장애 선별검사 (GAD-7)",
        "eng_name": "Generalized Anxiety Disorder-7",
        "type": "objective",
        "description": "지난 2주간 불안 증상의 빈도를 평가하는 7문항 자기보고식 검사입니다. 범불안장애 선별 및 불안 심각도 평가에 널리 사용됩니다.",
        "duration": 5,
        "age": "만 13세 이상",
        "status": "private",
        "workflow_type": "self_report",
        "external_url": None,
        "supports_online": True,
        "definition": {
            "type": "choice",
            "common_options": [
                {"value": 0, "label": "전혀 아님"},
                {"value": 1, "label": "며칠 동안"},
                {"value": 2, "label": "일주일 이상"},
                {"value": 3, "label": "거의 매일"},
            ],
            "questions": [
                {"number": 1, "text": "초조하거나 불안하거나 조마조마하게 느낌"},
                {"number": 2, "text": "걱정하는 것을 멈추거나 조절할 수가 없음"},
                {"number": 3, "text": "여러 가지 것들에 대해 걱정을 너무 많이 함"},
                {"number": 4, "text": "편하게 있기가 어려움"},
                {"number": 5, "text": "너무 안절부절 못해서 가만히 있기가 힘듦"},
                {"number": 6, "text": "쉽게 짜증이 나거나 쉽게 성을 냄"},
                {"number": 7, "text": "마치 끔찍한 일이 일어날 것처럼 두려움을 느낌"},
            ],
        },
    },
]


async def main():
    print("=" * 50)
    print("PHQ-9 / GAD-7 검사 시드 데이터 생성")
    print("=" * 50)

    async with AsyncSessionLocal() as session:
        try:
            for data in ASSESSMENTS:
                result = await session.execute(
                    select(Assessment).where(Assessment.code == data["code"])
                )
                existing = result.scalar_one_or_none()

                if existing:
                    print(f"⏭️  {data['code']} 이미 존재 (id: {existing.id})")
                    continue

                assessment = Assessment(**data)
                session.add(assessment)
                await session.flush()

                q_count = len(data["definition"]["questions"])
                o_count = len(data["definition"]["common_options"])
                print(f"✅ {data['code']} 등록 완료 (id: {assessment.id})")
                print(f"   이름: {data['kor_name']}")
                print(f"   문항수: {q_count}문항, 선택지: {o_count}개 (0~3점)")

            await session.commit()
            print("\n✅ 완료!")

        except Exception as e:
            print(f"❌ 오류: {e}")
            await session.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())
```
