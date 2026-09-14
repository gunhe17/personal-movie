# 26IRDEMO v2 제작 원장

시작 2026-09-14. 정본 샷리스트: `movies/26IRDEMO/v2/_production/cuts.json`
스토리보드: `movies/26IRDEMO/v2/_production/storyboard.html` → https://claude.ai/code/artifact/872af4c1-7632-4580-805b-40c7f93d4134 (옛 링크 cfdfc0ed…는 없어졌고, 다른 조직 사본 363659a1…는 이 계정에서 못 고친다)
절차 표시줄: `movies/26IRDEMO/v2/_assets/steps/` — `steps.json` 고치고 `node build.mjs [SN]`. 컷별 배치는 cuts.json의 `steps` 필드
컷 폴더: `v2/sNN-cN-이름/` — 스토리보드 컷 번호와 1:1 (s01-c9 = C1.9). 무대 컷은 mp4 · spec json이 이 안에, 내린 컷은 `v2/_dropped/`. 아래 컷 원장 표의 `_mockups/` 경로는 옛 기록이다

## 목표
- 46컷 전부 "완료" 또는 "차단(사유)". 차단은 사람 결정이 필요한 것만.
- AI 컷 26: 첫 프레임 준비(프롬프트 린트 통과) → 생성 4장(2K, Kling o3 · 100크레딧/컷) → 채택 1장. **생성은 Artlist MCP 인증 뒤에만.**
- v1 재사용 10 + 카드 2: 무대 영상(mp4) 산출.
- 신규 화면 8: 기능 실재 확인 → 목 → scene-prep 리허설 → capture → 무대 영상.

## 지표 (매 루프마다 갱신)
| 종류 | 전체 | 준비 | 완료 | 차단 |
|---|---|---|---|---|
| ai | 26 | 0 | 26 · pick 26 | 0 |
| v1 | 9 | 0 | 9 | 0 (C3.6→new) |
| new | 9 | 0 | 9 | 0 |
| card | 2 | 0 | 2 | 0 |

## 차단 목록
- ~~Artlist MCP 승인 대기~~ → 인증됨(사용자). 이 세션엔 도구가 안 붙어 `claude -p` 헤드리스로 호출한다.
- ~~C6.5 사람 결정~~ → 사용자 결정: 양식 작성 화면은 있으니 "일지에서 초안 작성" 버튼 흐름을 사본에 구현해 찍는다.
- 제품 사본 결함(촬영용 사본에서만 고침): ClientSummary.guardian_phone 누락 · 서명 패드 UI 없음(API만) · forms에 client_id 없음. 업스트림 반영은 별도.

## 에이전트
| 이름 | 범위 | 상태 |
|---|---|---|
| ff-prep | AI 26컷 프롬프트 준비·린트 | ✅ 완료 26/26 · 린트 0 실패 |
| ff-gen | AI 컷 생성 (헤드리스 드라이버 `_production/gen.mjs`) | ✅ r1 25 · r2 7 · r3 1 = 33회 · 3,300크레딧 |
| ff-review | AI 17컷 판정 | ✅ pick 12 · 재생성 5 |
| c19-formsend | C1.9 제품 결함 수정 후 촬영 | ✅ 사본 5곳 수정(guardian_phone 스키마·매퍼 등) · mp4 3 |
| c65-derive | C6.5 일지→바우처 양식 초안 흐름 구현·촬영 | ✅ 사본에 API·모달·버튼 추가(마이그레이션 없음) · mp4 1 |
| c43-record-v2 | phone.mjs `until` 추가 · C4.3 녹음~전사 재촬영 · C4.4 단축 | 실행 중 (09-14) |
| v1-mockups | v1 10컷 + 카드 2컷 무대 영상 | ✅ 11 mp4 · C3.6 차단(테이크 없음) |
| screen-pipeline | 신규 화면 9컷 (직렬) | ✅ 7 mp4 · C1.9 차단 · C6.5 결정 대기 |

