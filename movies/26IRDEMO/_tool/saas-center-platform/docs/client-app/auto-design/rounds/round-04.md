# Round 04 — 온보딩 & 센터 연동(link) 플로우 — 전화OTP→센터코드→승인

## 주제/긴장

비연동 사용자가 센터에 연결되는 activation 깔때기의 종착점. R1~R3에서 미소속홈 전체를 "연결 CTA 중심"으로 재정의한 결정의 직접 귀결이라, 이 플로우의 마찰 1초가 앱 전체 가치 실현률을 좌우한다.

관련 긴장: **코드현실(1 Person = 1 Client / 센터, 멀티센터 성립)**.

코드 현실 요약(양측 검증 일치):
- `center.code` = `String(6)`, `unique=True` 실존 (초대용 6자리 코드)
- `Person.phone` 실존 / `link.phone` = 매칭키(Person.phone 스냅샷)
- `CreateLinkRequestService`: `person_id`를 받아 **pending 중복만** 검증
- 현재 `POST /client/link` = `require_permission(WRITE_CLIENT)` → **내담자 직접 호출 불가**(센터 직원 대행 구조)
- SMS/알림톡 발송 인프라(`get_sms_service`/`get_alarmtalk_service`) 실존
- `link.status` = pending/approved/rejected 3상태 실존
- `ApproveLinkRequestService`: pending 여부 + client_id 설정만. **1 Person = 1 Client(센터당) 중복 연동 가드는 미구현**

## A · 옹호 주장 (근거 포함)

- **셀프 연동신청 엔드포인트는 MVP 필수 신규** (code): 현재 link POST는 WRITE_CLIENT 권한이라 내담자가 못 부른다. R1~R3 깔때기가 작동하려면 Person JWT 인증 신규 라우터(`POST /me/link-requests`)가 필수 전제. 내부 `CreateLinkRequestService`(pending 중복검증 포함)는 재사용 가능해 비용은 라우터+핸들러+인가 레이어로 한정.
- **OTP는 처음부터 만들되 인프라 신규 0** (code): SMS/알림톡 발송 채널은 이미 운영 중. 신규는 코드 생성·저장(TTL 3분)·검증·rate-limit(번호당 10회/일, 5회 실패 10분 잠금) 로직뿐. 전화번호가 Client 매칭키이자 임상데이터 본인확인 근거라 미검증 번호 = 잘못된 환자기록 연결(T10). OTP 생략 절충안 거부.
- **입력 순서: 센터코드 → 센터명 확인 → 전화OTP** (px): "어디 연결되는지" 먼저 확인해야 민감정보 제공 동기 발생. 코드 오타는 실패비용 낮아 첫 스텝 이탈 감소. center.code unique 6자리로 코드→센터명 lookup 1개면 충분.
- **전화번호 최초 1회 검증 후 재사용** (px): 멀티센터 2번째 연동마다 재OTP는 불신감. Person에 검증완료 번호 저장 → 2번째부터 코드 입력→즉시 신청(1스텝). 번호 변경 시에만 재인증. R2 무전환 철학 일치.
- **역할/연결대상은 앱이 절대 묻지 않고 센터 승인이 전량 흡수** (code): link 모델상 client_id·역할은 승인 시 센터 지정. relation 인가는 R9 신규. 앱에서 물으면 데이터근거 없고 오답 여지+R9 침범.
- **승인 대기 = 살아있는 대기** (px): status 3상태 존재. 승인/거절 FCM 푸시 즉시 통지, 거절 후 동일센터 재신청 허용(create의 pending-only 검증으로 자연 통과). 대기홈은 R3 본문 재사용. "센터에 문의" 보조 동선 제안.
- **소셜로그인 = Account/Person 무변경 + apple provider 추가** (code): 모델 변경 0, apple 검증 로직+enum 추가뿐. provider_id 매칭으로 Private Relay 대응.
- **온보딩 슬라이드 3장 + '나중에 할게요' 1급 시민** (roi): 코드입력 강제는 깔때기 우회 차단. 로컬 1회 표시(백엔드 0).

## B · 검증 반박 (근거 포함)

A의 코드 주장은 대부분 검증 통과(center.code/Person.phone/CreateLinkRequestService/SMS 인프라/거절 후 재신청 모두 실존 확인). 포함 인정. 단 두 지점을 못박는다.

