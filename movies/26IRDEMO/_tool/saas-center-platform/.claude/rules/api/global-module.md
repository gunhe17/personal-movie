---
paths:
  - "apps/api/app/modules/family/**"
  - "apps/api/app/modules/center_link/**"
  - "apps/api/app/modules/client_app/**"
  - "apps/api/app/application/handlers/client_app/**"
---

# 글로벌 도메인 모듈 — 내담자 앱 전역 평면

내담자 앱(마인드스코프)의 전역 평면 규칙. [persistence-model.md](persistence-model.md) §2 "테넌트 엔티티는 center_id"의 **명시적 예외 축**이다 — 근거는 docs/client-app/내담자앱-설계.md §0-5(정체성 2평면)·§18.

## 평면 구분

| 평면 | 엔티티 | center_id | 격리 축 |
|---|---|---|---|
| 전역 (계정 소유) | `Family`·`FamilyMember`·`Profile` (`modules/family`) | 없음 | `family_id` |
| 다리 (전역↔테넌트) | `CenterLink`·`CenterLinkInvitation`·`CenterLinkAudit` (`modules/center_link`) | 참조 필드로 보유 | 소유 검증 = person→family→link 체인 |

- 두 평면을 잇는 다리는 `Client.person_id`(기존, 직원용 의미 동결)와 `center_links`뿐. 임상 데이터는 전역화하지 않는다.
- `ClientLinkRequest`는 대체 판정으로 동결(§18) — 신규 진입 금지, 앱 연결의 권위 소스는 `center_links` 단일.

## 인증·노출

- 앱 표면(`/api/v1/app/**`)은 `authenticate_app()`(JWT `aud=client_app`) — `require_membership()` 사용 불가(앱 유저는 Member 아님). 직원 토큰(aud 없음)은 앱 표면 진입 불가, 앱 토큰은 직원 표면 진입 불가(behavior가 차단).
- 모든 앱 조회는 `ctx.person_id` → family → profile/link 소유 검증을 통과해야 한다(G2). 요청 파라미터의 profile_id/link_id를 검증 없이 신뢰 금지.
- 노출 게이트: **G1** 임상 원문·AI 분석·상담사 사견 비노출(`private_notes`·`raw_notes`·`opinion`·`CounselingCaseAnalysis`) / **G2** 자기 family 데이터만 / **G3** `is_report_visible_to_guardian` 등 명시 가시성 플래그 우선.

## 읽기 방향 (G2 read-facade)

글로벌 → SaaS 읽기는 `application/handlers/client_app/`에서 owning 모듈 **루트 facade read 메서드**로만 조립한다 — repo JOIN으로 모듈·평면 횡단 금지, 내담자 앱을 위한 전용 write를 테넌트 모듈에 만들지 않는다(상담사 신규 노동 제로 원칙).

## 감사

CenterLink 상태 전이는 `center_link_audits` append-only 기록과 **같은 트랜잭션**에서 일어난다(§14-1). 오매핑 정정은 in-place 수정 금지 — revoke + 신규 행.
