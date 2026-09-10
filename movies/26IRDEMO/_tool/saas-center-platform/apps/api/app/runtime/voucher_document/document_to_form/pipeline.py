"""image-to-form 파이프라인 — 서식 이미지 → 배치된 입력 요소 → FormSchema.

  ① 영역분리   region_segment.segment          (CV, LLM 없음)
  ② 대구획     partition_batch / ground_batch   (LLM unit — 실행은 runner `run_stage`)
  ④ 배치       carve.place + carve_slots + 후처리 (CV/OCR: 정확한 위치)
  ⑤ 병합/조립  merge_unit_fields → FormSchema

원칙: LLM=의미(무엇이 입력), CV/OCR=위치(어디에).
"""
from __future__ import annotations

from collections import defaultdict
from statistics import median

import cv2

from . import carve, carve_slots

# ④ 배치 후처리 대상 (타입별)
_BOUND = {"text", "email", "phone", "number", "date", "time"}
_SNAP = {"image"}
_FILL = {"textarea"}

# 타입 → FormSchema 위젯. consent 는 FieldDef 14종으로 정규화(→ checkbox_group)되므로 checkbox 위젯.
WIDGET = {
    "text": "text_box",
    "textarea": "textarea",
    "number": "text_box",
    "date": "date_box",
    "time": "time_box",
    "email": "text_box",
    "phone": "text_box",
    "radio": "radio",
    "checkbox_group": "checkbox",
    "consent": "checkbox",
    "signature": "sign",
    "select": "select",
    "image": "image",
}

# lab consent/checkbox → production FieldDef 14종
_FIELD_TYPE = {
    "consent": "checkbox_group",
    "checkbox": "checkbox_group",
}
_ALLOWED_TYPES = {
    "text",
    "textarea",
    "email",
    "phone",
    "number",
    "date",
    "time",
    "datetime",
    "select",
    "radio",
    "checkbox_group",
    "signature",
    "file",
    "image",
}


def atoms_of(S):
    """분리 결과 → 번호 붙은 원자 [(id, (x,y,w,h))] — cells 먼저, 그 다음 bands."""
    cells = [tuple(c) for c in S["cells"]]
    bands = [(a, b, c - a, d - b) for a, b, c, d in S["bands"]]
    return list(enumerate(cells + bands))


def som_mark(
    img,
    atoms,
):
    """원자마다 번호 박스를 그린 SoM 이미지 (LLM 입력용).
    배지·테두리를 키워 영역 번호가 비전 다운스케일에서도 읽히게 한다(전 영역 동일 → 고정 이미지 캐시 가능)."""
    im = img.copy()
    for j, (x, y, w, h) in atoms:
        label = str(j)
        bw, bh = (34, 22) if j < 10 else (44, 22)
        cv2.rectangle(im, (x, y), (x + w, y + h), (0, 150, 255), 2)
        cv2.rectangle(im, (x, y), (x + bw, y + bh), (0, 120, 255), -1)
        cv2.rectangle(im, (x, y), (x + bw, y + bh), (0, 80, 200), 1)
        cv2.putText(im, label, (x + 4, y + 17), cv2.FONT_HERSHEY_SIMPLEX,
                    0.6, (255, 255, 255), 2, cv2.LINE_AA)
    return im


def _nearest_letter(
    letters,
    cx,
):
    """letter_runs 결과 중 x중심이 cx에 가장 가까운 하나. 닫는 괄호 ')' 등이 letter_runs 필터를
    뚫고 같이 잡혀도, 원본 L/R 위치(cx)에 안 가까우면 고르지 않는다."""
    return min(letters, key=lambda lr: abs((lr[0] + lr[1]) / 2 - cx))


def _unit_of(e):
    """number: LLM이 준 unit. date/time: 라벨에서 단위글자 추출(년/월/일/시/분).
    '생년월일_월'처럼 라벨에 다른 단위글자가 섞이면 끝 글자로 먼저 판단(안 그러면 셋 다 맨 앞 '년'으로 오앵커).
    단, 라벨이 정확히 '생년월일'이면 실제 인쇄 단위글자가 없어 unit 없이 통짜 빈칸으로 둔다."""
    if e.get("unit"):
        return e["unit"]
    if e.get("type") in ("date", "time"):
        lab = e.get("label") or ""
        if lab == "생년월일":
            return None
        return next((c for c in "년월일시분" if lab.endswith(c)), None) \
            or next((c for c in "년월일시분" if c in lab), None)
    return None


