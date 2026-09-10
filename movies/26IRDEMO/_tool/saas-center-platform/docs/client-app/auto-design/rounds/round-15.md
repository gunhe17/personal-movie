# Round 15 — [최종 종합] MVP 범위·Phase 로드맵 + 시안 v3

## 주제/긴장
14라운드의 누적 결정을 단일 제품 명제로 봉인하고, MVP 범위·Phase 로드맵·v3 시안 합격 기준을 확정한다. 관련 긴장은 전체 정합성·우선순위(T1~T10 종합)이며, 종합 라운드 특유의 함정 — "낙관의 누적"(신규 비용 과소추정, 프론트 부트스트랩 비용 누락, fail-open 위험 은폐) — 을 방어하는 것이 핵심이다.

제품 명제: **"연동된 상담의 동반자"**. 미소속홈은 activation 깔때기, 소속홈은 행동 우선 위계에서 두 핵심 질문("다음에 뭐 하지" / "우리 애 어디까지 했지")을 0.5초에 종결시킨다. MVP는 욕심이 아니라 "이미 있는 데이터를 내담자 신원으로 안전하게 비추는 얇은 읽기 레이어 + 명시된 신규 백엔드 4개 도메인 경로"로 정의된다. 모든 쓰기 행위는 Phase 2, Skia 풀캐릭터·CMS·시각화·AI는 Phase 2/3으로 데이터·승인 입증 후 승격한다.

## A · 옹호 주장 (근거 포함)
- **신규 백엔드 4종 봉인이 로드맵의 핵심 자산 (code)**: R04 셀프 link-requests(JWT 강제)+OTP+approve 중복가드+센터명 lookup, R06/R07 셀프 JWT 조회 엔드포인트(화이트리스트 스키마), R09 relation 1-hop 인가 헬퍼, R13 내담자 푸시 디스패치 경로. 이외 모든 읽기는 verify_with_response/list_send_results/find_case_ids_by_participant_ids의 인증게이트만 교체해 재사용 — write 도메인 신설 없이 read 프로젝션만 추가하므로 회귀 표면이 작다.
- **단일 패턴(JWT 화이트리스트 + N-call 머지)이 일정·회차·결과·바우처 전부 커버 (code)**: R06/R07/R09/R12 전부 (center_id,client_id) 종속이라 동일 패턴 흡수. 크로스센터 집계는 4회 일관 exclude, 멀티는 소수라 N 작음. Phase 2 자녀/바우처 확장도 같은 헬퍼 재사용으로 추가 인가 0.
- **T10 임상 안전이 신규 정책 컬럼 0으로 완결 (code)**: send_result revoked_at/expired_at(R07 2상태 게이트) + relation 존재+guardian 자격 1-hop(R09)이 유일 게이트. visibility 3단 enum은 마이그레이션+SaaS UI 개편 역전이라 exclude. 화이트리스트가 미발행노트·내부메모·취소회차·정산필드 차단, PDF 본문은 상담사 발행 책임 이관.
- **모든 쓰기 Phase 2는 보수가 아닌 ROI 순서 (roi)**: 셀프예약/인앱응답/변경취소/잔여바우처는 쓰기·외부진실원 의존이라 비용·리스크가 읽기의 수배. 읽기 레이어로 리텐션/연동전환 데이터 먼저 확보 → 데이터로 각 쓰기 ROI 정당화하는 자해 없는 확장 경로.
- **오브/콘텐츠는 '서버 0'만 잘라내되 감성 가치는 경량 형식 확보 (roi)**: 오브는 멘트+경량 비주얼(CSS/expo 그라데이션 4색+3상태)까지 MVP, Skia 7종 모션·풀캐릭터는 Phase 2. 콘텐츠는 정적 seed 10개+정적 뷰어만 MVP. 넛지 푸시는 리텐션 자해라 exclude.
- **v3 합격 기준은 신규 화면이 아닌 가드레일 3종+R11~R14 반영+토글 오독 방어 (px)**: 단일 조건부 트리(3상태×2역할) 계승, 미정/Phase2 요소는 placeholder div조차 금지. "확정된 것만, 확정된 만큼만" 그리는 정직한 시안.
- **Phase 로드맵 3단 봉인 (roi)**: P1=읽기 동반자, P2=쓰기 참여+자녀 확장+신선도, P3=시계열·AI 성장. 각 승격은 P1 데이터로 정당화.

