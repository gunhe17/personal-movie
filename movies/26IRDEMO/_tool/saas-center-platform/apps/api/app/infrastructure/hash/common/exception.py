from __future__ import annotations


class HashError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class VerifyError(HashError):
    def __init__(self, reason: str):
        super().__init__(f"hash verify 실패: {reason}")


class UnsupportedError(HashError):
    def __init__(self, operation: str):
        super().__init__(f"hash {operation} 미지원")
