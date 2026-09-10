"""영역 분리 (이미지 전용, LLM 없음): 표 → 셀 → 중첩표 계층 → LLM 크롭 단위.

image-to-form/core/region_segment.py 이식 + image-to-md 도메인(정부 서식 비교표 —
셀 안에 여러 줄 문단·중첩표가 흔함)에 맞게 확장. 전 과정 LLM 없이 순수 CV.

빈틈없이 · 글자 안 자르고 · 프레임/컬럼 스코프. HWPX 불필요(이미지만).

파이프라인:
  ① 잉크 마스크        gray < INK
  ② 괘선 검출          가로/세로 morphology, 느슨한 밝기(페이지별 자동 계산)+두께 필터
  ③ 표 후보            가로·세로 괘선 공존(교차) 연결덩어리
  ④ 셀                 괘선 반전(흰 영역) 중 표 후보 bbox로 격리해서 적당 크기만
  ⑤ 프레임/표 판단     own-cells: 프레임 ⟺ 자기 소유 셀 0개(임계없음)
  ⑥ 블롭 줄            연결요소 y-band 묶기(성긴 줄·한글 상하획 ±7 병합)
  ⑦ 밴드               셀제외 strip 안, 줄마다, 경계는 빈칸, x범위=프레임/컬럼 폭
  ⑧ 중첩·크롭 단위     표끼리 bbox 포함관계로 부모 판정 → 크롭 경계 계산(compute_nesting/crop_units)

segment(gray) -> {frames, tables, cells, bands, ink, hor, ver, ccol}
compute_nesting(seg) -> {table_bbox: parent_bbox|None}
crop_units(gray) -> ({container_bbox: [nested_table_bbox,...]}, unmatched)

실측(p-011/p-149/p-007)으로 굳어진 것 — 손대지 말 것:
  - 괘선 밝기 임계는 페이지 히스토그램의 가장 어두운 유의미 봉우리+25로 자동 계산
    (_auto_ink_line). 고정값(INK_LINE)은 봉우리를 못 찾을 때만 쓰는 폴백.
  - 얇은 실선은 밝기로 채움과 안 갈린다(둘 다 gray 120~150대에 겹침) — 두께(≤4px)로만 갈린다.
  - 표 후보 bbox 테두리를 인공 벽으로 둘러 로컬 처리해야 함(_cells) — 스캔 원본에 실제로
    없는 바깥 테두리에서 셀이 페이지 배경과 합쳐져 사라지는 걸 막는다.
  - 중첩표 괘선이 외곽표 괘선과 붙어있으면 커넥티드 컴포넌트 하나로 합쳐진다 — 선을
    끊는 시도(erode)는 실패한다(약하면 안 끊기고 세면 다른 선까지 부서짐). 대신 셀을 다
    나눈 뒤 유독 작고 촘촘한(중앙값 30% 미만, 4개 이상, 2행 이상) 무더기를 사후에
    중첩표로 승격(_promote_dense_clusters). 1행짜리는 외곽표 자신의 헤더이니 제외.
  - compute_nesting은 table bbox끼리 직접 포함관계로 봐야 한다(own-cell 경유는 실패).
  - crop_units의 컨테이너는 반드시 region_segment 자체 cells에서만 찾는다 — cv.py 등
    다른 도구의 그리드와 섞으면 존재하는 컨테이너도 못 찾는다(좌표계 격리).
"""
import cv2
import numpy as np

INK = 110       # 잉크(어두운 픽셀) 임계 — 텍스트/블롭 검출용(보수적, 회색 채움 배제)
INK_LINE = 180  # 괘선 후보용 — 느슨. 두께 필터로 채움과 가르므로 밝기는 완화 가능
LINE_THICK = 4  # 이보다 두꺼우면(연속 px) 선이 아니라 회색 채움/글자 블록으로 간주해 제외


def _ink(gray):
    return (gray < INK).astype(np.uint8)


