# 백엔드 엔티티 정합 판정 — §14 신설 스펙 ↔ 기존 코드

**참여**: 동규(백엔드) · 서연(스펙 수호 — §13~17 관점) · 진행자(메인)
**목표**: 내담자 앱 §14 연결·계정 스펙(Account→Family→Profile→CenterLink 4층, CenterLink 상태 머신 5상태·엣지 14)과 기존 백엔드 엔티티(person·client/link·client_relation 등)의 **재사용/확장/대체** 판정. 구현 착수 첫 과제(설계.md §9).
**판정 산출 형식**: 엔티티별 매트릭스 — 기존 구조 | §14 요구 | 갭 | 판정(재사용/확장/대체/신설) | 마이그레이션 함의.

## 안건 (07-14)

- 선행 사실: 팀 인벤토리(2026-07-08-내담자앱-노출요소-인벤토리.md)가 코드 스캔으로 person·client/link(연결 요청)·client_relation 존재를 확인.
- 도메인 전역 제약: 멀티테넌트 center_id 격리 ↔ 내담자 Account는 **센터 횡단**(다중 센터 연동) — 이 긴장이 판정의 축.
- 불변: §14 스펙의 사용자 경험(상태 머신 5·엣지 14·운영 원칙 3)은 확정 — 판정 대상은 "무엇으로 구현하나"지 "무엇을 구현하나"가 아니다. 단, 코드 사실이 스펙의 숨은 모순을 드러내면 반론으로 등재.

---

## 동규 — 코드 탐사·매트릭스 초안 (R1)

전수 탐사 범위: `person/`(person·credential·facade) · `client/`(profile·link/link_request·client_relation·sibling_relation·favorite·unlink_log·resource) 전 파일 정독 + 인증 체계(`auth/account`, `behavior/action/account.py`·`center.py`, signup 플로우) + 파급 모듈(counseling·voucher·billing·assessment·notification) 참조 스캔. 모든 주장에 경로:라인.

### 0. 판정을 지배하는 코드 사실 5가지

1. **Person은 내담자 전용이 아니라 전 직군 공용 인적층이다.** `Member.person_id`(apps/api/app/modules/center/member/models.py:17)가 Person을 참조하고, `PersonCredential`은 전문 자격 검증(verification_status·승인/반려 플로우, apps/api/app/modules/person/credential/models.py:16,35)이다. 즉 Person = "Account 뒤의 사람"이며 상담사·관리자가 이미 쓴다. 인벤토리 §1의 "앱 유저 = Person" 도식은 절반만 맞다 — Person을 앱 보호자 본인 인적층으로 **재사용은 가능**하지만, 아이(Profile)의 대체물로 쓰면 직원 도메인과 섞인다.

2. **기존 링크층은 '보호자↔보호자 Client' 연동이지 '아이 프로필↔아이 client' 매핑이 아니다.** `approve_link_request_handler`가 `role == "client"` 연동을 명시 금지하고 guardian/both만 허용한다(apps/api/app/modules/client/link/handlers/approve_link_request.py:55-59). 승인 결과는 `Client.person_id` 세팅(같은 파일:80, 컬럼은 apps/api/app/modules/client/profile/models.py:26). §14 CenterLink는 Profile(아이 또는 본인)↔`client_id` 매핑 — **연결 대상의 층위 자체가 다르다.** "ClientLinkRequest = §14 상태 머신의 선행 구현체" 가설(설계.md §6-1)은 코드상 기각에 가깝다.

3. **ClientLinkRequest는 상태 3개·in-place 변경·무감사·무토큰이다.** 상태 pending/approved/rejected뿐이고(apps/api/app/modules/client/link_request/models.py:19), 전이는 `update_in_place`로 행을 덮어쓴다(apps/api/app/modules/client/link_request/services/approve_link_request.py:30). §14의 5상태(suspended/revoked)·append-only 감사(`center_link_audits`)·증거 스냅샷 동결·"터미널에서 재연결=새 행" 원칙과 정면으로 반대 패턴. 게다가 매칭 키가 전화번호(models.py:17)인데 §14는 전화 자동매칭을 폐기했고, 라우터는 전부 직원 인증(`require_membership`+`WRITE_CLIENT`, apps/api/app/modules/client/link/router.py:41-47,62-70) — **내담자 대면 표면이 아예 없고**, web/mobile 프론트 호출처도 없다(grep 결과 activity-log 라벨 1건뿐). 사실상 휴면 자산.

