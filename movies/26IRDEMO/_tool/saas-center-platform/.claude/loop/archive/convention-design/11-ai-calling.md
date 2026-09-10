# 계층 11 — AI 호출 (LLM/STT) 통일 `[설계완료]`

정본 rule: (신설 예정) `ai-calling.md`. 상위: [convention-design.md](../convention-design.md).

계층 2~10은 static CRUD 슬라이스 중심이라 **AI 호출 표면**(게이트웨이·크레딧·runtime·streaming)을 안 다뤘다. field_note 커버리지 점검에서 이 공백이 드러나(무거운 부분이 loop 그물 밖) 전수 조사 → 통일 규칙으로 신설.

## 11-0. 전수 조사 결과 (ground-truth grep)

| 계층 | 무엇 | 호출처 | 세션/tx | 크레딧 |
|----|------|:---:|------|------|
| **T1 Raw provider** `infrastructure/llm` | openai/openrouter 어댑터 (factory `openai_client`/`openrouter_client`) | raw *호출* ~7파일 (+ DTO import 4) | 없음 | 없음 |
| **T2 AIGateway** `modules/llm/gateway/ai_gateway` | config+quota+호출+사용량기록 중앙 진입점 | 16 소비처(`AIFacade` 경유) | 자체 세션(`AsyncSessionLocal`) | 통합 |
| **T3 CreditOps** `gateway/credit_quota_checker` | 크레딧 check/deduct 프리미티브 | 직접 2 (field_note·agent) | 자체 세션 | subscription 서비스 래핑 |

