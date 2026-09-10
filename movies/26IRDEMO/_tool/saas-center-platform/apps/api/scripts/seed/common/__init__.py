"""common 시드 — 운영 기준·카탈로그 데이터.

일괄 실행: uv run python -m scripts.seed.common
"""

# (라벨, 모듈 경로) — 의존 순서(document → voucher) 유지.
_SEEDS = [
    ("플랜 설정/플랫폼 설정", "scripts.seed.common.plan_config"),
    ("역할/권한", "scripts.seed.common.role"),
    ("아동 심리 검사 카탈로그", "scripts.seed.common.assessment"),
    ("문서 양식 (시스템 + 센터)", "scripts.seed.common.form"),
    ("플랫폼 어드민 초기 계정", "scripts.seed.common.admin_account"),
    ("FAQ", "scripts.seed.common.qna"),
    ("플랫폼 공지", "scripts.seed.common.notice"),
    ("문자 양식", "scripts.seed.common.messaging"),
    ("바우처 카탈로그 연결용 원본 문서", "scripts.seed.common.document"),
    ("경기도 지역사회서비스 바우처 카탈로그", "scripts.seed.common.voucher"),
    ("아동정서발달지원서비스 — AI 추출 가공 완료본", "scripts.seed.common.voucher_extraction"),
]


async def main() -> None:
    for label, path in _SEEDS:
        print(f"🔄 {label} ...")
        module = __import__(path, fromlist=["main"])
        await module.main()
        print(f"✅ {label}\n")
