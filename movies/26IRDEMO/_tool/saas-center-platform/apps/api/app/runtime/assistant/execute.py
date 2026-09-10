"""Executor — tool_call 하나의 실행. 핸들러를 시그니처 검사로 호출한다.

주입 규칙: INJECTED(center_id·owner_scope·uow)는 ctx에서, 나머지는 모델 args에서,
둘 다 없으면 None — 핸들러 시그니처가 계약이고 모델의 잉여 인자는 조용히 버린다.
예외는 is_error 결과로 — 도구 실패가 스트림을 죽이면 안 된다.
"""

from __future__ import annotations

import inspect
import types
import typing
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from app.core.logger import get_logger
from app.infrastructure.persistence.agent_query import MAX_LIMIT, group_list_rows
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.runtime.assistant.catalog import ToolSpec
from app.runtime.assistant.group_by_dims import GROUP_BY_DIMS
from app.runtime.assistant.llm import ToolCall, ToolReturn

logger = get_logger(__name__)


def _signature(handler: Any) -> inspect.Signature:
    # eval_str: `from __future__ import annotations` 핸들러도 실제 타입으로 — 코어션 누락 방지
    try:
        return inspect.signature(handler, eval_str=True)
    except Exception:
        return inspect.signature(handler)


@dataclass(frozen=True)
class AssistantContext:
    center_id: str
    member_id: str
    account_id: str | None
    permissions: tuple[str, ...]
    owner_scope: str | None
    uow: UnitOfWork


@dataclass(frozen=True)
class ToolOutcome:
    ret: ToolReturn | None = None
    events: list[dict[str, Any]] = field(default_factory=list)
    pause_kind: str | None = None  # "ask" | "write_confirm" — 설정 시 루프 일시정지


