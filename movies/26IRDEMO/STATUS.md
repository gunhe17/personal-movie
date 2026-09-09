# 진행 상태 — 26IRDEMO

**다른 세션은 여기부터 읽는다.** 아홉 장면이 지금 어디까지 와 있고, 무엇이 막혀 있고, 환경을 어떻게 세우는지.
갱신 시각: **2026-09-10 (s09에 노쇼 사유 입력을 추가해 재구성 · 리허설 재확인)**

읽는 순서: 이 파일 → `CAST.md`(배역의 정본) → 그 장면의 `sNN-*/features.md` → `notes.md`

## 한 줄 요약

촬영본은 **아직 하나도 없다.** 촬영은 마지막에 한 세션으로 몰아서 한다.
**아홉 장면 촬영 완료 (2026-09-10).** 한 세션에서 몰아 찍었고 드롭 0이다.
시드 스냅샷 `_seed/saas-2026-09-10.json`(sha256 da811077256b) · `_seed/mindbom-2026-09-10.json`(c1bfef1d732a) 위에서 찍었다.
다음은 편집이다 — 각 테이크의 `meta.json`에 `steps[].t`와 `nocut[]`이 타임코드로 들어 있다.

## 촬영본 (2026-09-10 세션)

| 장면 | 파일 | 길이 | 드롭 | 노컷 |
|---|---|---|---|---|
| s01 접수 | `s01_web_intake_t03.mov` | 44.45s | 0 | 2 |
| s02 검사 실시 | `s02_web_collect_t05.mov` | 30.43s | 0 | 5 |
| s03 채점·보고서 A | `s03_web_draft_t01.mov` | 19.07s | 0 | 1 |
| s03 채점·보고서 B | `s03_web_aireview_t01.mov` | 28.78s | 0 | 1 |
| s04 바로링크 | `s04_web_sendlink_t02.mov` | **12.67s** | 0 | 1 |
| s05 일정 | `s05_web_approve_t01.mov` | 18.27s | 0 | 1 |
| s06 필드노트 (웹) | `s06_web_fieldnote_t01.mov` | 18.07s | 0 | 1 |
| s06 필드노트 (앱) | `s06_phone_fieldnote-app_t01.mov` | 18.60s | 0 | 1 |
| s07 자동일지 | `s07_web_draft_t02.mov` | 20.47s | 0 | 1 |
| s08 케어보드 | `s08_web_careboard_t01.mov` | 24.55s | 0 | 1 |
| s09 회기·정산 | `s09_web_noshow_t01.mov` | 23.38s | 0 | 1 |

**합계 3분 52초 · 전 테이크 드롭 0 · 검은 프레임 없음.** 웹은 3200×1800, 앱은 804×1748.

화면에서 한 일이 DB에도 남았다: 기관 1 · 내담자 10(시드 7 + s01의 3) · 검사케이스 4 · 바로링크 1 ·
승인된 변경요청 1 · 노쇼 차감 1 · 일지 생성 1.

**실패 테이크 하나** — `s07_web_draft_t01`(케이스 id가 세션과 어긋나 회기 상세가 안 열림). 파일은 남겼고
t02가 `--retake-of t01`로 사유와 함께 대체한다.

## 장면별 (준비 상태)

`scene-prep` 스킬의 여섯 조건(features 근거 · CAST 축 일치 · 목 대본 통과 · 리허설 0 · 시뮬레이션+DB 확인 · 실측 노컷)을 다 채우면 **준비 완료**.

