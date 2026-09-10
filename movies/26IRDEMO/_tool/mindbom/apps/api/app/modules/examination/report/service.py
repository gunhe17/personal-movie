"""검사 보고서 생성 서비스 — Jinja2 + WeasyPrint"""
import logging
from datetime import date, datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from app.modules.examination.htp.models import HTPDrawing, HTPObject, HTPInterpretation
from app.modules.examination.rorschach.completion import card_label
from app.modules.examination.rorschach.schemas import RegionResponse, ResponseDetail, StructuralSummaryResponse
from app.modules.examination.sct.schemas import SCTResultsData

logger = logging.getLogger(__name__)

# 템플릿 디렉토리
TEMPLATE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "templates"

# 카테고리 매핑
_CAT_LABELS = {"house": "집", "tree": "나무", "man": "남자사람", "woman": "여자사람"}
_CAT_ORDER = ["house", "tree", "man", "woman"]
_GENDER_LABELS = {"male": "남", "female": "여"}

_MAIN_CATEGORY_LABELS = [
    ("자기개념", "자기개념 (Self-Concept)"),
    ("정서적 안정성", "정서적 안정성 (Emotional Stability)"),
    ("대인관계", "대인관계 (Interpersonal Relationships)"),
]

# drawing category → CSS class for badge
_LABEL_TO_CLASS = {"집": "house", "나무": "tree", "남자사람": "man", "여자사람": "woman"}


def _resolve_image_url(url: str | None, base_url: str) -> str | None:
    """이미지 URL을 절대 경로로 변환 (WeasyPrint가 접근 가능하도록)"""
    if not url:
        return None
    if url.startswith("http"):
        return url
    return f"{base_url}/api/proxy/storage/{url}"


class HTPReportService:
    """HTP 보고서 PDF 생성"""

    def __init__(self):
        self._env = Environment(
            loader=FileSystemLoader(str(TEMPLATE_DIR)),
            autoescape=True,
        )

    def generate_pdf(
        self,
        drawings_with_objects: list[tuple[HTPDrawing, list[HTPObject]]],
        interpretations: list[HTPInterpretation],
        client_name: str | None = None,
        client_gender: str | None = None,
        client_birth_date: date | None = None,
        examiner_name: str | None = None,
        exam_started_at: datetime | None = None,
        base_url: str = "http://localhost:4502",
    ) -> bytes:
        """PDF 바이트 반환"""
        from weasyprint import HTML

        template = self._env.get_template("htp_report.html")

        # 그림 데이터 정렬 + 구조화
        drawing_map = {d.category: (d, objs) for d, objs in drawings_with_objects}
        drawings_data = []
        for cat in _CAT_ORDER:
            if cat not in drawing_map:
                continue
            d, objs = drawing_map[cat]
            drawings_data.append({
                "category": cat,
                "label": _CAT_LABELS.get(cat, cat),
                "image_url": _resolve_image_url(d.image_url, base_url),
                "pdi_data": d.pdi_data or [],
                "objects": [
                    {
                        "label": obj.label,
                        "main_cond": obj.main_cond,
                        "sub_cond": obj.sub_cond,
                    }
                    for obj in objs
                ],
            })

        # 해석 카테고리별 그룹화
        interp_categories = []
        for main_cat, label in _MAIN_CATEGORY_LABELS:
            items = []
            for interp in interpretations:
                if interp.main_category != main_cat:
                    continue
                # drawing_id → 카테고리 라벨
                drawing_label = "종합"
                drawing_class = "general"
                for d, _ in drawings_with_objects:
                    if d.id == interp.drawing_id:
                        drawing_label = _CAT_LABELS.get(d.category, d.category)
                        drawing_class = d.category
                        break

                items.append({
                    "drawing_label": drawing_label,
                    "drawing_class": drawing_class,
                    "sub_category": interp.sub_category,
                    "sentence": interp.sentence,
                    "is_important": interp.is_important,
                })
            interp_categories.append({"label": label, "interp_items": items})

        now = datetime.now()
        context = {
            "client_name": client_name,
            "gender_label": _GENDER_LABELS.get(client_gender or "", "-"),
            "birth_date": client_birth_date.strftime("%Y-%m-%d") if client_birth_date else "-",
            "exam_date": exam_started_at.strftime("%Y-%m-%d") if exam_started_at else "-",
            "examiner_name": examiner_name,
            "report_date": now.strftime("%Y-%m-%d %H:%M"),
            "report_date_short": now.strftime("%Y년 %m월 %d일"),
            "drawings": drawings_data,
            "interpretation_categories": interp_categories,
        }

        html_str = template.render(**context)
        pdf_bytes = HTML(string=html_str).write_pdf()
        logger.info("HTP 보고서 PDF 생성 완료 (%d bytes)", len(pdf_bytes))
        return pdf_bytes


