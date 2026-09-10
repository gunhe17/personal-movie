from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Callable


class Scheduler(ABC):
    @abstractmethod
    def start(self, register_jobs: Callable | None = None) -> None: ...

    @abstractmethod
    def stop(self) -> None: ...