## 컷 원장
| 컷 | 씬 | 이름 | 종류 | 목표 산출물 | 지표 | 상태 | 비고 |
|---|---|---|---|---|---|---|---|
| C0.1 | S0 | 일곱 칸 | card | _mockups/<id>_<stage>.mp4 | mp4 길이 일치 | ✅ _mockups/C0.1_cards.mp4 | |
| C1.1 | S1 | 전화 한 통 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_04 → first-frame.png | |
| C1.2 | S1 | 같은 것을 CRM에 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_02 → first-frame.png | |
| C1.3 | S1 | 명단은 사진으로 온다 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_04 → first-frame.png | |
| C1.4 | S1 | 보내고, 받고, 출력해 꽂는다 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_04 → first-frame.png | |
| C1.5 | S1 | 설문 쓰러 한 번 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_01 → first-frame.png | |
| C1.6 | S1 | 검사 당일, 다시 출력 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_01 → first-frame.png | |
| C1.7 | S1 | 필드가 잡힌 서식 | new | raw 테이크 + meta + manifest → _mockups/<id>_<stage>.mp4 | 리허설 exit 0 · 촬영 meta+manifest · mp4 | ✅ raw+meta+manifest → _mockups/C1.7_imac.mp4 | |
| C1.8 | S1 | 통화 한 마디 | v1 | _mockups/<id>_<stage>.mp4 (v1 테이크 트림 + 무대) | 구간 일치 · 노컷 보존 · 1920×1080 mp4 | ✅ _mockups/C1.8_imac.mp4 | |
| C1.9 | S1 | 보호자 폰에 뜬 그 서식 | new | raw 테이크 + meta + manifest → _mockups/<id>_<stage>.mp4 | 리허설 exit 0 · 촬영 meta+manifest · mp4 | ✅ raw 3테이크(send·phone formfill·return)+meta+manifest → _mockups/C1.9_phone.mp4 (+send_imac·return_imac). 서명 패드 없어 자막 "작성까지 돌아온다" | |
| C1.10 | S2 | 바로링크 | v1 | _mockups/<id>_<stage>.mp4 (v1 테이크 트림 + 무대) | 구간 일치 · 노컷 보존 · 1920×1080 mp4 | ✅ _mockups/C1.10_imac.mp4 | |
| C2.1 | S2 | 같은 반응을 두 번 친다 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r2_04 → first-frame.png | |
| C2.2 | S2 | 새벽 3시, 지난 파일을 복사해 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_02 → first-frame.png | |
| C2.3 | S2 | 마인드봄 — 받아쓰기 | v1 | _mockups/<id>_<stage>.mp4 (v1 테이크 트림 + 무대) | 구간 일치 · 노컷 보존 · 1920×1080 mp4 | ✅ _mockups/C2.3_imac.mp4 | |
| C2.4 | S2 | 종합보고서 초안 | v1 | _mockups/<id>_<stage>.mp4 (v1 테이크 트림 + 무대) | 구간 일치 · 노컷 보존 · 1920×1080 mp4 | ✅ _mockups/C2.4_imac.mp4 | |
| C3.1 | S3 | 문자 한 통 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r2_03 → first-frame.png | |
| C3.2 | S3 | 달력에서 지운다 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r2_01 → first-frame.png | |
| C3.3 | S3 | 답이 늦다 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_04 → first-frame.png | |
| C3.4 | S3 | 전화 둘, 부재중 하나 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r2_04 → first-frame.png | |
| C3.5 | S3 | 다시 쓴다 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick C3.2 r2_01 재사용 → first-frame.png | |
| C3.6 | S3 | 앱에서 변경 요청 | v1 | _mockups/<id>_<stage>.mp4 (v1 테이크 트림 + 무대) | 구간 일치 · 노컷 보존 · 1920×1080 mp4 | ✅ raw+meta+manifest → _mockups/C3.6_phone.mp4 | |
| C3.7 | S3 | 겹침 확인 → 승인 | v1 | _mockups/<id>_<stage>.mp4 (v1 테이크 트림 + 무대) | 구간 일치 · 노컷 보존 · 1920×1080 mp4 | ✅ _mockups/C3.7_imac.mp4 | |
| C4.1 | S4 | 회기 사이 두 줄 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_01 → first-frame.png | |
| C4.2 | S4 | 밤 9시 40분 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_03 → first-frame.png | |
| C4.3 | S4 | 세 번째와 네 번째 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_04 → first-frame.png | |
| C4.4 | S4 | 녹음 | v1 | _mockups/<id>_<stage>.mp4 (v1 테이크 트림 + 무대) | 구간 일치 · 노컷 보존 · 1920×1080 mp4 | ✅ _mockups/C4.4_phone.mp4 | |
| C4.5 | S4 | 화자별 전사 | v1 | _mockups/<id>_<stage>.mp4 (v1 테이크 트림 + 무대) | 구간 일치 · 노컷 보존 · 1920×1080 mp4 | ✅ _mockups/C4.5_imac.mp4 | |
| C4.6 | S4 | 일지 초안 — 6.7초 | v1 | _mockups/<id>_<stage>.mp4 (v1 테이크 트림 + 무대) | 구간 일치 · 노컷 보존 · 1920×1080 mp4 | ✅ _mockups/C4.6_imac.mp4 | |
| C5.1 | S5 | 아이가 나온다 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_04 → first-frame.png | |
| C5.2 | S5 | 10분 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_04 → first-frame.png | |
| C5.3 | S5 | 녹음기를 끈다 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r2_03 → first-frame.png | |
| C5.4 | S5 | 저녁 8시, 전화 네 통 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r3_03 → first-frame.png | |
| C5.5 | S5 | 공유문 — 검토 · 발행 | new | raw 테이크 + meta + manifest → _mockups/<id>_<stage>.mp4 | 리허설 exit 0 · 촬영 meta+manifest · mp4 | ✅ raw+meta+manifest → _mockups/C5.5_imac.mp4 | |
| C5.6 | S5 | 도착 | new | raw 테이크 + meta + manifest → _mockups/<id>_<stage>.mp4 | 리허설 exit 0 · 촬영 meta+manifest · mp4 | ✅ raw+meta+manifest → _mockups/C5.6_phone.mp4 | |
| C6.1 | S6 | 열두 장을 넘긴다 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_02 → first-frame.png | |
| C6.2 | S6 | 기억으로 요약 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_01 → first-frame.png | |
| C6.3 | S6 | 양식 세 장 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r2_03 → first-frame.png | |
| C6.4 | S6 | 케이스 분석 | new | raw 테이크 + meta + manifest → _mockups/<id>_<stage>.mp4 | 리허설 exit 0 · 촬영 meta+manifest · mp4 | ✅ raw+meta+manifest → _mockups/C6.4_imac.mp4 | |
| C6.5 | S6 | 제출 서류 파생 | new | raw 테이크 + meta + manifest → _mockups/<id>_<stage>.mp4 | 리허설 exit 0 · 촬영 meta+manifest · mp4 | ✅ 사본에 "제출 서류 초안 작성" 구현(LLM stub) → s06_web_derive_t01 → _mockups/C6.5_imac.mp4 | |
| C7.1 | S7 | 세는 손가락 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_04 → first-frame.png | |
| C7.2 | S7 | 종이 한 장을 올린다 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_01 → first-frame.png | |
| C7.3 | S7 | 두 번째 형광펜 | ai | v2/sNN-cN-이름/prompt.md 린트 통과 → r1/ 4장 → first-frame.png | check exit 0 · 생성 4장 · pick 1 | ✅ pick r1_03 → first-frame.png | |
| C7.4 | S7 | 노쇼 → 차감 | v1 | _mockups/<id>_<stage>.mp4 (v1 테이크 트림 + 무대) | 구간 일치 · 노컷 보존 · 1920×1080 mp4 | ✅ _mockups/C7.4_imac.mp4 | |
| C7.5 | S7 | 잔여 | new | raw 테이크 + meta + manifest → _mockups/<id>_<stage>.mp4 | 리허설 exit 0 · 촬영 meta+manifest · mp4 | ✅ raw+meta+manifest → _mockups/C7.5_phone.mp4 | |
| C7.6 | S7 | "이 바우처 단가가 얼마죠?" | new | raw 테이크 + meta + manifest → _mockups/<id>_<stage>.mp4 | 리허설 exit 0 · 촬영 meta+manifest · mp4 | ✅ raw+meta+manifest → _mockups/C7.6_imac.mp4 | |
| C8.1 | S8 | 한 줄 · 로고 | card | _mockups/<id>_<stage>.mp4 | mp4 길이 일치 | ✅ _mockups/C8.1_logo.mp4 | |

