"""PDF의 반응 라벨은 **표시 번호에서 파생된다** — 조각의 저장 라벨이 아니다.

무엇을 막는 테스트인가
----------------------
반응 번호는 저장하지 않고 순서에서 파생시킨다(`display_numbers()`). 화면은
그 규칙을 따르는데(`Review.labelOf`), PDF만 조각이 들고 있는
`Region.label`을 찍고 있었다(2026-08-26 발견). 그 값은 **옛 "카드 내 순번"이
박제된 것**이라, 반응을 하나 지우면 그때부터 두 문서가 같은 반응을 다른
번호로 부른다.

왜 나쁜가: 임상가는 화면에서 "3번 반응"을 검토하고 PDF에서 그 반응을 찾는다.
번호가 갈리면 대조가 불가능하고, 무엇보다 **어긋났다는 사실이 안 보인다** —
두 문서 각각은 멀쩡해 보인다.
"""
from datetime import datetime

from app.modules.examination.report.service import RorschachReportService
from app.modules.examination.rorschach.schemas import RegionResponse, ResponseDetail


def _response(rid: str, card_no: int, display_no: int) -> ResponseDetail:
    return ResponseDetail(
        id=rid, session_id="s1", card_no=card_no, region_ids=[f"g-{rid}"],
        phase="free_association", is_formal=True, response_no=display_no,
        free_association_text=f"반응 {display_no}",
    )


def _region(rid: str) -> RegionResponse:
    """조각 — 라벨·색을 **더 이상 갖지 않는다**(2026-08-26 컬럼 제거).

    조각이 값을 들고 있던 것이 문제의 뿌리였다. 이 픽스처에 `label`을
    넘길 자리가 없다는 것 자체가, PDF가 그 값을 다시 집을 수 없다는 뜻이다.
    """
    return RegionResponse(
        id=f"g-{rid}", session_id="s1", response_id=rid, card_no=1,
        path=[{"x": 0.1, "y": 0.1}, {"x": 0.2, "y": 0.2}],
        created_at=datetime(2026, 1, 1), updated_at=datetime(2026, 1, 1),
    )


def _rows(responses, regions):
    """PDF에 넘어가는 반응 행들 — 렌더 전 데이터 단계에서 본다."""
    svc = RorschachReportService()
    captured = {}

    class _Spy:
        def render(self, **ctx):
            captured.update(ctx)
            return "<html></html>"

    svc._env = type("E", (), {"get_template": lambda self, name: _Spy()})()

    class _Summary:
        def model_dump(self, **_):
            return {"R": len(responses), "validity": "valid"}

    # WeasyPrint 호출은 삼킨다 — 검사 대상은 템플릿에 넘어가는 데이터다.
    try:
        svc.generate_pdf(summary=_Summary(), responses=responses, regions=regions)
    except Exception:
        pass
    return captured.get("regions", [])


class TestLabelFollowsDisplayNumber:
    def test_label_is_display_number_not_stored_label(self):
        """조각의 저장 라벨이 낡아도 PDF는 표시 번호를 쓴다."""
        responses = [_response("r1", 1, 1), _response("r2", 1, 2)]
        regions = [_region("r1"), _region("r2")]

        labels = [row["label"] for row in _rows(responses, regions)]
        assert labels == ["1", "2"], (
            f"PDF가 조각의 옛 저장 라벨을 찍고 있다: {labels}. "
            "화면(Review.labelOf)은 표시 번호를 쓰므로 두 문서가 갈린다."
        )

    def test_response_without_region_still_has_a_number(self):
        """거부·미완성 반응도 번호는 있다 — 예전엔 '-'로 이름을 잃었다."""
        responses = [_response("r1", 1, 1)]
        rows = _rows(responses, [])
        assert rows[0]["label"] == "1"
