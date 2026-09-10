"""HTP (House-Tree-Person) 검사 모델"""
from sqlalchemy import Boolean, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import BaseModel


class HTPDrawing(BaseModel):
    """HTP 그림 (검사당 4개: house, tree, man, woman)"""

    __tablename__ = "htp_drawings"

    examination_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True, comment="검사 ID"
    )
    category: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="그림 유형: house|tree|man|woman"
    )
    image_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="표시 이미지 경로 (분석 후 전처리 이미지)"
    )
    original_image_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="원본 이미지 경로 (업로드 원본)"
    )
    image_width: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="원본 이미지 너비 (px)"
    )
    image_height: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="원본 이미지 높이 (px)"
    )
    pdi_data: Mapped[list | None] = mapped_column(
        JSONB, nullable=True, comment="PDI 데이터: [{question, answer}]"
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="정렬 순서 (0=house, 1=tree, 2=man, 3=woman)"
    )


class HTPObject(BaseModel):
    """HTP 탐지 객체 (그림별 여러 개)"""

    __tablename__ = "htp_objects"

    drawing_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True, comment="그림 ID"
    )
    examination_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True, comment="검사 ID (비정규화)"
    )
    label: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="객체 레이블 (예: 집전체, 지붕, 문)"
    )
    bbox_data: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, comment="바운딩 박스: {points, confidence}"
    )
    confidence: Mapped[float | None] = mapped_column(
        Float, nullable=True, comment="탐지 신뢰도 (0.0~1.0)"
    )
    main_cond: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="주 분석 조건 (크기, 굵기, 위치 등)"
    )
    sub_cond: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="세부 분석 값 (크다, 작다 등)"
    )
    is_manual: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, comment="수동 추가 여부 (임상가가 직접 추가)"
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="정렬 순서"
    )


class HTPInterpretation(BaseModel):
    """HTP 해석 결과"""

    __tablename__ = "htp_interpretations"

    examination_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True, comment="검사 ID"
    )
    drawing_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True, index=True, comment="그림 ID (NULL이면 전체 해석)"
    )
    object_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True, comment="연결된 객체 ID"
    )
    main_category: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="주 카테고리: 자기개념|정서적 안정성|대인관계"
    )
    sub_category: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="하위 카테고리 (예: 자아상, 자아강도)"
    )
    sentence: Mapped[str] = mapped_column(
        Text, nullable=False, comment="해석 문장"
    )
    target_name: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="복합 해석 대상 객체명"
    )
    is_important: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, comment="중요 소견 여부 (임상가 표시)"
    )
    is_safety: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, comment="안전/안정 지�� 여부"
    )
    is_compound: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, comment="복합 해석 여부 (다중 객체)"
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="정렬 순서"
    )