## 로그
- 2026-09-14 원장 생성. 환경: 3502 up · 3503/4502/4503 down · sckcap·ffmpeg·Chrome OK · Artlist MCP 승인 대기.
- 2026-09-14 02:11 에이전트 셋 기동: ff-prep · v1-mockups · screen-pipeline. 사용자가 Artlist 인증을 맡기로 함 — 인증되면 ff-prep 결과 위에 생성 단계(4장/컷)를 이어 붙인다.
- 2026-09-14 02:13 ff-prep 완료. 26/26 prompt.md 린트 통과. 린트에 `참조 묶음:` 주석 허용 1줄 추가(selftest 통과). C3.2·C3.5 프롬프트 동일 — 한 번 생성해 재사용할지 사람 결정. 참조 묶음 6개 기록.
- 2026-09-14 02:17 Artlist 인증 확인 — 이 세션엔 도구가 안 붙고 헤드리스(claude -p) 새 세션에는 20개 붙는다. 생성은 헤드리스 드라이버로 돌린다.
- 2026-09-14 02:21 C1.1 r1 4장 저장(100크레딧, 잔액 46,313). 판정: 글자 누출 0 · 얼굴 0 · 팔레트 OK · 4번이 최적. 좌하단 여백이 약함(수첩이 차지) — 자막은 상단 좌측 대안 검토. ff-gen 드라이버 기동(24컷 · 예상 2,400크레딧 · ~1.5h).
- 2026-09-14 02:22 v1-mockups 완료: mp4 11개(_mockups/). C3.6 폰 테이크 없음 → screen-pipeline에 신규 촬영으로 넘김. 길이 예외: C2.4 13.5s(노컷 보존) · C4.6 12.7s(노컷 전체). motion-stage에 cells 무대·logo copy 옵션 추가됨(selftest 통과).
- 2026-09-14 03:08 ff-gen 완료: 25컷 r1 4장씩(총 2,500크레딧, 잔액 43,913). C1.5 저장이 네트워크로 실패 → generationId로 복구 저장. frame.mjs save 가 실패 시 반쪽 폴더를 남기던 버그 고침(selftest 통과). 다음: 25장 컨택트 시트 육안 판정 → pick.
- 2026-09-14 03:10 육안 판정 1차: 6컷 pick. 재생성 2컷 — C3.2(달력 숫자 4/4 깨짐 → 빈 격자·타이트 크롭으로 재작성) · C3.4("to her ear"가 얼굴 클로즈업을 부름 → 수화기를 책상 위에, 달력 제거). 교훈: 사람의 상반신·귀·어깨를 언급하면 얼굴이 온다 — 손과 물건만 명명할 것. 나머지 17컷 판정은 ff-review 에이전트.
- 2026-09-14 03:17 r2 완료(200크레딧, 잔액 43,713): C3.2 빈 격자로 숫자 제거 성공(3/4) → r2_01 pick, C3.5 재사용. C3.4 수화기를 책상 위로 옮기니 얼굴 1/4로 줄음 → r2_04 pick. gen.mjs ROUND/ONLY 지원(라운드 인자 버그 수정). pick 9/26, 나머지 17은 ff-review 진행 중.
- 2026-09-14 03:23 ff-review 완료: pick 12, 재생성 5(C2.1·C3.1·C5.3·C5.4·C6.3). 패턴: 글자 있는 소품(지침서·달력·키패드·양식)은 배제절이 안 먹는다 → 프레임 밖으로 빼거나 무지 형태로 재정의. 손 개수는 세어 쓰고 나머지는 out of frame. 몸통이 여백을 먹는다 → torso out of frame.
- 2026-09-14 03:31 screen-pipeline 완료: 7컷 촬영+무대(LLM은 전부 목·stub, 실호출 0). C1.9 차단 — 제품 결함 ①guardian_phone 스키마 누락 ②서명 패드 없음. C6.5 미촬영. 새 스크립트 v2/_scripts/ 7+3, phone-link.mjs, 내담자 앱 첫 빌드(API_URL 필수). capture.mjs sceneNo 추출 수정(SPEC 불변). ff-gen r2 5컷 저장(500크레딧, 잔액 43,213) → 판정 중.
- 2026-09-14 03:32 r2 판정: C2.1·C3.1·C5.3·C6.3 pick. C5.4는 r2도 얼굴 4/4 — "a woman's right hand"+책상 맞은편이 사람을 부른다 → r3에서 사람 명사 전부 제거, 맞은편은 빈 벽으로. pick 25/26.
- 2026-09-14 03:35 C5.4 r3 pick(사람 명사 전부 제거하니 얼굴 0/4). **AI 26/26 채택 완료** — first-frame.png 26장(1920×1080). 총 33회 생성 · 3,300크레딧 · 잔액 43,113. 교훈 셋을 first-frame SKILL.md에 기록.
- 2026-09-14 04:00 c19-formsend 완료. **46컷 중 45 완료, 1 사람 결정(C6.5).** 루프 종료. 산출: first-frame.png 26 · _mockups mp4 21 · v2 raw 15테이크(meta·manifest 완비) · 크레딧 3,300 사용. 커밋 미실행(사용자 확인 후).
- 2026-09-14 08:55 C6.5 결정: 구현 후 촬영. 확인한 것 — 사본의 AI 초안(NewFormModal)은 템플릿 설계용, 양식 작성 화면(FormFillBody · forms/fill)은 실재, 일지→양식 채우기는 없음(derivation 테이블만). c65-derive 에이전트 기동.
- 2026-09-14 09:17 c65-derive 완료. **46/46 완료.** 최종: first-frame.png 26 · _mockups mp4 22 · v2 raw 16테이크 · 크레딧 3,300. 커밋·푸시로 닫는다.
- 2026-09-14 09:46 S1 재구성(사용자 지시): A 전화→카카오톡 명단(PNG 자산, AI 아님)→컴퓨터 입력→출력→설문→재출력 / B 검사 접수→서식 전달→보호자 휴대폰. 스캔·바로링크·엑셀 AI 컷 내림 → _mockups/_dropped/. 카카오톡은 메시지별 투명 PNG 5장(_assets/kakao/). 샷리스트 초안 7 · 45컷 · 4:15.
- 2026-09-14 09:59 사용자 지시 일괄 반영: S2 검사 = 검사 진행(신규 AI, s02-c0)→반응 기록→보고서 작성 / 마인드봄→보고서 작성. S3 일정 = 상담 진행(신규 AI, s03-c0) 추가, '달력에서 지운다' 제거. S4 '세 번째와 네 번째' 제거. S7 정산에서 바우처 문서(형광펜·에이전트 문답)를 S8로 분리, 엔드는 S9. 생성 2회(200크레딧, 잔액 42,913). 무대 mp4·spec 번호 재배치. 열 씬 · 45컷 · 4:15 · 샷리스트 초안 8.
- 2026-09-14 12:43 S1 A 축소(사용자 지시): 기존 절차 = 컴퓨터 입력(C1.3) → 설문(C1.5) → 출력(C1.4) 세 컷만. 전화(C1.1)·카카오톡 명단(C1.2)·당일 재출력(C1.6) 내림 → `v2/_dropped/`(컷 원장은 `_dropped/s01-cuts-dropped.json`). 절차 표시줄 S1-기존 3단계로 재빌드. cuts.json 42컷. storyboard.html·briefs/S1.md는 아직 옛 6컷.
- 2026-09-14 12:50 카카오톡 명단 부활(사용자 지시): 따로 컷이 아니라 **C1.3 컴퓨터 입력에 합쳤다** — 편집에서 우측에 메시지 PNG를 얹는다. 자산은 `v2/s01-c3-컴퓨터입력/kakao/`(옛 s01-c2 폴더 그대로). C1.3 3.0s → 5.0s. 절차 표시줄은 3단계 그대로.
- 2026-09-14 12:55 C1.1 전화 한 통 복구(사용자 지시 — 나머지는 안 바꾼다): `v2/s01-c1-전화한통` 되돌림 · cuts.json C1.3 앞에 다시 넣음. `steps`는 null — 절차 표시줄은 3단계 그대로라 전화 컷엔 막대가 없다. S1 A = C1.1 → C1.3 → C1.5 → C1.4.
- 2026-09-14 15:0x C3.1 상담 진행 제거(사용자 지시 — 번호 재배치 없음, 이것만): cuts.json에서 뺌 · 폴더 `v2/_dropped/s03-c1-상담진행` · 컷 원장 `_dropped/s03-cuts-dropped.json`. C3.2~C3.7 번호·폴더·steps 필드는 그대로(절차 표시줄 S3-기존은 여전히 5단계 — '상담 진행' 칸이 남아 있다). 스토리보드 아티팩트 반영: S3 30s · 마흔네 컷 · 4:12.
- 2026-09-14 16:2x~18:4x frame-to-video 스킬 신설 · S1~S3 AI 컷 11개 영상화(Kling 3.0 · 3146 · 5,200크레딧). 채택본 `CN.N_ai.mp4` = 컷 길이 · 30fps · 절차 표시줄 합성(무대 컷과 같은 완성본). 기록 `status/s01-i2v.md` · `status/s02-s03-i2v.md`.
- 2026-09-14 18:5x S1 기존 절차 표시줄에 C1.1 포함(사용자 지시): `steps.json` S1-기존 = 전화 문의 → 컴퓨터 입력 → 설문 방문 → 출력 · 회수(4단계) · `node build.mjs S1` · 3단계판 `v2/_dropped/steps-S1-기존-3단계`. cuts.json C1.1 step1 · C1.3 2 · C1.5 3 · C1.4 4(tail). 네 컷 `pick` 재합성.
- 2026-09-14 19:0x S3 기존 절차 표시줄 = C3.2 · C3.3 · C3.4만(사용자 지시): 문자 수신 → 빈 시간 확인 → 보호자 통화(3단계) · '상담 진행' · '일정 재작성' 칸 뺌. C3.4가 tail(99_out) · **C3.5는 컷으로 남고 steps null**(표시줄이 나간 뒤). 5단계판 `v2/_dropped/steps-S3-기존-5단계`. 네 컷 `pick` 재합성.
- 2026-09-14 22:04 C4.3 재작업 착수(사용자 지시). 진단: 현재 컷이 회기 선택 시트에서 멈춰 "아무 일도 일어나지 않는다" — 제품에는 녹음 중 실시간 전사 버블(RecordingSheet.tsx:590-666)과 처리 단계 라벨(constants.ts:30-35)이 있다. 그리고 **phone.mjs에 `until`이 없어** SPEC v8의 "hold 대신 until"을 폰만 못 지킨다(전환마다 고정 2.1초). 셋을 함께: ① phone.mjs until(idb 접근성 트리 폴링) ② C4.3 녹음~전사까지 재촬영(t03, ~13s, 전사는 llm-stub 목) ③ C4.4 6.6s→4s 단축.
- 2026-09-14 22:2x **S5·S6 재구성(사용자 지시) — 보호자로 열고 제출처로 넓힌다.** v1 §07「회기 후 — 자동 상담 일지」가 이미 둘을 한 문단에 묶고 있었고(① 10분·녹음기 ② 같은 회기를 양식마다 다시), 코드도 같은 편이다: `runtime/guardian_share`와 `runtime/note_derivation`이 **같은 `counseling_note`를 부모로 하는 형제**고(note_derivation/service.py 머리 주석이 "guardian_share 와 같은 규칙"이라고 적는다), 버튼 둘이 `InlineJournalEditor.svelte`의 같은 툴바에 같은 위계·같은 게이트(`hasTransferMaterial`)로 선다. 촬영본도 이미 같은 회기다 — 이하준 C00002 **12회기 = 2026-09-06 10:00**, note `2e544bd5…`에 share 1 · derivation 1(DB 확인). 제출처 폭은 **학부모·바우처 둘까지만**(사용자 결정) — 재촬영 없음.
  - **옮긴 것**: C6.3 양식 세 장 → **C5.7**(A 5단계) · C6.5 제출 서류 파생 → **C5.8**(B 3단계). 번호는 스토리보드 규칙대로 씬의 마지막 뒤에 붙였다. S6은 C6.3·C6.5를 비운다(C3.1 선례).
  - **폴더·파일명은 안 건드렸다** — `s06-c3-양식세장/` · `s06-c5-제출서류파생/C6.5_imac.mp4` 그대로. raw 파일명(`s06_web_derive_t01`)과 manifest 행을 지키기 위해서다(촬영 규칙 3·4). 컷 폴더가 번호를 뒤따르지 않는 선례는 `s01-c3-컴퓨터입력/kakao/`에 있다.
  - **B 순서**: C5.5 공유문 → C5.6 도착 → C5.8 파생. 보호자로 연 문제를 보호자 화면에서 닫은 **다음** 넓힌다.
  - 절차 표시줄 재빌드: S5-기존 4→**5**단계 · S5-우리 2→**3** · S6-기존 3→**2** · S6-우리 2→**1** (`steps.json` · `node build.mjs S5 S6`). S6의 옛 단계 파일 넷 삭제.
  - S5 29.8s→**36.8s** · S6 28.3s→**21.3s** · 총 길이 불변 **4:28.7**. cuts.json 42컷 유지.
  - 겸사겸사 고친 것: storyboard.html의 낡은 길이 **8컷**(C2.4·C2.5·C5.5·C5.6·C6.4·C7.3·C7.4·C8.2)과 씬 헤더 타임코드·상단 막대·합계(4:15→**4:29**). C5.6 situation을 제품 실제 경로(케어보드 → 진행중인 활동 → 상담 기록)로 — 옛 "알림 → 기록 탭"은 `c56-arrive.mjs` 머리가 아니라고 못박은 경로다.
  - 남은 것: **C5.7 i2v 미제작**(S5 AI 5컷 전부 motion.md 없음). `c55-share-setup.sql:3` 주석이 아직 "3회기"다(실제 타깃은 12회기로 맞다).
