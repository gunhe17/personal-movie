# assistant — 통합 결정 대장 (SSOT)

> 2026-07-28 통합: 구 loop 13편(agent-model-selection·system-prompt-finalization·select-lab-tool-select(+HANDOFF)·
> function-call-selection·graph-driven-multihop·history-tool-trace-plan·frontend-tool-rename-plan·
> agent-429-fallback-plan·agent-flow-review·agent-query-generalization·responder-wiring-plan·
> agent-performance-backlog·member-profile 관련분)을 이 파일 하나로 수렴. 원본 제거, 실측 도구·원시 결과는
> [apps/api/labs/assistant](../../apps/api/labs/assistant/README.md). 구현 지도는
> [runtime/assistant/CLAUDE.md](../../apps/api/app/runtime/assistant/CLAUDE.md), 표면 계약은 rules(agent-query.md·naming.md).

## 1. 확정 상태 (프로덕션)

> **2026-08 갱신 (현행)**: 오케 = `google/gemini-3.1-flash-lite`(OpenRouter) · responder 비활성(`ASSISTANT_RESPONDER_MODEL=""`).
> 서버 `group_by` 재도입(G-impl: list 조합·SQL GROUP BY 아님) — 정본 [agent-query.md](../rules/api/agent-query.md).
> 아래 07-28 문단은 **당시** 확정(laguna 직결·responder on) — 역사. 롤백 시 그 구성으로.

- **모델 (07-28~08 직전)**: `poolside/laguna-s-2.1` **Poolside 직결 주력**(inference.poolside.ai, 한시 무료·전용 한도 — 킬스위치 `POOLSIDE_DIRECT=false`로 OpenRouter 폴백) · reasoning off · max_tokens 2048.
  $0.10/$0.20 — haiku 대비 10배 저렴, 하드엣지 14/15(haiku 4/9), ~3.4s/rep.
- **responder (07-28~08 직전)**: `google/gemini-3.1-flash-lite`가 최종 발화 위임(빈 문자열=킬스위치). 자료(도구 결과) 정본·
  초안 폴백·인사서두 금지·io 트레이스 영속. 승격 경로 = gemini-3.6-flash(형식·오독 관측 시).
- **도구 스코프 32**: query 22(app)+2(모듈) + prefill + ask_user. 직접 write·비-query read 전면 제외.
  request_form 정의 보존·스코프 제외(값 수집이 prefill 화면 일원화 침식 — 값0 발화 0/6 실측).
- **가드**(전부 텍스트 지적+재요청 — tool_choice=any는 OpenRouter 경유에서만 무시, 직결에선 유효 실측: 재설계 후보):
  빈답 wrap_up(글리치 27%→0) · 화면의도 open_screen(값0 직행 0/6→6/6) · 무조회 단정 requery
  (부재단정 "찾을 수 없|확인되지 않" 포함 — WUI 거짓부정 실측 수리 2026-07-27) · 중복호출/미등록 is_error ·
  hop 8 소진 wrap_up · 429 폴백(7s 앱 재시도 후 안내문 정상 종결).
- **히스토리**: DONE 턴 텍스트 쌍 + 도구 흔적 복원(rows 3·500자) + **prefill 흔적(origin/origin_args)** —
  텍스트-only는 "무조회 즉답 시범"이 되어 다음 턴 오염(오선택 0/5→5/5·prefill 완주 11%→67% 페어드).
  responder에는 텍스트 쌍만(가드 재시도가 안 보이는 것이 오염 회복 기전).
- **프로필(member-profile v2)**: 스냅샷(센터·사용자명·최근작업·업무패턴·자주쓰는값 600자 예산)을
  <context>에 주입. defaults가 prefill 기본값(A/B: 0/8→5/8), 정체성 라인이 되묻기 제거. soft 의존(실패=날짜만).
- **표면 어휘**: 프론트 도구명·컬럼 맵 서버 24종 동기화(미이관=표 침묵 무렌더). 마크다운 목록 위반은
  프롬프트-저항 → 프론트 렌더러 흡수. dev 어휘(UUID·경로·코드)는 sanitize 출력단 강제.

## 2. 결정 대장 (날짜·근거)

