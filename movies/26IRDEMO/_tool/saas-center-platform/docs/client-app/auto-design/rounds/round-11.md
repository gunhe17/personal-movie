# Round 11 — 예약 조회 & 셀프 예약 정책

## 주제/긴장
- **주제**: 내담자 앱에서 예약을 조회하는 범위와, 셀프 예약(write)을 MVP에 넣을지 센터 정책 토글로 미룰지 결정.
- **관련 긴장 T6**: 셀프 예약 MVP 포함 vs 연기 + 센터 정책 on/off 토글. 시드가 "백엔드 최대 부하 + 센터 정책 충돌"로 명시한 영역.
- **핵심 분해**: 이번 라운드의 결정적 통찰은 '예약 조회'(read)와 '셀프 예약'(write)을 한 단어로 묶지 않는 것. 조회는 R6/R7에서 셀프 JWT 엔드포인트를 이미 LOCK한 기확정 자산이고, T6 긴장은 오직 write 측에만 존재한다.

## A · 옹호 주장 (근거 포함)
- **조회/write 비대칭 분리** (code): R6에서 클라이언트 셀프 JWT 회차/일정 조회 엔드포인트를 이미 MVP LOCK, F03 타임라인이 그 위에 섬 → 조회 신규 0. 반면 schedule/router.py의 create/update/delete가 전부 WRITE/DELETE_SCHEDULE(센터 admin)이라 내담자 write 경로 0. 둘을 분리 판정해야 T6 긴장이 write에만 국한됨이 드러남.
- **풀 셀프예약 = 4덩어리 묶음 최대 부하** (code): (1) client-facing 가용 슬롯 공개 엔드포인트 (2) 내담자 write 경로 (3) 예약요청 상태머신+센터 승인 (4) 센터별 on/off 토글. R4 link 셀프신청·R8 셀프응답 본체 동급 이상, 시드 T6 '최대 부하'와 일치. Phase 2.
- **슬롯 인프라 씨앗 존재 ≠ MVP 근거** (code): CheckWorkingStatusService.get_available_slots가 30분 블록 근무 가능 슬롯을 이미 계산하나, 실제 schedule 충돌 차감·client-facing 노출·정원/룸 정합은 신규. 씨앗 존재는 Phase 2 ROI를 낮추는 근거이지 MVP 포함 근거가 아님.
- **변경/취소 '요청'은 풀예약과 분리해 Phase 2 최우선 후보** (px/roi): 성인 1차 질문 '다음에 뭘 하지'(조회)의 직후 좌절점은 '그 일정에 못 간다'. 대상 회차가 이미 존재하고 센터 승인 큐로 좁히면 슬롯 정합 리스크가 풀예약보다 현저히 작음. 단 요청 상태(requested→approved/rejected)·내담자 write 인가·통지가 net-new라 MVP는 아니고 Phase 2 최우선.
- **센터 토글 동반 연기** (code): 본체가 Phase 2면 토글도 동반 설계. R8 supports_online 기존 게이트 재사용 원칙처럼 독립 컬럼/UI로 미리 박지 않음(R10 가드 위반 방지).
- **길찾기 딥링크는 조회에 흡수** (px): F03 §9 길찾기는 읽기+딥링크라 비용 작음. ISSUE-011 센터 좌표 미저장 → 좌표 없으면 버튼 미표시 graceful degrade.
- **멀티센터 조회는 R6 N-call 머지 재사용** (code): write가 Phase 2면 멀티센터 write 분기 논의 자동 보류, R6 머지 경계 무손상.

