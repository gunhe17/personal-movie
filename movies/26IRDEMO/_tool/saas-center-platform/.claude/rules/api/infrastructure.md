---
paths:
  - "apps/api/app/infrastructure/**"
---

# Infrastructure — 어댑터 설계 규칙

외부 시스템 어댑터(`llm`/`stt`/`hash`/`token`/`email`/`messaging`/`payment`/`storage`/`cache`/`scheduler`/`rate_limit`/`worker`)의 구조·추상화·취득·예외. 카테고리마다 **계약(`common/`) + 구현(`{provider}/client.py`) + 취득(`factory.py`)** 으로 통일한다.

루트: 깊은 근거·워크드 예시 [guide.md](../../../apps/api/app/infrastructure/guide.md)(`llm`·`stt`) · 영속(DB 커널)은 [persistence-repository.md](persistence-repository.md)(어댑터 추상화 아님, 별도) · HTTP 매핑은 상위 전역 핸들러.

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| 폴더 구조 | `__init__`(docstring) + `factory.py` + `common/` + `{provider}/client.py`. impl은 **항상 서브폴더** |
| common/ | 프리미티브 전용(계약·DTO·예외·util). 단일 provider여도 둔다. 콘텐츠는 별도 폴더 |
| 추상화 | base=행위 / 서브=데이터. 균일 지원 vs superset(미지원=`NotImplementedError`) |
| I/O | keyword primitive in / 타입 있는 struct out. raw 응답·dict 다운그레이드 금지 |
| 예외 | `common/exception.py`에 base + 실패양상별 서브. SDK 예외는 경계에서 래핑(`from e`) |
| factory | 모든 `get_X()` 단일 진입점. provider는 함수명에 인코딩. 키 없으면 `ValueError` |

---

## 1. 폴더 구조

```
{adapter}/
├── __init__.py        docstring만 — 재export 금지
├── factory.py         취득 진입점 (모든 get_X)
├── common/            namespace (= __init__ 없음) — 프리미티브 전용
│   ├── base.py          계약(ABC) + 공통 절차
│   ├── schemas.py       DTO (정규화 입출력 타입)
│   ├── exception.py     모듈 예외 (base + 서브)
│   └── cost.py          부가 util (역할명)
└── {provider}/client.py  구현 + 전용 codec (결합도 높은 짝은 한 파일)
```

- **impl 클래스는 예외 없이 서브폴더**(provider 또는 실행 모드 — `embedded/`·`distributed/`). root엔 `factory.py`·`__init__`·`common/`만 — root에 impl `.py` 금지.
- 예외: **게이트 검증 콜러블**(`internal_auth.py` — behavior `gate()`가 소비하는 순수 verify 함수, provider 추상 없음)은 infrastructure 루트 단독 파일 허용(2026-07-29 소급 등재 — 13줄에 폴더 표준은 과잉). 어댑터 소속이 있으면 그 안에(`payment/toss/webhook.py` 선례).
- `__init__.py`는 root에만, docstring만. 소비처는 서브모듈 직접 import(`from {adapter}.factory import get_X`, `from {adapter}.common.schemas import ...`). 재export 금지 — 단 이미 소비처 수십 곳이 의존하는 **live 고팬아웃** facade(storage·worker)는 유지.
- 결합도 높은 짝은 한 파일, 단일 파일만 남는 폴더는 평탄화.

## 2. common/ — 프리미티브 전용

여러 provider/소비처가 공유하는 **타입·계약**만. 

- **단일 provider여도 모듈-레벨 계약/DTO/예외는 `common/`** — provider가 하나라고 생략하지 않는다(`hash`/`token`/`scheduler`도 `common/base.py`).
- provider-**전용** 예외만 그 provider 폴더(예: `payment/toss/exception.py`).
- "공유된다"는 이유로 임의 코드·콘텐츠를 넣지 않는다 — 콘텐츠 서브도메인(email `templates/` HTML 빌더)은 `common/`이 아니라 별도 형제 폴더. `common/`이 잡동사니 서랍이 되지 않게.

## 3. 추상화 — base 패턴

