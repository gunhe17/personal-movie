"""HTP 검사 서비스 — 단일 책임 원칙, 도메인 모델 반환"""
import logging
from collections import defaultdict

from app.core.exceptions import EntityNotFoundException
from app.modules.examination.htp.models import HTPDrawing, HTPObject, HTPInterpretation

logger = logging.getLogger(__name__)
from app.modules.examination.htp.repository import (
    HTPDrawingRepository,
    HTPInterpretationRepository,
    HTPObjectRepository,
)


CATEGORY_ORDER = {"house": 0, "tree": 1, "man": 2, "woman": 3}
CATEGORIES = ["house", "tree", "man", "woman"]


class InitializeDrawingsService:
    """4개 Drawing 레코드 생성 (이미 존재하면 기존 반환)"""

    def __init__(self, drawing_repo: HTPDrawingRepository):
        self._repo = drawing_repo

    async def execute(self, examination_id: str) -> list[HTPDrawing]:
        existing = await self._repo.list_by_examination(examination_id)
        if existing:
            return existing

        drawings = []
        for category in CATEGORIES:
            drawing = await self._repo.create({
                "examination_id": examination_id,
                "category": category,
                "sort_order": CATEGORY_ORDER[category],
            })
            drawings.append(drawing)
        return drawings


class UpdateDrawingPDIService:
    """그림 PDI 데이터 업데이트"""

    def __init__(self, drawing_repo: HTPDrawingRepository):
        self._repo = drawing_repo

    async def execute(
        self,
        examination_id: str,
        drawing_id: str,
        pdi_data: list[dict] | None = None,
    ) -> HTPDrawing:
        drawing = await self._repo.get(drawing_id)
        if not drawing or drawing.examination_id != examination_id:
            raise EntityNotFoundException(f"그림을 찾을 수 없습니다: {drawing_id}")

        if pdi_data is not None:
            drawing.pdi_data = pdi_data  # JSONB 컬럼 — 자동 직렬화

        await self._repo.flush()
        await self._repo.refresh(drawing)
        return drawing


class SaveDrawingImageService:
    """그림 이미지 URL + 크기 업데이트"""

    def __init__(self, drawing_repo: HTPDrawingRepository):
        self._repo = drawing_repo

    async def execute(
        self,
        examination_id: str,
        drawing_id: str,
        image_url: str,
        width: int | None = None,
        height: int | None = None,
    ) -> HTPDrawing:
        drawing = await self._repo.get(drawing_id)
        if not drawing or drawing.examination_id != examination_id:
            raise EntityNotFoundException(f"그림을 찾을 수 없습니다: {drawing_id}")

        drawing.image_url = image_url
        if width is not None:
            drawing.image_width = width
        if height is not None:
            drawing.image_height = height
        await self._repo.flush()
        await self._repo.refresh(drawing)
        return drawing


# 그림 카테고리 → 해석 API가 쓰는 cls_name 후보.
# 해석 API는 남녀를 "남자사람"으로도 "사람"으로도 부른다 — 후보를 순서대로 시도한다.
CATEGORY_TO_CLS_CANDIDATES = {
    "house": ["집"],
    "tree": ["나무"],
    "man": ["남자사람", "사람"],
    "woman": ["여자사람", "사람"],
}


def split_interpretation_items(
    interp_items: list,
) -> tuple[dict[tuple[str, str], list[dict]], list[dict]]:
    """해석 API 응답을 (객체별 해석 맵, 그림에 속하지 않는 일반 해석)으로 가른다.

    맵의 값이 리스트인 이유: man/woman은 cls_name과 obj_name이 모두 같을 수
    있어서(둘 다 "사람"/"머리") dict로 담으면 뒤엣것이 앞엣것을 덮어쓴다.

    ⚠️ 이 함수와 match_interpretation은 최초 분석(analyze)과 재해석
    (reinterpret) **양쪽이 함께 쓴다**. 한쪽만 고치면 "분석 직후 결과"와
    "재해석 후 결과"가 같은 입력에도 갈린다.
    """
    interp_by_obj: dict[tuple[str, str], list[dict]] = defaultdict(list)
    general_interps: list[dict] = []

    for item in interp_items:
        if not item.obj_name:
            general_interps.append({
                "main_category": item.main_category,
                "sub_category": item.sub_category,
                "sentence": item.sentence,
                "is_safety": item.is_safty,
                "is_compound": bool(item.target_name),
            })
            continue
        interp_by_obj[(item.cls_name, item.obj_name)].append({
            "main_cond": item.main_cond,
            "sub_cond": item.sub_cond,
            "interpretation": {
                "main_category": item.main_category,
                "sub_category": item.sub_category,
                "sentence": item.sentence,
                "target_name": item.target_name,
                "is_safety": item.is_safty,
                "is_compound": bool(item.target_name),
            },
        })

    return interp_by_obj, general_interps


