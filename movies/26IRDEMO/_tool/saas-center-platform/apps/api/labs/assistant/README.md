# labs/assistant — assistant 실측 대장

**가설과 지식이 본체**, 실험 환경 3파일이 받침. 의사결정 대장은
[.claude/loop/assistant.md](../../../../.claude/loop/assistant.md)가 정본.

| 경로 | 소유 |
|---|---|
| [knowledge/](knowledge/README.md) | 사용 모델 지식 — 모델=폴더, 주제 파일(특성·학습방식·계약·운영), 실측만 |
| [hypotheses/](hypotheses/README.md) | 가설 루프 — 가설=폴더(hypothesis.md + `e{N}/` 실험 폴더), 절차·판정 기준 v2 |
| `prod_lab.py` | 공용 실험 환경 + 정본 성능 배터리 + fixture 녹화기 — 실DB+실laguna, responder 미경유. GOLDEN(6)·DOMAIN(22)·HARD(6)·MULTITURN(4). 가설 lab들이 `run_utterance`를 소비(`permissions` 지정 시 DB 미접근 격리 실행) |
| `mockenv.py` | 세계 격리 — `RecordingExecutor`(실DB 녹화)·`MockExecutor`(fixtures 재생, `_dispatch`만 교체) |
| `seed_env.py` | 실측 시드·액터 — MANAGER 권장(COUNSELOR는 owner_scope가 조회를 가려 변수 오염) |
| `stats.py` | 가설 판정 통계 집행(v2) — `report_paired`가 보고 표준형 생성 |

```bash
# apps/api에서
uv run python -m labs.assistant.env.prod_lab --golden 1     # --domain/--hard/--multiturn/--summary/--history
uv run python -m labs.assistant.env.stats                    # 판정 통계 자가검증
uv run python labs/assistant/hypotheses/h01-prefill-history-contamination/e3/lab.py record  # 세계 녹화(실DB 1회)
uv run python labs/assistant/hypotheses/h01-prefill-history-contamination/e3/lab.py run     # 격리 페어드 본실행
uv run python labs/assistant/hypotheses/h04-prompt-resistance/e1/lab.py 3
```

전 도구 공통: 실 LLM 호출(OpenRouter — laguna·gemini), Poolside 429 파도 시 20s 재시도.

## git 무덤 — 종결 실험의 원시 자산 (수치는 아래·knowledge·가설 파일에 전사 완료)

마지막 존재 커밋 **6bacdfdaa** — 복원: `git show 6bacdfdaa:apps/api/labs/assistant/<경로>`

| 경로 | 내용 · 핵심 수치 |
|---|---|
| `responder_lab.py` + `results/responder_lab{,_models,_mt}.jsonl`, `results/responder_contam_boost.jsonl` | responder 채택(D5·D6) 페어드: 단일 60+멀티 28+3모델 66+오염 7 — 오염 회복 0/5→10/10 · 목록 위반 23%→0~5% · +1.4s p50 · +$0.00043/턴 |
| `results/prod_lab.jsonl` | 배터리 원장(발화×config 누적) — 도구 오선택 0/32 · 멀티홉 완주 6/6 · 지연 1.1–2.4s · $0.0000–0.0023/턴 |
| `harness.py` · `seeds.py` | 구 `app.runtime.new_agent` 경로 import — 리네임으로 깨진 고아(소생 불가, 참고용) |

이동(무덤 아님): `prefill_history_lab_r1.jsonl`→`h01-*/e1/results.jsonl` · `prefill_history_lab.{py,jsonl}`→`h01-*/e2/{lab.py,results.jsonl}` · `responder_datadriven_lab.{py,jsonl}`→`h04-*/e1/{lab.py,results.jsonl}`.