- 2026-09-14 22:5x **S5 축약 · S6·S8 폐지(사용자 지시).** ① C5.4 저녁 8시 전화 네 통 내림 — A는 녹음기(C5.3)에서 양식 재작성(C5.7)으로 바로 간다. ② B는 **둘**로: 「보호자에게 전달 → 앱에서 본다」(C5.5 발행 + C5.6 도착이 **한 단계**를 같이 쓴다 — C5.6은 `head` 없이 `01.png`에 머문다) · 「증빙 양식 채움」(C5.8). ③ **S6 증명·슈퍼비전** 전부(C6.1·C6.2·C6.4) · **S8 바우처 문서** 전부(C8.1·C8.2) 내림.
  - 씬 번호는 고정 — **S6·S8 자리는 비운다**. 남는 씬 여덟: S0 S1 S2 S3 S4 S5 S7 S9. 컷 번호도 고정이라 S5는 C5.1·C5.2·C5.3·C5.7 | C5.5·C5.6·C5.8이고 **C5.4는 빈 번호**다.
  - `_dropped/`로: 컷 폴더 6개(s05-c4 · s06-c1 · s06-c2 · s06-c4 · s08-c1 · s08-c2) · 절차 표시줄 4트랙(steps-S6-* · steps-S8-*) · briefs-S6.md · briefs-S8.md. 기록은 `s05/s06/s08-cuts-dropped.json`. **raw 폴더(s06-증명)는 그대로 둔다** — C5.8의 원본(`s06_web_derive_t01`)이 거기 있고 촬영 규칙 4다.
  - 절차 표시줄 재빌드: S5-기존 5→**4**단계 · S5-우리 3→**2**단계(`node build.mjs S5`). steps.json에서 S6·S8 제거 → 남은 12트랙.
  - **36컷 · 여덟 씬 · 3:55.1** (42컷·4:28.7에서). S5 33.8s. AI 19컷(영상 13) · 무대 17컷.
  - 남은 것: **C5.7 i2v 미제작** — S5의 AI 4컷(C5.1·C5.2·C5.3·C5.7) 전부 `motion.md`가 없다. i2v 안 한 AI 컷은 이제 S5 4 + S7 2 = **6개**.
