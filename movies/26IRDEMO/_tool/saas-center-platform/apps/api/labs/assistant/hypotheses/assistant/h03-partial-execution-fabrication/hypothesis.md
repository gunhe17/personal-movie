---
name: h03-partial-execution-fabrication
status: open
model: poolside/laguna-s-2.1 + google/gemini-3.1-flash-lite
opened: 2026-07-27
closed: -
lab: ../../env/prod_lab.py (mt_zero_group) · ../h04-prompt-resistance/e1/lab.py
results: results/prod_lab.jsonl @ 6bacdfdaa (git 무덤), ../h04-prompt-resistance/e1/results.jsonl
decision: - (백로그 P3)
derived_from: h02
---
# 부분-실행 턴의 날조는 가드 사각이며, 코드 grounding으로 차단할 수 있다

## 현상 (존재 주장)

도구를 **하나라도** 부른 턴은 가드 4종(전부 "hop 0 + 도구 0콜" 조건)의 검사가 통째로 꺼진다.
그 사각에서 두 날조가 관측됨:
- **수치 날조**: "상담사별 건수" 발화에 query_member 1콜만 하고 "정상담 0건 / 최치료 0건" 단정
  (per-counselor 조회 없음 — mt_zero_group 재현)
- **화면 날조**: 조회 1콜 후 "화면이 열렸습니다" (page.navigate 이벤트 없음 — prefill_history_lab text_only 변형에서 관측)

## 존재 증명

- mt_zero_group: 1콜 후 "0건" 날조 재현. `_DATA_CLAIM` 정규식엔 잡히는 문구지만 가드 조건(0콜) 미충족으로 검사 자체가 안 일어남 — 문구가 아니라 **조건문 사각**.
- responder 완충 실측: 현행 프롬프트로 무해화 2/3, **수치 누수 1/3**. 격화 프롬프트("자료에 없는 수치 금지" 강조)도 정확히 1/3 — 문구 무력(h04).

## 처방 가설

출력단 **코드 grounding**(sanitize와 같은 결 — 코드는 100% 집행):
1. 최종답에서 `\d+\s*(건|명|회|원)` 수치 추출 (날짜·시각·전화번호 패턴 제외 — 오탐 관리)
2. 허용 집합 = 이번 턴 step_tool_result output·aggregate JSON의 수 + 사용자 발화의 수
3. 근거 없는 수치 포함 문장 제거 + warning 로그, 문장 전멸 시 draft 폴백
4. 화면 날조는 `_CLAIMS_SCREEN` 조건을 "도구 0콜"에서 "이번 턴 page.navigate 이벤트 부재"로 교체(1줄)

## 실험 E1 [확증] — 미실행 (사전 등록 초안)

- ../h04-prompt-resistance/e1/lab.py 확장(새 e폴더로): mt_zero_group 프로브 페어드 [현행 vs +grounding] × N=5
- 판정: 날조전파 1/3 → 0/3 목표 · 컨트롤(정당 수치 답변) 정상 3/3 유지 · 오탐(정당 수치 제거) 0
- 처방이 코드(결정적)라 A1은 **전건 트랙** — 페어드 통계 불요, 대상 케이스 전건 + 컨트롤 무손상으로 판정(§3-A1).
- 확장(P4): "집계 발화 + aggregate 근거 없음" 감지 시 루프 재진입 1회 → "고지→완주" 전환율 측정

## 종료 판정

(미실행 — status: open)
