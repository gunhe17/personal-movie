"""requery 가드 판정 — 부재 단정은 잡고 능력·권한 부정 프로즈는 통과.
WUI 실측(2026-07-27): 무조회 "찾을 수 없습니다"가 "수 없" 능력-부정 예외에 오매칭돼 면제됐다."""

from app.runtime.assistant.loop import _claims_data


def test_absence_claims_are_caught():
    assert _claims_data("김민준 내담자님을 찾을 수 없습니다.")
    assert _claims_data("해당 이름의 내담자 정보가 확인되지 않습니다.")
    assert _claims_data("이번 주 일정은 3건입니다.")
    assert _claims_data("조회 결과 일치하는 내담자가 없습니다.")


def test_capability_denials_pass_through():
    assert not _claims_data("회기 취소는 할 수 없어요. 일정 화면에서 처리해 주세요.")
    assert not _claims_data("권한이 없어 실행할 수 없습니다. 관리자에게 요청해 주세요.")
    assert not _claims_data("이 기능은 지원되지 않습니다.")
