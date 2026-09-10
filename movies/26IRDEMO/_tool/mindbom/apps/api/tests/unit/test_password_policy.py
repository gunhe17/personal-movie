"""비밀번호 정책 단위 테스트 (SaMD V&V)"""
import pytest

from app.core.exceptions import InvalidOperationException
from app.core.password_policy import validate_password


class TestPasswordPolicyValid:
    """정책을 만족하는 비밀번호는 통과"""

    def test_typical_strong_password(self):
        validate_password("Test1234!")

    def test_min_length_8(self):
        validate_password("Aa1!aaaa")

    def test_with_unicode_symbol(self):
        validate_password("Pass!word1")


class TestPasswordPolicyInvalid:
    """정책 위반 시 예외 발생"""

    def test_too_short(self):
        with pytest.raises(InvalidOperationException, match="최소 8자"):
            validate_password("Aa1!")

    def test_too_long(self):
        with pytest.raises(InvalidOperationException, match="최대 128자"):
            validate_password("A1a!" + "x" * 200)

    def test_no_uppercase(self):
        with pytest.raises(InvalidOperationException, match="대문자"):
            validate_password("alllower1!")

    def test_no_lowercase(self):
        with pytest.raises(InvalidOperationException, match="소문자"):
            validate_password("ALLUPPER1!")

    def test_no_digit(self):
        with pytest.raises(InvalidOperationException, match="숫자"):
            validate_password("NoDigits!!")

    def test_no_symbol(self):
        with pytest.raises(InvalidOperationException, match="특수문자"):
            validate_password("NoSymbol1")

    def test_email_local_part_in_password(self):
        with pytest.raises(InvalidOperationException, match="이메일 정보"):
            validate_password("johnsmith1A!", email="johnsmith@example.com")

    def test_short_email_local_not_rejected(self):
        validate_password("Aa1!aaaa", email="ab@example.com")
