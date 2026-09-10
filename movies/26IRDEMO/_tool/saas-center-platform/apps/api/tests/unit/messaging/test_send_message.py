"""SendMessageService characterization — T1 실발송 경로의 계약 고정(리팩토링 전후 동일 green).

- 성공: PENDING 생성 → SENT 전이(lgu_message_id·sent_at), 클라이언트 1회 호출
- 실패: FAILED 전이(failed_at·error_message), 예외를 삼키고 로그 반환(발송 실패≠HTTP 실패)
- 채널 판별: alarmtalk=ALARMTALK+template_code / 90자 초과=LMS / 이하=SMS
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.core.type import unset
from app.modules.messaging.messaging.models import MessageStatus, MessageType
from app.modules.messaging.messaging.services.send_message import SendMessageService


class FakeRepo:
    def __init__(self):
        self.log = None
        self.add_kwargs = None

    async def add(self, **kwargs):
        self.add_kwargs = kwargs
        self.log = SimpleNamespace(
            id="log-1",
            lgu_message_id=None,
            sent_at=None,
            failed_at=None,
            error_message=None,
            **kwargs,
        )
        return self.log

    async def update_in_place(self, message_log_id, **fields):
        for k, v in fields.items():
            if v is not unset:
                setattr(self.log, k, v)
        return self.log

    async def flush(self):
        pass


def build(send_result=None, send_error=None):
    repo = FakeRepo()
    client = SimpleNamespace(
        send_message=AsyncMock(return_value=send_result, side_effect=send_error),
    )
    return SendMessageService(repo, client), repo, client


async def test_success_marks_sent():
    service, repo, client = build(
        send_result={"message_id": "lgu-1", "sent_at": "2026-07-08T00:00:00"},
    )

    log = await service.execute(
        center_id="c-1",
        channel="sms",
        recipient="01012345678",
        message="안녕하세요",
    )

    client.send_message.assert_awaited_once_with(
        channel="sms",
        recipient="01012345678",
        message="안녕하세요",
        template_code=None,
        title=None,
    )
    assert repo.add_kwargs["status"] == MessageStatus.PENDING
    assert repo.add_kwargs["message_type"] == MessageType.SMS
    assert log.status == MessageStatus.SENT
    assert log.lgu_message_id == "lgu-1"
    assert log.sent_at == "2026-07-08T00:00:00"


async def test_failure_marks_failed_without_raising():
    service, repo, client = build(send_error=RuntimeError("LGU down"))

    log = await service.execute(
        center_id="c-1",
        channel="sms",
        recipient="01012345678",
        message="안녕하세요",
    )

    assert log.status == MessageStatus.FAILED
    assert log.failed_at is not None
    assert "LGU down" in log.error_message


async def test_lms_when_over_90_chars():
    service, repo, _ = build(
        send_result={"message_id": "lgu-1", "sent_at": "t"},
    )

    await service.execute(
        center_id="c-1",
        channel="sms",
        recipient="01012345678",
        message="가" * 91,
    )

    assert repo.add_kwargs["message_type"] == MessageType.LMS


async def test_alarmtalk_keeps_template_code():
    service, repo, client = build(
        send_result={"message_id": "lgu-1", "sent_at": "t"},
    )

    await service.execute(
        center_id="c-1",
        channel="alarmtalk",
        recipient="01012345678",
        message="알림",
        template_code="TPL-1",
        title="제목",
    )

    assert repo.add_kwargs["message_type"] == MessageType.ALARMTALK
    assert repo.add_kwargs["template_code"] == "TPL-1"
    assert client.send_message.await_args.kwargs["template_code"] == "TPL-1"


async def test_send_refs_threaded_to_log():
    # form_send_id 등 발송 참조가 로그에 그대로 실려 배달이 발송 엔티티에 연결된다.
    service, repo, _ = build(send_result={"message_id": "lgu-1", "sent_at": "t"})

    await service.execute(
        center_id="c-1",
        channel="sms",
        recipient="01012345678",
        message="안녕",
        form_send_id="fs-1",
    )

    assert repo.add_kwargs["form_send_id"] == "fs-1"
    assert repo.add_kwargs["send_link_id"] is None
