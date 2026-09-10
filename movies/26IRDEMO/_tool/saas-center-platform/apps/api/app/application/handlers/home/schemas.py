from enum import Enum
from pydantic import BaseModel


class PrepSignalType(str, Enum):
    UNWRITTEN_JOURNALS = "unwritten_journals"
    FIRST_MEETING = "first_meeting"
    UNREVIEWED_ASSESSMENT = "unreviewed_assessment"
    PREVIOUS_NOTE_SUMMARY = "previous_note_summary"
    RETEST = "retest"
    ATTENDANCE_WARNING = "attendance_warning"
    FIELD_NOTE_SUMMARY = "field_note_summary"
    GROUP_MEMBER_CHANGE = "group_member_change"
    # 횡단 신호(스펙 §4) — 특정 일정이 아닌 상담사 단위 집계
    EXTENSION_NEEDED = "extension_needed"
    UNPAID_BILLING = "unpaid_billing"


class PrepSignalItem(BaseModel):
    signal_type: PrepSignalType
    priority: int
    label: str
    description: str | None = None
    metadata: dict | None = None


class PrepSignalsResponse(BaseModel):
    schedule_id: str
    signals: list[PrepSignalItem]


class HomeSignalsResponse(BaseModel):
    signals: list[PrepSignalItem]
