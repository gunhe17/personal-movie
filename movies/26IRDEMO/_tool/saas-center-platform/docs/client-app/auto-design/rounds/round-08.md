# Round 08 — 검사 셀프 응답 적격성 — assessment-flow 확장

## 주제/긴장
- **주제**: 내담자 앱에서 검사를 셀프로 응답할 수 있는 적격성을 어떻게 정의하고, 어디까지 MVP에 넣을 것인가. R7(검사 결과 **열람**)은 종료, 이번은 **응답(쓰기)** 차원.
- **관련 긴장**: T5(자기보고식만 vs 전체) / 임상 타당도. 시드 38행 "검사별 셀프응답 적격성 플래그 필요"가 신규 설계를 요구하는지, 기존 코드로 이미 충족되는지가 핵심. T10(센터 시행 통제권/무감독 응답 신뢰도)도 부수적으로 걸림.

## A · 옹호 주장 (근거 포함)
- **적격성은 신규 플래그가 아니라 기존 두 컬럼의 AND 게이트** (code): `assessment/models.py:84 workflow_type(self_report/external_service)` + `models.py:100 supports_online(bool, default=False)`. 적격 = `workflow_type==self_report AND supports_online==True`. 신규 enum/마이그레이션 0.
- **임상가 시행 검사 차단은 코드가 이미 강제** (code): `send_link_facade.py:22-36 _validate_online_support`가 `supports_online=False`를 원격 발송에서 `InvalidOperationException`으로 거부. 로르샤흐·지능검사는 `default=False`로 자동 차단 → T5 신규 비용 없이 방어.
- **미소속 F05 셀프체크 = self_report 라이선스 명확 척도(PHQ-9/GAD-7)** (roi): R1 확정의 코드 매핑. 결과 비저장이라 task/send_result 무관, 미인증 공개 채점 엔드포인트만 신규(R1 인지).
- **연동 사용자 인앱 셀프 응답을 MVP로** (px): 소속홈 행동 우선 위계(R3)를 행동 수준에서 종결시키는 유일 지점. 못 하면 문자 link로 튕겨나가 동선 단절.
- **인앱 셀프 응답은 R4/R6 동급 신규 백엔드 명시** (code): `submit_task`(WRITE_ASSESSMENT_CASE), `get_task`(READ_ASSESSMENT_CASE)뿐이라 내담자 JWT 경로 0. participant=JWT client 강제 + online·self_report·미완료 화이트리스트 신규 엔드포인트 필요, 채점 로직은 재사용.
- **화이트리스트 LOCK** (px): `execution_method==online AND workflow_type==self_report AND status in(pending,processing) AND participant==JWT client`. onsite·external_service·임상가 검사 코드 레벨 배제.
- **제외**: external_service 인앱 응답/업로드, 앱 내 채점 로직, 센터별 셀프응답 on/off 토글(supports_online이 이미 게이트). **연기**: 자녀 대리 응답(R9), 제출 결과 즉시 노출(R7 게이트).

## B · 검증 반박 (근거 포함)
- **A의 핵심(적격성=두 컬럼 재사용)은 코드로 검증돼 인정** (code): models.py:84/:100 실존, send_link_facade.py:22-36 강제 확인. 신규 enum 0, T5 AND 게이트 방어 동의.
- **A의 'onsite 분리 화이트리스트'는 허구의 독립 차원** (code): `assessment_case_facade.py:399-401` — `execution_method = "online" if assessment.supports_online else "onsite"`. execution_method는 supports_online의 파생이라 화이트리스트의 execution_method 조건은 **중복 표현**이고, A가 자랑한 "onsite 별도 배제 안전장치"는 코드에 없다. 게이트 실체는 두 컬럼뿐.
- **'assessment-flow 쿠키 인증 셀프 응답 경로'는 코드에 존재하지 않는다** (code): assessment 모듈 전체 `set_cookie/anonymous/public_token` grep 0건. 응답 제출 경로는 `submit_task`(센터 admin) 단 하나.
- **따라서 인앱 셀프 응답은 '채점 재사용+게이트 교체'가 아니라 R4/R6보다 무거운 신규 백엔드** (code): R7 열람은 read 100% 재사용이었지만, 셀프 응답은 write다 — `on_start`(문항 반환)→`on_submit`(응답 저장·상태전이)→`on_complete`(채점·PDF) 전 단계를 본인 task로만 스코프하는 클라이언트-facing 핸들러 3종 + 상태머신 인가가 net-new.
- **A의 status 'pending/processing'은 실제 상태머신과 불일치** (code): `self_report_workflow.py:79-87` — `pending→in_progress→submitted→completed`. `processing`은 워크플로우 코드에 부재. 그대로 LOCK 시 in_progress·submitted 누락 버그.
- **send_link의 '명시적 발송' 게이트 부재로 onsite 의도 검사 누출** (px): `models.py` supports_online comment = "온라인 검사 지원 여부 (센터 방문 + 태블릿 자가응답)". 인앱 셀프 응답은 센터의 명시적 발송 행위 없이 supports_online=True인 모든 배정 task를 자동 노출 → 현장 시행 의도 검사를 원격으로 열어버리는 위험. T5가 A 주장만큼 자동 방어되지 않음.
- **px 증분 가치는 인정하나 MVP 필수성 미입증** (px): 문자 link가 이미 동작 → '동선 단절'이 아니라 '채널 전환'. 임상 응답 수집 책임(중도저장·재개·문항 렌더 정합성·미완료 처리)을 MVP에 지우는 비용을 증분 가치가 넘지 못함.
- **F05·적격성 게이트 발명 안 함은 include 유지** (roi).

