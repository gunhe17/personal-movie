from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import CreditRateConfigResponse


async def change_credit_rate_handler(
    tokens_per_credit: int,
    reason: str | None,
    changed_by: str | None,
    uow: UnitOfWork,
) -> CreditRateConfigResponse:
    from app.modules.llm.credit_rate_config.repository import CreditRateConfigRepository
    from app.modules.llm.credit_rate_config.services import ChangeRateService

    repo = uow.repo(CreditRateConfigRepository)
    svc = ChangeRateService(repo)
    new_config = await svc.execute(
        new_rate=tokens_per_credit,
        changed_by=changed_by,
        reason=reason,
    )
    return CreditRateConfigResponse(
        tokens_per_credit=new_config.tokens_per_credit,
        effective_from=new_config.effective_from,
        changed_by=new_config.changed_by,
        reason=new_config.reason,
    )


TOOL = {
    "name": 'change_credit_rate_handler',
    "permission": None,
    "purpose": '토큰당 크레딧 환산율(몇 토큰을 1크레딧으로 칠지)을 새 값으로 변경한다.',
    "keywords": ['환산율 변경', '크레딧 환율 수정', '토큰당 크레딧 조정', '요금 변경', '차감 비율 변경', '단가 수정', '환율 업데이트', '크레딧 정책 변경'],
    "boundaries": '환산율 설정을 새로 적용(쓰기)하는 운영자 전용 도구다. 현재 적용값을 읽기만 하려면 get_credit_rate_config_handler를 쓴다. 이건 전역 환율 정책을 바꾸는 것이지 특정 센터의 잔액을 충전/초기화하는 게 아니다 — 그건 initialize_credit_handler가 한다. 일반 사용자는 호출할 수 없다.',
    "output": '적용된 환산율 설정 (CreditRateConfigResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'tokens_per_credit': {'type': 'integer', 'title': '토큰당 크레딧 환산율', 'description': '1크레딧으로 환산할 토큰 수. 값이 클수록 같은 작업의 크레딧 소모가 줄어든다 (예: 2000 = 2000토큰당 1크레딧).'},
            'reason': {'type': 'string', 'title': '변경 사유', 'description': '환율을 변경하는 사유. 변경 이력에 기록된다 (선택).'},
            'changed_by': {'type': 'string', 'title': '변경자', 'description': '변경을 수행한 운영자의 식별자 (선택).'},
        },
        "required": ['tokens_per_credit'],
    },
}
