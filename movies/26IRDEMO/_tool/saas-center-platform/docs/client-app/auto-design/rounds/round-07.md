# Round 07 — 검사 결과 열람/히스토리 — send_result 기반

## 주제/긴장
- 주제: 내담자/보호자 앱에서 검사 결과를 어떻게 열람·보관·이력화할 것인가. 기존 send_result(4자리 인증 PDF 전달 장치) 위에 계정 기반 "내 결과 목록"을 신설할지.
- 관련 긴장: **T10(공개범위)** — 무엇을, 언제, 누구에게 보일지. 계정 기반 내결과목록은 시드 명시 신규.
- 코드 현실 확인(이번 라운드 검증 완료):
  - `send_result/models.py:54,60` — `expired_at`/`revoked_at` 실재. 회수/만료 라이프사이클이 데이터에 이미 있음. visibility/공개수준 enum은 **없음**.
  - `send_result/facade/send_result_facade.py:132-217` — `verify_with_response`는 4자리 코드 검증 후 `completed + report_document_id` task만 필터링(171-179)해 presigned PDF URL을 생성(190-217). 응답은 reports[](PDF)+pending[]뿐, 구조화 점수/영역별/소견 필드 없음. 코드 검증부만 떼면 재사용 가능.
  - `send_result/router.py:52` `list_send_results` — `case_id` + 센터 admin 권한(READ_SEND_LINK) 전제. **내담자 본인(JWT client) 조회 경로 0** = R4/R6과 동급 구조적 공백.
  - `client/favorite/services/build_signals.py:63-66` — `assessment_result_ready` 신호는 **client/favorite 모듈**(상담사용, router는 READ_CLIENT, action 카피 "결과를 공유해 주세요"). 내담자 앱 재사용 불가.
  - `assessment_task/models.py:83` — `report_payload: dict | None` **실재**. 단 표준 점수 스키마가 아닌 Jinja 템플릿 결합 자유형 dict(`generate_report_pdf_service`). 공통 영역별 바 렌더에는 정규화 스키마 신설 필요.

## A · 옹호 주장 (근거 포함)
검사 결과는 내담자/보호자가 앱에 머무를 가장 강력한 단일 가치. 하지만 F04 명세의 3단 공개수준·영역별 바·종합소견 인라인 렌더는 백엔드에 하나도 없는 완전 신규. 명세의 환상이 아니라 send_result가 이미 내려주는 PDF를 자산으로 삼는다.
- **계정 기반 `/me/assessment-results` 엔드포인트는 MVP 신규 백엔드 포함** (code): `list_send_results`는 센터 admin 전제라 내담자 본인 호출 경로 0. JWT client_id로 본인 소속 모든 센터의 case 중 '활성 send_result 존재' case만 화이트리스트 반환(미존재=미공유=목록 제외), 멀티센터는 R6대로 client-side N-call 시간순 머지. '추가비 0'이 아니라 실재 신규 비용임을 명시.
- **열람 단위는 PDF 그대로, 인라인 영역별/소견 렌더는 Phase 2** (code): verify가 내려주는 건 presigned PDF뿐. 구조화 바/소견 렌더는 데이터 모델 신설 동반. PDF 뷰어 임베드로 가치 95% 전달.
- **앱 내 열람은 4자리 코드 재입력 없이 JWT 신원으로 verify 대체** (px): 4자리 코드는 익명 수신자용. OTP(R4)로 신원검증된 로그인 사용자에게 내 폰에서 내 결과에 재입력은 가짜 마찰. JWT client_id 검증으로 presigned URL 직접 발급, 외부 익명 verify-result 병존.
- **T10 공개범위 = send_result 라이프사이클 흡수, 신규 visibility 컬럼 0** (code): R6 '상담사 의도 유일 게이트' 재사용. 미발급=미노출, revoked=즉시 회수, expired=만료표시. MVP는 2상태(공유됨/미공유). 3단 비공개/요약/전체는 신규 enum이라 박으면 send_result 컬럼추가+SaaS 발송UI 전면개편 강제(R3 위반).
- **홈 캐러셀 '미공유' 신호 → 목록 동선, build_signals.py `assessment_result_ready` 이미 구현, 신규 거의 0** (roi): 카피는 '결과 준비 중'('결과 도착' 금지). 오표기 시 상담사 미검수 결과 기대 유발 = T10 신뢰 붕괴.
- **재실시 시점별 점수 비교 차트는 Phase 2 고정** (code): F04 §7 기 Phase2. PDF 한 덩어리에서 시계열은 점수추출/정규화 신규 파이프라인. F12(P3)와 묶어 후순위.

