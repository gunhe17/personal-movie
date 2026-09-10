# 공개 표면(인증 불필요) — 통과 시 링크 스코프 토큰(aud=assessment_link) 발급: 계정 없이 해당 링크의 검사만 조회·제출 가능
from datetime import timedelta

from app.core.exceptions import InvalidOperationException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.token.factory import get_token
from app.modules.assessment.send_link.schemas import (
    LinkTaskItem,
    LinkVerifyResponse,
)
from .collect_link_journals import collect_link_journals
from .collect_link_schedules import collect_link_schedules

ASSESSMENT_LINK_AUDIENCE = "assessment_link"
LINK_TOKEN_EXPIRES = timedelta(hours=2)


async def verify_send_link_handler(
    send_link_id: str,
    verification_code: str,
    uow: UnitOfWork,
) -> LinkVerifyResponse:
    from app.modules.assessment.facade import SendLinkFacade
    from app.modules.center.facade import MemberInvitationFacade

    async with uow:
        facade = SendLinkFacade(uow)
        try:
            verified = await facade.verify_and_collect_tasks(
                send_link_id=send_link_id,
                verification_code=verification_code,
            )
        except InvalidOperationException as exc:
            # 인증 실패도 failed_attempts 증가분을 보존 — reject = commit + raise
            await uow.reject(exc)

        send_link = verified.send_link
        center_name = await MemberInvitationFacade(uow).get_center_name(
            send_link.center_id
        )
        schedules, task_schedules = await collect_link_schedules(verified, uow)
        journals = await collect_link_journals(send_link, uow)

    recipients = send_link.recipients or []
    recipient_name = recipients[0].get("name") if recipients else None

    access_token = get_token().create_access_token(
        data={
            "send_link_id": send_link.id,
            "center_id": send_link.center_id,
            "case_id": send_link.case_id,
        },
        audience=ASSESSMENT_LINK_AUDIENCE,
        expires_delta=LINK_TOKEN_EXPIRES,
    )

    return LinkVerifyResponse(
        access_token=access_token,
        center_id=send_link.center_id,
        center_name=center_name,
        case_id=send_link.case_id,
        recipient_name=recipient_name,
        schedules=schedules,
        journals=journals,
        tasks=[
            LinkTaskItem(
                task_id=t.id,
                assessment_id=t.assessment_id,
                assessment_name=verified.assessment_names.get(
                    t.assessment_id, "검사"
                ),
                status=t.status,
                execution_method=t.execution_method,
                schedule_id=task_schedules.get(t.id),
                report_available=t.status == "completed" and bool(t.report_document_id) and t.is_report_visible_to_guardian,
            )
            for t in verified.tasks
        ],
    )



# #
# main

TOOL = {
    "permission": None,  # 멤버십만
    "name": "verify_send_link_handler",
    "purpose": "검사 링크(문자 수신)의 인증 코드를 확인하고 검사 수행 토큰을 발급한다.",
    "keywords": ["검사 링크 인증", "바로링크 확인 코드", "링크 인증번호", "verify 링크"],
    "boundaries": "검사 '링크 전송'의 수신자 본인 인증. 결과 열람 인증은 verify_send_result_handler.",
    "output": "링크 스코프 토큰 + 검사 목록 (LinkVerifyResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "send_link_id": {'type': 'string', 'format': 'uuid', 'title': '대상 링크 전송', 'description': '인증할 검사 링크 전송의 UUID.'},
            "verification_code": {'type': 'string', 'title': '인증 코드', 'description': '수신자가 입력한 4자리 인증 코드.'},
        },
        "required": ["send_link_id", "verification_code"],
    },
}

def main() -> dict:
    return TOOL