def _auto_ink_line(gray, margin=25):
    """페이지 히스토그램에서 가장 어두운 유의미 봉우리(gray<200, 전체의 0.3%↑)를
    찾아 그보다 margin만큼 밝은 지점을 괘선 임계값으로 — 옅은 실선까지 잡되 다음
    봉우리(회색 채움·배경)는 안 넘어가게. 페이지마다 실측 톤이 달라 고정값보다
    안전(실측: p-007/011/149 세 페이지 다 이 방식이 고정 180과 동일 결과, 값 자체는
    102~152로 제각각)."""
    hist, edges = np.histogram(gray, bins=51, range=(0, 255))
    centers = (edges[:-1] + edges[1:]) / 2
    total = gray.size
    peaks = [c for i, c in enumerate(centers[1:-1], 1)
             if hist[i] > hist[i - 1] and hist[i] > hist[i + 1] and hist[i] > total * 0.003 and c < 200]
    return int(min(peaks) + margin) if peaks else INK_LINE


def _thin_only(mask, axis, thick):
    """두께(axis='h'면 세로방향, 'v'면 가로방향)가 thick px 넘는 부분을 제거.

    실측(p-011 y=1152): 진짜 괘선은 gray127·1px 두께, 헤더 회색 채움은 gray140대·
    56px 두께 — 밝기만으론 안 갈리지만 두께로는 확실히 갈린다.
    """
    k = (1, thick + 1) if axis == "h" else (thick + 1, 1)
    thick_mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, k))
    thick_mask = cv2.dilate(thick_mask, np.ones((3, 3), np.uint8))
    return cv2.bitwise_and(mask, cv2.bitwise_not(thick_mask))


