from app.core.exceptions import EntityNotFoundException, InvalidOperationException


class StorageNotFoundError(EntityNotFoundException):
    pass


class StorageOperationError(InvalidOperationException):
    pass


class StorageProviderError(Exception):
    # 미매핑(500) — provider 호출 실패는 도메인 4xx가 아니다. 현행 raw 누출과 동일 status, 봉인만
    pass
