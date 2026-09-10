"""S1→S2 acceptance gate baseline ledger.

- `fixture-pages.jsonl`: lab PNG 3장(p-007/011/149) → PDF → 새 S1 스모크 결과
  (pages_ok=3, markers_left={}, cost 기록)

재생성 (apps/api, OPENROUTER_API_KEY 필요):

  uv run python scripts/voucher_s1_baseline.py

CI 매 실행 재생성 금지. 대표 매뉴얼 PDF의 S2 code 비교 ledger는
같은 스크립트를 확장하거나 별도 입력으로 추가한다.
"""
