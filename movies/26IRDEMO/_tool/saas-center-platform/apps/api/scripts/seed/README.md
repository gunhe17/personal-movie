# 시드 가이드

`common`(운영 기준·카탈로그) + `develop`(개발 픽스처). 모두 멱등, Global 데이터.

```bash
uv run python -m scripts.seed.common    # 기준데이터만
uv run python -m scripts.seed.develop   # common + 개발 픽스처(가짜 계정/센터/내담자)
```

파일명 = 데이터가 생성되는 (서브)모듈. 개별 실행: `python -m scripts.seed.common.<name>`.

---

## common

### `role.py` — 역할 4 + 권한 매핑

| code | 이름 | access_level | 비고 |
|---|---|---|---|
| ADMIN | 관리자 | all | 전 권한 |
| MANAGER | 매니저 | all | write:role 제외 |
| STAFF | 직원 | all | 접수/행정, 상담 기록 제외 |
| COUNSELOR | 전문가 | own | 본인 담당만 |

권한은 `role_permission.config.DEFAULT_ROLE_PERMISSIONS` 기준으로 매핑.
`RoleCode` enum 4종과 목록이 일치해야 한다 — 빠지면 그 역할의 develop 계정이 멤버로 붙지 못한다.

### `plan_config.py` — 구독 플랜 4 + 플랫폼 스칼라 설정 4

`subscription/plan_config.py` 의 하드코딩 폴백(`_DEFAULT_*`)을 DB 정본(`plan_configs`·`platform_settings`)으로 승격.
비어 있으면 `refresh_plan_config_cache()` 가 폴백으로만 돌아 플랜 한도를 운영에서 조정할 수 없다.

| plan_type | label | 월 가격 | 크레딧 한도 |
|---|---|---|---|
| free | Free | 0 | 0 |
| starter | Starter | 29,000 | 600 |
| pro | Pro | 59,000 | 2,500 |
| enterprise | Enterprise | 0 | 8,000 |

스칼라: `trial_duration_days=365` · `trial_plan=pro` · `credit_cycle_days=30` · `quota_grace_days=7`

### `assessment.py` — 심리검사 18종

| code | 한글명 | 유형 | 대상 | 소요(분) | 방식 |
|---|---|---|---|---|---|
| SMARTPHONE_ADDICTION | 스마트폰중독검사 | objective | 만 10-19세 | 10 | 온라인 self_report |
| SMARTPHONE_OVERDEPENDENCE_ADULT | 스마트폰 과의존 성인·고령층 척도 | objective | 만 20세 이상 | 10 | 온라인 self_report |
| SMART_BODY_CHECKER | 스마트 바디체커 | objective | 만 6세 이상 | 15 | external_service |
| J_TCI | 기질 및 성격 검사 - 청소년용 | objective | 만 12-18세 | 30 | external_service |
| K_BAYLEY_3 | 한국형 베일리 영유아 발달검사 3판 | objective | 생후 16일-42개월 | 60 | external_service |
| K_CBCL | 아동·청소년 행동평가척도 | objective | 만 6-18세 | 30 | external_service |
| K_WISC_IV | 한국 웩슬러 아동지능검사 4판 | objective | 만 6-16세 | 90 | external_service |
| MMPI_2 | 다면적 인성검사 2판 | objective | 만 19세 이상 | 90 | external_service |
| MMPI_A | 청소년용 다면적 인성검사 | objective | 만 13-18세 | 60 | external_service |
| PAT | 부모양육태도 검사 | objective | 성인 부모 | 20 | external_service |
| RAVEN | 레이븐 누진행렬 지능검사 | objective | 만 5세 이상 | 45 | external_service |
| TCI | 기질 및 성격 검사 - 성인용 | objective | 만 19세 이상 | 30 | external_service |
| WPPSI | 한국 웩슬러 유아지능검사 | objective | 만 2세 6개월-7세 7개월 | 60 | external_service |
| BGT | 벤더 게슈탈트 검사 | projective | 만 4세 이상 | 30 | external_service |
| HTP | 집-나무-사람 그림검사 | projective | 만 4세 이상 | 40 | external_service |
| KFD | 동적 가족화 검사 | projective | 만 5세 이상 | 30 | external_service |
| RORSCHACH | 로르샤흐 검사 | projective | 만 5세 이상 | 90 | external_service |
| SCT | 문장완성검사 | projective | 만 10세 이상 | 30 | external_service |

온라인 2종(SMARTPHONE_*)만 `supports_online=True`. 나머지는 오프라인.

### `form.py` — 문서 양식 (시스템 1 + 센터 13)

시스템 양식 **서비스 이용 계약서**(published) — 필드 17개:

| 그룹 | 필드 |
|---|---|
| 이용자 | 성명·서명·생년월일·주소·연락처 |
| 대리인 | 성명·서명·관계·주소·연락처·이메일 |
| 제공기관 | 기관명·대표자성명·대표자서명·주소 |
| 계약기간 | 시작·종료 |

센터 데모 13종 (※ = draft, 나머지 published):

| 양식 | 양식 |
|---|---|
| 개인정보 수집·이용 동의서 | 회기 기록지 |
| 상담 신청서 | 심리검사 실시 동의서 |
| 초기 면담 기록지 | 놀이치료 관찰 기록지 ※ |
| 부모 양육태도 설문 | 부모 상담 기록지 |
| 아동 행동 평가 체크리스트 | 종결 보고서 |
| 위기개입 평가지 ※ | 서비스 만족도 설문 |
| 재방문 예약 신청서 ※ | |

### `notice.py` — 플랫폼 공지 3 (작성자 = super_admin)

| category | title | 고정 |
|---|---|---|
| announcement | 상담센터 SaaS 정식 오픈 안내 | ✓ |
| update | AI 상담일지 생성 기능 업데이트 | |
| maintenance | 정기 서버 점검 안내 (매월 첫째 주 일요일) | |

### `messaging.py` — 시스템 문자 양식 8종 (center_id=NULL)

| 검사 결과 전송 | 검사 링크 전송 | 검사 결과 준비 완료 | 상담 예약 확정 |
|---|---|---|---|
| **상담 리마인더** | **예약 확인 SMS** | **청구서 발행 알림** | **문서 작성 요청** |

### `document.py` — 원본 문서 1

| name | type |
|---|---|
| 2026년 경기도 지역사회서비스투자사업 표준매뉴얼 | pdf (GlobalDocument) |

### `admin_account.py` — 플랫폼 어드민 2 ⚠️ 비번 하드코딩

| email | password | name | role |
|---|---|---|---|
| admin@insighter.co.kr | SystemAdmin1234!@ | 관리자 | ADMIN |
| imomtae@insighter.co.kr | SuperAdmin1234!@ | 플랫폼 관리자 | SUPER_ADMIN |

### `qna.py` — FAQ 6

| category | question |
|---|---|
| getting_started | 일정은 어떻게 관리하나요? |
| getting_started | 상담일지는 언제 작성할 수 있나요? |
| getting_started | 심리검사는 어떻게 진행하나요? |
| general | 여러 상담사가 함께 사용할 수 있나요? |
| general | 내담자 등록 시 보호자도 함께 등록할 수 있나요? |
| general | 센터 상담실은 어떻게 설정하나요? |

### `voucher.py` — Voucher 3 (2026 경기도, 위 document 연결)

| name | 대상 | 정부지원금 | 본인부담금 | eligibility (앱 자가진단 매칭 룰) |
|---|---|---|---|---|
| 우리아이심리지원서비스 | 만 12세 이하 아동 | 144,000 | 16,000 | max_age 12 · 소득 140% · 증빙 불요 |
| 아동비전형성지원서비스 | 만 9~18세 아동·청소년 | 180,000 | 20,000 | min 9~max 18 · 소득 140% · 증빙 불요 |
| 아동주의집중력향상서비스 | 주의력 결핍 아동 | (미지정) | (미지정) | 연령 무관 · 소득 140% · 증빙 필요 |

> eligibility의 소득(기준중위소득 140%)·증빙은 **데모 기준값** — 실기준은 지자체 공고가 정본. 기존 행은 eligibility가 비어 있으면 백필된다.

### `voucher_extraction.py` — AI 추출본 1

| 항목 | 값 |
|---|---|
| 서비스 | 아동정서발달지원서비스 (만 7~12세) |
| 정부지원금 | 180,000(90%) / 160,000(80%) |
| 본인부담금 | 20,000 / 40,000 |
| 서비스량 | 월 8회, 회당 60분, 기관방문형, 12개월 |
| 산출물 | GlobalDocument: pdf 1 + md 1 + 서식 png 2(추천서·소견서) |
| 계약 | `fields`=FIELD_PACK 15축 캡처 · `record`=map_capture 산출(화면 정본) · `verify`=None(등급은 PDF 대조 필요) |
| 빈 축 | 사업유형·우선순위·제외·절차 — 최초 캡처(구 12키)에 없던 축이라 근거 없이 채우지 않는다 |

---

## develop

마인드스코프 아동심리상담센터 1곳에 전 데이터가 묶임. 로그인 공통 비번 `test1234`.

### `account.py` — Account 5 + Person 5