4. **인증은 이미 글로벌이고, center 격리는 멤버십 해석이 담당한다.** signup은 center 무관하게 Account+Person을 동시 생성하고(apps/api/app/application/handlers/auth/signup.py:29-43) JWT claim은 `account_id·person_id·email`뿐 — audience/role 구분 없음(apps/api/app/behavior/action/account.py:24-31). center-scoped API는 `RequireCenter`의 멤버십 해석(`_resolve_access` → member_id 필수, apps/api/app/behavior/action/center.py:46,55)이 Member 없는 계정을 구조적으로 차단한다. 즉 "Member 없는 Account = 앱 유저"는 **오늘 코드로도 성립**하고, 남는 구멍은 `request_unscoped(authenticate())` 표면(notice·support·person 본인·center_application 등 39개 라우터 파일)에 앱 계정이 그대로 들어간다는 것 — 스펙의 "토큰 권한 분리"가 정확히 이 지점이다.

5. **알림 인프라는 account 귀속이지만 center_id NOT NULL이다.** `Notification.recipient_id`는 account ref인데 `center_id`가 NOT NULL(apps/api/app/modules/notification/notification/models.py:16-17)이고 `PushToken`도 동일(apps/api/app/modules/notification/push_token/models.py:13-14, platform 기본 "web"). 인벤토리 2-9의 "인프라 사실상 준비됨"은 **연동(③) 상황 한정** — 미연동·글로벌 알림(가족 초대·승인 완료 등 center 없는 이벤트)은 center_id 축이 막는다.

### 1. 엔티티별 정합 매트릭스

