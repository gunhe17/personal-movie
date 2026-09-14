DONE — 신규 화면 컷 **9개 전부 완료**  ※C1.9는 `status/c19-formsend.md`에서 해소

# screen-pipeline — v2 신규 화면 컷

단계: ①기능 실재 ②시나리오 표현 ③목 구성 ④scene-prep 리허설(exit0) ⑤capture-service 촬영 ⑥motion-stage 무대
갱신: 2026-09-14 새벽

| 컷 | 단계 | 상태 | 비고 |
|---|---|---|---|
| C1.7 필드가 잡힌 서식 | ①실재 ②표현됨(`FormFillBody` 원본 PNG 오버레이) ③목: LLM 아님 — **추출 결과를 심었다**(`c17-form-asset.mjs`) ④리허설 exit0 10.0s ⑤`s01_web_formfields_t03` 12.00s 충실도 99.8% 드롭0 ⑥`C1.7_imac.mp4` | **완료** | 노컷 6.71–8.19. t01은 체크칸 오버레이가 세로로 늘어나 폐기, t02는 meta 타임코드가 역행해 폐기 |
| C1.9 보호자 폰에 뜬 그 서식 | ①실재(제품 수정 후) ②표현됨 ③목 불필요 ④리허설 exit0 ×3 ⑤`s01_web_formsend_t01` · `s01_phone_formfill_t01`(phone 프로필) · `s01_web_formreturn_t01` ⑥`C1.9_phone.mp4` · `C1.9_send_imac.mp4` · `C1.9_return_imac.mp4` | **완료** — `status/c19-formsend.md` | 아래 §C1.9는 **해소된 기록**이다. 수신자 버그는 고쳤고, 서명은 연출하지 않는다(자막 "작성까지 돌아온다") |
| C3.6 앱에서 변경 요청 | ①실재 ②표현됨 ③목 불필요 ④무대 검증(idb 수동 실행 후 DB 확인) ⑤`s03_phone_request_t02` 29.10s 드롭0 ⑥`C3.6_phone.mp4` | **완료** | 노컷 12.59–24.59. `schedule_change_requests` 1행 pending + 상담사 알림 3건 실제 생성 |
| C5.5 공유문 — 검토·발행 | ①실재 ②표현됨 ③목: `production_ai_configs.note_share_guardian` + llm-stub ④리허설 exit0 10.1s ⑤`s05_web_share_t02` 13.13s 충실도 99.0% 드롭0 ⑥`C5.5_imac.mp4` | **완료** | 노컷 5.71–7.24. t01은 덧쓴 줄이 문단 한가운데 끼어 폐기 |
| C5.6 도착 | ①실재 ②표현됨(**케어보드 경로** — 아래) ③목 불필요 ④무대 검증 ⑤`s05_phone_arrive_t02` 21.45s 드롭0 ⑥`C5.6_phone.mp4` | **완료** | 노컷 ~13–20. C5.5가 전달한 바로 그 글이 보호자 앱에 뜬다 |
| C6.4 케이스 분석 | ①실재 ②표현됨 ③목: `production_ai_configs.case_analysis` + llm-stub ④리허설 exit0 15.3s ⑤`s06_web_analysis_t01` 17.25s 충실도 99.7% 드롭0 ⑥`C6.4_imac.mp4` | **완료** | 노컷 4.18–12.53(생성 소요). 시드 3회기를 **12회기**로 늘렸다 |
| C6.5 제출 서류 파생 | ①**제품에 구현했다**(사람 결정) ②표현됨 ③목: `production_ai_configs.note_derive_form` + llm-stub ④리허설 exit0 8.7s ⑤`s06_web_derive_t01` 10.37s 드롭0 ⑥`C6.5_imac.mp4`(4초 트림) | **완료** — `status/c65-derive.md` | 아래 §C6.5는 **해소된 기록**이다(목업 연출안은 쓰지 않았다 — 진짜 화면을 찍었다) |
| C7.5 잔여 | ①실재 ②표현됨 ③목 불필요 ④무대 검증 ⑤`s07_phone_remaining_t01` 15.03s 드롭0 ⑥`C7.5_phone.mp4` | **완료** | 노컷 ~7–13. `9/12회 · 9회 남았어요` |
| C7.6 바우처 단가 문답 | ①실재 ②표현됨 ③목: `_mocks/c76-voucher.json`(check-mock 통과) ④리허설 exit0 9.7s ⑤`s07_web_voucherask_t01` 11.87s 충실도 99.2% 드롭0 ⑥`C7.6_imac.mp4` | **완료** | 노컷 4.96–8.11. **계정이 김원장(admin)** — 아래 |

