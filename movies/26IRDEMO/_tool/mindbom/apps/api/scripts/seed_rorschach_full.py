"""해석 가능한 로르샤하 프로토콜을 만든다 — R=22, 성인 비환자 규준 형태.

왜 필요한가 (§12 Q10, §14-13)
------------------------------
개발 DB로는 이 시스템을 검증할 수 없었다. 2026-08-25 실측:

    로샤 세션 21개 중 R>=14(해석 가능): **2개**
    inquiry_text 있는 반응: **3개**
    확정·보고서 생성된 검사 15개: **전부 R<14**

R<14는 프로토콜 타당성 판정에서 봉인된다(`protocol_validity`). 그래서
**하단 클러스터가 실서비스 출력에 도달한 적이 한 번도 없다** — Lambda·EA·es·
DEPI·CDI·PTI·GHR:PHR 전부. 코드는 있고 테스트는 통과하는데 실제로 돌아본
적이 없는 상태였다.

R>=14인 2개도 못 쓴다. 마이그레이션 잔재라 자유반응 텍스트가 거의 비어 있다.

무엇을 만드는가
---------------
- 카드 10장 전부 실시(`responded`), R=22
- 반응마다 **자유반응 텍스트 + 질문 답변 + 영역 조각 + 위치 부호 + 확정 코딩**
- 카드당 반응 수는 규준을 따른다: 다색 카드(III·VIII·IX·X)가 더 많다
- 상태는 `ai_draft_ready` — 확정 게이트를 실제로 밟아볼 수 있게 열어둔다

부호의 근거
-----------
- 코딩 부호는 `coding_codes.py` 어휘만 쓴다. 어긋나면
  `scripts/audit_coding_codes.py`가 잡는다.
- 평범반응(P)은 **워크북 〈표 5-2〉(89쪽)를 따랐다.** 카드 I·V의 W 박쥐/나비,
  카드 III D9 인간상, VIII D1 전체 동물상 등. 표에 없는 자리에는 P를 주지 않는다.

⚠️ **이건 가짜 프로토콜이다.** 실제 피검자의 반응이 아니라 규준의 *형태*를
흉내낸 것이다. UI·계산 경로를 검증하는 데 쓰고, 임상적 해석의 근거로 삼지 않는다.

쓰는 법
-------
    cd apps/api && uv run python -m scripts.seed_rorschach_full
    cd apps/api && uv run python -m scripts.seed_rorschach_full --drop  # 지우고 다시
"""
import argparse
import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.modules.client.models import Client
from app.modules.examination.common.models import Examination
from app.modules.examination.rorschach.models import (
    RorschachCardAdministration,
    RorschachRegion,
    RorschachResponse,
    RorschachSession,
)
from app.modules.institution.models import Institution
from app.modules.member.models import Member

from scripts import cast

INSTITUTION_NAME = cast.INSTITUTION_NAME
# 해석 가능한 프로토콜은 종합보고서 시연의 주인공에게 붙인다 —
# 따로 만든 "규준샘플" 내담자는 배역표에 없어 화면에 낯선 이름으로 뜬다.
CLIENT_NAME = cast.REPORT_CLIENT


def _poly(cx: float, cy: float, w: float, h: float) -> list[dict]:
    """중심 (cx,cy)에 가로 w·세로 h인 육각형 경로 (0..1 normalized).

    실제 잉크 반점 모양은 아니지만, 영역이 **있다**는 사실과 서로 다른 자리라는
    것만 표현하면 된다. 화면에서 조각이 겹칠 때 어떻게 보이는지도 봐야 하므로
    카드마다 위치를 흩어 놓는다.
    """
    return [
        {"x": round(cx + dx * w, 4), "y": round(cy + dy * h, 4)}
        for dx, dy in (
            (0.0, -0.5), (0.45, -0.25), (0.45, 0.25),
            (0.0, 0.5), (-0.45, 0.25), (-0.45, -0.25),
        )
    ]