| # | 결정 | 근거 실측 |
|---|---|---|
| D1 | laguna-s-2.1 채택(2026-07-22)·프로덕션 플립(07-23) | 하드엣지 14/15·CoT 건전 12/15·$0.10·3.4s. grok 정확하나 22.7s 탈락, 중국계 배제, gemini-flash-lite 멀티홉 0/9 |
| D2 | thinking OFF 확정 | 정확도 +0·비용 ≥+64%·빈답 글리치 원인. Poolside 권장(ON)과 반대로 — 트레이드 수용 |
| D3 | 스코프 32(직접 write 제거) (07-23) | 안전은 프롬프트 아닌 구조(스코프 물리 차단). 프리픽스 239→32(입력 5배↓) |
| D4 | 거절 도구 폐기 | persistence 성향이 recall ~10%로 억제(precision 100%이나 무용). 거절=프로즈 |
| D5 | responder 위임 채택(07-27) | 페어드(단일60+멀티28+3모델66+오염7): 오염 회복 0/5→10/10·목록 위반 23%→0~5%·+1.4s·+$0.00043 |
| D6 | 인사·호칭 서두 금지 1줄(07-28) | 페어드 호칭서두 3/3→0/3·신원답변 3/3 유지 |
| D7 | requery 가드 부재단정 확장(07-27) | WUI 실측: "찾을 수 없습니다"가 능력-부정 예외("수 없")에 오매칭돼 면제 → 정규식 선행 매치 |
| D8 | prefill 흔적 히스토리 복원 + **인자 충실**(07-27~28) | 완주 11%→67%. 단 input={} 복원은 "빈 인자 prefill" 모방 유발(WUI 폼 미채움 실측) → origin_args 원 인자 복원. **07-28 후속**: h05 proven — 오염은 와이어 의존(직결 70% vs openrouter 17%, CI 비중첩). 직결 주력 전환으로 실질 무대 소멸, 배선 존치(무해), with_trace 직결 유해성(N*≈71)만 백로그 |
| D9 | 자동 제목 = 첫 발화 30자 (구 _maybe_autotitle 이식) | 컷오버 이식 누락 복원 |
| D10 | 429 = 7s 앱 재시도 1회 → 폴백 안내 정상 종결 | Poolside 업스트림 파도(같은 분 성공·실패 공존) — SDK 1s×2로는 파도 못 넘음. 실관측 4회+ |
| D11 | 발산 fan-out = 모델 병렬 tool_call 정본 (07-25) | 전면 group_by(+1,360줄 차원 복제) 롤백 — laguna 병렬이 서버 0줄로 동등(3/3). **D27로 부분 대체**: 선언 dim만 기존 query+group_by(G-impl), 미선언은 병렬 유지 |
| D12 | 흡수(J표) = 능력이지 공짜 아님 | cover 100% 달성 시 sibling -20%p(카탈로그 confusability) 페어드 재현 — 문구로 못 없앰. 확장 전 client 골든 회귀 측정 필수 |
| D13 | member-profile A/B 종결(07-14) | defaults 신설(D3)·"prefill엔 그대로 채워라" 문구(초안 "되물어라"는 채움 억제 실증)·정체성 라인·narrative 유지 |
| D14 | e2e = 모킹 밀폐(imomtae_test·LLM 스크립트·responder 비활성) | run_e2e.sh env 강제 + conftest 이중 방어. test_18은 최종 문구 단정 |
| D15 | Poolside 직결 주력 전환(07-28) + 자발 포기·오염 재배속 | h05·h06 proven — 오염(17%→70% 완주)·선언-정지(100%→10%)가 경유 와이어 산물. 429 파도·P1·P2 동시 해소, 무료·tool_choice 소생. 킬스위치 POOLSIDE_DIRECT=false |
| D16 | hop≥1 화면 날조 가드(07-28) | screen-claim-fabrication adopted — "화면 선언 + page.navigate 이벤트 부재" 재요청(tool_choice=any, 직결에서 유효). 전건 0/20·완주 무열화·오탐 0/5. clean 자연 발현 30%가 배선 근거. 킬스위치 _SCREEN_LIE_ANY_HOP |
| D17 | prefill 종결-시멘틱 표면(07-29) | E3 페어드: 도구를 "턴 마무리"로 재정의한 description — 자발 완주 55%→85%(Δ+30·p=.031·q=0.8 주의), 날조·이탈 0. 이름 변경은 무효(C팔 p=.58). counseling만 반영 — 타 prefill은 실측 후. 사전 강제(E2)는 보류 기각(지연 +1.7s, 가치 소멸) |
| D18 | 선-조회 생략 가드(07-29) | E4 전건: id-부재 ref + 선행 query 0회 → is_error 자기교정(guards.unverified_ref). 유발 세계 엄격완주 20/20(100%), 교정 전환 3/3, 값0 오탐 0/5. 킬스위치 _REF_VERIFY_GUARD. 정확도 사다리 완성: 표면 85% → ref 가드 → 날조 가드 |
| D19 | 하이브리드 히스토리(07-29, 사용자 아이디어) | history-as-state-summary adopted — 과거 턴=상태-요약(user-role·엔티티 보존·집계 라벨), 최근 1턴=원문. 날조 시범 구조 제거(E1)·재사용 0홉(E2)·프로덕션 동형 지칭 3/10→10/10 p=.016(E3). 공식 문서 user-인라인 패턴 정합. 킬스위치 engine._HISTORY_SUMMARY. P5 겸해소. **E4 후속(07-29)**: 원문 창 1→2턴(다중 엔티티 지칭 붕괴 — 재채점 0→10/10 p=.002), JSON 요약 기각(이름 훼손 에코 실측). **E5·E6(07-29)**: 스케일 T12 검증 — 지칭 원문 11/20 vs 하이브리드 20/20, 원거리 결손 발견→시간-라벨로 봉합(0/5→9/10 비중첩). 비용 이득은 짧은 턴 세계서 미검출(정직 보수화) |
| D22 | 정렬 완결 사건축 3원 개정+배선(07-31) | 시점 필터 완결의 짝 — **필터가 연 사건축은 정렬도 연다**(`{event}_earliest/_latest`, 대표축 무표 latest/oldest와 대칭). 근거 e9 페어드(U2 현행 vs U3 개정, run c803cbb6): 사건정렬-임박 0→5/5·여유 2→5/5·**calling 10/10**(valid_until_* 정확 선택)·회귀 셀(대표축·수치) 무열화(confusability 0). U2 임박 0/5가 대표축 latest/oldest 오용 = 필터-정렬 비대칭 직접 증거. 배선: `resolve_sort` event_columns 인자 + 감사 `sort_completeness_gaps` 대칭 확장(필터 `{event}_from`⇒정렬 요구) + **13도구 일괄**(부분변경 금지 R3, client_voucher 레퍼런스). 게이트: 감사 정렬갭 0·boot·resolve_sort 스모크·unit 20/20·h00 9/10(run 33cd34a9 — mt_fabricate 3→1/3 하락은 laguna 선언-정지 노이즈, tools=[] 미호출·정렬 무관). **재론**: subscription 6축(정렬 14값)=규칙 대칭 노출이나 센터당 1행 실무 희소 + 다축 confusability 미실측 — 실사용 실측 시 필터·정렬 동반 축소. naming.md 정렬 완결 3원표가 정본. **프로덕션 실측(07-31)**: h08(신설 8종 calling 10/10·형제 confusability 0·subscription 6축 다축 current_period_end_earliest 3/3, run 02167551) + h09(사건축 정렬 발화→정렬값 유도 10/10, completed 축만 발화 애매성 2/3, run 4011cc72). e9 클린룸+h08 다축+h09 프로덕션 = 사건축 정렬 3중 실증 |
| D23 | 투영 축 감사 배선 완료 + agent permission 정책 확정(07-31) | **투영**: 참조 name 투영(D14) 회귀 가드를 신규 참조 도구 4종(payment·member_working_time·client_voucher·center_voucher)에 배선 — facade default 모듈 상수 추출(`DEFAULT_FIELDS`) + `TOOL_PROJECTION` 등록 + `created_by`(accounts) WAIVER. 감사 line154 "별도 배선 대기" 해소. scr은 `"ref"` 마커라 감사 미인식(런타임 보장 유지). **permission**: 구독·크레딧 조회 counselor 노출이 미결로 보였으나 HTTP router가 이미 정책 구현 — read=`require_membership`(전 멤버)·write=`_ADMIN_ROLES`(관리자). CLAUDE.md "manager=결제·운영"은 운영 write 제한이지 조회 차단 아님. agent read 도구(write 불가)의 permission=None은 이 정책 정확 상속(버그 아님). **현행 유지 확정**(사용자 결정) — 관리자 전용 전환은 HTTP·web·permission 코드까지 표면 전체라 별도 이니셔티브 |
| D20 | 유토피아 규칙 prod 배선 3건(07-30) | R 템플릿 24종(_R_DESC)+권한줄 제거(rules-complete E1: 거절 30%→0%, run 86b60992)+voucher 등재 2종(query_client_voucher·query_center_voucher — 유토피아 e6~e8 실증, 봉투 v2·유도-완전 파라미터). 게이트: 감사 신설분 갭 0·unit 20/20·h00 10/10(run f956086f — mt_wrong_tool 0/3→2/3 회복). query 표면 24→26 |
| D21 | 조회 불변층 완결 — 10종 일괄 등재(07-30, 사용자 "모두 한 번에·규칙 엄수") | 표면 26→34: payment·schedule_change_request·member_working_time·operating_time·subscription·credit_balance·message_log·assessment_package 8종 + **voucher 2종 TOOL_MODEL 소급 등록**(D20 등재 시 누락 발견 — 감사가 스킵 중이었음). 병렬 4에이전트(opus, Fable5 한도로 1차 전멸 후 재개)가 자기 모듈만, 공유파일(TOOL_MODEL·catalog `_R_DESC`·audit WAIVER)은 통합자 단독. 감사 필터·관계·정렬·시점·커스텀 **갭 0**(시각→NON_FILTERABLE·발송연계 3종→WAIVER·keyword 별칭 확장(reason·message 등)·scr `requested_from`→`requested_start_from` 교정). **h00 10/10 무회귀**(run 1190048d — mt_wrong_tool 2/3→3/3, 표면 +8에도 confusability 무해 실증). h07 6/8(run 9e98900b — earliest_expiry 2/3→0/3은 도구선택 3/3 정확한 비교추론 노이즈, valid_until 비대표 시점 정렬축 부재가 근인 → B4). 투영축(참조 name) 감사배선은 후속(audit line135 "신규 편입 tool 투영 별도 배선" 상정 — handler PROJECTION+런타임으로 보장) |
| D26 | gemini 멀티홉 약점 = **모델 문제(2.5-flash 한정), route 아님** — D25 "route 탓" 정정(07-31, h15 E4~E7) | D25는 프롬프트로 2.5-flash를 못 고침을 밝혔고 "OpenRouter가 signature 안 줘서 멀티홉 불가"로 **라우트를 지목**했으나, 후속 실험이 정정. **E5**(순수입력 봉투 실측, LLM 0콜): 회기 조회가 `client_names`(이름만·id없음)만 투영 + 모델이 `fields=["client_id"]`로 필드명 헛짚어 enrichment까지 꺼짐 = 투영 완결 결함 성분 존재. **E6**(네이티브 직결 gemini-flash-latest, 최소 도구 3종): projection-gap 3hop을 automatic function calling으로 **5홉 3/3 완주**, thought_tok 45~55 — 단 2.5-flash 네이티브 차단(신규 폐기)이라 flash-latest 사용 = route/model 미분리. **E7 결정타**(gemini-3.1-flash-lite, **기존 OpenRouter**·실 42-tool·실DB, run 13375cca): h07 하드 **6/8**(2.5-flash 3/8) — **hv_3hop_batch 0/3→2/3**(session→client→client 실제 스레딩, hops 4~6)·**mt_refine 0/3→3/3**. 같은 OpenRouter 경로에서 신형 모델이 멀티홉 완주 = **route 무죄, 2.5-flash 모델 결함이 원인**. **∴ Vertex·네이티브·signature 셋업 불필요** — 싼 OpenRouter 그대로 모델만 올리면 됨. **모델 지형**: laguna 7/8(~$0.09/$0.18·최강·최저가) > 3.1-flash-lite 6/8($0.25/$1.50·빠름·going-forward·안죽음) > 2.5-flash 3/8(죽는 모델, ~2026-10 폐기). 잔여 공통 약점 = 발산 fan-out(laguna도 약함). **모델 접근 실측**: 2.5-flash는 Developer API 신규 404·Vertex ADC는 됨(양 프로젝트)이나 ~10월 폐기 — 붙잡을 이유 없음. 비용(OpenRouter): going-forward 풀flash(3.5-flash $1.5/$9.0)는 2.5-flash의 5배·laguna의 17배, lite($0.25/$1.5)가 절충 |
| D27 | group_by 선언 dim 재도입 + prod 오케 gemini (2026-08) | **D11 부분 대체**. 전면 차원복제(07-25) 롤백은 유지. 재도입 = 기존 `query_*` + `group_by` enum(필터 대칭 dim) · G-impl application 조합(list→bucket / 축×count) · **SQL GROUP BY 신설 금지**. when=E5 refined(진행포함전체 vs 진행중 vs ~별). 미선언 축은 병렬 tool_call. 표면 SSOT: `group_by_dims.py`·agent-query.md. **모델**: `NEW_AGENT_LLM_MODEL=google/gemini-3.1-flash-lite` · `ASSISTANT_RESPONDER_MODEL=""`(이중 호출 끔). SYSTEM 건수절·tool when 정합. |
| D25 | gemini 다홉 약점 프롬프트-개선 loop 종결(07-31, h15 — 전건 반증) | D24 유보의 처방후보 중 "프롬프트로 gemini 초하드 다홉을 고칠 수 있나"를 gemini 공식문서 3가설로 검증. **전부 무효/유해**: **H1**(reasoning ON 복원, e1 run 7f7a56b9) — 3hop·mt_refine 0/3 그대로, 지연만 3.0→3.7s(반증). **H3**(agentic SYSTEM "다단계 완주" 3지시, e2 run 8c60c5cc) — **회귀**: 통과 base 3/8→agentic 1/8, 다홉은 1홉 후 `ask_user` 남발("되묻지 말라"의 역효과)·mt_refine은 없는 도구 `full_query_..._by_client_name_json` **환각**("이어서 호출"이 composite 발명 유발), 정상축(sum 2→1·amount 3→1)까지 저하. **H2**(thought-signature hop 보존, e3 배선진단) — **불성립**: 우리 파이프라인은 raw_content를 재전송(llm.py:256, stripping 0)하나 **OpenRouter Anthropic-compat이 reasoning 켜도 gemini signature를 content 블록으로 안 돌려줌**(off/on 모두 hop0 tool_use→hop1 text 동일, reasoning 블록 0). **결론**: gemini는 OR 경유로 3hop을 "도구 1회→정지·답변"으로 처리, 프롬프트로 2번째 홉 유도 불가 = **능력·라우팅 천장**. "오답 1차 처방은 schema지 system 소설 아님" 재확인(H3 회귀가 실증). laguna 멀티홉 유지(D24 경화). **재개 조건**: gemini **직결 API**(OR 아님)면 native SDK가 signature 자동유지 → H2가 그 route서 성립 가능, 단 라우팅 신설이 선결(프롬프트 아님) |
| D24 | 성능·모델 탐색 종합(07-31, gemini 채택 **유보**) | **캐시**(h10~h11): hosted Poolside=vLLM prefix cache 동작 — `usage.cached_tokens` 불량지표(~32 고정), **판정은 latency로**(cold 7.2s→warm 1.8s). 프롬프트 접두(SYSTEM+도구 52k자)가 요청·역할 무관 100% 바이트동일 = 전역 공유(우리 몫 완료 — 권한줄 제거 D20이 접두 균일화에 기여). 변동 20%=hosted 멀티테넌트 evict(통제불가, dedicated만 근본해결). **병목**(h12): 입력 prefill(도구 42종·in 42k) 지배 — laguna draft 최소화 무효(62→32tok 줄여도 wall 6.5→6.2 무변). 입력축소가 본질 레버. **모델비교**(h13~h14): gemini-2.5-flash vs laguna — 지연 **2.5~4.6배↓**(3.7s·꼬리 12배↓)·답품질 우수(수치누수·마크다운목록·grounding **0/30**)·일반 프로덕션하드 동급(h00 9/10)·관계2홉 우세. **단 초하드 다홉 자율스레딩 붕괴**(h07 4/8 vs laguna 7/8 — 3홉 배치서 2번째 홉을 "확인해드리겠습니다" 선언/되묻기로 회피 = agency 결함, 멀티턴 재조회 행판독 실패). gpt-5.6-luna 탈락. **유보** — gemini 채택 = 실사용 다홉 비중·비용(유료 월 $1~4.7k) 결정. 처방후보 = 하이브리드(gemini 주력+초하드 laguna 폴백) or 다홉 흡수보완(facade 역조인이 gemini 스레딩 약점을 서버가 대신 메움). laguna는 무료(한시)·초하드 견고(persistence RL) |