| 장면 | 축 | 상태 | 리허설 실측 | 남은 것 |
|---|---|---|---|---|
| **s01 접수** | 검사 | ✅ **준비 완료 (새 시드 재확인 09-10b)** | **15단계 20.0초** · 오류 0 (v4) | 등록 클릭이 기관 1 · 내담자 3 · 케이스 3을 실제로 만든다 — **재실행은 재시드부터** |
| s02 검사 실시 | 검사 | ✅ **촬영 완료 t05** | 24단계 28.7초 · 오류 0 · 노컷 2.2–15.2 / 15.2–26.9 | 마인드봄 · **윤도현** 로샤 `seed:yun-rorschach`(`519ea1b3-…`). 개선된 시드가 세 아이의 로샤를 다 만들어 s01→s02가 데이터로 이어진다. 반응 ① 한 줄을 **받아쓰기 자유반응**(내담자 화면+마이크)→W→카드 위 그리기→질문→방향까지. 촉구는 뺐다. **헤드 시뮬레이션 + DB 검증 통과**(자유반응·질문·W·right·영역 전부 저장) |
| **s03 채점·보고서** | 보고서 | ✅ **촬영 완료 — 테이크 둘** | A 24단계 18.4초 / B 27단계 27.4초 · 오류 0 | **화면이 둘이고 AI의 진위가 갈린다.** A `draft`(뷰어 `/clients/…/reports/…`) = **AI 초안 생성이 진짜 서버 호출**, 빈 섹션 둘이 눈앞에서 채워지고 `draft→ai_generated` 전이·감사로그까지 남는다. B `aireview`(편집기 `/examinations/…/report`) = 종합 리뷰·구간 리뷰·교차분석으로 **AI 밀도는 최고지만 백엔드가 없는 시연용**. 편집에서 둘을 이어 붙이지 말 것 — features.md 경고 |
| **s04 바로링크** | 검사 | ✅ **준비 완료 (웹만)** | 10단계 10.1초 · 오류 0 · 노컷 8.3–10.7 (**v4**) | 폰 파트는 뺐다(아래 결정 사항) |
| **s05 일정** | 회기 | ✅ **준비 완료 (웹만)** | **17단계 14.8초** · 오류 0 (절차 재구성 후 · 새 시드 09-10b) | 내담자 앱은 뺐다. 요청은 `_scripts/s05-setup.sql`, 일간·주간·월간에 뜰 일정은 `_scripts/s05-schedules.sql`(35건). 절차: 요청 확인 → 스케줄 일간→주간→**월간** → 월간에서 변동 확인으로 확정. 노컷 구간은 재구성 후 다시 잡아야 한다 |
| **s06 필드노트** | 회기 | ✅ **준비 완료** | 웹 8단계 13.0초 · 오류 0 · 노컷 3.2–10.7 | 앱(전문가) + 웹. 전사는 `_scripts/s06-setup.sql`로 넣는다(시드에 없다). 녹음 자체는 안 찍는다 |
| **s07 자동일지** | 회기 | ✅ **준비 완료** | 5단계 15.3초 · 오류 0 · 노컷 1.2–12.0 | 제품 버그(`client_ids` 누락)를 찾아 고쳤다 — 아래 |
| **s08 케어보드** | 모임 | ✅ **준비 완료** | **재구성 시드·SPEC v4: 11단계 13.0초 · 종료 코드 0 · 오류 0 · 노컷 3.2–8.8** | 404(보호자 이름 N+1)는 **제품을 고쳐 없앴다**(아래 표). 배역 김민준→이하준. 이하준 clientId `77458809-…` · 진행률 4/8 |
| **s09 회기·정산** | 회기 | ✅ **준비 완료** (사유 입력 추가 재구성) | **SPEC v4: 10단계 10.6초 · 오류 0 · 종료 코드 0 · 노컷 6.1–7.8** | 노쇼 모달의 **사유 입력 → 잠긴 회기의 사유 카드**까지 간다. 되돌리기는 `_scripts/s09-reset.sql`(행 유지 = sessionId 유지), 행 생성은 `s09-setup.sql` |

**검사 축은 순서가 있다.** s01을 먼저 돌려야 s04의 케이스(AC0002~4, 로르샤흐 + 스마트폰중독검사)가 생긴다.
s01 없이 s04를 돌리면 `바로링크 전송` 버튼 자체가 안 뜬다.

## 환경 세우기

```bash
# 1) DB · 캐시
cd movies/26IRDEMO/_tool/saas-center-platform && pnpm db:up

# 2) API (3502) — reload 쓰지 말 것(WeasyPrint가 죽는다), 드라이런 켤 것
cd apps/api && DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib \
  REDIS_URL=redis://localhost:3505/0 MESSAGING_DRY_RUN=true \
  uv run uvicorn app.main:app --host 0.0.0.0 --port 3502

# 3) 웹 (3503)
cd ../.. && pnpm dev:web

# 4) 시드·로그인 되돌리기 (사이클마다)
.claude/skills/scene-prep/scripts/reset-seed.sh --yes
```