## B · 검증 반박 (근거 포함)
A의 골격(PDF 자산화 + 계정 기반 목록·재인증 없는 열람 MVP + 시각화 Phase 2 + T10을 라이프사이클로 흡수)은 코드 검증 결과 대체로 정당. 그러나 A는 두 군데에서 코드 현실을 잘못 읽었다.
- **목록 엔드포인트 포함 동의** (code): `list_send_results`는 case_id+센터 권한 전제, send_result 모델은 center_id/case_id 단위라 JWT client 본인 조회 경로 0 확인. R4/R6 동급 신규. 단 화이트리스트는 `verify_with_response`의 task 필터(171-179)·presigned 생성부를 재사용 가능하므로 신규는 "인증 게이트 교체 + 멀티센터 N-call 머지"에 한정.
- **JWT 열람 포함 동의** (code): `verify_with_response` 159-233행에서 코드 검증부(159-164)만 JWT 게이트로 교체하면 reports[] 생성 로직 100% 재사용. 익명 verify-result 병존 비용 0.
- **T10 라이프사이클 흡수 포함 동의** (code): `revoked_at`/`expired_at` 실재(models.py)+verify 서비스가 이미 검증. 3단 enum 부재라 MVP 강제 시 SaaS 발송UI 개편 역전(R3 위반).
- **정정 1 — 홈 신호는 A의 근거가 틀렸다 → defer** (code): A가 인용한 `assessment_result_ready`는 `client/favorite`(상담사 관심 내담자 카드) 모듈이고 router가 READ_CLIENT, 카피가 "결과를 공유해 주세요"로 상담사를 향한다. 내담자 앱 재사용 불가, client-facing 신호는 net-new. 더 근본적으로 A가 정의한 목록 엔드포인트는 'send_result 존재 case만' 반환하므로 **미공유 case는 애초에 목록에 안 들어온다** — 미공유 신호는 별도 차집합 조회(client용 신규)가 필요. 신규 비용 실재라 강등.
- **정정 2 — 시각화 Phase 2 연기 결론은 맞으나 '구조화 데이터 0'은 과장** (code): `report_payload: dict|None`가 `assessment_task/models.py:83`에 실재하고 `generate_report_pdf_service`가 Jinja 템플릿으로 렌더. 즉 원천 데이터가 아예 없는 건 아니다. 다만 표준 점수 스키마가 아닌 검사별 템플릿 결합 자유형 dict라 정서/인지/사회성 공통 바를 client에서 그리려면 정규화 스키마 신설 필요. 연기 결론 유지, 근거를 '데이터 0'에서 '비표준·템플릿결합 dict라 정규화 신설 필요'로 정정.
- **시계열·AI 재가공·코드 강제 제외/연기는 A 판정 그대로 인정** (roi): 시계열은 report_payload 비표준이라 점수추출/정규화 신규(F04 §7 일치). AI 재가공은 production 미배포+임상 책임경계 붕괴(T10). 4자리 코드 앱 강제는 OTP 신원검증 후 음의 가치.

