"""h08 E1 [탐색·페어드] — 바우처 캡처 후보 모델 슈트아웃.

h07 e1 lab의 복사본(규약: 실험 기구는 공유 모듈로 뽑지 않는다)에 다모델 루프만 추가.
동결 요소(사전 설계 — 실행 전 커밋): fixtures(골든 교정본)·SYSTEM 프롬프트(h07과
byte 동일 — 지시준수도 측정 대상)·judge·K=2·temp 0·MODELS 5종.
실행: apps/api에서
    uv run python labs/assistant/hypotheses/h08-capture-model-shootout/e1/lab.py run [모델id ...]
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
    "google/gemini-2.5-flash-lite",   # h07 베이스라인 — 동일 런 재실행(페어드)
    "google/gemini-2.5-flash",        # 같은 계열 한 단계 위
    "anthropic/claude-haiku-4.5",     # 조사 대안 후보
    "anthropic/claude-sonnet-5",      # 품질 상한
    "openai/gpt-5.4-nano",            # HHEM 최상위(3.1%·응답 100%)
]

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
    except Exception as e:  # noqa: BLE001 — 파싱 실패도 소견
        meta["parse_error"] = f"{type(e).__name__}: {e}"
        meta["raw"] = str(d)[:600]
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
    if "연령_최대" in g:
        checks["연령_최대"] = get("연령기준", "최대") == g["연령_최대"]
    if "연령_없음" in g:
        checks["연령_없음"] = get("연령기준", "없음") is True
    if "지역_null" in g:
        checks["지역_null"] = r.get("지역") is None
    if "추진_수" in g:
        rows = get("지역", "추진지역") or []
        checks["추진_수"] = len(rows) == g["추진_수"]
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


# 핵심 4지표(채택 문턱) vs 보조(지시준수 — 환산·선별 규칙)
CORE_ABSTAIN = {"소득_null", "지역_null"}
COMPLIANCE = {"연령_최대", "추진_수"}


def run(models: list[str]) -> None:
    key = _env("OPENROUTER_API_KEY")
    assert key, "OPENROUTER_API_KEY 없음"
    with RESULTS.open("a") as f:
        for model in models:
            print(f"═══ {model} ═══")
            for item in FIXTURES["items"]:
                for k in range(E1["K"]):
                    resp, meta = call(model, item["text"], item["axes"], key)
                    verdict = judge(item, resp)
                    row = {"model": model, "id": item["id"], "k": k,
                           "meta": meta, "verdict": verdict, "response": resp}
                    f.write(json.dumps(row, ensure_ascii=False) + "\n")
                    f.flush()
                    if "http_error" in meta:
                        print(f'  {item["id"]} k={k}: HTTP 오류 {meta["http_error"][:80]}')
                        break
                    ok = sum(verdict["checks"].values())
                    print(f'  {item["id"]} k={k}: checks {ok}/{len(verdict["checks"])} '
                          f'quote {verdict["quote_ok"]}/{verdict["quote_total"]} '
                          f'halluc {len(verdict["halluc"])} wall {meta.get("wall_s")}s')
                else:
                    continue
                break  # 모델 자체 오류(404 등)면 다음 모델로


def report() -> None:
    rows = [json.loads(x) for x in RESULTS.read_text().splitlines() if x.strip()]
    by_model: dict[str, list[dict]] = {}
    for r in rows:
        by_model.setdefault(r["model"], []).append(r)
    print(f'{"모델":38} {"값정확":>10} {"quote":>10} {"환각":>4} {"기권":>5} {"지시":>5} {"불안정":>4} {"평균s":>6} {"실비$":>8}')
    for model, rs in by_model.items():
        errs = [r for r in rs if "http_error" in r["meta"]]
        if errs and len(errs) == len(rs):
            print(f'{model:38} HTTP 오류: {errs[0]["meta"]["http_error"][:70]}')
            continue
        rs = [r for r in rs if "http_error" not in r["meta"]]
        okc = totc = q_ok = q_tot = ab_ok = ab_tot = cp_ok = cp_tot = 0
        halluc = 0
        cost = walls = 0.0
        stable = {}
        for r in rs:
            v = r["verdict"]
            for name, passed in v["checks"].items():
                totc += 1
                okc += passed
                if name in CORE_ABSTAIN:
                    ab_tot += 1
                    ab_ok += passed
                if name in COMPLIANCE:
                    cp_tot += 1
                    cp_ok += passed
            q_ok += v["quote_ok"]
            q_tot += v["quote_total"]
            halluc += len(v["halluc"])
            cost += (r["meta"].get("usage") or {}).get("cost") or 0
            walls += r["meta"].get("wall_s") or 0
            stable.setdefault(r["id"], []).append(tuple(sorted(v["checks"].items())))
        unstable = sum(1 for ks in stable.values() if len(set(ks)) > 1)
        print(f'{model:38} {okc:>3}/{totc:<3}{okc/max(totc,1):>4.0%} '
              f'{q_ok:>4}/{q_tot:<4}{q_ok/max(q_tot,1):>3.0%} {halluc:>4} '
              f'{ab_ok}/{ab_tot:<3} {cp_ok}/{cp_tot:<3} {unstable:>4} '
              f'{walls/max(len(rs),1):>6.2f} {cost:>8.4f}')


if __name__ == "__main__":
    if sys.argv[1] == "run":
        run(sys.argv[2:] or MODELS)
    else:
        report()
