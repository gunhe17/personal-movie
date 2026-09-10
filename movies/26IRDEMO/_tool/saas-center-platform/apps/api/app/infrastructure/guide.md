# Infrastructure 설계 규칙 (LLM/STT 리팩토링에서 도출)

> `apps/api/app/infrastructure/` 정리에서 합의한 규칙. 워크드 예시는 `llm/`(provider 추상화)와 `stt/`(다중 패러다임).

## 0. 대원칙

- **동작 보존이 기본.** 리팩토링으로 생기는 동작 변화는 *의도된 것만* 허용(버그 수정·정책 변경). 변경 후 HEAD 대비 입출력 동치성을 확인한다.
- **YAGNI.** 측정된 필요가 없는 기능·추상화·최적화는 넣지 않는다. 미사용 경로/투기적 코드는 제거(필요해지면 그때 추가).
- **복잡도를 밖으로 떠넘기지 않는다.** "파일/추상화 하나 줄였다"가 호출처 N곳에 fragility를 퍼뜨리면 손해다.
- **추측 금지, 사용 근거 확인.** "굳이" 후보는 grep으로 실호출을 확인한 뒤 제거.

## 1. 폴더 구조 / 파일 네이밍 (표준)

infra 모듈은 아래 형태로 통일한다:

```
{infra_module}/
├── __init__.py        # 모듈 루트에만. docstring만 — 재export 금지
├── factory.py         # 생성 진입점 (root, "밖으로")
├── common/            # 공통 (namespace 서브패키지, __init__ 없음)
│   ├── base.py        #   계약(ABC/Protocol) + 공통 절차/헬퍼
│   ├── schemas.py     #   DTO (입출력 정규화 타입)
│   ├── exception.py   #   도메인 예외 (base + 서브클래스)
│   └── cost.py        #   부가 유틸 (역할명)
├── openai/            # provider별 폴더 (namespace)
│   └── client.py      #   해당 provider 구현 + 전용 codec
└── openrouter/
    └── client.py
```

**규칙:**
- **`factory.py` = 생성 진입점.** "어디로 들어가는가"가 파일명으로 드러난다. root에 둔다.
- **`{provider}/client.py`** — provider 구현. 결합도 높은 codec은 같은 파일에(분리하지 않음).
  - **impl 클래스는 예외 없이 서브폴더 안**(provider 또는 **실행 모드**, 예: worker `embedded/`·`distributed/`)에 둔다. **module root에 impl `.py` 금지** — root엔 `factory.py`·`__init__`·`common/`만.
- **`common/`** — 여러 provider/소비처가 공유하는 것(계약·DTO·예외·단가). `base.py`/`schemas.py`/`exception.py`/`cost.py`.
  - **`common/`은 "프리미티브 전용"**: 작은 타입·공유 정의(계약/DTO/예외/단가/소형 util)만. **"공유된다"는 이유만으로 임의 코드나 콘텐츠 서브도메인을 넣지 않는다** — 예: email `templates/`(HTML 빌더)는 공유·provider-무관이지만 *콘텐츠 관심사*라 `common/`이 아니라 별도 형제 폴더. (안 그러면 common/이 잡동사니 서랍이 된다.)
  - **단일 provider여도 모듈-레벨 계약/DTO/예외는 `common/`**. provider가 하나라고 common/을 생략하지 말 것. provider-**전용** 예외만 provider 폴더(예: payment `toss/exception.py`).
- **`__init__.py`는 모듈 루트에만**, docstring만. 서브폴더는 namespace(없음). 재export 금지 — 소비처는 **서브모듈 직접 import**.
  - **예외(고팬아웃)**: 소비처 수십 곳이 이미 패키지 재export에 의존하면(예: storage 50+·worker 15+) 제거가 §0("호출처 N곳에 fragility 전파")를 위반한다 → thin facade 재export를 유지한다. 단 재export가 **dead**(실호출 0)면 §5대로 제거(docstring-only).
- **소비처 import 형태**: `from app.infrastructure.{m}.factory import openai_client` / `from app.infrastructure.{m}.common.schemas import ...`.
- **합치는 기준**: 결합도 높은 짝은 한 파일, 단일 파일만 남는 폴더는 평탄화, 순환 의존 유발 합침 금지.

