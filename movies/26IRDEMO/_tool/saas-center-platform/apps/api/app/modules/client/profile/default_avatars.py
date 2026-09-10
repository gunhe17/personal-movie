"""내담자 기본 아바타 (성별 매칭 랜덤)

업로드한 사진이 없을 때, 성별에 맞춰 미리 지정한 기본 아바타 중 하나를
랜덤으로 배정한다. 기본 이미지는 S3(또는 로컬 스토리지)에 아래 경로로
미리 업로드되어 있어야 하며, 배정 시점에 영구 public URL로 해석해 저장한다.

스토리지 경로 규칙:
    default-avatars/{gender}/{n}.webp   예) default-avatars/male/1.webp

원본 이미지는 apps/mobile/assets/avatar/{male,female}/*.webp 에 보관되어 있으며,
동일 구조로 S3(default-avatars/{gender}/)에 업로드한다.
    aws s3 cp apps/mobile/assets/avatar/male  s3://imomtae.dev/default-avatars/male  --recursive --content-type image/webp
    aws s3 cp apps/mobile/assets/avatar/female s3://imomtae.dev/default-avatars/female --recursive --content-type image/webp

새 기본 이미지를 추가/교체하려면:
    1. 위 경로 규칙으로 이미지를 스토리지에 업로드
    2. 아래 _DEFAULT_AVATAR_PATHS 목록을 실제 파일에 맞게 수정

설계 메모:
    - profile_image_url 한 컬럼에 "업로드 사진 / 기본 아바타"가 함께 저장된다.
      기본 아바타는 경로에 `default-avatars/` 프리픽스가 있어 URL만으로 구분 가능.
    - 성별 미지정(gender=None)이면 None을 반환해 컬럼을 비워 둔다.
      → 프론트(web/mobile)는 이미지가 없거나 로드 실패하면 이니셜 아바타로 폴백한다.
"""
import secrets

from app.infrastructure.storage.factory import get_storage_client
from app.core.logger import get_logger

logger = get_logger(__name__)

# 성별별 기본 아바타 스토리지 경로 (실제 업로드한 파일에 맞춰 조정)
_DEFAULT_AVATAR_PATHS: dict[str, list[str]] = {
    "male": [
        "default-avatars/male/1.webp",
        "default-avatars/male/2.webp",
        "default-avatars/male/3.webp",
        "default-avatars/male/4.webp",
    ],
    "female": [
        "default-avatars/female/1.webp",
        "default-avatars/female/2.webp",
        "default-avatars/female/3.webp",
        "default-avatars/female/4.webp",
        "default-avatars/female/5.webp",
    ],
}


def pick_default_avatar_url(gender: str | None) -> str | None:
    paths = _DEFAULT_AVATAR_PATHS.get(gender or "")
    if not paths:
        return None

    return _public_url(secrets.choice(paths))


# (key, gender, url) — key는 `{gender}/{파일명 stem}` (예: male/1)
def list_default_avatars() -> list[tuple[str, str, str]]:
    rows: list[tuple[str, str, str]] = []
    for gender, paths in _DEFAULT_AVATAR_PATHS.items():
        for path in paths:
            url = _public_url(path)
            if url is None:
                continue
            rows.append((_key_of(gender, path), gender, url))
    return rows


# 목록에 없는 key면 None — 호출자가 거절한다
def resolve_default_avatar_url(key: str) -> str | None:
    for gender, paths in _DEFAULT_AVATAR_PATHS.items():
        for path in paths:
            if _key_of(gender, path) == key:
                return _public_url(path)
    return None


def _key_of(gender: str, path: str) -> str:
    return f"{gender}/{path.rsplit('/', 1)[-1].rsplit('.', 1)[0]}"


def _public_url(path: str) -> str | None:
    try:
        return get_storage_client().get_public_url(path)
    except Exception:  # pragma: no cover - 스토리지 설정 누락 등
        logger.warning("기본 아바타 URL 해석 실패 (path=%s)", path, exc_info=True)
        return None