class Executor:
    def __init__(
        self,
        ctx: AssistantContext,
        specs: list[ToolSpec],
    ) -> None:
        self._ctx = ctx
        self._registry = {s.name: s for s in specs}

    def spec(
        self,
        name: str,
    ) -> ToolSpec | None:
        return self._registry.get(name)

    async def execute(
        self,
        call: ToolCall,
    ) -> ToolOutcome:
        spec = self._registry[call.name]  # 미등록은 loop 가드가 걸러서 여기 안 옴

        # 권한 검사 — 권한 밖 도구는 보이되(검색) 실행은 여기서 막는다. 프롬프트 기억이
        # 아니라 사실로 피드백해야 모델이 "기능 없음"과 "권한 없음"을 안 섞는다
        if spec.permission and spec.permission not in (self._ctx.permissions or ()):
            return ToolOutcome(
                ret=ToolReturn(
                    call.id,
                    f"이 기능은 존재하지만 현재 계정에 권한({spec.permission})이 없어 실행할 수 없습니다. "
                    "권한이 없어서임을 사용자에게 명확히 알리고, 센터 관리자에게 권한을 요청하도록 안내하세요.",
                    is_error=True,
                )
            )

        if spec.kind == "ask":
            return ToolOutcome(pause_kind="ask")
        if spec.kind == "write":
            return ToolOutcome(pause_kind="write_confirm")
        if spec.kind == "prefill":
            return await _prefill(spec, call, self._ctx)
        if spec.kind == "unsupported":
            return _unsupported(call)
        return await self._dispatch(spec, call)

    async def _dispatch(
        self,
        spec: ToolSpec,
        call: ToolCall,
    ) -> ToolOutcome:
        args = dict(call.args or {})
        gb = args.get("group_by")
        dims = GROUP_BY_DIMS.get(spec.name)
        handler_owns_gb = "group_by" in _signature(spec.handler).parameters

        # G-impl 패턴 A: handler가 group을 안 치우면 list 상한 확보 후 아래에서 bucket
        if gb and dims and not handler_owns_gb:
            if gb not in dims:
                return ToolOutcome(
                    ret=ToolReturn(
                        call.id,
                        f"unsupported group_by: {gb}",
                        is_error=True,
                    ),
                    events=[
                        {
                            "type": "step_tool_result",
                            "tool": call.name,
                            "args": call.args,
                            "display": "card",
                            "output": {"error": f"unsupported group_by: {gb}"},
                            "is_error": True,
                        }
                    ],
                )
            args.setdefault("limit", MAX_LIMIT)
            if args.get("limit") is not None and args["limit"] < MAX_LIMIT:
                args["limit"] = MAX_LIMIT
            # dim 키가 행에 남도록 fields 절삭 해제
            args.pop("fields", None)
            call = ToolCall(id=call.id, name=call.name, args=args)

        try:
            kwargs = _build_kwargs(spec.handler, self._ctx, call.args)
            result = await spec.handler(**kwargs)
        except Exception as e:
            # 단일 세션 계약: SQL 실패가 세션을 오염시키면 터미널 저장까지 죽는다 — 즉시 되돌림
            try:
                await self._ctx.uow.rollback()
            except Exception:
                pass
            logger.warning("[assistant/read] %s 실패: %s", call.name, e, exc_info=True)
            return ToolOutcome(
                ret=ToolReturn(call.id, f"도구 실행 실패: {e}", is_error=True),
                events=[
                    {
                        "type": "step_tool_result",
                        "tool": call.name,
                        "args": call.args,
                        "display": "card",
                        "output": {"error": str(e)},
                        "is_error": True,
                    }
                ],
            )

        # handler 미소유 group_by → list 행을 dim으로 집계 (이미 group 봉투면 스킵).
        # gb∈dims는 위에서 보장 — group_list_rows ValueError(미허용 dim) 분기는 불필요.
        if (
            gb
            and dims
            and not handler_owns_gb
            and isinstance(result, dict)
            and "rows" in result
            and not (result.get("aggregate") or {}).get("group_by")
        ):
            total = (result.get("aggregate") or {}).get("count")
            if total is None:
                total = len(result["rows"])
            extra = {
                k: v
                for k, v in (result.get("aggregate") or {}).items()
                if k not in ("count", "exact", "group_by")
            }
            result = group_list_rows(
                result["rows"],
                total,
                str(gb),
                allowed=frozenset(dims),
            )
            if extra:
                result["aggregate"] = {**extra, **result["aggregate"]}

        limit = kwargs.get("limit")
        # query 핸들러는 봉투 {rows, aggregate}로 반환(agent-query.md) — aggregate(전체 건수·합계)를
        # 모델에 그대로 넘긴다. 봉투 아닌 read(get_availability 등)는 bare 반환이라 형태로 분기.
        if isinstance(result, dict) and "rows" in result:
            rows = result["rows"]
            content: dict[str, Any] = result
            truncated = result.get("aggregate", {}).get("exact") is False
        else:
            rows = result
            truncated = isinstance(limit, int) and len(rows) >= limit
            content = {"rows": rows, "count": len(rows)}
            if truncated:
                content["truncated"] = True
                content["note"] = (
                    f"결과가 {limit}건에서 잘렸습니다. 더 있을 수 있으니 조건을 좁히세요."
                )

        # step_tool_result 형태는 프론트 계약 — 유일한 생성 지점이라 인라인. args 동반(감사·디버깅·트레이스)
        return ToolOutcome(
            ret=ToolReturn(call.id, content),
            events=[
                {
                    "type": "step_tool_result",
                    "tool": call.name,
                    "args": call.args,
                    "display": "card" if len(rows) == 1 else "table",
                    "output": rows,
                    "is_error": False,
                    "truncated": truncated,
                    "limit": limit,
                }
            ],
        )


def _unsupported(call: ToolCall) -> ToolOutcome:
    """부재 기능 고지 — DB도 화면도 건드리지 않는다. 이벤트는 기록 전용(display=none이라
    WUI는 안 그리고 turn events에만 남는다) — 어떤 화면 수요가 있는지의 유일한 관측점."""
    return ToolOutcome(
        ret=ToolReturn(
            call.id,
            "미지원임을 기록했습니다. 사용자에게 그 기능이 없다는 것과 대신 갈 곳을 안내하세요.",
        ),
        events=[
            {"type": "step_tool_result", "tool": call.name, "args": call.args,
             "display": "none", "output": call.args, "is_error": False},
        ],
    )


