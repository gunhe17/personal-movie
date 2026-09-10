# 계층 15 — infrastructure 어댑터 (`app/infrastructure/**`)

> 정본 rule: [infrastructure.md](../../rules/api/infrastructure.md)(이미 존재·성숙) + [guide.md](../../../apps/api/app/infrastructure/guide.md)(워크드 예시 llm/stt) + [infrastructure/CLAUDE.md](../../../apps/api/app/infrastructure/CLAUDE.md).
> 조사: "완전 커버리지" 확대에서 발견 — 규칙은 있으나 이 loop의 설계-계층 감사 미수행(100 py, 어댑터 계열 多). 계층 3=persistence, 11=llm/stt가 이미 소유 → 계층 15는 **나머지 어댑터 계열 + 어댑터 공통 불변식**.
> **상태: `[설계완료 — 축소 확정본]`** — 적대적 검토(2026-07-05)로 과대계상 제거 후 확정. 유령/철회분 빼고 남은 = ghost 삭제(견고)·settings 경계화·봉인대상 예외·email base·storage print. 큰 재설계 불요(정정=확정).
> 성격: 규약 자체는 문서화가 잘 됨(`factory.py` 단일 진입 + `common/` 프리미티브). 계층 15 = **문서 vs 실제 이탈 교정 + 불변식 명문화** — 단 초기 감사가 "이탈"을 과대계상.

---

## 15-1. DB 세션/tx 무소유 = 어댑터 불변식 `[정정 — 문구 축소]`

persistence 제외 전 인프라에서 `AsyncSession|commit|uow|sessionmaker|begin()` grep = **0건**.

- **불변식(정확히)**: 어댑터는 **DB 세션/tx를 절대 잡지 않는다.** tx 소유는 persistence(계층 3)·소비 handler(계층 6)·워커(계층 14)만.
- **"무상태 transport"는 과장 — 철회**: 적대적 검토에서 상태 보유 어댑터 실재 확인 — `rate_limit/memory`가 `self.attempts` in-memory 카운터(lru_cache 싱글톤), `cache/redis`가 `ConnectionPool`(max 20) 보유. DB 세션만 안 잡을 뿐 **연결 풀·in-memory 상태는 잡는다**. "무상태"로 명문화하면 신규 rate_limit/cache 작성자가 "상태 금지"로 오독.
- 계층 11 "infra/llm=순수 transport"는 llm 특성(무상태 HTTP)일 뿐 전 계열 일반화 아님.

## 15-2. 취득 = `factory.py` 단독 `[정정 — 유령 작업]`

- **규약(keeper)**: 모든 `get_{x}`는 `factory.py`에, impl은 서브폴더. DI=함수 호출, 싱글톤=`@lru_cache`.
- **"impl 직독 5계열 교정"은 유령 작업 — 철회**: 적대적 검토 — `infrastructure/` 밖에서 impl 직접 import하는 소비처는 **0건**(전부 이미 factory 경유). 순환 import·성능 이유도 없음(factory는 `@lru_cache` 싱글톤). 실체는 `token/__init__.py`의 **stale docstring 1줄**("소비처는 token.jwt 직접 import" — 아무도 안 따름)뿐 → **docstring 정리(비행위)**. "§6 정면충돌·폐기"라는 격상 서술 자체가 과장.
- **정당 예외(keeper)**: storage·worker의 `__init__.py __all__` facade 재export = 고팬아웃 허용.

## 15-3. settings는 factory 경계에서만 `[설계완료]`

현 이원화:
- **factory 주입형(정본)**: payment·storage·messaging·anthropic·worker — factory가 `settings.*`를 읽어 **primitive를 생성자 주입**, impl은 config 무지(anti-corruption).
- **impl 직독형(이탈)** — 실측(2026-07-07): `cache/redis/manager.py`(REDIS_URL/ENABLED)·`payment/toss/webhook.py`(TOSS_WEBHOOK_SECRET, 의존성 함수)·`llm/openai/client.py`(COMPACT_THRESHOLD)·`email/templates/*.py`(FRONTEND_URL 2파일)·`internal_auth.py`(INTERNAL_API_SECRET). **token/jwt·scheduler는 직독 아님**(생성자 주입 — 초기 목록 오기). persistence/database.py는 DB 커널이라 면제.

- **결정**: `settings`는 **factory 경계에서만 읽고 impl엔 primitive 주입**. impl은 자기 설정을 몰라야 테스트·교체 가능.
- **정정(적대적 검토)**: `payment/toss/webhook.py`는 client가 아니라 FastAPI **의존성 함수**(`verify_toss_webhook`)라 "생성자 primitive 주입"이 문법상 불가(값은 부팅상수라 주입 가능하나 형태가 다름). payment **client**는 이미 factory 주입(정상). 직독 값 전부 부팅상수(런타임 가변값 0)라 주입 가능성 자체는 성립.

## 15-4. `common/exception.py` 모듈 필수 = SDK 예외 봉인 `[설계완료]`

실측(2026-07-07): **8/13 보유**(anthropic·cache·email·hash·messaging·storage·stt·worker) — **봉인 대상 4계열(storage·anthropic·cache·worker) 전부 완료**. 미보유 = llm·payment·rate_limit·scheduler·token(아래 정정대로 봉인 SDK 예외 없는 계열은 면제).