| 기존 엔티티 (핵심 컬럼) | §14 대응 개념 | 갭 (구조·의미) | 판정 | 마이그레이션·파급 |
|---|---|---|---|---|
| **Account** — email 유니크(partial)·password·provider/provider_id·token_version (auth/account/models.py:15-33) | Account (4층 최상위) | 소셜 필드 기존재로 구조 갭 없음. JWT에 audience/scope claim 없음 → 앱 계정이 unscoped 표면 전부 통과. 탈퇴가 즉시 비활성(30일 유예 없음) | **재사용 + 확장** (스펙 §6-1과 일치) | token payload에 audience claim 추가 + `authenticate()` 분기 신설. 기존 직원 토큰 무영향(token_version 재사용 가능). 앱 전용 탈퇴 유예 플로우는 auth 재사용 불가 — 신설 |
| **Person** — account_id 1:1 partial unique·name·**phone NOT NULL**·birth·gender (person/person/models.py:15-28) | (직접 대응 없음 — Account 보유자의 인적층) | Profile이 아니다: Member(직원)·PersonCredential이 공유하는 전 직군 층. phone NOT NULL이 "전화번호 인증은 센터 연결 때만"(§6-1)과 충돌 | **재사용(계정 인적층 한정)** — Profile 대체 금지 | 앱 가입 시 Person 생성 유지하되 phone nullable 화 검토(직원 signup 파급 확인 필요) 또는 앱 가입 시 placeholder. profiles는 별도 신설 |
| **Client** — center_id·code·person_id(nullable)·role·status·memo (client/profile/models.py:24-36) | CenterLink의 참조 대상(센터측 명부 원본) | 갭 없음 — §14는 Client를 바꾸지 않고 참조만 한다. 단 `person_id` 컬럼이 CenterLink와 **이중 표현**이 된다 | **재사용(무변경)** | counseling·voucher·billing·assessment 등 `client_id` fan-in 전체 무영향(대체 아님이 파급 0의 근거). `Client.person_id`는 §2 리스크 R2 참조 |
| **ClientLinkRequest** — center_id·person_id·phone·client_id·status 3종·in-place 전이 (link_request/models.py:15-21) | center_links + center_link_invitations + center_link_audits | 사실 2·3 — 층위 다름(보호자 연동 vs 아이 프로필 매핑), 상태 2개 부족, 감사·토큰·불변 이력 없음, 전화 자동매칭 전제, 내담자 표면 전무 | **대체(신설)** — 재사용·확장 모두 부적합 | 프론트 호출처 0 → 데이터 이관 부담 사실상 없음(prod 행 수 확인만). 기존 라우터·agent TOOL은 deprecate 마킹 후 CenterLink 승인 플로우로 수렴. `Client.person_id` 세팅 로직(approve handler:80)은 신규 플로우에서 재현 여부 별도 결정 |
| **ClientRelation** — center_id·client↔client·relation_detail·is_primary (client_relation/models.py:13-18) | Family/family_members의 **센터측 거울** (대체 대상 아님) | Family는 글로벌 Account 멤버십+권한 2등급, ClientRelation은 센터 명부의 기록용 관계 — 목적·스코프 다름 | **재사용(센터측 그대로) + families/family_members 별도 신설** | 무변경. 단 CenterLink 승인 화면의 "명부 대조"에서 ClientRelation이 대조 소스로 읽힌다(read-only 참조) — LedgerSharingFacade처럼 파사드 경유 read 경로 설계 필요 |
| **SiblingRelation** — center_id·client↔client (sibling_relation/models.py:13-16) | (대응 없음 — Family 내 Profile N이 앱측 표현) | 스코프 다름(센터 명부 vs 글로벌 가족) | **무변경 재사용(센터측)** — 앱과 교차 없음 | 없음 |
| **ClientFavorite** — person_id(=직원)·client_id·center_id, 라우터 `require_membership` (favorite/models.py:19-21, favorite/router.py:30-36) | (대응 없음) | 상담사의 내담자 즐겨찾기 — 내담자앱과 무관. 인벤토리 §1이 연관 자산처럼 열거했으나 코드상 직원 기능 | **무관 — 판정 대상 제외** | 없음 |
| **ClientUnlinkLog** — client_id·person_id·reason·unlinked_at (unlink_log/models.py:15-18) | center_link_audits의 원시 선조 | 해제 1종만 기록, 전이 일반화·증거 스냅샷·동일 트랜잭션 보장 없음 | **대체(center_link_audits 신설)** | 기존 로그 테이블 잔존(읽기 전용 유산). 신규 감사는 전이와 동일 tx로 insert |
| **MemberInvitation** — email 기반·expires_at·member_id 채움, 토큰 스트링 없음 (center/member_invitation/models.py:15-23) | center_link_invitations·가족 초대 토큰의 패턴 참조 | 이메일 매칭이지 단명 토큰·QR·비소모 열람이 아님 | **패턴 참조만, 코드 재사용 아님** (§14-6 이월과 일치) | 없음 |
| **AssessmentSendLink** — verification_code 4자리·failed_attempts·expired_at·revoked_at·recipients JSONB (assessment/send_link/models.py:17-24) | center_link_invitations의 가장 가까운 기존 패턴 | 케이스 귀속·검사 발송 특화. "열람 비소모·수락 시 소모"(§14-2) 개념 없음 | **패턴 참조만** — 인벤토리 §5-2의 "확장" 제안보다 신설이 맞다(글로벌 도메인 vs center 귀속) | 없음 |
| **Notification / PushToken** — recipient=account, **center_id NOT NULL** (notification/models.py:16-17, push_token/models.py:13-17) | 앱 알림·푸시 수신 채널 | 사실 5 — 글로벌(무센터) 알림 표현 불가. PushToken platform 기본 "web" | **확장** — center_id nullable화 또는 앱 알림 갈래 분리 | center_id nullable 마이그레이션이면 기존 인덱스(`ix_notifications_recipient`가 center_id 선두) 재설계 동반. INV-MIG: alembic 증분 필수 |
| **AssessmentTask.is_report_visible_to_guardian** (assessment/assessment_task/models.py:25) | §16 파생 노출의 G3 게이트 | 플래그는 있으나 내담자 조회 API 없음(인벤토리 §5-6) | **재사용** — read-facade에서 존중 | 없음(읽기 경로 신설만) |

### 2. §14~16 개념 중 대응물이 전무한 것 (전부 신설)

코드 전수 스캔 결과 아래는 **부분 구현조차 없다** — 모듈 목록(apps/api/app/modules/)에 family·ledger·grant 계열 부재 확인:

- `families` / `family_members`(2등급 관리자·구성원, 이양·내보내기) — ClientRelation은 대체물 아님(매트릭스)
- `profiles`(가족 공유 아이/본인 엔티티) — Person도 Client도 아님
- `center_links`(5상태 머신) + `center_link_invitations`(단명 토큰·비소모 열람) + `center_link_audits`(append-only·증거 스냅샷)
- `ledger_entries`·`ledger_media`(§15) — 유사물 없음. 미디어는 upload/image 모듈이 있으나 공개 URL 방식이라 §15-2가 명시적으로 재사용 금지
- `record_grants`(§16) + `LedgerSharingFacade` + 접근 로그 — document 모듈의 DocumentAccess가 열람 로그 패턴이긴 하나 center 귀속·다른 도메인
- 신설 갈래 전부 "center_id 격리 밖 첫 글로벌 도메인"(§6-1) — 기존 rule(persistence-model.md)의 tenant-scoped 관례에 글로벌 도메인 규칙이 없어 **모듈 배치 규칙(.claude/rules/api) 보강이 선행 과제**

