from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Account


@dataclass(frozen=True, kw_only=True)
class AccountAtomic:
    _act: str
    account: Account

    @classmethod
    def created(cls, *, account: Account) -> tuple["AccountAtomic", Account]:
        return cls(_act="created", account=account), account

    @classmethod
    def logged_in(cls, *, account: Account) -> tuple["AccountAtomic", Account]:
        return cls(_act="logged_in", account=account), account

    @classmethod
    def password_changed(cls, *, account: Account) -> tuple["AccountAtomic", Account]:
        return cls(_act="password_changed", account=account), account

    @classmethod
    def deleted(cls, *, account: Account) -> tuple["AccountAtomic", Account]:
        return cls(_act="deleted", account=account), account

    @classmethod
    def locked(cls, *, account: Account) -> tuple["AccountAtomic", Account]:
        return cls(_act="locked", account=account), account

    @classmethod
    def unlocked(cls, *, account: Account) -> tuple["AccountAtomic", Account]:
        return cls(_act="unlocked", account=account), account

    @classmethod
    def force_logged_out(cls, *, account: Account) -> tuple["AccountAtomic", Account]:
        return cls(_act="force_logged_out", account=account), account

    @classmethod
    def status_updated(cls, *, account: Account) -> tuple["AccountAtomic", Account]:
        return cls(_act="status_updated", account=account), account

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "account"

    def act_entity_id(self) -> uuid_str:
        return self.account.id

    def payload(self) -> dict:
        # 사실만 — password 등 민감값 금지
        return {"data": {"email": self.account.email}}