## 3. 기각 계보 — 다시 밟지 말 것

- **그래프/온톨로지 프롬프트 주입**: 2회 기각(9도구·24도구) — 조회 전 "없음" 날조 유발, 순해악. 관계 정보는 결정 지점(파라미터·boundaries)에만.
- **서버 그래프 스티치(실행 합성)**: capable 모델이 흡수 0으로 2~5홉 완주(29/30) — 지을 이유 소멸. 멀티홉 벽은 소~중 1:N서 미재현.
- **group_by 전면 표면(07-25 차원별 복제 +1,360줄)**: 롤백 유지. **재도입은 D27** — 선언 dim·기존 query enum·application 조합(SQL GROUP BY 아님). 전 모듈 빈 슬롯·새 집계 tool 금지.
- **composite/체인 도구 28종**: selection 붕괴의 원인이었던 길. 흡수는 기존 query 필터로.
- **문구·커널·gloss로 순위 튜닝**: 재현되는 효과는 능력(cover) 토글뿐 — 순위는 노이즈 폭 안. N≤10 순위 판정 무의미(CI ±30%p).
- **자료-주도 responder 프롬프트 격화**: 현행과 동급(수치누수 1/3 동일) — "자료에 없는 수치 금지" 지시를 gemini가 1/3 어김. 문구 아닌 코드(grounding)가 답.
- **gpt-5.6-luna 오케스트레이터**(h13 E2): 출력폭발(out 457~2900tok)·도구반복(같은 조회 3회 연속)로 laguna보다도 느림(20.9s). 저가($0.1/$0.6)에도 부적합.
- **gemini 다홉 약점 프롬프트 개선**(h15, D25): reasoning ON(무효)·agentic SYSTEM 보강(회귀+도구환각+ask_user 남발)·signature 보존(OR이 signature 미노출로 불성립). **주의: D25의 "라우팅 천장" 결론은 D26이 정정** — 프롬프트로 못 고친 건 2.5-flash 모델 천장이지 route 문제 아니었음. 신형 3.1-flash-lite는 같은 OpenRouter로 멀티홉 완주(E7). gemini 직결/Vertex 셋업은 불필요(모델만 올리면 됨).
- **laguna draft 최소화로 decode 완화**(h12): "decode 병목" 가설 반증 — draft 62→32tok 줄여도 laguna wall 무변(입력 prefill 지배). 입력축소가 본질.
- **Poolside hosted `cached_tokens` 지표 신뢰**(h10): 항상 ~32 고정인 불량지표 — "캐시 무용" 초기 오판의 원인. 캐시 판정은 반드시 latency로(h10 E3 반전).
- **프롬프트 접두 안정화로 hosted 캐시율 개선**(h11): 접두는 이미 100% 안정·공유 — 우리 몫 완료. 변동은 hosted evict(환경)라 앱단 최적화 무의미. dedicated만 근본.
- **tool_choice=any 강제·max_tokens 상향·keywords 보강·reasoning on**: 전부 무효 또는 악화 실측.
- **draft 축소·보고형 마감**: 정보 이득 ~0(responder가 이미 도구 결과 원본 수신) + 폴백 품질 추락 + 거절 턴 뉘앙스 소실.