| | |
|---|---|
| 포트 | web **3503** · API **3502** · postgres **3501** · redis **3505** |
| 계정 | 정상담 `counselor1@mindscope.com` / `test1234` · 상태 파일 `_state/local-saas-counselor1.json` |
| 시드 기준선 | 마인드스코프 아동심리상담센터 · 내담자 7 · 기관 0 · 상담케이스 2 · 검사케이스 1 · 필드노트 3 |

### 마인드봄 (s02·s03의 무대)

투사검사(로샤·HTP·SCT) 해석 보조. **saas와 연동되지 않는다** — `center_link`는 보호자 앱↔센터 연결이지 제품 간 다리가 아니다.
두 제품을 잇는 것은 `_tool/mindbom/apps/api/scripts/cast.py`의 **배역**뿐이고 정본은 saas develop 시드다(`_scripts/check-cast.py`가 점검).

```bash
cd movies/26IRDEMO/_tool/mindbom && pnpm db:up && pnpm dev:api && pnpm dev:web

# 시드 — 이 세 줄이 전부다. 순서를 지킨다
cd apps/api && uv run python -m scripts.seed \
  && uv run python -m scripts.seed_content \
  && uv run python -m scripts.seed_notifications
```

**`seed_rorschach_full`을 이 흐름에 넣지 마라** — 박지우에게 note 없는 로샤를 한 건 더 만든다(껍데기 시드 시절의 도구다).

| | |
|---|---|
| 포트 | web **4503** · API **4502** · postgres **4501** |
| 계정 | 같은 배역. 상태 파일 `_state/local-mindbom-counselor1.json` |
| 역할 매핑 | ADMIN·MANAGER→admin · STAFF→researcher · **COUNSELOR→clinician**(정상담이 검사 실시·채점·확정) |
| 지원 검사 | **로샤 · HTP · SCT 셋뿐.** 등록 모달의 나머지 15종은 `comingSoon` 회색 — saas 18종과 3+15로 정확히 대응 |
| 로샤 단계 | `실시(collect)` → `채점하기(review)` → `결과 보기(results)`. 확정 전엔 결과가 **잠김** |
| 데이터 기준선 | 검사 **14건** · 로샤 반응/영역/카드 **44/44/20** · HTP 그림 20(실제 PNG 1050×1485)·객체 148·해석 56 · SCT 3건(`result_data` JSONB) · 종합보고서 1 · 배터리 1 · AI잡 8 |

**시드가 껍데기였던 문제는 끝났다.** 예전엔 status 컬럼만 있고 속이 비어서, `under_review` 로샤를 열면 "반응 없음 · R 0",
`ai_draft_ready` HTP를 열면 "그림을 업로드하세요"였다. 지금은 DOM으로 확인된 것만 적으면:

- 로샤 채점(이하준 `under_review`) — `R 22 · 채점 8/22`, 부호 표(`D9 + Ma H P ZW 5.5 COP`), `임상가 확인이 남은 반응: 카드 IV ②…`
- 로샤 결과 Exner CS(박지우) — `Sum6 2 · WSum6 3 · COP 3 · MOR 2 · AG 1`
- HTP(김민준 `in_progress`) — 그림 네 장이 프록시로 실제 로드. 해석 표는 `나무 / 자아강도 / 가늘다 / 기둥이 가늘어…`
- SCT(김영희 `confirmed`) — `A 가족 관계 36/54` 등 5영역 + 문항별
- 내담자 박지우 — 배터리 3종 확정 → **`종합보고서 작성` 버튼 활성**(s03 진입로)

**DYLD_FALLBACK_LIBRARY_PATH가 없으면 API가 안 뜬다** — WeasyPrint가 `libgobject`를 못 찾는다.
**마이그레이션 체인은 빈 DB에서 안 돈다** — 최초 리비전이 기존 스키마를 전제한다. `init_db → alembic stamp head → seed.develop` 순서가 정본이고 `reset-seed.sh`가 그대로 한다.

## 결정된 것