- **[못박기] approve 단계 1 Person 1 Client 중복 연동 가드는 이번 라운드 신규 필수** (code): `ApproveLinkRequestService.execute`는 pending 체크+client_id 설정만. 모델 주석은 중복 금지를 명시하나 **승인 코드에 검증이 없다**. create의 pending 중복검증은 두 번째 pending만 막을 뿐, 이미 승인된 person 재연동/한 client_id 중복 연결을 못 막는다. **임상데이터 오연결의 본질 게이트는 OTP가 아니라 여기다.** A가 R9로 미룬 건 회피이며, relation 인가(R9)와 별개인 link 본연 제약이라 이번 라운드 신규로 못박는다.
- **[정정] OTP 신규 0은 SMS 발송에만 해당** (code): 발송 채널은 0 신규가 맞으나 OTP 코드 생성·TTL 저장·검증·실패카운트·잠금 로직은 코드베이스에 없다(send_link는 검사발송용). Redis 또는 신규 테이블+서비스 필요. 비용은 작지만 0이 아니므로 "신규 0"은 정당성 근거로 삼기엔 과장.
- **[조건] 셀프 신청 시 person_id는 JWT에서 강제 주입, body값 무시** (code): 현재 execute_with_dict는 body person_id를 신뢰. 명시 안 하면 타인 person_id 위조 가능. JWT 주입 인가 레이어가 필수 조건.
- **[조건] 슬라이드 3장 = 정적 카피 고정, CMS/애니 금지** (roi): 제작비 최소는 운영캡 안에서만 유효.
- **[조건] FCM 푸시는 R13 인프라 전제** (code): 그 전까지 서버상태 폴링 폴백을 MVP 기본으로.
- **[제외] OTP rate-limit 수치 격상 거부** (roi): 10회/일·5회/10분은 F01 명세 운영 파라미터. 토론이 발명할 정당성 아니라 OTP에 흡수할 구현 디테일. featureCall 부풀리기 방지.
- **거절 후 동일센터 재신청은 구현 0** (code): exists_pending_request가 pending만 검사. OTP rate-limit이 어뷰징 간접 상한이라 별도 쿨다운 불필요.

## 쟁점별 판정 (표)

| 기능 | A | B | 결정 | Phase | 이유 |
|------|---|---|------|-------|------|
| 셀프 연동신청 엔드포인트 `POST /me/link-requests` (Person JWT 인증, person_id JWT 강제 주입) | include | include | **include** | MVP | code: 현재 link POST는 WRITE_CLIENT라 내담자 호출 불가. R1~R3 깔때기 필수 전제. CreateLinkRequestService 재사용. **B 조건 채택: body person_id 무시·JWT 주입 인가 레이어 필수**(위조 방지). |
| 전화 OTP 생성·저장·검증·잠금 로직 (TTL 3분, rate-limit은 F01값 흡수) | include | include | **include** | MVP | code/px: 발송채널은 0 신규지만 코드·TTL·잠금 저장은 부재로 신규(Redis 또는 신규 테이블). 미검증 번호=오연결 사고(T10). **B 정정 채택: "신규 0"은 발송에만 해당.** OTP 생략 절충안 거부. |
| **승인 시 1 Person 1 Client(센터당) 중복 연동 가드** (ApproveLinkRequestService 신규 검증) | (R9 연기) | include | **include** | MVP | code: approve에 pending 체크만 있고 모델 주석의 중복 금지 미구현. **임상데이터 오연결 본질 게이트는 OTP가 아니라 승인 검증.** A의 R9 연기는 회피이며 relation 인가와 별개인 link 본연 제약. **B 채택, A의 암묵적 R9 위임을 번복.** |
| 센터코드→센터명 조회 엔드포인트 (순서: 코드→센터명 확인→OTP) | include | include | **include** | MVP | code/px: center.code String(6) unique 실존, 단순 lookup. 민감정보 제공 전 연결대상 확인이 이탈 감소. |
| 전화번호 최초 1회 검증 후 재사용 (추가 연동 시 재OTP 없음, 변경 시 재인증) | include | include | **include** | MVP | px/code: Person.phone/link.phone 매칭키·스냅샷 실존. 멀티센터 2번째 재OTP 제거로 마찰 1스텝. R2 무전환 일치. **B 명시: 번호 변경 재인증이 과거 link.phone 스냅샷에 영향 없음.** |
| 역할/연결대상 선택을 센터 승인이 전량 흡수 (앱은 코드+OTP만) | include | (전제부) | **include** | MVP | code: 흡수가 성립하려면 위 approve 중복 가드가 전제. 그 가드와 함께 묶여 성립. |
| 승인/거절 통지 + 거절 후 동일센터 재신청 허용 | include | include | **include** | MVP | code: status 3상태·pending-only 검증으로 재신청 자연 통과(구현 0). **B 조건: FCM 푸시는 R13 전제, MVP는 서버상태 폴링 폴백 기본.** |
| 소셜 로그인 (카카오/네이버/애플, Account/Person 무변경 + apple provider 추가) | include | include | **include** | MVP | code: 기존 구조 재사용, 모델변경 0. apple 검증+enum 추가만 신규. provider_id 매칭으로 Private Relay 대응. ISSUE-006 상세는 구현 단계 과제. |
| 온보딩 슬라이드 3장 + '나중에 할게요' 미소속홈 직행 1급 경로 | include | include | **include** | MVP | roi: R1~R3 깔때기 재정의상 코드입력 강제는 우회 차단. 로컬 1회 표시(백엔드 0). **B 조건: 정적 카피 고정·CMS/애니 금지(운영캡 준수).** |
| 대기홈 '센터에 문의' 보조 동선 | defer | defer | **defer** | Phase 2 | roi: 대기홈 본체는 R3 본문 재사용 확정. 문의 채널·카피는 R8 톤과 묶임. 승인지연 누수는 통지/폴링으로 1차 완화. |
| 온보딩 단계 역할(본인/보호자) 선택 UI | exclude | exclude | **exclude** | - | code: 역할은 승인 시 센터 지정. 앱에서 물으면 데이터근거 없고 오답 여지+R9 침범. 첫 신청을 무겁게 만들어 깔때기 역효과. |
| OTP 생략하고 센터코드만으로 즉시 연동신청 | exclude | exclude | **exclude** | - | px/code: link.phone이 Client 매칭키·본인확인 근거. 미검증 번호로 타인 임상기록 오연결 시 개인정보·임상안전 사고(T10). 마찰 절감이 안전을 못 넘음. |
| OTP rate-limit 수치를 별도 featureCall로 격상 | - | exclude | **exclude** | - | roi: 10회/일·5회/10분은 F01 명세 운영 파라미터. OTP에 흡수할 구현 디테일. featureCall 부풀리기 방지. |