## 4. 방법론 원칙

- **페어드(같은 런) 비교만 유효** — baseline 런간 드리프트 25~40%p. 능력(cover)>순위(ranking).
- **처방은 프롬프트보다 코드** — 출력단 코드(sanitize·renderer·guard)는 100% 집행, 문구는 1/3~25% 저항.
- **판정은 인자 품질까지** — "도구를 불렀나"만 채점하면 빈 인자 호출 함정을 놓침(D8 실증).
- **검증 계단**: import/collection → boot → **lifespan(JOB_HANDLERS import — boot가 못 잡는 사각)** → e2e → 프론트 빌드 → WUI. 커밋 자립성은 `commit-tree-verification`(메모리) 절차.

## 5. 성능 백로그 (우선순위순)

| P | 문제 | 실측 | 처방 |
|---|---|---|---|
| P1 | ~~Poolside 429 파도~~ **직결 전환으로 해소**(07-28) | 직결 20페어 연속 429 0회 vs 경유 페어 6/20 소실 | 잔여: 직결 스트리밍 v1 미지원(논스트림) — UX 요구 시 SSE 어댑터 |
| P2 | ~~자발 포기 성향~~ **h06으로 해소**(07-28) | 경유 산물로 판명 — 직결 선언-정지 100%→10%(실질 ~0)·gave_up 0/64 | 가드는 잔여 방어 존치. 소항목: 가드 에코(재요청 문구 앵무새 — responder 흡수 추정, WUI서 관찰) |
| P3 | ~~부분-실행 날조 사각~~ **h03 종결**(07-28) | 날조 발현이 경유 산물로 판명 — 직결 0/20(전 런 근거완주). 가드 사각 자체는 코드 사실로 존치(문서화) | grounding 불채택(~200줄 절약). 재론: P7 계기판에서 수치 날조 신호 시 h03의 설계로 재개 |
| P4 | ~~조회 미완 되돌림 부재~~ **실질 해소**(07-28) | 전제였던 선언-정지가 h06으로 소멸(직결 실질 ~0) — 되돌림 인프라의 대상 부재 | 재론: P7 계기판에서 미완주 신호 시 |
| P5 | ~~히스토리 무상한~~ **D19로 구조 해소**(07-29) | 과거 턴이 요약 블록 하나로 접힘 — 토큰 상한 자연 확보 | 잔여: 긴 대화(5턴+) 요약 품질 실사용 관측 |
| P6 | responder 직렬 +1.4s | p50 실측 | 보류 — llm_calls로 지연 분해(laguna 마지막 hop vs responder) 후 판단 |
| P7 | 운영 계기판 부재 | 진단 전부 수동 psql | scripts/agent_daily_metrics.py: 이륙률·hop 소진율·권한환각/되물음 프록시·responder 폴백률·토큰/비용·캐시적중 p50/p95 |
| P8 | ~~화면 날조 잔존~~ **가드 배선으로 해소**(07-28, D16) | 전건 차단 0/20·완주 무열화·오탐 0/5, clean 자연 발현 30% 실재였음 | WUI 실연만 잔여(P11과 함께) |
| P9 | responder 수치 누수 재실측 | 경유 시절 1/3 — 직결에서 draft 날조가 소멸했으니 누수 원천 축소 추정, 미실측 | 직결 페어드 프로브 1회(h04 lab 재사용) |
| P10 | 직결 캐시 효율 미실측 | system→user 접기가 캐시 프리픽스를 바꿈 — cached_tokens 실측 0건 | h00 E2에 cache_read 지표 병기 |
| P11 | 직결 HITL 재개 호환 미실연 | bookmark wire 스냅샷의 재번역 왕복 — 설계상 커버, 실연 0회 | WUI 실연 시 ask→재개 1회 포함 |