## 쟁점별 판정 (표: 기능 | A | B | 결정 | Phase | 이유)
| 기능 | A | B | 결정 | Phase | 이유 |
| --- | --- | --- | --- | --- | --- |
| `/me/assessment-results` (JWT client, 활성 send_result case만 화이트리스트, N-call 머지) | include | include | **include** | MVP | code: 내담자 본인 조회 경로 0 = R4/R6 동급 신규 백엔드 필수. send_result 미존재=미노출 게이트가 R6 화이트리스트 원칙의 정확한 재사용. 양측 일치. B 정정 채택 — 신규 범위는 verify의 task 필터·presigned 생성부 재사용으로 **인증 게이트 교체+멀티센터 N-call 머지에 한정**. |
| 앱 내 PDF 열람 (4자리 코드 대신 JWT 신원으로 presigned 직접 발급, 외부 익명 verify 병존) | include | include | **include** | MVP | px/code: `verify_with_response` 159-233행 코드 검증부만 JWT 게이트로 교체하면 reports[] 생성 100% 재사용. OTP 신원검증된 사용자에 재입력은 가짜 마찰. 익명 링크 무변경 병존=비용 0. 양측 일치. |
| 공개범위 게이트 = send_result 라이프사이클 흡수 (MVP 2상태: 공유됨/미공유) | include | include | **include** | MVP | code: `revoked_at`/`expired_at` 실재+verify가 이미 검증. 미발급=미노출/revoked=회수/expired=만료로 T10 충족. visibility 컬럼 0. 양측 일치. |
| 홈 캐러셀 '미공유' 신호 → 목록 동선 (카피 '결과 준비 중', '결과 도착' 금지) | include | defer | **defer** | Phase 2 | B 채택. code: A의 '이미 구현, 신규 0' 오류 — `assessment_result_ready`는 client/favorite 상담사 모듈(READ_CLIENT, "결과를 공유해 주세요")이라 내담자 앱 재사용 불가. 게다가 목록은 send_result 존재 case만 반환하므로 미공유=별도 차집합 조회 신규. client-facing 신호 net-new라 강등. **단 A의 카피 원칙('결과 준비 중', '결과 도착' 오표기 금지=T10)은 Phase 2 구현 시 적용하도록 채택·메모**. |
| 화이트리스트 적용 경계 명시 (메타 레벨 게이트, PDF 본문은 상담사 책임) | — | — | **include** | MVP | code/px(C 신설): PDF는 발행 한 덩어리라 R6 응답 스키마 화이트리스트가 **PDF 본문에는 적용 불가**. 게이트는 "send_result 존재 여부" 메타 레벨에서만 작동. PDF 내용 통제는 상담사 발행 책임으로 명시 이관, 앱은 무가공. R6 화이트리스트 경계의 자연스러운 후속 명시이지 신규 비용 아님. |
| 보호자 자녀 검사 결과 열람 (relation 기반 인가) | defer | defer | **defer** | Phase 2 | code: relation 인가는 시드 명시 신규(부재)이며 R9 소관. 목록 엔드포인트는 MVP지만 자녀 데이터 접근 인가/프라이버시는 R9 결정. v1은 본인만, 자녀는 더미+주석. 양측 일치. |
| 3단 공개수준 + 영역별 결과 바 + 종합소견 인라인 렌더 | defer | defer | **defer** | Phase 2 | code: 3단 enum 부재. `report_payload`(dict)는 존재하나 표준 점수 스키마가 아닌 Jinja 템플릿 결합 자유형이라 공통 바 렌더에 정규화 스키마 신설 필요. 박으면 send_result 컬럼추가+SaaS 발송UI 개편 역전(R3 위반). PDF 임베드로 가치 대부분 전달. 결론 일치, A의 '데이터 0' 근거는 B대로 '비표준·템플릿결합 dict라 정규화 신설 필요'로 정정. |
| 동일검사 재실시 시점별 점수 비교 차트 / 회기 비교 뷰 | defer | defer | **defer** | Phase 3 | code: `report_payload` 비표준이라 시계열은 점수추출/정규화 신규 파이프라인(F04 §7 Phase2 일치). 비용 정당화 불가, F12 AI 성장가이드(P3)와 묶음. 양측 일치. |
| 앱 자체 결과 PDF 재생성/AI 요약 가공 | exclude | exclude | **exclude** | - | roi/code: AI는 시드상 production 미배포(별도 승인). 발행 PDF를 앱이 재가공하면 임상 책임 경계 붕괴(T10). 발행본 그대로 열람이 원칙. 양측 일치. |
| 4자리 코드를 앱 내 열람에도 강제 (verify 그대로) | exclude | exclude | **exclude** | - | px: OTP 신원검증된 사용자에 내 폰에서 코드 재입력은 음의 가치. JWT 신원으로 대체. 익명 외부 링크에만 코드 유지. 양측 일치. |