## 선택본

| 컷 | 촬영본 | 무대 |
|---|---|---|
| C1.7 | `v2/s01-접수서류/raw/s01_web_formfields_t03.mov` | `v2/_mockups/C1.7_imac.mp4` |
| C3.6 | `v2/s03-일정/raw/s03_phone_request_t02.mov` | `v2/_mockups/C3.6_phone.mp4` |
| C5.5 | `v2/s05-보호자/raw/s05_web_share_t02.mov` | `v2/_mockups/C5.5_imac.mp4` |
| C5.6 | `v2/s05-보호자/raw/s05_phone_arrive_t02.mov` | `v2/_mockups/C5.6_phone.mp4` |
| C6.4 | `v2/s06-증명/raw/s06_web_analysis_t01.mov` | `v2/_mockups/C6.4_imac.mp4` |
| C6.5 | `v2/s06-증명/raw/s06_web_derive_t01.mov` | `v2/_mockups/C6.5_imac.mp4` |
| C7.5 | `v2/s07-정산/raw/s07_phone_remaining_t01.mov` | `v2/_mockups/C7.5_phone.mp4` |
| C7.6 | `v2/s07-정산/raw/s07_web_voucherask_t01.mov` | `v2/_mockups/C7.6_imac.mp4` |

manifest는 `movies/26IRDEMO/manifest.csv` 한 파일이다(장면별이 아니다). 위 일곱 + 폐기 테이크 전부 등록돼 있다.

## 브리프와 제품이 어긋난 자리 (편집이 알아야 한다)

| 컷 | 브리프 | 제품 |
|---|---|---|
| C3.6 | "변경 요청 → **사유** → 보냄" | 자유 입력 사유 칸이 없다. 그 자리는 **변경 내용 확인 시트**다 — `기존 9월 18일 16:00 → 변경 9월 22일 17:00` + `이 시간으로 요청하기`. 오히려 화면이 더 명확하다 |
| C5.6 | "알림 → **기록 탭** → 오늘 회기의 글" | `기록` 탭은 **보호자가 쓰는 일기**다. 센터가 전한 글은 **케어보드 → 진행중인 활동 → 자세히 보기 → 상담 기록 → `상담 내용 보기`** 에 붙는다(`counseling-case/[caseId].tsx:490` `hasShare`). 보호자용 앱 알림은 이 로컬 시드에 안 생긴다(`notifications`의 수신자는 센터 구성원이다) |
| C7.6 | 주인공 상담사 | **김원장(admin)으로 찍었다.** `바우처 관리`는 `write:center`가 필요해 상담사에게 안 열린다(`settings/vouchers/+layout.svelte` `MenuAccessGuard menuId="voucherManage"`). 배역도 이쪽이 맞다 — A면(C7.3)에서 공고를 형광펜으로 읽던 사람이 원장이다 |
| C1.7 | "폰 카메라로 스캔 → 필드가 잡힌다" | **추출 과정은 안 찍는다**(cuts.json의 check 그대로). 결과 화면만이고, 그 결과는 심었다(§C1.7) |

## C1.9 — 차단 (두 가지, 둘 다 제품 쪽) — **해소됨 2026-09-14, `status/c19-formsend.md` 참조**

**① 서식 발송이 수신자를 만들지 못한다 (제품 버그).**
`FormSendModal.svelte:111-120`이 `selectedClients.map(c => ({ phone: (c.guardian_phone ?? '').trim() })).filter(r => r.phone)` 로 수신자를 만드는데,
그 목록의 원천인 `GET /centers/{id}/clients`의 `ClientSummary`(`apps/api/app/modules/client/profile/schemas.py:169-193`)에 **`guardian_phone` 필드가 없다**.
있는 것은 `guardian_name` · `guardian_relationship`뿐이고, 보호자 연락처는 다른 응답(`ClientWithRelationsSummary.primary_guardian_phone`, `profile_facade.py:366-383`)에만 있다.
결과: 누구를 골라도 `recipients`가 빈 배열 → **`연락처가 등록된 내담자를 선택해주세요` 스낵바에서 끝나고 POST 자체가 안 나간다**(실측: `form_sends` 0행 · API 로그에 요청 없음).
고칠 자리는 둘 중 하나다 — `ClientSummary`에 `guardian_phone`을 더해 list에서 채우거나, 모달이 `primary_guardian_phone`을 읽게 하거나.
이 스킬은 제품을 고치지 않는다(`scene-prep` §7). 고친 뒤 `v2/_scripts/c19-formsend.mjs`를 그대로 돌리면 된다 — 셀렉터와 조작은 이미 맞춰 뒀다
(`발급` → 수신자 검색 → 행 선택 → **`적용`**(이걸 안 누르면 칩이 안 담긴다) → `전송`).

