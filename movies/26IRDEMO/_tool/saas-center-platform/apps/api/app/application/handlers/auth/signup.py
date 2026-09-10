from fastapi import Request

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.token.factory import get_token
from app.core.logger import get_logger
from app.modules.auth.facade import AuthFacade
from app.modules.event import emit
from app.modules.auth.schemas import (
    SignupRequest,
    SignupResponse,
    AccountSummary,
    PersonSummary,
)

logger = get_logger(__name__)


async def signup_handler(
    data: SignupRequest,
    request: Request,
    uow: UnitOfWork,
    *,
    event_group_id: str,
) -> SignupResponse:
    device_info = request.headers.get("User-Agent")
    ip_address = request.client.host if request.client else None

    logger.info(f"회원가입 시도: email={data.email}, ip={ip_address}")

    auth_facade = AuthFacade(uow)
    result = await auth_facade.signup(
        email=data.email,
        password=data.password,
        device_info=device_info,
        ip_address=ip_address,
    )

    from app.modules.person.facade import PersonFacade

    person_atomic, person = await PersonFacade(uow).create_person(
        account_id=result.account.id,
        name=data.person.name,
        phone=data.person.phone,
        birth=data.person.birth,
        gender=data.person.gender,
    )

    await emit(
        uow,
        "account_created",
        event_group_id=event_group_id,
        atomics=[*result.atomics, person_atomic],
        actor_id=person.id,
    )

    access_token = get_token().create_access_token(
        data={
            "account_id": result.account.id,
            "person_id": person.id,
            "email": result.account.email,
        }
    )

    response = SignupResponse(
        account=AccountSummary.model_validate(result.account),
        person=PersonSummary.model_validate(person),
        access_token=access_token,
        refresh_token=result.refresh_token,
        token_type="Bearer",
        expires_in=1800,  # 30분
    )

    logger.info(
        f"회원가입 성공: account_id={result.account.id}, "
        f"person_id={person.id}, email={data.email}"
    )

    return response


TOOL = {
    "name": "signup_handler",
    "agent_exposed": False,
    "permission": None,
    "purpose": "이메일·비밀번호와 개인정보로 새 계정을 생성하고, 가입과 동시에 로그인 토큰을 발급한다.",
    "keywords": [
        "회원가입",
        "가입",
        "계정 생성",
        "회원 등록",
        "신규 가입",
        "사인업",
        "signup",
        "계정 만들기",
    ],
    "boundaries": "신규 계정 생성 전용이다. 기존 계정 로그인은 login_handler를 쓴다. 가입 시 개인정보(이름·전화·생년월일·성별)가 함께 등록되며, 성공하면 곧바로 로그인 상태가 된다.",
    "output": "생성된 계정과 로그인 토큰 (SignupResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "email": {
                "format": "email",
                "title": "이메일",
                "type": "string",
                "description": "가입 이메일.",
            },
            "password": {
                "description": "비밀번호(8~72자, 영문자+숫자 조합).",
                "maxLength": 72,
                "minLength": 8,
                "title": "비밀번호",
                "type": "string",
            },
            "person": {
                "$ref": "#/$defs/PersonCreateForSignup",
                "description": "가입자 인적 정보(이름·전화 등).",
            },
        },
        "$defs": {
            "PersonCreateForSignup": {
                "example": {
                    "birth": "1990-05-15",
                    "gender": "male",
                    "name": "김철수",
                    "phone": "010-1234-5678",
                },
                "properties": {
                    "name": {
                        "maxLength": 100,
                        "minLength": 1,
                        "title": "Name",
                        "type": "string",
                    },
                    "phone": {
                        "maxLength": 20,
                        "minLength": 1,
                        "title": "Phone",
                        "type": "string",
                    },
                    "birth": {
                        "anyOf": [
                            {"format": "date", "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "title": "Birth",
                    },
                    "gender": {
                        "anyOf": [
                            {"pattern": "^(male|female)$", "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "title": "Gender",
                    },
                },
                "required": ["name", "phone"],
                "title": "PersonCreateForSignup",
                "type": "object",
            }
        },
        "required": ["email", "password", "person"],
    },
}
