"""h09 E1 [탐색·페어드] — 통합 콜 vs 축 분할 콜: M1(부재-축 강제 배치) / M2(축 간 누수) 트레이드오프.

h08 lab 복사 계보. 조작 변인 = 콜 구성(unified: 문항의 전 축 1콜 / split: 축당 1콜,
응답을 병합해 동일 judge로 채점). 나머지(SYSTEM·fixtures·temp 0·judge) 동결.
실행: apps/api에서
    uv run python labs/assistant/hypotheses/h09-axis-split-tradeoff/e1/lab.py run
    uv run python .../e1/lab.py report
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

import httpx

MODELS = [
    "google/gemini-2.5-flash-lite",   # M1 발현 모델 (h08: 기권 2/4) — 검출력 담당
    "anthropic/claude-haiku-4.5",     # M1 무발현 대조 (h08: 기권 4/4)
]
MODES = ["unified", "split"]

E1 = {
    "url": "https://openrouter.ai/api/v1/chat/completions",
    "K": 2,
    "temperature": 0.0,
    "max_tokens": 4000,
}

HERE = Path(__file__).parent
FIXTURES = json.loads((HERE / "fixtures.json").read_text())
RESULTS = HERE / "results.jsonl"

SYSTEM = """한국 정부 바우처 사업 문서에서 정보를 추출하는 캡처기다. 규칙:
1. 문서에 명시된 것만 추출한다. 문서에 없는 축은 반드시 null — 추측·일반지식 보충 금지.
2. 모든 값에 "quote"를 동반한다 — 그 값이 나온 원문 구절을 글자 그대로(마크다운 기호 제거, 공백 정규화 없이 짧게).
3. 출력은 JSON 하나만. 스키마:
{
 "지역": null | {"추진지역": [{"시군": "<문서 표기 그대로>", "quote": "..."}]},
 "소득기준": null | {"없음": true|null, "최대": <중위소득 % 정수>|null, "자격": [..]|null, "판정": "건강보험료"|"소득인정액"|null, "quote": "..."},
 "연령기준": null | {"없음": true|null, "최소": <만 나이 정수>|null, "최대": <만 나이 정수, 미만은 -1 환산>|null, "quote": "..."},
 "욕구기준": null | {"지표": [{"내용": "...", "증빙": ["서류명", ..], "quote": "..."}], "공통증빙_유효기간개월": <정수>|null},
 "금액": null | {"단가": {"금액": <원 정수>, "단위": "회|시간|일|월"}|null, "급여량": {"값": <정수>, "단위": "회|시간", "기간": "주|월|연|총"}|null,
              "한도": [{"값": <원 정수>, "기간": "월|연"}]|null,
              "등급표": [{"구분": "...", "정부지원금": <원 정수>|null, "본인부담금": <원 정수>|null, "quote": "..."}]|null}
}
4. 요청된 축(axes)만 채운다. 축이 문서에 없으면 그 축은 null."""


def _env(key: str) -> str | None:
    env_file = Path(__file__).parents[5] / ".env"
    for line in env_file.read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip()
    return None


def call(
    model: str,
    text: str,
    axes: list[str],
    key: str,
) -> tuple[dict | None, dict]:
    body = {
        "model": model,
        "temperature": E1["temperature"],
        "max_tokens": E1["max_tokens"],
        "response_format": {"type": "json_object"},
        "usage": {"include": True},
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"추출 대상 축: {axes}\n\n<문서>\n{text}\n</문서>\n\n스키마 JSON 하나만 출력."},
        ],
    }
    t0 = time.time()
    try:
        r = httpx.post(E1["url"], json=body, timeout=120,
                       headers={"Authorization": f"Bearer {key}"})
        r.raise_for_status()
    except httpx.HTTPStatusError as e:
        return None, {"http_error": f"{e.response.status_code}: {e.response.text[:300]}"}
    d = r.json()
    meta = {"wall_s": round(time.time() - t0, 2), "usage": d.get("usage", {})}
    try:
        content = d["choices"][0]["message"]["content"]
        content = re.sub(r"^```(json)?|```$", "", content.strip(), flags=re.M).strip()
        return json.loads(content), meta
    except Exception as e:  # noqa: BLE001
        meta["parse_error"] = f"{type(e).__name__}: {e}"
        return None, meta


def _norm(s: str) -> str:
    return re.sub(r"\s+", "", s)


def collect_quotes(node) -> list[str]:
    out = []
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "quote" and isinstance(v, str) and v:
                out.append(v)
            else:
                out += collect_quotes(v)
    elif isinstance(node, list):
        for x in node:
            out += collect_quotes(x)
    return out


def collect_numbers(node) -> list[int]:
    out = []
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "quote":
                continue
            out += collect_numbers(v)
    elif isinstance(node, list):
        for x in node:
            out += collect_numbers(x)
    elif isinstance(node, int) and not isinstance(node, bool) and node > 10:
        out.append(node)
    return out


def judge(
    item: dict,
    r: dict | None,
) -> dict:
    g = item["golden"]
    checks: dict[str, bool] = {}
    if r is None:
        return {"checks": {"json_valid": False}, "quote_ok": 0, "quote_total": 0, "halluc": []}
    checks["json_valid"] = True
    text = item["text"]

    def get(*path):
        node = r
        for p in path:
            if not isinstance(node, dict) or node.get(p) is None:
                return None
            node = node[p]
        return node

    if "소득_최대" in g:
        checks["소득_최대"] = get("소득기준", "최대") == g["소득_최대"]
    if "소득_판정" in g:
        checks["소득_판정"] = g["소득_판정"] in str(get("소득기준", "판정") or "")
    if "소득_없음" in g:
        checks["소득_없음"] = get("소득기준", "없음") is True
    if "소득_null" in g:
        checks["소득_null"] = r.get("소득기준") is None
    if "연령_없음" in g:
        checks["연령_없음"] = get("연령기준", "없음") is True
    if "지역_null" in g:
        checks["지역_null"] = r.get("지역") is None
    if "등급표_행수" in g:
        rows = get("금액", "등급표") or []
        checks["등급표_행수"] = len(rows) == g["등급표_행수"]
    if "등급표_합계" in g:
        rows = get("금액", "등급표") or []
        checks["등급표_합계"] = bool(rows) and all(
            (row.get("정부지원금") or 0) + (row.get("본인부담금") or 0) == g["등급표_합계"]
            for row in rows)
    if "구간_행수" in g:
        rows = get("금액", "등급표") or []
        checks["구간_행수"] = len(rows) == g["구간_행수"]
    if "단가_금액" in g:
        checks["단가_금액"] = get("금액", "단가", "금액") == g["단가_금액"]
    if "단가_1급" in g:
        rows = get("금액", "등급표") or []
        nums = {row.get("정부지원금") for row in rows} | {(row.get("정부지원금") or 0) + (row.get("본인부담금") or 0) for row in rows}
        checks["단가_1급"] = g["단가_1급"] in nums or get("금액", "단가", "금액") == g["단가_1급"]
    if "급여량_값" in g:
        checks["급여량_값"] = get("금액", "급여량", "값") == g["급여량_값"]
    if "한도_월" in g:
        limits = get("금액", "한도") or []
        checks["한도_월"] = any(x.get("값") == g["한도_월"] for x in limits if isinstance(x, dict))
    if "한도_연" in g:
        limits = get("금액", "한도") or []
        checks["한도_연"] = any(x.get("값") == g["한도_연"] for x in limits if isinstance(x, dict))
    if "지표_수" in g:
        rows = get("욕구기준", "지표") or []
        checks["지표_수"] = len(rows) == g["지표_수"]
    if "지표_키워드" in g:
        blob = json.dumps(get("욕구기준", "지표") or [], ensure_ascii=False)
        checks["지표_키워드"] = all(kw in blob for kw in g["지표_키워드"])
    if "유효기간_개월" in g:
        blob = json.dumps(r.get("욕구기준") or {}, ensure_ascii=False)
        checks["유효기간_개월"] = get("욕구기준", "공통증빙_유효기간개월") == g["유효기간_개월"] or f'{g["유효기간_개월"]}개월' in blob
    if "증빙_키워드" in g:
        blob = json.dumps(r.get("욕구기준") or {}, ensure_ascii=False)
        checks["증빙_키워드"] = g["증빙_키워드"] in blob

    quotes = collect_quotes(r)
    tn = _norm(text)
    quote_ok = sum(1 for q in quotes if _norm(q) and _norm(q) in tn)

    halluc = []
    tdigits = re.sub(r"[,\s]", "", text)
    for n in set(collect_numbers(r)):
        forms = {str(n), f"{n:,}", str(n // 10000) if n % 10000 == 0 else str(n)}
        if not any(re.sub(r",", "", f) in tdigits for f in forms):
            halluc.append(n)

    return {"checks": checks, "quote_ok": quote_ok, "quote_total": len(quotes), "halluc": sorted(halluc)}


def run() -> None:
    key = _env("OPENROUTER_API_KEY")
    assert key, "OPENROUTER_API_KEY 없음"
    with RESULTS.open("a") as f:
        for model in MODELS:
            for mode in MODES:
                print(f"═══ {model} · {mode} ═══")
                for item in FIXTURES["items"]:
                    for k in range(E1["K"]):
                        metas = []
                        if mode == "unified":
                            resp, meta = call(model, item["text"], item["axes"], key)
                            metas.append(meta)
                        else:
                            resp = {}
                            for axis in item["axes"]:
                                part, meta = call(model, item["text"], [axis], key)
                                metas.append(meta)
                                resp[axis] = (part or {}).get(axis)
                        verdict = judge(item, resp)
                        cost = sum((m.get("usage") or {}).get("cost") or 0 for m in metas)
                        wall = sum(m.get("wall_s") or 0 for m in metas)
                        row = {"model": model, "mode": mode, "id": item["id"], "k": k,
                               "calls": len(metas), "cost": cost, "wall_s": round(wall, 2),
                               "verdict": verdict, "response": resp}
                        f.write(json.dumps(row, ensure_ascii=False) + "\n")
                        f.flush()
                        ok = sum(verdict["checks"].values())
                        print(f'  {item["id"]} k={k}: checks {ok}/{len(verdict["checks"])} '
                              f'quote {verdict["quote_ok"]}/{verdict["quote_total"]} calls {len(metas)}')


def report() -> None:
    rows = [json.loads(x) for x in RESULTS.read_text().splitlines() if x.strip()]
    fx = {i["id"]: i for i in FIXTURES["items"]}
    groups: dict[tuple, list[dict]] = {}
    for r in rows:
        groups.setdefault((r["model"], r["mode"]), []).append(r)
    print(f'{"모델·모드":48} {"M1 기권":>8} {"M2 경계":>8} {"값정확":>8} {"quote":>7} {"환각":>4} {"콜":>3} {"실비$":>8}')
    M2_KEYS = {"소득_없음", "연령_없음", "구간_행수"}
    for (model, mode), rs in groups.items():
        m1_ok = m1_tot = m2_ok = m2_tot = okc = totc = q_ok = q_tot = hall = calls = 0
        cost = 0.0
        for r in rs:
            item = fx[r["id"]]
            absent_keys = {f'{"소득" if a=="소득기준" else "지역"}_null' for a in item["absent"]}
            for name, passed in r["verdict"]["checks"].items():
                totc += 1
                okc += passed
                if name in absent_keys:
                    m1_tot += 1
                    m1_ok += passed
                if name in M2_KEYS:
                    m2_tot += 1
                    m2_ok += passed
            q_ok += r["verdict"]["quote_ok"]
            q_tot += r["verdict"]["quote_total"]
            hall += len(r["verdict"]["halluc"])
            cost += r["cost"]
            calls += r["calls"]
        print(f'{model.split("/")[-1] + " · " + mode:48} {m1_ok:>3}/{m1_tot:<4} {m2_ok:>3}/{m2_tot:<4} '
              f'{okc:>3}/{totc:<4} {q_ok/max(q_tot,1):>6.0%} {hall:>4} {calls:>3} {cost:>8.4f}')


if __name__ == "__main__":
    {"run": run, "report": report}[sys.argv[1]]()
