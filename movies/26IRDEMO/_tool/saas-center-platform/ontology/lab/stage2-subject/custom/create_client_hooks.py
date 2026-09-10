# ✋ 훅 파일 — 존재하면 생성 코드가 호출한다. 전후 처리 전용.
# 규칙: 훅이 3개를 넘으면 오버라이드(승격)로 전환한다 — 훅 남용은 콜스택 미궁의 뒷문.


async def issue_code(center_id) -> str:
    """code 6자 발번 — 알고리즘은 코드가 소유 (온톨로지는 '내부 코드, 자체 발번'까지만 안다)"""
    return generate_unique_code(center_id)  # secrets.choice, 충돌 시 재시도


async def after_create(client) -> None:
    """기본 아바타 배정 — 표준 흐름과 무관한 부수 처리"""
    if not client.profile_image_url:
        await assign_default_avatar(client)
