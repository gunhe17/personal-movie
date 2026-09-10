# billing + ai_lab 이니셔티브 loop — 인계분 소진 (진행률 추적)

분리4 중 남은 두 이니셔티브(billing/정산·ai_lab)의 인계분을 실측·판정·집행한다. 모든 판정은 [convention-design.md](archive/convention-design.md) 결정 대장(D1~D19·P1 해소·carve-out·keeper)에 준거 — 재논의 없이 준용한다.

> ## ⚑ 새 세션 이어받기
> - 진행률 = §작업 대장(상태 열이 SSOT). 검증 규율·커밋 규약 = [runtime-restructure.md](archive/runtime-restructure.md)와 동일(boot 577 · 전 스위트 332 passed/59 skipped · 로컬 커밋만 · Co-Authored-By: Claude Opus 4.8 (1M context)).
> - agent 관련은 전부 rebuild 이니셔티브 소관 — 여기서 안 건드린다.

## 실측 요약 (2026-07-07)

- billing ~7.0k줄 / ai_lab ~6.7k줄(82파일).
- 기결정 준용으로 **재작업 금지**: billable+item 다중 repo 6=C(a) keeper · payment 2=C(b) 기해소 · `_legacy_payment` None-deref=묘비 · toss PlanType("") 가드=미구현 보류 · tx 래퍼 언랩=전역 보류 판정 준용(275파일 동류) · docstring/phase cosmetic=hook 수렴 위임.
- `billing_agent_facade.summary.client_name` 대입은 **pydantic DTO(BillableSummary) 주입** — Model mutate 아님, 문제없음(오탐 방지 기록).

## 작업 대장 (상태 열이 SSOT — 슬라이스마다 갱신)

| # | 항목 | 판정 근거 | 성격 | 상태 |
|---|------|----------|------|:----:|
| B1 | credit `adjust_credit` ORM mutate → repo 메서드 (`balance.credit_limit += / credit_used = 0` + flush) | 5-4 인계 실존. 옆 `set_credit_used`는 이미 update_in_place — 이것만 잔재. `find_active_for_update` 락 유지, add=원자 increment·reset=update_in_place | 코드(소액) | `[완료 b04f993bf]` |
| B2 | toss webhook 시크릿 미설정=경고 후 통과 → **명시 실패(503)** | P1 기결정 클래스(f3f6e143f — register_center_holidays 동일 갭을 503으로). 웹훅 라우트는 live, 미설정 통과=서명 무검증 수용 | 코드(보안) | `[완료 b04f993bf]` |
| B3 | 크레딧 TOCTOU 문서화 | D19 확정: "현 갭 유지+문서화"(예약 도입=미요청 신규 설계). check→호출→deduct 사이 비원자 갭을 CreditOps에 주석 명문화 | 문서(주석) | `[완료 b04f993bf]` |
| B4 | webhook settings 직독 경계화 | **판정: 안 함** — 15 findings 면제 목록의 "webhook 의존성함수" 계열(internal_auth 동류). 의존성함수의 시크릿 직독은 §15-3 실이탈로 안 봄 | 판정 | `[닫힘]` |
| A1 | `run_batch_compare` 계층 역행 해소 — module 핸들러가 application handler import(`get_field_note_production_prompts`) | R2 클래스(역행 제거). 핸들러 자체가 크로스도메인 조율(ai_lab 그룹+field_note 프롬프트+storage) → **application/handlers/ai_lab으로 승격**(field_note pipeline router가 application handler 직접 호출하는 기존 선례) | 코드(이동) | `[완료 9f7692efa + A1b 82a8ac2eb]` |
| A2 | `run_batch_compare` 멀티커밋(5회) 분해 | D3 확정 "carve-out 명시+후속 분해". 멀티커밋=장시간 LLM 배치의 변형별 점진 보존(의도). **분해=워커화=응답 계약 변경(동기→비동기) → 사용자 결정 필요, carve-out 주석 명문화만 집행** | 주석+보류 | `[완료 — 주석 9f7692efa · 분해 1abc6cdf7(사용자 결정)]` |
| A3 | ai_lab raw STT 흡수 — `WhisperSTTClient` 직접 생성 3사이트(run_stt_experiment ×2·run_chain_experiment ×1) | D2 "예외 없음"+run_experiment 선례(LLM no-bill 게이트웨이 경유). 게이트웨이 **experiment STT 3종 신설**(no-bill·model override: `experiment_transcribe/_with_timestamps/_with_diarization`) + AIFacade 위임 + 이관 | 코드(중형) | `[완료 903376c51]` |
| A4 | AWS lab 배치 SDK 직접 구동(`_run_aws_text_diarize` — amazon_transcribe 직접) | 11-3 "transport는 infra 제자리" 결. 프로덕션 세션 재사용 불가 사유는 정당(10초 강제취소) — **transport를 `infrastructure/stt/aws/batch.py`로 하강**, ai_lab은 함수 호출만. `get_streaming_provider` 가용성 체크는 `AIFacade.streaming_stt_available()`로 | 코드(이동) | `[완료 903376c51]` |
| A5 | ai_lab experiment 스윕(컨벤션) | 실측: tx 래퍼 1·docstring 10 — 소폭. cosmetic은 hook 수렴 위임(전역 판정 준용) | 판정 | `[닫힘]` |

### 집행 중 발견 (부기)

- **A1 확장(A1b)**: 동일 역행이 module 핸들러 3곳에 추가 실재(run_llm_experiment·playground·run_chain_experiment) → 같은 클래스로 application 승격(82a8ac2eb).
- **회귀 1건 즉시 수정**: run_batch_compare 이동으로 TOOL이 카탈로그 스캔에 노출(modules 분기에선 걸러졌음) → new_agent 유닛 15 실패 → `agent_exposed=False` 부여(ai_lab application 전례)로 green(별도 fix 커밋).
- ruff 소득: ai_lab 이동 잔재 고아 import 5 정리.

## 검증 규율

- 슬라이스마다: 편집 → boot 577 → 전 스위트(332 passed/59 skipped, A3에서 유닛 추가 시 증가) → 커밋(한글 prefix) → **이 표의 상태 열에 해시 부기**.
- A3는 게이트웨이 공개 표면 확장 — 유닛(no-bill 확인: `_record_call` 미호출) 동반.
- 행위보존 원칙: B2(의도된 하드닝)·A3/A4(취득 경로만 변경, 호출 파라미터 동형) 외 동작 변화 금지.

## 커서

> **2026-07-08 — 전건 집행 완료(신설 익일 소진).** B1+B2+B3(b04f993bf) → A1+A2주석(9f7692efa)+TOOL 회귀수정+A1b(82a8ac2eb) → A3+A4(903376c51, 유닛 2 추가 → **334 passed**/59 skipped·boot 577). **A2 분해도 집행 완료(2026-07-08 사용자 결정, 1abc6cdf7)** — runtime/ai_lab 신설(워커화, 응답=pending 그룹). **잔여 0 — loop 종결.** 분리4 잔여는 agent rebuild뿐.
