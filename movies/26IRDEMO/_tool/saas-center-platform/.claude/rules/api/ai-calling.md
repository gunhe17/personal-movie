---
paths:
  - "apps/api/app/modules/llm/**"
  - "apps/api/app/infrastructure/llm/**"
  - "apps/api/app/infrastructure/stt/**"
---

# AI 호출 — 게이트웨이 단일 경로 (gateway → transport)

모든 AI(LLM/STT) 호출은 `AIGateway`로 수렴한다 — raw transport를 게이트웨이 밖에서 직접 부르지 않는다.

```
consumer(runtime·module handler) → AIGateway(사용량 기록) → infrastructure/llm·stt(순수 transport)
```

- **소비처 표면 = `AIFacade`(실재)**: `create_ai_facade()`([modules/llm/facade/ai_facade.py](../../../apps/api/app/modules/llm/facade/ai_facade.py))로 취득하는 non-uow 래퍼. 소비처(runtime·module handler)는 `create_ai_gateway`를 직접 취득하지 않고 이 facade를 받는다 — facade가 게이트웨이 호출을 위임한다.
- **raw transport 수렴점 = `AIGateway`**: `generate_text`·`generate_json`·`generate_multimodal`·`transcribe*`. facade가 이 메서드들을 위임하고, 게이트웨이가 유일한 transport 진입점이다.

## 규칙

- **소비처는 `create_ai_facade()` 취득** — `create_ai_gateway()` 직접 취득 금지(게이트웨이는 facade 내부 조립 세부). 신규 AI 소비처는 `AIFacade`를 받는다.
- **raw transport 직접 호출 금지 (현재 유효)** — `infrastructure/llm`·`openrouter`·`OpenRouterMultimodalClient` 등을 게이트웨이 밖에서 직접 생성/호출하지 않는다. 텍스트=`generate_text`, JSON=`generate_json`, 멀티모달=`generate_multimodal`, STT=`transcribe*` 경유.
- **크레딧 사전체크 = 게이트웨이 `verify_quota`(실재)** — 호출 전 quota 게이트는 `AIFacade.verify_quota(center_id, purpose)` 경유(HTTP 진입 게이트는 behavior `require_quota` 액션이 이 경로를 소비 — 정산 포함). 게이트웨이가 실제 호출 전 쓰는 quota checker와 동일 경로라, 소비처가 `CreditOps`를 직접 조립하지 않는다. 게이트웨이는 호출 후 **사용량 기록**도 소유한다.
- **기간 정산 = 소비 직전 조율층 시임 (게이트웨이 소관 아님)** — 게이트웨이·`CreditOps`는 기간 정산(요금제 전환+크레딧 리셋)을 모른다(모듈→application 역참조 금지). 과금 purpose(`FREE_PURPOSES` 밖)의 AI 소비 경로는 호출 직전 application 레이어에서 `period_roller.ensure_current_period(center_id)`([application/subscription_period_roller.py](../../../apps/api/app/application/subscription_period_roller.py) — 자체 세션 원자 커밋·멱등·실패 삼킴)를 부른다. **Track B는 `dispatch_job`이 전 잡 자동 커버**(신규 잡 추가 작업 없음) — **신규 in-request 과금 AI를 여는 application handler만 첫머리 1줄 책임**. no-bill 경로(`FREE_PURPOSES`·`run_experiment`)는 대상 아님. 누락 시 크론 backstop 수준(최대 1시간 stale)으로 강등될 뿐 청구 오류는 아니나 관례 위반.
- **스트리밍 STT = 게이트웨이 `transcribe_stream(ctx, sample_rate=)`(실재)** — 세션 개시 시 quota 게이트(`verify_quota` 경로) + transport 취득 + 사용량 기록을 게이트웨이가 소유. 반환 `StreamingTranscription`이 provider 세션을 프록시(feed/get_responses/pause/resume/finish/close)하고 fed bytes로 길이를 환산해 `record_usage()`(멱등)로 기록 — 기록 없이 닫는 경로(유령 세션 eviction)는 `close()`만. 가용성 선확인은 `streaming_stt_available()`.
- **화자분리 과금 = 게이트웨이 `bill_diarize(ctx, duration_seconds=, model=)`(실재)** — 길이 기반 제품 가격의 합성토큰 환산·차감을 게이트웨이가 소유. 전략(integrated/specialized/text-diarize) 무관 단일 시임 — 소비처가 환산 상수(`DIARIZE_TOKENS_PER_MINUTE`)를 직접 들지 않는다.
- **ai_lab 실험 = `AIFacade.run_experiment`(실재)** — 실험 LLM 호출(model override + no-bill)은 `run_experiment(provider=, model=, system_prompt=, user_prompt=, json=, max_tokens=)` 경유. 프로덕션 경로(generate_*)와 달리 quota·과금을 하지 않는다(실험은 과금 대상 아님). ai_lab 실험 LLM 호출·field_note `_text_diarize`(라이브 전사 재사용 라벨링)가 이관됨. **잔존(별 이니셔티브)**: ai_lab STT 실험의 `WhisperSTTClient` 직접 전사(LLM 아님·STT transport). 구 agent transport는 assistant 전환(2026-07-23)으로 소멸 — assistant 루프 LLM은 `runtime/assistant/llm.py`(messenger 경유)가 유일 예외 표면, 과금은 `record_agent_call`(drain-to-zero).
- **Track B executor에서도 동일** — 게이트웨이는 non-uow(자체 세션)라 워커 컨텍스트에서 그대로 성립.
- 게이트웨이가 도메인 모듈을 역참조하지 않는다 — STT 응답 후처리(정규화·hallucination 필터)는 `infrastructure/stt/common/`(provider raw→정규화 struct = infra I/O 계약) 소유. **예외(keeper)**: `resolve_config`가 ai_lab `ProductionAIConfig` 테이블을 직접 select — 이는 도메인 호출이 아니라 게이트웨이의 **config source-of-truth 조회**(AI 호출마다 ai_lab facade를 부르면 순환·핫패스 악화라 테이블 직독이 정본).

## TOOL dict (agent tool-RAG 계약)

핸들러의 `TOOL` dict 규약 — 수집·검증 인프라는 core(tool_loader/registry)가 소유:
- 필수 필드: `name`·`purpose`·`keywords`·`boundaries`·`output`·`input_schema` (`validate()`가 빌드타임 강제).
- `input_schema`에는 **비즈니스 인자만** — `uow`·`audit`·`actor_id`·`ip`·`event_group_id` 등 주입 인자(INJECTED_ARGS) 노출 금지.
- permission 필드는 `core/permissions.py` 카탈로그 값만(validate 대조).

## 안티패턴

- 소비처가 `create_ai_gateway()` 직접 취득 → `create_ai_facade()`
- 게이트웨이/`CreditOps`에 기간 정산 내장(모듈→application 역참조) → 소비 직전 조율층 시임(`period_roller`)
- 신규 in-request 과금 AI handler가 사전 정산 누락 → 첫머리 `period_roller.ensure_current_period` 1줄
- 소비처가 `OpenRouterMultimodalClient()`/openai client 직접 생성 → 게이트웨이 `generate_*`
- ai_lab 실험이 `openai_client(model)`/`openrouter_client(model)` 직접 생성 → `AIFacade.run_experiment(...)`
- 소비처가 `CreditOps(...).check(...)` 직접 → `AIFacade.verify_quota(...)`
- 게이트웨이 우회 크레딧 차감/체크 → 게이트웨이 소유
- TOOL input_schema에 주입 인자 노출 → 비즈니스 인자만
