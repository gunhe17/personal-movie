from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.modules.center.center.models import Center
from app.modules.platform_admin.center.repository import AdminCenterRepository
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


class WarnCenterService:
    def __init__(self, repo: AdminCenterRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        reason: str,
        notify: bool,
    ) -> tuple[AdminAuditAtomic, Center]:
        center = await self.repo.find_center(center_id)
        if not center:
            raise EntityNotFoundException(f"센터를 찾을 수 없습니다: {center_id}")

        if not center.is_active:
            raise InvalidOperationException("정지 상태인 센터에는 경고를 발송할 수 없습니다")

        # 경고는 상태를 변경하지 않음 (감사 로그로만 기록)
        atomic = AdminAuditAtomic(
            _act="warned",
            _entity_name="center",
            _entity_id=center_id,
            _payload={"data": {"reason": reason, "notify": notify}},
        )
        return atomic, center
