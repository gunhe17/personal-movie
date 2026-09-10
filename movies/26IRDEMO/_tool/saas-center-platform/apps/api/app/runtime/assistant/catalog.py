"""assistant tool 선언·수집 — 핸들러 TOOL(레지스트리)이 도구의 소스, ask_user만 자체 선언.

read는 always-load, write는 defer_loading — 모델이 tool search(bm25)로 찾아 쓴다.
근거: read 60종만으로 프리픽스 60k tok, write 51종 합치면 127k(정확도·비용 모두 손해).
"""

from __future__ import annotations

import copy
import re
from dataclasses import dataclass, replace
from typing import Any

from app.runtime.assistant.group_by_dims import (
    GROUP_BY_DIMS,
    GROUP_BY_WHEN,
    GROUP_BY_WHEN_STATUS,
    _GB_PROP_BASE,
)

# LLM-대면 표현 규격 (agent-query.md 표현 규격 §, 2026-07-30 배선):
# query 24종 = R 템플릿(_R_DESC — what 나열형 + aggregate 계약 + 락 4종. rules-complete E1
# 격리 검증: 거절 30%→0%·전 축 비열화, run 86b60992). 비-query(prefill·ask)는 다이어트(앞
# 2문장, E1·E2 채택분) 유지. TOOL 원문은 문서·감사·임베딩 SSOT로 불변(벡터 드리프트 금지).
_SENT = re.compile(r"(?<=[.다])\s+")

_R_DESC = {
    "query_activity_handler": "센터 활동(감사) 로그를 분류·행위·엔티티·작업자·기간으로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_assessment_case_handler": "검사 케이스를 상태·기간·태그·케이스코드·client_id로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_assessment_handler": "센터가 운영하는 심리검사 종류(카탈로그)를 조회한다. 건수·합계는 aggregate 값을 읽는다. 활성 검사만 조회된다 — 비활성 검사는 나오지 않는다.",
    "query_assessment_participant_handler": "검사 케이스와 수검자(내담자)의 연결을 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_assessment_package_handler": "검사 패키지를 이름·가격대·활성 여부로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_assessment_session_handler": "검사 회기(실시 일자·시간)를 상태·기간으로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_billable_handler": "청구·결제 내역을 상태·기간·금액·미납 여부로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_credit_balance_handler": "센터의 현재 AI 크레딧 잔액을 요금제·한도·사용량으로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_case_handler": "상담 케이스를 담당자·프로그램·상태·기간·client_id로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_center_voucher_handler": "센터 취급 바우처(카탈로그 연결)를 활성 여부·단가·기본 회기수로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_client_handler": "내담자를 이름·연락처·상태·성별·생년월일로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_client_voucher_handler": "내담자 보유 바우처를 내담자·센터바우처·회기 잔여·금액 잔여·유효기간으로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_counseling_note_handler": "상담 노트를 내담자·작성자·키워드·기간으로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_counseling_participant_handler": "상담 케이스와 참여자(내담자·상담사)의 연결을 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_counseling_session_handler": "상담 회기를 상태·회기번호·기간·client_id로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_document_handler": "문서(파일)를 이름·유형·공개범위·기간으로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_field_note_handler": "필드노트(상담 녹음·전사)를 상태·키워드·기간·client_id로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_form_instance_handler": "작성·제출된 양식 건을 상태·템플릿·기간으로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_form_template_handler": "양식 템플릿을 이름·활성 여부·버전으로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_institution_handler": "연계 기관을 이름·연락처로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_member_handler": "센터 구성원(직원·상담사)을 역할·상태·고용형태로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_member_invitation_handler": "직원 초대 현황을 상태·이름으로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_member_working_time_handler": "구성원(상담사)의 요일별 근무시간을 구성원·요일로 조회한다. 건수·합계는 aggregate 값을 읽는다. 휴무·비근무 예외는 포함하지 않는다.",
    "query_message_log_handler": "문자·알림톡 발송 기록을 유형·상태·수신자·템플릿·시도횟수·기간으로 조회한다. 건수·합계는 aggregate 값을 읽는다. 발송 기록 조회만 — 재발송·발송 실행은 불가.",
    "query_notice_handler": "공지를 분류·키워드·고정·기간으로 조회한다. 건수·합계는 aggregate 값을 읽는다. 발행된 공지만 조회된다 — 미발행 초안은 나오지 않는다.",
    "query_notification_handler": "내 알림을 조회한다 — 목록과 안 읽은 개수. 건수·합계는 aggregate 값을 읽는다.",
    "query_operating_time_handler": "센터 운영시간(요일별 개점·마감·휴게)을 요일로 조회한다. 건수·합계는 aggregate 값을 읽는다. 휴무일·비운영 예외는 포함하지 않는다.",
    "query_payment_handler": "결제 내역을 청구서·결제수단·금액·결제일·영수증번호로 조회한다. 건수·합계는 aggregate 값을 읽는다. 청구서 이름은 query_billable로 id를 얻어 billable_id로 전달한다.",
    "query_price_list_handler": "서비스 가격표를 유형·이름·가격대로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_program_handler": "프로그램 카탈로그를 이름·유형·가격대로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
    "query_room_handler": "상담실을 이름·활성 여부로 조회한다. 건수·합계는 aggregate 값을 읽는다. 상담실로 내담자를 거를 수 없다 — 내담자 기준은 query_client_handler로.",
    "query_schedule_handler": "일정(캘린더)을 기간·유형·담당자·룸으로 조회한다. 건수·합계는 aggregate 값을 읽는다. 일정으로는 내담자를 직접 거를 수 없다 — 내담자 기준은 query_counseling_session_handler(client_id)로.",
    "query_schedule_change_request_handler": "일정 변경 요청을 상태·일정·내담자·요청시각·기간으로 조회한다. 건수·합계는 aggregate 값을 읽는다. 내담자·일정 이름은 query_client·query_schedule로 id를 얻어 전달한다.",
    "query_subscription_handler": "센터 구독을 요금제·상태·갱신 기간·체험 만료로 조회한다. 건수·합계는 aggregate 값을 읽는다.",
}


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    kind: str  # "read" | "ask" | "write" | "prefill"
    input_schema: dict[str, Any]
    permission: str | None = None  # None=멤버십만. 진입 필터는 engine 조립에서
    handler: Any = None  # 실행 대상 — read/write 공용 (application handler callable)
    defer: bool = False  # True면 컨텍스트에 미리 안 실림 — tool search로 발견
    confirm_label: str = ""


