from typing import Protocol, runtime_checkable
from .types import ScoringResult, InterpretationResult


@runtime_checkable
class AssessmentEngine(Protocol):
    @property
    def code(self) -> str:
        """예: "SMARTPHONE_ADDICTION" """
        ...

    @property
    def name(self) -> str:
        """예: "스마트폰중독검사" """
        ...

    def validate_responses(self, responses: list[dict]) -> bool:
        ...

    def calculate_scores(self, responses: list[dict], context: dict | None = None) -> ScoringResult:
        """context: 내담자 정보 등 부가 데이터"""
        ...

    def interpret(self, scores: ScoringResult, context: dict | None = None) -> InterpretationResult:
        """context: 내담자 정보 등 부가 데이터"""
        ...