def place_elements(
    gray,
    S,
    raw_elements,
):
    """③ LLM 요소 → ④ 배치된 items. 타입별 carve.place + 후처리 + 병합.
    LLM이 검출한 옵션(선택지)을 그대로 받아 위치만 정한다 — 옵션 분할·펼침은 검출(LLM)의 몫이지 carve가 아니다."""
    IH, IW = gray.shape
    cells = S["cells"]
    rectof = {j: r for j, r in atoms_of(S)}
    items = []
    for e in raw_elements:
        bx = e.get("box")
        if not bx or len(bx) != 4:
            continue
        ymin, xmin, ymax, xmax = bx
        x = xmin / 1000 * IW
        y = ymin / 1000 * IH
        w = (xmax - xmin) / 1000 * IW
        h = (ymax - ymin) / 1000 * IH
        if w <= 1 or h <= 1:
            continue
        t = e.get("type", "text")
        opt = e.get("option")
        # number carve(ocr_anchor)는 carve.py에 유지. 배치는 text 경로로 통일.
        ct = "text" if t == "number" else t
        bounds = rectof.get(e.get("region"))  # 배정 SoM region rect → OCR 탐색을 그 안으로 제한
        (rx, ry, rw, rh), corrected, rule = carve.place(
            gray, (x, y, w, h), ct, opt, (IH, IW), None, _unit_of(e), bounds
        )
        if ct in _BOUND and not opt and rule != "_ocr_anchor":
            moved = None
            obox = (int(x), int(y), int(w), int(h))
            if ct in ("text", "textarea") and carve.ink_frac(gray, obox) > 0.06:
                moved = carve.fit_placeholder(gray, obox, (IH, IW))
                if moved:
                    rx, ry, rw, rh = moved
                    corrected = True
                    rule = "_placeholder"
                else:
                    moved = carve.fit_after_label(gray, obox, cells)
                    if moved:
                        rx, ry, rw, rh = moved
                        corrected = True
                        rule = "_after_label"
            if moved is None:
                r2 = carve.fit_bounded(gray, (rx, ry, rw, rh), cells, bounds)
                if r2 != (rx, ry, rw, rh):
                    rx, ry, rw, rh = r2
                    corrected = True
                    rule = "_fit_bounded"
        elif ct in _SNAP and not opt:
            r2 = carve.snap_to_cell((rx, ry, rw, rh), cells)
            if r2 != (rx, ry, rw, rh):
                rx, ry, rw, rh = r2
                corrected = True
                rule = "_snap_cell"
        elif ct in _FILL and not opt:
            r2 = carve.fill_cell((rx, ry, rw, rh), cells)
            if r2 != (rx, ry, rw, rh):
                rx, ry, rw, rh = r2
                corrected = True
                rule = "_fill_cell"
        elif ct == "signature":
            # 라벨 text로 OCR 재검색 먼저 — fit_ink는 괄호를 '테두리'로 오인해 잘라내는 경우가 있다.
            label = e.get("label") or ""
            wb = carve.ocr_word_box(
                gray, (rx, ry, rw, rh), label, (IH, IW), bounds=bounds, allow_wrapped=True
            ) if label else None
            if wb:
                rule = "_ocr_word"
            else:
                wb = carve.fit_ink(gray, (rx, ry, rw, rh))
                rule = "_fit_ink"
            rx, ry, rw, rh = carve.mark_pad(wb, wb[3])
            corrected = True
        items.append({
            "region": e.get("region"),
            "key": e.get("key"),
            "label": e.get("label") or e.get("key") or "",
            "type": t,
            "option": opt,
            "unit": e.get("unit"),
            "rect": tuple(int(v) for v in (rx, ry, rw, rh)),
            "box": tuple(bx),
            "corrected": corrected,
            "rule": rule,
        })
    # ⑤a0 □-스냅: region별 □ 검출 → LLM box 위치로 1:1 배정(중복 방지). checkbox_group·consent 공통.
    def _mark_assign(ftype):
        byr = defaultdict(list)
        for i, it in enumerate(items):
            if it["type"] == ftype:
                byr[it["region"]].append(i)
        for region, idxs in byr.items():
            if region not in rectof:
                continue
            rx, ry, rw, rh = rectof[region]
            marks = carve.find_cb(gray, rx, ry, rw, rh)
            if not marks:
                continue
            used = set()
            for i in sorted(idxs, key=lambda k: (items[k]["box"][0], items[k]["box"][1])):
                ymin, xmin, ymax, xmax = items[i]["box"]
                bx0, bx1 = xmin / 1000 * IW, xmax / 1000 * IW
                by0, by1 = ymin / 1000 * IH, ymax / 1000 * IH
                pad = 0.5 * max(bx1 - bx0, by1 - by0)  # 거리가드: □가 요소 box(±pad) 안일 때만
                bcy = (by0 + by1) / 2
                cand = [(j, m) for j, m in enumerate(marks) if j not in used
                        and bx0 - pad <= m[0] + m[2] / 2 <= bx1 + pad
                        and by0 - pad <= m[1] + m[3] / 2 <= by1 + pad]
                if not cand:  # box 안에 □ 없음 → 개별 결과 유지(먼 오검출 거부)
                    continue
                # □는 'box+라벨' 왼쪽 → box 왼쪽 모서리(bx0) 기준 최근접
                j, m = min(cand, key=lambda jm: (jm[1][0] + jm[1][2] / 2 - bx0) ** 2
                           + (jm[1][1] + jm[1][3] / 2 - bcy) ** 2)
                used.add(j)
                items[i]["rect"] = tuple(int(v) for v in m)
                items[i]["corrected"] = True
                items[i]["rule"] = "_cb_assign"
    _mark_assign("checkbox_group")
    _mark_assign("consent")
    # ⑤a0b 단일글자 radio 쌍: '( L , R )' — place() OCR이 흔들리므로 letter_runs로 재배정 후 mark_pad.
    PAIR_OPTS = (("L", "R"), ("좌", "우"))

    def _pair_key(opt):
        for a, b in PAIR_OPTS:
            if opt in (a, b):
                return (a, b)
        return None

    lrp = defaultdict(dict)
    for i, it in enumerate(items):
        opt = it.get("option")
        pk = _pair_key(opt) if it["type"] == "radio" else None
        if not pk:
            continue
        lab = (it["label"] or "").strip()
        site = "" if lab.replace(" ", "") in pk or lab == opt else lab.rsplit(" ", 1)[0]
        lrp[(it["region"], site, pk)][opt] = i
    for (_region, _site, (oa, ob)), d in lrp.items():
        iA, iB = d.get(oa), d.get(ob)
        if iA is None or iB is None:
            continue

        def _pxbox(i):
            ymin, xmin, ymax, xmax = items[i]["box"]
            return (xmin / 1000 * IW, ymin / 1000 * IH,
                    (xmax - xmin) / 1000 * IW, (ymax - ymin) / 1000 * IH)

        rA, rB = _pxbox(iA), _pxbox(iB)
        hh = max(rA[3], rB[3])
        yy = min(rA[1], rB[1])
        x0 = max(0, min(rA[0], rB[0]) - int(hh * 0.6))
        x1 = min(IW, max(rA[0] + rA[2], rB[0] + rB[2]) + int(hh * 0.6))
        letters = carve.letter_runs(gray, int(x0), int(yy), int(x1), int(yy + hh))
        if len(letters) >= 2:
            cxA, cxB = rA[0] + rA[2] / 2, rB[0] + rB[2] / 2
            ax0, ax1 = _nearest_letter(letters, cxA)
            bx0, bx1 = _nearest_letter(letters, cxB)
            for idx, (x0l, x1l) in ((iA, (ax0, ax1)), (iB, (bx0, bx1))):
                tight = (x0l - 1, int(yy), x1l - x0l + 2, int(hh))
                items[idx]["rect"] = carve.mark_pad(tight, tight[3])
                items[idx]["rule"] = "_radio_pair"
                items[idx]["corrected"] = True
    # ⑤a0c radio slot: 영역 OCR 1회로 보기글자 위치 확정 → option 텍스트 매칭 → mark_pad.
    for i, rect in carve_slots.place_radios(gray, rectof, items).items():
        if items[i].get("rule") != "_radio_pair":
            items[i]["rect"] = rect
            items[i]["rule"] = "_radio_slot"
            items[i]["corrected"] = True
    # ⑤a 촘촘한 날짜행 재카브 (표 셀에 date 2개↑ → 셀에서 빈칸 N개 좌→우). OCR앵커 전원 성공이면 유지.
    dbyr = defaultdict(list)
    for i, it in enumerate(items):
        if it["type"] == "date":
            dbyr[it["region"]].append(i)
    for region, idxs in dbyr.items():
        if len(idxs) < 2 or region not in rectof or rectof[region][3] > 90:
            continue
        if all(items[k]["rule"] == "_ocr_anchor" for k in idxs):
            continue
        idxs.sort(key=lambda k: items[k]["rect"][0])
        for (_, rc), k in zip(
            carve.carve_inline(gray, rectof[region], [str(k) for k in idxs]), idxs
        ):
            items[k]["rect"] = tuple(int(v) for v in rc)
            items[k]["corrected"] = True
            items[k]["rule"] = "_date_inline"
    # ⑤b 단위 중복분할 병합 (급 등)
    drop = carve.merge_unit_fields(items)
    final = [it for i, it in enumerate(items) if i not in drop]
    _unify_row_heights(final)  # ⑤c 같은 행·같은 타입 세로 크기 통일(균형)
    return final