| | |
|---|---|
| 촬영 시점 | **마지막에 한 세션으로 몰아서.** 그 전까지는 준비만 |
| 주인공 | 상담사 **정상담** 고정 (CAST.md) |
| 배역 축 | 검사(s01·s02·s03·s04) · 회기(s05·s06·s07·s09) · 모임(s08) |
| s01 검사 항목 | **로르샤흐 + 스마트폰중독검사** 둘 — 한 접수가 두 갈래로 갈린다. 나이(만 10~12세)가 여기서 역산됐다 |
| s04 폰 파트 | **뺀다.** 폰이 아니라 모바일 웹이라 현재 촬영 SPEC에 경로가 없다 |
| 문자 발송 | `MESSAGING_DRY_RUN=true` — 자격증명 없는 로컬에서 발송 실패가 흐름을 끊지 않게 |
| **모바일 촬영 범위** | **전문가 앱(`apps/mobile`)만** 찍는다. 내담자 앱(`mobile-client`)은 찍지 않고, 그 화면이 필요한 자리는 비운다 — 대신 그 상태를 만드는 **데이터는 준비 단계에서 진짜로 만든다**(s05가 그 예) |
| s08 배역 | 김민준 → **이하준**. COUNSELOR는 담당 내담자만 열람된다(`access_level=own`, `get_client.py:14-19`) |
| **s03의 주장 (테이크 B)** | **"AI가 초안을 *검토*한다"** — 초안을 쓴다고 말하지 않는다. `preset-body.ts`의 본문이 상담사가 이미 쓴 글이 되고, AI는 그 위에서 누락·표현·모순을 잡는다. 심어둔 결함 셋(Ⅲ 공란 · '되어진'·'환자' · '중등도' vs '경미한')이 그 연출의 재료다 |

## 제품에 손댄 것 (촬영을 위해)

`_tool/saas-center-platform`은 이 저장소에 커밋되지 않는다. 다른 세션이 이 변경을 모르면 재현이 안 된다.

| 변경 | 왜 |
|---|---|
| `receive-service.ts` — `resolveInstitutionId()` 추가, 기관 확정을 내담자 생성보다 앞으로 | 에이전트가 얹은 신규 기관 스텁이 승격되지 않아 `POST /assessment-cases/batch`가 **404**였다. s01 첫 촬영이 이걸로 실패했다 |
| `config.py` `MESSAGING_DRY_RUN` + `infrastructure/messaging/dryrun.py` | 위 참조. 기본값 False, 촬영 환경만 켠다 |
| `handlers/field_note/generate_counseling_note.py` — dispatch `params`에 **`client_ids` 추가** | 계산해 놓고 안 넘겨서 `GenerateCounselingNoteService`의 upsert 루프가 빈 채로 돌았다. 일지가 한 건도 안 써지는데 **단계는 completed로 찍혀** UI가 영원히 "전사 분석 중…". s07이 이걸로 막혀 있었다 |
| **관계 목록에 상대 이름 동반** (s08) — `client/relation/schemas.py` `RelationResponse.related_client_name` 추가 · `relation/handlers/list_relations.py`가 `ListClientsByIdsService`로 한 번에 채움 · `apps/web/.../detail-service.ts` `fetchRelations`가 `getClientDetail()` 호출 제거 · `client.action.ts` 타입 동반 | 케어보드가 보호자 **이름 하나** 때문에 담당 범위 가드가 걸린 단건 조회를 관계마다 불러 **404**, `Promise.all` 거부로 `가족관계` 행이 통째로 사라졌다. **가드(`_resolve_assigned_client_ids`·`get_client.py`)는 한 줄도 안 건드렸다** — 레포 자체 규약(`rules/api/agent-query.md` "`{ref}_id`에는 `{ref}_name`을 동반")이 이미 요구하던 형태다. 전문가 앱(`mobile/.../hooks.ts useClientRelations`)은 `phone`까지 쓰므로 그대로 남겼다 |

`_tool/mindbom`도 커밋되지 않는다. 여기도 손댔다.

