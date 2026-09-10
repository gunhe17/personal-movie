# 내담자 앱 설계 — 최종 종합 (15라운드 토론 결과)

> 정체성: **"연동된 상담의 동반자"** (마음건강 슈퍼앱 아님, B2B 이해충돌 방지)
> MVP 본질: **읽기 투영(read projection) + 4개 신규 백엔드 도메인 경로**. 모든 write는 Phase 2, AI는 Phase 3.

---

## 1. 확정 기능표

| 기능 | 결정 | Phase | 한줄근거 |
|------|------|-------|----------|
| 하단 2탭 (홈/마이) 상태무관 고정 | include | MVP | 앱이 답할 질문 2개 모두 홈 종결, S01/F02 2탭 일치 (R2) |
| 3상태×2역할 단일 조건부 트리 IA | include | MVP | 센터수 무분기·상태/역할로만 위계 결정, mockup-RN 구조 일치 (R5) |
| 미소속홈 = activation 깔때기 (연결 CTA 1순위 + 셀프체크 + 고정 매거진) | include | MVP | 첫 화면이라 최소화 아닌 전환 최적화 대상 (R1/R3) |
| 무료 셀프체크 F05 (self_report·PHQ-9/GAD-7·결과 비저장) | include | MVP | 미소속 즉시 가치 + 연동 동기, 결과 비저장이 T10 정합 (R1/R8/R14) |
| 고정 매거진 (수동 큐레이션 10개 정적 seed + 정적 뷰어) | include | MVP | 빈 화면 이탈 방어 신뢰신호, forward cost < 가치, 캡 미준수 시 exclude (R1/R14) |
| 온보딩 슬라이드 3장 + "나중에 할게요" 직행 | include | MVP | 코드입력 강제 우회 차단, 로컬 표시 백엔드 0 (R4) |
| 센터코드→센터명 lookup | include | MVP | center.code unique 실존, 연결대상 확인이 이탈 감소 (R4) |
| 전화 OTP (최초 1회 검증 후 재사용, 변경 시만 재인증) | include | MVP | 미검증 번호 오연결 사고 T10 방어 (R4) |
| 셀프 연동신청 POST /me/link-requests (JWT person_id 강제) | include | MVP | link POST는 WRITE_CLIENT라 내담자 호출 불가, 깔때기 필수 전제 (R4) |
| approve 1Person-1Client 중복 연동 가드 | include | MVP | 오연결 본질 게이트, link 본연 제약 (R4) |
| 소셜 로그인 (카카오/네이버/애플) | include | MVP | 기존 구조 재사용, apple enum만 신규 (R4) |
| 승인 대기홈 (본문 재사용 + 최상단 대기안내 교체) | include | MVP | 3상태 시각 연속체, 가짜 미완료감 방지 (R3/R5) |
| 소속홈 행동 우선 위계 (오브멘트>다음일정>미션>매거진) | include | MVP | "다음에 뭐 하지" 0.5초 응답 위해 행동>맥락 (R3) |
| 오브 멘트 영역 (로컬 결정·독립 폴백·시간대/상황별) | include | MVP | 서버 0, 빈 화면 이탈 방어, F09 §3/§7 로컬 결정 확인 (R3/R5/R10/R14) |
| 오브 경량 비주얼 (시간대 4색 + 멘트종속 3상태) | include | MVP | 서버 0만 LOCK, CSS/expo 그라데이션 한정·**Skia 일체 금지** (R14) |
| 다음 일정 카드 정보밀도 LOCK (날짜/D-day+대상·센터라벨+회차 한줄+길찾기) | include | MVP | 0.5초 행동 응답 최소 핵심, placeholder 경계 종결 (R6/R10) |
| 클라이언트 셀프(JWT) 회차/일정 조회 EP | include | MVP | counseling 핸들러가 센터admin 스코프라 본인 조회 경로 0 = 신규 (R6) |
| 회차 진행 역할별 위계 (보호자 1급 / 성인 텍스트·없으면 생략) | include | MVP | total_sessions nullable, 성인 progress bar는 가짜UI (R6/R10) |
| 길찾기 딥링크 (좌표 없으면 폴백) | include | MVP | 읽기 딥링크, R6 카드 자산 재사용 (R11) |
| 멀티센터 통합 시간순 N-call 머지 타임라인 + 카드 센터라벨 | include | MVP | center_id 필수로 크로스센터 쿼리 부재, 합산이 본질 (R2/R6) |
| 멀티센터 부분 실패 폴백 (성공 센터만 + 하단 배너) | include | MVP | N-call 머지 필연 실패 시나리오, 배너는 중립 사실문구만 (R6/R10) |
| 임상 데이터 client-facing 화이트리스트 스키마 (응답 스키마 레벨) | include | MVP | 미발행노트·내부메모·취소회차·미방문사유 비노출 유일 차단막 (R6) |
| GET /me/assessment-results (JWT·send_result 발행분만·N-call 머지) | include | MVP | list_send_results가 센터admin 권한 전제라 본인 조회 경로 0 (R7) |
| 앱 내 PDF 보고서 열람 (JWT 신원 presigned, 4자리 코드 대체) | include | MVP | verify 코드검증부만 JWT 게이트 교체, reports 로직 재사용 (R7) |
| 셀프 응답 적격성 게이트 (workflow_type==self_report AND supports_online) | include | MVP | 신규 플래그 0, default=False fail-closed 임상 안전 (R8) |
| 보호자→자녀 relation 1-hop 인가 헬퍼 (person→본인Client→get_children) | include | MVP | get_children 검증됨, 자녀 열람 유일 핵심 신규, transitive 금지 코드 강제 (R9) |
| 보호자 자녀 일정/회차/검사결과 열람 (인가집합 확장, 노출 0) | include | MVP | R6/R7에 인가 자녀 participant_id 주입, visibility 컬럼 0 (R9) |
| 보호자 자녀 섹션 1차 그룹핑 (멀티프로파일 누적 모델) | include | MVP | 보호자 멘탈모델 = "내 아이 단위 한눈에" (R2/R3/R9) |
| 마이페이지 자녀 정보 카드 F08 (relation 기반, 이름/생년 한정) | include | MVP | 동일 인가헬퍼 재사용, 추가인가 0 (R9) |
| 내담자 푸시 토큰 등록/해제 (client JWT 컨텍스트 신규 분기) | include | MVP | 기존 router는 Member 검증이라 내담자 403, 등록 경로 신규 (R13) |
| client_id→Person.account_id 수신자 해석 헬퍼 (NULL→SMS 폴백) | include | MVP | 모든 내담자 알림 공유 전제, fail-safe 계약 (R13) |
| 일정 리마인더 SMS→푸시 승격 (D-1, 09시 KST) | include | MVP | 기존 잡 슬롯 0, SMS비 절감+리텐션 최고 ROI (R13) |
| 트랜잭션 즉시 알림 (승인/일정변경취소/검사결과 공유) | include | MVP | 신뢰 알림, 터치 시 소속홈 전환·PDF 직행 딥링크 (R13) |
| 마이페이지 전체 알림 on/off 토글 (글로벌 '*' channel_push) | include | MVP | 한 행 토글, 신규 enum/스키마 0, F07 §4 일치 (R13) |
| 알림 권한 거부 인앱 안내 + 딥링크 라우팅 | include | MVP | RN 앱측, 백엔드 무변경, 무음 이탈 방지 (R13) |
| 잔여 바우처 조회 (소속홈/마이) | defer | Phase 2 | last_synced_at 부재·외부 진실원 신선도 게이트가 MVP 차단 (R1/R12) |
| 인앱 셀프 응답 / 응답 엔진 | defer | Phase 2 | write-side net-new + onsite 의도누출 게이트 동반설계 (R8) |
| 셀프 예약 / 가용 슬롯 / 변경취소 요청 | defer | Phase 2 | schedule 전부 센터 write, 충돌차감 전무, 5덩어리 최대부하 (R11) |
| 검사결과 영역별 바·종합소견 시각화 / 3단 공개수준 | defer | Phase 2 | report_payload 비표준 dict 정규화 신설 + SaaS UI 개편 역전 (R7) |
| 오브 7종 모션 / Skia 풀 캐릭터 / 이름 부여 | defer | Phase 2 | Skia 셰이더+디자인 비용, 획득 ROI 미입증 (R14) |
| 콘텐츠 백엔드 모듈 / CMS / 태그 개인화 / 무한스크롤 | defer | Phase 2 | content 모듈 0건, F06 §7 선행작업 미완 net-new (R14) |
| 멀티센터 필터칩 / 전체 합산 집계 헤더 | defer | Phase 2 | 미정 집계 데이터소스를 UI가 강제, 멀티 소수 미입증 (R2/R6) |
| 1시간 전 알림 / 멀티센터 토큰 스코프 / 자녀 묶음 카피 | defer | Phase 2 | 분단위 크론 net-new, account-wide 스코프 결정 필요 (R13) |
| 동일검사 시점별 점수 비교 차트 / AI 성장가이드 F12 | defer | Phase 3 | 정규화 파이프라인 + AI production 미배포 (R7) |
| 정부 바우처 발견·자격 매칭 엔진 | exclude | — | 제도DB·자격판정 엔진 0, 오안내 법적 리스크 (R1/R12) |
| 주변 센터 찾기 / 디렉터리 마켓플레이스 | exclude | — | 신규 백엔드+B2B 경쟁사 노출 이해충돌 (R1) |
| 마음건강 슈퍼앱 정체성 선언 | exclude | — | 확장 압력원 + B2B 이해충돌, 동반자로 고정 (R1) |
| 프로파일/센터 전역 전환 스위처 + 이름 옆 ▾ | exclude | — | 가짜 어포던스·2D 격자 비용, 5회 제외 (R2/R3/R5/R9/R10) |
| 콘텐츠/매거진 리텐션 넛지 푸시 | exclude | — | 마케팅 피로→전체 off→리마인더 상실 리텐션 자해 (R13/R14) |
| 앱 자체 PDF 재생성/AI 요약 가공 | exclude | — | 임상 책임 경계붕괴 T10, 발행본 그대로 열람 (R7/R10) |
| 신규 멀티센터 집계 백엔드 EP | exclude | — | 크로스센터 신규설계, client 머지로 동일결과 (R6) |
| 자녀 visibility 3단 enum/컬럼 | exclude | — | send_result+화이트리스트가 노출 통제, 중복 진실원 (R9) |
| 센터별 분리 컨텍스트 뷰 (센터 탭/세그먼트) | exclude | — | 통합 무전환 확정, 사용자는 센터 단위로 생각 안 함 (R6) |
| 4자리 인증코드 앱 내 열람 강제 | exclude | — | 신원검증된 로그인 사용자에 코드 재입력은 음의 가치 (R7) |

