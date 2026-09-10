from enum import Enum


class TemplateType(str, Enum):
    ASSESSMENT_RESULT_SEND = "assessment_result_send"
    ASSESSMENT_SEND_LINK = "assessment_send_link"
    ASSESSMENT_REPORT_READY = "assessment_report_ready"
    COUNSELING_SESSION_BOOKED = "counseling_session_booked"
    SESSION_REMINDER = "session_reminder"
    APPOINTMENT_CONFIRMATION_SMS = "appointment_confirmation_sms"
    INVOICE_ISSUED = "invoice_issued"
    FORM_FILL_REQUEST = "form_fill_request"


class VariableDef:
    def __init__(self, key: str, label: str, required: bool = True):
        self.key = key
        self.label = label
        self.required = required

    def to_dict(self) -> dict:
        return {"key": self.key, "label": self.label, "required": self.required}


# 타입별 사용 가능 변수 정의
TEMPLATE_TYPE_VARIABLES: dict[TemplateType, list[VariableDef]] = {
    TemplateType.ASSESSMENT_RESULT_SEND: [
        VariableDef("center_name", "센터명"),
        VariableDef("recipient_name", "수신자명"),
        VariableDef("reservation_date", "예약 날짜", required=False),
        VariableDef("result_url", "결과 확인 링크"),
        VariableDef("verification_code", "인증번호"),
    ],
    TemplateType.ASSESSMENT_SEND_LINK: [
        VariableDef("center_name", "센터명"),
        VariableDef("recipient_name", "수신자명"),
        VariableDef("assessment_url", "바로링크"),
        VariableDef("verification_code", "인증번호"),
    ],
    TemplateType.ASSESSMENT_REPORT_READY: [
        VariableDef("center_name", "센터명"),
        VariableDef("recipient_name", "수신자명"),
        VariableDef("assessment_name", "검사명"),
    ],
    TemplateType.COUNSELING_SESSION_BOOKED: [
        VariableDef("center_name", "센터명"),
        VariableDef("recipient_name", "수신자명"),
        VariableDef("counselor_name", "상담사명"),
        VariableDef("session_date", "상담 일시"),
    ],
    TemplateType.SESSION_REMINDER: [
        VariableDef("center_name", "센터명"),
        VariableDef("recipient_name", "수신자명"),
        VariableDef("session_date", "상담 일시"),
    ],
    TemplateType.APPOINTMENT_CONFIRMATION_SMS: [
        VariableDef("center_name", "센터명"),
        VariableDef("recipient_name", "수신자명"),
        VariableDef("appointment_type", "예약 유형"),
        VariableDef("appointment_date", "예약 일시"),
    ],
    TemplateType.INVOICE_ISSUED: [
        VariableDef("center_name", "센터명"),
        VariableDef("recipient_name", "수신자명"),
        VariableDef("item_summary", "청구 항목 요약"),
        VariableDef("total_amount", "청구 금액"),
        VariableDef("due_date", "납부 기한", required=False),
    ],
    TemplateType.FORM_FILL_REQUEST: [
        VariableDef("center_name", "센터명"),
        VariableDef("recipient_name", "수신자명"),
        VariableDef("form_name", "양식명"),
        VariableDef("form_url", "작성 링크"),
    ],
}


# 타입별 시스템 기본 양식 이름
TEMPLATE_TYPE_NAMES: dict[TemplateType, str] = {
    TemplateType.ASSESSMENT_RESULT_SEND: "검사 결과 전송 (기본)",
    TemplateType.ASSESSMENT_SEND_LINK: "바로링크 전송 (기본)",
    TemplateType.ASSESSMENT_REPORT_READY: "검사 결과 준비 완료 (기본)",
    TemplateType.COUNSELING_SESSION_BOOKED: "상담 예약 확정 (기본)",
    TemplateType.SESSION_REMINDER: "상담 리마인더 (기본)",
    TemplateType.APPOINTMENT_CONFIRMATION_SMS: "예약 확인 SMS (기본)",
    TemplateType.INVOICE_ISSUED: "청구서 발행 알림 (기본)",
    TemplateType.FORM_FILL_REQUEST: "문서 작성 요청 (기본)",
}


# 하드코딩 폴백 기본 템플릿 내용
HARDCODED_DEFAULTS: dict[TemplateType, str] = {
    TemplateType.ASSESSMENT_RESULT_SEND: """[{center_name}]

안녕하세요, {recipient_name}님.

검사 결과가 준비되었습니다.
아래 링크에서 인증번호를 입력하시면 결과를 확인하실 수 있습니다.

■ 결과 확인: {result_url}
■ 인증번호: {verification_code}

감사합니다.""",
    TemplateType.ASSESSMENT_SEND_LINK: """[{center_name}]

안녕하세요, {recipient_name}님.

바로링크를 안내드립니다.
아래 링크에서 인증번호를 입력한 후 이용 가능한 검사와 안내를 확인해주세요.

■ 바로링크: {assessment_url}
■ 인증번호: {verification_code}

감사합니다.""",
    TemplateType.ASSESSMENT_REPORT_READY: """[{center_name}]

안녕하세요, {recipient_name}님.

{assessment_name} 검사 결과가 준비되었습니다.

상담센터 홈페이지에서 확인하실 수 있습니다.

감사합니다.""",
    TemplateType.COUNSELING_SESSION_BOOKED: """[{center_name}]

{recipient_name}님, 상담 예약이 확정되었습니다.

■ 일시: {session_date}
■ 상담사: {counselor_name}

감사합니다.""",
    TemplateType.SESSION_REMINDER: """[{center_name}]

{recipient_name}님, 상담 일정 안내드립니다.

■ 일시: {session_date}

기억해주세요!""",
    TemplateType.APPOINTMENT_CONFIRMATION_SMS: "[{center_name}] {recipient_name}님, {appointment_type} 예약이 확정되었습니다. 일시: {appointment_date}",
    TemplateType.INVOICE_ISSUED: """[{center_name}]

안녕하세요, {recipient_name}님.

청구서가 발행되었습니다.

■ 내역: {item_summary}
■ 금액: {total_amount}원
■ 납부기한: {due_date}

감사합니다.""",
    TemplateType.FORM_FILL_REQUEST: """[{center_name}]

안녕하세요, {recipient_name}님.

작성이 필요한 문서가 있어 안내드립니다.

■ 문서: {form_name}
■ 작성하기: {form_url}

아래 링크에서 내용을 확인하고 작성해주세요.

감사합니다.""",
}


# 타입별 하드코딩 template_code
HARDCODED_TEMPLATE_CODES: dict[TemplateType, str | None] = {
    TemplateType.ASSESSMENT_RESULT_SEND: "RESULT_SEND_01",
    TemplateType.ASSESSMENT_SEND_LINK: "TPDuXP9p9H",
    TemplateType.ASSESSMENT_REPORT_READY: "ASSESSMENT_READY_01",
    TemplateType.COUNSELING_SESSION_BOOKED: "COUNSELING_BOOKED_01",
    TemplateType.SESSION_REMINDER: "SESSION_REMINDER_01",
    TemplateType.APPOINTMENT_CONFIRMATION_SMS: None,
    TemplateType.INVOICE_ISSUED: None,
    TemplateType.FORM_FILL_REQUEST: None,
}