### 3. 코드 사실이 드러낸 스펙 모순·리스크

- **R1 (층위 불일치 — 가장 중요).** 설계.md §6-1의 "ClientLinkRequest는 선행 구현체일 수 있음" 가설은 기각 권고. 근거는 사실 2·3. 판정 함의: CenterLink를 ClientLinkRequest 확장으로 만들면 보호자-연동 의미론(role='client' 금지)과 아이-매핑 의미론이 한 테이블에 섞인다.
- **R2 (Client.person_id 이중 표현).** CenterLink 도입 후에도 `Client.person_id`가 남으면 "이 아이의 앱 연결"의 권위 소스가 둘이 된다. 또한 단일 컬럼이라 보호자 N명(부·모 각각 앱 계정, §14 가족 간 N 허용)을 표현 못 한다 — approve handler의 "1 Person = 1 Client per center" 불변식(approve_link_request.py:66-74)은 §14 불변식 축((profile_id, center_id)·(family_id, client_id))과 다른 축. 제안: `Client.person_id`는 기존 직원용 의미(보호자 연락 계정)로 동결하고 앱 연결 판단은 center_links만 참조. favorite·unlink_log가 이 컬럼 의미에 의존하므로 제거는 하지 않는다.
- **R3 (탈퇴 정책 충돌).** 현행 withdraw는 즉시 비활성 계열(auth_facade.py:216, router 규칙 문서의 "모든 센터 멤버십·Person·Account 비활성화" 예시) — §14의 "탈퇴 30일 유예 + suspended 연동 + 내보내기 제안"과 다르다. 앱 계정 탈퇴는 auth withdraw 재사용 불가, 별도 플로우.
- **R4 (Person.phone NOT NULL vs 지연 전화인증).** 사실 1·매트릭스 Person 행. 게스트→소셜 가입 시점엔 전화가 없어야 정상(§6-1) — signup 재사용 시 스키마 마찰. nullable 화는 직원 플로우(멤버 초대 수락 등) 전수 확인 필요.
- **R5 (알림 center 축).** 사실 5. §13 홈 카드·§14 승인/초대 알림 중 무센터 이벤트가 존재 — Notification/PushToken의 center_id NOT NULL이 첫 구현 스프린트에서 바로 걸린다.
- **R6 (unscoped 표면 개방).** 사실 4 후단. 토큰 권한 분리 전까지 앱 계정이 support·notice·center_application 등 직원용 unscoped API를 호출 가능 — 데이터 유출축은 아니나(본인 스코프) center_application(센터 개설 신청) 같은 표면은 의도 밖. audience claim을 **신설 갈래 첫 커밋 전에** 넣는 순서를 권고.

### 4. 판정 보류 (스펙 측 확인 필요 — 서연에게)

1. **ClientLinkRequest·ClientUnlinkLog의 기존 행 처리** — 코드상 프론트 호출처 0이지만 prod 데이터 존재 여부는 DB 확인 필요. 행이 있으면 "이관"이 아니라 "동결(읽기 전용 유산)"을 제안 — §14가 요구하는 증거 스냅샷이 과거 행엔 없어서 이관해도 감사 요건을 못 채운다.
2. **`Client.person_id`의 존속 의미** — R2 제안(동결)대로면 직원 화면의 "보호자 계정 연동" 기능이 CenterLink와 별개로 남는다. 스펙이 이 직원측 기능을 흡수할 계획인지, 병존인지.
3. **Person 재사용 범위** — 앱 보호자 본인 인적층으로 Person을 쓰면 is_certified·PersonCredential 등 직군 특화 필드가 딸려온다. 계정 인적층으로 쓰되 앱이 해당 필드를 무시하는 것으로 충분한지, 아니면 Profile(본인 타입)로 완전 대체해 Person은 직원 전용으로 후퇴시키는지 — §6-1 "Profile(아이 N 또는 본인)"의 '본인' 해석에 달렸다.
4. **글로벌 도메인 모듈 규칙 부재** — §2 마지막 항목. 스펙 문제가 아니라 rules 정비 과제지만, 착수 순서상 선행이라 명시 필요.

### 5. 반론 (스펙 변경 제안 — 판정과 분리)