| 변경 | 왜 |
|---|---|
| `scripts/seed_content.py` + `content_htp.py` · `content_sct.py` **신규** | 시드가 status만 세팅한 껍데기라 화면이 비었다. 검사 속(반응·영역·그림·객체·해석·보고서)을 채운다. `seed:<slug>` 자연키라 멱등 |
| `scripts/seed.py` — 박지우 `battery-htp`·`battery-sct` 2건과 `BATTERY` 추가 | 종합보고서 버튼은 **같은 battery_id로 묶인 확정 검사 2건 이상**에서만 열린다. 로샤 하나로는 s03 진입로가 없었다 |
| `scripts/seed_rorschach_full.py` — `_find_existing`에 `exam_type='rorschach' AND note IS NULL` 조건 | **버그.** 박지우의 *모든* 검사를 찾아 `--drop` 한 번에 로샤·SCT·HTP 3건이 같이 soft delete됐다 |

## 촬영 도구 상태 (SPEC v3)

| | |
|---|---|
| 커서 | `sckcap`이 프레임에 합성 — 진짜 `NSCursor` 이미지(arrow · ibeam · pointer). 페이지 오버레이 아님 |
| 포커스 | **뺏지 않는다.** 전체화면·`bringToFront` 없음, 창 필터로 그 창만 잡는다 |
| 크롬 높이 | 매 촬영 자동 측정(마젠타 띠 + 창 전체 스냅샷). 실측 87pt |
| 번역 풍선 | 문서 응답의 `<html lang>`을 ko로 바꿔 제거(제품 `app.html`이 `lang="en"`이라 뜬다) |
| 실측 | 11초 테이크에서 고유 프레임 639 · 드롭 0 ≈ 57fps (v2는 약 20fps) |
| `login.mjs` | **`/select-institution` 분기를 더했다**(2026-09-10) — 마인드봄은 기관이 하나여도 그 화면을 거치고, 버튼을 안 누르면 기관 쿠키가 없어 API가 403이다. saas의 `/welcome` 분기 바로 뒤 |
| **알려진 한계** | 창이 **완전히 가려지면** macOS가 렌더를 멈춰 프레임이 검게 나온다. `MacWebContentsOcclusion` 플래그를 껐지만 **검증 미완**. 촬영 중 그 창을 완전히 덮지 말 것 |

## 함정 (같은 데서 두 번 넘어지지 말 것)

- **일정 시각은 UTC(naive)로 저장된다** — 시드의 `10:00`은 KST 19:00이다. 변경 요청을 KST로 넣으면 9시간이 밀려 승인이 **항상 409**
- **COUNSELOR는 담당 내담자만 본다** — 목록에 안 보이는 사람은 URL로도 못 연다. 케어보드는 보호자 프로필을 따로 부르는데 그것도 막혀 404가 난다
- **AI 작업은 API만 띄우면 안 돈다** — `pnpm dev:api`는 uvicorn + `app.worker.stream` + `app.worker.batch` 셋을 띄운다. uvicorn만 띄우면 조용히 멈춘다(그래도 여전히 미해결 — s07 참조)

