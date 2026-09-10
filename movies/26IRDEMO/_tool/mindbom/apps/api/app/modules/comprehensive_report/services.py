"""종합보고서 서비스 — 섹션 seed / AI 초안 병합 (순수 로직)"""
from datetime import date

from app.modules.comprehensive_report.assembly import ExamAssembly
from app.modules.comprehensive_report.constants import (
    FIXED_SECTION_DEFS,
    SECTION_ADMINISTERED,
    SECTION_HEADER,
    SECTION_TEST_RESULTS_PREFIX,
    SOURCE_AUTO,
    SOURCE_CLINICIAN,
    TEST_RESULTS_BASE_ORDER,
)

_GENDER_LABELS = {"male": "남", "female": "여"}

# 편집 UI에서 읽기 전용으로 표시할 auto 섹션
_READONLY_KEYS = {SECTION_HEADER, SECTION_ADMINISTERED}


def _format_date(value) -> str:
    if value is None:
        return "-"
    try:
        return value.strftime("%Y.%m.%d")
    except Exception:
        return str(value)


def _calc_age(birth_date: date | None) -> str:
    if not birth_date:
        return "-"
    today = date.today()
    age = today.year - birth_date.year - (
        (today.month, today.day) < (birth_date.month, birth_date.day)
    )
    return f"만 {age}세"


class SeedSectionsService:
    """생성 시 auto 섹션 초기화 — 인적사항/실시검사/검사별 결과 자동 채움."""

    def execute(
        self,
        *,
        assemblies: list[ExamAssembly],
        client_name: str | None,
        client_gender: str | None,
        client_birth_date: date | None,
        examiner_name: str | None,
    ) -> list[dict]:
        sections: list[dict] = []

        # 고정 단일 섹션
        for spec in FIXED_SECTION_DEFS:
            key = spec["key"]
            body = ""
            if key == SECTION_HEADER:
                body = self._header_body(
                    client_name, client_gender, client_birth_date, examiner_name
                )
            elif key == SECTION_ADMINISTERED:
                body = self._administered_body(assemblies)
            sections.append({
                "key": key,
                "title": spec["title"],
                "body": body,
                "source": spec["source"],
                "order": spec["order"],
                "editable": key not in _READONLY_KEYS,
            })

        # 검사별 결과 (auto seed, 편집 가능)
        for idx, a in enumerate(assemblies):
            sections.append({
                "key": f"{SECTION_TEST_RESULTS_PREFIX}{a.exam_id}",
                "title": f"검사 결과 — {a.label}",
                "body": a.summary_text,
                "source": SOURCE_AUTO,
                "order": TEST_RESULTS_BASE_ORDER + idx,
                "editable": True,
            })

        sections.sort(key=lambda s: s["order"])
        return sections

    @staticmethod
    def _header_body(
        client_name, client_gender, client_birth_date, examiner_name
    ) -> str:
        gender = _GENDER_LABELS.get(client_gender or "", "-")
        return (
            f"이 름: {client_name or '-'}\n"
            f"성 별: {gender}\n"
            f"생년월일: {_format_date(client_birth_date)} ({_calc_age(client_birth_date)})\n"
            f"검사자: {examiner_name or '-'}\n"
            f"작성일: {_format_date(date.today())}"
        )

    @staticmethod
    def _administered_body(assemblies: list[ExamAssembly]) -> str:
        lines = []
        for i, a in enumerate(assemblies, start=1):
            lines.append(f"{i}. {a.label} ({_format_date(a.exam_date)})")
        return "\n".join(lines) if lines else "실시된 검사 없음"


def merge_ai_draft(
    sections: list[dict],
    ai_sections: list[dict],
    mode: str,
) -> tuple[list[dict], list[str]]:
    """AI 초안을 sections에 병합.

    CDSS 불변식: source == 'clinician' 섹션은 절대 변경하지 않는다.
      - fill_empty: 본문이 비어있고 clinician이 아닌 섹션만 채움.
      - replace_ai_sections: source == 'ai' 섹션만 교체.

    ai_sections: [{key, title, body}, ...] (규칙/AI 출력)
    Returns: (병합된 sections, 변경된 키 목록)
    """
    ai_by_key = {s["key"]: s for s in ai_sections}
    changed: list[str] = []

    for sec in sections:
        ai = ai_by_key.get(sec["key"])
        if ai is None:
            continue
        if sec.get("source") == SOURCE_CLINICIAN:
            continue  # 임상가 소유 — 절대 미변경

        if mode == "fill_empty":
            if (sec.get("body") or "").strip():
                continue  # 이미 내용 있음
            sec["body"] = ai.get("body", "")
            changed.append(sec["key"])
        elif mode == "replace_ai_sections":
            if sec.get("source") != "ai":
                continue
            sec["body"] = ai.get("body", "")
            changed.append(sec["key"])

    return sections, changed
