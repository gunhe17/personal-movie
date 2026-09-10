"""sanitize_reply — 실사용 누출 문장(2026-07-27) 기반 회귀. UUID=문장 제거, 경로=토큰 제거, 코드=WUI 어휘."""

from app.runtime.assistant.sanitize import sanitize_reply


def test_uuid_sentence_dropped():
    text = (
        "상담실 관리 화면을 열었습니다. "
        "확인하신 **상담실 1**의 ID는 `ca2c59e1-28b9-4a98-8123-456789abcdef`입니다. "
        "화면에서 수정하시면 됩니다."
    )
    out = sanitize_reply(text)
    assert "ca2c59e1" not in out and "ID는" not in out
    assert "상담실 관리 화면을 열었습니다." in out
    assert "화면에서 수정하시면 됩니다." in out


def test_path_tokens_stripped():
    assert sanitize_reply("수정 화면이 열렸습니다. (`/center/info`)") == "수정 화면이 열렸습니다."
    assert (
        sanitize_reply("제출하시면 됩니다. (화면 경로: `/assessment/receive`)")
        == "제출하시면 됩니다."
    )
    assert sanitize_reply("회의 등록 화면이 열렸습니다.\n\n화면 경로: `/operation/receive`\n\n장소를 선택하세요.") == (
        "회의 등록 화면이 열렸습니다.\n\n장소를 선택하세요."
    )


def test_internal_codes_mapped_to_service_terms():
    assert sanitize_reply("담당 검사자: 최치료 (전문가, COUNSELOR)") == "담당 검사자: 최치료 (전문가, 상담사)"
    assert sanitize_reply("고용형태 FREELANCER입니다.") == "고용형태 프리랜서입니다."


def test_normal_text_untouched():
    text = "센터 전화번호가 `02-1234-5678`로 채워진 수정 화면이 열렸습니다.\n\n**저장** 버튼을 누르시면 적용됩니다."
    assert sanitize_reply(text) == text
