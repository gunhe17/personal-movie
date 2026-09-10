"""HTP 검사 스키마 (Request/Response DTO)"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


# === 타입 ===

HTPCategory = Literal["house", "tree", "man", "woman"]
HTPMainCategory = Literal["자기개념", "정서적 안정성", "대인관계"]


# === 공통 ===

class PDIItem(BaseModel):
    """PDI (Post-Drawing Interrogation) 항목"""
    question: str
    answer: str


# === Request DTO ===

class HTPDrawingUpdate(BaseModel):
    """그림 수정 요청"""
    pdi_data: list[PDIItem] | None = None


class HTPObjectUpdate(BaseModel):
    """객체 수정/생성 요청 (id 없으면 신규 생성)"""
    id: str | None = None
    drawing_id: str | None = None  # 신규 생성 시 필수
    label: str | None = None
    bbox_data: dict | None = None
    main_cond: str | None = None
    sub_cond: str | None = None


class HTPInterpretationUpdate(BaseModel):
    """해석 수정 요청"""
    id: str
    main_category: HTPMainCategory
    sub_category: str
    sentence: str
    target_name: str | None = None
    is_important: bool = False
    is_safety: bool = False
    is_compound: bool = False


class HTPAnalyzeRequest(BaseModel):
    """AI 분석 요청"""
    drawing_ids: list[str] | None = None  # None이면 전체 분석


class HTPResultsUpdate(BaseModel):
    """결과 수정 요청 (임상가 편집)"""
    objects: list[HTPObjectUpdate] | None = None
    delete_object_ids: list[str] | None = None
    interpretations: list[HTPInterpretationUpdate] | None = None


class HTPToggleImportantRequest(BaseModel):
    """중요 소견 토글 요청"""
    interpretation_id: str
    is_important: bool


# === Response DTO ===

class HTPDrawingResponse(BaseModel):
    """그림 응답"""
    id: str
    examination_id: str
    category: HTPCategory
    image_url: str | None = None
    original_image_url: str | None = None
    image_width: int | None = None
    image_height: int | None = None
    pdi_data: list[PDIItem] | None = None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HTPObjectResponse(BaseModel):
    """객체 응답"""
    id: str
    drawing_id: str
    examination_id: str
    label: str
    bbox_data: dict | None = None
    confidence: float | None = None
    main_cond: str | None = None
    sub_cond: str | None = None
    is_manual: bool = False
    sort_order: int

    model_config = {"from_attributes": True}


class HTPInterpretationResponse(BaseModel):
    """해석 응답"""
    id: str
    examination_id: str
    drawing_id: str | None = None
    object_id: str | None = None
    main_category: str
    sub_category: str
    sentence: str
    target_name: str | None = None
    is_important: bool
    is_safety: bool
    is_compound: bool
    sort_order: int

    model_config = {"from_attributes": True}


class HTPDrawingWithObjectsResponse(HTPDrawingResponse):
    """그림 + 객체 응답 (HTPDrawingResponse 상속)"""
    objects: list[HTPObjectResponse] = []


class HTPImportantCarryOver(BaseModel):
    """재분석·재해석에서 별표(중요 소견)를 얼마나 이월했는지.

    해석은 재생성될 때 레코드가 통째로 새로 만들어져서, 임상가가 찍어 둔
    별표가 소리 없이 사라졌다. 같은 (그림·하위분류·문장)인 해석에는 다시
    붙이고, **못 붙인 개수는 화면이 임상가에게 알린다** — 조용히 사라지는
    것만은 막는다.
    """
    carried: int = 0   # 다시 붙인 별표 수
    lost: int = 0      # 대응하는 해석이 사라져 이월하지 못한 별표 수


class HTPFullResultsResponse(BaseModel):
    """HTP 전체 결과 응답"""
    examination_id: str
    status: str
    drawings: list[HTPDrawingWithObjectsResponse] = []
    interpretations: list[HTPInterpretationResponse] = []
    # 해석을 재생성한 응답(analyze·reinterpret)에서만 채워진다. 조회는 None.
    important_carry_over: HTPImportantCarryOver | None = None
    """탐지 결과가 해석보다 나중에 바뀌었는가 — '해석 다시 만들기'가 필요한 상태.

    화면 로컬 상태로 두면 결과 화면에 다녀오거나 새로고침하는 순간 사라진다.
    좌표는 서버에 저장돼 있는데 "다시 만들어야 한다"는 사실만 잃는 셈이라,
    판정을 서버로 옮긴다.
    """
    needs_reinterpret: bool = False