---

## 2. MVP 범위 (포함된 것만)

**A. 진입/온보딩/연동 (깔때기)**
- 2탭 고정 프레임 + 3상태×2역할 단일 조건부 트리 IA
- 미소속홈: 연결 CTA(1순위) + 무료 셀프체크 F05 + 고정 매거진 10개
- 소셜 로그인 + 전화 OTP(최초 1회) + 센터코드 lookup + 셀프 연동신청 + approve 중복 가드
- 승인 대기홈 (본문 재사용 + 대기안내)

**B. 소속홈/임상 데이터 (읽기 투영)**
- 오브 멘트 + 경량 비주얼 (서버 0, Skia 금지)
- 다음 일정 카드 (정보밀도 LOCK + 길찾기 딥링크)
- 회차 진행 역할별 위계 (보호자 1급 / 성인 텍스트)
- 검사 결과 목록 + 앱 내 JWT PDF 열람
- 멀티센터 N-call 시간순 머지 + 부분 실패 폴백
- 임상 화이트리스트 스키마 (노출 경계 단일 차단막)

**C. 보호자 멀티프로파일**
- relation 1-hop 인가 헬퍼 (transitive 금지 코드 계약)
- 자녀 섹션 1차 그룹핑 + 자녀 일정/회차/결과 열람 + F08 자녀 정보 카드

