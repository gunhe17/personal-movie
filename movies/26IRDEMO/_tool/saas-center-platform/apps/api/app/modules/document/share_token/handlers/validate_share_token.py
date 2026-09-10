from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import ShareTokenValidate, ShareTokenValidateResponse
from ..repository import ShareTokenRepository
from ..services import ValidateShareTokenService


async def validate_share_token_handler(
    data: ShareTokenValidate,
    uow: UnitOfWork,
) -> ShareTokenValidateResponse:
    # Repository 획득
    share_token_repo = uow.repo(ShareTokenRepository)

    # Service 실행 - 도메인 예외는 전역 핸들러가 자동 변환
    validate_service = ValidateShareTokenService(share_token_repo)
    share_token = await validate_service.execute(
        token=data.token, password=data.password
    )

    return ShareTokenValidateResponse(
        valid=True,
        document_id=share_token.document_id,
        message="Token is valid",
    )


TOOL = {
    "name": "validate_share_token_handler",
    "permission": None,
    "purpose": "공유 토큰의 유효성을 검증한다.",
    "keywords": ["공유 토큰 검증", "링크 유효성", "토큰 확인", "validate token"],
    "boundaries": "공유 토큰 유효성 확인(읽기). 다운로드는 download_with_share_token_handler.",
    "output": "공유 토큰 유효성 결과 (ShareTokenValidateResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "token": {
                "maxLength": 64,
                "title": "공유 토큰",
                "type": "string",
                "description": "검증할 공유 토큰 문자열.",
            },
            "password": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "비밀번호",
            },
        },
        "required": ["token"],
    },
}