## B · 검증 반박 (근거 포함)
- **조회/write 비대칭 전수 검증 → A 골격 채택** (code): schedule/router.py:44(create=WRITE_SCHEDULE), :167(update=WRITE_SCHEDULE), :188(delete=DELETE_SCHEDULE), 나머지 READ_SCHEDULE로 내담자 write 경로 0 확인. T6 긴장 write 국한 성립.
- **5번째 숨은 비용 추가** (code): A의 4덩어리에 더해, 예약 확정이 counseling_session 생성과 schedule 생성을 동시 요구(idx_session_schedule로 session-schedule 1:1 결합 확인). 내담자 write 한 번이 두 모듈 크로스 트랜잭션을 건드려 정합·롤백 리스크가 A 추정보다 큼. Phase 2 정당성 강화.
- **슬롯 인프라 검증 완료** (code): check_working_status.py:24-69는 MemberWorkingTime+휴게시간+MemberNonWorkingTime만 차감. 실제 예약 충돌 차감·client-facing 노출·룸/정원 정합 전무. A 주장 정확.
- **변경/취소 요청 '최우선 후보' 격상에 반대 — 한 단계 조임** (px): defer는 동의하나, 취소 요청만 단독 출시 시 '못 간다' 신호는 보내지만 '언제로 바꿀지'(슬롯 선택)는 못 해 센터 전화 재발생, 반쪽 동선이 오히려 좌절을 키움. 가치는 슬롯 선택과 합쳐질 때만 완결되므로 셀프예약 본체 동반 Phase 2가 정직. 우선순위 선점은 전화변경빈도/노쇼율 데이터로 R15 판정.
- **센터 토글 동반 / 길찾기 graceful degrade / 멀티센터 머지 재사용**: A와 일치 채택.

## 쟁점별 판정 (표)

| 기능 | A | B | 결정 | Phase | 이유 |
|---|---|---|---|---|---|
| 예약 조회 (셀프 JWT 다음 일정/F03 타임라인/회차 진행) | include | include | **include** | MVP | R6 셀프 JWT 조회 엔드포인트 + F03 타임라인 위에 섬, 신규 0의 기확정 자산. T6 긴장은 write에만 존재 (router.py 권한 전수 확인) |
| 예정 회차 길찾기/지도 딥링크 (F03 §9) | include | include | **include** | MVP | 읽기+기기 지도앱 딥링크라 write 아님. ISSUE-011 좌표 미저장 → 좌표 없으면 버튼 미표시 graceful degrade가 필수 전제. 좌표 저장은 선행작업, 동작률은 센터 데이터 품질 종속 |
| 기존 예정 회차 변경/취소 '요청' (센터 승인 큐, 슬림) | defer (P2 최우선) | defer (본체 동반) | **defer** | Phase 2 | B 채택. counseling_session.status에 requested/approved/rejected 부재로 상태 신설+write 인가+통지 net-new. 취소 요청만 단독 출시 시 '언제로 바꿀지' 못 해 반쪽 동선이 좌절 가중 → 슬롯 선택(본체)과 묶어 동반. '최우선' 선점은 전화변경빈도/노쇼율 데이터로 R15 판정 |
| 풀 셀프 예약 (가용 슬롯에서 새 회차 능동 생성) | defer | defer | **defer** | Phase 2 | 슬롯공개+write경로+예약요청 상태머신+센터승인 4덩어리에 + 확정 시 counseling_session+schedule 크로스 모듈 트랜잭션(idx_session_schedule 1:1)까지 5번째 비용. R8 능가 최대 부하, 센터 운영정책 충돌·노쇼 책임·슬롯 정합 리스크. 시드 T6 일치 |
| client-facing 가용 슬롯 공개 엔드포인트 (실제 충돌 차감) | defer | defer | **defer** | Phase 2 | get_available_slots는 근무시간만 차감, 실제 예약 충돌 차감·client-facing 노출·룸/정원 정합 전무(코드 검증). 본체 종속이라 본체와 함께. 씨앗 존재는 ROI 낮추는 근거지 MVP 근거 아님 |
| 센터별 셀프예약 on/off 정책 토글 | defer | defer | **defer** | Phase 2 | 본체 Phase 2라 동반. R8 supports_online 재사용 원칙처럼 독립 컬럼/UI 선신설 금지(R10 미정 백엔드 UI 강제 가드). 셀프예약 정책 모델 일부로 함께 설계 |
| 셀프예약용 신규 멀티센터 write/집계 엔드포인트 | exclude | exclude | **exclude** | - | 조회는 R6 N-call 머지 재사용으로 충분, 집계 엔드포인트는 R6 이미 제외 확정. write Phase 2면 멀티센터 write 분기 자동 보류, 신규 크로스센터 엔드포인트 정당화 불가 |
| 월간 캘린더형 예약 뷰 (빈 슬롯 그리드) | exclude | exclude | **exclude** | - | F03이 '주 1~2회 상담에 월간 캘린더는 빈 칸만 가득'이라며 타임라인 채택. 그리드는 셀프예약 슬롯 선택 UI 전제 → Phase 2라 R10 placeholder div 무자리 가드. 콘텐츠앱식 그리드는 동반자 정체성 부적합 |