**② 서명 UI가 없다 (미구현).**
`forms/fill/[instanceId]`가 쓰는 `FormFillBody.svelte`는 `signature` 타입을 **일반 `<input type=text>`로 그린다**(원본 오버레이·목록 폴백 둘 다).
`apps/web`·`apps/admin`·`apps/mobile*` 어디에도 서명 패드(canvas)가 없다. API는 있다(`POST …/forms/{id}/signature`, `modules/form/signature/`).
그래서 컷의 자막 **"서명까지 돌아온다"는 지금 제품으로 지킬 수 없다.** 서명을 뺀 자막으로 바꾸거나, 서명 패드가 붙은 뒤 찍어야 한다.

그 외는 다 있다 — `POST /centers/{id}/forms/templates/{tid}/sends`(`modules/form/send`), 4자리 인증(`forms.verification_code`),
`/forms/fill/{instanceId}`의 인증→작성→제출, 발급 내역의 `미작성`/`작성완료`(`view-model.ts:174-183`).
폰 절반은 **`--profile phone`(SPEC v7 · 1170×2532)** 로 찍으면 된다 — 네이티브 앱이 아니라 폰용 공개 웹 화면이다.

## C6.5 제출 서류 파생 — 목업으로 연출한다면 (**폐기된 안** — 제품에 구현해 실제 화면을 찍었다, `status/c65-derive.md`)

테이블(`counseling_note_derivations`)만 있고 핸들러·라우터·화면이 전부 없다. 제품에 없는 화면이므로 촬영 규칙 1의 대상이 아니라
**`motion-stage`의 HTML 무대**로 만들어야 한다. 만든다면 이렇게 한다 — ① 왼쪽은 지어내지 않고 **C5.5·C6.4에서 이미 찍힌 확정 일지 화면의 실제 프레임**을 스틸로 깔고,
② 오른쪽에 바우처 제출 양식 한 장을 제품 토큰(`app.css`의 폼 규격 · 괘선 36px · Typography 변형)으로 그린 HTML을 세우고,
③ 두 문서의 **같은 문장**(예: 12회기 진행 요약 한 줄)을 커서가 오가며 같은 색으로 잇고,
④ 오른쪽 칸이 왼쪽 문장에서 **복사돼 들어오는 모션**(0.4초 이동 + 페이드)으로 채워지게 한다 — "다시 치는 것이 아니라 파생된다"가 논지다.
전제 둘: 왼쪽이 실제 촬영 프레임이어야 거짓말이 되지 않는다는 것, 그리고 **"개발 예정" 라벨을 편집에서 사람이 얹는 것**(v1 s03에서 정한 규칙 — 제품·스크립트에 넣지 않는다).
안 만들면 C6.3(양식 세 장)도 같이 뺀다 — 답이 없는 문제는 제시하지 않는다.

## 새로 만든 것

