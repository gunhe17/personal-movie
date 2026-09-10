from typing import TypedDict, Literal


class SubscaleScore(TypedDict):
    name: str
    code: str
    raw_score: float
    max_score: int


class ScoringResult(TypedDict):
    total_score: float
    max_total_score: int
    subscales: dict[str, SubscaleScore]
    metadata: dict


RiskLevel = Literal["low", "moderate", "high"]


class InterpretationResult(TypedDict):
    risk_level: RiskLevel
    risk_label: str
    summary: str
    description: str
    recommendations: list[str]
    subscales: dict[str, str]