## 중재자 코드 재검증 결과
B의 결정적 코드 주장 3건 모두 직접 확인:
1. `assessment_case_facade.py:400` — `assessment.id: "online" if assessment.supports_online else "onsite"`. execution_method는 supports_online의 순수 파생. **A의 'onsite 분리 게이트'는 허구**, 게이트 실체는 두 컬럼뿐.
2. supports_online 모델 comment = "센터 방문 + 태블릿 자가응답" 확인. online 플래그의 의도가 **현장 태블릿**임을 코드가 명시 → '명시적 발송 게이트 부재 시 onsite 의도 누출' 위험은 실재.
3. `self_report_workflow.py:79-87` 상태머신 = `pending→in_progress→submitted→completed`, `processing` 부재. assessment 모듈 전체 `set_cookie/anonymous/public_token` grep 0건, 응답 제출은 `submit_task`(센터 admin) 단 하나. **A의 status 화이트리스트는 버그, 셀프 응답은 write-side net-new** 확정.
또한 supports_online **default=False**라 적격성 규칙은 명시 설정이 없으면 **fail-closed(셀프 차단)**로 동작 — 규칙 LOCK이 임상적으로 안전한 기본값을 자연 상속한다.

## 쟁점별 판정 (기능 | A | B | 결정 | Phase | 이유)