async def _prefill(
    spec: ToolSpec,
    call: ToolCall,
    ctx: AssistantContext,
) -> ToolOutcome:
    """핸들러가 반환한 fill 인터페이스(page_path + fields)를 프론트에 지시한다 — 단방향.
    DB 쓰기가 아니라 게이트를 안 타고, 모델에겐 합성 결과로 완료를 알린다.

    **읽기는 허용**(2026-08-11) — 핸들러가 시그니처에 uow를 선언하면 주입된다. 대상 특정을
    모델의 확률적 판단에 맡기면 오선택이 남는다(일지 회기 40% 미완료 선택 실측). 서버가
    결정론으로 해소할 수 있으면 그쪽이 1순위. 쓰기 금지는 그대로 — 저장은 사용자 화면에서만.
    화면을 열 수 없으면 핸들러가 `{"error": {...}}`를 반환한다 — 후보 다수(모호함은 서버가
    임의로 고르지 않고 모델이 ask_user로 사용자에게 넘긴다) 또는 대상 없음. 빈 화면을 열고
    "열었습니다"라고 말하게 두면 거짓 보고가 된다 — 실행-시 사실 피드백(R6)이 정본.
    """
    directive = spec.handler(**_build_kwargs(spec.handler, ctx, call.args))
    if inspect.isawaitable(directive):
        directive = await directive
    if "error" in directive:
        # 거절도 흔적을 남긴다 — 기록이 없으면 다음 턴 히스토리에서 이 호출이 통째로 사라져
        # "무조회 즉답" 시범이 된다(prefill 흔적 복원 계약, 완주 11%→67% 실측).
        # display=none이라 WUI엔 안 그리고 turn events에만 남는다.
        return ToolOutcome(
            ret=ToolReturn(call.id, directive["error"], is_error=True),
            events=[
                {"type": "step_tool_result", "tool": spec.name, "args": call.args,
                 "display": "none", "output": directive["error"], "is_error": True},
            ],
        )
    path = directive["page_path"]
    fields = {
        k: v for k, v in directive["fields"].items() if v not in (None, "", [], {})
    }
    # origin/origin_args = 히스토리 복원용 원 호출 — prefill 턴이 텍스트-only로 남으면 "무조회
    # 즉답 시범"이 되어 다음 턴 자발 포기를 유발 (prefill_history_lab 페어드: 완주 11%→67%).
    # args까지 실어야 한다 — input={} 복원은 "빈 인자 prefill" 모방을 가르침(WUI 실측 2026-07-27)
    events: list[dict[str, Any]] = [
        {"type": "step_tool_call", "tool": "page.navigate", "args": {"path": path},
         "origin": spec.name, "origin_args": call.args},
    ]
    # 값0이어도 폼 인터페이스가 있으면 set_fields를 보낸다 — 도착 페이지의 편집 상태 진입
    # (beforeWrite, 센터정보 view→edit)이 값이 아니라 이 이벤트에 발화한다. 폼 없는 도구
    # (프로그램 — 화면 이동만)는 page tool 미등록 페이지라 보내지 않는다
    if spec.input_schema.get("properties"):
        events.append(
            {
                "type": "step_tool_call",
                "tool": "page.set_fields",
                "args": {"fields": fields},
            }
        )
    # 모델용 반환에 raw 경로를 싣지 않는다 — 모델이 답변에 경로를 에코해 dev 어휘가 새는 근원
    # (경로 전달은 events 채널이 소유, 2026-07-27). 화면 지칭은 도구 purpose로 충분
    return ToolOutcome(
        ret=ToolReturn(
            call.id,
            {
                "prefilled": sorted(fields),
                "note": "화면을 열고 입력값을 채웠습니다. 제출은 사용자가 화면에서 확인 후 직접 합니다.",
            },
        ),
        events=events,
    )