# (카드, 위치부호, 자유반응, 질문답변, 코딩, 조각중심)
#
# 카드당 반응 수: I·II·IV·V·VI·VII 각 2, III·VIII·IX·X 각 2~3 → 합 22.
# 다색 카드에 반응이 더 많은 것이 Exner 규준의 형태다(§14-13).
PROTOCOL: list[tuple] = [
    # --- 카드 I (2) — W 박쥐는 표 5-2의 평범반응 ---
    (1, "W", "박쥐 같아요. 날개를 펴고 날고 있는",
     "전체 모양이 박쥐처럼 보였고 양쪽이 날개예요. 가운데가 몸통이고요.",
     dict(dq="o", determinants=["FMa"], fq="o", contents=["A"], popular=True,
          z_score="ZW", special_scores=[]), (0.50, 0.50)),
    (1, "Dd99", "여기 가운데는 여자 같기도 하고",
     "허리가 잘록하고 팔을 위로 든 것처럼 보여서요.",
     dict(dq="o", determinants=["Mp"], fq="-", contents=["H"], popular=False,
          z_score=None, special_scores=[]), (0.50, 0.46)),

    # --- 카드 II (2) — D1 동물이 평범반응 ---
    (2, "D1", "곰 두 마리가 마주보고 앞발을 맞대고 있어요",
     "빨간 부분 빼고 검은 데가 곰이에요. 여기가 머리고 앞발을 서로 대고 있어요.",
     dict(dq="+", determinants=["FMa"], fq="o", contents=["A"], popular=True,
          z_score="ZW", special_scores=["COP"]), (0.35, 0.45)),
    (2, "D3", "가운데 빨간 건 피 같아요",
     "색이 빨개서요. 번진 것처럼 보이고요.",
     dict(dq="v", determinants=["CF", "YF"], fq="u", contents=["Bl"], popular=False,
          z_score=None, special_scores=["MOR"]), (0.50, 0.72)),

    # --- 카드 III (3) — D9 인간상이 평범반응 ---
    (3, "D9", "사람 둘이 뭔가를 들어올리고 있어요",
     "여기가 머리고 다리고, 가운데 걸 같이 들고 있는 것처럼 보여요.",
     dict(dq="+", determinants=["Ma"], fq="o", contents=["H"], popular=True,
          z_score="ZW", special_scores=["COP"]), (0.50, 0.42)),
    (3, "D3", "가운데 빨간 건 나비네요",
     "가운데 빨간 부분이 날개를 편 나비 같아요.",
     dict(dq="o", determinants=["FC"], fq="o", contents=["A"], popular=False,
          z_score="ZA", special_scores=[]), (0.50, 0.50)),
    (3, "D2", "양쪽 빨간 건 부서진 인형 조각 같아요",
     "찢어진 것처럼 너덜너덜해 보여서요. 원래 뭐였는지 모르겠어요.",
     dict(dq="v", determinants=["FC"], fq="-", contents=["Hd"], popular=False,
          z_score=None, special_scores=["MOR"]), (0.20, 0.35)),

    # --- 카드 IV (2) — W/D7 인간·거인이 평범반응 ---
    (4, "W", "커다란 거인이 앉아 있는 것 같아요. 아래서 올려다본",
     "발이 이렇게 크게 보이고 위로 갈수록 작아져서 올려다보는 것 같아요.",
     dict(dq="+", determinants=["Mp", "FD"], fq="o", contents=["(H)"], popular=True,
          z_score="ZW", special_scores=[]), (0.50, 0.50)),
    (4, "D1", "가운데는 나무 밑동 같기도 해요",
     "가운데 길쭉한 게 나무 기둥처럼 보였어요.",
     dict(dq="o", determinants=["FY"], fq="o", contents=["Bt"], popular=False,
          z_score=None, special_scores=[]), (0.50, 0.62)),

    # --- 카드 V (2) — W 박쥐/나비가 평범반응 ---
    (5, "W", "나비예요. 확실하게",
     "날개랑 더듬이가 다 있어서요. 전체가 나비 모양이에요.",
     dict(dq="o", determinants=["F"], fq="o", contents=["A"], popular=True,
          z_score="ZW", special_scores=[]), (0.50, 0.50)),
    (5, "D4", "옆에 튀어나온 건 다리 같아요",
     "양옆으로 뻗은 게 뒷다리처럼 보여요.",
     dict(dq="o", determinants=["F"], fq="o", contents=["Ad"], popular=False,
          z_score=None, special_scores=[]), (0.20, 0.55)),

    # --- 카드 VI (2) — W/D1 동물가죽이 평범반응 ---
    (6, "W", "지도 같아요. 어디 지방 지도",
     "울퉁불퉁한 경계선이 지도에서 본 것 같아서요. 무슨 지방인지는 모르겠어요.",
     dict(dq="o", determinants=["F"], fq="u", contents=["Ge"], popular=False,
          z_score="ZW", special_scores=[]), (0.50, 0.62)),
    (6, "D3", "위쪽은 기둥 같아요",
     "위로 솟아 있어서 기둥이나 토템 같아 보였어요.",
     dict(dq="o", determinants=["FV"], fq="o", contents=["Sc"], popular=False,
          z_score=None, special_scores=[]), (0.50, 0.20)),

    # --- 카드 VII (2) — D9 사람 머리·얼굴이 평범반응 ---
    (7, "D9", "여자아이 둘이 마주보고 있어요. 머리를 묶은",
     "여기가 얼굴이고 위로 올라간 게 묶은 머리처럼 보여요. 서로 쳐다보고 있어요.",
     dict(dq="+", determinants=["Mp"], fq="o", contents=["Hd"], popular=True,
          z_score="ZW", special_scores=["COP"]), (0.50, 0.35)),
    (7, "DS7", "가운데 빈 데는 항아리 같기도 해요",
     "가운데 하얗게 뚫린 부분이 항아리 모양이에요.",
     dict(dq="o", determinants=["F"], fq="u", contents=["Hh"], popular=False,
          z_score="ZS", special_scores=[]), (0.50, 0.60)),

    # --- 카드 VIII (3) — D1 전체 동물상이 평범반응 ---
    (8, "D1", "양쪽에 동물이 기어오르고 있어요. 다람쥐 같은",
     "네 다리가 있고 옆으로 붙어서 위로 올라가는 것처럼 보여요.",
     dict(dq="o", determinants=["FMa"], fq="o", contents=["A"], popular=True,
          z_score="ZW", special_scores=[]), (0.18, 0.50)),
    (8, "D4", "아래 분홍이랑 주황은 바위 같아요",
     "색이 여러 겹으로 되어 있어서 지층이나 바위처럼 보였어요.",
     dict(dq="o", determinants=["CF"], fq="o", contents=["Ls"], popular=False,
          z_score="ZA", special_scores=[]), (0.50, 0.78)),
    (8, "D2", "가운데 파란 건 깃발 같기도 하고",
     "파란색이고 삼각형이라 깃발 같았어요.",
     dict(dq="o", determinants=["FC"], fq="u", contents=["Sc"], popular=False,
          z_score=None, special_scores=["DV1"]), (0.50, 0.30)),

    # --- 카드 IX (2) — D3 인간·유사 형상이 평범반응 ---
    (9, "D3", "뭔가 터지는 것 같아요. 폭발하는",
     "가운데서 밖으로 확 퍼져나가는 것처럼 보여서요.",
     dict(dq="v", determinants=["ma"], fq="u", contents=["Ex"], popular=False,
          z_score=None, special_scores=["AG"]), (0.35, 0.28)),
    (9, "D1", "아래 분홍은 물감이 번진 것 같아요",
     "경계가 흐릿하고 색이 퍼져 있어서요.",
     dict(dq="v", determinants=["CF", "YF"], fq="u", contents=["Art"], popular=False,
          z_score=None, special_scores=[]), (0.50, 0.78)),

    # --- 카드 X (2) — D1 게·거미가 평범반응 ---
    (10, "D1", "파란 게 게처럼 보여요. 다리가 여러 개 뻗은",
     "가운데 몸통에서 다리가 여러 갈래로 나와 있어서 게 같아요.",
     dict(dq="o", determinants=["F"], fq="o", contents=["A"], popular=True,
          z_score=None, special_scores=[]), (0.28, 0.55)),
    (10, "D9", "가운데 초록은 애벌레 두 마리요",
     "길쭉하고 초록색이라 애벌레 같아요. 마주보고 있어요.",
     dict(dq="o", determinants=["FC"], fq="o", contents=["A"], popular=False,
          z_score="ZA", special_scores=["INCOM1"]), (0.50, 0.42)),
]