| 기능 | A | B | 결정 | Phase | 이유 |
|---|---|---|---|---|---|
| 미소속 F05 무료 셀프체크 (self_report·라이선스 명확 척도, 결과 비저장) | include | include | **포함** | MVP | 양측 일치 + R1 기확정. 결과 비저장·미인증 공개 채점이라 task/send_result 게이트와 독립. self_report 매핑 정확. 이번 라운드 적격성 모델의 대상이 아니라 R1 결정의 확인 (roi/code) |
| 셀프 응답 적격성 = `(workflow_type==self_report AND supports_online==True)` 게이트 재사용 (신규 플래그 신설 안 함) | include | include | **포함** | MVP | 양측 일치, 코드 검증 완료. models.py:84/:100 실존 + send_link_facade.py:22-36 강제. 신규 enum/마이그레이션 0. default=False라 fail-closed(미설정=차단)로 임상 안전 기본값 상속. 시드 38행 '신규 플래그'는 두 기존 컬럼 조합으로 충족. **단 execution_method는 supports_online 파생(case_facade:400)이라 독립 게이트 아님 — 게이트 실체는 이 두 컬럼뿐** (code) |
| 임상가 시행 검사(로르샤흐·지능검사 등) 앱 셀프 응답 | exclude | exclude | **제외** | - | 양측 일치. supports_online default=False로 위 AND 게이트가 자연 차단, send_link가 이미 원격 거부. 노출 시 T5 타당도 붕괴. 비적격은 "센터 방문 안내" 폴백 (px/code) |
| external_service 검사 앱 내 응답/보고서 업로드 | exclude | exclude | **제외** | - | 양측 일치. 외부 수행 후 상담사 업로드 워크플로우라 셀프 응답 개념 부재. 결과는 R7 열람으로 도달 (code/roi) |
| 앱 내 셀프 응답 채점 로직 내장 | exclude | exclude | **제외** | - | 양측 일치. F05 §4 채점은 서버 원칙. on_complete 채점·PDF는 서버 수행(self_report_workflow.py:66-75). 앱은 응답 수집만 (px/code) |
| **연동 사용자 인앱 셀프 응답 (online·self_report·본인 배정 task 직접 응답)** | include | defer | **연기** | Phase 2 | **B 채택, A의 include 번복.** 비용이 R4/R6 동급이 아니라 그 이상이다: 셀프/익명 응답 경로가 코드에 0(submit_task=센터admin뿐, 쿠키경로 부재 grep 검증)이라 on_start/on_submit/on_complete 클라이언트-facing 핸들러 3종 + 상태머신 인가가 write-side net-new. 게다가 send_link의 '명시적 발송' 게이트 부재로 onsite 의도 검사(supports_online comment '센터 방문+태블릿') 누출 위험이 있어 T5가 A 주장처럼 자동 방어되지 않음. px 증분은 실재하나 문자 link 동작 중이라 채널 전환에 그쳐 MVP 필수성 미입증 (code/px) |
| 인앱 셀프 응답 화이트리스트 LOCK (status 조건 포함) | include | defer | **연기** | Phase 2 | 본체 defer로 자동 연기. **채택 시에도 A의 'status in(pending,processing)'은 실제 상태머신(pending→in_progress→submitted→completed, self_report_workflow.py:79-87)과 불일치 — processing 부재로 그대로 LOCK 시 버그.** 게이트 차원은 `(workflow_type==self_report AND supports_online==True AND participant==JWT client)`로 정정, execution_method 조건은 supports_online 중복이라 제거, status는 실값 재확정 필요 (code) |
| 인앱 셀프 응답 '명시적 발송 의도' 게이트 (Phase 2 동반 설계) | (supports_online으로 충분 주장) | 명시 요구 | **연기** | Phase 2 | **B 제기 채택.** supports_online=True여도 센터가 현장 태블릿 시행을 의도했을 수 있어, 인앱 원격 노출에는 send_link 같은 '명시적 발송' 신호가 필요. 셀프 응답 본체와 함께 Phase 2에서 의도 게이트(배정 시 원격허용 플래그 또는 'send_link 발송된 self_report task만 노출' 연계) 설계 (px/code) |
| send_link 온라인 검사를 앱에서 웹뷰/외부브라우저 패스스루 진입 (네이티브 UI 없이) | — | defer | **연기** | Phase 2 | 응답 엔진 신설 없이 기존 send_link 웹 응답을 재사용하는 저비용 대안. 단 send_link는 센터 발송 케이스에만 존재→앱 능동진입과 별개라 R11(일정/할일 카드) 동선과 묶음. 네이티브 엔진보다 먼저 검토할 경로 (roi) |
| 보호자 자녀 배정 task 대리 셀프 응답 | defer | defer | **연기** | Phase 2 | 양측 일치. relation 기반 인가 신규(시드 36행 부재)=R9 소관. 본체 defer와 함께 연기. v1 본인만 (code) |
| 셀프 응답 제출 결과(report_payload) 인앱 즉시 노출 | defer | defer | **연기** | Phase 2 | 양측 일치. 제출과 열람 분리. 결과 노출은 R7 send_result 게이트(공유됨/미공유) 종속, T10 준수. 본체 defer와 함께 연기 (px) |
| 센터별 검사 셀프응답 on/off 별도 토글 신설 | exclude | exclude | **제외** | - | 양측 일치. supports_online이 이미 검사·센터 단위 게이트라 별도 center-level 토글은 중복. 단 인앱 셀프 응답의 onsite 의도 누출은 위 '명시적 발송 의도 게이트'(Phase 2)로 해결하며, 셀프 예약(T6/R11)의 센터 토글과 다른 차원 (code) |
| 셀프응답 적격성 신규 enum/컬럼 신설 (eligibility_flag 등) | (반대) | exclude | **제외** | - | code: supports_online+workflow_type 조합으로 동일 판정. 새 컬럼은 마이그레이션+SaaS 발행 UI 개편 강제(R7 화이트리스트 원칙 위반)·중복 진실원 생성 |

