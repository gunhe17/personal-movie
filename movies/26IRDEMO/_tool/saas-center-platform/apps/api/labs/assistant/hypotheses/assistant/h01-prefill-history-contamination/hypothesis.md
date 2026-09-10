---
name: h01-prefill-history-contamination
status: adopted
model: poolside/laguna-s-2.1
opened: 2026-07-27
closed: 2026-07-28
lab: e2/lab.py · e3/lab.py (E1 원본 lab은 미보존 — 커밋 이전 판. e1 기록만 실물, 재현은 e2 근사)
results: e1/results.jsonl · e2/results.jsonl · e3/results.r1-openrouter.jsonl · e3/results.r2-direct.jsonl
decision: D8
derived_from: -
---
# prefill 턴의 텍스트-only 히스토리가 다음 턴의 자발 포기를 유발한다

## 현상 (존재 주장)

WUI 실사용(대화 8048fd3e): "일정 등록해줘"(prefill 성공) 직후 턴 "내일 오후 3시에 김민준 상담
일정 잡아줘"가 **도구 0콜로 "찾을 수 없다" 거짓 부정**. 같은 발화가 새 대화(히스토리 0)에선 정상
완주(query→prefill·인자 채움). 기전 후보: prefill은 `step_tool_result`를 남기지 않아 히스토리
재구성에서 텍스트 쌍만 남음 → "도구 없이 즉답한 시범"으로 보임(도구 흔적 복원 실측 0/5→5/5과 동일 기전).

## 처방 가설

prefill 실행 시 원 도구명을 이벤트에 실어(`origin`), 히스토리 재구성이 prefill 턴을
tool_use/tool_result 흔적으로 복원하면 오염이 사라진다.

## 실험 E1 [소급·탐색] — 3변형 존재 증명 + 1차 처방(origin, input={})

페어드(같은 발화·MANAGER 액터·실DB) — 직전 턴 히스토리 3변형 × N=10 (`e1/results.jsonl`):

| 변형 | query→prefill 완주 |
|---|---|
| text_only (현행 재현 — prefill 턴이 텍스트 쌍만) | **1/9 = 11%** |
| with_trace (prefill 흔적을 tool_use/tool_result로 복원) | **6/9 = 67%** |
| empty (새 대화 대조) | 7/9 = 78% |

기전 예측("흔적 복원 시 소멸") 적중 — 존재 증명 + 처방 방향 확인. **부작용 발견**: 빈 input 복원이
"인자 없이 prefill 호출" 시범이 되어 값 있는 발화에서도 **빈 인자 prefill**(폼 미채움, WUI 실측
`set_fields {"fields": {}}` 2턴 연속) → 기전 문장은 유지되므로 분기 아님, E2로.

## 실험 E2 [소급·탐색] — origin_args 충실 복원 + 인자 품질 판정

`origin_args`(모델이 실제 넘긴 인자)까지 복원 + 랩 판정을 인자 품질로 강화
(`e2/lab.py`, `e2/results.jsonl`): 엄격판정 25% → 57%(대조 67%), bare_prefill 0.

## 실험 E3 [확증] — 등록 환경 문턱 미달 + 사고성 직결 런의 역전 신호 (2026-07-28, `e3/`)

동기 — E1의 v2 백테스트: Δ=+55.6%p · CI95 [22.2, 88.9] · McNemar p=.0625 · N=9 · q=0.99
(N=9는 p<.05가 수학적으로 불가능한 해상도). 사전 등록 = `e3/lab.py` `E3` 상수: 페어드 N=20 ×
[text_only vs with_trace], 격리 세계(fixtures 녹화→동결, 김민준 실봉투), 판정 = 인자 품질 strict.
등록 시점 와이어 = OpenRouter(Anthropic wire).

**r1 — 등록 환경 실행** (`e3/results.r1-openrouter.jsonl`):

```
Δ=+28.6%p · CI95 [−7.1, 64.3] · McNemar p=.289 · N=14(K=1, 등록 20 중 429 페어 6 제외) ·
MDE=44.9%p · q=0.64
```

방향은 가설과 일치(text_only 21% vs with_trace 50%)하나 **승격 불가** — 429 파도가 유효 N을
깎아 해상도 한계. 관측 효과가 E1(+56%p)보다 작아 진효과 ~30%p대 가능성도 열림(N*≈35).

**r2 — 사고성 환경 변경: 직결 와이어** (`e3/results.r2-direct.jsonl`, [탐색] 강등):
재실행 런이 factory 직결 플립(403bd13f7, 같은 워크트리)을 import해 **의도치 않게 다른 와이어**로
주행 — 등록 외 환경. 429 0회·20페어 완주:

```
text_only 17/20(85%) vs with_trace 13/20(65%) · Δ=−20.0%p · CI95 [−45, +5] · McNemar p=.289 · q=0.53
```

**오염 미발현**(OpenRouter 11~21% → 직결 85%) + **방향 역전 신호**(흔적 복원이 −20%p, 미유의).
기전 문장에 와이어 조건이 필요해짐 = **⑥-④ 파생 분기 → [h05](../h05-wire-dependent-contamination/hypothesis.md)**.

기록 사고 2건(교훈): ① 429 재시도 헬퍼를 등록 커밋 뒤·실행 전에 추가(조건 상수 불변 —
등록 커밋 = 실행 직전 커밋 엄수) ② 두 세션이 같은 results.jsonl에 동시 기록(r1 마지막 3페어
인터리브) → 런별 파일 분리로 복구. 향후 lab은 결과 행에 run_id 스탬프.

## 종료 판정

**채택 유지(adopted, D8) + E3 계열은 ⑥-④ 파생 분기로 종료.** A2~A4 충족·소급 조항(§7)으로 판정
유지하되, A1 통계 확증은 미완(r1 해상도 한계)이고 **프로덕션 무대가 직결로 플립**되면서 확증의
장 자체가 h05(와이어 의존성)로 이동 — E4(직결 N=35) 후보는 h05 E1로 대체. 배선:
`execute._prefill`(origin/origin_args) + `engine._history_items`(흔적 복원, 레거시 행 하위호환)
— h05 proven(직결 미발현 확증)으로 실질 무대 소멸: 배선은 존치(무해·레거시 호환), 직결에서의 with_trace 유해성 검증(N*≈71)만 백로그.

## 교훈·반전

**판정은 "도구를 불렀나"가 아니라 인자 품질까지** — E1 judge가 호출 여부만 채점해 빈-인자 함정을
배포 후에야 잡았다. 흔적 복원은 내용까지 충실해야 한다(방법론 §4에 등재).