def _coding_json(spec: dict, location: str) -> dict:
    """PROTOCOL의 코딩 dict → 저장 형태. location은 반응의 부호를 그대로 쓴다."""
    return {
        "location": location,
        "dq": spec["dq"],
        "determinants": list(spec["determinants"]),
        "fq": spec["fq"],
        "pair": False,
        "contents": list(spec["contents"]),
        "popular": spec["popular"],
        "z_score": spec["z_score"],
        "special_scores": list(spec["special_scores"]),
    }


async def _find_existing(session, institution_id: str):
    res = await session.execute(
        select(Examination)
        .join(Client, Client.id == Examination.client_id)
        .where(
            Client.name == CLIENT_NAME,
            Examination.institution_id == institution_id,
            Examination.deleted_at.is_(None),
            # **자기가 만든 것만** 지운다. 예전에는 이 조건이 없어서 `--drop`이
            # 박지우의 seed.py 검사 3건(past-rorschach·now-sct·tray-htp)까지
            # 통째로 soft delete했다 — 이 스크립트를 한 번 돌리는 것만으로
            # 시드가 무너졌다.
            Examination.exam_type == "rorschach",
            Examination.note.is_(None),
        )
    )
    return list(res.scalars().all())


async def seed(drop: bool) -> int:
    async with AsyncSessionLocal() as session:
        inst = (
            await session.execute(
                select(Institution).where(Institution.name == INSTITUTION_NAME)
            )
        ).scalar_one_or_none()
        if inst is None:
            print(f"기관 '{INSTITUTION_NAME}' 없음. 먼저 `python -m scripts.seed` 실행.")
            return 1

        clinician = (
            await session.execute(
                select(Member).where(
                    Member.institution_id == inst.id, Member.role == "clinician"
                )
            )
        ).scalars().first()
        if clinician is None:
            print("clinician 멤버 없음.")
            return 1

        existing = await _find_existing(session, inst.id)
        if existing:
            if not drop:
                print(f"이미 있다 ({len(existing)}건). 다시 만들려면 --drop")
                return 0
            now = datetime.now().replace(microsecond=0)
            for e in existing:
                e.deleted_at = now
            await session.flush()
            print(f"기존 {len(existing)}건 soft delete")

        client = (
            await session.execute(
                select(Client).where(
                    Client.institution_id == inst.id, Client.name == CLIENT_NAME
                )
            )
        ).scalars().first()
        if client is None:
            # 배역표에 있는 사람이면 그 값 그대로 만든다 — 생년월일이 어긋나면
            # 같은 이름의 다른 사람이 되어 마인드스코프 화면과 안 맞는다
            spec = next((c for c in cast.CLIENTS if c["name"] == CLIENT_NAME), None)
            client = Client(institution_id=inst.id, **spec) if spec else Client(
                institution_id=inst.id, name=CLIENT_NAME
            )
            session.add(client)
            await session.flush()

        now = datetime.now().replace(microsecond=0)
        exam = Examination(
            institution_id=inst.id,
            client_id=client.id,
            examiner_id=clinician.id,
            exam_type="rorschach",
            # 확정 게이트를 실제로 밟아볼 수 있게 확정 **전**에 둔다.
            status="ai_draft_ready",
            started_at=now - timedelta(minutes=50),
        )
        session.add(exam)
        await session.flush()

        rs = RorschachSession(
            examination_id=exam.id,
            started_at=now - timedelta(minutes=50),
            # ended_at은 비운다 — 실시 완료 판정(completion.py)을 화면에서
            # 직접 눌러 밟아볼 수 있어야 한다.
        )
        session.add(rs)
        await session.flush()

        # 카드 실시 기록 — 10장 전부 responded (반응이 있으므로)
        presented = now - timedelta(minutes=48)
        for card_no in range(1, 11):
            session.add(
                RorschachCardAdministration(
                    session_id=rs.id,
                    card_no=card_no,
                    status="responded",
                    presented_at=presented + timedelta(minutes=(card_no - 1) * 4),
                    completed_at=presented + timedelta(minutes=(card_no - 1) * 4 + 3),
                )
            )

        seq_by_card: dict[int, int] = {}
        for card_no, loc, free_text, inquiry, coding, center in PROTOCOL:
            seq_by_card[card_no] = seq_by_card.get(card_no, 0) + 1
            seq = seq_by_card[card_no]

            resp = RorschachResponse(
                session_id=rs.id,
                card_no=card_no,
                sort_seq=seq,
                phase="free_association",
                is_formal=True,
                free_association_text=free_text,
                inquiry_text=inquiry,
                area_code=loc,
                card_orientation="up",
                # AI 초안과 확정본을 **같은 값으로 두지 않는다** — 둘이 같으면
                # "임상가가 검토했는가"를 화면에서 구분할 수 없다(§4-2, §14-4).
                # 확정본만 채우고 AI 초안은 비운다: 임상가가 직접 채점한 검사다.
                final_coding_json=_coding_json(coding, loc),
                confirmed_at=now - timedelta(minutes=5),
                confirmed_by=clinician.id,
            )
            session.add(resp)
            await session.flush()

            cx, cy = center
            session.add(
                RorschachRegion(
                    session_id=rs.id,
                    response_id=resp.id,
                    path_json=_poly(cx, cy, 0.22, 0.20),
                )
            )

        await session.commit()

        counts: dict[int, int] = {}
        for card_no, *_ in PROTOCOL:
            counts[card_no] = counts.get(card_no, 0) + 1
        print("=== R=22 프로토콜 생성 완료 ===")
        print(f"검사 {exam.id}")
        print(f"내담자 {CLIENT_NAME} / 상태 {exam.status}")
        print(f"R = {len(PROTOCOL)}")
        print("카드별 반응 수: " + ", ".join(
            f"{c}={counts.get(c, 0)}" for c in range(1, 11)
        ))
        p = sum(1 for row in PROTOCOL if row[4]["popular"])
        print(f"평범반응(P) = {p}")
        return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--drop", action="store_true", help="기존 샘플을 지우고 다시 만든다")
    args = ap.parse_args()
    return asyncio.run(seed(args.drop))


if __name__ == "__main__":
    raise SystemExit(main())
