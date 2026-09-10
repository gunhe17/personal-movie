# ═══════════════════════════════════════════════════════════════════
# 🤖 GENERATED — ontology/attributes.json#subject.states
# source-hash: b71e09d2 · DO NOT EDIT
# ═══════════════════════════════════════════════════════════════════

# 온톨로지 상태 정의에서 생성된 전이 가드:
#   "archived(6개월+ 장기 미방문)는 inactive에서만 허용" ← states.note 구조화분
ALLOWED_FROM = ("inactive",)


class ArchiveClientService:
    def __init__(self, repo):
        self.repo = repo

    async def execute(self, center_id, client_id):
        client = await self.repo.get_in_center(client_id, center_id)
        if client.status not in ALLOWED_FROM:
            raise InvalidOperationException(
                f"archive는 {ALLOWED_FROM}에서만 가능합니다 (현재: {client.status})")
        return await self.repo.update_in_center(client_id, center_id, status="archived")
