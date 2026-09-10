from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..account.repository import AccountRepository


async def get_email_availability_handler(email: str, uow: UnitOfWork) -> dict:
    account_repo = uow.repo(AccountRepository)
    exists = await account_repo.exists_email(email)
    return {"available": not exists}


TOOL = {
    "name": "get_email_availability_handler",
    "permission": None,
    "purpose": "입력한 이메일 주소가 이미 가입에 사용되었는지 확인해 회원가입에 쓸 수 있는지 조회한다.",
    "keywords": [
        "이메일 중복 확인",
        "이메일 사용 가능",
        "아이디 중복 체크",
        "이메일 가입 여부",
        "이메일 등록됐나",
        "중복 검사",
        "이메일 쓸 수 있나",
        "가입 가능 이메일",
    ],
    "boundaries": "회원가입 전에 이메일이 비어 있는지(미등록인지)만 가볍게 조회하는 읽기 전용 도구다. 실제 계정을 만들려면 signup_handler를, 로그인 자격 증명을 확인하려면 login 핸들러를 쓴다. 이 도구는 계정을 생성하거나 인증하지 않고 사용 가능 여부(available)만 반환한다.",
    "output": "이메일 사용 가능 여부 (dict).",
    "input_schema": {
        "type": "object",
        "properties": {
            "email": {
                "type": "string",
                "format": "email",
                "title": "확인할 이메일",
                "description": "사용 가능 여부를 확인할 이메일 주소(예: user@example.com). 가입 폼에 입력한 값.",
            },
        },
        "required": ["email"],
    },
}
