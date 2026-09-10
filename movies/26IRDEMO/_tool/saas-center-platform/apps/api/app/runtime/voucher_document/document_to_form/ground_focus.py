"""② 대구획 그라운딩의 CV/기하 유틸 + 프롬프트 상수 — LLM unit 빌드·소비는
partition_batch/ground_batch(실행은 runner `run_stage`)가 소유.

    ① region_segment → atoms
    ② SoM 마킹 → LLM 1콜로 원자를 큰 논리 구획으로 묶음(partition_batch)
       _split_big_groups     거대 구획을 소블록으로 분할(cap-split) — 반복 테이블은 통째 유지
    ③ 블록마다 하이라이트 이미지 → 병렬 그라운딩 → clamp·dedup·assign(ground_batch)

근거(lab DECISIONS): 폼 전체가 한 큰 표인 서식은 거대 구획 1콜이 draw마다 '완전열거↔요약'으로
진동(서식15호 57↔16 실측)한다. 소블록으로 쪼개면 매번 안정 완전열거(cap8: 54/55/55).
프롬프트가 아니라 focus 영역 크기가 지렛대. temp 0.5·reasoning low = 실측 확정 최적.
"""
from __future__ import annotations

import base64
from collections import Counter, defaultdict

import cv2
import numpy as np

from .region_segment import segment

PARTITION_MAX_TOKENS = 8000
PARTITION_REASONING = {"effort": "low"}
MAX_BLOCK = 10  # 이보다 큰 대구획은 소블록으로 쪼갬 (거대영역 검출 붕괴 방지)

# Gemini 3은 간결·직접 지시에 가장 잘 반응(장황·복잡한 프롬프트는 과잉분석).
PARTITION_SYS = (
    "번호(0~N-1) 박스로 영역이 표시된 빈 정부서식이다. 이 번호들을 큰 논리 구획으로 묶어라.\n"
    "규칙:\n"
    "1. 하나의 표는 [열 제목 행 + 데이터 본문 전체]를 반드시 한 구획으로. "
    "표의 머리행을 본문과 절대 분리하지 마라.\n"
    "2. 표 위의 큰 제목·안내 문구 밴드는 표와 별개 구획.\n"
    "3. 같은 형식이 반복되는 행들(명단 등)은 그 표 전체를 한 구획으로.\n"
    "4. 구획은 최대 5~6개. 잘게 쪼개지 말 것.\n"
    "5. 모든 번호는 정확히 한 구획에 한 번만. 위치상 인접한 번호끼리만.\n"
    'JSON만: {"groups":[[번호,...],...]}'
)

# 구획 분리 출력 강제 스키마(OpenRouter json_schema strict — batch/realtime 동일).
PARTITION_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "atom_groups",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "groups": {
                    "type": "array",
                    "items": {"type": "array", "items": {"type": "integer"}},
                }
            },
            "required": ["groups"],
            "additionalProperties": False,
        },
    },
}


# 순수 CV/기하 유틸 (lab verbatim)


def _b64(im) -> str:
    return base64.b64encode(
        cv2.imencode(".jpg", im, [cv2.IMWRITE_JPEG_QUALITY, 72])[1]
    ).decode()


def _atom_box_1000(
    rect,
    hw,
):
    """atom (x,y,w,h) px → [ymin,xmin,ymax,xmax] in 0~1000."""
    x, y, w, h = (int(v) for v in rect)
    IH, IW = hw
    return [
        int(y / IH * 1000),
        int(x / IW * 1000),
        int((y + h) / IH * 1000),
        int((x + w) / IW * 1000),
    ]


def _clamp_box_to_region(
    box,
    region_box,
):
    """box를 region_box 안으로 clamp. 면적 0이면 None."""
    by0, bx0, by1, bx1 = (int(v) for v in box)
    ry0, rx0, ry1, rx1 = region_box
    y0 = max(by0, ry0)
    x0 = max(bx0, rx0)
    y1 = min(by1, ry1)
    x1 = min(bx1, rx1)
    if y1 - y0 < 1 or x1 - x0 < 1:
        return None
    return [y0, x0, y1, x1]


