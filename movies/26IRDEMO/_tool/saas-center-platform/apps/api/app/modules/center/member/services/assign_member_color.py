from ..repository import MemberRepository

COLOR_PALETTE = [
    # ── 기본 15색 ──
    "#F47500",  # 오렌지
    "#017750",  # 그린
    "#0176D0",  # 블루
    "#49AAEF",  # 스카이블루
    "#EF4967",  # 코랄핑크
    "#A78BFA",  # 라벤더
    "#1395A1",  # 틸
    "#22C55E",  # 에메랄드
    "#0EA5E9",  # 시안
    "#EAB308",  # 옐로우
    "#F97316",  # 탠저린
    "#EC4899",  # 핫핑크
    "#6366F1",  # 인디고
    "#14B8A6",  # 민트
    "#84CC16",  # 라임
    # ── 확장 35색 ──
    "#DC2626",  # 레드
    "#7C3AED",  # 바이올렛
    "#059669",  # 포레스트
    "#D946EF",  # 퓨시아
    "#CA8A04",  # 다크골드
    "#2563EB",  # 로얄블루
    "#E11D48",  # 크림슨
    "#0D9488",  # 다크틸
    "#9333EA",  # 퍼플
    "#65A30D",  # 올리브그린
    "#C026D3",  # 마젠타
    "#0891B2",  # 딥시안
    "#DB2777",  # 딥핑크
    "#4F46E5",  # 딥인디고
    "#16A34A",  # 켈리그린
    "#EA580C",  # 번트오렌지
    "#7E22CE",  # 딥퍼플
    "#0284C7",  # 스틸블루
    "#BE185D",  # 와인
    "#15803D",  # 헌터그린
    "#B45309",  # 앰버
    "#4338CA",  # 울트라마린
    "#0F766E",  # 정글그린
    "#BE123C",  # 루비
    "#1D4ED8",  # 코발트
    "#A16207",  # 브론즈
    "#6D28D9",  # 아이리스
    "#047857",  # 세이지
    "#9F1239",  # 버건디
    "#1E40AF",  # 네이비블루
    "#4D7C0F",  # 모스그린
]


class AssignMemberColorService:
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(self, center_id: str) -> str:
        # load
        used_colors = await self.repo.list_used_colors(center_id=center_id)

        # count
        usage = {c: 0 for c in COLOR_PALETTE}
        for c in used_colors:
            if c in usage:
                usage[c] += 1

        # return
        return min(COLOR_PALETTE, key=lambda c: usage[c])