ASK_USER = ToolSpec(
    name="ask_user",
    kind="ask",
    description=(
        "사용자에게 한 가지를 되물을 때 사용합니다. 동명이인 등 후보가 여럿이라 하나를 골라야 하거나, "
        "요청이 모호해 확인이 필요할 때. options에 후보를 넣으면 선택지로, 없으면 자유 텍스트로 답을 받습니다."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "question": {"type": "string", "description": "사용자에게 보여줄 질문"},
            "options": {
                "type": "array",
                "items": {"type": "string"},
                "description": "선택지 (없으면 자유 텍스트 입력)",
            },
        },
        "required": ["question"],
    },
)


# 카탈로그에 없는 기능·화면 요청의 출구. 도구 없이는 모델이 근처 prefill을 대신 열거나
# 가짜 링크를 만든다(WUI 2건·격리 실측 오이동 7/18) — 표면의 폐쇄성이 어느 도구의 락에도
# 안 걸리는 사각이었다. 거절을 프로즈가 아니라 도구로 두는 이유는 **기록**이다: 어떤 부재
# 기능이 얼마나 요청되는지가 turn events에 남아 다음 화면 신설의 근거가 된다(파생층 텔레메트리).
# 계보 주의 — laguna는 이 도구를 recall 10%로 거의 안 불렀다(D3·D4에서 기각). 현행
# gemini-3.1-flash-lite 재측정에서 recall 18/18·정상 요청 오발동 0/39(absent-surface E5~E7).
# 모델 교체 시 이 수치부터 다시 잰다.
REPORT_UNSUPPORTED = ToolSpec(
    name="report_unsupported_handler",
    kind="unsupported",
    description=(
        "[핵심 목적]: 요청받은 기능·화면이 이 시스템에 없을 때 그 사실을 사용자에게 알린다. "
        "[관련 키워드]: 미지원, 지원하지 않음, 기능 없음, 화면 없음, 대신 안내\n"
        "[차별점/주의]: 조회·화면 열기를 하지 않는다 — 없는 기능임을 알릴 때만 호출한다. "
        "값이 부족해 못 하는 경우(되물음)나 권한이 없는 경우는 대상이 아니다."
    ),
    input_schema={
        "type": "object",
        "properties": {
            # title = query 24종과 동일 관례(ask_user만 description) — E5~E7이 검증한 형태
            "requested": {"type": "string", "title": "사용자가 요청한 기능·화면"},
            "alternative": {"type": "string", "title": "사용자가 직접 갈 메뉴·경로"},
        },
        "required": ["requested"],
    },
)