## B · 검증 반박 (근거 포함)
- **A의 종합 골격은 견고하며 번복 근거 없음 — 핵심 4사실 코드 재확인 (code)**: send_result revoked_at/expired_at 실재, find_case_ids_by_participant_ids center_id 필수 positional(크로스센터 구조적 불가), PushToken center_id NOT NULL+(center_id,account_id) 복합인덱스(멀티센터 토큰 스코프 미결), submit_task WRITE_ASSESSMENT_CASE 강제(인앱 응답 write-side net-new). "MVP=읽기 프로젝션 + 명시 신규 백엔드 + 모든 쓰기 Phase2" 명제는 코드 위에서 입증.
- **조임 1 — '4종 봉인'은 도메인 카운트이지 구현 항목 4개가 아님을 SUMMARY에 LOCK (code)**: R13에서 이미 A의 '라우터 그대로 재사용'이 깨졌다(기존 push router는 Member 검증=내담자 403). 각 경로가 인가게이트 교체+폴백 분기+멱등 키+Notification row 신설을 포함하는 '다단 계약'. '4=엔드포인트 4개'로 과소추정 방지 명시 필요.
- **조임 2 — P1 프론트 비용의 실체는 apps/mobile-client 부트스트랩 자체 (code)**: seed 25행이 전제한 apps/mobile-client/는 실재하지 않음(apps/mobile은 상담사 전용). P1은 백엔드 얇은 레이어 + RN 앱 신규 부트스트랩(네비/인증/프록시/경량 오브/정적 뷰어)이 선행 비용. A 로드맵이 백엔드 4종에만 초점을 둬 프론트 신설을 암묵 처리한 것을 SUMMARY 전제로 명시.
- **T10 게이트 신뢰원이 코드 아닌 운영 relation row 품질에 있음 위험 유지 (code)**: visibility enum 미신설은 옳으나 '코드 게이트로 완결'은 '코드 게이트 충분, 잔존 위험은 운영 relation 품질+Phase2 잔존정책'으로 정정. 자녀 알림 fan-out(R13)에서 오발송 증폭 가능.
- **'데이터로 승격'이 공약 아닌 실행이 되려면 P1에 측정 계측 포함 (roi)**: 멀티센터 사용비율·send_link 완료율·웹응답 이탈지점 같은 최소 계측을 P1 스코프에 포함해야 Phase2가 투기 아닌 입증.
- **AI는 production 미배포(별도 승인)라 P3도 조건부 (roi)**: seed 43행+memory 일치. F12는 'report_payload 정규화 + production 승인 둘 다 충족 시'로 조건 명시.
- **v3 합격 기준 A와 완전 일치 + 'HTML 데모는 RN 구현 명세 아님' 주석 추가 요구 (px)**: mockup-v*.html은 자체완결 HTML 프레임이라 RN 앱이 아니다. RN 직역 시 Skia 누출·정적 seed 진실원 미결이 묻힘. 'RN 구현 시 R14 경량 오브 경계·콘텐츠 정적 seed 진실원 별도 결정' 주석 추가 요구.

## 쟁점별 판정