서브클래스 = 데이터(다른 점만), base = 행위(공통 절차 1곳). 능력 지원 양상으로 두 패턴 중 택1:

| 패턴 | 언제 | 형태 |
|---|---|---|
| 균일 지원 | 모든 provider가 모든 메서드 구현(`llm`) | `base`에 공통 concrete + abstract hook, provider는 다른 점만 |
| superset / 부분 지원 | provider가 능력의 부분집합만(`stt` 전사·스트리밍·화자분리) | 단일 base에 전체 능력 메서드 + 기본 `raise NotImplementedError`, provider는 **지원분만 override** |

- 선택 기준: 능력을 **확장할 여지**가 있고 client별 지원현황을 명시하고 싶으면 superset(트레이드오프 = 미지원은 런타임 `NotImplementedError`). 능력이 영구히 disjoint하고 타입안전 우선이면 분리 contract.
- ABC+Protocol+서브클래스 3겹은 과설계 → 데이터로 내린다. cross-cutting(latency 등)은 데코레이터(`@timed`)로 분리.
- **단일 impl도 ABC+provider 구조 유지**(`token`=`Token`+`jwt`, `scheduler`=`Scheduler`+`apscheduler`) — 균일성 우선(YAGNI보다). `hash`는 `bcrypt`/`sha256` 두 impl.

## 4. I/O 인터페이스

- **입력은 keyword primitive** — 입력 DTO를 따로 만들지 않는다. 모르는 인자는 즉시 `TypeError`(`chat(*, messages, max_tokens, ...)`).
- **출력은 타입 있는 정규화 struct**(`common/schemas.py`). provider raw 응답을 노출하지 않는다(anti-corruption). `dict`/`tuple`로 다운그레이드 금지 — `.field`·타입안전·확장성 상실.
- 출력 struct에 중복 필드 금지(같은 값 두 표현). 의미가 다른 진입점은 유지하되 입력 스타일은 통일.

## 5. 예외

- 모듈 예외는 `common/exception.py`(provider 공유). base 1개 + 실패양상별 서브 — `{Module}Error`(base, `message` 속성) → `*ConfigError`(설정 누락) / `*ProviderError`(제공사 호출 실패). 소비처가 분기 안 하면 서브 안 늘림.
- **봉인은 need-driven** — 감쌀 외부 SDK 예외가 있는 계열만 `exception.py` 필수(storage/boto3·anthropic·cache/redis·worker/redis 등). 순수 in-memory(`rate_limit/memory`)·SDK 예외를 자체 흡수(`token/jwt`가 jose 예외를 decode에서 None으로)하는 계열은 빈 파일 강제 안 함.
- **anti-corruption**: provider SDK 예외를 모듈 밖으로 내보내지 않는다 — 경계(재시도 소진 등)에서 도메인 예외로 래핑(`raise STTProviderError(...) from e`).
- 도메인 예외는 `Exception` 하위 → 기존 `except Exception` 호환. infra는 **던지기만** — HTTP 매핑은 상위 전역 핸들러.

전환하지 않는 것(도메인 예외로 바꾸지 말 것):

| 그대로 두는 것 | 이유 |
|---|---|
| `NotImplementedError` | superset base(§3)의 미지원 능력 표현 — 예외 아님 |
| 데이터로 흐르는 오류 채널(스트리밍 `is_error`) | 오류를 *값*으로 흘리는 프로토콜 — 예외로 바꾸면 프로토콜이 깨짐 |
| 버그성 raw 예외(잘못된 입력 등) | 호출자 버그는 감추지 말고 그대로 — 디버깅 |

## 6. factory — 취득 단일 진입점

