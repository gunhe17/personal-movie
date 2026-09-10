from typing import Type
from .protocol import AssessmentEngine
from .exceptions import EngineNotFoundError
from app.core.logger import get_logger


logger = get_logger(__name__)


class EngineRegistry:
    _instance = None
    _engines: dict[str, Type[AssessmentEngine]] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def register(self, engine_class: Type[AssessmentEngine]) -> None:
        temp = engine_class()
        code = temp.code

        if code in self._engines:
            logger.warning("engine 중복 등록 무시: %s", code)
            return

        self._engines[code] = engine_class

    def get(self, code: str) -> AssessmentEngine:
        engine_class = self._engines.get(code)

        if not engine_class:
            raise EngineNotFoundError(f"No engine found for code: {code}")

        return engine_class()

    def has(self, code: str) -> bool:
        return code in self._engines

    def list_all(self) -> list[dict]:
        result = []
        for code, engine_class in self._engines.items():
            temp = engine_class()
            result.append({"code": code, "name": temp.name})
        return result


registry = EngineRegistry()
