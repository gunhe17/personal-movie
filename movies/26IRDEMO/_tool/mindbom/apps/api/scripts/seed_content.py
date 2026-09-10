"""검사의 **속**을 채운다 — seed.py가 만든 껍데기에 내용물을 넣는다.

    cd apps/api && uv run python -m scripts.seed && uv run python -m scripts.seed_content

왜
--
seed.py는 status 컬럼만 세팅한다. 그래서 목록에는 12건이 뜨는데 열면 비어 있었다:
under_review 로샤는 "반응 없음 · R 0", ai_draft_ready HTP는 "그림을 업로드하세요",
종합보고서·AI 채점 초안은 화면에 아예 없었다. 촬영은 그 화면들을 약속한다.

무엇을 채우는가 (CONTENT 표가 정본)
-----------------------------------
    HTP        그림 4장(실제 PNG를 스토리지에 쓴다) · PDI · htp_objects · htp_interpretations
    SCT        examinations.result_data (전용 테이블이 없다)
    로르샤하   session · card_administrations · responses · regions · interventions
    공통       ai_analysis_jobs (AI 초안이 있었다는 기록)
    박지우     comprehensive_reports + comprehensive_report_examinations

멱등성
------
검사는 seed.py의 `note = seed:<slug>`로 찾는다 — 재실행해도 검사 id가 안 바뀐다.
자식 행(그림·반응·해석…)은 검사 id로 싹 지우고 다시 넣는다. 자식 id는 어디서도
참조되지 않으므로 바뀌어도 무해하다. 종합보고서는 note가 자연키라 id가 유지된다.

⚠️ 전부 가짜다. 실제 내담자의 반응·그림·응답이 아니라 화면과 계산 경로를 채우려고
   지어낸 것이다. 임상적 해석의 근거로 삼지 않는다.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta

from sqlalchemy import delete, select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.unit_of_work import UnitOfWork
from app.modules.client.models import Client
from app.modules.comprehensive_report.assembly import CombinedAssemblyService
from app.modules.comprehensive_report.constants import (
    SECTION_ATTITUDE,
    SECTION_OPINION,
    SECTION_RECOMMENDATIONS,
    SECTION_REFERRAL,
)
from app.modules.comprehensive_report.models import (
    ComprehensiveReport,
    ComprehensiveReportExamination,
)
from app.modules.comprehensive_report.services import SeedSectionsService
from app.modules.examination.common.ai_job_models import AIAnalysisJob
from app.modules.examination.common.models import Examination
from app.modules.examination.htp.models import (
    HTPDrawing,
    HTPInterpretation,
    HTPObject,
)
from app.modules.examination.rorschach.models import (
    RorschachCardAdministration,
    RorschachIntervention,
    RorschachRegion,
    RorschachResponse,
    RorschachSession,
)
from app.modules.institution.models import Institution
from app.modules.member.models import Member

from scripts import cast, content_htp, content_sct
from scripts.seed_rorschach_full import PROTOCOL, _coding_json, _poly

AI_MODEL_VERSION = "mindbom-demo-1.0"

# slug → (검사 유형, 채움 수준)
#   collected  원자료만 (실시 중)
#   ai_draft   원자료 + AI 초안 (채점 전/검토 중)
#   confirmed  임상가 확정까지
CONTENT: dict[str, tuple[str, str]] = {
    "now-htp": ("htp", "collected"),
    "tray-htp": ("htp", "ai_draft"),
    "tray-htp-2": ("htp", "ai_draft"),
    "past-htp": ("htp", "confirmed"),
    "battery-htp": ("htp", "confirmed"),

    "now-sct": ("sct", "collected"),
    "past-sct": ("sct", "confirmed"),
    "battery-sct": ("sct", "confirmed"),

    "tray-rorschach": ("rorschach", "ai_draft"),
    "past-rorschach": ("rorschach", "confirmed"),
    # s02가 실시하는 윤도현의 로샤. 배터리·종합보고서의 재료라 확정까지 채운다.
    "yun-rorschach": ("rorschach", "confirmed"),
}

# 종합보고서 — 배역표의 검사 축 주인공. seed.py의 BATTERY와 같은 묶음이다.
# 박지우 → 윤도현 (2026-09-10): s01 접수 → s02 실시 → s03 보고서가 한 사람으로 이어진다.
REPORT_SLUGS = ["yun-rorschach", "battery-htp", "battery-sct"]
REPORT_NOTE = "seed:report-yundohyun"

REPORT_BODIES = {
    SECTION_REFERRAL: (
        "햇살지역아동센터의 의뢰로 실시된 단체 심리평가 대상 아동이다. 센터 교사는 "
        "“또래와 어울리는 데는 무리가 없으나 자기 이야기를 거의 하지 않는다”고 보고하였고, "
        "보호자는 집에서 말수가 줄고 힘든 일이 있어도 내색하지 않는다고 보고하였다. "
        "현재의 정서 상태와 가정 내 소통 양상, 대처 자원을 확인하기 위해 종합 심리평가가 의뢰되었다."
    ),
    SECTION_ATTITUDE: (
        "보호자와 함께 시간에 맞추어 내원하였다. 검사 전반에 걸쳐 협조적이었으나 응답 전 "
        "침묵이 길고 “이렇게 말해도 돼요?”와 같이 확인을 구하는 태도가 반복되었다. "
        "정서를 묻는 문항에서 목소리가 작아지고 시선을 아래로 두는 모습이 관찰되었다. "
        "검사 소요 시간은 연령 규준보다 다소 길었으나 중단 없이 완료하였다."
    ),
    SECTION_OPINION: (
        "세 검사에서 일관되게 관찰되는 것은 **정서를 표현하기보다 혼자 감내하는 대처**다. "
        "SCT에서는 가족 관계와 정서·대처 영역의 갈등 수준이 상대적으로 높게 나타난 반면 "
        "또래·사회 관계는 안정적 범위였고, HTP에서는 위축된 자기상(작은 인물상, 가는 기둥)과 "
        "접촉을 열어두지 않는 양상(작은 문, 길 생략)이 함께 나타났다. 로르샤하에서는 "
        "충분한 반응 수(R=22)가 산출되어 해석 가능한 프로토콜이었으며, 인간운동반응과 "
        "협응반응이 확인되어 관계에 대한 기대 자체는 유지되고 있음을 시사한다. "
        "다만 형태질이 낮은 반응과 손상 내용이 함께 관찰되어, 스트레스가 누적될 때 "
        "현실 검증과 정서 조절이 일시적으로 흔들릴 가능성을 배제하기 어렵다.\n\n"
        "⚠️ 이 소견은 AI가 생성한 초안이다. 임상가의 검토와 수정을 거쳐야 한다."
    ),
    SECTION_RECOMMENDATIONS: (
        "1. 정서 인식과 표현을 목표로 한 개인 상담을 주 1회 규칙적으로 유지할 것을 권고한다.\n"
        "2. 원가족과의 상호작용에서 반복되는 회피 패턴을 다루는 것이 우선 과제로 보인다.\n"
        "3. 수면·식사 등 일상 리듬의 변화를 3개월간 모니터링하고, 악화 시 정신건강의학과 "
        "협진을 고려한다.\n"
        "4. 6개월 후 재평가를 통해 정서 조절 자원의 변화를 확인할 것을 제안한다.\n\n"
        "⚠️ 이 제언은 AI가 생성한 초안이다. 임상가의 검토와 수정을 거쳐야 한다."
    ),
}


# ────────────────────────────── 공통 ──────────────────────────────

async def _wipe(session, exam_id: str, ror_session_id: str | None = None) -> None:
    """검사의 자식 행을 지운다 — 재실행 시 내용이 두 벌 쌓이지 않게."""
    for model in (HTPInterpretation, HTPObject, HTPDrawing, AIAnalysisJob):
        await session.execute(delete(model).where(model.examination_id == exam_id))
    if ror_session_id:
        for model in (RorschachRegion, RorschachResponse,
                      RorschachCardAdministration, RorschachIntervention):
            await session.execute(delete(model).where(model.session_id == ror_session_id))


def _job(exam_id: str, module: str, now: datetime) -> AIAnalysisJob:
    """AI 채점 초안이 있었다는 기록. 상태가 아니라 **작업**이라 이 표에 남는다."""
    return AIAnalysisJob(
        examination_id=exam_id, module=module, scope="session", status="succeeded",
        started_at=now - timedelta(minutes=4), finished_at=now - timedelta(minutes=3),
        ai_model_version=AI_MODEL_VERSION,
    )


# ────────────────────────────── HTP ──────────────────────────────

async def fill_htp(session, exam: Examination, level: str, now: datetime) -> dict:
    from pathlib import Path

    base = Path(settings.STORAGE_PATH)
    counts = {"htp_drawings": 0, "htp_objects": 0, "htp_interpretations": 0}

    drawings: dict[str, HTPDrawing] = {}
    for order, cat in enumerate(content_htp.CATEGORIES):
        key = f"htp/{exam.id}/{cat}.png"
        path = base / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content_htp.render(cat, exam.id))

        d = HTPDrawing(
            examination_id=exam.id, category=cat,
            image_url=key, original_image_url=key,
            image_width=content_htp.W, image_height=content_htp.H,
            pdi_data=[{"question": q, "answer": a}
                      for q, a in content_htp.PDI_ANSWERS[cat]],
            sort_order=order,
        )
        session.add(d)
        drawings[cat] = d
        counts["htp_drawings"] += 1
    await session.flush()

    if level == "collected":
        # 실시 중 — 그림만 올라간 상태. 탐지·해석은 아직 없다(has_result=False).
        return counts

    objects: dict[tuple[str, str], HTPObject] = {}
    for cat, d in drawings.items():
        for order, (label, boxes) in enumerate(content_htp.PARTS[cat]):
            main_cond, sub_cond = content_htp.CONDS.get(label, ("", ""))
            o = HTPObject(
                drawing_id=d.id, examination_id=exam.id, label=label,
                # 탐지 안 된 객체도 넣는다(points=[]) — 빈 좌표가 "그 객체가 없다"는
                # 정보이고, '객체 유무 → 무' 판정의 근거다(facade.py 주석).
                bbox_data={"points": [list(b) for b in boxes],
                           "confidence": [0.92 - 0.03 * i for i in range(len(boxes))]},
                confidence=0.92 if boxes else None,
                main_cond=main_cond, sub_cond=sub_cond,
                is_manual=False, sort_order=order,
            )
            session.add(o)
            objects[(cat, label)] = o
            counts["htp_objects"] += 1
    await session.flush()

    for order, (cat, main, sub, obj_label, sentence, important) in enumerate(
        content_htp.INTERPRETATIONS
    ):
        obj = objects.get((cat, obj_label)) if cat and obj_label else None
        session.add(HTPInterpretation(
            examination_id=exam.id,
            drawing_id=drawings[cat].id if cat else None,
            object_id=obj.id if obj else None,
            main_category=main, sub_category=sub, sentence=sentence,
            target_name=None if cat else "종합",
            # 중요 소견은 **임상가가** 다는 표시다 — AI 초안 단계에는 아직 없다.
            is_important=important and level == "confirmed",
            is_safety=False,
            is_compound=cat is None,
            sort_order=order,
        ))
        counts["htp_interpretations"] += 1

    session.add(_job(exam.id, "htp", now))
    counts["ai_analysis_jobs"] = 1
    exam.ai_model_version = AI_MODEL_VERSION
    return counts


# ────────────────────────────── SCT ──────────────────────────────

async def fill_sct(session, exam: Examination, level: str, now: datetime) -> dict:
    if level == "collected":
        # 실시 중 — 40문항 중 22문항까지 답한 상태. 채점은 아직 없다.
        exam.result_data = content_sct.result_data(
            now - timedelta(minutes=6), limit=22, scored=False
        )
        return {"result_data.responses": 22}

    exam.result_data = content_sct.result_data(now - timedelta(hours=2))
    exam.ai_model_version = AI_MODEL_VERSION
    session.add(_job(exam.id, "sct", now))
    return {"result_data.responses": 40, "result_data.scores": 5, "ai_analysis_jobs": 1}


# ─────────────────────────── 로르샤하 ───────────────────────────

# 검토 중인 프로토콜에서 임상가가 여기까지 확정했다 — 나머지는 AI 초안만 있다.
REVIEWED_UP_TO = 8


async def fill_rorschach(
    session, exam: Examination, level: str, now: datetime, clinician_id: str
) -> dict:
    rs = (await session.execute(
        select(RorschachSession).where(RorschachSession.examination_id == exam.id)
    )).scalars().first()
    if rs is None:
        rs = RorschachSession(examination_id=exam.id)
        session.add(rs)
    await session.flush()
    await _wipe(session, exam.id, rs.id)

    started = now - timedelta(minutes=55)
    rs.started_at = started
    # 실시는 끝났다 — 두 검사 다 채점 단계 이후이므로 완료 시각을 남긴다.
    rs.ended_at = now - timedelta(minutes=12)

    for card_no in range(1, 11):
        session.add(RorschachCardAdministration(
            session_id=rs.id, card_no=card_no, status="responded",
            presented_at=started + timedelta(minutes=(card_no - 1) * 4),
            completed_at=started + timedelta(minutes=(card_no - 1) * 4 + 3),
        ))

    seq_by_card: dict[int, int] = {}
    n_regions = 0
    for idx, (card_no, loc, free_text, inquiry, coding, center) in enumerate(PROTOCOL):
        seq_by_card[card_no] = seq_by_card.get(card_no, 0) + 1
        coded = _coding_json(coding, loc)
        confirmed = level == "confirmed" or idx < REVIEWED_UP_TO

        resp = RorschachResponse(
            session_id=rs.id, card_no=card_no, sort_seq=seq_by_card[card_no],
            phase="free_association", is_formal=True,
            free_association_text=free_text, inquiry_text=inquiry,
            area_code=loc, card_orientation="up",
            # AI 초안과 확정본을 나눠 둔다 — 둘이 같으면 "임상가가 검토했는가"를
            # 화면에서 구분할 수 없다. 여기서는 AI가 먼저 채점했고 임상가가
            # 그중 앞부분까지 확정한 상태를 만든다.
            ai_coding_json=coded,
            ai_confidence=0.88,
            ai_reasoning="자유반응의 형태·색채 언급과 영역 조각을 근거로 부호를 제안함.",
            final_coding_json=coded if confirmed else None,
            confirmed_at=now - timedelta(minutes=8) if confirmed else None,
            confirmed_by=clinician_id if confirmed else None,
        )
        session.add(resp)
        await session.flush()

        cx, cy = center
        session.add(RorschachRegion(
            session_id=rs.id, response_id=resp.id, path_json=_poly(cx, cy, 0.22, 0.20)
        ))
        n_regions += 1

    # 개입 기록 — 실시 화면(FreeAssociation)이 카드별로 읽어 표시한다.
    for card_no, text in ((1, "천천히 보셔도 됩니다. 무엇처럼 보이나요?"),
                          (7, "어느 부분을 보고 그렇게 보셨는지 짚어 주시겠어요?")):
        session.add(RorschachIntervention(
            session_id=rs.id, card_no=card_no, phase="free_association",
            kind="prompt", text=text,
        ))

    session.add(_job(exam.id, "rorschach", now))
    exam.ai_model_version = AI_MODEL_VERSION
    return {
        "rorschach_responses": len(PROTOCOL),
        "rorschach_regions": n_regions,
        "rorschach_card_administrations": 10,
        "rorschach_interventions": 2,
        "ai_analysis_jobs": 1,
    }


# ───────────────────────── 종합보고서 ─────────────────────────

async def fill_report(session, inst_id: str, exams: dict[str, Examination],
                      clinician: Member, now: datetime) -> dict:
    linked = [exams[s] for s in REPORT_SLUGS if s in exams]
    if len(linked) < 2:
        print("  ! 종합보고서 건너뜀 — 묶을 확정 검사가 2건 미만")
        return {}

    client = (await session.execute(
        select(Client).where(Client.id == linked[0].client_id)
    )).scalar_one()

    # 섹션은 제품 코드가 만든다 — 시드가 따로 조립하면 형식이 갈린다.
    assemblies = await CombinedAssemblyService(UnitOfWork(session)).execute(
        [e.id for e in linked]
    )
    sections = SeedSectionsService().execute(
        assemblies=assemblies,
        client_name=client.name,
        client_gender=client.gender,
        client_birth_date=client.birth_date,
        examiner_name=clinician.name,
    )
    for s in sections:
        if s["key"] in REPORT_BODIES:
            s["body"] = REPORT_BODIES[s["key"]]

    report = (await session.execute(
        select(ComprehensiveReport).where(
            ComprehensiveReport.institution_id == inst_id,
            ComprehensiveReport.note == REPORT_NOTE,
            ComprehensiveReport.deleted_at.is_(None),
        )
    )).scalars().first()
    if report is None:
        report = ComprehensiveReport(institution_id=inst_id, note=REPORT_NOTE)
        session.add(report)
    report.client_id = client.id
    report.examiner_id = clinician.id
    report.title = f"{client.name} 종합 심리평가 보고서"
    # 임상가가 AI 초안을 받아 검토 중 — 확정 버튼을 화면에서 눌러볼 수 있는 자리.
    report.status = "under_review"
    report.sections = sections
    # ai_draft는 **불변 스냅샷**이다. sections를 덮지 않으므로 따로 담는다.
    report.ai_draft = {
        "sections": [
            {"key": k, "body": REPORT_BODIES[k]}
            for k in (SECTION_OPINION, SECTION_RECOMMENDATIONS)
        ],
        "model_version": AI_MODEL_VERSION,
    }
    report.ai_model_version = AI_MODEL_VERSION
    report.ai_generated_at = now - timedelta(minutes=25)
    await session.flush()

    await session.execute(
        delete(ComprehensiveReportExamination).where(
            ComprehensiveReportExamination.report_id == report.id
        )
    )
    for order, e in enumerate(linked):
        session.add(ComprehensiveReportExamination(
            report_id=report.id, examination_id=e.id,
            exam_type=e.exam_type, sort_order=order,
        ))
    return {"comprehensive_reports": 1,
            "comprehensive_report_examinations": len(linked)}


# ────────────────────────────── main ──────────────────────────────

async def seed() -> int:
    now = datetime.now().replace(microsecond=0)
    totals: dict[str, int] = {}

    async with AsyncSessionLocal() as session:
        inst = (await session.execute(
            select(Institution).where(
                Institution.name == cast.INSTITUTION_NAME,
                Institution.deleted_at.is_(None),
            )
        )).scalars().first()
        if inst is None:
            print(f"기관 '{cast.INSTITUTION_NAME}' 없음. 먼저 `python -m scripts.seed`.")
            return 1

        clinician = (await session.execute(
            select(Member).where(
                Member.institution_id == inst.id,
                Member.name == cast.CLINICIAN["name"],
                Member.deleted_at.is_(None),
            )
        )).scalars().first()
        if clinician is None:
            print("clinician 멤버 없음. 먼저 `python -m scripts.seed`.")
            return 1

        rows = (await session.execute(
            select(Examination).where(
                Examination.institution_id == inst.id,
                Examination.deleted_at.is_(None),
                Examination.note.is_not(None),
            )
        )).scalars().all()
        exams = {e.note.removeprefix("seed:"): e for e in rows}

        missing = [s for s in CONTENT if s not in exams]
        if missing:
            print(f"검사 없음 — 먼저 `python -m scripts.seed`: {', '.join(missing)}")
            return 1

        for slug, (kind, level) in CONTENT.items():
            exam = exams[slug]
            if kind != "rorschach":
                await _wipe(session, exam.id)
            if kind == "htp":
                counts = await fill_htp(session, exam, level, now)
            elif kind == "sct":
                counts = await fill_sct(session, exam, level, now)
            else:
                counts = await fill_rorschach(session, exam, level, now, clinician.id)
            print(f"  {slug:16} {kind:10} {level:10} " +
                  " · ".join(f"{k}={v}" for k, v in counts.items()))
            for k, v in counts.items():
                totals[k] = totals.get(k, 0) + v

        await session.flush()
        for k, v in (await fill_report(session, inst.id, exams, clinician, now)).items():
            totals[k] = totals.get(k, 0) + v

        await session.commit()

    print("\n=== 내용 채우기 완료 ===")
    for k in sorted(totals):
        print(f"  {k:34} {totals[k]}")
    print(f"\n스토리지: {settings.STORAGE_PATH}/htp/<exam_id>/<category>.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(seed()))
