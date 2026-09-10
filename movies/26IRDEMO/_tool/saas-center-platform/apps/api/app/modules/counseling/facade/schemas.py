from datetime import datetime, date
from pydantic import BaseModel, Field


class ParticipantInput(BaseModel):
    participant_id: str = Field(description="참여자 ID (Person UUID)")
    participant_type: str = Field(description="역할 (client, counselor)")


class CaseParticipantDTO(BaseModel):
    participant_type: str = Field(description="역할 (client, counselor)")
    participant_id: str = Field(description="참여자 ID")
    is_active: bool = Field(default=True, description="활성 여부")
    left_at: datetime | None = Field(default=None, description="탈퇴 시각")


class ClientDetailForCase(BaseModel):
    client_id: str = Field(description="Client ID")
    name: str = Field(description="이름")
    birth_date: date | None = Field(default=None, description="생년월일")
    age: int | None = Field(default=None, description="만 나이")
    gender: str | None = Field(default=None, description="성별")


class CounselorDetailForCase(BaseModel):
    member_id: str = Field(description="Member ID")
    person_id: str = Field(description="Person ID")
    name: str = Field(description="이름")


class SessionDetailForCase(BaseModel):
    session_id: str = Field(description="Session ID")
    session_number: int = Field(description="회기 번호 (1부터 시작)")
    schedule_id: str = Field(description="Schedule ID")
    start: datetime = Field(description="시작 시간")
    end: datetime = Field(description="종료 시간")
    room_id: str | None = Field(default=None, description="Room ID")
    room_name: str | None = Field(default=None, description="Room 이름")
    status: str = Field(description="Session 상태")


class CaseDetailFullDTO(BaseModel):
    case_id: str = Field(description="Case ID")
    case_code: str = Field(description="Case 코드")
    status: str = Field(description="Case 상태")
    chief_complaint: str | None = Field(default=None, description="주호소")
    memo: str | None = Field(default=None, description="메모")
    total_sessions: int = Field(description="총 회기 수")

    program_id: str = Field(description="Program ID")
    program_name: str = Field(description="Program 이름")
    case_type: str = Field(description="케이스 타입 (individual/group)")

    clients: list[ClientDetailForCase] = Field(
        default_factory=list, description="내담자 목록"
    )
    counselor: CounselorDetailForCase = Field(description="담당 상담사")

    sessions: list[SessionDetailForCase] = Field(
        default_factory=list, description="회기 목록"
    )
    first_session_start: datetime | None = Field(
        default=None, description="첫 회기 시작 시간"
    )
    room_name: str | None = Field(default=None, description="첫 회기 Room 이름")

    created_at: datetime = Field(description="생성 시각")
    updated_at: datetime = Field(description="수정 시각")
    completed_at: datetime | None = Field(default=None, description="완료 시각")


class ClientSummaryForList(BaseModel):
    client_id: str = Field(description="Client ID")
    name: str = Field(description="이름")
    birth_date: date | None = Field(default=None, description="생년월일")
    age: int | None = Field(default=None, description="만 나이")
    gender: str | None = Field(default=None, description="성별")


class CaseListItemDTO(BaseModel):
    case_id: str = Field(description="Case ID")
    case_code: str = Field(description="Case 코드")
    status: str = Field(description="Case 상태")
    case_type: str = Field(description="케이스 타입")
    program_name: str | None = Field(default=None, description="Program 이름")
    clients: list[ClientSummaryForList] = Field(
        default_factory=list, description="내담자 요약 목록"
    )
    counselor_name: str | None = Field(default=None, description="담당 상담사 이름")
    completed_sessions: int = Field(description="완료된 회기 수")
    total_sessions: int = Field(description="총 회기 수")
    created_at: datetime = Field(description="생성 시각")


class UnloggedSession(BaseModel):
    session_id: str
    completed_at: datetime


class TodaySession(BaseModel):
    session_id: str
    start: datetime


# program/counselor/participants 일치 최근 케이스의 첫 회기 schedule_id만 반환 —
# 일정(시작·장소) 일치 최종 판정은 Application Handler가 ScheduleFacade로 수행.
class DuplicateCaseCandidate(BaseModel):
    case_code: str | None
    first_schedule_id: str