## 결정 요약

온보딩→연동은 R1~R3 깔때기의 종착점이며, 코드 현실은 옹호 방향에 우호적이다(센터코드·전화번호·SMS 발송·link 3상태 모두 실존). MVP 신규 백엔드는 정확히 **4가지**로 못박는다:

1. **셀프 연동신청 엔드포인트** (`POST /me/link-requests`, Person JWT 인증) — body의 person_id 무시·JWT 강제 주입(위조 방지). 내부 CreateLinkRequestService 재사용.
2. **OTP 코드 생성·TTL 저장·검증·실패잠금 로직** — 발송 채널은 재사용(신규 0)이나 코드/TTL/잠금 저장은 신규(Redis 또는 짧은 TTL 테이블).
3. **approve 시 1 Person 1 Client(센터당) 중복 연동 가드** — 임상데이터 오연결의 본질 게이트. A가 R9로 미룬 것을 번복하여 이번 라운드 신규 include(relation 인가 R9와 별개인 link 본연 제약).
4. **센터코드→센터명 lookup 엔드포인트** — 단순 조회.

플로우 골격: 코드→센터명 확인→전화OTP(최초 1회, 이후 재사용)→신청→센터 승인(역할/대상/중복검증 흡수)→승인·거절 통지(MVP는 폴링 폴백, FCM은 R13). 미연동 사용자는 '나중에 할게요'로 미소속홈 직행이 정상 경로. 역할 선택 UI와 OTP 생략은 제외.

## 남은 질문

- (R9) relation 기반 보호자 인가는 미정. 단 link 본연의 1Person-1Client 중복 가드는 R9와 분리되어 이번 라운드에서 처리됨을 R9에서 재확인할 것.
- (R13) 승인/거절 푸시의 FCM 인프라 확정 전까지 폴링 폴백의 폴링 주기·종료 조건. 여러 센터 동시 대기 시 통지 표현.
- (구현) OTP 저장소: Redis vs 짧은 TTL 테이블 — 운영 인프라 가용성에 따라 결정. ISSUE-006(애플 Private Relay) provider_id 매칭 상세.
- (R8) 대기홈 '센터에 문의' 카피·채널, 승인 지연 누수 완화 톤. 여러 센터 동시 대기 멘트 표현.
- (정책) 거절 후 재신청 무한 반복의 OTP rate-limit 간접 상한이 충분한지, 센터 측 거절 사유 노출 여부(센터 운영정책 결정 필요).

## 다음 라운드로 이어받기

온보딩→연동 골격은 코드→센터명 확인→전화OTP(최초 1회 검증 후 재사용)→셀프 신청→센터 승인으로 확정됐다. MVP 신규 백엔드는 셀프 신청 엔드포인트(JWT person_id 강제)·OTP 로직·**approve 중복 연동 가드**·센터명 lookup 4가지로 못박혔다(특히 중복 가드는 A의 R9 위임을 번복하여 link 본연 제약으로 분리). 역할 선택 UI/OTP 생략은 제외, 슬라이드+'나중에' 직행은 깔때기 정상 경로. R5(종합+시안 v1)는 이 연동 플로우를 R1~R3의 IA 골격 위에 배치하되, relation 인가(R9)와 FCM 푸시(R13)는 건드리지 말고 폴링 폴백·미정 인가를 가정으로 둔 채 시안을 그린다.