def match_interpretation(
    category: str,
    label: str,
    interp_by_obj: dict[tuple[str, str], list[dict]],
    consume_idx: dict[tuple[str, str], int],
) -> dict | None:
    """객체 하나에 붙일 해석을 고른다 (없으면 None).

    같은 키에 해석이 여럿이면 순서대로 하나씩 소비하고, 하나뿐인데 여러
    객체가 요구하면(man/woman 공유) 마지막 것을 재사용한다.
    consume_idx는 호출 루프 전체에서 공유하는 카운터다.
    """
    for cls_name in CATEGORY_TO_CLS_CANDIDATES.get(category, []):
        key = (cls_name, label)
        items = interp_by_obj.get(key)
        if not items:
            continue
        idx = consume_idx[key]
        if idx < len(items):
            consume_idx[key] = idx + 1
            return items[idx]
        return items[-1]
    return None


def interpretation_identity(
    drawing_id: str | None, sub_category: str, sentence: str
) -> tuple[str, str, str]:
    """해석의 '같음'을 판정하는 키 — 재생성 전후를 잇는 유일한 끈.

    해석 레코드의 id는 재생성마다 새로 발급되므로 별표를 id로 이월할 수 없다.
    내용이 같은 해석(같은 그림의 같은 하위분류·같은 문장)이면 같은 소견으로
    본다. 재해석으로 문장이 바뀌었다면 그건 실제로 다른 소견이므로 이월하지
    않는 게 맞다 — 대신 몇 건이 사라졌는지 호출부가 임상가에게 알린다.
    """
    return (drawing_id or "", sub_category, sentence)


class SaveDetectionsService:
    """AI 탐지 결과를 객체 레코드로 저장한다 — **좌표만**.

    조건(main_cond/sub_cond)과 해석은 여기서 만들지 않는다. 그건 탐지 이후
    ReinterpretService가 DB의 전체 객체를 보고 한 번에 만든다. 그래서 최초
    분석과 재해석이 **같은 해석 생성 경로**를 타고, 같은 그림에서 두 경로가
    다른 결과를 낼 수 없다(예전에는 각자 매핑·생성 코드를 갖고 있었다).

    지정한 그림만 갈아엎는다. 예전에는 이미지가 있는 카테고리를 전부
    갈아엎어서, 나무를 새로 올리면 임상가가 집에서 옮겨 둔 BBox까지
    사라졌다.
    """

    def __init__(
        self,
        object_repo: HTPObjectRepository,
        interp_repo: HTPInterpretationRepository,
    ):
        self._object_repo = object_repo
        self._interp_repo = interp_repo

    async def execute(
        self,
        examination_id: str,
        drawings: list[HTPDrawing],
        detection_data_by_drawing: dict[str, dict],
    ) -> None:
        """detection_data_by_drawing: {drawing_id: {img_size, objects}}"""
        for drawing in drawings:
            data = detection_data_by_drawing.get(drawing.id)
            if not data:
                logger.warning("탐지 데이터 없음 (drawing_id=%s), 건너뜀", drawing.id)
                continue

            await self._object_repo.soft_delete_by_drawing(drawing.id)

            ai_size = data["img_size"]
            # 업로드 시 저장된 실제 크기가 없으면 AI 서버의 크기로 대체
            if not drawing.image_width or not drawing.image_height:
                drawing.image_width = ai_size["width"]
                drawing.image_height = ai_size["height"]

            # AI 좌표 → 실제 이미지 좌표 스케일 팩터
            scale_x = drawing.image_width / ai_size["width"] if ai_size["width"] else 1
            scale_y = drawing.image_height / ai_size["height"] if ai_size["height"] else 1

            for obj_sort, obj_data in enumerate(data["objects"]):
                raw_bbox = obj_data["bbox"]
                scaled_bbox = {
                    "points": [
                        [p[0] * scale_x, p[1] * scale_y, p[2] * scale_x, p[3] * scale_y]
                        for p in raw_bbox.get("points", [])
                    ],
                    "confidence": raw_bbox.get("confidence", []),
                }
                await self._object_repo.create({
                    "drawing_id": drawing.id,
                    "examination_id": examination_id,
                    "label": obj_data["label"],
                    "bbox_data": scaled_bbox,
                    "confidence": raw_bbox["confidence"][0] if raw_bbox.get("confidence") else None,
                    "main_cond": None,
                    "sub_cond": None,
                    "sort_order": obj_sort,
                })

        await self._object_repo.flush()


