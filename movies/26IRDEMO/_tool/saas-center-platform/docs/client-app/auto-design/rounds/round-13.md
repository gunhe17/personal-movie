# Round 13 — 알림/푸시 인프라 & 리텐션

## 주제/긴장

- 주제: 내담자 앱의 알림/푸시 인프라와 리텐션 루프를 어디까지 MVP로 끌어올 것인가.
- 관련 긴장: FCM/푸시 인프라, 다중센터/자녀 알림 규칙(R9 relation 인가 재사용), 트랜잭션 알림 vs 콘텐츠 넛지(R1 동반자 정체성).
- 프레이밍 합의: 이번 라운드는 "신규 인프라를 정당화할 것인가"가 아니라 "이미 가동 중인 백엔드 알림 인프라를 내담자 앱으로 어디까지 끌어올 것인가"의 문제다. 양측 모두 동의.

코드로 재확인된 기존 자산:
- `FirebaseService.send_push` — platform==ios+ExponentPushToken이면 Expo Push, 그 외 FCM 자동 분기 (모바일=Expo이므로 iOS 경로 구현됨).
- `PushToken` 모델 — account_id 기반 멀티디바이스, token unique, 모든 인덱스/쿼리가 `(center_id, account_id)` 강제 스코프.
- 글로벌 `'*'` channel_push 게이트 (helpers.py 166-181) — 전체 on/off가 코드에 일급 개념으로 존재.
- `event_ref` unique dedup (notification/models.py:74) — DB 레벨 중복 발송 차단.
- advisory-lock 보호 APScheduler 잡: 상담사 24h(매시간 :00)·내담자 일간 09시 KST(`send_client_sms_reminders_job`, jobs.py:129).

## A · 옹호 주장 (근거 포함)

1. **푸시 인프라는 신규가 아니라 재사용** (code): FirebaseService/PushToken/Scheduler 위에 얹힌다. 내담자=Account/Person 재사용이라 신규 백엔드는 "수신자 해석 client→account 한 가닥"뿐.
2. **MVP 핵심: 기존 내담자 SMS 리마인더를 '푸시 우선·SMS 폴백'으로 승격** (roi/code): `send_client_sms_reminders_job`이 이미 09시 KST 발송 중. 활성 토큰이면 푸시·없으면 SMS 폴백 → 신규 스케줄 슬롯 0, SMS비 절감 이중 이득. 리텐션 ROI 최대/비용 최소.
3. **전체 on/off만 MVP, 종류별/방해금지 제외** (code): 글로벌 `'*'` channel_push 한 행 토글로 끝. F07 §4 일치, 종류별은 과설계.
4. **이벤트성 즉시 알림(승인/변경/취소)은 MVP, client→account 수신자 해석이 유일 신규 비용** (code): recipient_resolver는 Member 전용이라 내담자 경로 부재. ClientFacade로 잇는 한 함수, 발송부 100% 재사용, event_ref unique가 중복 방지.
5. **알림 터치 딥링크는 data.type 슬롯과 이미 맞물림** (px): helpers.py 146 push data에 type 자동 삽입. 승인 알림 터치 → R3/R4 소속홈 자동 전환 = activation 완결.
6. **보호자 자녀 알림: 수신자 해석까지 MVP, 묶음 카피는 Phase 2** (code): R9 1-hop 헬퍼 재사용으로 자녀 일정을 보호자 account 라우팅. MVP는 자녀 1건당 1알림.
7. **당일 1시간 전 알림은 Phase 2** (code): 매시간 크론은 0~59분 오차, 분단위 정밀 신규 잡 net-new. D-1 푸시로 깜빡 방지 대부분 충족.
8. **오브 톤 카피 MVP, 고위험 카피는 R8/R14 톤 종속** (px): 문자열 교체 비용 0, 동반자 정체성 직결.
9. **콘텐츠/매거진/미션 넛지 제외** (roi/px): R1 마케팅 금지 LOCK. 알림 피로 → 전체 off → 일정 리마인더까지 잃는 리텐션 자해.
10. **검사 결과 공유 알림 MVP** (code/px): R7 send_result 발행이 자연 트리거, 터치 시 R7 인앱 PDF 직행. 카피는 T10 오표기 금지, event_ref `send_result:{id}:shared`.