- **모든 `get_X()` 취득 함수는 `factory.py` 하나에** — 선택/dispatch 유무·provider 수 무관. 클래스 직접 생성(`SmtpMailer()`)·impl 파일 co-located factory 금지. 소비처는 `from {adapter}.factory import get_X`로만.
- **provider는 함수명에 인코딩** — `openai_client(model)`/`openrouter_client(model)`(문자열 `provider="openai"` 인자 대신). 런타임 문자열 dispatch가 불가피한 곳만 호출처 분기.
- **함수명 = `get_{역할}`이 기본, 접미사는 주는 것의 추상화 레벨을 드러낸다** — `_client`=raw transport(`get_storage_client`·`get_stt_client`·`get_toss_client`) / `_service`=transport 위 조립 서비스(`get_sms_service`·`get_alarmtalk_service`) / 역할명=모듈의 단일 공개 추상화(`get_token`·`get_password_hasher`·`get_scheduler`). 한 모듈이 transport와 그 위 service를 둘 다 노출하면(messaging) 접미사로 가른다. **예외**: provider dispatch는 위처럼 `{provider}_client`(get_ 생략).
- **정책성 선택은 소비 레이어로** — settings 기반 provider 선택은 factory가 아니라 소비처(예: agent startup). factory는 순수 생성만.
- 캐시/싱글톤은 측정된 필요가 있을 때만(`@lru_cache` — `token`). 핫패스는 부팅 1회로 충분.

```python
# good: 단일 진입점 — 함수명이 provider, 캐시는 측정 시
@lru_cache
def get_token() -> Token:
    return Jwt()
```

## 7. 실행 주의 (codemod · 이동 · 검증)

어댑터를 옮기거나 시그니처를 바꿀 때 실제로 깨진 것들:

- **인자 순서/시그니처 변경은 호출처마다 before→after 검토** — 특히 auth(`verify(plain, hashed)` → 인자 스왑). 단위/characterization 테스트는 인프라만 보지 소비처 인자 오류를 못 잡는다. 직접 검토가 유일한 방어.
- **대량 sed는 자기 디렉터리 제외**(`grep -v 'infrastructure/<module>/'`) 후 그 모듈 따로 검증 — codemod가 새 파일 자기참조까지 망가뜨린 적 있음. substring 함정(`create_invitation_token` sed가 `_create_invitation_token`도 변형) → 파일별 스코프 또는 word boundary(BSD sed `[[:<:]]`, macOS는 `\b` 미지원).
- **`git mv` 실패 대비** — infra는 untracked가 많아 `git mv X Y 2>/dev/null || mv X Y`. file↔dir 이름 충돌(`token/jwt.py`↔`token/jwt/`)은 옛 파일 먼저 제거.
- **이동 후 stale 캐시 제거** — import 검증 전 `find <pkg> -name '*.pyc' -delete`. 안 그러면 옛 모듈이 살아있는 듯 통과.
- **동치성 핀** — "주석만 바꿨다"는 docstring 제거 후 `ast.dump` 대조로 증명. `mapped_column(comment=...)`·`# type: ignore`·`# noqa`는 기능 메타라 보존.
- 변환 후 `grep`로 옛 경로/심볼 잔재 0 확인 + 소비처 컴파일.

## 8. 주석

전역 규칙은 [apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md). 기본은 "없음" — 동어반복 docstring·Args/Returns·파일명 재진술 module docstring·장식 배너 금지. 남기는 건 코드가 말 못 하는 것뿐(외부 API 제약·매직넘버 단위·sentinel 의미·재시도/환각 같은 본질 로직의 why), 한 줄로.

---

## 안티패턴

- impl 클래스를 root `.py`에 → `{provider|mode}/client.py`(root는 factory·__init__·common만)
- 단일 provider라고 `common/` 생략 → 모듈-레벨 계약/DTO/예외는 provider 수 무관 `common/`
- "공유되니 common"으로 콘텐츠 흡수(email templates) → `common/`은 프리미티브만, 콘텐츠는 별도 폴더
- 취득 함수가 `factory.py` 밖(직접생성·co-located) → 전부 `factory.py`
- 키 없을 때 다른 provider로 fallback → `ValueError`(조용한 대체 금지)
- provider raw 응답·`dict`/`tuple` 반환 → 타입 있는 `common/schemas.py` struct
- provider SDK 예외를 모듈 밖으로 → 경계에서 `{Module}Error`로 래핑(`from e`)
- `NotImplementedError`·`is_error` 데이터 채널을 도메인 예외로 전환 → 그대로 둔다
- dead 재export(`__init__` 실호출 0) → docstring-only(live 고팬아웃은 예외)
