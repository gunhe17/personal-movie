"""검사 진행(progress) 축 — 어디까지 했는지.

examination.status는 임상 워크플로(초안 → 검토 → 확정)를 나타내고,
여기 있는 progress는 검사 자체의 진행(수집이 끝났는지, 채점 결과가 있는지)을
나타낸다. 두 축은 직교한다.

왜 나눴는가
-----------
세 검사 모두 "수집 완료"를 status에 남기지 않는다. 로르샤하는 기록을 마쳐도
in_progress에 머물고(ended_at만 기록), HTP 이미지 업로드는 아무 전이도
일으키지 않으며, SCT는 응답을 제출해도 in_progress다. 그래서 status로 단계
진입을 막으면 "다음 화면에 들어가야 상태가 바뀌는데, 상태가 안 바뀌어서
못 들어가는" 순환이 생긴다.

앞으로 검사가 18종까지 늘어나고 그중 다수는 AI 채점이 없는 표준화 검사
(MMPI, 웩슬러, TCI 등)다. 그 검사들은 ai_analyzing/ai_draft_ready 단계를
갖지 않으므로 status 기반 gate를 그대로 쓰면 전부 우회 코드를 낳는다.
새 검사는 여기에 판정 함수 하나만 추가하면 되고 상태 머신은 건드리지 않는다.

판정 함수는 status를 인자로 받지 않는다 — 받는 순간 두 축이 다시 섞인다.
(tests/unit/test_exam_progress.py 가 시그니처로 강제한다)
"""

from app.modules.examination.common.schemas import ExamProgress

# HTP는 검사당 그림 4장. initialize_drawings가 빈 행을 먼저 만들므로
# 행의 존재가 아니라 image_url 유무로 판정해야 한다.
HTP_CATEGORIES = ("house", "tree", "man", "woman")


def htp_collect_done(drawings: list) -> bool:
    """HTP: 네 장(집/나무/남자/여자)에 모두 이미지가 올라갔는가.

    업로드는 어떤 상태 전이도 일으키지 않으므로(htp/facade.py upload_image)
    status로는 알 수 없다.
    """
    uploaded = {d.category for d in drawings if getattr(d, "image_url", None)}
    return uploaded >= set(HTP_CATEGORIES)


def rorschach_collect_done(session, cards=None, responses=None) -> bool:
    """로르샤하: **실시가 끝났는가** — 카드 10장 + 반응의 칸이 다 찼는가.

    v4까지는 `session.ended_at is not None` 하나였다. 그건 완료 버튼을 눌렀다는
    뜻이지 내용이 채워졌다는 뜻이 아니었고, 자유반응/질문 화면이 합쳐지면서
    중간 게이트가 사라졌으므로(§14-1) 실제로 검사해야 한다.

    판정은 `rorschach.completion`이 한다 — CompleteSessionService와 **같은
    함수**를 써야 "완료 처리는 됐는데 진행 표시는 미완"이 안 생긴다.

    cards/responses를 안 주면 예전 규칙(ended_at)으로 떨어진다. 호출자가
    반응까지 읽지 않는 경로(목록 화면 등)를 위한 것이며, 그 경우 완료 판정은
    느슨해진다 — 엄격한 판정이 필요한 곳은 반드시 넘겨야 한다.
    """
    if session is None:
        return False
    if cards is None or responses is None:
        return getattr(session, "ended_at", None) is not None

    # 여기서 import한다 — progress는 공통 모듈이고 completion은 검사별이라,
    # 모듈 최상단에서 끌어오면 공통이 특정 검사에 의존하게 된다.
    from app.modules.examination.rorschach.completion import administration_done

    return administration_done(cards, responses)


def sct_collect_done(result_data: dict | None) -> bool:
    """SCT: 모든 문항에 응답이 채워졌는가.

    result_data는 examinations 테이블의 같은 행에 있으므로 추가 쿼리가 없다.
    """
    if not result_data:
        return False
    total = result_data.get("totalCount") or 0
    done = result_data.get("completedCount") or 0
    return total > 0 and done >= total


def sct_scored(result_data: dict | None) -> bool:
    """SCT: AI 채점 결과가 있는가."""
    if not result_data:
        return False
    return bool(result_data.get("scores"))


def htp_progress(drawings: list, *, has_interpretations: bool) -> ExamProgress:
    uploaded = sum(1 for d in drawings if getattr(d, "image_url", None))
    return ExamProgress(
        collect_done=htp_collect_done(drawings),
        collected_count=uploaded,
        collect_total=len(HTP_CATEGORIES),
        has_result=has_interpretations,
    )


def rorschach_progress(
    session, *, has_scored_response: bool, cards=None, responses=None
) -> ExamProgress:
    """cards/responses를 주면 실시 완료를 실제로 검사하고 카드 진행률도 낸다.

    안 주면 예전 규칙(ended_at)으로 떨어진다 — 목록 화면처럼 반응까지 읽지
    않는 경로를 위한 것이다.
    """
    collected = None
    total = None
    if cards is not None and responses is not None:
        from app.modules.examination.rorschach.completion import (
            CARD_NUMBERS,
            unfinished_cards,
        )

        total = len(CARD_NUMBERS)
        collected = total - len(unfinished_cards(cards, responses))

    return ExamProgress(
        collect_done=rorschach_collect_done(session, cards, responses),
        # 수집 단위는 카드 10장이다. 반응별 세부 진척(N/M)은 실시 화면 푸터가
        # 따로 보여준다 — 공통 progress는 검사별 세부를 담지 않는다.
        collected_count=collected,
        collect_total=total,
        has_result=has_scored_response,
    )


def sct_progress(result_data: dict | None) -> ExamProgress:
    data = result_data or {}
    return ExamProgress(
        collect_done=sct_collect_done(result_data),
        collected_count=data.get("completedCount"),
        collect_total=data.get("totalCount"),
        has_result=sct_scored(result_data),
    )


def empty_progress() -> ExamProgress:
    """진행 정보를 아직 계산할 수 없는 검사(미지원 유형 등)의 기본값."""
    return ExamProgress(collect_done=False, has_result=False)