- 게이트웨이 공개 메서드: `generate_text`·`generate_json`(LLM) · `transcribe`/`transcribe_with_timestamps`/`transcribe_with_diarization`(STT) · `resolve_config` · `record_external_call`(외부에서 직접 호출한 provider 사용량만 기록 — voucher 멀티모달 하이브리드).
- 취득: `create_ai_gateway()` 팩토리 하나가 CreditOps+roller 배선([factory.py:8](../../../apps/api/app/modules/llm/gateway/factory.py#L8)).
- 게이트웨이는 **요청 UoW와 분리된 자체 세션** — "호출 실패해도 사용량 기록 보장"([ai_gateway.py:24](../../../apps/api/app/modules/llm/gateway/ai_gateway.py#L24)). 그래서 background/pipeline/streaming/runtime에서 tx 밖 호출 가능.

## 11-1. 결정 (사용자 2026-07-04)

세 갈림을 **순수주의**로 확정 — cross-module 일관성 > 게이트웨이 특례.

| # | 갈림 | 결정 | 함의 |
|---|------|------|------|
| **D1** | 게이트웨이 지위 | **llm 모듈 facade 경유 강제** (infra 면제 아님) | cross-module 호출은 owning 모듈 facade로. 게이트웨이는 llm 내부 구현. `create_ai_gateway()`/`AIGateway`/`CreditOps` 직접 import 금지(llm 모듈 밖) |
| **D2** | raw 우회 예외 | **예외 없음** (전부 게이트웨이) | AI Lab·agent 런타임·voucher 멀티모달도 게이트웨이 경유. raw `openai_client`/`openrouter_client` 직접 호출은 **게이트웨이 내부에서만** |
| **D3** | 크레딧 사전체크 | **게이트웨이 메서드로 흡수** | `precheck_quota(center_id, purpose)` 신설. 직접 `CreditOps` 호출 2건 이관. 크레딧 로직 게이트웨이 1곳 수렴 |

### D2 경계 — "raw 호출"이 아닌 것 (예외 아님, 금지 대상 아님)
- **정규화 DTO import**: `from app.infrastructure.llm.common.schemas import LLMResponse, Message, MessageRole` — anti-corruption 계약 타입. 호출 아님 → 허용(agent_facade·selector 등).
- **게이트웨이 내부**의 `infrastructure/llm` 사용 — T2가 T1을 쓰는 건 정상 계층 관계.

## 11-2. Canonical — AI 호출 facade 표면 (신설)

D1의 "facade 경유"는 현 llm facade로 안 된다 — `CreditFacade(uow)`·`LlmCallFacade(uow)`는 **uow 바인딩**(요청 tx 내부)인데 게이트웨이는 **자체 세션**(요청 tx 밖)이라 계약이 어긋난다. → **non-uow AI 호출 facade 신설.**

```python
# modules/llm/facade/ai_facade.py  (신설)
class AIFacade:
    """AI 호출 공개 표면. 자체 세션 게이트웨이 래핑 — uow 안 받음(요청 tx 독립).

    cross-module·runtime·pipeline·streaming의 유일한 AI 진입점.
    """
    def __init__(self):
        self._gateway = create_ai_gateway()          # llm 모듈 내부에서만 팩토리 접근

    async def precheck_quota(self, center_id: str, purpose: str) -> None:  # D3 흡수
        await self._gateway.precheck_quota(center_id, purpose)

    async def generate_text(self, *, ctx: AICallContext, ...) -> LLMCallResult: ...
    async def transcribe_with_diarization(self, *, ctx: AICallContext, ...) -> STTCallResult: ...
    async def record_external_call(self, *, ctx: AICallContext, ...) -> None: ...
```

before→after (호출처):
```python
# before (field_note pipeline handler — 게이트웨이 직접 취득 + CreditOps 직접)
from app.modules.llm.gateway.factory import create_ai_gateway
from app.modules.llm.gateway.credit_quota_checker import CreditOps
gateway = create_ai_gateway()
await CreditOps(AsyncSessionLocal).check(center_id, AIPurpose.FIELD_NOTE_STT_DIARIZE)

# after (llm facade 경유 — 게이트웨이/CreditOps 은닉)
from app.modules.llm.facade import AIFacade
ai = AIFacade()
await ai.precheck_quota(center_id, AIPurpose.FIELD_NOTE_STT_DIARIZE)
```

## 11-3. D2 실행이 요구하는 게이트웨이 확장 = 옵션 2 완전 단일화 `[확정: 사용자 2026-07-04]`

"예외 없음"을 달성하려면 게이트웨이가 현재 raw로 우회하던 니즈를 흡수해야 한다. **결정 = 옵션 2(완전 단일화)** — `record_external_call` 하이브리드 제거, 모든 transport를 게이트웨이가 factory로 취득.

**핵심 — "게이트웨이 비대"가 아니라 계층 정상화.** transport(순수 외부호출)는 `infrastructure/llm`에 살아야 한다([infrastructure.md](../../rules/api/infrastructure.md)). 지금 voucher 멀티모달 client가 `runtime/voucher_document`에 얹혀 있는 게 계층 위반. 옵션 2는 이걸 제자리로 되돌린다:

| 우회 현황 | 왜 raw였나 | 옵션 2 흡수 방식 |
|---|---|---|
| **voucher 멀티모달** ([runtime/voucher_document/pdf_to_markdown/client.py](../../../apps/api/app/runtime/voucher_document/pdf_to_markdown/client.py)) | 게이트웨이 `_get_llm_client`가 못 만드는 PDF-multimodal SSE client → 호출 후 `record_external_call`만 | ① SSE client → **`infrastructure/llm/openrouter/`로 이주**(transport 제자리) + factory에 `openrouter_multimodal_client()` ② 게이트웨이 `generate_multimodal()` 신설(취득+quota+record 래핑) ③ `record_external_call` 제거 |
| **AI Lab 실험 4개** ([experiment_run/services](../../../apps/api/app/modules/ai_lab/experiment_run/services/)) | 임의 모델·provider 비교, 과금 없음 | 게이트웨이 **experiment 모드**(`run_experiment`: model/provider override + no-bill, 결과는 caller가 LabExperimentRun에). 어느 옵션이든 필수 |
| **agent 런타임 모델선택** ([runtime/agent/startup.py:13](../../../apps/api/app/runtime/agent/startup.py#L13)) | agent가 자체 모델 관리 | 게이트웨이 model override 경로(experiment 모드 공유) |
| **field_note pipeline_facade:621** ([pipeline_facade.py](../../../apps/api/app/modules/field_note/facade/pipeline_facade.py#L621)) | facade가 raw `openai_client` 직접 | 게이트웨이 `generate_text` 이관(cleanup) |

최종 계층 (transport는 infra, 오케스트레이션은 gateway, 진입은 facade):
```
consumer → AIFacade()[modules/llm/facade] → AIGateway[modules/llm/gateway] → get_*_client()[infrastructure/llm]
                                              (quota+record+오케스트레이션)     (순수 transport: 텍스트·STT·멀티모달)
```
- `record_external_call` **제거** — 모든 transport를 게이트웨이가 factory로 취득하므로 "외부호출 후 영수증만" 샛길 불요.
- 파괴성: voucher SSE client 이주(infrastructure/llm) + 게이트웨이 `generate_multimodal`·`run_experiment` 신설 = behavioral(호출 경로·과금 경로 변경, 테스트 동반).

## 11-4. runtime/** 관장 = `runtime.md` 전반 규칙 신설 `[확정: 사용자 2026-07-04]`

`app/runtime/**`는 **paths-앵커 규칙이 0개** — agent·form_generation·voucher_document 실행 엔진의 호출 규약이 미정의. **결정 = AI 한정이 아니라 runtime 전반 규약(`runtime.md`) 신설**(별도 survey 필요).
- runtime AI 호출 = `AIFacade` 경유(D1/D2 동일). `runtime.md`가 `ai-calling.md`를 인용.
- runtime→domain facade 직접 호출(handler 우회, [facade.md](../../rules/api/facade.md) §P3 agent mutation 엔진 예외)도 `runtime.md`에서 규약화 — 무엇을 import/호출해도 되는지 전반.
- **선행 필요**: runtime 전반 survey(agent·form_generation·form_template·voucher_document·pipeline이 각각 무엇을 import/호출하는지 실측) → 이 계층과 별 슬라이스.

## 11-5. 역참조 위반 — 게이트웨이 → field_note `[설계완료]`

게이트웨이 `transcribe_with_diarization`이 내부에서 **`field_note.pipeline.services.normalize_diarize`를 import**([ai_gateway.py:275](../../../apps/api/app/modules/llm/gateway/ai_gateway.py#L275)) — **llm 게이트웨이(하위 인프라성)가 field_note 도메인 모듈 내부를 역참조.** D1/R1 순수주의와 정면 위반(하위가 상위 도메인 앎).
- normalize = STT 응답 정규화 로직 → **infra STT 어댑터**(`infrastructure/stt/`, provider raw→정규화 struct = infrastructure.md §4 I/O 계약) 또는 게이트웨이 자체 헬퍼로 이동. field_note 참조 제거.
- 비파괴(로직 이동, 반환 동형).

---

## 실행 워크리스트 (계층 11)

| 작업 | 대상 | 파괴성 |
|------|------|:-----:|
| ~~`AIFacade` 신설~~ **완료** | modules/llm/facade/ai_facade.py (non-uow 위임 래퍼) | 집행됨(8b367f7b9) |
| ~~게이트웨이 `precheck_quota`~~ **완료** | ai_gateway.py `precheck_quota` + AIFacade 위임 | 집행됨(1989ad5c5) |
| ~~게이트웨이 취득 이관~~ **완료** | **16 소비처** `create_ai_gateway()` → `create_ai_facade()` | 집행됨(8b367f7b9) |
| ~~직접 CreditOps 이관~~ **완료** | field_note step_diarize · agent **agent_stream_v5** (2) → `precheck_quota` | 집행됨(1989ad5c5) |
| ~~게이트웨이 experiment 모드~~ **완료** | `run_experiment`(model/provider override + no-bill) → ai_lab 4 · field_note _text_diarize. agent 프로덕션 transport는 실험 아님(범위밖) | 집행됨(bc6a74f12) |
| 멀티모달 transport 이주 (D2 옵션2) | voucher SSE client → `infrastructure/llm/openrouter/` + factory `openrouter_multimodal_client()` + 게이트웨이 `generate_multimodal()` + `record_external_call` 제거 | **behavioral**(호출 경로) |
| raw 우회 이관 (D2) | field_note pipeline_facade:621 → 게이트웨이 `generate_text` | behavioral |
| cross-module-write.md 배선 | "AI 호출 = AIFacade 경유(owning llm 모듈)" 명시, 게이트웨이/CreditOps 직접 금지 | 문서 |
| 09-cross-module 배선 | D1 인용(게이트웨이 특례 없음, facade 경유) | 문서 |
| rule 신설 | `ai-calling.md` (paths: gateway + 소비 레이어) | 문서 |
| **11-5 역참조 제거** | 게이트웨이 `transcribe_with_diarization`의 `field_note.normalize_diarize` import → infra STT 어댑터/게이트웨이 헬퍼로 이동 | 비파괴(로직 이동) |
| **runtime.md 신설** | 계층 12로 분리 완료([12-runtime.md](12-runtime.md)) | — |

## 리플
- **field_note 갭 종결**: 필드노트 커버리지 점검의 갭 ②(llm 결합)·부분 ③(streaming llm)이 이 계층으로 흡수.
- **8-4 Track B와 경계**: 무거운 AI *실행*(background enqueue)은 여전히 Track B 별건. 이 계층은 AI *호출 표면·크레딧 경로*만.
- **파괴성 종합**: 대부분 라우팅(비파괴)이나 D2(raw 흡수)·D3(크레딧 경로)는 behavioral → characterization 테스트 동반. 게이트웨이 experiment 모드(11-3)는 선행 신설.