_cache: list[ToolSpec] | None = None


def assistant_specs() -> list[ToolSpec]:
    """레지스트리에서 tool 전부 + ask_user. 첫 호출 때 핸들러 전량 import(이후 캐시)."""
    global _cache
    if _cache is None:
        # lazy: 핸들러 패키지 전체 walk — import 시점 비용을 조립 시점으로
        from app.core.tool_loader import to_anthropic_tool
        from app.core.tool_registry import iter_tool_modules

        # request_form 스코프 제외(2026-07-27 사용자 결정) — 등록·수정 값 수집이 prefill 화면
        # 일원화를 침식(값0 발화 0/6 프롬프트 저항 실측). 정의는 재론 대비 보존
        specs = [ASK_USER, REPORT_UNSUPPORTED]
        for tool, handler in iter_tool_modules():
            perm = tool.get(
                "permission"
            )  # 없음 = 멤버십만 (app 표면 등 TOOL 3종이 미보유)
            # prefill = page_path 마커 — write 권한이나 DB write 아님(항상 노출, 프론트 화면 채움)
            if tool.get("page_path"):
                api = to_anthropic_tool(tool, defer_loading=False)
                specs.append(
                    ToolSpec(
                        name=tool["name"],
                        description=api["description"],
                        kind="prefill",
                        input_schema=api["input_schema"],
                        permission=perm,
                        handler=handler,
                        defer=False,
                    )
                )
                continue
            is_write = (perm or "").startswith(("write:", "delete:"))
            api = to_anthropic_tool(tool, defer_loading=is_write)
            specs.append(
                ToolSpec(
                    name=tool["name"],
                    description=api["description"],
                    kind="write" if is_write else "read",
                    input_schema=api["input_schema"],
                    permission=perm,
                    handler=handler,
                    defer=is_write,
                    confirm_label=tool["purpose"] if is_write else "",
                )
            )
        _cache = specs
    return _cache


def _in_scope(spec: ToolSpec) -> bool:
    """agent 표면 스코프 (2026-07-23 사용자 결정 — system-prompt-finalization loop):
    조회 = query_* / 생성·수정 = prefill 폼 / 응답 = ask. 비-query read·직접 write는 전면 제외.
    OpenRouter 경유 모델은 defer가 평載되므로(전 도구 노출), 스코프는 defer가 아니라 목록에서 뺀다."""
    if spec.kind in ("ask", "prefill", "unsupported"):
        return True
    return spec.kind == "read" and spec.name.startswith("query_")


def _with_group_by(spec: ToolSpec) -> ToolSpec:
    """적격 query에 group_by enum + E5 when 주입 (handler TOOL과 병합 — enum 합침)."""
    dims = GROUP_BY_DIMS.get(spec.name)
    if not dims:
        return spec
    schema = copy.deepcopy(spec.input_schema)
    props = schema.setdefault("properties", {})
    existing = props.get("group_by") or {}
    enum = list(dict.fromkeys([*(existing.get("enum") or []), *dims]))
    props["group_by"] = {
        **_GB_PROP_BASE,
        **{k: v for k, v in existing.items() if k not in ("enum", "description", "title")},
        "enum": enum,
    }
    # diet 직후 스펙은 when 없음 — 공통 E5 + status 보강만 붙인다
    desc = (spec.description or "") + GROUP_BY_WHEN
    if "status" in dims:
        desc = desc + GROUP_BY_WHEN_STATUS
    return replace(spec, input_schema=schema, description=desc)


def specs_for(permissions: tuple[str, ...]) -> list[ToolSpec]:
    """스코프 안 도구만 노출 — 보유 권한 밖은 defer로 낮춘다(Anthropic 검색용; OR 평載 모델은 목록 스코프).

    권한 밖 도구도 노출해 모델이 호출을 시도하면 Executor의 권한 검사가 "기능 없음"이 아닌
    "권한 없음"을 사실로 피드백한다.
    """
    out = [
        s
        if s.permission is None or s.permission in permissions
        else replace(s, defer=True)
        for s in assistant_specs()
        if _in_scope(s)
    ]
    out = [replace(s, description=_R_DESC.get(s.name) or " ".join(_SENT.split(s.description)[:2]))
           for s in out]
    # group_by 표면 — diet 이후 주입(설명·enum이 LLM에 보이게)
    out = [_with_group_by(s) for s in out]
    return out