class SCTReportService:
    """SCT 보고서 PDF 생성"""

    def __init__(self):
        self._env = Environment(
            loader=FileSystemLoader(str(TEMPLATE_DIR)),
            autoescape=True,
        )

    def generate_pdf(
        self,
        results: SCTResultsData,
        client_name: str | None = None,
        client_gender: str | None = None,
        client_birth_date: date | None = None,
        examiner_name: str | None = None,
        exam_started_at: datetime | None = None,
    ) -> bytes:
        from weasyprint import HTML

        template = self._env.get_template("sct_report.html")

        domains = []
        for d in results.scores:
            percent = (d.totalScore / d.maxScore * 100) if d.maxScore > 0 else 0
            domains.append({
                "label": d.domainLabel,
                "total_score": d.totalScore,
                "max_score": d.maxScore,
                "percent": percent,
                "score_items": [
                    {
                        "stem": it.stem,
                        "answer": it.answer,
                        "reason": it.reason,
                        "score": it.score,
                    }
                    for it in d.items
                ],
            })

        now = datetime.now()
        context = {
            "client_name": client_name,
            "gender_label": _GENDER_LABELS.get(client_gender or "", "-"),
            "birth_date": client_birth_date.strftime("%Y-%m-%d") if client_birth_date else "-",
            "exam_date": exam_started_at.strftime("%Y-%m-%d") if exam_started_at else "-",
            "examiner_name": examiner_name,
            "report_date": now.strftime("%Y-%m-%d %H:%M"),
            "report_date_short": now.strftime("%Y년 %m월 %d일"),
            "completed_count": results.completedCount,
            "total_count": results.totalCount,
            "domains": domains,
        }

        html_str = template.render(**context)
        pdf_bytes = HTML(string=html_str).write_pdf()
        logger.info("SCT 보고서 PDF 생성 완료 (%d bytes)", len(pdf_bytes))
        return pdf_bytes


class CombinedReportService:
    """종합보고서 PDF 생성 (여러 검사 통합)

    sections(임상가 정본)만 렌더한다. ai_draft는 렌더하지 않는다.
    header/administered_tests 섹션은 상단 정보/실시검사 테이블로 대체되므로 제외.
    """

    _SKIP_KEYS = {"header", "administered_tests"}

    def __init__(self):
        self._env = Environment(
            loader=FileSystemLoader(str(TEMPLATE_DIR)),
            autoescape=True,
        )

    def generate_pdf(
        self,
        *,
        title: str,
        sections: list[dict],
        client_name: str | None = None,
        client_gender: str | None = None,
        client_birth_date: date | None = None,
        examiner_name: str | None = None,
        exams_meta: list[dict],
    ) -> bytes:
        from weasyprint import HTML

        template = self._env.get_template("comprehensive_report.html")

        ordered = sorted(sections, key=lambda s: s.get("order", 0))
        render_sections = [
            {"title": s.get("title", ""), "body": s.get("body", "")}
            for s in ordered
            if s.get("key") not in self._SKIP_KEYS
        ]

        now = datetime.now()
        context = {
            "title": title or "종합 심리평가 보고서",
            "client_name": client_name,
            "gender_label": _GENDER_LABELS.get(client_gender or "", "-"),
            "birth_date": client_birth_date.strftime("%Y-%m-%d") if client_birth_date else "-",
            "examiner_name": examiner_name,
            "report_date": now.strftime("%Y-%m-%d %H:%M"),
            "report_date_short": now.strftime("%Y년 %m월 %d일"),
            "exams_meta": exams_meta,
            "sections": render_sections,
        }

        html_str = template.render(**context)
        pdf_bytes = HTML(string=html_str).write_pdf()
        logger.info("종합보고서 PDF 생성 완료 (%d bytes)", len(pdf_bytes))
        return pdf_bytes


def _format_audio_timestamp(seconds: float | None) -> str | None:
    if seconds is None:
        return None
    total = int(seconds)
    return f"{total // 60:02d}:{total % 60:02d}"