| 기능 | A | B | 결정 | Phase | 이유 |
|------|---|---|------|-------|------|
| 미소속홈 activation 깔때기 (CTA+F05+정적매거진10) | include | include | include | MVP | R01/03/05/14 LOCK, 기존 link 흐름+정적 seed 재사용. 매거진 진실원은 부트스트랩 시 결정 |
| 무료 셀프체크 F05 (self_report·PHQ-9/GAD-7·비저장) | include | include | include | MVP | R01/08/14 3회 LOCK, 비저장이라 게이트 독립=T10 정합 |
| 하단 2탭 상태무관 프레임 + 단일 조건부 트리 IA | include | include | include | MVP | R02/03/05/10 LOCK, 센터수 무분기 단일 컴포넌트 |
| 온보딩 연동(센터코드/명 확인→OTP→셀프신청→승인) | include | include | include | MVP | R04 LOCK 신규 백엔드. '4개'는 다단 계약, OTP 저장소·rate-limit 운영파라미터 미결 |
| 소속홈 행동 우선 위계 (오브멘트>일정>미션>매거진) | include | include | include | MVP | R03/06/10 LOCK, 행동>맥락, 빈영역 미노출 |
| 다음 일정 카드 정보밀도 LOCK + 길찾기 딥링크 | include | include | include | MVP | R06/10/11 LOCK, 준비물/온라인링크는 바텀시트. ISSUE-011 좌표 저장 선행 미결 |
| 클라이언트 셀프 JWT 회차/일정 조회 엔드포인트 | include | include | include | MVP | R06 LOCK, find_case_ids center_id 필수=N-call 머지 필연. case 단위 단순 머지=집계 아님 |
| client-facing 응답 스키마 화이트리스트 LOCK | include | include | include | MVP | R06/07/09/12 LOCK, Pydantic이 유일 차단막. 정산/미발행 영구 비노출, 더미 오독 방지 주석 |
| 회차 진행 역할별 위계 (보호자 1급/성인 텍스트·없으면 생략) | include | include | include | MVP | R06/10 LOCK, total_sessions nullable이라 성인 bar는 가짜UI |
| 검사결과 목록 + JWT PDF 인앱 열람 (4자리 대체, 익명 병존) | include | include | include | MVP | R07/10 LOCK, verify 코드검증부만 교체로 reports[] 재사용. presigned 보안 미결 |
| 보호자 자녀 relation 1-hop 인가 헬퍼 + 자녀 열람 3건 | include | include | include | MVP | R09 LOCK, R7 빚 청산. fail-open 신뢰원=운영 relation 품질 위험 유지 |
| 멀티프로파일=자녀섹션 누적 + F08 자녀카드 (스위처/▾ 미부활) | include | include | include | MVP | R02/03/09/10 LOCK, 전역 스위처 5회 제외. 전환은 마이탭 |
| 멀티센터 통합 머지 타임라인 + 센터 라벨 + 부분실패 폴백 | include | include | include | MVP | R02/03/06/10 LOCK, 폴백 배너 중립 카피+재시도만(R08 톤 보존) |
| 오브 멘트 영역 + 경량 비주얼 (CSS/expo 4색+3상태) | include | include | include | MVP | R03/05/10/14 LOCK, 서버 0만 LOCK·Skia 일체 금지가 경계. 누출 방어 검증 미결 |
| 승인 대기홈=본문 재사용+최상단 대기안내 교체(CTA 제거) | include | include | include | MVP | R03 plan B/05/10 LOCK, CTA 재노출은 가짜 미완료감 |
| 정적 콘텐츠 상세 뷰어 (정적 HTML+카드뉴스) | include | include | include | MVP | R14 LOCK, F06 §5 정적 렌더. seed 진실원·교체 운영동선 미결 |
| 내담자 푸시 인프라 (JWT 등록+NULL→SMS 폴백+디스패치) | include | include | include | MVP | R13 LOCK 신규 백엔드. router Member 검증이라 client 경로 신규, Notification/event_ref 다단 |
| 알림 on/off 토글+권한거부 안내+딥링크+자녀 수신자 해석 | include | include | include | MVP | R13 LOCK, '*' channel_push 한 행. 자녀 fan-out fail-open 1-hop 계약 재확인 |
| v3 시안 (단일트리+가드레일3종+R11~R14+토글 오독 주석) | include | include | include | MVP | R05/10 LOCK 계승. B의 'HTML≠RN 명세' 주석 추가 요구 흡수 |
| 인앱 셀프 응답 + 명시적 발송 의도 게이트 + 자녀 대리응답 | defer | defer | defer | Phase 2 | R08/09, submit_task 센터admin 강제=write-side net-new+onsite 누출 게이트. 적격성만 MVP |
| 셀프 예약 / 슬롯 공개 API / 센터 토글 / 변경·취소 요청 | defer | defer | defer | Phase 2 | R11, schedule 전부 센터 write+충돌차감 전무, status 부재. 조회만 MVP |
| 잔여 바우처 조회 + 신선도 게이트 + 만료/소진 표시 | defer | defer | defer | Phase 2 | R12, last_synced_at 부재로 신선도 게이트가 MVP 차단(갔더니 0회 T10). 정산필드 영구 비노출 |
| 결과 영역별 바·종합소견 시각화 + 3단 공개수준 토글 | defer | defer | defer | Phase 2 | R07, report_payload 비표준 dict 정규화 신설+SaaS UI 개편 역전. MVP는 PDF 임베드 |
| 오브 Skia 풀캐릭터+7종 모션+일러스트+이름부여 | defer | defer | defer | Phase 2 | R14, Skia 셰이더+모션디자인 종속, 데이터 0. 이름부여는 브랜드 정책 |
| 콘텐츠 백엔드 모듈+CMS/태그+200건 라이브러리+개인화 | defer | defer | defer | Phase 2 | R01/14, content 모듈 0건. 추천엔진 신규 금지·개인화 연동 후 LOCK. 정적 10개로 충분 |
| 멀티센터 필터칩 / 전체 합산 집계 헤더 | defer | defer | defer | Phase 2 | R02/03/06/10, 머지 재분할은 무전환 충돌. 사용비율 입증(P1 계측) 전 투기 |
| 당일 1시간 전 알림 / N건 묶음 카피 / 멀티센터 토큰 스코프 | defer | defer | defer | Phase 2 | R13, 잡이 매시간/일간뿐. D-1로 핵심 충족. PushToken center_id 스코프 결정 동반 |
| F12 AI 성장가이드 (시점별 성장·AI 요약) | defer | defer | defer | Phase 3 | seed 43행 AI production 미배포. '정규화+production 승인 둘 다 충족 시' 조건부 |
| 정부 바우처 발견·자격 매칭 엔진 | exclude | exclude | exclude | - | R01/12 3중근거, 제도DB·자격판정 엔진 코드 전무, 오안내 법적 리스크 |
| 주변 센터 찾기 / 디렉터리 마켓플레이스 / 슈퍼앱 선언 | exclude | exclude | exclude | - | R01, 신규 백엔드+B2B 이해충돌. 정체성=동반자 고정 |
| 콘텐츠/매거진/미션 리텐션 넛지 푸시 | exclude | exclude | exclude | - | R13/14, 마케팅 피로→전체 off→리마인더 상실 리텐션 자해 |
| 앱 자체 PDF 재생성/AI 가공 + 4자리 코드 앱내 강제 | exclude | exclude | exclude | - | R07/10, AI 미배포+임상책임 경계붕괴(T10). JWT 사용자에 4자리는 음의 가치 |
| 전역 스위처+▾ + 센터별 분리 뷰 + 센터수별 홈 레이아웃 | exclude | exclude | exclude | - | R02~10 다회, 가짜 어포던스·2D 격자·IA 신설 회귀비용 |
| 멀티센터 집계 엔드포인트 + 자녀 visibility 3단 enum | exclude | exclude | exclude | - | R06/07/09/12 다회, client 머지로 동일결과. enum은 중복 진실원 |

