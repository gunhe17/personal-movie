import json
from datetime import datetime, timedelta

from app.core.datetime_utils import utc_now
from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import ProgramFacade, RoomFacade
from app.modules.counseling.facade import CounselingCaseFacade
from app.modules.event import aggregate_actor_usage
from app.modules.llm.credit_balance.plan_config import AIPurpose
from app.modules.llm.facade.ai_facade import create_ai_facade
from app.modules.llm.gateway.schemas import AICallContext
from app.modules.person_profile import PersonProfileFacade
from app.modules.schedule.facade import ScheduleFacade

logger = get_logger(__name__)

_SYSTEM = (
    "너는 상담센터 SaaS 사용자의 행동 로그로 업무 프로필을 갱신한다. "
    "이전 프로필(previous)과 최근 집계(aggregates)를 반영해 사용 패턴을 서술하라. "
    '출력은 JSON만: {"summary": str, "focus": [str]}. '
    "규칙: summary는 자연스러운 한국어 1~2문장, focus는 주 업무 영역 최대 3개. "
    "3인칭 선언문으로, 시효성 표현(날짜·'최근'·'이번 주') 금지 — 무시제 패턴만 서술. "
    "집계 숫자를 재진술하지 말고 패턴·선호만. "
    "previous와 집계가 모순되면 최근 집계를 우선하라. previous가 null이면 처음부터 작성하라."
)


async def _refine_narrative(
    *,
    center_id: str,
    member_id: str,
    previous: dict | None,
    aggregates: dict,
    window_days: int,
) -> dict:
    # 어떤 실패(안전 거부·파싱·게이트웨이)도 raise하지 않는다 — {} 반환 시 호출자가
    # 이전 narrative를 보존하고 분석은 성공 종결(다음 stale 주기에 자연 재시도).
    # 배경: background 거부는 HTTP 200 + 빈 content라 예외가 아니며, raise하면
    # 아웃박스가 같은 모델로 재시도 → 재거부 루프.
    ctx = AICallContext(
        center_id=center_id,
        source_type="person_profile",
        purpose=AIPurpose.PROFILE_ANALYZE,
        pipeline_step="profile_refine",
        member_id=member_id,
    )
    payload = {
        "previous": previous or None,
        "aggregates": aggregates,
        "window_days": window_days,
    }
    try:
        result = await create_ai_facade().generate_json(
            ctx,
            _SYSTEM,
            json.dumps(payload, ensure_ascii=False),
            max_tokens=512,
        )
        data = json.loads(result.content)
        summary = str(data.get("summary") or "").strip()
        focus = [str(f).strip() for f in (data.get("focus") or []) if str(f).strip()][
            :3
        ]
        if not summary:
            logger.warning("[person_profile/refine] 빈 summary — 이전 narrative 유지")
            return {}
        return {"summary": summary, "focus": focus}
    except Exception:
        logger.warning(
            "[person_profile/refine] narrative 갱신 실패 — 이전 유지", exc_info=True
        )
        return {}


async def _compute_defaults(
    uow: UnitOfWork,
    *,
    center_id: str,
    member_id: str,
    since: datetime,
) -> dict:
    # 자주 쓰는 값(최빈 상담실·회기 길이·프로그램) — 항목별 독립 실패 허용(None).
    defaults: dict = {
        "usual_room": None,
        "usual_duration_min": None,
        "usual_program": None,
    }

    try:
        room_id, duration_min = await ScheduleFacade(uow).aggregate_usual_schedule(
            center_id=center_id, member_id=member_id, since=since
        )
        defaults["usual_duration_min"] = duration_min
        if room_id:
            rooms = await RoomFacade(uow).get_rooms_by_ids([room_id])
            room = rooms.get(room_id)
            if room:
                defaults["usual_room"] = {"id": room.id, "name": room.name}
    except Exception:
        logger.warning("[person_profile/defaults] schedule 집계 실패", exc_info=True)

    try:
        program_id = await CounselingCaseFacade(uow).aggregate_top_program(
            center_id=center_id, counselor_id=member_id, since=since
        )
        if program_id:
            program = await ProgramFacade(uow).find_program(program_id)
            if program:
                defaults["usual_program"] = {"id": program.id, "name": program.name}
    except Exception:
        logger.warning("[person_profile/defaults] program 집계 실패", exc_info=True)

    return defaults


async def analyze_usage_handler(
    *,
    center_id: str,
    member_id: str,
    uow: UnitOfWork,
    window_days: int = 90,
) -> dict:
    now = utc_now()
    since = now - timedelta(days=window_days)

    # aggregate (결정적 사실 — refine 입력용, 저장 안 함)
    aggregates = await aggregate_actor_usage(
        uow, center_id=center_id, actor_id=member_id, since=since
    )

    # load previous (compounding 입력)
    previous = await PersonProfileFacade(uow).find_person_profile(
        center_id=center_id, member_id=member_id
    )
    prev_content = (previous.content if previous else None) or {}

    # refine (LLM — 실패 시 {} → 이전 narrative 보존)
    narrative = await _refine_narrative(
        center_id=center_id,
        member_id=member_id,
        previous=prev_content.get("narrative"),
        aggregates=aggregates,
        window_days=window_days,
    )
    if not narrative:
        narrative = prev_content.get("narrative") or {}

    # defaults (결정적 집계 — LLM 무접촉)
    defaults = await _compute_defaults(
        uow, center_id=center_id, member_id=member_id, since=since
    )

    # upsert — content v2 (aggregates 비저장: 소비자 없음, refine이 매번 재계산)
    content = {
        "narrative": narrative,
        "defaults": defaults,
        "notes": prev_content.get("notes", []),
    }
    result = await PersonProfileFacade(uow).upsert_person_profile(
        center_id=center_id,
        member_id=member_id,
        content=content,
        version=(previous.version + 1) if previous else 1,
        analyzed_at=now,
    )
    return result.content