| 파일 | 무엇 |
|---|---|
| `v2/_scripts/c17-form-asset.mjs` | **좌표의 정본.** 스캔한 종이 PNG(`/tmp/saas-storage/form-templates/f0c17000…/page-1.png`)와 `사전기록지` 서식 스키마를 **한 표(BOXES)에서** 같이 뽑는다. 돌리면 `c17-form-setup.sql`을 다시 쓴다 |
| `v2/_scripts/c17-form-setup.sql` | (생성물) `사전기록지` 서식 1건. 이름이 그대로여야 내담자 상세의 `템플릿으로 작성`이 찾는다 |
| `v2/_scripts/c17-form.mjs` | C1.7 조작 |
| `v2/_scripts/c19-formsend.mjs` | C1.9 웹 절반 조작 (제품 버그가 풀리면 그대로 쓴다) |
| `v2/_scripts/c36-phone-setup.sql` | 2026-09-18(금) 16:00 회기 13회차 + 앞 판 변경 요청 삭제 |
| `v2/_scripts/c36-request.mjs` | C3.6 폰 조작 (idb) |
| `v2/_scripts/c55-share-setup.sql` | 원문에 임상어 심기(K-CBCL T 68 · F93.8 R/O) + **전달문 본문 고정** + 전달문·분석 비우기 |
| `v2/_scripts/c55-share.mjs` | C5.5 조작 |
| `v2/_scripts/c56-arrive.mjs` | C5.6 폰 조작 (idb) |
| `v2/_scripts/c64-analysis-setup.sql` | C00002를 **12회기**로(3~11회기 신규 · 시드 3건 재배치) + `total_sessions` 16 + **분석 본문 고정** |
| `v2/_scripts/c64-analysis.mjs` | C6.4 조작 |
| `v2/_scripts/c75-remaining.mjs` | C7.5 폰 조작 (idb) |
| `v2/_scripts/c76-voucher.mjs` | C7.6 조작 |
| `_mocks/c76-voucher.json` | C7.6 목 대본 (규칙 5대로 `_mocks/`에 둔다 — `check-mock.mjs`가 여기만 본다) |
| `v2/_scripts/phone-link.mjs` | **내담자 앱 무대.** 보호자 이수진 계정 생성 → 앱 연동 초대 코드 → 연결 확정 → 시뮬레이터 AsyncStorage 주입까지. 전부 제품 API다 |
| `v2/_scripts/_probe-*.mjs` | 위치·응답 실측용(캡처 안 함) |

## 환경 — 다음 사람이 알아야 할 것

```bash
# 떠 있어야 하는 것
docker: saas-postgres(3501) · redis(3505)
API 3502   cd _tool/saas-center-platform/apps/api && DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 3502
web 3503   cd _tool/saas-center-platform && pnpm dev:web
llm-stub   node movies/26IRDEMO/_scripts/llm-stub.mjs      # :3599
batch 워커 cd apps/api && DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib .venv/bin/python -m app.worker.batch
```

- **batch 워커가 없으면 C6.4가 영원히 `processing`이다.** 케이스 분석은 `ai:jobs:batch` 큐를 탄다. 공유문(C5.5)은 요청형이라 워커가 필요 없다.
- **`nohup`으로 워커·API를 띄우지 마라** — macOS가 `DYLD_*`를 벗겨 WeasyPrint(`libgobject`)에서 즉사한다. 로그에 경고만 남고 프로세스가 없다.
- 시드 되돌리기 `.claude/skills/scene-prep/scripts/reset-seed.sh --yes` · 스냅샷 `_seed/saas-2026-09-14.json`(sha256 `2bfdf7ce09b1`).
  **재시드하면 앱 계정·센터 연결도 사라진다** — `CAP_PASSWORD=… node v2/_scripts/phone-link.mjs`를 다시 돌린다.
  `local-saas-admin.json`도 `reset-seed.sh`가 안 만든다(기본이 counselor1뿐) — `CAP_ACCOUNTS="counselor1 admin"`을 주거나 `login.mjs`로 따로 만든다.
- **촬영 도구 변경 하나** — `capture.mjs` · `capture-phone.mjs`의 `sceneNo`를 `path.basename(args.scene)`에서 뽑게 고쳤다.
  v2는 `--scene v2/s05-보호자`처럼 하위 경로로 오는데 옛 코드가 `'v2/s05'`를 파일명에 넣어 `raw/v2/...`로 나갔다. SPEC은 건드리지 않았다.

### 내담자 앱(mobile-client) — 이 저장소에서 처음 세웠다

v1은 "내담자 앱은 찍지 않는다"로 결정돼 있었다(v1/STATUS.md). v2의 폰 컷 셋이 그 결정을 뒤집으므로 전부 새로 세웠다.

```bash
cd _tool/saas-center-platform/apps/mobile-client
APP_VARIANT=development API_URL=http://localhost:3502 npx expo prebuild --platform ios --no-install --clean
APP_VARIANT=development API_URL=http://localhost:3502 npx expo run:ios --configuration Release --device F6685208-9C34-4057-AAAC-71D26601D555
```