- **같은 문구의 버튼이 둘일 수 있다** — s04의 `바로링크 전송`은 카드에도 모달에도 있다. `.first()`가 모달 뒤 카드를 눌러 **오류도 토스트도 없이 아무 일도 안 일어났다**. `.last()`로 잡는다
- **HTTP 오류가 없다고 저장된 게 아니다** — 그래서 사이클 6번에 DB 확인이 있다
- **저장이 있는 장면은 두 번 못 돌린다** — 같은 이름의 내담자가 있으면 `POST /clients`가 409. 리허설 사이에 `reset-seed.sh`
- **재시드하면 로그인 토큰이 죽는다** — 계정 id가 바뀐다. `reset-seed.sh`가 상태 파일을 같이 다시 만든다
- **`관계`는 input이 아니라 Select** — `input[placeholder="관계"]`는 없다
- **시드는 필드노트를 만들되 전사는 안 채운다** — `status=completed`인데 화면은 "전사 데이터가 없어요.". `s06-setup.sql`이 `refined_transcript`를 넣는다
- **버튼 라벨을 추측하지 말 것** — s09의 출결은 `노쇼`가 아니라 **`노쇼했어요`**. 안 맞으면 조용히 지나간다
- **확인 모달 안의 스위치가 기본 꺼짐일 수 있다** — s09의 `회기 차감`. 라벨을 맞춰도 DB는 안 바뀐다
- **s09는 한 번만 돌아간다** — 노쇼 처리하면 회기가 잠긴다(`status=cancelled`). 다시 돌리려면 `_scripts/s09-reset.sql`을 넣는다 — 행을 지우지 않아 **sessionId·촬영 URL이 유지된다**. 행이 아예 없을 때만 `s09-setup.sql`(이쪽은 sessionId가 새로 생긴다). 시드 전체 리셋은 다른 세션의 DB를 깬다
- **모달 안의 입력 칸을 빼먹지 말 것** — s09 노쇼 모달에는 스위치 말고 **사유 textarea**가 있었고, 앞선 준비는 그것을 비운 채 통과했다(`memo=null` → "기록된 사유가 없어요"). 종료 코드 0은 화면이 장면의 논지를 보여준다는 뜻이 아니다 — 모달을 열면 안에 있는 것을 전부 센다
- **`h.reveal`은 이미 보이는 요소에 쓰지 않는다** — s09 모달(420px)은 뷰포트에 다 들어오는데도 dy=67로 배경이 밀렸다. 커서만 옮기면 될 때는 `h.hover`
- **준비 SQL의 상태값이 enum에 있는지 확인할 것** — s09 setup이 넣던 `pending`은 `AttendanceStatus`에 없는 값이었다. 화면이 멀쩡했던 것은 `InlineJournalEditor`가 예정 회기의 출결을 정규화해 준 우연 덕이다. `scheduled`로 고쳤다
- **관계 목록은 상대 이름을 응답에 싣는다** — 예전엔 이름 하나 때문에 관계마다 단건 조회를 불러 보호자가 404였고, `Promise.all` 거부로 `가족관계` 행이 통째로 사라졌다. 고쳤다(아래 제품 변경 표). **API에 reload가 없어 재시작해야 적용된다**
- **AI 파이프라인 로그의 `Step note_status completed`가 곧 상담일지 단계다** — `_COUNSELING_NOTE.status_field='note_status'`. 다른 단계로 오인하기 쉽다
- **AI 워커는 `pnpm dev:api`가 띄우는 셋 중 둘이다** — uvicorn만 띄우면 안 돈다. `app.worker.stream` · `app.worker.batch`도 같이
- **`expo run:ios`는 마지막 실행 단계에서 osascript 자동화 권한을 요구한다** — 빌드는 성공하므로 `simctl install` + `simctl launch`로 우회
- **idb는 `/usr/local/bin/idb_companion`을 고정 경로로 찾는다** — Apple Silicon에선 컴패니언을 직접 띄우고 `idb connect localhost 10882`
- **`brew install idb-companion`은 `brew trust facebook/fb` 먼저** 해야 설치된다
- **`idb ui tap`은 포인트 좌표다**(iPhone 17 Pro 402×874pt). 스크린샷 픽셀을 3으로 나눈다
- **`idb ui text`가 끝 글자를 흘린다** — `describe-all`의 `AXValue`로 확인하고 이어 친다. 지우는 것보다 앱 재시작이 빠르다
- **두 제품은 연동되지 않는다** — s01에서 접수한 사람이 마인드봄에 생기지 않는다. 이을 수 있는 것은 배역·센터·담당자·검사 종목까지고, **인물 동일성은 주장하지 말 것**. `check-cast.py`가 "지어낸 사람은 배역표에 넣지 않는다"로 막는다
- **s03 보고서 본문은 프리셋이다** — 사이드바 자료는 시드에서 오지만 본문 Ⅰ~Ⅴ는 `report/preset-body.ts`다. **AI 리뷰 시연용 결함이 일부러 심겨 있다**(Ⅲ 공란 → "섹션 누락", Ⅳ-6 '되어진'·'환자' → 표현 교정, Ⅳ-2 '중등도' vs Ⅴ '경미한' → 모순). 지우면 리뷰 시연이 빈손이 되므로 남겨뒀다. **s03 features.md에 경고로 명시했다.** 화면의 `실시한 검사`에 TCI·MMPI-2·S-척도가 올라 있는데 박지우에게 실시된 적 없는 셋이다 — 테이크 B를 IR에 쓸지는 연출이 아니라 사실 판단으로 정한다
- **시드로 못 고치는 목업 셋** — `report/mock-materials.ts`(TCI·MMPI-2·S척도, 결과지 이미지는 `static/mock-reports/`), `report/mock-longitudinal.ts`(교차분석 패널), `report/overall-review.ts`(AI 종합 리뷰 카드 고정 문안). 화면에 올리려면 목업임을 알고 올린다
- **SCT는 테이블이 없는 게 정상** — `examinations.result_data`(JSONB) 한 칸에 응답·채점·요약이 다 들어간다(`sct/services.py`). `sct_*` 테이블을 찾지 말 것
- **마인드봄 로그인 토큰도 죽는다** — 재시드하면 `401 GET /api/auth/check`이고 화면은 `403 기관이 선택되지 않았습니다`가 된다. `_state/local-mindbom-counselor1.json`을 다시 만든다(saas의 `reset-seed.sh`는 saas만 한다):
  `CAP_EMAIL=counselor1@mindscope.com CAP_PASSWORD=test1234 node ../../.claude/skills/capture-service/scripts/login.mjs --base http://localhost:4503 --out _state/local-mindbom-counselor1.json`