class ReinterpretService:
    """임상가가 손본 탐지 결과로 해석을 다시 만든다.

    RunAnalysisService와 무엇이 다른가: 저쪽은 AI 탐지 결과로 **객체를 새로
    만든다**(기존 객체를 지우고). 재해석은 그러면 안 된다 — 임상가가 옮겨
    놓은 BBox와 손으로 추가한 항목이 통째로 날아가기 때문이다. 그래서 여기서는
    객체 레코드를 그대로 두고 main_cond/sub_cond만 갱신하고, 해석만 재생성한다.

    BBox가 없는 객체(임상가가 손으로 추가한 항목)는 해석 API 입력에 넣을
    좌표가 없어 애초에 대상이 아니다 — 갱신도, 해석 생성도 하지 않는다.
    """

    def __init__(
        self,
        object_repo: HTPObjectRepository,
        interp_repo: HTPInterpretationRepository,
    ):
        self._object_repo = object_repo
        self._interp_repo = interp_repo

    async def execute(
        self,
        examination_id: str,
        drawings_with_objects: list[tuple[HTPDrawing, list[HTPObject]]],
        interp_by_obj: dict[tuple[str, str], list[dict]],
        general_interpretations: list[dict],
        important_keys: set[tuple[str, str, str]] | None = None,
    ) -> tuple[int, int]:
        """반환: (이월한 별표 수, 이월하지 못한 별표 수)"""
        consume_idx: dict[tuple[str, str], int] = defaultdict(int)
        pending_important = set(important_keys or ())
        carried = 0
        interp_sort = 0

        for drawing, objects in drawings_with_objects:
            for obj in objects:
                # 좌표가 비어 있어도 탐지에서 온 객체면 대상이다 — 해석 API
                # 응답의 상당수가 '객체 유무 → 무' 판정이고, 그건 바로 이
                # 빈 객체들에 붙는다. 기준은 _objects_to_detection_result와
                # 같아야 한다(거기 주석 참고): bbox_data가 있나.
                if obj.bbox_data is None:
                    continue

                interp_data = match_interpretation(
                    drawing.category, obj.label, interp_by_obj, consume_idx
                )
                if not interp_data:
                    # 해석이 안 붙은 객체는 조건도 비운다. 남겨 두면 이전
                    # 해석의 근거였던 값이 새 해석 없이 화면에 남아, 표의
                    # '표현' 열과 해석 문장이 서로 다른 판정을 가리킨다.
                    obj.main_cond = None
                    obj.sub_cond = None
                    logger.warning(
                        "재해석 매핑 실패: drawing=%s category=%s label=%s",
                        drawing.id, drawing.category, obj.label,
                    )
                    continue

                obj.main_cond = interp_data["main_cond"]
                obj.sub_cond = interp_data["sub_cond"]

                interp = interp_data["interpretation"]
                key = interpretation_identity(
                    drawing.id, interp["sub_category"], interp["sentence"]
                )
                was_important = key in pending_important
                if was_important:
                    pending_important.discard(key)
                    carried += 1

                await self._interp_repo.create({
                    "examination_id": examination_id,
                    "drawing_id": drawing.id,
                    "object_id": obj.id,
                    "main_category": interp["main_category"],
                    "sub_category": interp["sub_category"],
                    "sentence": interp["sentence"],
                    "target_name": interp.get("target_name"),
                    "is_important": was_important,
                    "is_safety": interp.get("is_safety", False),
                    "is_compound": interp.get("is_compound", False),
                    "sort_order": interp_sort,
                })
                interp_sort += 1

        for gen_interp in general_interpretations:
            key = interpretation_identity(
                None, gen_interp["sub_category"], gen_interp["sentence"]
            )
            was_important = key in pending_important
            if was_important:
                pending_important.discard(key)
                carried += 1
            await self._interp_repo.create({
                "examination_id": examination_id,
                "drawing_id": None,
                "object_id": None,
                "main_category": gen_interp["main_category"],
                "sub_category": gen_interp["sub_category"],
                "sentence": gen_interp["sentence"],
                "target_name": None,
                "is_important": was_important,
                "is_safety": gen_interp.get("is_safety", False),
                "is_compound": gen_interp.get("is_compound", False),
                "sort_order": interp_sort,
            })
            interp_sort += 1

        await self._object_repo.flush()
        return carried, len(pending_important)