- **결정: `common/exception.py`는 봉인할 SDK 예외가 있는 계열만 필수** — 어댑터는 SDK 예외를 자기 계약 예외로 감싼다.
- **정정(적대적 검토): "8계열 일괄 필수"는 과잉** — `rate_limit/memory`(외부 SDK 전무, 순수 in-memory)·`token/jwt`(jose 예외를 `decode`서 잡아 None 반환)는 **봉인할 SDK 예외가 0** → 빈 파일 강제는 형식주의. **봉인 대상 실재 계열만**: storage(boto3)·anthropic(SDK)·cache/redis·worker(redis). rate_limit·token 면제.

## 15-5. 구조·명명 이탈 `[설계완료]`

- **email**: `common/base.py`(계약 ABC) 부재, `smtp/client.py`가 사실상 계약 → base ABC 신설(단일 impl도 ABC 유지 방침).
- **messaging = 분리 정당(keeper), 내 프레이밍 철회**: 적대적 검토 — `lgu/client.py`가 **이미 단일 소비 진입 facade**(`LguMessagingClient`, `channel`로 위임), 나머지 3파일은 내부 협력자(`transport`=공유 HTTP/인증, `alarmtalk`/`sms`=프로토콜 실제 다름: template_code vs title). `factory`가 합성+채널직접 모두 노출. 단일 client 강제는 **두 프로토콜 codec 혼합 = 파괴적**. 채널별 분리 정당, 손대지 않음.
- **명명 접미사 불균일**: `get_token`(무접미)·`get_storage_client`(`_client`)·`get_alarmtalk_service`(`_service`)·`get_messenger`. **규약: `get_{family}` 기본형, 역할 분기 시에만 접미사**(hash의 `get_password_hasher`/`get_token_hasher`처럼 역할 2개일 때).
- **국소 이탈**: `storage/factory.py` `print("✅ Using S3…")` 이모지 side-effect + `get_storage_client()` 반환 애너테이션 누락 → logger 사용 + 타입 명시.
- **`common/schemas.py` 필수 여부 공백**: anthropic·worker만 보유. → **규약 명시**: 어댑터 출력이 struct면 `common/schemas.py`, primitive 반환이면 불요(계열별 판단 기준 명문화).

## 15-6. 계층 경계 `[정합]`

- persistence = 계층 3(DB 커널, 어댑터 추상화 아님). llm·stt = 계층 11(AI transport). **계층 15는 그 외 어댑터 계열** — 중복 감사 안 함.
- anthropic이 llm을 미러(`Messenger` vs `LLMProvider` 중복 추상화)하는 건 **계층 11 관할**(11의 완전단일화 결정과 조율) — 여기선 divergence 기록만.
- worker `factory.py`가 `settings.AI_WORKER_MODE` 런타임 dispatch = 실행모드 선택. §6("정책성 선택은 소비 레이어")과 긴장 → **규약: 실행모드는 infra config 허용(부팅 선택), 도메인 정책은 소비 레이어** 경계 명시.

## 15-7. Ghost 디렉토리 제거 `[확정 — dead]`

git 미추적 + `.py` 0 + `__pycache__`만 남은 stale 잔재 3개 — 소스 이전 후 pyc 미청소:
| 디렉토리 | 실체 이전처 | 처분 |
|----------|-------------|------|
| `app/agents/`(facade/handlers/services) | `app/modules/agent/conversation/` | 삭제 |
| `app/security/`(audit·context pyc) | `app/behavior/action/audit.py` + `platform_admin/audit_log/` | 삭제 |
| `app/infrastructure/agent/` | `app/runtime/agent/` | 삭제(16계열 감사서 제외 — 실체 없음) |

- infrastructure.md "이동 후 stale 캐시 제거(`find -name '*.pyc' -delete`)" 규칙 미실행 잔재. **셋 다 삭제 안전**(예정 구조 아님).

---

## 실행 워크리스트 (계층 15) — 적대적 검토로 재분류

| 작업 | 대상 | 파괴성 |
|------|------|:-----:|
| **ghost 디렉토리 삭제** | app/agents·app/security·infra/agent (+ pyc) — 잔존 참조 0 검증됨 | 비파괴(dead) |
| DB 세션/tx 무소유 불변식 명문화 | infrastructure.md("무상태" 아님, "DB세션 무소유") | 문서 |
| settings factory 경계화 | 실측 직독 = cache/redis·payment/webhook(의존성함수)·llm/openai/client·email/templates·internal_auth → 주입(token/jwt·scheduler는 오기, 이미 주입) | 비파괴 |
| ~~`common/exception.py` — **봉인대상 계열만**~~ **완료** | 봉인 4계열(storage·anthropic·cache·worker) 전부 보유(+hash·messaging·email·stt) | 집행됨 |
| 구조·명명 교정 | email base 신설·명명 접미사·storage print/애너테이션 (**messaging은 keeper**) | 비파괴 |
| ~~impl 직독 factory 교정~~ | **철회(유령)** — docstring 1줄만 | 문서 |
| rule 갱신 | infrastructure.md에 DB세션 무소유·봉인대상 계열 규약 추가 | 문서 |

**성격 요약(정정)**: 초기 "이탈 교정 다수"는 과장 — 적대적 검토로 **15-2(유령)·15-5 messaging(분리 정당) 철회, 15-1(무상태→DB세션) 축소, 15-4(과잉→봉인대상만) 한정**. 진짜 견고한 산출 = **ghost 3개 삭제**(유일하게 반박 실패)와 소량 정리(settings 경계·email base·storage print). 신규 rule 없이 infrastructure.md 강화.
