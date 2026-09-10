# ═══════════════════════════════════════════════════════════════════
# 🤖 GENERATED — ontology/attributes.json#subject + input/subject.actions.yaml
# source-hash: 3f9ac41e · 재생성: pnpm ontology:gen (같은 정의 → 같은 출력)
# DO NOT EDIT — 수정이 필요하면:
#   전후 처리만   → custom/create_client_hooks.py (before_/after_)
#   흐름 자체     → services/create_client.py 로 복사(승격) — 생성기가 이 파일을 스킵
# ═══════════════════════════════════════════════════════════════════
from app.core.type import typecheck, uuid_str

from .. import hooks_loader  # 훅 파일이 존재하면 로드, 없으면 no-op


class CreateClientService:
    """대상자 생성 — 온톨로지 정의에서 생성된 표준 흐름.

    파라미터: 코어(이름·생년·성별·전화) + 역할 기록(상태·메모…)  ← attributes 3분류에서 유도
    검증:     이름 필수(D2) · 기관 내 중복 차단(D1: person_id 또는 이름+생년)  ← identity에서 유도
    """

    def __init__(self, repo):
        self.repo = repo

    @typecheck
    async def execute(self, center_id: uuid_str, *, name: str, birth_date=None, **fields):
        hooks = hooks_loader.get("create_client")
        await hooks.before_create(center_id=center_id, name=name, **fields)

        # ── D1: 기관 내 유일성 (온톨로지 identity 규칙에서 생성) ──
        if fields.get("person_id"):
            await self._verify_not_linked(center_id, fields["person_id"])
        elif birth_date:
            await self._verify_name_birth_unique(center_id, name, birth_date)

        # code 발번은 생성 대상 아님 — 발번기 SPI 호출 (알고리즘은 코드가 소유)
        code = await hooks.issue_code(center_id)

        client = await self.repo.add(center_id=center_id, name=name,
                                     birth_date=birth_date, code=code, **fields)
        await hooks.after_create(client)          # 예: 기본 아바타 배정
        return client