def mark_focus_multi(
    img,
    atoms,
    focus_ids,
    dim=0.18,
):
    """블록 하이라이트: focus_ids에 속한 원자 전부 원본 밝기·테두리, 나머지는 어둡게(맥락).
    box 좌표는 페이지 기준(0~1000) 유지 — crop 아님."""
    fs = set(focus_ids)
    out = (img.astype(np.float32) * dim).astype(np.uint8)
    for j, (x, y, w, h) in atoms:
        if j in fs:
            out[y:y + h, x:x + w] = img[y:y + h, x:x + w]
            cv2.rectangle(out, (x, y), (x + w, y + h), (0, 165, 255), 4)
            cv2.rectangle(out, (x, y), (x + 30, y + 18), (0, 140, 255), -1)
            cv2.putText(out, str(j), (x + 3, y + 14), cv2.FONT_HERSHEY_SIMPLEX,
                        0.5, (255, 255, 255), 1, cv2.LINE_AA)
    for j, (x, y, w, h) in atoms:
        if j not in fs:
            cv2.rectangle(out, (x, y), (x + w, y + h), (60, 60, 60), 1)
            cv2.putText(out, str(j), (x + 1, y + 11), cv2.FONT_HERSHEY_SIMPLEX,
                        0.3, (140, 140, 140), 1, cv2.LINE_AA)
    return out


_CIRC = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮"


def _norm_opt(o):
    """옵션 정규화 — 원문자 ①②→1 2, 공백·괄호 제거 (중복 판정용)."""
    o = str(o or "")
    for i, c in enumerate(_CIRC):
        o = o.replace(c, str(i + 1))
    return o.replace(" ", "").translate(str.maketrans("", "", "()（）"))


def _overlap_min(
    a,
    b,
):
    """교집합 / 작은 box 면적. box=[ymin,xmin,ymax,xmax]. 크기 다른 box도 겹침 판정."""
    ay0, ax0, ay1, ax1 = a
    by0, bx0, by1, bx1 = b
    inter = max(0, min(ax1, bx1) - max(ax0, bx0)) * max(0, min(ay1, by1) - max(ay0, by0))
    if inter <= 0:
        return 0.0
    m = min((ax1 - ax0) * (ay1 - ay0), (bx1 - bx0) * (by1 - by0))
    return inter / m if m else 0.0


def dedup_nested(
    elements,
    region_area,
    thr=0.5,
):
    """중첩 영역 이중검출 제거 — SoM이 '큰 블록 + 개별 셀'을 다 만들면 focus가 같은 입력을 두 번 뽑는다.
    같은 type + 정규화 옵션 + box 겹침(작은box 기준 ≥thr)이면 큰 영역(container) 판을 버리고
    작은 영역(leaf 셀) 판을 남긴다. 겹침 없으면(진짜 다른 입력) 안 건드림."""
    drop = set()
    for i, e in enumerate(elements):
        if i in drop or not e.get("box") or len(e["box"]) != 4:
            continue
        for j in range(i + 1, len(elements)):
            f = elements[j]
            if j in drop or not f.get("box") or len(f["box"]) != 4:
                continue
            if e.get("type") != f.get("type") or _norm_opt(e.get("option")) != _norm_opt(f.get("option")):
                continue
            if _overlap_min(e["box"], f["box"]) < thr:
                continue
            ai = region_area.get(e.get("region"), float("inf"))
            aj = region_area.get(f.get("region"), float("inf"))
            drop.add(i if ai >= aj else j)
    return [e for k, e in enumerate(elements) if k not in drop]


def _normalize_groups(groups, n_atoms):
    """중복 제거 + 누락 원자 단독 그룹 보정 → 각 원자가 정확히 한 그룹에."""
    seen = set()
    clean = []
    for g in groups or []:
        gg = [i for i in g if isinstance(i, int) and 0 <= i < n_atoms and i not in seen]
        if gg:
            seen.update(gg)
            clean.append(gg)
    for j in range(n_atoms):
        if j not in seen:
            clean.append([j])
    return clean