## 6. 열린 문제

- 자발 포기(P2) 근본 — laguna 후속 버전/모델 재평가 조건: 발현률이 가드 커버 후에도 체감 임계 초과 시.
- 흡수 확장(J4 일정·J5 담당) — client 골든 회귀 비용(-20%p 리스크) 측정 전 금지(D12).
- 렌더링 충실도(조회≠서술 누락) — summary 투영 후 재실측 미완.
- 전 실측이 mock·N=5~10 — 프로덕션 기대치 아님. P7 계기판이 첫 실사용 지표.

## 7. 재현·관측

```bash
cd apps/api
uv run python -m labs.assistant.env.prod_lab --golden 1        # --domain/--hard/--multiturn/--summary
uv run python -m labs.assistant.env.stats                      # 가설 판정 통계 자가검증
uv run python labs/assistant/hypotheses/assistant/h01-prefill-history-contamination/e3/lab.py record  # 세계 녹화(실DB 1회)
uv run python labs/assistant/hypotheses/assistant/h01-prefill-history-contamination/e3/lab.py run     # 격리 페어드(확증)
uv run python labs/assistant/hypotheses/assistant/h04-prompt-resistance/e1/lab.py 3                   # responder 프롬프트 A/B
# 턴 원본(도구 흔적) 진단
docker exec saas-postgres psql -U imomtae -d imomtae -tAc \
  "SELECT e.ev->>'tool', substr((e.ev->'args')::text,1,120) FROM assistant_turns t,
   jsonb_array_elements(t.events) WITH ORDINALITY e(ev,ord)
   WHERE t.conversation_id='<id>' ORDER BY t.created_at, e.ord"
```