## 2. 추상화 (base 패턴)

- **서브클래스 = 데이터, 베이스 = 행위.** 서브클래스는 다른 점(codec, 엔드포인트)만 지정, 공통 절차는 `common/base.py`에 한 번. (`@timed`로 cross-cutting 분리)
- **추상화 겹 최소화.** 같은 능력을 위한 ABC+Protocol+서브클래스(3겹)는 과설계 → 데이터로 내린다.
- **base는 능력 지원 양상에 따라 두 패턴 중 선택:**
  - **균일 지원** (llm): 모든 provider가 모든 메서드를 구현 → `base`에 공통 concrete(`quick`/`_complete`) + abstract hook(`chat`). provider별 `client`는 다른 점만 채운다.
  - **능력 superset / 부분 지원** (stt): provider가 능력의 부분집합만 구현(전사·스트리밍·화자분리). 단일 `STTProvider` base에 **전체 능력 메서드를 두고 기본 `raise NotImplementedError`**, 각 provider는 **지원하는 것만 override**. 근거: provider가 실제로는 더 지원하지만 아직 안 붙인 것일 수 있고(추후 override만 추가), 각 `client` 파일에서 지원/미지원이 명시적으로 드러난다. 트레이드오프: 미지원 호출은 컴파일이 아닌 **런타임 `NotImplementedError`**.
  - 선택 기준: provider가 능력을 **확장할 여지**가 있고 client별 지원 현황을 명시하고 싶으면 superset, 능력이 영구히 disjoint하고 타입 안전이 우선이면 분리 contract.

## 3. 입력 · 출력 인터페이스

- **입력은 keyword primitive.** 입력용 DTO를 따로 만들지 않는다. 모르는 인자는 즉시 `TypeError`. (`chat(*, messages, max_tokens, ...)`)
- **출력은 타입 있는 정규화 struct.** provider raw 응답을 노출하지 않는다(anti-corruption). **기본 타입(dict/tuple)으로 내리지 않는다** — 타입 안전·`.field`·확장성 상실.
- **출력 struct에 중복 필드 금지.** 같은 값을 두 표현으로 들지 않는다. (`usage`+flat tokens 중복 → flat 통일)
- **의미가 다른 진입점은 유지.** `chat`(Responses) vs `quick`(Chat Completions) 같은 의도된 차이는 합치지 않되 입력 스타일은 통일.

## 4. 예외 (exception)

- **모듈 예외는 `common/exception.py`에 모은다** (provider 공유). 단순 모듈은 `{module}/exception.py`. 기존 `email`/`messaging`/`payment/toss`와 동일 패턴.
- **base 1개 + 실패 양상별 구체 서브클래스.** `{Module}Error`(base, `message` 속성 + `super().__init__(message)`) → `*ConfigError`(설정 누락) / `*ProviderError`(제공사 호출 실패) 등. 소비처가 분기할 일이 없으면 서브를 늘리지 않는다(YAGNI).
- **anti-corruption: provider SDK 예외를 모듈 밖으로 내보내지 않는다.** 경계(예: 재시도 소진)에서 도메인 예외로 래핑 — `raise STTProviderError(...) from e`. 출력 struct anti-corruption(§3)의 에러 버전이다.
- **전환하지 않는 것 (도메인 예외로 바꾸지 말 것):**
  - **`NotImplementedError`** — superset-base(§2)의 미지원 능력 표현. 도메인 예외 아님.
  - **데이터로 전달되는 오류 채널** — 스트리밍의 `is_error` 응답처럼 오류를 *값*으로 흘리는 프로토콜은 예외로 바꾸지 않는다(프로토콜이 깨진다).
  - **버그성 raw 예외** — 잘못된 입력 등 호출자 버그는 감추지 말고 그대로 올린다(디버깅).
- **소비처 호환.** 도메인 예외는 `Exception` 하위 → 기존 `except Exception` 호환. HTTP 매핑은 전역 예외 핸들러/상위 레이어에서 한다(infra는 던지기만).

## 5. 생성(factory)