- **넓은 셀렉터로 캔버스를 잡지 말 것** — s02의 `h.drawOnCanvas('svg, canvas')`가 우상단 사용자 메뉴의 16px 아이콘을 물어 드래그가 클릭이 됐다. 그리기 판은 `svg[aria-label="영역 그리기"]` 하나다
- **촬영 뒤 ticks를 본다** — `meta.capture.stats.ticks ÷ duration`이 60이 아니면 60Hz 기록기가 굶은 것이고 영상이 짧고 빠르게 나온다(s02 t04: 924 ticks / 22초 → 15.4초로 압축). 머신이 바쁘면 재발한다
- **전사 도착 전에 팝오버를 열면 자유반응이 덮인다** — 빈 초안이 블러 때 저장된다. 4xx가 안 뜬다(features.md)
- **영역 저장 확인은 `rorschach_regions.response_id`로** — `rorschach_responses.region_id`는 안 채워진다(링크가 반대). 이걸 보고 "영역이 저장 안 된다"고 한 번 오판했다
- **마인드봄 DB 계정은 `mindbom/mindbom`** — saas의 `imomtae`가 아니다. 반응 테이블의 키는 `examination_id`가 아니라 `session_id`(`rorschach_sessions` 경유)
- **촉구는 카드 단위 토글이다** — 같은 검사에서 s02 스크립트를 두 번 돌리면 두 번째가 촉구를 꺼버리고 반응만 쌓인다. 마인드봄 재시드 뒤 한 번만 돌린다
  `login.mjs`가 이제 마인드봄의 `/select-institution`도 넘어간다:
  `CAP_EMAIL=counselor1@mindscope.com CAP_PASSWORD=test1234 node ../../.claude/skills/capture-service/scripts/login.mjs --base http://localhost:4503 --out _state/local-mindbom-counselor1.json`
- **`초안 생성`은 `AI 초안 생성`의 부분 문자열이다** — `has-text`로 잡으면 모달 뒤 헤더 버튼을 눌러 아무 일도 안 나고 오류도 없다. `exact: true`로 잡는다
- **CDSS 푸터에 `모델 rule-based-fallback`이 찍힌다** — `AI_COMPREHENSIVE_URL`(저장소 밖 외부 서비스)이 없어 서버가 룰베이스로 폴백한다. 본 촬영 전에 모델을 연결하든 그 줄을 프레임에서 빼든 정할 것
- **마인드봄 장면의 시작 URL에는 시드 id가 박혀 있다** — s03은 `/clients/<clientId>/reports/<reportId>`. 재시드하면 다시 뽑아야 한다(각 features.md에 psql 한 줄)

## 갱신 규칙

장면 하나를 준비 완료로 만들 때마다 위 표의 그 줄과 "갱신 시각"을 고친다.
제품에 손대거나 촬영 도구를 바꾸면 해당 절도 같이 고친다. **이 파일이 낡으면 다른 세션이 헛수고한다.**