- §6-1의 "ClientLinkRequest는 §14 상태 머신의 선행 구현체일 수 있음" 문장은 코드 확인 결과로 갱신 제안 — "선행 구현체 아님(층위 상이), 판정=대체" (근거: 본 문서 사실 2·3, R1).
- 인벤토리 §5-2 "AssessmentSendLink 패턴 확장 → 온보딩 3경로"는 "확장"이 아니라 "패턴 참조 신설"로 정정 제안 — center 귀속 테이블을 글로벌 도메인 토큰으로 확장하면 §6-1의 테넌트 격리 밖 원칙과 어긋난다.

— 동규 (R1, 07-14)

---

## 서연 — 스펙 교차 검증 (R2)

검증 방식: 동규 인용 코드 전부 직접 재확인 — approve_link_request.py(55-59·66-74·80) · link_request/models.py(17·19) · person/models.py(15-17, phone NOT NULL·account 1:1 partial unique) · behavior/action/account.py(24-31) · signup.py(27-52) · notification/models.py(16-17·29) · push_token/models.py(13-17) · client/profile/models.py(26) · member_invitation/models.py · send_link/models.py(16-17) · unlink_log/models.py · auth_facade.py(216-225, withdraw=즉시 revoke+deactivate) · link/router.py(직원 인증 확인). **인용 전부 정확.** 미세 보정 1: JWT엔 `account_token_version` optional claim도 있음(account.py:48, 검증용) — "audience/scope 없음" 결론 무영향. 추가 확인: modules/에 family·ledger·grant 계열 부재, client 레코드 병합 기능 부재, web/mobile의 link_request 호출처 0(activity-log 라벨 1건뿐) — 동규 주장과 일치.

### 1. 엣지 14 워크스루 (§14-2 표 전 행 — 첫 행 2케이스 분리 표기)

전제 = 동규 매트릭스(Account 재사용+확장 / Person 계정 인적층 한정 / Client·ClientRelation 무변경 / ClientLinkRequest·UnlinkLog 대체 / center_links 계열 신설). **판정을 바꿔야 하는 엣지 없음** — 단 4건이 매트릭스 밖 신설물(G1~G4)에 의존.

| 엣지 | 가능 | 근거 |
|---|---|---|
| E1 초대+역방향 동시(같은 프로필 자동 수렴) | O | 신설 invitations+links로. "superseded"는 5상태에 없음 → `revoked`+reason enum으로 흡수(스키마 무변경, §16-6의 reason 추가 흡수 패턴과 동일) |
| E2 동시(다른 프로필 → 직원 확인) | O | requested 병존 허용 — 불변식은 살아있는 active 링크 축이라 requested 복수는 안 막힘. 승인 화면 병기는 G4 의존 |
| E3 두 가족이 같은 아이 | O | `(family_id, client_id)` partial unique + 가족 간 N은 `(profile_id, center_id)` 축이라 무충돌. "기존 연결 N건" 배지 = 센터 web이 center_links를 읽는 표면 필요(G4) |
| E4 active에 재시도 = 멱등 안내 | O | partial unique 충돌 → 200 멱등 응답. 기존 approve handler의 ConflictException(409) 패턴 이식 금지 — 스펙은 "에러 아님" |
| E5 초대 링크 타인 수신 → requested 강등 | O | 대조 소스 = Client.phone(명부, nullable — profile/models.py:31). 명부 무전화 = 자동 활성 불가 → 강등 규칙이 자연 흡수. **Person.phone placeholder 금지 근거**(보류③) — placeholder가 대조 노이즈가 된다 |
| E6 client soft delete 후 | O(훅 필요) | Client 엔티티 무변경은 맞으나 삭제 시 반응(토큰 무효·링크 suspended)은 eventing/application 신설 — 매트릭스의 "파급 0"은 write 파급 한정으로 정정 요망(G3) |
| E7 대기 중 프로필 삭제 → 자동 정리 | O | 글로벌 도메인 내부 cascade — 외부 의존 없음 |
| E8 번호 불일치 — 사유 입력 승인 | O | audits 증거 스냅샷+별도 마킹. 직원 사유 입력 UI는 G4 의존 |
| E9 토큰 만료·재사용(비소모 열람) | O | invitations 신설로만 가능 — SendLink(4자리 코드·시도 실패 카운트·center 귀속)에 비소모 열람 개념 없음, 반론 2 수용과 정합 |
| E10 승인 더블탭 = 멱등 | O | 전이+audit 동일 tx, 이미 active면 no-op |
| E11 중복 프로필 = 불변식 차단 | O | `(family_id, client_id)` partial unique가 정확히 이 케이스 |
| E12 client 병합 = 사람 개입 | O(공집합) | **병합 기능 자체가 백엔드에 없음**(client 모듈 전수 — 레코드 병합 부재, agent facade의 merge는 id 리스트 결합). 엣지는 기능 생성 시 조건부 — 이월 등재로 충분 |
| E13 탈퇴 유예 → suspended 연동 | O | withdraw 재사용 불가 재확인(auth_facade.py:216 — 즉시 계열). 동규 매트릭스 "앱 전용 탈퇴 유예 신설" 명기와 정합 |
| E14 구성원 내보내짐 = 링크 무영향 | O | CenterLink 귀속 = profile_id(가족 공유) — family_members 행 제거와 독립. 본인 작성분 사본 열람권(§14-3)은 ledger 측 요구로 별도(G5 인접) |