## 결정 요약
- **조회 절반은 즉시 포함, write 전부는 Phase 2** — 양측이 코드로 전수 검증(router.py 권한, counseling_session.status enum, get_available_slots 차감 범위)해 verdict 전원 일치. T6 긴장은 read에 없고 write에만 존재함이 확정.
- **MVP 신규 비용 = 0** (조회는 R6 LOCK 자산 재사용, 길찾기는 읽기+딥링크). 길찾기만 ISSUE-011 센터 좌표 저장 선행작업 + 좌표 없을 시 버튼 미표시 폴백을 전제로 흡수.
- **변경/취소 요청은 defer로 유지하되 '최우선 후보' 격상은 기각** — B 채택. 셀프예약 본체(슬롯 선택) 없이는 반쪽 동선이라 본체 동반 Phase 2. 우선순위는 데이터(전화변경빈도/노쇼율) 입증 후 R15 판정.
- **풀 셀프예약은 5덩어리 net-new** (슬롯공개+write경로+예약요청 상태머신+센터승인+session/schedule 크로스 트랜잭션)로 R8 인앱 셀프응답을 능가하는 앱 최대 부하임을 LOCK. 센터 토글은 본체 동반, 멀티센터 write/집계·월간 캘린더 그리드는 제외.
- **번복 없음** — R6 머지 경계, R8 게이트 재사용 원칙, R10 placeholder 무자리 가드 모두 무손상 계승.

## 남은 질문
- (R15/입증) 변경·취소 요청 + 풀 셀프예약 본체의 Phase 2 우선순위: 전화 변경 빈도·노쇼율·전화 재예약 발생률 측정 방법과 임계값.
- (백엔드 Phase 2) 예약 확정 시 counseling_session+schedule 크로스 모듈 트랜잭션 정합·롤백 설계 위치(Facade 조합 vs Application Handler), 1:1 결합(idx_session_schedule) 유지 방식.
- (Phase 2 게이트) 셀프예약 명시적 발송/허용 의도 게이트를 R8 인앱 셀프응답의 '명시적 발송 의도 게이트'와 같은 정책 차원으로 통합 설계할지(중복 정책 모델 방지).
- (선행작업) ISSUE-011 centers lat/lng 저장: SaaS 센터 설정 UI에서 좌표 입력 경로 + 좌표 미입력 센터의 길찾기 폴백 동작률 추적.
- (변경/취소 요청 상태 모델) Phase 2 진입 시 requested/approved/rejected를 counseling_session.status 확장으로 둘지 별도 요청 테이블로 둘지 — 기존 enum 오염 vs 신규 테이블 비용.

## 다음 라운드로 이어받기
예약은 read/write 비대칭으로 갈라 조회(셀프 JWT 회차/일정 + F03 타임라인 + 길찾기 딥링크)는 신규 0의 MVP, 모든 write(풀 셀프예약·슬롯 공개·센터 토글·변경/취소 요청)는 Phase 2로 확정했고 T6 긴장은 write에만 존재함을 코드로 LOCK했다. 변경/취소 요청은 '못 간다'만 보내고 '언제로 바꿀지'를 못 하는 반쪽 동선이라 셀프예약 본체(슬롯 선택)와 동반 Phase 2이며 '최우선' 우선순위는 데이터 입증 후 R15 판정으로 보류했다. 풀 셀프예약은 session/schedule 크로스 트랜잭션을 포함한 5덩어리 net-new로 앱 최대 부하임을 명시했다. 후속 라운드(R12 바우처 등)는 이 read/write 경계와 R6 머지·R8 게이트 재사용·R10 placeholder 무자리 가드를 건드리지 말고, 예약 관련 미정은 모두 Phase 2 본체 동반 설계로 묶어 다룬다.
