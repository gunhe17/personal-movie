"""Loop — 턴의 몸통. while: LLM → tool → 피드백. 가드 4종 소유, 프롬프트 리터럴 0 (전부 bundle).

yield 계약(LoopStep): EmitEvent(스트림으로) · Usage(과금 기록용) · Done/Paused(터미널).
영속·이벤트 어휘 변환은 engine 몫 — loop는 제어 흐름만.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, AsyncIterator

from app.core.logger import get_logger
from app.runtime.assistant import llm as wire
from app.runtime.assistant.catalog import ToolSpec
from app.runtime.assistant.llm import AssistantLlmTurn, ToolCall, ToolReturn, render
from app.runtime.assistant.prompts import PromptBundle
from app.runtime.assistant.sanitize import sanitize_reply

logger = get_logger(__name__)

MAX_HOPS = 8

# 데이터 주장 감지 — 건수·수치 단정, "조회 결과" 언급, 부재 단정("없습니다").
# "찾을 수 없·확인되지 않"은 부재 단정이라 능력-부정("수 없") 예외보다 먼저 잡는다
# (WUI 실측 2026-07-27: 무조회 "김민준 찾을 수 없음" 거짓 부정이 예외로 면제됨)
_DATA_CLAIM = re.compile(r"\d+\s*(건|명|회|원)|조회(된|한)?\s*결과|조회됩니다|찾을 수 없|확인되지 않")

# 화면 의도·날조 가드 제거(2026-08-11): 전부 "도구 0콜 턴"에서만 발동하는데 현행 표면에서
# 그 조건이 성립하지 않는다 — 36회 실측 발동 0. 두 가드 off 페어드도 등록 완주 9/9·부재 고지
# 6/9·h00 9/10로 전 축 무변화(absent-surface E13·E14). 죽은 코드 정리이지 성능 개선이 아니다.
# 모델 교체로 0콜 턴이 돌아오면 재도입 후보 — 계보는 D17·screen-claim-fabrication.

# 선-조회 생략 가드 — 이번 런에 query 0회인데 prefill ref를 이름만으로 채움(id 부재) → is_error
# 자기교정 1회. 조회 후 0건이면 이름만 재호출 허용(가드 문구가 안내). 잔여 15% 실패 전건이
# 이 모드(E3 B팔 3/3 hops=1 — screen-claim-fabrication E4)


def _claims_data(text: str) -> bool:
    if _DATA_CLAIM.search(text):
        return True
    if "없습니다" in text or "없어요" in text:
        # 능력·권한 부정("할 수 없다"류)은 범위밖 안내 프로즈 — 부재 단정 아님
        return not any(n in text for n in ("수 없", "수는 없", "권한이 없", "지원되지 않"))
    return False


# #
# loop → engine 스텝 (yield 계약)


@dataclass(frozen=True)
class EmitEvent:
    event: dict[str, Any]


@dataclass(frozen=True)
class Usage:
    usage: dict[str, Any]


@dataclass(frozen=True)
class Done:
    text: str
    stop: str


@dataclass(frozen=True)
class Paused:
    kind: str  # "ask" | "write_confirm"
    call: ToolCall
    prior_returns: list[
        ToolReturn
    ]  # 같은 턴에서 먼저 실행된 read 결과 — 재개 시 함께 주입
    items: list[dict[str, Any]]  # wire 스냅샷 (bookmark 저장용)


LoopStep = EmitEvent | Usage | Done | Paused


class Loop:
    def __init__(
        self,
        *,
        llm: Any,  # LoopLLM 계약: complete(system, items, tools, tool_choice)
        executor: Any,  # Executor 계약: execute(call) -> ToolOutcome
        specs: list[ToolSpec],
        native_search: bool = True,
        max_hops: int = MAX_HOPS,
    ) -> None:
        self._llm = llm
        self._executor = executor
        self._tools = render(specs, native_search=native_search)
        self._known = {s.name for s in specs}
        self._max_hops = max_hops

    async def _complete_streaming(
        self,
        *,
        bundle: PromptBundle,
        items: list[dict[str, Any]],
        tool_choice: str = "auto",
    ) -> AsyncIterator[LoopStep | AssistantLlmTurn]:
        """텍스트 델타는 completion_delta 이벤트로 흘리고, 마지막에 완성 턴을 낸다."""
        async for kind, payload in self._llm.complete_stream(
            system=bundle.system,
            items=items,
            tools=self._tools,
            tool_choice=tool_choice,
        ):
            if kind == "delta":
                yield EmitEvent({"type": "completion_delta", "text": payload})
            else:
                yield Usage(payload.usage)
                yield payload

    async def _retry_once(
        self,
        bundle: PromptBundle,
        items: list[dict[str, Any]],
        guard_text: str,
        *,
        prior_text: str | None = None,
        tool_choice: str = "auto",
        out: list,
    ) -> AsyncIterator[LoopStep]:
        """가드 문구 붙인 뒤 LLM 1회 재요청. 스트림 step은 yield, 완성 턴은 out[0]에 넣는다."""
        retry_items = list(items)
        if prior_text is not None:
            retry_items.append({"role": "assistant", "content": prior_text})
        retry_items.append({"role": "user", "content": guard_text})
        retry: AssistantLlmTurn | None = None
        async for step in self._complete_streaming(
            bundle=bundle, items=retry_items, tool_choice=tool_choice
        ):
            if isinstance(step, AssistantLlmTurn):
                retry = step
            else:
                yield step
        out.append(retry)

    async def run(
        self,
        *,
        bundle: PromptBundle,
        items: list[dict[str, Any]],
    ) -> AsyncIterator[LoopStep]:
        seen_calls: set[tuple[str, str]] = set()
        utterance = next(
            (
                m["content"]
                for m in reversed(items)
                if m.get("role") == "user" and isinstance(m.get("content"), str)
            ),
            "",
        )
        navigated = False  # 이번 런에 page.navigate 이벤트가 실재했는가
        queried = False  # 이번 런에 query 도구가 실행됐는가 — ref 검증의 사실 조건
        ref_nudged = False
        for hop in range(self._max_hops):
            turn = None
            async for step in self._complete_streaming(
                bundle=bundle, items=items, tool_choice="auto",
            ):
                if isinstance(step, AssistantLlmTurn):
                    turn = step
                else:
                    yield step

            # 가드: 빈 최종답(도구 0·텍스트 0) → wrap_up 1회 재요청
            # (graph-driven-multihop D15·D17 — 글리치 27%→0 실측)
            if not turn.text.strip() and not turn.tool_calls:
                box: list[AssistantLlmTurn | None] = []
                async for step in self._retry_once(
                    bundle, items, bundle.guards.wrap_up, out=box
                ):
                    yield step
                if box and box[0] is not None:
                    turn = box[0]

            # 가드: 멀티턴 무조회 데이터 단정 — 지난 턴 텍스트만으로 건수·조회 결과를 단정(도구 0회)
            # → requery 지적 + 재요청 1회(wrap_up 가드와 같은 결 — D15·D17 선례).
            # tool_choice 강제(any)는 OpenRouter/Poolside가 무시함 실측(2026-07-26) — 텍스트가 유일 레버.
            # 폐기된 첫 답의 델타는 이미 스트림됨 — 중복 텍스트는 날조 답보다 싼 워트로 수용
            if (
                hop == 0
                and not turn.tool_calls
                and any(m.get("role") == "assistant" for m in items)  # 멀티턴만
                and _claims_data(turn.text)
            ):
                logger.info("[assistant/loop] 무조회 데이터 단정 가드 발동 — requery 재요청")
                box = []
                async for step in self._retry_once(
                    bundle,
                    items,
                    bundle.guards.requery,
                    prior_text=turn.text,
                    out=box,
                ):
                    yield step
                # 재시도가 빈 완성이면 원답 유지 — 스테일 답이 빈 답보다 낫다
                retry = box[0] if box else None
                if retry is not None and (retry.tool_calls or retry.text.strip()):
                    turn = retry

            wire.append_assistant(items, turn)
            logger.info(
                "[assistant/loop] hop=%d stop=%s calls=%s",
                hop,
                turn.stop,
                [c.name for c in turn.tool_calls],
            )

            if turn.stop != "tool_use" or not turn.tool_calls:
                yield Done(*_final_text(turn, bundle))
                return

            returns: list[ToolReturn] = []
            for call in turn.tool_calls:
                # 가드: 미등록 tool → 자기교정
                if call.name not in self._known:
                    returns.append(
                        ToolReturn(call.id, bundle.guards.unknown_tool, is_error=True)
                    )
                    continue
                # 가드: 동일 tool+args 반복
                key = (call.name, json.dumps(call.args, sort_keys=True, default=str))
                if key in seen_calls:
                    returns.append(
                        ToolReturn(call.id, bundle.guards.duplicate_call, is_error=True)
                    )
                    continue
                seen_calls.add(key)

                # 가드: 선-조회 생략 — query 0회 상태에서 prefill ref를 이름만(id 부재)으로 채움.
                # 값0 빈 호출은 통과(화면만 열기 정당), 조회-후-없음의 이름 채움도 통과(queried)
                if call.name.startswith("query_"):
                    queried = True
                spec_kind = self._executor.spec(call.name)
                if (
                    not ref_nudged
                    and not queried
                    and spec_kind is not None
                    and spec_kind.kind == "prefill"
                    and any(
                        isinstance(v, dict) and v.get("name") and not v.get("id")
                        for v in (call.args or {}).values()
                    )
                ):
                    ref_nudged = True
                    logger.info("[assistant/loop] 선-조회 생략 가드 — id 확인 재호출 유도")
                    returns.append(
                        ToolReturn(call.id, bundle.guards.unverified_ref, is_error=True)
                    )
                    continue

                outcome = await self._executor.execute(call)
                if outcome.pause_kind:
                    yield Paused(
                        kind=outcome.pause_kind,
                        call=call,
                        prior_returns=returns,
                        items=wire.serialize(items),
                    )
                    return
                # hop 동반 — 프론트가 과정 조회(이전 홉)와 결과 조회(마지막 홉)를 가른다
                for event in outcome.events:
                    if event.get("tool") == "page.navigate":
                        navigated = True
                    yield EmitEvent({**event, "hop": hop})
                returns.append(outcome.ret)

            wire.append_tool_results(items, returns)

        # 가드: hop 소진 → 마무리 강제 — 부분 결과로 정상 종료, error 아님
        wire.append_user_text(items, bundle.guards.wrap_up)
        turn = None
        async for step in self._complete_streaming(
            bundle=bundle, items=items, tool_choice="none"
        ):
            if isinstance(step, AssistantLlmTurn):
                turn = step
            else:
                yield step
        yield Done(*_final_text(turn, bundle))


def _final_text(
    turn: AssistantLlmTurn,
    bundle: PromptBundle,
) -> tuple[str, str]:
    if turn.stop == "refusal":
        return sanitize_reply(turn.text) or bundle.guards.refusal_fallback, turn.stop
    # max_tokens 잘림은 잘린 대로 (축소 정책)
    return sanitize_reply(turn.text), turn.stop