def _is_repeating_table(sub, min_rows=3, min_cols=3, frac=0.6):
    """반복 입력 테이블(명단 등) 판정 — 원자들이 [≥min_cols 열 × ≥min_rows 행]의 규칙 격자인가.
    각 행 밴드의 원자 수(=열 수)가 대부분(frac) 같고 ≥min_cols면 반복 테이블 → 자르지 않음.
    라벨|값 2열 폼(행당 2원자)이나 다-□ 밀집 셀은 격자가 아니라 False → 정상 분할."""
    if len(sub) < min_rows * min_cols:
        return False
    hs = sorted(r[3] for _, r in sub)
    band = max(8, hs[len(hs) // 2])
    rows: dict[int, int] = defaultdict(int)
    for _, r in sub:
        rows[int((r[1] + r[3] / 2) / band)] += 1
    counts = list(rows.values())
    if len(counts) < min_rows:
        return False
    mode_n, freq = Counter(counts).most_common(1)[0]
    return mode_n >= min_cols and freq >= len(counts) * frac


def geo_partition(atoms, cap=12, gap_mult=1.8):
    """행 밴딩 기하 분할(LLM 없음, 결정적): 읽기순으로 행을 쌓다가 cap 초과 또는 큰 세로 간격에서 끊음.
    행 중간은 절대 안 자름 → 라벨+입력칸이 다른 블록으로 안 쪼개짐. → 블록 리스트 [[id,...], ...]."""
    if not atoms:
        return []
    hs = sorted(r[3] for _, r in atoms)
    band = max(8, hs[len(hs) // 2])
    ordered = sorted(atoms, key=lambda a: (int((a[1][1] + a[1][3] / 2) / band), a[1][0]))
    rows, cur, ri = [], [], None
    for j, r in ordered:
        k = int((r[1] + r[3] / 2) / band)
        if ri is None or k == ri:
            cur.append((j, r))
            ri = k
        else:
            rows.append(cur)
            cur = [(j, r)]
            ri = k
    if cur:
        rows.append(cur)
    blocks, blk, prev_bot = [], [], None
    for row in rows:
        top = min(r[1] for _, r in row)
        bot = max(r[1] + r[3] for _, r in row)
        gap = (top - prev_bot) if prev_bot is not None else 0
        if blk and (len(blk) + len(row) > cap or gap > band * gap_mult):
            blocks.append([j for j, _ in blk])
            blk = []
        blk.extend(row)
        prev_bot = bot
    if blk:
        blocks.append([j for j, _ in blk])
    return blocks


def _split_big_groups(atoms, groups, cap=MAX_BLOCK):
    """너무 큰 대구획을 geo_partition으로 소블록 분할 → 그라운딩 붕괴(bimodal) 방지.
    작은 대구획은 그대로. 반복 입력 테이블(명단 등 다열 규칙 격자)은 헤더·맥락 유지 위해 통째로 둔다."""
    rectof = {j: r for j, r in atoms}
    blocks = []
    for g in groups:
        sub = [(j, rectof[j]) for j in g if j in rectof]
        if len(g) > cap and not _is_repeating_table(sub):
            blocks.extend(geo_partition(sub, cap=cap))
        else:
            blocks.append(g)
    return blocks


def derive_atoms(img):
    """이미지 → (gray, color, atoms) — segment+atoms_of 결정론 유도(LLM 아님).

    partition_batch·ground_batch 양쪽이 같은 페이지에서 이 함수로 독립 재호출해도
    같은 atoms 를 얻는다(배치 재개 시 재계산 전제 — 저장 안 함)."""
    from . import pipeline  # 순환 import 방지

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    color = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR) if img.ndim == 2 else img
    atoms = pipeline.atoms_of(segment(gray))
    return gray, color, atoms