### 2. 보류 4건 — 스펙 측 답변

1. **기존 행: 동결 수용, 이관 기각.** §14-1의 감사 요건은 "승인 시점 증거 스냅샷 동결" — 과거 행엔 증거가 없어 이관해도 신체계 행이 될 수 없고, 증거 없는 행이 섞이는 순간 audits의 증명력이 전체로 죽는다. "터미널에서 재연결=새 행" 원칙과도 동근. 귀결: **기존 approved 연동의 실사용 보호자는 앱에서 신규 연결 요청**(자동 승계 = 자동 매핑 금지 원칙 위반). prod 행 수 확인은 동규 액션 — 결과에 따라 ESC-1.
2. **Client.person_id: 동결 수용 + 병존 아닌 수렴 권고.** 컬럼은 동결(제거 금지 — favorite·unlink_log 의존, 동규 R2 제안 그대로). 앱 연결의 권위 소스는 **center_links 단일**. 단 스펙은 직원측 "보호자 계정 연동" 기능을 흡수할 계획이 없고(§14 범위 밖), 두 "연결" 개념이 직원 화면에 공존하면 그 자체가 오매핑 표면 — 프론트 호출처 0이므로 **신규 진입 deprecate**(라우터+agent TOOL) 권고. 기능 제거는 제품 결정 → ESC-2.
3. **Profile "본인" = Profile(relation='self') 신설 확정 — Person 후퇴 불필요.** 근거: §14 불변식·grant·ledger 귀속이 전부 profile_id 축 — 성인 본인만 person_id 특례로 걸면 상태 머신·공유·기록 귀속이 이원화된다. §17-5 "profile.relation이 팩 선택 키"가 relation='self'를 이미 전제. Person은 동규 판정대로 계정 인적층 한정 재사용, 앱은 is_certified·credential 무시로 충분(스키마 격리 불요). phone은 **nullable 권고**(placeholder 기각 — E5 근거), 직원 signup 파급 전수 확인은 동규.
4. **글로벌 도메인 모듈 규칙: 동의 — 스펙 밖, 선행 인프라 과제 등재.** persistence-model.md §2가 tenant-scoped만 규정. 신설 갈래 첫 커밋 전에 배치·격리·교차 접근(파사드 단방향) 규칙 신설 — R6의 audience claim과 함께 "첫 커밋 전 2건".

### 3. 반론 2건 판정

- **§6-1 "선행 구현체" 문장 — 수용.** 코드 직접 확인으로 동규 근거 성립(role='client' 연동 명시 금지 + 상태 3·전화 매칭·직원 전용 표면). 교체 문안(설계.md §6-1 말미, R2 종결 시 반영): "…특히 ClientLinkRequest(전화 매칭·직원 승인)는 §14 상태 머신의 선행 구현체일 수 있음" → "ClientLinkRequest는 §14의 선행 구현체가 아님(보호자↔보호자 Client 연동 — role='client' 연동 금지, Profile↔아이 client 매핑과 층위 상이). 판정=대체, 기존 행 동결(07-14 정합 판정)".
- **인벤토리 §5-2 "SendLink 확장" → "패턴 참조 신설" — 수용.** send_link/models.py:16-17 직접 확인 — center_id NOT NULL·case_id 귀속. 글로벌 토큰으로 확장하려면 center_id nullable화부터 필요 = 이미 다른 테이블. §14-6 이월의 "member_invitation 패턴 참조 신설(코드 재사용 아님)"과 같은 결로 통일.

### 4. 완전성 검사 — 스펙이 요구하는데 §2 신설 목록에 없는 것