class AssembleResultsService:
    """HTP 전체 결과 조회 및 그룹핑 (읽기 전용)"""

    def __init__(
        self,
        drawing_repo: HTPDrawingRepository,
        object_repo: HTPObjectRepository,
        interp_repo: HTPInterpretationRepository,
    ):
        self._drawing_repo = drawing_repo
        self._object_repo = object_repo
        self._interp_repo = interp_repo

    async def execute(
        self, examination_id: str
    ) -> tuple[list[tuple[HTPDrawing, list[HTPObject]]], list[HTPInterpretation]]:
        """반환: ([(drawing, [objects]), ...], [interpretations])"""
        drawings = await self._drawing_repo.list_by_examination(examination_id)
        all_objects = await self._object_repo.list_by_examination(examination_id)
        interpretations = await self._interp_repo.list_by_examination(examination_id)

        objects_by_drawing: dict[str, list[HTPObject]] = {}
        for obj in all_objects:
            objects_by_drawing.setdefault(obj.drawing_id, []).append(obj)

        drawings_with_objects = [
            (drawing, objects_by_drawing.get(drawing.id, []))
            for drawing in drawings
        ]

        return drawings_with_objects, interpretations


class UpdateObjectsService:
    """객체 일괄 수정/생성"""

    def __init__(self, object_repo: HTPObjectRepository):
        self._repo = object_repo

    async def execute(
        self,
        examination_id: str,
        updates: list[dict],
    ) -> list[str]:
        """반환: 좌표가 비워진(= 탐지 취소된) 객체 id 목록.

        호출부가 그 객체들의 해석을 함께 지운다 — 좌표가 없어졌는데 그
        좌표에 근거한 해석 문장이 남으면, 표의 '표현' 열은 비고 해석만
        살아 보고서까지 따라간다.
        """
        cleared: list[str] = []

        for upd in updates:
            obj_id = upd.get("id")

            # id 없으면 신규 생성
            if not obj_id:
                drawing_id = upd.get("drawing_id")
                if not drawing_id:
                    logger.warning("객체 생성: drawing_id 누락, 건너뜀")
                    continue
                await self._repo.create({
                    "drawing_id": drawing_id,
                    "examination_id": examination_id,
                    "label": upd.get("label", ""),
                    "bbox_data": upd.get("bbox_data"),
                    "main_cond": upd.get("main_cond"),
                    "sub_cond": upd.get("sub_cond"),
                    "is_manual": True,
                    "sort_order": upd.get("sort_order", 0),
                })
                continue

            obj = await self._repo.get(obj_id)
            if not obj or obj.examination_id != examination_id:
                logger.warning("객체 업데이트: 객체를 찾을 수 없음 (id=%s)", obj_id)
                continue
            if "label" in upd and upd["label"] is not None:
                obj.label = upd["label"]
            if "main_cond" in upd:
                obj.main_cond = upd["main_cond"]
            if "sub_cond" in upd:
                obj.sub_cond = upd["sub_cond"]

            # bbox_data는 마지막에 본다 — 좌표를 비우는 요청이면 같은
            # 요청에 실려 온 옛 조건 값을 여기서 덮어써야 하기 때문이다.
            if "bbox_data" in upd and upd["bbox_data"]:
                had_points = bool((obj.bbox_data or {}).get("points"))
                obj.bbox_data = upd["bbox_data"]

                # 탐지 취소: label은 남기고 좌표만 비운다.
                # label을 지우면 안 되는 이유는 해석 API가 카테고리마다
                # 정해진 label을 전부 요구하기 때문이고(빈 points = "그 객체가
                # 없다"), 실제로 빈 좌표는 '객체 유무 → 무' 해석의 근거가 된다.
                if had_points and not upd["bbox_data"].get("points"):
                    obj.main_cond = None
                    obj.sub_cond = None
                    cleared.append(obj.id)

        await self._repo.flush()
        return cleared


class UpdateInterpretationsService:
    """해석 일괄 수정"""

    def __init__(self, interp_repo: HTPInterpretationRepository):
        self._repo = interp_repo

    async def execute(
        self,
        examination_id: str,
        updates: list[dict],
    ) -> None:
        for upd in updates:
            interp_id = upd.get("id")
            if not interp_id:
                logger.warning("해석 업데이트: id 누락, 건너뜀")
                continue
            interp = await self._repo.get(interp_id)
            if not interp or interp.examination_id != examination_id:
                logger.warning("해석 업데이트: 해석을 찾을 수 없음 (id=%s)", interp_id)
                continue
            for field in (
                "main_category", "sub_category", "sentence",
                "target_name", "is_important", "is_safety", "is_compound",
            ):
                if field in upd:
                    setattr(interp, field, upd[field])
        await self._repo.flush()


class ToggleImportantService:
    """중요 소견 토글"""

    def __init__(self, interp_repo: HTPInterpretationRepository):
        self._repo = interp_repo

    async def execute(
        self,
        examination_id: str,
        interpretation_id: str,
        is_important: bool,
    ) -> HTPInterpretation:
        interp = await self._repo.get(interpretation_id)
        if not interp or interp.examination_id != examination_id:
            raise EntityNotFoundException(f"해석을 찾을 수 없습니다: {interpretation_id}")

        interp.is_important = is_important
        await self._repo.flush()
        await self._repo.refresh(interp)
        return interp
