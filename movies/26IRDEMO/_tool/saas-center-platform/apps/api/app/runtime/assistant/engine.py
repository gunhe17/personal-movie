"""AssistantEngine — 턴의 몸통 조립(composition root)과 터미널 저장.

저장 계약(agent-flow.md): 턴당 쓰기 2회 — INSERT는 셸(write-ahead), 터미널 UPDATE는 엔진.
hop 중 이벤트는 메모리 버퍼, 터미널에 한 번에 flush. 단절도 flush 경로(shield).
usage(과금)만 별도 축 — hop마다 gateway 즉시(돈은 쓴 순간, 대화는 끝난 순간).
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any, AsyncIterator

from app.core.config import settings
from app.core.logger import get_logger
from app.infrastructure.anthropic.common.exception import AnthropicProviderError
from app.modules.assistant.facade import AssistantFacade, AssistantTurnStatus
from app.modules.llm.credit_balance.plan_config import AIPurpose
from app.modules.llm.facade.ai_facade import create_ai_facade
from app.modules.llm.gateway.schemas import AICallContext
from app.runtime.assistant import context as context_mod
from app.runtime.assistant import llm as wire
from app.runtime.assistant.catalog import specs_for
from app.runtime.assistant.execute import AssistantContext, Executor
from app.runtime.assistant.loop import Done, EmitEvent, Loop, Paused, Usage

logger = get_logger(__name__)

# upstream rate limit(429) 폴백 — 에러 대신 정상 턴으로 종결(agent-429-fallback-plan.md)
_RATE_LIMITED_NOTICE = "지금 요청이 많아 잠시 응답이 어려워요. 잠시 후 다시 시도해주세요."


@dataclass(frozen=True)
class _TurnRef:
    """ORM 스냅샷 — rollback이 인스턴스를 만료시켜도(도구 실패·gate 실패) 터미널 저장이 살게."""

    id: str
    conversation_id: str
    user_message: str
    base_events: list


def _ref_of(turn: Any) -> _TurnRef:
    return _TurnRef(
        id=turn.id,
        conversation_id=turn.conversation_id,
        user_message=turn.user_message,
        base_events=list(turn.events or []),
    )


class AssistantEngine:
    def __init__(
        self,
        ctx: AssistantContext,
    ) -> None:
        self._ctx = ctx
        self._facade = AssistantFacade(ctx.uow)
        self._ai = create_ai_facade()
        specs = specs_for(ctx.permissions)
        self._executor = Executor(ctx, specs)
        self._loop = Loop(
            llm=_default_llm(),
            executor=self._executor,
            specs=specs,
            # OpenRouter 경유(gemini 등) — bm25 서버 검색은 Anthropic 전용이라 전 도구 평載
            native_search=False,
        )

    async def run(
        self,
        *,
        turn: Any,  # write-ahead 커밋 완료된 AssistantTurn
        profile: Any = None,  # 셸이 조회한 ProfileSnapshot — 실패 시 None(날짜만으로 진행)
    ) -> AsyncIterator[dict[str, Any]]:
        ref = _ref_of(turn)
        buffer: list[dict[str, Any]] = []
        try:
            yield {"type": "progress", "message": "요청을 처리하고 있습니다..."}

            hist_items = await self._history(ref.conversation_id)
            turn_input = context_mod.assemble(
                permissions=self._ctx.permissions,
                profile=profile,
                history=hist_items,
            )
            items = wire.initial_items(turn_input, user_message=ref.user_message)

            async for event in self._drive(
                ref, turn_input.bundle, items, buffer
            ):
                yield event

        except (asyncio.CancelledError, GeneratorExit):
            await self._flush_abandoned(ref, buffer)
            raise

    async def resume(
        self,
        *,
        turn: Any,  # claim 커밋 완료된 AssistantTurn (status=running)
        bookmark: dict[str, Any],
        answer: Any,  # ToolReturn — gate 실행 결과 또는 ask 답변
        executed_event: dict[str, Any]
        | None = None,  # gate 결과의 step_tool_result (셸 소유)
        profile: Any = None,
    ) -> AsyncIterator[dict[str, Any]]:
        ref = _ref_of(turn)
        buffer: list[dict[str, Any]] = []
        try:
            yield {"type": "progress", "message": "응답을 처리하고 있습니다..."}
            if executed_event is not None:
                buffer.append(executed_event)
                yield executed_event

            # 멈췄던 wire 기록 복원 + (먼저 끝난 조회 결과 + 이번 답)을 붙여 루프 재합류.
            # items가 이미 대화 전체라 history 로드는 생략
            items = list(bookmark["wire_messages"])
            prior = [
                wire.ToolReturn(r["call_id"], r["content"], r.get("is_error", False))
                for r in bookmark.get("prior_returns", [])
            ]
            wire.append_tool_results(items, [*prior, answer])

            turn_input = context_mod.assemble(
                permissions=self._ctx.permissions,
                profile=profile,
                history=[],
            )
            # resume은 텍스트 쌍 히스토리 미보유(bookmark wire뿐) — 응답자 대화는 발화만
            async for event in self._drive(ref, turn_input.bundle, items, buffer):
                yield event

        except (asyncio.CancelledError, GeneratorExit):
            await self._flush_abandoned(ref, buffer)
            raise

    # #
    # 내부

    async def _drive(
        self,
        ref: _TurnRef,
        bundle: Any,
        items: list[dict[str, Any]],
        buffer: list[dict[str, Any]],
    ) -> AsyncIterator[dict[str, Any]]:
        """LoopStep → 이벤트 번역 + 터미널 저장 — run/resume 공용 몸통."""
        process_parts: list[str] = []
        try:
            async for step in self._loop.run(bundle=bundle, items=items):
                if isinstance(step, Usage):
                    await self._record_usage(ref, step.usage)

                elif isinstance(step, EmitEvent):
                    # completion_delta는 스트림 전용 — 단 원문은 모아 process_text로 영속
                    # (새로고침 복원 시 "작업 과정" 재현. 완성본은 conversation_done/completion이 정본)
                    if step.event.get("type") == "completion_delta":
                        process_parts.append(step.event.get("text") or "")
                    else:
                        buffer.append(step.event)
                    yield step.event

                elif isinstance(step, Paused):
                    # 멈춤 — checkpoint까지 events에 담아 터미널 저장 후 방출(persist-before-yield)
                    checkpoint = self._checkpoint_event(step)
                    buffer.append(checkpoint)
                    await self._finish(
                        ref,
                        status=AssistantTurnStatus.PAUSED,
                        events=buffer,
                        bookmark=_bookmark_of(step),
                    )
                    yield checkpoint
                    return

                elif isinstance(step, Done):
                    final = step.text
                    if process_parts:
                        buffer.insert(0, {"type": "process_text", "text": "".join(process_parts)})
                    await self._finish(
                        ref,
                        status=AssistantTurnStatus.DONE,
                        events=buffer,
                        completion=final,
                    )
                    yield {"type": "conversation_done", "message": final}
                    return
        except AnthropicProviderError as e:
            # 429만 폴백 — 그 외 provider 장애는 진짜 에러로 관통
            if "429" not in str(e):
                raise
            logger.info("[assistant] LLM 429 — 폴백 안내로 턴 종결")
            await self._finish(
                ref,
                status=AssistantTurnStatus.DONE,
                events=buffer,
                completion=_RATE_LIMITED_NOTICE,
            )
            yield {"type": "conversation_done", "message": _RATE_LIMITED_NOTICE}

    async def _flush_abandoned(
        self,
        ref: _TurnRef,
        buffer: list[dict[str, Any]],
    ) -> None:
        # SSE 단절 = 턴 종료의 한 형태 — 끊긴 데까지 flush (shield로 취소 중에도 완주)
        try:
            await asyncio.shield(
                self._finish(ref, status=AssistantTurnStatus.ABANDONED, events=buffer)
            )
        except Exception:
            logger.warning("[assistant] abandoned flush 실패", exc_info=True)

    async def _history(
        self,
        conversation_id: str,
    ) -> list[dict[str, Any]]:
        try:
            done_turns = await self._facade.list_assistant_turns(
                conversation_id,
                self._ctx.center_id,
                status=AssistantTurnStatus.DONE,
            )
        except Exception:
            logger.warning("[assistant] history 로드 실패", exc_info=True)
            return []
        return _history_items(done_turns)

    async def _finish(
        self,
        ref: _TurnRef,
        *,
        status: AssistantTurnStatus,
        events: list[dict[str, Any]],
        completion: str | None = None,
        bookmark: dict[str, Any] | None = None,
    ) -> None:
        """터미널 UPDATE 1회 + 커밋. 실패해도 스트림은 계속 — stale running은 sweeper 몫."""
        try:
            # 기존 행 events(재개면 checkpoint·답변이 이미 적재) 뒤에 이번 버퍼를 이어붙인다 — 덮어쓰면 유실
            await self._facade.finish_assistant_turn(
                ref.id,
                self._ctx.center_id,
                status=status,
                events=wire.serialize(ref.base_events + events),
                completion=completion,
                bookmark=wire.serialize([bookmark])[0] if bookmark else None,
            )
            await self._ctx.uow.commit()
        except Exception:
            logger.warning(
                "[assistant] 터미널 저장 실패 status=%s", status, exc_info=True
            )

    async def _record_usage(
        self,
        ref: _TurnRef,
        usage: dict[str, Any],
    ) -> None:
        """hop별 과금 — gateway 독립 세션. 실패 격리(스트림 안 끊김)."""
        try:
            await self._ai.record_agent_call(
                AICallContext(
                    center_id=self._ctx.center_id,
                    source_type="agent",
                    purpose=AIPurpose.AGENT_MESSAGE,
                    member_id=self._ctx.member_id,
                    session_id=ref.conversation_id,
                ),
                model=usage.get("model", ""),
                input_tokens=usage.get("input_tokens", 0),
                output_tokens=usage.get("output_tokens", 0),
                latency_ms=usage.get("latency_ms", 0.0),
                meta=usage.get("io"),
            )
        except Exception:
            logger.warning("[assistant] usage 기록 실패", exc_info=True)

    def _checkpoint_event(
        self,
        paused: Paused,
    ) -> dict[str, Any]:
        """사용자에게 보여줄 질문과 선택지 — 프론트 계약, 유일한 생성 지점."""
        if paused.kind == "ask":
            args = paused.call.args
            fields = args.get("fields")
            if fields:  # request_form — 폼 제목이 안내, 별도 질문 세그먼트 없음
                question = ""
                input_dict = {
                    "type": "form",
                    "fields": fields,
                    "title": args.get("title") or "정보를 입력해주세요",
                }
            elif args.get("options"):
                question = args.get("question", "추가 정보가 필요해요.")
                input_dict = {"type": "selection", "options": args["options"]}
            else:
                question = args.get("question", "추가 정보가 필요해요.")
                input_dict = None
        else:  # write_confirm — diff 요약 + 확인/취소
            spec = self._executor.spec(paused.call.name)
            label = (
                spec.confirm_label if spec and spec.confirm_label else paused.call.name
            )
            changes = {k: v for k, v in paused.call.args.items() if v not in (None, "")}
            diff = (
                "\n".join(f"  • {k}: {v}" for k, v in changes.items())
                or "  (변경 내용 없음)"
            )
            question = f"'{label}'을(를) 실행할까요?\n{diff}"
            input_dict = {"type": "selection", "options": ["확인", "취소"]}

        event: dict[str, Any] = {
            "type": "checkpoint_waiting",
            "step_id": f"assistant_{paused.kind}",
            "question": question,
        }
        if input_dict:
            event["input"] = input_dict
        return event


# 히스토리에 도구 흔적(tool_use/tool_result)을 복원한다 — 텍스트 쌍만 남기면 지난 턴이
# "무조회 즉답 시범"으로 보여 오케 모델이 그 패턴을 모방(멀티턴 오염: 오선택 0/5→5/5 실측,
# history-tool-trace-plan.md · 구 laguna 관측). 결과는 절삭 — 효과의 원천은 데이터가 아니라 조회 궤적.
_TRACE_ROWS = 3
_TRACE_CHARS = 500


def _trace_content(event: dict[str, Any]) -> str:
    out = event.get("output")
    if isinstance(out, list):
        # 메타를 앞에 — 뒤에 두면 문자 절삭이 요약(returned_rows)을 먹는다 (e2e 실증)
        body: dict[str, Any] = {"returned_rows": len(out)}
        if event.get("truncated"):
            body["truncated"] = True
        body["rows"] = out[:_TRACE_ROWS]
    else:
        body = out
    return json.dumps(body, ensure_ascii=False, default=str)[:_TRACE_CHARS]


# 하이브리드 히스토리 — 과거 턴은 상태-요약 블록(assistant 턴 시범 제거·엔티티 보존·집계 라벨),
# 최근 1턴만 원문(지칭 해소). 실측: 날조 시범 모방 제거(E1 3프로브)·재사용 0홉 10/10·규율 무손상
# (history-as-state-summary E1·E2). E3(프로덕션 동형 페어드) 통과로 ON(2026-07-29) —
# 전 프로브 비열화 + 지칭 해소 3/10→10/10(p=.016). 킬스위치 False = 전 턴 원문 복원.

# rows 정의값(안정 사실 — 대화 중 불변, 재사용 정당). 집계·상태값은 휘발이라 배제(라벨만)
_ENTITY_KEYS = ("id", "name", "code", "birth_date", "gender", "phone", "email", "title")


def _summarize_turns(turns: list[Any]) -> str:
    entities: dict[str, str] = {}
    acts: list[str] = []
    for t in turns:
        done: list[str] = []
        for ev in t.events or []:
            if ev.get("type") == "step_tool_call" and ev.get("origin"):
                path = (ev.get("args") or {}).get("path")
                done.append(f"화면 엶({path}) — 제출 여부 미확인")
            elif ev.get("type") == "step_tool_result" and not ev.get("is_error"):
                done.append(f"{ev.get('tool') or '?'} 조회")
                rows = ev.get("output") if isinstance(ev.get("output"), list) else []
                for row in rows[:3]:
                    if not isinstance(row, dict):
                        continue
                    kept = {k.split(".")[-1]: v for k, v in row.items()
                            if k.split(".")[-1] in _ENTITY_KEYS and v not in (None, "")}
                    name = kept.get("name")
                    if name:
                        entities[str(name)] = ", ".join(
                            f"{k}={v}" for k, v in kept.items() if k != "name"
                        )
        acts.append(f"\"{(t.user_message or '')[:40]}\" → " + ("; ".join(done) or "텍스트 답변"))
    lines = ["<이전_대화_요약>"]
    if entities:
        # 시간 순서는 명시 라벨로 — 암묵 나열은 모델이 "처음/직전"을 못 읽음(E5 원거리 0/5 실측)
        names = list(entities)
        lines.append("확보된 대상(조회순): " + " · ".join(
            f"{i + 1}.{n}({entities[n]})"
            + ("  ← 첫 조회" if i == 0 and len(names) > 1 else "")
            for i, n in enumerate(names)))
    lines += ["행위 기록(시간순):"] + [f"{i + 1}. {a}" for i, a in enumerate(acts)]
    lines.append("집계·건수는 조회 시점 값 — 필요 시 재조회.")
    lines.append("</이전_대화_요약>")
    return "\n".join(lines)


def _history_items(done_turns: list[Any]) -> list[dict[str, Any]]:
    turns = [t for t in done_turns if t.completion]
    if len(turns) <= 1:
        return _raw_history_items(turns)
    # 원문 창 = 최근 2턴 (E4: 요약 속 다중 엔티티는 최신성 신호가 없어 지칭 붕괴 —
    # 2턴 원문이 재채점 10/10 vs 1턴 0/10, p=.002. 오염·완주 축은 전 팔 10/10 무손상)
    summary = _summarize_turns(turns[:-2])
    return (
        ([{"role": "user", "content": summary}] if turns[:-2] else [])
        + _raw_history_items(turns[-2:])
    )


def _raw_history_items(done_turns: list[Any]) -> list[dict[str, Any]]:
    history: list[dict[str, Any]] = []
    for t in done_turns:
        if not t.completion:
            continue
        history.append({"role": "user", "content": t.user_message})
        for i, ev in enumerate(t.events or []):
            # prefill 흔적도 복원 — 텍스트-only prefill 턴은 "무조회 즉답 시범"으로 보여
            # 다음 턴의 자발 포기를 유발한다 (prefill_history_lab 페어드: 완주 11%→67%)
            if ev.get("type") == "step_tool_call" and ev.get("origin"):
                tid = f"h{str(t.id)[:8]}_{i}"
                history.append({
                    "role": "assistant",
                    "content": [{
                        "type": "tool_use", "id": tid,
                        "name": ev["origin"], "input": ev.get("origin_args") or {},
                    }],
                })
                history.append({
                    "role": "user",
                    "content": [{
                        "type": "tool_result", "tool_use_id": tid,
                        "content": json.dumps(
                            {"navigated": (ev.get("args") or {}).get("path"),
                             "note": "화면을 열었습니다."},
                            ensure_ascii=False,
                        ),
                    }],
                })
                continue
            if ev.get("type") != "step_tool_result":
                continue
            tid = f"h{str(t.id)[:8]}_{i}"
            history.append({
                "role": "assistant",
                "content": [{
                    "type": "tool_use", "id": tid,
                    "name": ev.get("tool") or "unknown",
                    "input": ev.get("args") or {},
                }],
            })
            history.append({
                "role": "user",
                "content": [{
                    "type": "tool_result", "tool_use_id": tid,
                    "content": _trace_content(ev),
                    **({"is_error": True} if ev.get("is_error") else {}),
                }],
            })
        history.append({"role": "assistant", "content": t.completion})
    return history


def _bookmark_of(paused: Paused) -> dict[str, Any]:
    """재개에 필요한 전부 — 무엇을 하다 멈췄고, 대화가 어디까지 진행됐었는지."""
    return {
        "kind": paused.kind,
        "tool": paused.call.name,
        "tool_use_id": paused.call.id,
        "args": paused.call.args,
        "prior_returns": [
            {"call_id": r.call_id, "content": r.content, "is_error": r.is_error}
            for r in paused.prior_returns
        ],
        "wire_messages": paused.items,
    }


def _default_llm() -> Any:
    # lazy: SDK 사슬 — 취득만, 사용은 llm seam 안
    from app.infrastructure.anthropic.factory import OPENROUTER_BASE_URL, get_messenger
    from app.runtime.assistant.llm import LoopLLM

    # OpenRouter 경유 (gemini·구 laguna 공통). 모델 SSOT = settings.NEW_AGENT_LLM_MODEL
    return LoopLLM(
        get_messenger(settings.NEW_AGENT_LLM_MODEL, base_url=OPENROUTER_BASE_URL)
    )