## 결정 요약
적격성 모델은 **신규 발명 없이 기존 두 컬럼의 AND 게이트(`workflow_type==self_report AND supports_online==True`)로 LOCK**했다 — 양측이 코드로 합의했고, send_link가 이미 supports_online을 강제하므로 임상가 시행 검사 차단(T5)은 신규 비용 0으로 방어되며, supports_online default=False가 fail-closed로 임상 안전 기본값을 상속한다. F05 미소속 셀프체크는 R1 확정의 재확인으로 포함. 그러나 **연동 인앱 셀프 응답 본체는 A의 include를 번복해 Phase 2로 연기**한다: (1) 셀프/익명 응답 코드 경로가 0이라 비용이 R7 열람(read 재사용)이 아닌 write-side 생애주기 전체(on_start/on_submit/on_complete + 상태머신 인가)로 R4/R6을 상회하고, (2) execution_method가 supports_online 파생임이 검증돼 A의 'onsite 분리 안전장치'는 허구이며, (3) send_link의 '명시적 발송' 게이트 부재로 onsite 의도(센터 방문+태블릿) 검사가 원격 누출될 T5 잔존 위험이 있어 적격성 게이트만으로 자동 방어되지 않기 때문이다. A의 status 화이트리스트(pending/processing)는 실제 상태머신과 불일치해 채택 시 정정 필요로 기록한다. 자녀 대리·결과 즉시 노출은 R9/R7 종속으로 연기, 신규 enum 신설은 제외. Phase 2 입증은 네이티브 엔진 신설 전 send_link 웹 응답 패스스루(저비용)부터 R11 동선에 얹어 사용량/완료율을 측정한다.

## 남은 질문
- (Phase 2 / 백엔드) 인앱 셀프 응답 write-side 엔드포인트 형태: 단일 task 스코프 핸들러 3종(on_start/on_submit/on_complete)을 어디까지 self_report_workflow 도메인 로직 재사용으로 감쌀지, 내담자 본인 task에 한정한 신규 인가가 현 WRITE_ASSESSMENT_CASE(센터 admin) 권한 모델과 충돌하지 않게 설계할 위치(Facade vs Service).
- (Phase 2) onsite 의도 누출을 막는 '명시적 발송 의도 게이트' 설계: 배정 시 별도 '원격 셀프 허용' 신호를 둘지(신규 컬럼/플래그) vs 기존 send_link 발송과 연계해 'send_link 발송된 self_report task'만 인앱 노출할지. 후자면 신규 컬럼 0이나 send_link 모델 의존 발생.
- (Phase 2) 인앱 셀프 응답 화이트리스트 status 실값 확정: `pending/in_progress/submitted/completed` 중 응답 가능 상태(시작 가능 + 재개 가능) 정의, 중도저장(process.responses 부분 저장)·재개 UX, 미완료 처리 정책.
- (T10/운영) supports_online=True이지만 센터가 현장 감독 응답을 의도한 오설정 케이스 — supports_online 의미를 SaaS 발행 UI에서 "내담자 원격 셀프응답 허용"으로 명확화할지(필드 의미 재정의 비용).
- (R9) 보호자→자녀 배정 task 대리 응답의 relation 기반 인가 범위·프라이버시·타당도, link 중복 가드와의 관계 — MVP는 응답 엔진 자체 연기라 자동 보류.
- (R7 정합) 셀프 응답 제출 후 자동 채점된 report_payload를 내담자에게 보일 시점이 send_result 발행 게이트(공유됨/미공유)와 모순 없는지 — 제출=가능, 열람=상담사 발행 후 원칙 재확인.
- (Phase2 입증 측정) 적격 검사 send_link 완료율·웹 응답 이탈 지점 — 인앱 네이티브 엔진 ROI를 정당화할 데이터 수집 방법. ISSUE-010 F05 척도 라이선스는 적격성 모델과 분리된 별도 이슈로 유지.

## 다음 라운드로 이어받기
검사 셀프 응답 적격성은 **신규 플래그 없이 `workflow_type==self_report AND supports_online==True` AND 게이트 재사용으로 LOCK**됐다(execution_method는 supports_online 파생이라 독립 차원 아님, default=False로 fail-closed). 임상가 시행·external_service·앱 내 채점·센터별 토글·신규 enum은 제외, F05 미소속 셀프체크는 포함 유지다. **연동 인앱 셀프 응답 본체는 A의 include를 번복해 Phase 2로 연기**했다 — 셀프/익명 응답 코드 경로 0(write-side 핸들러 3종+상태머신 인가 net-new, R7 read 재사용보다 무거움) + onsite 의도(센터 방문+태블릿) 누출을 막을 '명시적 발송 의도 게이트'가 함께 설계돼야 T5가 닫히기 때문. send_link 웹 응답 패스스루가 네이티브 엔진보다 먼저인 저비용 경로로 R11 동선에 묶인다. R9(보호자 멀티프로파일/권한)는 이 적격성 LOCK과 응답 엔진 연기를 건드리지 말고, 자녀 결과 열람 relation 인가(R7 이어받기)와 본인/자녀 위계만 채우되, 자녀 대리 응답은 응답 엔진 연기로 자동 보류임을 전제한다. status 화이트리스트는 pending/processing(버그)이 아닌 실제 상태머신(pending→in_progress→submitted→completed) 실값으로 Phase 2에서 재확정한다.