## 결정 요약
양측 verdict가 전 항목 일치하는 합의 봉인 라운드다. B는 A의 핵심 4사실(send_result 라이프사이클, find_case_ids center_id 필수, PushToken center_id 스코프, submit_task 센터admin 강제)을 코드로 재확인했고, 번복 항목은 없다. 종합 라운드 산출은 신규 결정이 아니라 **4개 SUMMARY 가드 격상**이다:

1. **신규 백엔드 '4'는 도메인 카운트이지 구현 견적 단위 아님 LOCK** — 각 경로가 인가게이트 교체+폴백 분기+멱등 키+Notification row 신설을 포함하는 다단 계약. '4개 엔드포인트면 끝' 과소추정 방어.
2. **P1 프론트 = apps/mobile-client RN 부트스트랩 자체가 선행 비용 LOCK** — seed 전제 디렉터리 부재 확인. 백엔드 얇은 레이어 ≠ 프론트 0.
3. **T10 게이트는 코드 충분, 잔존 위험은 운영 relation row 품질+Phase2 잔존정책** — '코드로 완결' 표현 정정, fan-out 오발송 증폭 위험 유지.
4. **'데이터로 승격'을 실행으로 만들 P1 측정 계측을 MVP 스코프에 포함** — 멀티센터 사용비율·send_link 완료율·웹응답 이탈지점.

