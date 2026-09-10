"""4층 방어 — 상태 계약의 런타임 관측.

1~3층과 무엇이 다른가
----------------------
1층(로드 시점 선언·구현 대조), 2층(리터럴·재구현 금지 lint), 3층(적합성 표
전수 대조)은 전부 **코드가 규칙을 어기는 것**을 막는다. 그런데 DB에는 코드를
거치지 않고 들어온 값이 있을 수 있다 — 과거 버전이 쓴 값(`completed`),
마이그레이션, 수기 수정, 외부 연동.

status 컬럼은 String(30)이고 DB enum 제약이 없다(models.py:47). 즉 어떤
문자열이든 들어갈 수 있고, 3층까지의 방어는 그것을 보지 못한다. 4층은
**이미 들어와 있는 값**을 읽는 시점에 관측한다.

차단이 아니라 기록인 이유
-------------------------
계약 밖 값을 만나면 예외를 던지고 싶어지지만, 그러면 과거 데이터를 가진
검사가 조회 자체를 못 하게 된다 — 임상 기록에 접근이 막히는 편이 값이
낡은 것보다 나쁘다. state_machine.py의 원칙 그대로다: **읽기 판정은
관대하게, 쓰기(전이)는 엄격하게.** 여기서는 관대하게 읽되 흔적을 남긴다.

중복 억제
---------
목록 조회 한 번에 같은 낡은 값이 수십 건 나올 수 있다. 매 행마다 감사 로그를
쓰면 로그가 그 값 하나로 뒤덮여 다른 사건을 못 찾는다. 프로세스 수명 동안
(status, institution) 조합당 한 번만 기록한다.
"""
import logging

from app.modules.audit.repository import AuditLogRepository
from app.modules.audit.services import AuditLogger

from .state_machine import ALL_STATUSES, CONFIRMED_STATUSES

logger = logging.getLogger(__name__)

# 계약(ALL_STATUSES) 밖이지만 존재를 이미 아는 값 — CONFIRMED_STATUSES가
# 하위호환으로 품고 있는 것들이다. "모르는 값"과 구분해서 기록한다.
KNOWN_LEGACY_STATUSES: frozenset[str] = frozenset(CONFIRMED_STATUSES) - set(
    ALL_STATUSES
)

AUDIT_ACTION = "contract_violation"
ENTITY_TYPE = "examination"

# 관측자 자신이 남기는 로그의 행위자 — 사람이 한 일이 아님을 분명히 한다.
# actor_email은 모델에서 non-null이라 값이 필요하다.
_SYSTEM_ACTOR_EMAIL = "system@mindbom.internal"

# (status, institution_id) 조합당 1회. 프로세스 수명 동안 유지된다 —
# 재시작하면 다시 한 번 기록되는데, 그건 의도한 동작이다(배포 후 잔존 확인).
_reported: set[tuple[str, str | None]] = set()


def is_contract_status(status: str) -> bool:
    """계약에 선언된 상태인가."""
    return status in ALL_STATUSES


def reset_reported_cache() -> None:
    """중복 억제 캐시 비우기 — 테스트 격리용."""
    _reported.clear()


async def observe_status(
    status: str,
    *,
    examination_id: str,
    institution_id: str | None,
    repo: AuditLogRepository | None = None,
) -> bool:
    """읽어온 status가 계약 안에 있는지 관측한다. 위반이면 True.

    위반이어도 예외를 던지지 않는다 — 호출자는 반환값을 무시해도 되고,
    그게 정상 사용법이다. 반환값은 테스트와 진단용이다.

    repo가 None이면 애플리케이션 로그에만 남긴다. 감사 로그까지 남기려면
    호출자가 UoW에서 repo를 꺼내 넘긴다(commit은 호출자 책임).
    """
    if is_contract_status(status):
        return False

    kind = "legacy" if status in KNOWN_LEGACY_STATUSES else "unknown"

    logger.warning(
        "계약 밖 상태 관측: status=%s kind=%s examination_id=%s institution_id=%s",
        status,
        kind,
        examination_id,
        institution_id,
    )

    key = (status, institution_id)
    if key in _reported:
        return True
    _reported.add(key)

    if repo is None:
        return True

    await AuditLogger(repo).log(
        action=AUDIT_ACTION,
        entity_type=ENTITY_TYPE,
        entity_id=examination_id,
        actor_id=None,
        actor_email=_SYSTEM_ACTOR_EMAIL,
        actor_role=None,
        institution_id=institution_id,
        metadata={
            "observed_status": status,
            "kind": kind,
            "contract_statuses": list(ALL_STATUSES),
            "note": (
                "DB에 상태 계약 밖의 값이 있다. 차단하지 않고 기록만 한다 "
                "— 읽기 판정은 관대하게, 쓰기는 엄격하게."
            ),
        },
    )
    return True


def scan_statuses(statuses: list[str]) -> dict[str, int]:
    """계약 밖 값의 분포를 센다 — 배치 점검·대시보드용.

    감사 로그를 쓰지 않으므로 목록 조회 경로에서 부담 없이 부를 수 있다.
    """
    counts: dict[str, int] = {}
    for s in statuses:
        if not is_contract_status(s):
            counts[s] = counts.get(s, 0) + 1
    return counts
