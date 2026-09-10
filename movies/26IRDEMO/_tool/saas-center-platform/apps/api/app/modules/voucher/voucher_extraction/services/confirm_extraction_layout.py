from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str

from ..models import VoucherExtraction, VoucherExtractionStatus
from ..repository import VoucherExtractionRepository


class ConfirmExtractionLayoutService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        extraction_id: uuid_str,
        *,
        spans: list[dict],
        forms: list[dict],
    ) -> VoucherExtraction:
        # verify
        extraction = await self.repo.get_active(id=extraction_id)
        stage = (extraction.progress or {}).get("stage")
        if extraction.status != VoucherExtractionStatus.REVIEW and stage != "review":
            raise InvalidOperationException("영역 확정 대기 상태에서만 확정할 수 있습니다.")

        # compute — 확정본이 정본: spans 교체, 서식은 구간 단위(여러 장 = 한 서식)
        data = dict((extraction.progress or {}).get("data") or {})
        data["spans"] = [
            {
                "no": str(i + 1),
                "name": s["name"],
                "code": s.get("code"),
                "start_page": f"p-{int(s['start_page']):03d}",
                "end_page": f"p-{int(s['end_page']):03d}",
                "rationale": "user_confirmed",
            }
            for i, s in enumerate(spans)
        ]
        # 소속(scope)은 확정 화면의 선택이 정본 — 감지 기본값을 사람이 고친 결과다.
        # voucher_names 는 위 spans 의 사업명과 같은 어휘(자유입력 아님).
        data["form_units"] = [
            {
                "title": f.get("title") or "",
                "kind": f.get("kind") or "기타",
                "scope": f.get("scope") or "unknown",
                "voucher_names": [n for n in (f.get("voucher_names") or []) if n],
                "start_page": int(f["start_page"]),
                "end_page": int(f["end_page"]),
            }
            for f in forms
        ]
        data.pop("vouchers", None)   # 영역이 바뀌었으니 추출 결과는 처음부터

        # return — 2단계(tx)로 재개
        return await self.repo.update_in_place(
            id=extraction_id,
            status=VoucherExtractionStatus.PROCESSING,
            progress={"stage": "tx", "data": data},
        )