담김 확인: profiles·families/family_members·center_links·center_link_invitations·center_link_audits·ledger_entries/ledger_media(tombstone은 entries 설계 속성으로 포함)·record_grants·LedgerSharingFacade·접근 로그·앱 탈퇴 30일 유예(Account 행에 명기). **누락 6건:**

| # | 누락 | 스펙 근거 |
|---|---|---|
| G1 | `family_invitations`(가족 초대 토큰 — 72h·1회용) | §14-1 "가족 초대는 Family 토큰 — **테이블부터 다름**"이 명문. 목록엔 families/family_members만 |
| G2 | **앱向 read-facade 계층**(센터 데이터 파생 조회) | §6-3 데이터 계약(ETag·차등 TTL·silent push 무효화·소멸 SLA 서버=즉시) + §13-4 FactContext 소스 피드(bookings·sessions·vouchers·assignments·records). LedgerSharingFacade는 SaaS→ledger 방향뿐 — **역방향 출구가 목록에 없다.** schedule·voucher·assessment·counseling 각각의 앱向 read 표면 + CenterLink 경유 권한 합성 |
| G3 | SaaS 이벤트 → 글로벌 도메인 반응 훅 목록 | client.deleted/restored→링크 suspended/복귀(E6) · 구독 해지→전 링크 전환+30일 사후 유예(§14-5 판정 1) · 케이스 종결→리뷰 카드(§16-2). eventing 연결점이 매트릭스 어디에도 없음 |
| G4 | 센터 web 승인 표면 | 승인·거절(고정 선택지 2+내부 메모)·"오래된 요청"·기존 연결 N건 배지·데스크 QR(§14-3). "승인 플로우로 수렴" 한 줄로는 신설 범위가 안 보임 |
| G5 | 파기 대장 | §15-5 T+30 파기(건수·시각 메타만). 스키마는 §15-7 이월이되(07-28 §15-6 신설로 번호 밀림) 신설 목록에 개념 등재 필요 |
| G6 | (v1 후순위) 익명 통계 집계(§17-6·대기 정보)·콘텐츠 팩 서버 배포+감수 차단 파이프라인(§17-5) | 서버 요소인데 목록 밖 — 상황 ① 범위라 우선순위만 낮음 |

### 5. 대표 에스컬레이션 (비즈니스 판단만)

- **ESC-1 (조건부)**: prod에 기존 approved 연동 실사용 행이 있으면 — 해당 보호자에게 앱 전환 시 **재연결 요청을 시키는** 결정(자동 승계 금지의 귀결, 기존 사용자 마찰). 행 수 0이면 에스컬레이션 불요.
- **ESC-2**: 직원측 "보호자 계정 연동" 기능(ClientLinkRequest 표면)의 신규 진입 deprecate — 프론트 호출처 0으로 영향 최소로 보이나 기존 기능 제거는 제품 결정. 권고 = deprecate.
- 그 외(Person.phone nullable·Notification center_id nullable·G1~G5 신설 등)는 전부 기술 선택 — 동규와 합의 처리, 에스컬레이션 불요.

### 6. 합의 상태

- **미합의: 없음.** 동규 매트릭스의 엔티티 판정 전부 수용(엣지 14 전부 그 위에서 구현 가능).
- 보완 요청 2건(동규 R2 응답 대기): ① Client 행 "파급 0"을 "write 파급 0 — 단 삭제·해지 이벤트의 반응 훅 신설(G3)"로 정정 ② §2 신설 목록에 G1~G5 증보(G6은 후순위 표기).

— 서연 (R2, 07-14)

## 동규 — R2 응답 (정정 2건 수용 + 할당 확인 2건 결과)

### 1. 보완 요청 2건 — 둘 다 수용

- **① Client "파급 0" 정정 수용.** 매트릭스 Client 행의 "파급 0"은 **"write 파급 0"으로 한정** — Client 스키마·서비스·기존 호출처는 무변경이나, `client.deleted/restored`·구독 해지 이벤트에 글로벌 도메인이 반응하는 훅(E6·§14-5 판정 1)은 신설이다(G3). 방향 확인: 기존 eventing은 SaaS 내부 소비만 — 글로벌 도메인 구독자는 첫 사례라 이벤트 계약(atomic → 글로벌 반응)도 G3 범위에 포함.
- **② 신설 목록 G1~G5 증보 수용** (G6 후순위 표기 동의). 특히 **G2(앱向 read-facade)는 코드 관점에서도 최대 갭** — 보강 근거: 현행 규칙상 read 집계 예외는 admin 표면과 agent facade뿐(.claude/rules/api/facade.md §3-4·cross-module-write.md 서두)이라, 글로벌 도메인이 schedule·voucher·assessment·counseling을 읽는 방향은 **규칙 자체가 부재**. 따라서 G2는 "첫 커밋 전 2건"(글로벌 도메인 모듈 규칙)에 의존한다 — 규칙 없이 G2를 만들면 ledger 직접 join 금지(§16-3) 같은 경계가 코드리뷰 기준을 잃는다.

