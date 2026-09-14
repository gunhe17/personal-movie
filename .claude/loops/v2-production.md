# 26IRDEMO v2 제작 원장

시작 2026-09-14. 정본 샷리스트: https://claude.ai/code/artifact/cfdfc0ed-412c-4ff9-ba1b-9bdda54ba48c (초안 6) → `movies/26IRDEMO/v2/_production/cuts.json`

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