_ALIGN = {
    "text",
    "number",
    "date",
    "time",
    "email",
    "phone",
    "radio",
    "checkbox_group",
    "signature",
}


def _unify_row_heights(items):
    """같은 타입끼리 y-중심으로 행을 묶어(근접 클러스터), 각 행의 높이·세로중심을 median으로 통일.
    가로(x·너비)는 유지. textarea·image·consent(각자 셀/블록 채움)는 제외."""
    by = defaultdict(list)
    for it in items:
        if it["type"] in _ALIGN:
            by[it["type"]].append(it)
    for els in by.values():
        els.sort(key=lambda it: it["rect"][1] + it["rect"][3] / 2)
        rows = [[els[0]]]
        for it in els[1:]:
            prev = rows[-1][-1]["rect"]
            c = it["rect"][1] + it["rect"][3] / 2
            if abs(c - (prev[1] + prev[3] / 2)) <= max(10, 0.7 * prev[3]):
                rows[-1].append(it)
            else:
                rows.append([it])
        for row in rows:
            row.sort(key=lambda it: it["rect"][0])
            H0 = median(it["rect"][3] for it in row)
            groups = [[row[0]]]
            for it in row[1:]:
                pr = groups[-1][-1]["rect"]
                gap = it["rect"][0] - (pr[0] + pr[2])
                if gap <= max(120, 6 * H0):
                    groups[-1].append(it)
                else:
                    groups.append([it])
            for cl in groups:
                if len(cl) < 2:
                    continue
                H = int(median(it["rect"][3] for it in cl))
                CY = median(it["rect"][1] + it["rect"][3] / 2 for it in cl)
                for it in cl:
                    x, y, w, h = it["rect"]
                    it["rect"] = (x, int(CY - H / 2), w, H)
                # 라디오(숫자 scale·남/여)만 폭 통일 — 보기글자 중심 고정, 대칭.
                byu = defaultdict(list)
                for it in cl:
                    byu[it.get("unit") or ""].append(it)
                for us in byu.values():
                    if len(us) < 2 or us[0]["type"] != "radio":
                        continue
                    W = int(median(it["rect"][2] for it in us))
                    for it in us:
                        x, y, w, h = it["rect"]
                        it["rect"] = (int(x + w / 2 - W / 2), y, W, h)