- **생성 진입점은 `factory.py` 하나.** 호출처마다 복붙된 선택/분기를 흡수.
- **provider별 명시 함수.** `openai_client(model)` / `openrouter_client(model)` — 문자열 `provider="openai"` 인자 대신 **함수명이 provider를 인코딩**. 런타임 문자열 dispatch가 불가피한 곳(실험 등)만 호출처에서 분기.
- **`factory.py` = 모든 모듈의 취득 진입점 (통일·필수).** 모듈의 **모든 `get_X()` 취득 함수는 `factory.py` 하나에 모은다** — 선택/dispatch 로직 유무, provider 수와 무관. impl 클래스는 `{provider}/client.py`, 계약/DTO/예외는 `common/`. 소비처는 **`from {m}.factory import get_X`로만 취득** — 클래스 직접 생성(`SmtpMailer()`)이나 impl 파일에 co-located된 factory 금지. (함수명은 모듈 성격에 맞게: `get_cache_client`·`openai_client(model)` 등 가능하나, **위치는 항상 factory.py**.)
- **fallback 금지, 키 없으면 `ValueError`.** 조용한 대체는 디버깅을 어렵게 한다.
- **정책성 선택은 소비 레이어로.** "settings(AGENT_LLM_PROVIDER) 기반 provider 선택" 같은 도메인 정책은 infra factory가 아니라 소비 레이어(예: agent의 startup)에 둔다. factory는 순수 provider 생성만.
- **캐시/싱글톤은 측정된 필요가 있을 때만.** 핫패스는 부팅 1회 생성으로 충분.

## 6. 죽은 코드 / 미사용

- **실호출 0이면 제거.** 정의·재export·테스트만 있고 호출 없음 = dead.
- **`__init__`은 docstring만** — 재export는 dead 표면.
- **"테스트만 쓰는" 편의 함수도 검토.** 표준 DTO 생성자처럼 가치 있으면 남기되 단순 콤바이너는 제거.

## 7. 주석 · docstring (엄격 — 기본은 "없음")

> 백엔드 전역 규칙은 `apps/api/CLAUDE.md`에 코드화. 아래는 infra 정리에서의 적용.

- **🔁 주석 전에 이름.** 주석을 달고 싶으면 먼저 함수/변수로 추출해 **이름으로 의도를 드러낼 수 없는지** 본다. 코드로 표현 가능하면 주석이 아니라 코드를 고친다.
- **🚫 동어반복 `"""docstring"""` 금지.** 함수/메서드/클래스에 이름·시그니처·본문이 이미 말하는 걸 다시 적는 docstring을 **달지 않는다**. 이게 가장 흔한 군더더기다.
  - 나쁜 예: `def get_diarization_client(): """HUGGINGFACE_TOKEN 미설정 시 None"""` — 코드가 그대로 하는 말.
  - 나쁜 예: `def feed_audio(...): """PCM 오디오 데이터 전송"""`, `class SpeakerSegment: """화자 구간"""`.
- **🚫 Args/Returns 블록 금지.** 타입 힌트로 충분하다. Protocol/ABC 메서드도 이름이 자명하면 docstring 없이 `...`.
- **🚫 파일명/클래스 재진술 module docstring 금지** (예: `"""OpenAI Whisper STT Client"""`). 장식 배너(`# ─`/`# #`), 자명한 인라인, 필드명 옮긴 `Field(description=...)`도 삭제.
- **✅ 남기는 건 "코드가 말 못 하는 것"뿐.** 비자명한 외부 API 제약(예: *Responses API는 input에 "json" 단어가 있어야 json_object 허용*), 단가 단위/매직넘버, sentinel 의미, 의도된 정책(fallback 없음), **알고리즘·재시도·환각·재연결 같은 본질 로직의 WHY**. 이때도 한 줄로.

### 주석 검토 체크리스트 (주석 하나하나에 적용)

