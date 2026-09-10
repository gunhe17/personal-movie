"""H4 회귀: 공개 verify 코드는 CSPRNG(secrets)로 생성, 4자리."""
import inspect

from app.modules.assessment.send_link.services import create_send_link as link_mod
from app.modules.assessment.send_result.services import create_send_result as result_mod


def test_send_link_code_is_4_digit():
    code = link_mod.generate_verification_code()
    assert len(code) == 4 and code.isdigit()


def test_send_result_code_is_4_digit():
    code = result_mod.generate_verification_code()
    assert len(code) == 4 and code.isdigit()


def test_codes_use_secrets_not_mersenne_twister():
    # MT(random)는 상태 복원 가능 → 공개 토큰엔 부적합. secrets 사용을 고정한다.
    for mod in (link_mod, result_mod):
        src = inspect.getsource(mod)
        assert "secrets" in src, f"{mod.__name__} must use secrets"
        assert "random.choices" not in src, f"{mod.__name__} must not use random.choices"