**D. 알림/리텐션**
- 내담자 푸시 토큰 등록 + 수신자 해석 헬퍼 (NULL→SMS 폴백)
- 일정 리마인더 SMS→푸시 승격 + 트랜잭션 즉시 알림 + 전체 on/off 토글

> **읽기 전용 원칙**: MVP에서 내담자의 모든 write는 (1) 연동신청과 (2) OTP/토큰 등록뿐. 일정·검사응답·예약·바우처는 전부 읽기.

---

## 3. Phase 2 / Phase 3 로드맵

### Phase 2 — Write-side + 외부 진실원 + 시각화
| 영역 | 항목 | 선행 조건 |
|------|------|-----------|
| 셀프 응답 | 인앱 응답 엔진 (on_start/submit/complete 핸들러 3종) + onsite 의도누출 명시적 발송 게이트 | 본인 task 인가 위치(Facade/Service), status 실값 확정 |
| 셀프 예약 | 가용 슬롯 공개 API + 충돌차감 + 변경취소 요청 + 센터 on/off 토글 | session+schedule 크로스 트랜잭션, status 확장 |
| 바우처 잔여 | JWT 화이트리스트 N-call 머지 + 신선도 게이트 | last_synced_at 신설 vs updated_at 정직 라벨링 결정, 만료/소진 표시 정책 |
| 검사 시각화 | 영역별 바·종합소견 인라인 + 3단 공개수준 | report_payload 정규화 스키마, send_result enum + SaaS 발송 UI 개편 |
| 오브/콘텐츠 | 7종 모션·Skia 풀캐릭터·이름 부여 / CMS·태그 개인화·200건 라이브러리 | 리텐션/획득 데이터, ISSUE-003 브랜드 정책 |
| 알림 정밀화 | 1시간 전 알림 / 멀티센터 토큰 스코프 / 자녀 묶음 카피 | 분단위 크론 vs per-schedule, account-wide 스코프 결정 |
| 멀티센터 | 필터칩 / 집계 헤더 | 멀티센터 사용비율·혼란 데이터로 필요성 입증 |
| 인가 정책 | 비주보호자/성인 자녀 잔존 relation 정책 / 자녀 대리 응답 | 임상 프라이버시 비즈니스 결정, 응답 엔진 동반 |