1. **다음 줄·함수명·변수명이 이미 말하는가?** → 삭제. (예: `# 결과 파싱`, `# 분할 전사 → 결합`, `# A,B,C 순서로 매핑`)
2. **장식 배너인가?** (`# ── … ──`, `# #`) → 삭제.
3. **제어 흐름을 나레이션하는가?** (`# 첫 호출 시 시작`, `# 큐에 남은 결과 수집`, `# 병합`) → 삭제.
4. **이름/함수 추출로 대체 가능한가?** → 주석 대신 추출.
5. **코드만 봐선 알 수 없는 WHY인가?** (외부 API 제약·매직넘버·sentinel 의미·알고리즘 근거·함정/gotcha) → **한 줄로 보존**.

→ 1~4에 해당하면 지운다(또는 코드로 옮긴다). 5만 남긴다. "이 주석이 없으면 코드를 잘못 고칠 수 있나?"가 보존 판단 기준.

## 8. 코드 스타일

- **흐름 파일(client)은 흐름이 드러나게.** `build → call → parse` 순서. 클래스(흐름) 위, codec 함수(변환 세부) 아래.
- **cross-cutting은 데코레이터로 분리** (`@timed` latency).
- **시그니처는 파라미터 한 줄씩**(trailing comma). **호출 흐름은 중첩 표현식**으로 중간 변수 최소화.

## 9. 검증

- **스코프 한정 테스트로 검증** (무관 디렉터리에서 멈추는 전체 스위트 대신 바뀐 부분만).
- **characterization 테스트로 동치성 핀** (payload·매핑·계약).
- **동작 변화는 HEAD 대비 정밀 대조**해 의도된 것만 남았는지 확인.
- **호출처 반영 확인.** 구조/네이밍 변경 후 소비처가 import하는 **심볼이 실존하는지** + 사라진 옛 경로 참조가 0인지 grep으로 확인하고, 소비처 파일을 컴파일한다.

## 10. 진행 프로세스

- **점검 → 제안 → 합의 → 적용 → 검증** 점진 반복. 큰 변경(기능 제거·구조 변경) 전 확인.
- **독립 조사/검증은 subagent로** (깨끗한 컨텍스트).

---

## 부록 A: llm/ 현재 구조 (워크드 예시)

```
llm/
├── __init__.py        docstring만
├── factory.py         openai_client(model) / openrouter_client(model)
├── common/
│   ├── base.py        LLMProvider(ABC) + @timed + _complete(quick 공통)
│   ├── schemas.py     Message · MessageRole · LLMResponse
│   └── cost.py        단가/추정
├── openai/client.py     OpenAIProvider + Responses codec (chat)
└── openrouter/client.py OpenRouterProvider + Completions codec
```
- 진입점: `from app.infrastructure.llm.factory import openai_client`.
- `chat`(멀티턴, Responses) vs `quick`(단발, Chat Completions) 두 메서드. 입력 keyword, 출력 `LLMResponse`.
- agent의 settings 기반 provider 선택은 `runtime/agent/startup`·`selector`에 인라인(infra factory 아님).

## 부록 A-2: stt/ 현재 구조 (워크드 예시 — superset base + 예외)

```
stt/
├── __init__.py        docstring만
├── factory.py         get_stt_client / get_streaming_provider / get_diarization_client
├── common/
│   ├── base.py        STTProvider(superset, 미지원=NotImplementedError) + StreamingSTTSession(Protocol)
│   ├── schemas.py     STTResponse · SpeakerSegment · TranscriptSegment
│   ├── exception.py   STTError(base) · STTConfigError · STTProviderError
│   └── transcript.py  merge_segments_by_gap
├── whisper/client.py    WhisperSTTClient(전사) + audio/retry/hallucination/prompts
├── aws/client.py        AWSTranscribeStreamingClient + session(스트리밍, is_error 채널)
└── pyannote/client.py   PyAnnoteDiarizationClient(화자분리)
```
- 코드 주석 0 (root `__init__` docstring만).
- 오류: pyannote 토큰 누락 → `STTConfigError`, HF/whisper 제공사 실패 → `STTProviderError`(retry 경계에서 `openai.*` 래핑). AWS 스트리밍 오류는 `STTResponse(is_error=True)` 데이터 채널로 유지.

## 부록 B: 의도된 동작 변화 기록

