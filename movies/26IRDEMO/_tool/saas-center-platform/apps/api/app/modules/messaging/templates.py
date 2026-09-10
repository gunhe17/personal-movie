"""Message Templates

템플릿 함수로 메시지 생성 (타입 안전, Git 버전 관리)
"""

from datetime import datetime


def assessment_report_ready_template(
    center_name: str,
    recipient_name: str,
    assessment_name: str,
) -> tuple[str, str]:
    message = f"""[{center_name}]

안녕하세요, {recipient_name}님.

{assessment_name} 검사 결과가 준비되었습니다.

상담센터 홈페이지에서 확인하실 수 있습니다.

감사합니다."""

    template_code = "ASSESSMENT_READY_01"

    return message, template_code


def counseling_session_booked_template(
    center_name: str,
    recipient_name: str,
    counselor_name: str,
    session_date: datetime,
) -> tuple[str, str]:
    date_str = session_date.strftime("%Y년 %m월 %d일 %H:%M")

    message = f"""[{center_name}]

{recipient_name}님, 상담 예약이 확정되었습니다.

■ 일시: {date_str}
■ 상담사: {counselor_name}

감사합니다."""

    template_code = "COUNSELING_BOOKED_01"

    return message, template_code


def session_reminder_template(
    center_name: str,
    recipient_name: str,
    session_date: datetime,
) -> tuple[str, str]:
    date_str = session_date.strftime("%Y년 %m월 %d일 %H:%M")

    message = f"""[{center_name}]

{recipient_name}님, 상담 일정 안내드립니다.

■ 일시: {date_str}

기억해주세요!"""

    template_code = "SESSION_REMINDER_01"

    return message, template_code


def assessment_result_send_template(
    center_name: str,
    recipient_name: str,
    result_url: str,
    verification_code: str,
) -> tuple[str, str]:
    message = f"""[{center_name}]

안녕하세요, {recipient_name}님.

검사 결과가 준비되었습니다.
아래 링크에서 인증번호를 입력하시면 결과를 확인하실 수 있습니다.

■ 결과 확인: {result_url}
■ 인증번호: {verification_code}

감사합니다."""

    template_code = "RESULT_SEND_01"

    return message, template_code


def appointment_confirmation_sms_template(
    center_name: str,
    recipient_name: str,
    appointment_type: str,
    appointment_date: datetime,
) -> tuple[str, None]:
    date_str = appointment_date.strftime("%Y.%m.%d %H:%M")

    message = (
        f"[{center_name}] {recipient_name}님, {appointment_type} 예약이 "
        f"확정되었습니다. 일시: {date_str}"
    )

    template_code = None  # SMS는 템플릿 코드 없음

    return message, template_code