### 2. 할당 확인 ① — 기존 행 수 (로컬 dev DB 직접 쿼리, 07-14)

```sql
SELECT status, count(*) FROM client_link_requests GROUP BY status;          -- 0행
SELECT count(*) FROM clients WHERE person_id IS NOT NULL AND deleted_at IS NULL;  -- 0
SELECT count(*) FROM client_unlink_logs;                                    -- 0
```

로컬(saas-postgres/imomtae) 기준 **세 테이블 전부 0행**. 시드(scripts/)에도 link request 생성 없음. 프론트 호출처 0 + 진입점이 직원 라우터·agent TOOL뿐인 점과 합치면 **prod 실사용 개연성 매우 낮음** — 단 prod DB는 이 환경에서 접근 불가라 단정하지 않는다. 배포 환경에서 위 쿼리 1행이면 종결: **0이면 ESC-1 소멸**, 동결(서연 §2-1)로 그대로 확정.

### 3. 할당 확인 ② — Person.phone nullable 파급 전수 (결론: 가능, 직원 플로우 무영향)

- **쓰기 층은 이미 준비돼 있다**: `PersonFacade.create_person`의 시그니처가 이미 `phone: str | None = None`(person/facade/person_facade.py:96). 현재는 DB NOT NULL(person/person/models.py:17)이라 None을 넘기면 insert에서 터지는 **잠재 부정합** — nullable 화가 오히려 시그니처와 스키마를 일치시킨다.
- **읽기 경로 전수** (`person.phone` 접근 10곳 grep): list_members.py:81·platform_admin account 2곳·assessment get_case.py:115 = `if person else None` 가드 기존재 / get_member.py:118 계열 3곳 = 직접 접근이나 응답 스키마가 이미 `phone: str | None`(center/member/schemas.py:103·112) / recipient_resolver.py:68 = `RecipientInfo.phone: str | None`(:22) / update_person.py:25 = truthy 가드. **None 비안전 지점 없음.**
- **필요 변경 전량**: ① persons.phone nullable 마이그레이션 ② `PersonSummary.phone: str → str | None`(person/schemas.py:88·100, auth/schemas.py:68) ③ 앱 가입용 요청 스키마 별도 신설. **직원용 `SignupRequest`·`PersonCreate`의 phone required는 유지**(auth/schemas.py:9, person/schemas.py:9) — 직원 가입 행동 변화 0.
- 서연의 placeholder 기각(E5 — 명부 대조 오염)에 코드도 합류: 대조 소스 Client.phone도 nullable(client/profile/models.py:31)이라 "빈 값 = 대조 불가 → requested 강등"이 이미 자연 규칙이다.

### 4. 엣지 워크스루 단서 4건 — 이견 없음

E1 superseded=`revoked`+reason enum 흡수(서사는 audits가 보존) · E4 기존 ConflictException(409) 패턴 이식 금지(멱등 200) · E12 병합 공집합(이월) · E13 앱 전용 탈퇴 플로우 — 전부 수용, 구현 노트로 승계.

### 5. 합의 상태 (R2 종결)

- **미합의 0.** 매트릭스(R1) + 서연 정정 2건 반영 + G1~G6 증보 = 최종 판정본.
- 남은 것: ① prod 쿼리 1건(§2 — 0이면 ESC-1 소멸) ② ESC-2(직원측 연동 표면 deprecate — 제품 결정, 권고=deprecate) ③ 설계.md §6-1 문안 교체·§9 과제 갱신(서연 문안, 진행자 반영).

— 동규 (R2, 07-14)

## 대표 판정 (진행자 기록 · 07-14)

**ESC-2 = 신규 진입 deprecate 채택**(패널 권고안). ClientLinkRequest 라우터·agent TOOL deprecate 마킹, 앱 연결은 CenterLink 단일화. ESC-1은 배포 DB 쿼리(`SELECT count(*) FROM client_link_requests` 외 2건) 0 확인 시 소멸 — 대표 확인 대기. **판정 트랙 종결.**