async def run_write(
    ctx: AssistantContext,
    spec: ToolSpec,
    args: dict[str, Any],
    *,
    tool_use_id: str,
    event_group_id: str,
    actor_id: str,
) -> ToolReturn:
    """write 도구 실행 메커니즘 — commit·dispatch는 호출자(resume 셸) 소유.

    write에서 actor_id는 행위자 감사라 항상 ctx 주입(read의 LLM-facing 필터와 다름).
    """
    kwargs = _build_kwargs(
        spec.handler,
        ctx,
        args,
        extra={
            "event_group_id": event_group_id,
            "actor_id": actor_id,
        },
    )
    result = await spec.handler(**kwargs)
    return ToolReturn(tool_use_id, _dump(result))


def _dump(result: Any) -> Any:
    if result is None:
        return {"ok": True}
    if hasattr(result, "model_dump"):
        return result.model_dump(mode="json")  # datetime 등을 wire-safe 문자열로
    if isinstance(result, (dict, list, str)):
        return result
    return str(result)


def _build_kwargs(
    handler: Any,
    ctx: AssistantContext,
    args: dict[str, Any],
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """핸들러 시그니처대로 채운다 — 주입(INJECTED+center_id) > 모델 args > 기본값 > None.

    center_id는 테넌트 격리라 항상 ctx가 강제. member_id·actor_id 같은 정체성 인자는
    도구에 따라 LLM-facing 필터일 수 있어(query_activity의 작업자 필터 등) 기본 주입하지
    않는다(tool_loader.INJECTED_ARGS 계약). extra는 write 게이트 전용 주입.
    """
    injected = {
        "center_id": ctx.center_id,
        "owner_scope": ctx.owner_scope,
        "uow": ctx.uow,
        "actor_membership_id": ctx.member_id,
        **(extra or {}),
    }
    kwargs: dict[str, Any] = {}
    sig = _signature(handler)
    for name, param in sig.parameters.items():
        if param.kind is inspect.Parameter.VAR_KEYWORD:
            # **kwargs 핸들러 = 전부-수용 계약: 남은 모델 args를 그대로 전달.
            # 미처리 시 kwargs[name]=None으로 떨어져 인자 전체가 조용히 증발한다(lab 실사고, D13)
            for k, v in args.items():
                kwargs.setdefault(k, v)
            continue
        if name in injected:
            kwargs[name] = injected[name]
        elif name in args:
            kwargs[name] = _coerce(args[name], param.annotation)
        elif param.default is not inspect.Parameter.empty:
            continue  # 기본값에 맡긴다
        elif (model := _model_type(param.annotation)) is not None:
            # FastAPI Body-embed 등가: TOOL 스키마는 평평한데 핸들러는 data 모델 하나를 받는 꼴
            kwargs[name] = model.model_validate(args)
        else:
            kwargs[name] = None
    return kwargs


def _unwrap(annotation: Any) -> Any:
    """Optional/Union[X, None] → X. 그 외는 그대로."""
    origin = typing.get_origin(annotation)
    if origin is typing.Union or origin is types.UnionType:
        non_none = [a for a in typing.get_args(annotation) if a is not type(None)]
        if len(non_none) == 1:
            return non_none[0]
    return annotation


def _model_type(annotation: Any) -> Any:
    """Optional 언랩 후 pydantic 모델이면 그 클래스, 아니면 None."""
    target = _unwrap(annotation)
    if isinstance(target, type) and hasattr(target, "model_validate"):
        return target
    return None


def _coerce(
    value: Any,
    annotation: Any,
) -> Any:
    """HTTP에서 FastAPI가 하던 타입 변환의 등가물 — 모델의 JSON 값을 시그니처 타입으로.

    datetime/date(JSON이 못 싣는 타입)와 pydantic 모델만 다룬다. 변환 실패는 그대로
    raise — dispatch가 잡아 is_error로 모델에 피드백된다.
    """
    target = _unwrap(annotation)

    if isinstance(value, str):
        if target is datetime:
            return datetime.fromisoformat(value)
        if target is date:
            return date.fromisoformat(value)
    if isinstance(value, dict) and (model := _model_type(target)) is not None:
        return model.model_validate(value)
    return value