class RorschachReportService:
    """로르샤하 보고서 PDF 생성"""

    def __init__(self):
        self._env = Environment(
            loader=FileSystemLoader(str(TEMPLATE_DIR)),
            autoescape=True,
        )

    def generate_pdf(
        self,
        summary: StructuralSummaryResponse,
        responses: list[ResponseDetail],
        regions: list[RegionResponse] | None = None,
        client_name: str | None = None,
        client_gender: str | None = None,
        client_birth_date: date | None = None,
        examiner_name: str | None = None,
        exam_started_at: datetime | None = None,
    ) -> bytes:
        from weasyprint import HTML

        template = self._env.get_template("rorschach_report.html")

        # 반응 id → 딸린 조각들. 보고서의 축은 **반응**이다(§7).
        # 예전엔 region을 순회해서, 조각 N개인 반응이 N줄로 찍히고 R이 부풀었다.
        regions_by_response: dict[str, list] = {}
        for g in (regions or []):
            if g.response_id:
                regions_by_response.setdefault(g.response_id, []).append(g)

        def _format_coding(coding) -> str:
            """RorschachCoding을 Exner 표기 문자열로 변환 (예: 'Wo Fo A P 1.0 INC')"""
            if not coding:
                return "-"
            parts = []
            loc = coding.location or ""
            dq = coding.dq or ""
            if loc or dq:
                parts.append(f"{loc}{dq}".strip())
            dets = coding.determinants or []
            fq = coding.fq or ""
            if dets:
                det_str = ".".join(dets)
                parts.append(f"{det_str}{fq}" if fq else det_str)
            elif fq:
                parts.append(fq)
            if coding.pair:
                parts.append("(2)")
            if coding.contents:
                parts.append(",".join(coding.contents))
            if coding.popular:
                parts.append("P")
            if coding.z_score:
                parts.append(coding.z_score)
            if coding.special_scores:
                parts.append(",".join(coding.special_scores))
            return " ".join(parts) if parts else "-"

        # 카드·반응번호 순 → I~X 순. 정식 반응만 R 집계 대상이다(§4-1).
        formal = [r for r in responses if r.is_formal]
        sorted_responses = sorted(formal, key=lambda r: (r.card_no, r.response_no or 0))
        regions_data = []
        for resp in sorted_responses:
            final_coding = resp.final_coding
            ai_coding = resp.ai_coding
            own = regions_by_response.get(resp.id, [])
            # 영역이 0개인 반응(거부·미완성)도 한 줄로 찍힌다 — 빼면 R이 틀어진다.
            starts = [g.audio_timestamp_start_sec for g in own if g.audio_timestamp_start_sec is not None]
            regions_data.append({
                "card_no": resp.card_no,
                "card_label": card_label(resp.card_no),
                "response_no": resp.response_no,
                # 라벨은 **표시 번호에서 파생시킨다** — 화면과 같은 규칙이다
                # (`Review.labelOf`). 조각이 들고 있는 `Region.label`은 옛
                # "카드 내 순번"이 박제된 값이라, 반응을 하나 지우면 그때부터
                # 화면과 PDF가 서로 다른 번호를 댄다. 같은 반응을 두 문서가
                # 다른 이름으로 부르면 대조가 불가능해진다.
                #
                # 조각이 없는 반응(거부·미완성)도 번호는 있다 — 예전에는
                # "-"로 찍혀 그 반응만 이름을 잃었다.
                "label": str(resp.response_no) if resp.response_no is not None else "-",
                "memo": next((g.memo for g in own if g.memo), None),
                "timestamp": _format_audio_timestamp(min(starts)) if starts else None,
                "response_text": resp.free_association_text,
                "inquiry_text": resp.inquiry_text,
                "coding_str": _format_coding(final_coding or ai_coding),
                "is_ai_only": final_coding is None and ai_coding is not None,
                "ai_confidence": resp.ai_confidence,
                "ai_reasoning": resp.ai_reasoning,
            })

        # 카드별 그룹핑 (PDF 가독성)
        regions_by_card: dict[int, list] = {}
        for rd in regions_data:
            regions_by_card.setdefault(rd["card_no"], []).append(rd)
        cards_grouped = [
            {
                "card_no": cn,
                "card_label": card_label(cn),
                "regions": items,
            }
            for cn, items in sorted(regions_by_card.items())
        ]

        # Pydantic alias가 있는 dict 필드는 by_alias 직렬화 사용
        summary_dict = summary.model_dump(by_alias=True)

        now = datetime.now()
        context = {
            "client_name": client_name,
            "gender_label": _GENDER_LABELS.get(client_gender or "", "-"),
            "birth_date": client_birth_date.strftime("%Y-%m-%d") if client_birth_date else "-",
            "exam_date": exam_started_at.strftime("%Y-%m-%d") if exam_started_at else "-",
            "examiner_name": examiner_name,
            "report_date": now.strftime("%Y-%m-%d %H:%M"),
            "report_date_short": now.strftime("%Y년 %m월 %d일"),
            "summary": summary_dict,
            "regions": regions_data,
            "cards_grouped": cards_grouped,
            # R = 정식 반응 수. regions_data는 반응 축이다(§7) — 조각 수가 아니다.
            "total_responses": len(sorted_responses),
        }

        html_str = template.render(**context)
        pdf_bytes = HTML(string=html_str).write_pdf()
        logger.info("로르샤하 보고서 PDF 생성 완료 (%d bytes)", len(pdf_bytes))
        return pdf_bytes