- 2026-09-14 22:4x c43-record-v2 완료(`status/c43-record-v2.md`). ① **`phone.mjs`에 `until` 추가** — `idb ui describe-all` 폴링, 웹 `h.until`과 같은 계약(마크에 `(+N.Ns)`, 타임아웃이면 던진다). SPEC_PHONE v2→**v3**(`timing.settle: 300` 추가), 웹 `SPEC` v8은 그대로. 폰 컷은 이제 전환을 고정 `hold`로 넘기지 않는다. ② **C4.3 재촬영** `s04_phone_record_t03.mov`(22.52s · 드롭0 · `--retake-of t02`) → `C4.3_phone.mp4` **5.2–18.6 · 13.4s**: 필드노트 홈 → 바로 녹음 → 연결 선택 시트 → 그 회기 → 전사 버블 세 줄 → 종료 → 음성 전사 · AI 보정 → 정리 완료. 전사는 **촬영용 데모 라우트**(`field-note/demo.tsx`, 제품 컴포넌트 그대로 · 상태만 대본)라 **진짜 STT·LLM 0회, llm-stub도 안 띄웠다**. ③ **C4.4 6.6s→4.0s** — 재촬영 아니라 같은 테이크에서 구간만(4.7–8.7). ④ 제품 사본 3파일 수정(`home.tsx` 갈림길을 시트 뒤로 · `demo.tsx` 종료·정리 단계 · `RecordingScreen.tsx` 접근성 둘 — 껍데기 Pressable이 화면 절반을 한 덩어리 라벨로 삼키고 있었다). ⑤ 재시드로 사라진 **윤도현**을 `v2/_scripts/c43-client.sql`로 되살렸다(s01 판에서 한 줄만). ⑥ **브리프와 어긋난 자리**: 종료 후 단계는 제품에 `음성 전사 → AI 보정` **둘뿐**이다(`executor.py:61`) — 요약·`상담일지 작성 중`은 파이프라인이 아니라 상세의 온디맨드(C4.5)라 연출하지 않았다. S4 29s→**32s** · 합계 4:29→**4:32**.
- 2026-09-14 22:5x~23:1x **S5 AI 4컷 영상화 완료 — S5는 이제 일곱 컷 전부 영상이다.** Kling 3.0 base(349 · modelId 3146) · pro 1080p · 무음 · 16:9 · duration 4초(컷 3초 + 편집 여유 1초) · **컷당 400 크레딧 · 합 1,600**(잔액 33,313 → 31,713). 이 대화 세션에 Artlist 도구가 붙어 `gen` 헤드리스 대신 직접 업로드→견적→생성→폴링했다(`artlist.mjs verify`는 종료 2지만 MCP 도구는 살아 있다 — 스킬의 "인증은 기기마다" 전제와 어긋나니 다음에 확인할 것).
  - **넷 다 `Locked-off tripod shot`**(규칙 3 — 손 동작 컷). 넷 다 t1 채택, 재생성 0.
  - 린트가 잡은 것 하나: C5.3의 `the recorder **face**` → 사람 명사 오탐이 아니라 규칙대로 걸렸다. `the recorder casing`으로 고쳐 통과.
  - 판정(시트 + SSIM). 프로젝트 기준선은 S1~S4의 통과 밴드 0.81~0.91, 실패 사례 C1.1 t1 = 0.57:

    | 컷 | 시작↔끝 | 입력↔첫 | 입력↔끝 | 판정 |
    |---|---|---|---|---|
    | C5.1 아이가 나온다 | 0.861 | 0.869 | 0.783 | ✓ 운동화가 문턱을 넘는다 |
    | C5.2 10분 | 0.861 | 0.871 | 0.797 | ✓ 손이 펴지고 파일은 고정 |
    | C5.3 녹음기를 끈다 | **0.779** | 0.878 | 0.743 | △ **빨간 불이 꺼진다**(컷의 논지) · 카메라 고정 · 다만 녹음기가 주머니로 눌려 내려가 지시보다 움직임이 크다 |
    | C5.7 양식 세 장 | 0.896 | **0.935** | 0.868 | ✓ 넷 중 가장 충실 |

  - **교훈: `sheet.png`의 1번 칸은 입력 첫 프레임이라 2번 칸과 나란히 보면 드리프트로 착시가 난다.** C5.7을 눈으로 "흘렀다"고 봤는데 실측은 정반대(가장 충실)였다. **시트 인상보다 SSIM 세 쌍을 먼저 재고, 의심되면 첫·끝 프레임을 vstack으로 직접 볼 것.**
  - 완성본 넷 다 1920×1080 · 30fps · 3.0s · 무음 · S5-기존 절차 표시줄 합성.
  - 스토리보드 S5 카드 넷 갱신: 썸네일은 **표시줄 없는 t1 중간 프레임**(막대는 `.ov`가 얹는다 — S1~S4와 같은 규칙), 태그 `AI 영상 · Kling 3.0`, 경로 `CN.N_ai.mp4`. 지표 **AI 영상 17/19**.
  - 부수 정리: `s06-c3-양식세장` → **`s05-c7-양식세장`** 로 폴더·rN 파일·meta.json 이름 변경. 러너 `cutOf()`가 폴더명에서 컷 번호를 뽑기 때문에 안 바꾸면 `C6.3`을 찾다 죽는다. 이 컷은 raw도 manifest 행도 없는 AI 컷이라 촬영 규칙과 무관하다. (`s06-c5-제출서류파생`은 raw가 있어 그대로 둔다 — C5.8은 무대 컷이라 이 러너를 안 탄다.)
  - 남은 AI 영상: **S7 둘**(C7.1 세는 손가락 · C7.2 종이 한 장을 올린다).
