"""검사 유형 등록 지점의 정합성.

새 검사를 열려면 여러 곳을 함께 고쳐야 한다. 하나만 빠뜨리면 조용히
깨지는데(예: 모달에서는 고를 수 있는데 API가 422를 돌려준다), 타입
시스템이 프론트-백엔드 경계를 넘어서까지 잡아 주지는 못한다.

프론트와의 대조는 계약 파일이 한다
-----------------------------------
예전에는 프론트 소스를 정규식으로 읽어 비교했다. 그런데 모달 목록과
ExamType 유니온이 둘 다 registry.ts에서 파생되도록 리팩터링되면서
(`EXAM_TYPES.map(...)` · `keyof typeof MODULES`) 비교할 리터럴 자체가
사라졌고, 테스트는 **조용히 깨진 채** 남아 있었다.

소스 파싱은 리팩터링에 취약하다. 지금은 백엔드가 contracts/exam-state.json에
exam_types를 내보내고, 프론트가 레지스트리와 대조한다
(apps/web/.../core/state-contract.spec.ts). 계약은 데이터라 그 문제가 없다.

여기서는 백엔드 자체의 단일 출처만 본다.
"""
import pytest

from app.modules.examination.common.schemas import (
    SUPPORTED_EXAM_TYPES,
    ExaminationBatteryCreate,
    ExaminationCreate,
)


class TestSingleSourceOfTruth:
    def test_create_rejects_unknown_type(self):
        with pytest.raises(ValueError):
            ExaminationCreate(client_id="c", examiner_id="e", exam_type="mmpi2")

    def test_create_accepts_every_supported_type(self):
        for t in SUPPORTED_EXAM_TYPES:
            ExaminationCreate(client_id="c", examiner_id="e", exam_type=t)

    def test_battery_uses_same_list(self):
        """배터리 validator가 별도 목록을 들고 있으면 둘이 어긋난다."""
        ExaminationBatteryCreate(
            client_id="c", examiner_id="e", exam_types=list(SUPPORTED_EXAM_TYPES)
        )
        with pytest.raises(ValueError):
            ExaminationBatteryCreate(
                client_id="c", examiner_id="e", exam_types=["mmpi2"]
            )

    def test_battery_dedupes_preserving_order(self):
        b = ExaminationBatteryCreate(
            client_id="c", examiner_id="e", exam_types=["sct", "htp", "sct"]
        )
        assert b.exam_types == ["sct", "htp"]
