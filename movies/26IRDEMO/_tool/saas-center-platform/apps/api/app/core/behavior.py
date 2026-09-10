from __future__ import annotations


class Memory:
    """runtime 파이프라인 컨텍스트 베이스. 활성 action 집합 + 서브클래스가 쓸 키(타입 속성)."""

    _active: set[type]

    def activate(self, action: type) -> None:
        self._active.add(action)

    def is_active(self, action: type) -> bool:
        return action in self._active


class Action:
    """파이프라인 단계. apply(memory)=활성화(+설정 주입), act(memory)=집행(각 action이 정의). apply 검사는 flow가 명시."""

    def apply(self, memory: Memory) -> None:
        memory.activate(type(self))

class Context:
    """핸들러 scope 마커 베이스 — 필드는 Behavior 주체별 서브클래스가 소유(server=ServerContext)."""


class Behavior:
    pass
