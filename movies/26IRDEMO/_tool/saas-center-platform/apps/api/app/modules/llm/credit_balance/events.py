from dataclasses import dataclass

from app.core.type import uuid_str

from .models import CreditBalance


@dataclass(frozen=True, kw_only=True)
class CreditBalanceAtomic:
    _act: str
    balance: CreditBalance

    @classmethod
    def created(
        cls,
        *,
        balance: CreditBalance,
    ) -> tuple["CreditBalanceAtomic", CreditBalance]:
        return cls(_act="created", balance=balance), balance

    @classmethod
    def adjusted(
        cls,
        *,
        balance: CreditBalance,
    ) -> tuple["CreditBalanceAtomic", CreditBalance]:
        return cls(_act="adjusted", balance=balance), balance

    @classmethod
    def cleared(
        cls,
        *,
        balance: CreditBalance,
    ) -> tuple["CreditBalanceAtomic", CreditBalance]:
        return cls(_act="cleared", balance=balance), balance

    @classmethod
    def deducted(
        cls,
        *,
        balance: CreditBalance,
    ) -> tuple["CreditBalanceAtomic", CreditBalance]:
        return cls(_act="deducted", balance=balance), balance

    @classmethod
    def rolled(
        cls,
        *,
        balance: CreditBalance,
    ) -> tuple["CreditBalanceAtomic", CreditBalance]:
        return cls(_act="rolled", balance=balance), balance

    @classmethod
    def used_set(
        cls,
        *,
        balance: CreditBalance,
    ) -> tuple["CreditBalanceAtomic", CreditBalance]:
        return cls(_act="used_set", balance=balance), balance

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "credit_balance"

    def act_entity_id(self) -> uuid_str:
        return self.balance.id

    def payload(self) -> dict:
        return {
            "data": {
                "center_id": self.balance.center_id,
                "plan_type": self.balance.plan_type,
                "credit_limit": self.balance.credit_limit,
                "credit_used": self.balance.credit_used,
                "period_start": self.balance.period_start.isoformat(),
                "period_end": self.balance.period_end.isoformat(),
            }
        }