- 2026-09-14 23:2x **C5.8 번호 정리 — 그리고 B쪽 무대 셋의 표시줄이 낡았던 것을 찾았다.** 폴더 `s06-c5-제출서류파생` → **`s05-c8-제출서류파생`**, `C6.5.json`/`C6.5_imac.mp4` → `C5.8.*`. 정리하려고 스펙을 열었더니 **`C6.5.json`의 `steps.dir`이 `../_assets/steps/S6-우리`** — 내가 앞서 `_dropped/`로 옮긴 트랙이었다. 거기서 나머지가 드러났다: **C5.5 · C5.6 · C5.8 세 mp4가 전부 21:13에 구워졌고, 절차 표시줄은 22:19~22:33에 바뀌었다.** 즉 셋 다 옛 막대(공유문 검토·발행 / 보호자 도착, S6-우리 2/2)를 달고 있었다. 이름만 바꿨으면 틀린 막대가 그대로 남았다.
  - 스펙 셋 고치고 **셋 다 다시 구웠다**: C5.5 `S5-우리 head 00_in → hold 01` · C5.6 **`hold 01.png`만**(C5.5와 1단계를 같이 쓰니 전환이 없다 — `render.mjs:324`의 `filter(k => raw.steps[k])`가 head 생략을 받는다) · C5.8 `S5-우리 head 01-02 → hold 02 → tail 99_out`. 확인: C5.5·C5.6은 ①활성, C5.8은 ①완료·②활성.
  - 셋 다 3840×2160 · 30fps · 8.4s / 9.4s / 4.0s.
  - **촬영본은 안 건드렸다** — `raw/s06_web_derive_t01.mov`는 이름 그대로다(촬영 규칙 4: raw는 덮어쓰지도 지우지도 않는다). 파일명의 `s06`은 "S6 작업 때 찍었다"는 사실이고 컷 번호가 아니다. `manifest.csv` 28행의 폴더 열만 `v2/s06-c5-제출서류파생` → `v2/s05-c8-제출서류파생`로 고쳤다.
  - cuts.json `source` · briefs/S5.md · storyboard.html 경로 갱신. 스토리보드 썸네일은 막대가 안 들어간 프레임이라 그대로 쓴다(화면 내용·구간 불변).
  - **새 검사 추가**: 무대 spec의 `steps.dir`/`head`/`hold`/`tail`이 cuts.json의 `steps`와 일치하는지, `screen` 원본이 실재하는지 — 전부 통과. 절차 표시줄을 바꾸면 그 씬의 무대 mp4를 **전부 다시 구워야 한다**는 것이 이번 교훈이다.