## 결정 요약
- **MVP 골격**: 계정 기반 `GET /me/assessment-results`(JWT client, 활성 send_result 있는 case만 화이트리스트, 멀티센터 N-call 시간순 머지) + 앱 내 PDF 열람(4자리 코드 대신 JWT 신원 게이트로 presigned URL 직접 발급, 외부 익명 verify-result 병존). 신규 백엔드 비용은 verify의 task 필터·presigned 생성부 재사용을 전제로 **"인증 게이트 교체 + 멀티센터 N-call 머지"에 한정**해 R4/R6과 동급으로 명시 LOCK.
- **T10 공개범위**는 send_result 라이프사이클(미발급/revoked/expired)을 정책 엔진으로 흡수, MVP 2상태(공유됨/미공유). 신규 visibility 컬럼 0. 3단 공개수준은 백엔드 부재 + R3 위반 위험으로 Phase 2.
- **열람 단위 = 발행 PDF 그대로**. 영역별 바/종합소견 인라인 렌더와 시계열 비교 차트는 `report_payload`가 비표준 템플릿결합 dict라 정규화 스키마 신설이 필요해 Phase 2(시계열은 F12와 묶어 Phase 3). 앱 무가공 원칙(AI 재가공 exclude)으로 임상 책임 경계 보존.
- **화이트리스트 경계 명시(C 신설)**: 화이트리스트는 "send_result 존재" 메타 레벨에서만 작동하며 PDF 본문 통제는 상담사 발행 책임으로 명시 이관. R6 응답 스키마 화이트리스트의 자연스러운 후속.
- **이전 결정 번복**: 라운드 내에서 A의 '홈 미공유 신호' include를 **defer로 번복(B 채택)**. 사유 — A 인용 `assessment_result_ready`는 상담사용 client/favorite 모듈이고, 목록 엔드포인트가 send_result 존재 case만 반환하므로 미공유는 별도 차집합 조회 신규가 필요(net-new). 카피 원칙은 Phase 2로 계승. R6 화이트리스트·N-call 머지·상담사 의도 유일 게이트 원칙은 그대로 계승·확장.

## 남은 질문
- (R9) 보호자→자녀 결과 접근 relation 인가 범위·프라이버시, role both 시 본인/자녀 결과 위계, `/me/assessment-results`의 자녀 case 포함 조건. link 중복 가드와의 관계.
- (백엔드) `/me/assessment-results`의 fan-out 형태: client가 센터 스코프 N회 호출 vs 서버가 N회 fan-out 후 합산 — R6 집계 엔드포인트 제외 결정과 경계 재확인. (결과 목록은 case 단위 단순 머지라 '집계' 아님으로 정리하되 명시 필요.)
- (Phase 2) 홈 '미공유→목록' 신호의 client-facing 차집합 조회 설계: 완료됐으나 send_result 미발급 case를 내담자에게 어떻게 노출할지, '결과 준비 중' 카피의 T10 안전성(상담사 미검수 기대 유발 방지).
- (Phase 2) `report_payload` 자유형 dict를 영역별 바·종합소견 공통 렌더로 쓰기 위한 정규화 스키마 비용, send_result 3단 공개수준 enum 도입 시 SaaS 발송 UI 개편 범위.
- (보안) presigned URL 만료 동안 URL 유출 시 익명 접근 가능 — 앱 내 열람을 매 호출 재발급으로 할지, in-app 뷰어가 URL을 캐싱·노출하지 않게 할지.
- (만료/회수 UX) expired/revoked된 결과의 목록 표시: 완전 제거 vs '만료됨' 비활성 표시 — "있었는데 사라졌다" 혼란 방지 카피. R8 톤과 연동.

## 다음 라운드로 이어받기
검사 결과 열람은 send_result를 자산으로 재사용해 확정했다. MVP는 `GET /me/assessment-results`(JWT client 화이트리스트 + 멀티센터 N-call 머지, 신규는 인증게이트 교체+머지로 한정)와 앱 내 PDF 열람(JWT 신원 게이트로 verify 4자리 코드 대체, 외부 익명 링크 병존), 공개범위는 send_result 라이프사이클 2상태(공유됨/미공유) 흡수로 신규 visibility 컬럼 0이다. 화이트리스트는 send_result 존재 메타 레벨에서만 작동하고 PDF 본문 통제는 상담사 발행 책임으로 이관됨을 명시했다. A의 홈 미공유 신호 include는 `assessment_result_ready`가 상담사 모듈이고 미공유 case가 목록에 없어 차집합 조회 신규가 필요하므로 라운드 내 defer로 번복(카피 원칙만 계승). 영역별 바·종합소견 인라인·3단 공개수준은 report_payload가 비표준 템플릿결합 dict라 정규화 신설이 필요해 Phase 2, 시계열 비교는 F12와 묶어 Phase 3, AI 재가공·코드 재강제는 exclude. 후속 라운드는 이 결과목록/PDF 열람/2상태 게이트 경계를 건드리지 말고, 보호자 자녀 결과 접근 relation 인가(R9), 빈 상태·미공유·만료 카피 톤(R8), fan-out 형태의 R6 집계 제외 정합, presigned URL 보안 처리만 채운다.