MVP = 연동 깔때기 + 소속홈 읽기(일정/회차/결과/오브멘트) + 트랜잭션 알림 + 경량 오브 + 정적 콘텐츠 10 + F05. 모든 쓰기·시각화·풀빌드·AI는 Phase 2/3 데이터·승인 입증 후 승격. v3 합격선 = 확정된 것만 + 가드레일 3종(화이트리스트 더미 경계 주석/폴백 중립 카피/미정 라운드 무자리) + 토글 오독 주석 + 'HTML≠RN 명세' 주석.

## 남은 질문
- **신규 백엔드 다단 계약 견적 단위 명시**: 4 도메인 경로 각각의 구현 항목(인가게이트 교체/폴백 분기/멱등 키/Notification row) 분해를 구현 착수 전 산정해야 과소추정 방지.
- **apps/mobile-client RN 부트스트랩 범위 확정**: 네비/인증/프록시/경량 오브(Skia 누출 방어선)/정적 뷰어 선행 비용 + Skia가 7종 모션으로 번지지 않는 방어선 실측.
- **P1 측정 계측 항목 LOCK**: 멀티센터 사용비율·send_link 완료율·웹응답 이탈지점·연동전환율·리텐션을 어디서 어떻게 수집할지 — Phase2 승격 정당화 데이터원.
- **운영 relation row 품질 = fail-open 신뢰원**: 비주보호자(social_worker)·성인 자녀 잔존 relation 정책(Phase2), 자녀 알림 fan-out 오발송 증폭 방지 1-hop 계약 재확인.
- **미결 운영 파라미터**: OTP 저장소(Redis vs TTL 테이블)·rate-limit, ISSUE-011 좌표 저장 선행, presigned URL 매호출 재발급·캐싱 비노출 보안, 콘텐츠 정적 seed 진실원(번들 vs 미인증 읽기 엔드포인트)·교체 운영동선(센터공통 vs 본사), ISSUE-010 F05 척도 라이선스, ISSUE-003 오브 이름부여(브랜드 정책).
- **P3 조건부 게이트**: F12 AI는 report_payload 정규화 파이프라인 + production 승인 둘 다 충족 시로 봉인.

## 다음 라운드로 이어받기
14라운드는 "연동된 상담의 동반자" 단일 명제로 수렴했고 R15는 전 항목 verdict 일치 합의 봉인이다. MVP는 읽기 프로젝션 레이어 + 명시 신규 백엔드 4 도메인 경로(셀프 link 신청·OTP·셀프 조회·푸시 디스패치, 각각 다단 계약)이며 모든 쓰기는 Phase 2, AI/시계열은 Phase 3 조건부다. 종합 산출은 4개 SUMMARY 가드 격상(4=도메인 카운트 / P1 프론트=RN 부트스트랩 선행 비용 / T10 잔존 위험=운영 relation 품질 / P1 측정 계측 포함)이다. 구현 단계는 이 가드를 전제로 견적하고, LOCK된 카드/화이트리스트/머지/단일 조건부 트리 IA 경계와 가드레일 3종+오독 방어 주석을 건드리지 않는다. v3 시안은 확정된 것만, 확정된 만큼만, 'HTML은 IA/위계 데모이지 RN 구현 명세 아님' 주석과 함께 그린다.