def _ruled(gray, H, W, ink_line=INK_LINE, thick=LINE_THICK):
    """② 가로/세로로 긴 잉크만 추출 → 괘선. 느슨한 밝기 + 두께 필터로 얇은 회색
    실선(임계 근처)도 잡되 두꺼운 채움 블록은 배제."""
    ink_loose = (gray < ink_line).astype(np.uint8)
    hor = cv2.morphologyEx(ink_loose, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(18, W // 18), 1)))
    ver = cv2.morphologyEx(ink_loose, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(12, H // 60))))
    hor = _thin_only(hor, "h", thick)
    ver = _thin_only(ver, "v", thick)
    grid = cv2.dilate(cv2.bitwise_or(hor, ver), cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    return hor, ver, grid


def _table_candidates(grid, hor, ver, H, W):
    """③ 표 후보 = 가로·세로 괘선이 공존하는 연결덩어리(작은 표도 포함)."""
    n, lab, st, _ = cv2.connectedComponentsWithStats(grid, 8)
    out = []
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if w < 0.12 * W or h < 18:
            continue
        m = (lab == i)
        if hor[m].sum() > 40 and ver[m].sum() > 40:
            out.append((x, y, x + w, y + h))
    return out


def _cells(grid, cand, H, W):
    """④ 셀 = 괘선 반전(흰 영역) 중 표 후보 안 + 적당 크기.

    표 후보(cand)마다 로컬로 처리하고 그 bbox 테두리를 인공 벽으로 두른다 — 스캔
    원본에 실제로 없는 바깥 테두리(예: p-011 '변경' 열 오른쪽 — 실측상 선 자체가
    인쇄돼있지 않음)에서 셀의 흰 영역이 표 바깥 페이지 배경과 그대로 합쳐져
    커넥티드 컴포넌트 전체가 배경으로 흡수돼 사라지는 걸 막는다. 전역 페이지
    경계로 필터링하던 방식은 실제 벽이 없는 바깥쪽에서 원리적으로 못 잡았다.
    """
    out = []
    for cx0, cy0, cx1, cy1 in cand:
        cx0, cy0, cx1, cy1 = int(cx0), int(cy0), int(cx1), int(cy1)
        cw, ch = cx1 - cx0, cy1 - cy0
        if cw < 12 or ch < 10:
            continue
        local = grid[cy0:cy1, cx0:cx1].copy()
        local[0, :] = local[-1, :] = 1
        local[:, 0] = local[:, -1] = 1
        inv = (1 - local).astype(np.uint8)
        n, _, st, _ = cv2.connectedComponentsWithStats(inv, 4)
        for i in range(1, n):
            x, y, w, h, a = st[i]
            if x <= 0 and y <= 0 and w >= cw - 1 and h >= ch - 1:
                continue   # 내부 분할이 전혀 없어 인공 벽 안쪽 전체를 그대로 감싼 컴포넌트
            if not (12 <= w and 10 <= h and a > 250 and w < 0.98 * cw and h < 0.98 * ch):
                continue
            out.append((x + cx0, y + cy0, w, h))
    return out


def _cluster_by_proximity(cells, gap=20):
    """인접(gap px 이내로 확장된 bbox가 겹침)한 셀끼리 union-find로 묶는다."""
    n = len(cells)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            i = parent[i]
        return i

    def union(i, j):
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[ri] = rj

    for i in range(n):
        x0, y0, w0, h0 = cells[i]
        for j in range(i + 1, n):
            x1, y1, w1, h1 = cells[j]
            if not (x0 - gap > x1 + w1 or x1 - gap > x0 + w0 or y0 - gap > y1 + h1 or y1 - gap > y0 + h0):
                union(i, j)
    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(cells[i])
    return list(groups.values())


def _promote_dense_clusters(cells, cand):
    """중첩표 괘선이 외곽표 괘선과 물리적으로 붙어있으면 ③에서 하나의 커넥티드
    컴포넌트로 합쳐져 별도 표 후보가 못 된다(p-007 실측: '가구원수' 미니표가 이렇게
    누락됨). 괘선을 끊는 시도(erode)는 실패했다 — 약하면 안 끊기고 세면 페이지의
    다른 진짜 선까지 다 부서짐(이미 1px로 얇아서 깎을 여지가 없음).

    대신 순서를 바꾼다: 일단 그냥 하나로 뭉쳐서 셀을 다 나눈 뒤(④), 그 안에 유독
    작고(같은 후보 내 중앙값의 30% 미만) 촘촘히 몰린(gap 20px 이내) 셀 무더기가
    4개 이상 있으면 "숨은 중첩표"로 승격시킨다 — 괘선 연결이 아니라 이미 나뉜
    칸들의 크기/밀집 패턴으로 사후 판단.
    """
    promoted = []
    for cx0, cy0, cx1, cy1 in cand:
        others = [c for c in cand if c != (cx0, cy0, cx1, cy1)]

        def in_other(c):
            px0, py0, px1, py1 = c[0], c[1], c[0] + c[2], c[1] + c[3]
            return any(ox0 <= px0 and oy0 <= py0 and px1 <= ox1 and py1 <= oy1 for ox0, oy0, ox1, oy1 in others)

        own = [c for c in cells if c[0] >= cx0 and c[1] >= cy0 and c[0] + c[2] <= cx1 and c[1] + c[3] <= cy1
               and not in_other(c)]
        if len(own) < 6:
            continue
        areas = sorted(w * h for x, y, w, h in own)
        med = areas[len(areas) // 2]
        small = [c for c in own if c[2] * c[3] < med * 0.3]
        for cl in _cluster_by_proximity(small):
            if len(cl) < 4:
                continue
            if len({round(c[1] / 10) for c in cl}) < 2:
                continue   # 한 줄짜리(외곽표 자신의 헤더 행 등)는 중첩표 아님 — 최소 2행 있어야 함
            promoted.append((min(c[0] for c in cl), min(c[1] for c in cl),
                              max(c[0] + c[2] for c in cl), max(c[1] + c[3] for c in cl)))
    return promoted


def _classify(cand, cells):
    """⑤ own-cells 판단: 프레임 ⟺ 자기 소유 셀 0개(정의직결·임계없음). 표 ⟺ own≥1.

    프레임은 다른 표를 담기만 하는 테두리(자기 격자 없음). 표는 자기를 셀로 분할.
    """
    own = [0] * len(cand)
    for x, y, w, h in cells:
        cx, cy = x + w // 2, y + h // 2
        ins = [(i, (t[2] - t[0]) * (t[3] - t[1])) for i, t in enumerate(cand) if t[0] <= cx <= t[2] and t[1] <= cy <= t[3]]
        if ins:
            own[min(ins, key=lambda z: z[1])[0]] += 1  # 최소포함 표가 소유
    frames = [t for i, t in enumerate(cand) if own[i] == 0]
    tables = [t for i, t in enumerate(cand) if own[i] >= 1]
    return frames, tables


def _text_lines(ink, cells, H, W):
    """⑥ 블롭 줄: 셀 밖 연결요소를 y-band로 묶음.

    성긴 줄(주소·년월일)도 글자마다 블롭이라 잡히고, ±7 허용으로 한글 상하획을
    한 줄로 병합(줄 간격 >10px 은 분리) → 경계가 글자를 관통하지 않음.
    """
    n, _, st, _ = cv2.connectedComponentsWithStats(ink, 8)

    def in_cell(bx, by, bw, bh):
        cx, cy = bx + bw // 2, by + bh // 2
        return any(x <= cx <= x + w and y <= cy <= y + h for x, y, w, h in cells)

    blobs = sorted([(x, y, w, h) for i in range(1, n) for x, y, w, h, a in [st[i]]
                    if 5 <= h <= 60 and w >= 3 and a >= 18 and not in_cell(x, y, w, h)], key=lambda b: b[1])
    lns = []
    for x, y, w, h in blobs:
        for L in lns:
            if not (y > L[3] + 7 or y + h < L[1] - 7):  # ±7: 상하획 병합, 줄간격 분리
                L[0] = min(L[0], x); L[1] = min(L[1], y); L[2] = max(L[2], x + w); L[3] = max(L[3], y + h)
                break
        else:
            lns.append([x, y, x + w, y + h])
    return sorted([l for l in lns if l[2] - l[0] >= 15 and l[3] - l[1] >= 8], key=lambda l: l[1])


def _content_column(gray, H, W):
    """세로 거터(넓은 빈 컬럼)로 분할 → 잉크 최다 컬럼(사이드바 크롬 제외)."""
    colink = (gray < INK).sum(0)
    guts = []
    s = None
    for x in range(W):
        if colink[x] < H * 0.004:
            if s is None:
                s = x
        elif s is not None:
            if x - s >= 25:
                guts.append((s, x))
            s = None
    if s is not None and W - s >= 25:
        guts.append((s, W))
    bd = [0] + [(a + b) // 2 for a, b in guts] + [W]
    cols = [(bd[i], bd[i + 1]) for i in range(len(bd) - 1) if bd[i + 1] - bd[i] > W * 0.18]
    return max(cols, key=lambda c: int(colink[c[0]:c[1]].sum())) if cols else (0, W)


def _bands(lines, cells, frames, ccol, H, W):
    """⑦ 밴드: 셀제외 strip 안에서 줄마다, 경계는 빈칸, x범위는 프레임→컬럼 폭.

    반환: (x0, y0, x1, y1) 리스트. 셀 영역은 strip 이 끊어 표 관통을 막고,
    x범위는 프레임(있으면)/컨텐츠컬럼(없으면) 으로 한정해 밖으로 안 삐진다.
    """
    cellcov = np.zeros(H, bool)
    for x, y, w, h in cells:
        cellcov[y:y + h] = True
    strips = []
    s = None
    for y in range(H):
        if not cellcov[y]:
            if s is None:
                s = y
        elif s is not None:
            strips.append((s, y)); s = None
    if s is not None:
        strips.append((s, H))

    def xr(cy):
        for fx0, fy0, fx1, fy1 in frames:
            if fy0 <= cy <= fy1:
                return fx0 + 4, fx1 - 4
        return ccol[0] + 4, ccol[1] - 4

    out = []
    for ys, ye in strips:
        sl = sorted([l for l in lines if ys <= (l[1] + l[3]) // 2 < ye], key=lambda l: l[1])
        for i, l in enumerate(sl):
            top = (sl[i - 1][3] + l[1]) // 2 if i > 0 else ys
            bot = (l[3] + sl[i + 1][1]) // 2 if i < len(sl) - 1 else ye
            x0, x1 = xr((l[1] + l[3]) // 2)
            out.append((x0, max(ys, top), x1, min(ye, bot)))
    return out


def segment(gray):
    """그레이 이미지 → 영역 분리 결과 dict."""
    H, W = gray.shape
    ink = _ink(gray)
    hor, ver, grid = _ruled(gray, H, W, ink_line=_auto_ink_line(gray))
    cand = _table_candidates(grid, hor, ver, H, W)
    cells = _cells(grid, cand, H, W)
    promoted = _promote_dense_clusters(cells, cand)
    if promoted:
        cand = cand + promoted
        cells = [c for c in cells if not any(
            px0 <= c[0] and py0 <= c[1] and c[0] + c[2] <= px1 and c[1] + c[3] <= py1
            for px0, py0, px1, py1 in promoted)]
        cells += _cells(grid, promoted, H, W)
    frames, tables = _classify(cand, cells)
    lines = _text_lines(ink, cells, H, W)
    ccol = _content_column(gray, H, W)
    bands = _bands(lines, cells, frames, ccol, H, W)
    return dict(ink=ink, hor=hor, ver=ver, frames=frames, tables=tables, cells=cells, bands=bands, ccol=ccol)


# ── ⑧ 포함관계(중첩) + 크롭 단위 — segment() 결과 위에서 순수 기하로 계산, LLM 없음 ──

def _area(bbox):
    x0, y0, x1, y1 = bbox
    return (x1 - x0) * (y1 - y0)


def _fully_inside(child, parent, pad=3):
    """child bbox 전체가 parent bbox 안에 들어가는지(4모서리 다, 중심점 아님)."""
    cx0, cy0, cx1, cy1 = child
    px0, py0, px1, py1 = parent
    return px0 - pad <= cx0 and py0 - pad <= cy0 and cx1 <= px1 + pad and cy1 <= py1 + pad


def compute_nesting(seg):
    """tables 각각에 대해 부모 표(더 큰 table bbox) 또는 None. 순수 기하, LLM 없음.

    '부모의 own-cell 안에 자식이 들어가는지'로는 안 된다 — _cells()는 중첩표가 있는
    자리를 '하나의 빈 셀'로 안 잡고 중첩표 자신의 잘게 쪼개진 셀들만 잡아서 컨테이너
    셀 자체가 없다. table bbox끼리 직접 포함관계를 보는 쪽이 맞다.
    """
    parent_of = {}
    for t in seg["tables"]:
        parent_of[t] = None
        candidates = [p for p in seg["tables"] if p != t and _fully_inside(t, p)
                      and _area(t) < 0.5 * _area(p)]
        if candidates:
            parent_of[t] = min(candidates, key=_area)   # 가장 작게 감싸는 표 = 직계 부모
    return parent_of


def crop_units(gray):
    """[(container_bbox, [nested_table_bbox, ...]), ...], unmatched — LLM에 실제로
    넣을 크롭 단위. 컨테이너 후보는 오직 seg["cells"](region_segment 자체 결과)에서만
    찾는다 — 다른 도구(image-to-md cv.py)의 그리드와 절대 섞지 않는다(격리). 예전엔
    cv.py 외곽 셀과 대조하다 "컨테이너 없음"으로 오판했는데, 알고보니 region_segment
    자체 cells엔 컨테이너가 처음부터 있었다 — 서로 다른 두 도구의 좌표계를 섞은 게
    원인이었다.
    """
    seg = segment(gray)
    parent_of = compute_nesting(seg)
    nested = [t for t in seg["tables"] if parent_of.get(t) is not None]
    own_cells = [(x, y, x + w, y + h) for x, y, w, h in seg["cells"]]

    units, unmatched = {}, []
    for t in nested:
        containers = [oc for oc in own_cells if _fully_inside(t, oc)]
        if not containers:
            unmatched.append(t)
            continue
        best = min(containers, key=_area)
        units.setdefault(best, []).append(t)
    return units, unmatched