| key | email | 이름 | role_code | 고용형태 |
|---|---|---|---|---|
| admin | admin@mindscope.com | 김원장 | ADMIN | FULLTIME |
| manager | manager@mindscope.com | 이사무 | MANAGER | FULLTIME |
| staff | staff@mindscope.com | 박접수 | STAFF | CONTRACT |
| counselor1 | counselor1@mindscope.com | 정상담 | COUNSELOR | FULLTIME |
| counselor2 | counselor2@mindscope.com | 최치료 | COUNSELOR | FREELANCER |

### `center.py` · `room.py` · `subscription.py` · `credit.py`

| 파일 | 데이터 |
|---|---|
| center | Center 1 — 마인드스코프 아동심리상담센터 (서울 강남) |
| room | 상담실 1 |
| subscription | Subscription 1 — Pro 플랜 (당월 period) |
| credit | CreditBalance — 한도는 `PLAN_CREDIT_LIMITS["pro"]`(현재 2,500)에서 유도, 기간은 구독 기간과 정렬 |

### `center_assessment.py` · `role.py`

| 파일 | 데이터 |
|---|---|
| center_assessment | 위 18종 검사 전부 센터 매핑 (is_active=True) |
| role | 센터 Role 4 (Global 복사) + 권한 매핑 |

### `member.py` — Member 5

account 5명을 각자 role_code로 센터 멤버에 연결 (ADMIN·MANAGER·STAFF·COUNSELOR×2).
color는 센터 내 최소 사용 팔레트 색(`AssignMemberColorService`의 `COLOR_PALETTE`)을 배정 — 기존 멤버도 color가 NULL이면 재실행 시 백필.

### `client.py` — Client 7

| key | role | 생년월일 | 성별 | 비고 |
|---|---|---|---|---|
| 김민준 | client | 2019-03-10 | male | ADHD 의심 |
| 김영희 | both | 1990-08-25 | female | 김민준·김서연 모, 본인도 상담 |
| 김철수 | guardian | 1988-12-03 | male | 김민준·김서연 부 |
| 김서연 | client | 2021-06-15 | female | 언어발달 지연 |
| 이하준 | client | 2016-09-22 | male | 학교 적응·또래관계 |
| 이수진 | guardian | 1985-04-18 | female | 이하준 모, 한부모 |
| 박지우 | client | 1991-02-14 | female | 성인, 우울/직장 스트레스 |

### `relation.py` — 보호자관계 5쌍 + 형제 1쌍 (각 양방향)

| 아동 | 보호자 | 관계 | 주양육자 |
|---|---|---|---|
| 김민준 | 김영희 | mother | ✓ |
| 김민준 | 김철수 | father | |
| 김서연 | 김영희 | mother | ✓ |
| 김서연 | 김철수 | father | |
| 이하준 | 이수진 | mother | ✓ |

형제: 김민준 ↔ 김서연 (younger_sister / older_brother)

### `program.py` — 프로그램 2

| 이름 | 유형 | 가격 | 시간 |
|---|---|---|---|
| 개인상담 | INDIVIDUAL | 80,000 | 50분 |
| 놀이치료 | INDIVIDUAL | 70,000 | 40분 |

### `counseling.py` — 케이스 2 (+ 세션·일지·스케줄)

| code | 내담자 | 프로그램 | 회기 | 주호소 |
|---|---|---|---|---|
| C00001 | 박지우 | 개인상담 | 4 (완료) | 직장 스트레스·우울 |
| C00002 | 이하준 | 놀이치료 | 3 (완료) | 또래관계·학교적응 |

각 회기마다 Schedule(title `{code} - {n}회기`) + CounselingSession(completed) + CounselingNote 1
+ CounselingSessionParticipant 2행(counselor1 · 내담자, `attended`/`is_consumed=True`).
title 빈 기존 상담 일정은 연결 세션에서 유도해 같은 형식으로 백필.

### `assessment.py` — 검사 케이스 1 (+ 회기·수검자·검사종목·스케줄)

| code | 수검자 | 회기 | 상태 |
|---|---|---|---|
| AC0001 | 김영희 (기존 participant 있으면 유지) | 3 | attended 1 (지난주) + scheduled 2 (이번주·다음주) |

각 회기마다 Schedule(schedule_type=assessment, title `AC0001 - {n}회기`) + AssessmentSessionParticipant 2행
(client 김영희 · assistant counselor1, attendance_status = 회기 상태) 연결.

검사 종목(AssessmentTask, `case_id`+`assessment_id` 자연키):

| code | status | 비고 |
|---|---|---|
| MMPI_2 | completed | attended 회기에 연결, 보호자 열람 허용 |
| SCT | in_progress | |
| HTP | pending | |

케이스·수검자·회기 각각 존재하면 스킵(검사 종목은 그때도 보강).

### `field_note.py` — 필드노트 3 (+ 기존 노트 일정 연결 백필)

| summary | 연결 |
|---|---|
| 직장 스트레스 상황에서의 자동적 사고… | 상담 일정 |
| 또래관계 역할놀이 진행… | 상담 일정 |
| 행동 활성화 계획 수립… | 상담 일정 |

