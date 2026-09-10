"""Credential 통계 + 인증 정책 판정

Person이 가진 credentials로부터 인증 상태를 계산한다.
백엔드 한 곳에서 정책을 관리해 본인용/admin/외부 노출 등 모든 진입점이 동일한 판정을 사용한다.

C안 정책 (설계 문서 §9 참조):
  자격증(credential_type=certification) ≥1 verified
  AND 학력(credential_type=education) ≥1 verified
"""
from .models import CredentialStatus, PersonCredential
from .schemas import CredentialStats


def compute_stats(credentials: list[PersonCredential]) -> CredentialStats:
    """credentials 목록으로부터 stats 계산."""
    stats = CredentialStats()
    for c in credentials:
        stats.total += 1
        status = c.status
        if status == CredentialStatus.PENDING:
            stats.pending += 1
        elif status == CredentialStatus.VERIFIED:
            stats.verified += 1
            if c.credential_type == "certification":
                stats.verified_certifications += 1
            elif c.credential_type == "education":
                stats.verified_educations += 1
        elif status == CredentialStatus.REJECTED:
            stats.rejected += 1

    stats.is_certified = (
        stats.verified_certifications >= 1 and stats.verified_educations >= 1
    )
    return stats