def _norm_field_type(t: str) -> str:
    t = _FIELD_TYPE.get(t, t)
    return t if t in _ALLOWED_TYPES else "text"


def to_form_schema(
    built,
    image_name: str = "form.png",
) -> dict:
    """배치 결과 → FormSchema dict (validate_form_schema 로 검증 가능)."""
    IW, IH = built["page"]["w"], built["page"]["h"]
    fields, elements = {}, []
    for it in built["elements"]:
        k = it["key"] or it["label"]
        if not k:
            continue
        t = _norm_field_type(it["type"])
        opt = it.get("option")
        if k not in fields:
            fd = {"type": t, "label": it["label"]}
            if it.get("unit"):
                fd["validation"] = {"unit": it["unit"]}
            fields[k] = fd
        if opt:
            fields[k].setdefault("options", [])
            if not any(o["value"] == str(opt) for o in fields[k]["options"]):
                fields[k]["options"].append(
                    {"value": str(opt), "label": str(opt)}
                )
        x, y, w, h = it["rect"]
        el = {
            "id": f"e{len(elements)}",
            "page": 1,
            "rect": [
                round(x / IW, 4),
                round(y / IH, 4),
                round(w / IW, 4),
                round(h / IH, 4),
            ],
            "widget": WIDGET.get(it["type"], WIDGET.get(t, "box")),
            "field_refs": [k],
        }
        if opt is not None:
            el["option"] = str(opt)
        elements.append(el)
    return {
        "pages": [{"no": 1, "image": image_name, "w": IW, "h": IH}],
        "fields": fields,
        "elements": elements,
    }