author=counselor1, status/processing/transcribe/summary 전부 completed, 30분(1800s). summary 자연키 멱등.
schedule 미연결 기존 노트는 센터 내 연결 노트가 5건이 될 때까지 오래된 순으로 상담 일정에 연결(백필).
일정은 노트당 1개 유니크(idx_field_note_schedule) — 미사용 상담 일정만 배정.

---

### `operating_time.py` — 센터 운영시간 7 + 휴무 2

| 요일 | 운영 | 휴게 |
|---|---|---|
| MON~FRI | 09:00–19:00 | 12:00–13:00 |
| SAT | 09:00–13:00 | — |
| SUN | 휴무 | — |

휴무(NonOperatingTime, reason 자연키): `신정`(2027-01-01) · `매월 넷째 수요일 직원 교육`(14:00–18:00).

### `working_time.py` — 상담사 근무시간 8

| member | 요일 | 시간 | 휴게 |
|---|---|---|---|
| counselor1 (정상담, FULLTIME) | MON~FRI | 09:00–18:00 | 12:00–13:00 |
| counselor2 (최치료, FREELANCER) | TUE·THU | 13:00–20:00 | — |
| counselor2 | SAT | 09:00–13:00 | — |

### `program_member.py` — 프로그램 담당 상담사 3

| 프로그램 | 담당 |
|---|---|
| 개인상담 | counselor1 |
| 놀이치료 | counselor1, counselor2 |

### `voucher.py` — 센터 바우처 2 + 내담자 바우처 2

common `voucher.py` 카탈로그를 센터가 채택한 형태(`catalog_id` 연결).

| 센터 바우처 | 기본 회기 | 회당 단가 |
|---|---|---|
| 우리아이심리지원서비스 | 12 | 160,000 |
| 아동비전형성지원서비스 | 12 | 200,000 |

| 내담자 | 바우처 | 잔여/총 |
|---|---|---|
| 이하준 | 아동비전형성지원서비스 | 9 / 12 (3회기 사용) |
| 김민준 | 우리아이심리지원서비스 | 12 / 12 |

### `price_list.py` — 가격표 6

| service_type | service_name | 단가 | source |
|---|---|---|---|
| counseling | 개인상담 | 80,000 | synced (program 연결) |
| counseling | 놀이치료 | 70,000 | synced (program 연결) |
| assessment | 다면적 인성검사 2판 | 90,000 | manual |
| assessment | 한국 웩슬러 아동지능검사 4판 | 150,000 | manual |
| assessment | 집-나무-사람 그림검사 | 60,000 | manual |
| assessment | 문장완성검사 | 50,000 | manual |

### `billing.py` — 청구서 3 + 항목 8 + 결제 2

완료된 회기를 근거로 발행. 상태 3종을 모두 덮는다. 금액 규약은 `CreateBillableService`와 동일
(`total = 정가합 - subsidy - discount`, `unpaid = total - paid`).

| 근거 | 내담자 | 정가 | 지원금 | 총액 | 결제 | status |
|---|---|---|---|---|---|---|
| C00001 상담 4회기 | 박지우 | 320,000 | 0 | 320,000 | 카드 320,000 | paid |
| C00002 놀이치료 3회기 | 이하준 | 210,000 | 180,000 (바우처) | 30,000 | 현금 30,000 | paid |
| AC0001 MMPI-2 1건 | 김영희 | 90,000 | 0 | 90,000 | — | issued (미납) |

항목은 `related_type` = `counseling_session` / `assessment_session` 으로 회기에 연결. memo 가 자연키.

> **강결합 주의**: develop step 들은 함수만 담고, `develop/__init__.py` 의
> `seed_fixtures()` 가 공유 컨텍스트(center_id·accounts·role_map·client_map·programs·
> price_lists·client_vouchers)를 단일 트랜잭션에서 순서대로 엮어 호출한다(개별 실행용 아님).
> develop 의존 순서: `subscription → credit`(기간 정렬) · `program → program_member/price_list` ·
> `counseling/assessment → billing`(완료 회기가 청구 근거) · `voucher → billing`(지원금).
> common 의존 순서: `document → voucher` · `role → member`(역할 누락 시 그 계정은 멤버가 안 됨) ·
> `admin_account → notice`.

## 스키마 초기화

마이그레이션 체인은 빈 DB에서 돌지 않는다(최초 리비전이 기존 스키마를 전제). 바닥부터 만들 때:

```bash
uv run python -m scripts.init_db     # drop_all + create_all (SQLAlchemy metadata)
uv run alembic stamp head            # 이후 마이그레이션이 이어지도록 헤드 고정
uv run python -m scripts.seed.develop
```
