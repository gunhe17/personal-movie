"""검사 진행(progress) 축 명세 — status와 독립임을 고정한다.

배경
----
검사 단계 진입 gate가 examination.status 하나에 의존하면서, 세 검사 모두
"수집이 끝났다"를 status에 남기지 않는 탓에 다음 단계로 못 넘어가는 버그가
있었다. 급한 대로 프론트 모듈이 로컬 술어(`status != 'created'`)로 우회해
두었지만, 이는 증상 처방이다.

근본 원인은 한 컬럼에 두 축이 섞여 있다는 것이다:

  - 임상 워크플로 축: 초안 → 검토 → 확정  (검사 종류와 무관, SaMD 감사 대상)
  - 검사 진행 축:     검사마다 다른 단계   (HTP 그림 4장, 로샤 카드 10장, SCT 문항 N개)

이 파일은 두 번째 축의 **판정 규칙**을 명세한다.

앞으로 검사가 18종까지 늘어나는데, 그중 다수는 AI 채점이 없는 표준화 검사
(MMPI, 웩슬러, TCI 등)다. status의 ai_analyzing/ai_draft_ready 단계를 전제하면
그 검사들은 전부 SCT처럼 상태 머신을 우회하게 된다. 진행 축을 분리해 두면
새 검사는 자기 완료 조건만 선언하면 되고 상태 머신은 건드리지 않는다.
"""
import inspect
from types import SimpleNamespace

from app.modules.examination.common.progress import (
    HTP_CATEGORIES,
    htp_collect_done,
    htp_progress,
    rorschach_collect_done,
    rorschach_progress,
    sct_collect_done,
    sct_progress,
)


def _drawing(category: str, *, uploaded: bool = True):
    """htp_drawings 한 행 — 판정에 쓰이는 두 필드만 흉내낸다."""
    return SimpleNamespace(
        category=category,
        image_url=f"/uploads/{category}.png" if uploaded else None,
    )


def _session(*, ended: bool):
    return SimpleNamespace(
        started_at="2026-08-10T00:00:00",
        ended_at="2026-08-10T01:00:00" if ended else None,
    )


# ---------------------------------------------------------------------------


class TestHTPCollectDone:
    def test_all_four_uploaded(self):
        rows = [_drawing(c) for c in HTP_CATEGORIES]
        assert htp_collect_done(rows) is True

    def test_partial_upload_is_not_done(self):
        assert htp_collect_done([_drawing("house"), _drawing("tree")]) is False

    def test_placeholder_rows_without_image_are_not_done(self):
        """initialize_drawings가 빈 행을 먼저 만든다 — 행 존재 ≠ 업로드 완료"""
        rows = [_drawing(c, uploaded=False) for c in HTP_CATEGORIES]
        assert htp_collect_done(rows) is False

    def test_empty(self):
        assert htp_collect_done([]) is False

    def test_signature_takes_no_status(self):
        """진행 축은 status와 직교 — 판정에 status가 끼어들 자리가 없다"""
        assert list(inspect.signature(htp_collect_done).parameters) == ["drawings"]

    def test_progress_counts_uploaded(self):
        rows = [_drawing("house"), _drawing("tree"), _drawing("man", uploaded=False)]
        p = htp_progress(rows, has_interpretations=False)
        assert (p.collected_count, p.collect_total) == (2, 4)
        assert p.collect_done is False
        assert p.has_result is False


class TestRorschachCollectDone:
    def test_ended_session_is_done(self):
        assert rorschach_collect_done(_session(ended=True)) is True

    def test_started_but_not_ended(self):
        """기록 중 — status는 in_progress, 종료 전"""
        assert rorschach_collect_done(_session(ended=False)) is False

    def test_no_session(self):
        assert rorschach_collect_done(None) is False

    def test_status_cannot_distinguish_recording_from_finished(self):
        """핵심: 기록 중과 기록 완료가 status로는 같다(둘 다 in_progress).

        이 사실이 로르샤하 채점 화면 진입이 막혔던 원인이다.
        """
        # status는 둘 다 in_progress지만 진행 축은 구분한다
        assert rorschach_collect_done(_session(ended=False)) is False
        assert rorschach_collect_done(_session(ended=True)) is True

    def test_progress_has_no_counts(self):
        """수집 단위가 카드 10장이지만 완료 판정은 세션 종료 하나로 결정된다"""
        p = rorschach_progress(_session(ended=True), has_scored_response=True)
        assert p.collect_done is True
        assert p.collected_count is None and p.collect_total is None
        assert p.has_result is True


class TestSCTCollectDone:
    def test_all_answered(self):
        assert sct_collect_done({"totalCount": 50, "completedCount": 50}) is True

    def test_partial(self):
        assert sct_collect_done({"totalCount": 50, "completedCount": 49}) is False

    def test_none_answered(self):
        assert sct_collect_done({"totalCount": 50, "completedCount": 0}) is False

    def test_missing_result_data(self):
        assert sct_collect_done(None) is False
        assert sct_collect_done({}) is False

    def test_total_zero_is_not_done(self):
        """문항이 로드되기 전 0/0을 완료로 오판하지 않는다"""
        assert sct_collect_done({"totalCount": 0, "completedCount": 0}) is False

    def test_progress_carries_counts(self):
        p = sct_progress({"totalCount": 50, "completedCount": 12})
        assert (p.collected_count, p.collect_total) == (12, 50)
        assert p.collect_done is False

    def test_scores_mark_result(self):
        assert sct_progress({"scores": [{"stemId": 1}]}).has_result is True
        assert sct_progress({"scores": []}).has_result is False
        assert sct_progress(None).has_result is False


class TestProgressAxisContract:
    """세 검사가 공통으로 만족해야 하는 성질."""

    def test_no_predicate_reads_status(self):
        """어떤 판정 함수도 status를 인자로 받지 않는다.

        시그니처로 강제한다 — status를 받게 되는 순간 두 축이 다시 섞인다.
        """
        for fn in (
            htp_collect_done,
            rorschach_collect_done,
            sct_collect_done,
            htp_progress,
            rorschach_progress,
            sct_progress,
        ):
            params = inspect.signature(fn).parameters
            assert "status" not in params, f"{fn.__name__}이 status에 의존한다"

    def test_collect_done_is_false_before_any_data(self):
        """데이터가 없으면 셋 다 미완료 — created 직후의 공통 상태"""
        assert htp_collect_done([]) is False
        assert rorschach_collect_done(None) is False
        assert sct_collect_done(None) is False
        # progress 래퍼도 같은 판정을 내린다
        assert htp_progress([], has_interpretations=False).collect_done is False
        assert rorschach_progress(None, has_scored_response=False).collect_done is False
        assert sct_progress(None).collect_done is False
