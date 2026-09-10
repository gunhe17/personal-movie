"""SCT Schemas — 요청/응답 DTO"""
from datetime import datetime

from pydantic import BaseModel, Field


# --- Stem (문항) ---

class SCTStem(BaseModel):
    id: int
    stem: str
    isCompound: bool = False
    domain: str
    domainLabel: str


class SCTStemListResponse(BaseModel):
    stems: list[SCTStem]
    totalCount: int


# --- Response (응답) ---

class SCTResponseItem(BaseModel):
    stemId: int
    answer: str
    reason: str | None = None
    answeredAt: datetime | None = None


class SCTResponseSubmit(BaseModel):
    """검사 진행 중 응답 저장"""
    responses: list[SCTResponseItem]


# --- Score (채점) ---

class SCTScoreItem(BaseModel):
    stemId: int
    stem: str
    score: int = Field(..., ge=0, le=6)
    answer: str | None = None
    reason: str | None = None


class SCTDomainScore(BaseModel):
    domain: str
    domainLabel: str
    totalScore: int
    maxScore: int
    items: list[SCTScoreItem]


class SCTScoreUpdate(BaseModel):
    """단일 문항 점수 수정 (임상가 검토)"""
    stemId: int
    score: int = Field(..., ge=0, le=6)


# --- 결과 (전체) ---

class SCTResultsData(BaseModel):
    responses: list[SCTResponseItem]
    scores: list[SCTDomainScore]
    completedCount: int
    totalCount: int


class SCTResultsResponse(BaseModel):
    """결과 조회 응답 (status 포함)"""
    examinationId: str
    status: str
    results: SCTResultsData | None = None
