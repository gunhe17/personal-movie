---
name: h05-wire-dependent-contamination
status: proven
model: poolside/laguna-s-2.1
opened: 2026-07-28
closed: 2026-07-28
lab: e2/lab.py (e1은 설계 교체로 중단)
results: e2/results.jsonl · e1/results.aborted.jsonl · 탐색 신호 = ../h01-prefill-history-contamination/e3/results.r2-direct.jsonl
decision: -
derived_from: h01
---
# prefill 히스토리 오염 발현은 와이어 렌더링에 의존한다 — Anthropic wire(OpenRouter)에서 발현, OpenAI 직결 wire에서 미발현

## 현상 (존재 주장)

h01 E3의 사고성 직결 런(r2): 같은 fixtures·같은 발화·같은 strict judge에서 **text_only(오염
재현군) 85% 완주** — OpenRouter 와이어의 11~21%와 극명 대비. 부수 신호: with_trace(D8 흔적
복원)가 직결에선 65%로 오히려 열위(Δ=−20%p·p=.289, 미유의).

기전 후보: 오염은 히스토리 원문이 아니라 **chat template 렌더 결과에 대한 모방** — 직결(OpenAI
wire)은 tool 흔적·system(선행 user 접기) 렌더가 달라 prefill 턴이 "무조회 즉답 시범"으로 보이지
않는다.

## 조사

- [knowledge/laguna 계약.md](../../knowledge/laguna-s-2.1/계약.md) 경로 2 — 직결은 태그 파서 부재·
  system role 붕괴 등 렌더 계층 자체가 다름(실측). 와이어가 행동 변수라는 선행 증거.
- h01 계보 — D8(흔적 복원)은 Anthropic wire를 전제로 채택된 처방. 와이어가 바뀌면 전제가 소멸.
- h04 정합 — 참이면 "직결 전환"은 코드·구조 레버(문구 아님)로 오염을 지우는 처방.

## 존재 증명

(미완 — r2는 [탐색] 레인, 등록 외 환경의 사고성 관측. 확증은 E1 사전 등록 후.)

## 처방 가설

직결 전환 자체가 오염의 구조적 처방(이미 프로덕션 플립됨 — 검증되면 "처방 완료" 소급 판정).
파생 질문: **D8 흔적 복원이 직결 무대에서 무익/유해인가** — 유해로 판명되면 복원 배선을
와이어-조건부로 강등.

## 실험 E1 [확증] — 설계 교체로 중단 (`e1/`, rep 2에서 종료)

두 팔=[openrouter vs direct] 페어드로 등록·개시했으나 **rep 2에서 중단**(`e1/results.aborted.jsonl`).
사유(사용자 결정): openrouter 팔은 동일 조건(같은 fixtures·히스토리·judge) 실측이 이미 누적된
데이터의 재구매 — h01 E1 1/9 + E3 r1 3/14 = **4/23 (17%, Wilson 95% ≈ [7, 37])**. 의사결정에
필요한 미지수는 "직결에서 미발현" 하나 = 단일 팔 문턱 검정으로 충분. 429 파도 비용·지연도 소거.

## 실험 E2 [확증] — 직결 단일 팔 문턱 검정 (`e2/`, 이 커밋 = 등록 커밋 = 실행 직전)

- 직결 와이어 고정(`POOLSIDE_DIRECT=True`), text_only × N=20 · K=1 · m=1.
- **판정: 완주율 Wilson 95% CI 하한 > 40%** — 문턱 40%는 openrouter 누적 상한(37%) 위.
  통과 시 "직결 미발현" 확증(발현 측은 4/23 누적으로 기성립) → 기전 문장 전체 성립.
- 판정 지표: h01 strict judge(인자 품질까지). 행마다 run_id·wire 스탬프.

### 결과·판정

```
success 14/20 (70%) · Wilson 95% [48.1, 85.5] · 문턱 40% → 하한 48.1%로 통과 ·
run_id 1e84582c · e2/results.jsonl
```

- openrouter 누적(4/23=17%, Wilson [7, 37])과 **CI 비중첩** — 와이어 의존 확증.
- r2 탐색 관측(85%)보다 낮은 70% — 직결에서도 런간 변동은 잔존(§6 σ 가정과 정합). 미발현
  주장은 "0%"가 아니라 "문턱(40%) 위로 완주"로 읽는다.

## 종료 판정

**proven (2026-07-28)** — 기전 문장 성립: 같은 오염 히스토리가 Anthropic wire에서 17%,
직결 wire에서 70% 완주. 처방("직결 전환")은 별도 사유(무료·전용 한도·tool_choice)로 이미
프로덕션 배선 — 본 가설은 그 전환이 오염 관점에서도 이득임을 확증. 후속 백로그:
① D8 흔적 복원의 직결 유해성 검증(r2 −20%p 미유의, N*≈71 — 유해 판명 시 와이어-조건부 강등)
② 직결 프로덕션 WUI 실연(A4 습관).