- 2026-09-14 23:1x **폰 컷에서 어디를 눌렀는지 보이게 — 탭 링.** 사용자가 C4.3을 보고 "어디를 클릭하는지 모르겠다". 시뮬레이터 터치 표시는 켜져 있었지만 작고 흐린 회색 점이라 4K 무대 안에서 안 보였고, 더 근본적으로 **`phone.mjs`가 라벨로 탭하면 좌표를 버렸다**(`find()`가 이미 계산해 둔 `{x,y}`를 마크에 안 넣었다). 고친 순서: ① `mark`에 네 번째 인자 `xy` — `tap`은 `x·y`, `swipe`는 `x2·y2`까지. `target`(라벨)은 그대로라 **기존 meta 계약이 안 깨진다**(필드가 늘 뿐). ② 포인트↔픽셀 배율이 meta에 말로만 있었다 → `SPEC_PHONE.capture.pxPerPoint: 2`(sckcap `--scale`이 이 값을 쓴다). **SPEC_PHONE v3→v4** · `capture.md` 규칙 8 · capture-service SKILL.md 같이 고쳤다(웹 SPEC v8은 안 건드렸다).
  - `render.mjs` 폰 무대에 `taps`(촬영 meta 경로 또는 `[{t,x,y}]`) · `tapScale` · `tapRadius` · `tapDur`. 링 애니메이션을 straight-RGBA 원본 프레임 한 파일(≈14프레임·2MB)로 굽고 탭마다 `tpad`로 시각만 밀어 얹는다 — **Chrome을 한 번도 더 안 띄운다.** 좌표는 **눈이 아니라 계산** — 합성이 촬영본을 슬롯에 앉히는 그 식(cover 배율 + crop 오프셋)을 그대로 풀었다(4K 폰 무대는 `f = 1.0000`). 흰 띠 양옆에 잉크 테를 둘렀다 — **흰 원만 그리면 밝은 앱 화면에서 사라진다**(녹음 화면은 검고 종료 시트는 희다). `--selftest`에 넷째 판: 탭 있는 판/없는 판을 굽고 PSNR로 링이 실제로 픽셀을 바꿨는지 본다.
  - 재촬영 셋(전부 `--retake-of`, 앞 테이크는 그대로): **C4.3 t04**(13.4s 유지 · 탭 링 4 · `c43-pre-record.sql` → 촬영 → `c43-restore.sql` 복구 확인) · **C7.4 t02**(4.8s 유지 · 링 1) · **C5.6 t03**(9.4s 유지 · 링 1). 셋 다 헤드리스 리허설 exit 0 뒤에 찍었고 진짜 LLM·STT는 안 불렀다.
  - **C3.6만 보류.** 14회기 스케줄이 DB에 없고, 되살리는 `c37-approve-setup.sql`이 이하준 클라이언트를 **다른 보호자 계정에 다시 묶는다** — 지금 C5.6·C7.4가 서 있는 연결이다. 컷 하나 때문에 다른 두 컷의 DB를 뒤집지 않았다(사유는 `_production/status/phone-tap-marker.md`).
  - 겹친 일: C5.6.json을 내가 읽은 뒤 옆 작업이 **절차 표시줄을 `hold 01.png`만으로 고쳤다**(S5 정리). 내 판이 그걸 덮어써서 다시 맞추고 재합성했다 — 같은 파일을 둘이 만질 때는 굽기 직전에 다시 읽는다.
  - 원장: cuts.json(세 컷 `source`·`segment`) · briefs S4·S5·S7 · storyboard.html 썸네일 셋. 길이·타임코드는 안 바뀌었다(합계 4:32 그대로).