## B · 검증 반박 (근거 포함)

A의 큰 그림(재사용 프레이밍)과 자체 제외/연기 판정(콘텐츠 넛지·1시간 전·자녀 묶음·종류별)은 모두 인정. 단 A가 비용을 "한 가닥/한 함수/100% 재사용"으로 축소한 세 지점에서 코드 현실이 다르다.

1. **'푸시 발송부 100% 재사용'은 Member 경로에만 참** (code): notify_members(78-220)만 NotificationFacade.notify_bulk(인앱 Notification 생성)+find_active_by_accounts(push_token)+글로벌 게이트+type 삽입을 한다. 내담자 경로 `resolve_client_sms_targets`(483-530)는 phone만 뽑고, `send_sms_to_client`(533-580)는 알림톡/SMS만 — **create_notification 없음, event_ref dedup 없음, push_token 조회 없음, account_id 미취급**. 따라서 "기존 SMS 잡에 토큰 분기만 얹기"는 실제로는 내담자용 푸시 디스패치 경로를 Member 머신 참고로 새로 조립하는 일. dedup 필요 시 내담자 알림에도 Notification row+event_ref 신설 필요. 비용은 0/낮음이 아니라 **중간(기존 부품 재조립)**으로 정정.
2. **client→account 해석은 '한 함수'가 아니라 person_id NULL 분기 계약** (code): `Client.person_id`는 nullable(models.py:48, "앱 미사용 보호자는 NULL"). person_facade는 account→person 방향만 존재(reverse 부재). 신규 헬퍼는 client_id→person_id(NULL이면 푸시 불가→SMS 폴백)→account→활성 토큰 순서. **폴백 1차 분기가 '토큰 없음'이 아니라 'person_id NULL(앱 미연동)'임을 LOCK**해야 앱 미설치자가 알림을 잃지 않는다. fail-open 방지 계약이라 명시 비용으로 격상.
3. **push_token 등록 라우터는 get_center_context(=Member 검증) 의존** (code): router.py가 Member 조회 실패 시 403. 내담자는 Member가 아니므로 "라우터 그대로 재사용"(A featureCall #1)은 403 오류. **모델·repository·service는 재사용 가능하나 client JWT 컨텍스트 기반 등록 경로는 신규**(비용 작지만 0 아님).
4. **PushToken center_id 강제 스코프** (code): 한 account가 여러 센터 연결 시 리마인더 잡(schedule.center_id 단위)이 다른 센터 등록 토큰을 못 찾을 경계. A 미언급. center-scoped vs account-wide 토큰 조회 결정이 Phase 설계에 필요 → defer 항목 신설.
5. A 제외/연기 4건(콘텐츠 넛지·1시간 전·자녀 묶음·종류별)은 코드·정책 근거 견고, 검증자로서 반박 없음.

## 쟁점별 판정 (기능 | A | B | 결정 | Phase | 이유)

| 기능 | A | B | 결정 | Phase | 이유 |
|---|---|---|---|---|---|
| 내담자 앱 푸시 토큰 등록/해제 (모델·repo·service 재사용, 라우터는 client JWT 분기 신규) | include | include | **include** | MVP | 푸시 대전제. PushToken 모델/repo/service는 account 기반 재사용 가능하나, 기존 router는 get_center_context(Member)라 내담자 403 — **A의 '라우터 그대로 재사용'은 B 정정 채택, client JWT 등록 경로 신규(비용 작지만 0 아님) LOCK** (code) |
| client_id→Person.account_id 수신자 해석 헬퍼 (person_id NULL→SMS 폴백 fail-safe) | include | include | **include** | MVP | 모든 내담자 알림의 공유 전제. **B 정정 채택: '한 함수' 아닌 계약 — 1차 분기는 person_id NULL(앱 미연동)→SMS 폴백, 2차 토큰 없음→SMS 폴백. reverse(client→account) 경로 부재. fail-open 방지 계약으로 명시 비용 격상** (code) |
| 내담자 일정 리마인더 SMS→푸시 승격 (활성 토큰 푸시, person_id NULL이거나 토큰 없으면 SMS 폴백) | include | include | **include** | MVP | `send_client_sms_reminders_job` 09시 KST 실재, 신규 스케줄 슬롯 0. **단 기존 client SMS 경로(resolve_client_sms_targets/send_sms_to_client)는 push_token·Notification·event_ref 전무 — B 정정 채택: '토큰 분기만 얹기' 아닌 내담자 푸시 디스패치 경로 재조립. ROI는 여전히 최고, 비용은 '낮음'→'중간(부품 재조립)' 정정** (roi/code) |
| 센터 승인 즉시 알림 (R4 approve 시점 훅) | include | include | **include** | MVP | 수신자 해석 헬퍼+내담자 디스패치 경로 위 종속 기능. event_ref `link:{id}:approved`. 터치 시 R3/R4 소속홈 자동전환 activation 완결. **dedup용 Notification row를 내담자 경로에 신설해야 함(기존 SMS 경로엔 없음)** (px/code) |
| 일정 변경/취소 즉시 알림 (schedule write 시점 훅) | include | include | **include** | MVP | 깜빡 방지 핵심 신뢰 알림. write 자체는 센터 admin 수행(R11 셀프예약 Phase2 무관), 알림만 즉시. 수신자 해석+client 디스패치 자산 종속 (code/px) |
| 검사 결과 공유(send_result 발행) 즉시 알림 → 인앱 PDF 열람 딥링크 | include | include | **include** | MVP | R7 send_result 게이트가 정확한 트리거, 터치 시 R7 인앱 PDF 직행으로 리텐션+핵심가치 결합. **'독립 저비용' 아닌 공유 자산(수신자 해석+client 디스패치) 종속 — B 정정 채택. 카피 R7 T10 오표기 금지 LOCK, event_ref `send_result:{id}:shared`** (code/px) |
| 마이페이지 전체 알림 on/off 토글 (글로벌 '*' channel_push) | include | include | **include** | MVP | helpers.py 166-181 글로벌 '*' channel_push가 push 발송 게이트하는 일급 개념. 한 행 토글, 신규 enum/스키마 0. F07 §4 일치. **단 setting 조회/upsert가 내담자 account+center 컨텍스트에서 동작하는지 확인(현 게이트 center_id 포함)** (code/px) |
| 기기 알림 권한 거부 시 인앱 안내 + 설정 이동 | include | include | **include** | MVP | RN 앱 측 권한 체크+인앱 배너, 백엔드 무변경. 권한 거부자 무음 이탈 방지. F07 §6, 비용 거의 0 (px) |
| 알림 터치 딥링크 (data.type 기반 홈 라우팅) | include | include | **include** | MVP | helpers.py 146 push data에 type 자동 삽입. F07 §5 동선 단순(대부분 홈), RN 라우팅 한 함수. **단 내담자 디스패치 경로에도 동일 type 삽입 포함 필요(기존 SMS 경로엔 없음)** (code/px) |
| 알림 오브 톤 카피 (시스템→따뜻한 안내) | include | include | **include** | MVP | 메시지 빌더 문자열 교체 비용 0, 동반자 정체성 R1 직결. 감정 강도/고위험 카피는 R8·R14 톤 LOCK 종속, 임상 자극 카피 금지 (px) |
| 보호자 자녀 알림 수신자 해석 (R9 1-hop 헬퍼 재사용, 자녀 1건당 1알림) | include | include | **include** | MVP | R9 LOCK person→본인Client→get_children 1-hop을 수신자 해석에 재사용. **본질=수신자는 보호자 account, 대상은 자녀 일정(자녀 Client person_id NULL이어도 보호자 account로 라우팅). relation row 품질 fail-open 경고(R9) 승계, 기존 빌더 재사용** (code/px) |
| 같은 날 N건 묶음 카피 + 양쪽 부모 fan-out 최적화 | defer | defer | **defer** | Phase 2 | build_reminder_sms_message는 단건 빌더, N건 묶음은 신규 빌더 로직. 자녀 1건당 1알림(MVP) 안착 후 카피 최적화. 핵심 도달성은 MVP로 확보 (code) |
| 당일 1시간 전 알림 | defer | defer | **defer** | Phase 2 | 잡은 매시간(:00)/일간(00:00 UTC)뿐, 분단위 정밀은 5~15분 크론 또는 per-schedule 디스패치 net-new. D-1 푸시로 깜빡 방지 핵심 충족 후 Phase 2 (code) |
| 멀티센터 내담자 push_token 조회 스코프 결정 (center-scoped vs account-wide) | (미언급) | defer | **defer** | Phase 2 | **B 신설 항목 채택. PushToken 전 쿼리 center_id 강제 스코프 확인. 한 account 멀티센터 연결 시 리마인더 잡(schedule.center_id 단위)이 타 센터 등록 토큰 미발견 경계. MVP는 account 기준 활성 토큰 전체 조회 vs 내담자 앱 단일 센터 컨텍스트 통일 중 택1을 Phase 설계에서 확정** (code) |
| 종류별 알림 설정(일정만/승인만) + 방해금지 시간 | exclude | exclude | **exclude** | - | 글로벌 '*' channel_push 단일 게이트로 충분. 카테고리 구조는 있으나 내담자 노출은 과설계+설정 복잡도. F07 §4 전체 on/off만 MVP (code/roi) |
| 콘텐츠/매거진/미션 리텐션 넛지 푸시 | exclude | exclude | **exclude** | - | R1 슈퍼앱 마케팅 금지·동반자 정체성 LOCK 위반. 마케팅 피로 → 전체 off → 일정 리마인더까지 잃는 리텐션 자해. 트랜잭션 알림 한정으로 opt-in율 보존, 콘텐츠는 R14 후 재론 (roi/px) |
| 내담자용 알림 타이밍 사용자 커스터마이즈 | exclude | exclude | **exclude** | - | F07 §1 타이밍 시스템 고정 명시. per-user 스케줄 계산 net-new로 부하 폭증, 고정 타이밍이 운영 단순성·예측가능성 우위 (code/roi) |

## 결정 요약

MVP 알림 = **트랜잭션 알림에 한정한 푸시 우선·SMS 폴백 리텐션 루프**로 확정한다. 11건 MVP: 토큰 등록/해제(client JWT 경로 신규), client→account 수신자 해석 헬퍼(person_id NULL fail-safe), 일정 리마인더 SMS→푸시 승격, 승인/변경·취소/검사결과 공유 3종 이벤트 알림, 전체 on/off 토글, 권한 거부 인앱 안내, 딥링크, 오브 톤 카피, 보호자 자녀 수신자 해석.

핵심은 **A의 재사용 프레이밍은 옳으나 비용 축소 3건을 B 정정으로 LOCK**한 것이다:
1. **푸시 발송부 100% 재사용 → Member 경로에만 참**. 기존 client SMS 경로는 push_token·Notification·event_ref가 전무하므로 내담자 푸시 디스패치는 Member 머신 부품의 재조립(비용 '중간'). 코드 직접 재확인 완료(helpers.py 483/533 vs 184).
2. **client→account 해석은 한 함수가 아닌 계약**: person_id NULL(앱 미연동)이 1차 폴백 분기 — fail-open 방지 LOCK. person_id nullable 코드 재확인(models.py:48).
3. **토큰 등록 라우터는 Member 검증 의존** → client JWT 경로 신규. router.py get_center_context 의존 재확인.

추가로 **멀티센터 토큰 스코프(center-scoped vs account-wide)를 B 신설 defer**로 남겨 미정 경계가 MVP 구현을 막지 않게 했다. A가 자체적으로 가른 제외/연기(콘텐츠 넛지·1시간 전·자녀 묶음·종류별·타이밍 커스텀)는 양측 일치로 그대로 확정. 이전 라운드 번복 없음 — R1(마케팅 금지)·R3/R4(소속홈 전환)·R7(send_result 게이트/T10)·R9(1-hop 인가) LOCK을 모두 재사용했다.

## 남은 질문

- 내담자 푸시 디스패치 경로의 구현 위치: 기존 send_sms_to_client 옆에 client용 dispatch를 새 함수로 둘지, notify 헬퍼를 account 기반으로 일반화해 Member/Client 공용 진입점을 만들지(후자는 회귀 표면 큼).
- dedup용 Notification row를 내담자 알림에도 생성할 때 event_ref 네이밍 규약 통일(reminder:{schedule_id}:{date} / link:{id}:approved / send_result:{id}:shared) 및 일간 리마인더의 멱등 키 설계(같은 일정 중복 발송 방지).
- 멀티센터 토큰 스코프 결정(Phase 2): account-wide 활성 토큰 전체 조회 vs 내담자 앱 등록 시 단일 센터 컨텍스트 통일 — R6 N-call 머지 전제(한 account 멀티센터)와 정합성.
- 전체 on/off 토글의 NotificationSetting 조회/upsert가 내담자 account+center 컨텍스트에서 동작하는지(현 글로벌 게이트가 center_id 포함) — 멀티센터 시 '*' 행이 센터별인지 account 전역인지 확인.
- 자녀 알림 fail-open 표면(R9): relation row 품질이 신뢰원이라는 경고가 알림 fan-out에서 오발송(타 보호자에게 자녀 일정 노출) 리스크로 증폭되지 않는지 — 수신자 해석에 본인 Client 존재+guardian 자격 1-hop 계약 재확인.
- 알림 카피 통일 톤(R8/R14 종속): 리마인더·승인·취소·결과 공유 각 메시지의 감정 강도와 고위험 맥락 카피 안전성을 R14 오브 톤 LOCK에서 일괄 확정.
- 1시간 전 알림(Phase 2)의 트리거 방식: 5~15분 크론 vs per-schedule 예약 디스패치 — 스케줄러 부하/중복 발송 트레이드오프 측정.

## 다음 라운드로 이어받기

알림 MVP는 **기존 백엔드 인프라(FirebaseService/PushToken/scheduler/글로벌 게이트/event_ref) 위에 내담자 디스패치 경로를 재조립**하는 것으로 확정됐고, 신규 비용 3개를 LOCK했다: (1) client JWT 토큰 등록 경로(라우터 Member 의존이라 그대로 재사용 불가), (2) client→account 수신자 해석 헬퍼(person_id NULL→SMS 폴백 fail-safe가 1차 분기), (3) 내담자용 푸시 디스패치+Notification/event_ref 신설(기존 client SMS 경로엔 전무). 알림 범위는 트랜잭션(리마인더·승인·변경/취소·결과 공유)에 한정하고 콘텐츠 넛지는 R1 LOCK으로 제외, 자녀는 R9 1-hop 헬퍼로 수신자 해석만 MVP·묶음 카피는 Phase 2, 1시간 전과 멀티센터 토큰 스코프는 Phase 2다. R14(오브/콘텐츠 ROI)는 이 알림 경계를 건드리지 말고 오브 비주얼·콘텐츠 획득 ROI를 판정하되, 알림 카피의 감정 강도/고위험 안전 톤을 일괄 LOCK하고 콘텐츠 넛지 푸시 재론 시 opt-in율 자해 논리를 전제한다. R15(최종 종합)는 이 11건 MVP + 4 Phase2/defer + 3 exclude를 SUMMARY 기능표에 반영한다.