### Phase 3 — AI (production 미배포, 별도 승인 필수)
- 동일검사 시점별 점수 비교 차트 / 회기 비교 뷰
- F12 AI 성장가이드

---

## 4. 핵심 설계 결정 (긴장별 결론)

- **T4 (오브 비주얼 ROI)**: 서버 0만 LOCK, 경량 비주얼(시간대 4색+3상태)까지 MVP. Skia·7종 모션·캐릭터는 데이터 입증 후 Phase 2. → R14
- **T5 (셀프 응답 타당도)**: supports_online default=False fail-closed로 임상가 시행 검사 자연 차단. 인앱 응답은 onsite 의도누출 게이트 없이는 Phase 2. → R8
- **T6 (셀프 예약 부하)**: schedule 전부 센터 write·충돌차감 전무라 5덩어리 최대부하. 조회만 MVP, 모든 예약 write Phase 2. → R11
- **T7 (자녀 결과 공개 범위)**: 별도 visibility enum 신설 안 함. send_result 발행 + relation 존재 재사용으로 노출 통제, 상담사 발행 책임. → R9
- **T8 (바우처 발견 vs 잔여)**: 발견 영구 exclude(법적 리스크), 잔여는 센터종속이라 Phase 2 소속홈(신선도 게이트가 차단). → R12
- **T9 (콘텐츠 운영비)**: 미소속 매거진 10개 정적 seed 캡 LOCK. 추천엔진/CMS/200건 라이브러리는 net-new Phase 2, 캡 미준수 시 exclude. → R1/R14
- **T10 (임상 안전/오표기)**: client-facing 화이트리스트 스키마가 유일 차단막. 미발행노트·내부메모·취소회차·정산필드 영구 비노출. AI 재가공 금지, 결과 비저장 셀프체크. → R6/R7/R9 전반
- **공통 원칙**: 정체성은 "동반자"로 고정(슈퍼앱·디렉터리·넛지푸시 배제). 멀티센터는 client-side N-call 머지로 일관(집계 EP 신설 없음). 전역 스위처는 가짜 어포던스로 5회 제외.

---

## 5. 신규 백엔드 작업 목록 (코드베이스 대비)

> **MVP = 읽기 투영 + 4개 신규 백엔드 도메인 경로** (도메인 카운트이지 구현 항목 4개가 아님 — 각 경로는 다단계 계약으로 분해 필요).

**도메인 경로 1 — 연동(link)**
- `POST /me/link-requests` 셀프 신청 (body person_id 무시, JWT 강제 주입)
- 전화 OTP 생성/검증/잠금 로직 (발송채널 재사용, 코드 저장은 신규)
- approve 1Person-1Client 중복 연동 가드
- 센터코드→센터명 lookup EP
- apple 소셜 검증 enum

**도메인 경로 2 — 임상 조회(counseling)**
- 클라이언트 셀프 JWT 회차/일정 조회 EP (participant_id=JWT client + 본인+인가 자녀로 확장, 센터 스코프 N-call)
- client-facing 응답 스키마 화이트리스트 (Pydantic 레벨, 정산/내부 필드 차단)