- **`API_URL`을 안 주면 Release 빌드가 운영 API로 붙는다** — `src/shared/api/client.ts:32-34`에서 `__DEV__`가 false라 `prodApiUrl`을 쓴다. `app.config.ts:85` `extra.apiUrl`이 이 값을 굽는다.
- 번들 `kr.mindscope.client.dev` · 스킴 `mindscope-client-dev`. **`phone-stage` 스킬은 전문가 앱(`kr.mindscope.app.dev`) 전용이라 여기엔 못 쓴다** — 대신 `v2/_scripts/phone-link.mjs`가 같은 일을 한다.
- **idb는 깔려 있는데 PATH 밖이다**: `export PATH="$HOME/Library/Python/3.9/bin:$PATH"`. 그리고 `idb ui … --udid booted`는 **안 먹는다** — 실제 UDID를 줘야 한다(`capture-phone.mjs`는 알아서 풀어 준다).
- 폰 조작 스크립트의 시그니처는 **`export default async function steps(p)`** 하나다(웹의 `(page, h)`가 아니다). 틀리면 `Cannot read properties of undefined (reading 'beat')`로 테이크 하나를 태운다(s03 t01이 그렇게 죽었다).
- `phone-link.mjs`를 두 번 돌리면 연결 확정이 400(`이미 다른 프로필에 연결된 아이예요`)인데 **정상이다** — 연결은 이미 서 있다.

### 함정 (이번에 새로 밟은 것)

- **`h.type(sel, text)`는 요소 가운데를 클릭하고 타이핑한다**(`human.mjs:79-87`). 긴 textarea에 덧쓰면 문단 한가운데가 쪼개진다.
  끝에 붙이려면 `h.click` 뒤에 `page.keyboard.press('Meta+a')` → `ArrowRight` → `page.keyboard.type(...)`. `End`·`Meta+ArrowDown`은 이 순서에서 소용없다(C5.5 t01·리허설 두 판으로 확인).
- **`button:has-text("X")`는 부분 일치다.** `분석 실행`이 `경과 분석 실행`에도 걸려 모달 확인 버튼 대신 바깥 버튼을 눌렀고, POST가 아예 안 나갔다(리허설은 "클릭 성공"으로 지나간다). `>> nth=-1`로 갈랐다.
- **`:has-text`를 쉼표로 나열하면 안 먹는다** (`'li:has-text(X), button:has-text(X)'`). 하나씩 쓴다.
- **내담자 상세는 창 폭이 아니라 유효 폭으로 반응형을 판정한다** — `responsive.width - (careBoardOpen ? 400 : 0) < BREAKPOINTS.xl`(`clients/[clientId]/+page.svelte:287`). 1600−400 = 1200 < 1280이라 **케어보드를 접지 않으면 좌측 프로필(그 안의 `사전기록지`)이 통째로 숨는다.**
- **수신자 드롭다운은 `적용`으로 커밋한다** — 행만 누르면 칩이 안 담긴다(C1.9 조작에서 한 판을 잃었다).
- **`meta`의 `steps[].t`가 역행할 수 있다** (C1.7 t02: 5.09 → 3.73). 영상 자체는 멀쩡했지만 타임코드를 편집에 못 쓴다. **검토 때 단조 증가를 같이 본다.**
- **Xcode 빌드·Spotlight 색인 중에는 촬영하지 않는다** — 60Hz 기록기가 굶는다. 이번엔 `corespotlightd`·`mediaanalysisd`가 새 `.mov`를 색인하느라 올라왔다. 촬영 전 `ps -Ao %cpu,comm -r | head`.
- **앱 일정의 `메모`는 화면에 그대로 뜬다** — setup SQL의 멱등 표식을 `schedules.memo`에 넣었다가 앱 상세에 `c36-setup`이 찍혔다. 고정 UUID로 바꿨다.

### 데이터에 남은 것 (촬영이 실제로 만든 것)

기관 0 · 내담자 7 · 상담케이스 2(C00002는 **12회기 완료 + 13회기 예정**, 계약 16회기) ·
`counseling_note_shares` 1(published) · `counseling_case_analyses` 1(completed · 12회기) ·
`schedule_change_requests` 1(pending) · `notifications` 3(일정 변경 요청) ·
`form_templates` 15(시드 14 + 사전기록지) · 보호자 앱 계정 1(`guardian.lee@mindscope.com`) + `center_links` 1(active).
