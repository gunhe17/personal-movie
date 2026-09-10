"""form 발송 배달 로그가 FormSend에 연결되고, 실패분만 조회되는지 — resend failed_only의 근거.

form_send_id 연결(assessment send_link_id 선례)로 발송 이력이 발송 엔티티에 귀속되고,
list_failed_by_form_send_id가 실패 수신자만 골라 재발송 대상을 좁힌다."""
from app.modules.messaging.messaging.models import MessageStatus, MessageType
from app.modules.messaging.messaging.repository import MessageLogRepository


async def _add(repo, *, recipient, status, form_send_id):
    return await repo.add(
        center_id="c-1",
        message_type=MessageType.SMS,
        recipient=recipient,
        message="m",
        status=status,
        form_send_id=form_send_id,
    )


async def test_form_send_delivery_linkage_and_failed_filter(test_session):
    repo = MessageLogRepository(test_session)

    # 발송 fs-1: 성공 1 + 실패 1
    await _add(repo, recipient="010aaaa", status=MessageStatus.SENT, form_send_id="fs-1")
    await _add(repo, recipient="010bbbb", status=MessageStatus.FAILED, form_send_id="fs-1")
    # 다른 발송 fs-2: 격리 확인용
    await _add(repo, recipient="010cccc", status=MessageStatus.FAILED, form_send_id="fs-2")
    await test_session.commit()

    # 배달 이력은 발송 엔티티(fs-1)에 귀속
    all_fs1 = await repo.list_by_form_send_id("fs-1")
    assert {m.recipient for m in all_fs1} == {"010aaaa", "010bbbb"}

    # 실패분만 → resend failed_only 대상
    failed_fs1 = await repo.list_failed_by_form_send_id("fs-1")
    assert {m.recipient for m in failed_fs1} == {"010bbbb"}
