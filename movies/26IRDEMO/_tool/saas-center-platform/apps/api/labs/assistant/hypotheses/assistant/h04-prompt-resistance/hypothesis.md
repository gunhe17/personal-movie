---
name: h04-prompt-resistance
status: proven
model: 공통 (laguna·gemini 양쪽 실측)
opened: 2026-07-22 (select-lab §23)
closed: 2026-07-28
lab: e1/lab.py (구 responder_datadriven_lab) 외 다수(누적)
results: e1/results.jsonl 외 (누적분은 git 무덤 @ 6bacdfdaa)
decision: 방법론 §4 "처방은 프롬프트보다 코드"
derived_from: - (h01~h03 부정 증거 누적의 메타 승격)
---
# 행동 성향은 프롬프트 문구로 고쳐지지 않는다 (메타 가설)

## 현상 (존재 주장)

모델의 행동 결함을 발견할 때마다 첫 반사는 "지시문을 강화하자"였고, 반복적으로 무효였다.

## 존재 증명 — 누적 실측 (5건 독립)

| 시도 | 결과 |
|---|---|
| 도구 선택 순위를 문구·커널·gloss로 교정 (laguna) | 재현되는 효과는 능력(cover) 토글뿐 — 순위는 노이즈 폭(±30%p) 안 |
| 마크다운 목록 금지 지시 (laguna) | 위반 ~25% 잔존 → 프론트 렌더러가 흡수 (B12) |
| UUID·dev 어휘 노출 금지 지시 (laguna) | 무시 실측 → sanitize 출력단 코드로 강제 |
| "자료에 없는 수치 금지" 강조 (gemini) | 수치 누수 1/3 → 격화판도 정확히 1/3 (responder_datadriven_lab) |
| tool_choice=any API 강제 (laguna) | 아예 무시 3/3 |

**반례(문구가 듣는 경우)도 기록**: 인사서두 금지 1줄(gemini 3/3→0/3, D6) · prefill "그대로 채워라"
(member-profile D8). 구분 기준 — **형식·문체 지시는 듣고, 행동 성향(날조·포기·순위)은 안 듣는다**.

## 귀결 (방법론 등재)

- 행동 결함의 1차 처방 = 코드(가드·sanitize·renderer·grounding)·구조(스코프·히스토리 시범)·데이터(흔적 복원).
- 프롬프트는 형식·문체까지만. 문구 실험은 페어드 1회로 빠르게 기각하고 코드 레버로 이동.

## 판정

proven — 부정 증거 5건 + 경계 조건(형식은 듣는다) 확립. 새 문구-교정 제안은 이 가설을 먼저 반증해야 한다.
