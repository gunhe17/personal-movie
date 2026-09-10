from datetime import datetime
from pydantic import BaseModel

from ..profile.schemas import ClientSummary


class ClientSignal(BaseModel):
    # 캐러셀/Attention 카드에 표시할 한 줄 액션 안내 + 퀵 액션 target.
    #
    # 상담사가 해당 내담자에 대해 "지금 해야 할 일"을 한 가지로 압축.
    # 여러 신호가 동시 발생해도 우선순위 기반으로 1개만 선택(캐러셀) 또는
    # 전부 노출(내담자 상세 Attention).
    #
    # target 필드는 모바일에서 신호 탭 시 적절한 시트/페이지를 즉시 띄우기 위한
    # 힌트. type별 채워지는 필드:
    # - session_today, log_missing: session_id, session_start
    # - assessment_result_ready: assessment_case_id
    # - billing_unpaid: 모두 None (Alert 처리)

    type: str       # 'session_today' | 'log_missing' | 'assessment_result_ready' | 'billing_unpaid'
    icon_name: str  # ionicon 이름 (모바일이 그대로 사용)
    detail: str     # "오늘 14:00 상담" 같은 상황 요약
    action: str     # "확인해 주세요" 같은 액션 안내

    # 퀵 액션 target (모바일이 시트 즉시 띄울 때 사용)
    session_id: str | None = None
    session_start: datetime | None = None
    assessment_case_id: str | None = None


class FavoriteClientSummary(ClientSummary):
    signal: ClientSignal | None = None


class ClientFavoriteResponse(BaseModel):
    id: str
    person_id: str
    client_id: str
    center_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ClientFavoriteListResponse(BaseModel):
    # 관심 내담자 요약 + 신호 목록 응답 (최신순)
    #
    # 캐러셀에서 별도 detail 호출 없이 한 번에 표시 + 액션 신호까지 포함.

    items: list[FavoriteClientSummary]
    total: int
    page: int
    size: int
    pages: int


class ClientSignalListResponse(BaseModel):
    # 단일 내담자의 활성 신호 통합 리스트 — 우선순위 순.
    #
    # 내담자 상세 Attention 카드용. 같은 신호가 홈에서도 노출될 수 있으나
    # 상세에서는 "처리" 컨텍스트(인물 안)이고 홈은 "발견" 컨텍스트(횡단).

    items: list[ClientSignal]
    total: int
    page: int
    size: int
    pages: int