- 2026-09-14 23:2x **C5.2 「10분」 내림(사용자 지시).** 논지를 바꾼다 — 10분이라도 듣는 경우가 아니라 **그 10분조차 없는 경우**에 무게를 싣는다. A는 회기 종료(C5.1) → 보호자 녹음(C5.3) → 양식 재작성(C5.7) **3단계**. B는 그대로(보호자에게 전달 = C5.5+C5.6 한 단계 · 증빙 양식 채움 = C5.8).
  - `_dropped/s05-c2-10분` · `s05-cuts-dropped.json` 기록. 절차 표시줄 S5-기존 4→**3**단계 재빌드, 옛 4단계 파일(03-04.mov · 04.png) 삭제.
  - **35컷 · 3:52.1** (36컷·3:55.1에서). S5 30.8s. cuts.json `case`·`flow`·C5.3 caption을 새 논지로 고쳤다("설명조차 없는 날에는 — 가방 속 녹음기").
- 2026-09-14 23:4x **C5.3 · C5.7을 5초로(사용자 지시).** 3초에 하단 자막 + 어머님 독백 말풍선을 같이 읽힐 수 없어 길이를 늘렸다.
  - **재생성 없음(0크레딧).** t1 테이크가 4.04초라 그대로는 `video.mjs pick`이 거부한다(컷 길이보다 짧음). t1을 **`setpts=1.25*PTS`로 5.04초**로 늘려 `t1/..._t1-5s.mp4`를 만들고 그걸 채택했다 — 둘 다 잠긴 카메라에 느린 손동작(버튼 누르기 · 양식에 쓰기)이라 25% 감속이 눈에 안 띈다. 눈에 걸리면 `video.mjs call --duration 6`으로 다시 뽑으면 된다(컷당 400크레딧).
  - **C5.1도 다시 합성했다** — 길이는 3.0초 그대로지만 옛 4단계 표시줄이 구워져 있었다. 이제 S5 AI 세 컷 모두 **3단계 표시줄**(1 회기 종료 → 2 보호자 녹음 → 3 양식 재작성)이 맞게 들어간다.
  - **35컷 · 3:56.1** (3:52.1에서). S5 34.8s.
  - 어머님 독백 말풍선: `s05-c3-녹음기를끈다/say/` — HTML + `render.mjs`(기존 kakao·call 자산과 같은 파이프라인). 꼬리 없음 · 태그 왼쪽 · 배치 75% x=70 y=110.
- 2026-09-15 00:2x **탭 링은 덜, 프레임은 매끄럽게 — 폰 세 컷 재촬영(C4.3 t05 · C5.6 t05 · C7.4 t05).** 사용자: "클릭 표시를 조금 덜 강조하고, 프레임의 매끄러운 진행에 신경 써서 다시." 링은 `tapRadius 42→24pt`(지름이 화면 폭의 21%→12%) · 흰 띠 알파 .92→**`tapOpacity` 0.62**(새 spec 키) · 두께 3→**`tapWidth` 2pt** · 가운데 점 삭제 · `tapDur .45→.34s` · 페이드를 **처음부터**(`1−p`). 어두운 녹음 화면과 흰 시트 양쪽에서 프레임을 직접 보고 골랐다(0.55/1.0pt는 흰 시트에서 사라졌다).
  - **"툭툭 끊긴다"는 SPEC 타이밍이 아니었다.** 둘이었다. ① `phone.mjs`가 `idb ui tap`이 **끝난 뒤** 시각을 적어서 탭 링이 0.15~0.3초 늦게, **이미 바뀐 다음 화면 위에** 폈다(t04 실측: 시트가 7.02에 서고 링이 7.15에). 호출 앞뒤의 가운데를 적는 한 줄로 고쳤다 — **SPEC_PHONE v4→v5** · `capture.md` 규칙 8 · SKILL.md(웹 SPEC v8은 안 건드렸다). ② **t04는 시뮬레이터가 굶은 테이크였다** — `notReady 0`·길이 정상인데 녹음 화면 고유 프레임이 **초당 2.7장**(t03은 56.7, 새 t05는 54.7). 원인은 **한 시뮬레이터에서 앱 둘이 같이 돌던 것** — 안 쓰는 앱을 `simctl terminate` 하니 s05도 51→188장으로 돌아왔다. 검사법을 SKILL.md **절차 6-1**로 넣었다(`mpdecimate`로 전환 구간 고유 프레임 세기).
  - `settle 300`은 **재어 보고 그대로 뒀다** — 접근성 라벨은 전환 애니메이션이 끝난 뒤(시트가 선 지 0.76초 뒤)에 뜬다. 올려도 고칠 게 없고 C4.3에서만 1초가 늘어 13.4초에 안 들어간다. `postTap`·스크립트도 안 고쳤다.
  - 완성본 **13.4 / 9.4 / 4.8초 그대로 · 35컷 3:56.1 불변.** C3.6은 이번에도 보류(시드 재링크가 C5.6·C7.4를 깬다).
  - `render.mjs`: spec의 `out`이 **CWD 기준**으로 풀려 `v2/` 루트에 떨어졌다 → spec 파일 자리 기준으로 고쳤다. 세 spec에 `"out"`을 넣어 `--out` 없이 굽어도 제자리로 간다.
  - ⚠ **작업 중 `git checkout _production/cuts.json`으로 커밋 안 된 편집을 날렸다가 storyboard.html·briefs로 되살렸다**(35컷·236.1초·S5 34.8초까지 검산 일치). 이 저장소에서 `git checkout <파일>`을 쓰지 않는다 — 커밋 안 된 작업이 상시로 떠 있다. 판단이 갈린 한 곳(C4.5 `situation`)은 `_production/status/phone-polish.md`에 적었다.