**도메인 경로 3 — 검사 결과(assessment/send_result)**
- `GET /me/assessment-results` (JWT client, 활성 send_result case만, N-call 머지)
- verify 코드검증부 → JWT presigned 발급 교체 (익명 외부 링크 병존)

**도메인 경로 4 — 알림(notification)**
- client JWT 푸시 토큰 등록/해제 경로 (기존 Member 검증 router 분기)
- `client_id→Person.account_id` 수신자 해석 헬퍼 (person_id NULL→SMS 폴백)
- 내담자 푸시 디스패치 경로 재조립 + Notification row/event_ref 신설 (기존 client SMS 경로엔 push/Notification/event_ref 전무)

**공유 자산 (경로 2/3/4 공통)**
- relation 1-hop 인가 헬퍼 (person→본인Client→get_children, Facade 위치, transitive 금지 계약) — R9

**가드레일 (구현 시 LOCK)**
1. 화이트리스트 밖 필드는 더미라도 그리지 말 것 (다음 구현자 오독 방지)
2. RN mobile-client 부트스트랩은 P1 프론트 선투자 — Skia 누출 방어선
3. relation row 운영 품질 = fail-open 신뢰원 (1-hop 계약으로 코드 강제)
4. Phase 2 승격 입증용 P1 지표를 MVP 범위에 포함

---

## 6. 미해결 이슈 (사람이 정해야 할 비즈니스 정책)

- **ISSUE-010 (F05 척도 라이선스)**: 미소속 공개 셀프체크 적격 척도 목록·라이선스 확정 (PHQ-9/GAD-7 외). 별도 트랙.
- **ISSUE-003 (오브 이름 부여)**: 브랜드 정책 결정, Phase 2 진입 전 방향/데이터 확정.
- **ISSUE-011 (좌표 저장)**: 길찾기 딥링크 폴백 외 좌표 저장 선행작업.
- **바우처 신선도 표현**: updated_at 정직 라벨링 vs last_synced_at 신규 컬럼+SaaS 입력 UI — "최종갱신일=전자바우처 동기화 시각" 오인 금지.
- **바우처 만료/소진 표시**: 완전제거 vs "만료됨/소진됨" 비활성 표시 (R7 만료/회수 UX·R8 톤 통일).
- **비주보호자/성인 자녀 잔존 relation 접근 정책**: is_primary 제한 여부, 자녀 성인 도달 시 relation 만료/검토 트리거 위치(센터 운영 vs 앱 안전장치).
- **거절 사유 노출 정책**: 센터 거절 사유 내담자 노출 여부, 재신청 상한.
- **멀티센터 토큰 스코프**: account-wide 전체 조회 vs 단일 센터 컨텍스트 통일.
- **콘텐츠 운영 주체**: 10개 큐레이션 교체 동선 (센터 공통 vs 본사), 정적 seed 진실원(번들 임베드 vs DB row).
- **AI 기능 production 배포 승인** (Phase 3 전제).

---

## 7. 시안 버전 이력

| 버전 | 경로 | 라운드 | 변화/합격선 |
|------|------|--------|-------------|
| v1 | (mockup-v1) | R5 종합 | 단일 조건부 트리 IA 골격 확정. 확정 결정만 렌더, 다음일정 정보밀도·오브 비주얼은 **placeholder만**. 3상태 시각 연속체 + 보호자 자녀 그룹핑 노출, 토글 데모 주석 |
| v2 | (mockup-v2) | R10 종합 | **임상 데이터 충전**: 자녀 섹션 실제 렌더(화이트리스트 더미 필드만), 다음일정 카드 정보밀도 LOCK 시각 구현, 회차 진행 역할별 분기, 검사결과 카드+PDF 진입점. 3 가드레일 LOCK 흡수(화이트리스트 더미 주석/폴백 중립 카피/미정 라운드 무자리) |
| v3 | (mockup-v3) | R15 최종 | **confirmed-only**: MVP 범위만 시각화. 푸시·오브 경량 비주얼·정적 뷰어 반영. Phase 2/3 항목은 자리조차 비움(IA 시각 압력 제거). 4 가드(도메인 카운트/RN 부트스트랩 비용/relation 품질/P1 지표) 명시 |

**버전 간 핵심 원칙**: render-vs-lock 분리 — 미확정 라운드 항목은 placeholder div조차 만들지 않아 후속 판정을 선점하지 않음. LOCK된 IA/화이트리스트/머지 경계는 버전 전반 불변.
