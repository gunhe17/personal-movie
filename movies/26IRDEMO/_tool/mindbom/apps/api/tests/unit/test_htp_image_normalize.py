"""HTP 업로드 이미지 정규화 — 그림을 돌리지 않는가.

예전에는 카테고리가 방향을 강제했다(house=가로, 나머지=세로). 어긋나면 90°
돌렸는데, 실제 아동 그림 넉 장이 전부 가로로 스캔돼 들어오자 나무·남자·여자가
통째로 옆으로 누웠다. 그리고 그 상태로 탐지하면 AI가 다른 것을 본다 — 같은
그림으로 실측했다:

    누운 나무 → ['그네']                          (1개, 틀림)
    세운 나무 → ['나무전체','기둥','수관','가지']   (4개, 맞음)

화면에서만 이상한 게 아니라 판정이 틀어지는 자리였다. 게다가 용지를 돌려
그린 것은 HTP에서 채점 대상 행동이라, 코드가 "바로잡으면" 임상 정보가 사라진다.
"""
import io

from PIL import Image

from app.modules.examination.htp.facade import HTPFacade


def make_png(w: int, h: int) -> bytes:
    """좌상단에 표식을 둔 이미지 — 회전하면 표식이 다른 모서리로 간다."""
    img = Image.new("RGB", (w, h), "white")
    for x in range(w // 6):
        for y in range(h // 6):
            img.putpixel((x, y), (255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def top_left(png: bytes) -> tuple[int, int, int]:
    img = Image.open(io.BytesIO(png)).convert("RGB")
    return img.getpixel((5, 5))


RED = (255, 0, 0)


class TestOrientationIsNotForced:
    """카테고리별로 나눠 검사하지 않는다 — `_normalize_image`는 이제 카테고리를
    **받지 않는다**. 그게 이 수정의 핵심이라 시그니처가 곧 보증이다.
    """

    def test_landscape_stays_landscape(self):
        out, w, h = HTPFacade._normalize_image(make_png(2000, 1400))

        assert w > h, "가로 그림이 세로가 됐다"
        assert top_left(out) == RED, "그림이 회전됐다"

    def test_portrait_stays_portrait(self):
        out, w, h = HTPFacade._normalize_image(make_png(1400, 2000))

        assert h > w, "세로 그림이 가로가 됐다"
        assert top_left(out) == RED, "그림이 회전됐다"

    def test_signature_takes_no_category(self):
        """카테고리 인자가 되살아나면 강제 회전도 함께 돌아온다."""
        import inspect

        params = inspect.signature(HTPFacade._normalize_image).parameters
        assert list(params) == ["image_data"]

    def test_tree_landscape_is_not_rotated(self):
        """회귀: 나무를 가로로 그리면 90° 눕던 그 경우.

        이 그림이 옆으로 눕는 순간 AI는 나무를 '그네'로 본다.
        """
        out, w, h = HTPFacade._normalize_image(make_png(1485, 1050))

        assert (w, h) == HTPFacade._TARGET_LANDSCAPE
        assert top_left(out) == RED


class TestResizeTarget:
    """리사이즈 목표도 그림의 실제 방향을 따라야 한다.

    회전만 없애고 목표를 카테고리로 고르면 가로 그림이 세로 A4로 찌그러진다 —
    방향을 정하는 규칙이 두 곳에 있었기 때문이다.
    """

    def test_landscape_gets_landscape_a4(self):
        _, w, h = HTPFacade._normalize_image(make_png(3000, 2000))
        assert (w, h) == HTPFacade._TARGET_LANDSCAPE

    def test_portrait_gets_portrait_a4(self):
        _, w, h = HTPFacade._normalize_image(make_png(2000, 3000))
        assert (w, h) == HTPFacade._TARGET_PORTRAIT

    def test_square_is_treated_as_portrait(self):
        """정사각은 어느 쪽도 아니다 — 세로로 본다(w > h가 거짓)."""
        _, w, h = HTPFacade._normalize_image(make_png(2000, 2000))
        assert (w, h) == HTPFacade._TARGET_PORTRAIT


class TestExifIsStillApplied:
    def test_exif_orientation_is_honored(self):
        """EXIF 회전은 그대로 적용한다 — 그건 카메라가 남긴 '똑바로'의 정의다."""
        img = Image.new("RGB", (2000, 1400), "white")
        for x in range(300):
            for y in range(200):
                img.putpixel((x, y), (255, 0, 0))
        buf = io.BytesIO()
        exif = img.getexif()
        exif[274] = 6  # Orientation: 시계방향 90° 회전 필요
        img.save(buf, format="JPEG", exif=exif)

        out, w, h = HTPFacade._normalize_image(buf.getvalue())

        # EXIF가 돌려세우므로 가로 원본이 세로가 된다
        assert (w, h) == HTPFacade._TARGET_PORTRAIT