리팩토링은 동작 보존이 원칙이나 아래는 의도적 변경:
1. **selector 토큰 상한 버그 수정** — 오타 필드(`max_output_tokens`)로 버려져 4096 나가던 것 → 실제 128/256.
2. **키 없을 때 fallback 제거** — openrouter 키 없으면 OpenAI로 폴백하던 것 → `ValueError`.
3. **tool-calling 전 경로 제거** — 처음부터 미사용(dead)이라 삭제.
4. **stt 제공사 예외 도메인화** — pyannote `RuntimeError` → `STTConfigError`/`STTProviderError`, whisper 재시도 소진 시 raw `openai.*` → `STTProviderError`(`from e`). 소비처는 `except Exception`이라 호환.

그 외(요청·응답 변환, JSON 모드, 기본값, 토큰/모델 추출)는 동작 보존.

## 부록 C: 흔한 실수 (적용 중 실제로 저지른 것)

실제로 저지른 배치 오류들. "공유=common", "단일 provider=common 불필요", "합성체니까 root"는 모두 틀림.

**common/ 배치**
1. **단일 provider라고 `common/` 생략** (email). `EmailSendException`은 smtp 전용이 아니라 모듈-레벨 예외인데 root에 뒀다 → `common/exception.py`. 교훈: **모듈-레벨 계약/DTO/예외는 provider 수와 무관하게 `common/`**.
2. **모듈-레벨 프리미티브를 root 방치** (worker). `TaskDispatcher`(계약)·`JobMessage`(DTO)가 root에 있었다 → `common/`. 교훈: **모듈 형태와 무관하게 계약/DTO/util(registry·constants 포함)은 `common/`**.
3. **"공유되니 common"으로 콘텐츠 흡수 충동** (email `templates/`). 공유·provider-무관이라도 *콘텐츠 서브도메인*은 별도 폴더. **`common/`은 프리미티브(타입) 전용**.

**impl / 진입점 배치**
4. **impl 클래스를 root 방치** (messaging `client.py`의 `LguMessagingClient` → `lgu/client.py`; worker `embedded.py`·`distributed.py`·`batch_dispatch.py` → `embedded/client.py`·`distributed/client.py`·`distributed/batch.py`). "합성체라/모드라 root" 논리는 틀림 — provider든 **실행 모드**든 impl은 **항상 서브폴더/client.py**. root엔 `factory.py`·`__init__`·`common/`만. (worker registry·streams도 impl 아닌 util이라 `common/`로.)
5. **진입점 산재/부재** (email 직접생성, payment·messaging co-located, worker `depends.py`). → **모든 `get_X()`는 `factory.py`**(§4).

**재export**
6. **dead 재export** (security: 패키지 import 0인데 `__init__` 재export 유지) → docstring-only(§5). 단 고팬아웃 **live** facade(storage·worker)는 유지.

### 자가 점검 체크리스트 (provider-추상화 모듈마다)
> 적용 대상(표준 구조 = factory+common+provider): llm·stt·cache·storage·messaging·payment·email·worker·**hash·token·scheduler**. **비대상**: persistence(DB 커널)만 — provider 추상화가 아니라 root 파일이 정상.
> 참고: token(`Token`+jwt)·scheduler(`Scheduler`+apscheduler)는 **단일 impl이나 일관성 위해 ABC+provider 구조 적용**(사용자 방침 — §2 YAGNI보다 균일성 우선). 구 `security`는 `hash`+`token`으로 분리(personal-secret hash/ 패턴 채용).
- [ ] root에 `__init__.py`·`factory.py` 외 `.py`가 있나? → impl이면 `{provider|mode}/client.py`, 계약/DTO/예외/util이면 `common/`.
- [ ] `common/`에 base/schemas/exception/cost/util **외**(콘텐츠·임의 코드)가 있나? → 별도 폴더.
- [ ] 취득 함수(`get_X`)가 `factory.py` 밖에 있나? → `factory.py`로.
- [ ] `__init__` 재export가 실호출 0(패키지 import 없음)인가? → docstring-only (고팬아웃 live는 예외).

판별 한 줄: **"이게 모듈의 타입/계약(→`common`)인가, provider 구현(→`{provider}/`)인가, 취득(→`factory`)인가, 콘텐츠(→별도)인가?"**
