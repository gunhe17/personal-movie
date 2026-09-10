from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage.common.base import StorageClient
from app.modules.event import emit
from app.modules.assessment.send_result.events import SendResultAccessAtomic
from app.modules.assessment.send_result.schemas import (
    ReportDownload,
    VerifyResponse,
)

PRESIGNED_URL_EXPIRES = 3600  # 1시간


async def verify_send_result_handler(
    send_result_id: str,
    verification_code: str,
    uow: UnitOfWork,
    storage: StorageClient,
    *,
    event_group_id: uuid_str,
) -> VerifyResponse:
    from app.modules.assessment.facade import SendResultFacade
    from app.modules.document.facade import DocumentFacade

    facade = SendResultFacade(uow)
    try:
        verified = await facade.verify_and_collect_reports(
            send_result_id=send_result_id,
            verification_code=verification_code,
        )
    except InvalidOperationException as exc:
        # 공개 수신자 인증 실패 = 보안 감사 사실. reject 전에 emit해 failed_attempts와 함께 커밋.
        await emit(
            uow,
            "assessment_send_result_verification_failed",
            event_group_id=event_group_id,
            atomics=[
                SendResultAccessAtomic.verification_failed(
                    send_result_id=send_result_id
                )
            ],
            actor_type="guest",
        )
        # 인증 실패도 failed_attempts 증가분을 보존 — reject = commit + raise
        await uow.reject(exc)

    # 성공 = guest가 민감 보고서에 접근 — 개인정보 접근 감사
    await emit(
        uow,
        "assessment_send_result_verified",
        event_group_id=event_group_id,
        atomics=[
            SendResultAccessAtomic.verified(
                send_result_id=send_result_id,
                completed_count=len(verified.completed),
                pending_count=len(verified.pending),
            )
        ],
        center_id=verified.center_id,
        actor_type="guest",
    )

    reports: list[ReportDownload] = []
    if verified.completed:
        document_ids = [r.report_document_id for r in verified.completed]
        documents = await DocumentFacade(uow).get_documents_by_ids(
            document_ids, verified.center_id
        )
        doc_map = {d.id: d for d in documents}

        for ref in verified.completed:
            doc = doc_map.get(ref.report_document_id)
            if not doc:
                continue
            download_url = await storage.get_presigned_url(
                path=doc.storage_path,
                expires_in=PRESIGNED_URL_EXPIRES,
            )
            reports.append(
                ReportDownload(
                    assessment_name=ref.assessment_name,
                    download_url=download_url,
                    expires_in=PRESIGNED_URL_EXPIRES,
                )
            )

    return VerifyResponse(reports=reports, pending=verified.pending)


TOOL = {
    "name": "verify_send_result_handler",
    "agent_exposed": False,
    "permission": None,
    "purpose": "검사 결과 열람을 위한 인증 코드를 확인한다.",
    "keywords": [
        "verify send result",
        "결과 인증",
        "검사 결과 확인 코드",
        "열람 인증",
        "verify 코드",
        "결과 비밀번호 확인",
    ],
    "boundaries": "검사 '결과 전송'의 열람 인증 코드를 검증한다(수신자 본인 확인). 결과 전송 자체는 create_send_result_handler.",
    "output": "인증 코드 검증 결과 (VerifyResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "send_result_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 결과 전송",
                "description": "인증할 결과 전송의 UUID.",
            },
            "verification_code": {
                "type": "string",
                "title": "인증 코드",
                "description": "수신자가 입력한 열람 인증 코드.",
            },
        },
        "required": ["send_result_id", "verification_code"],
    },
}
