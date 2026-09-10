# 이어받기 — 2026-09-10 오후 세션

이 문서는 그날 오후 세션이 무엇을 바꿨고, 무엇이 검증됐고, 무엇이 열려 있는지를 적는다.
**정본은 여전히 `STATUS.md` → `CAST.md` → 각 장면의 `features.md`/`notes.md`다.** 이 문서는 그 사이를 잇는 인계문이다.

---

## 0. 먼저 알아야 할 것 셋

1. **같은 저장소에 다른 세션이 붙어 있다.** `CUT.md` · `CUT.html` · `STORY.md` · `MJ-HOWTO.html` · `_midjourney/` · `_scripts/stills.sh` · `.claude/skills/motion-stage/`가 그쪽 산출물이다. **그 파일들을 건드리지 마라.** 이 세션이 `git checkout -- movies/26IRDEMO`를 잘못 돌려 그쪽 작업을 한 번 날린 적이 있다(복구했다).
2. **`raw/`는 지우지도 덮지도 않는다**(촬영 규칙 4). 이 세션 중 `s03` raw에서 파일이 사라진 일이 있었고 — 어느 세션의 어느 명령이 지웠는지 **끝내 못 밝혔다**. 기록에 삭제 명령이 없다. `raw/` 근처에서는 특히 조심할 것.
3. **`s02_web_receive-entry_t01/t02.mov` 두 개는 영구 유실됐다.** meta·manifest 행은 남아 있으나 원본이 없다. SPEC v1·v2 폐기 테이크라 편집 손실은 없다.

---

## 1. 이 세션이 바꾼 것 — 배역 통일

영상의 검사 축을 **윤도현 한 사람**으로 통일했다. 발단은 마인드봄 SCT가 아동·청소년용 문항(`여자애들은` · `나의 학교생활은` · `우리 언니/오빠/누나/형/동생은`)인데 대상이 만 35세 박지우였다는 것 — **도구와 대상이 애초에 어긋나 있었다.**

| 장면 | 전 | 후 |
|---|---|---|
| s01 접수 | 검사 2건 | **4건** — 로르샤흐 · HTP · SCT(대면 3종 → 마인드봄 배터리) + 스마트폰중독검사(온라인 → s04) |
| s03 채점·보고서 | 박지우 · draft+aireview | **윤도현 · aireview 하나** |
| s06 필드노트 | 이하준(회기 축) | **윤도현** — 개인상담 C00003을 새로 만든다 |
| s07 자동일지 | 이하준 | **윤도현** — s06이 남긴 그 회기 |
| s05 · s08 · s09 | 이하준 | **그대로** — 필드노트를 경유하지 않는다(보호자 변경요청 · 담당 범위 · 바우처 차감이 축) |

**왜 s05·s08·s09는 안 옮겼나**: s05는 축이 보호자 이수진이고 윤도현엔 보호자가 없다(s01은 아이 셋만 접수). s09는 바우처, s08은 `access_level=own`이 축이다. 셋 다 시드가 이하준으로 완비돼 있고, 옮기면 인물·관계·계정을 새로 지어내야 하는데 얻는 건 형식적 통일뿐이다. CAST.md의 "축이 갈리는 것은 타협이 아니다 — 지켜야 할 것은 축 안에서 사람이 바뀌지 않는 것"을 따랐다.

---

## 2. 확정 시드

```
_seed/saas-2026-09-10c.json      sha256 c901b0925d81
_seed/mindbom-2026-09-10c.json   sha256 416e30f069ac
```

**마인드봄 DB는 s03 촬영 지점**(배터리 3건 confirmed · 로샤 반응 22)에 있다. `_scripts/s02-reset.sh`를 돌리면 그 지점이 깨진다 — s02와 s03은 같은 검사를 반대 상태로 쓴다.

---

## 3. 이 세션이 찍은 것 (전부 드롭 0 · 3200×1800 @60fps)

| 장면 | 선택본 | 길이 | 대체 |
|---|---|---|---|
| s01 접수 | `s01_web_intake_t08` | 23.83s | t07 |
| s03 채점·보고서 | `s03_web_aireview_t08` | 14.53s | t07 |
| s04 바로링크 | `s04_web_sendlink_t04` | 11.82s | t03 |
| s06 필드노트(웹) | `s06_web_fieldnote_t03` | 12.45s | t02 |
| s07 자동일지 | `s07_web_draft_t05` | 13.48s | t04 |

`s03`은 t01~t08까지 전부 남아 있다(t05·t06·t07은 자료 삽입을 맞추다 나온 것). 기존 s02·s05·s08·s09 테이크는 유효하다.

---

## 4. 제품에 손댄 것 — `_tool/`은 커밋되지 않으므로 여기 적힌 것이 유일한 기록이다

### 마인드봄 (`_tool/mindbom`)
| 파일 | 무엇 | 왜 |
|---|---|---|
| `apps/api/scripts/seed.py` | 배터리를 `battery-yundohyun`으로 · `yun-rorschach`를 배터리 일원 + 기본 `confirmed` | 종합보고서 버튼은 배터리 단위로만 열린다 |
| `apps/api/scripts/seed_content.py` | `REPORT_SLUGS`·`REPORT_NOTE`·`REPORT_BODIES` 아동용 재작성 · SCT 40문항 답변을 만 12세 말투로(점수 유지) | 영역 총점이 화면에 그대로 떠야 한다 |
| `apps/api/scripts/cast.py` | `REPORT_CLIENT` 주석으로 무효화 표시 | 폐기 도구 `seed_rorschach_full.py`만 읽는다 |
| `apps/api/.env` | **`STORAGE_BACKEND=local` 추가** | 기본값이 `s3`라 HTP 그림 4장이 전부 500이었다 |
| `apps/web/.../preset-body.ts` | 본문 전면 재작성(3종) · 실시 방식 구절 추가 | 6종 중 3종은 실시된 적이 없다 · "서술이 짧습니다" 지적 제거 |
| `apps/web/.../report-data.svelte.ts` | `MOCK_MATERIALS` 제거 | 목업 검사가 사이드바에 섰다 |
| `apps/web/.../overall-review.svelte.ts` | `REVIEWED_EXAMS = origin==='real'` | 안 그러면 "MMPI-2가 언급되지 않았습니다" 유령 지적 3건 |
| `apps/web/.../chart-svg.ts` | 표 썸네일을 채점표 모양으로 | 로딩 뼈대처럼 보였다 |
| `apps/web/.../MaterialsPanel.svelte` | 표 썸네일에 **실제 `headers`/`rows`** 렌더 | 데이터를 들고 있으면서 안 쓰고 있었다 |

### saas (`_tool/saas-center-platform`)
| 파일 | 무엇 |
|---|---|
| `apps/web/.../cards/AssessmentCaseCard.svelte` | 검사명 `Typography`에 **`min-w-0`** — 플렉스 자식의 `min-width:auto` 때문에 `truncate-safe` 말줄임이 발동 못 해 검사 4건에서 이름이 잘리고 `외 3건`이 통째로 사라졌다 |

`svelte-check` 양쪽 0 errors.

---

## 5. 새로 만든 스킬 — `.claude/skills/phone-stage/`

전문가 앱(`apps/mobile`)을 시뮬레이터에 세우는 스킬. **캡처는 하지 않는다** — 촬영은 `capture-service`의 `capture-phone.mjs`다.

```
stage.mjs status | sim | build | install | login | goto [경로] | up | selftest
```

- 스킴 `mindscope-dev` · 번들 `kr.mindscope.app.dev`
- **조작을 idb에 의존하지 않는다**: 딥링크(`simctl openurl`)로 화면 이동, AsyncStorage에 토큰 직접 주입으로 로그인
- 빌드는 `expo run:ios`를 피하고 `xcodebuild` + `simctl install` (osascript 권한 요구 회피). **Release**를 쓴다 — Metro가 없어지고 개발자 메뉴가 안 뜬다
- 함정 하나 발견: `babel-preset-expo`·`@babel/plugin-transform-react-jsx`가 pnpm 전이 의존이라 번들 단계에서 죽는다. `build`가 심링크로 잇는다

### ⚠️ 미해결 — 화면이 검다
`status`는 전부 초록이고(설치·토큰·권한 32개·딥링크 왕복 OK) 앱 프로세스도 살아 있는데, `capture-phone.mjs --calibrate`로 뽑은 프레임의 **평균 밝기가 33.9/255**다. 사실상 검은 화면이다.

가리지 못한 원인 셋:
1. 캡처 시점에 Simulator 창이 가려짐 (STATUS의 알려진 한계 — 완전히 덮이면 macOS가 렌더를 멈춘다)
2. 앱이 검은 화면에 머묾 — Release에서 JS 번들 로드 실패 시 흔하다. 프로세스는 살아 있어 딥링크에도 안 죽는다
3. 크롭 좌표가 Simulator 창 밖을 잡음

로그에 `expo-updates`의 EAS 채널 헤더 400과 `attempt to write a readonly database` 경고가 있다. 로컬 빌드에서 무해할 수도 있으나 **확인 안 됐다.**

**다음 세션이 먼저 할 일**: Simulator 창을 눈으로 보고 앱이 실제로 그려지는지 확인. 그려진다면 창 가림/크롭 문제, 안 그려진다면 번들 문제다. `s06-필드노트/stills/calibrate-phone.png`가 그 프레임이다.

---

## 6. 열려 있는 것

| | |
|---|---|
| **s06 앱 절반** | 위 검은 화면. 조작은 `idb`가 없어 여전히 사람 몫(`--manual`) |
| **s08 `care_board_entries` 0행** | s07 준비 중 발견. 케어보드가 비어 있을 수 있다 — s08 촬영 전 재구축 필요 |
| **스틸 재추출** | `_scripts/stills.sh`의 표가 옛 테이크(t07·t01 등)를 가리킨다. s03은 선택본이 draft→aireview로 바뀌어 대상 자체가 다르다 |
| **CUT.md 갱신** | 선택본·인아웃·"쓰지 않는 것" 전부 다시 잡아야 한다. **다른 세션 소관** |
| **s03 "개발 예정" 라벨** | AI 종합 리뷰는 시연용(지적은 정규식, 진행은 타이머, 저장 없음)이다. 사용자가 **편집에서 직접** 얹기로 했다 — 제품·스크립트에 넣지 마라 |
| **s07 길이 흔들림** | 진짜 `gpt-4o-mini`를 부른다. 응답이 6.1~10.1초에서 흔들려 노컷 길이가 테이크마다 다르다. 키가 죽으면 `until`이 60초에 던진다 |

---

## 7. 이 기계 고유의 함정 (STATUS.md에 없던 것 포함)

1. **`DYLD_*`가 벗겨진다** — macOS는 SIP 보호 바이너리를 exec할 때 `DYLD_*`를 지운다. `nohup`·`/usr/bin/env`·**`/bin/sh` 셔뱅**(`.venv/bin/uvicorn`이 그렇다)·`uv run` 전부 해당. **`.venv/bin/python`을 직접 부르는 것만 통한다.** STATUS의 "nohup 뒤에 env를 붙여라"는 이 기계에서 안 통한다.
2. **파이프 뒤의 `$?`는 파이프 마지막 명령의 것이다.** `node ... | tail`의 `$?`는 `tail`의 것 — 이 세션이 이걸로 "종료 코드 0"을 두 번 잘못 보고했다. **종료 코드는 파이프 없이 잡아라**: `node ... > /tmp/x.log 2>&1; echo $?`
3. **`docker exec` 권한이 막혀 있다.** psql로 직접 붙어라 — saas는 `apps/api/.env`의 `DATABASE_URL`(포트 3501), 마인드봄은 `PGPASSWORD=mindbom_dev … -p 4501`. `reset-seed.sh`·`s02-reset.sh`·`seed-snapshot.sh`를 그렇게 고쳤다.
4. **마인드봄 토큰은 30분 만료**(`ACCESS_TOKEN_EXPIRE_MINUTES=30`). 촬영 직전 `login.mjs`로 상태 파일을 다시 만들어라. 안 하면 리허설이 401로 1단계에서 멈춘다.
5. **프로세스를 죽일 땐 포트로 잡아라.** `pkill -f` 패턴이 안 맞아 옛 API가 살아남고 새로 띄운 게 포트 충돌로 조용히 죽은 일이 있었다. `lsof -ti tcp:PORT | xargs kill`.
6. **`isBeforeStart`가 벽시계를 그대로 본다**(`InlineJournalEditor.svelte:145-150`). `status=completed`인 회기라도 시작 시각이 미래면 일지가 안 열린다. s06 회기를 09-09로 옮긴 이유다.
7. **contenteditable에서 `End`는 문단 끝이 아니라 줄 끝**이다. 문단 사이에 넣으려면 빈 문단을 눌러라. `.para:has-text(…) + .para`는 안 잡힌다(문단들이 지면 컨테이너로 나뉘어 형제가 아니다) — 실행 시점에 인덱스를 세라.
8. **`등록` 버튼이 DOM에 둘**(사이드바용·하단 액션바용). 뷰포트 1600px가 `2xl`(1536px) 이상이라 지금은 안전하지만 그 아래로 내리면 `.first()`가 안 보이는 버튼을 누른다.

---

## 8. 환경 세우는 법 (이 기계 기준)

```bash
# saas API — .venv/bin/python 직접, uv run·nohup 금지
cd movies/26IRDEMO/_tool/saas-center-platform/apps/api
export DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib REDIS_URL=redis://localhost:3505/0 MESSAGING_DRY_RUN=true
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 3502 & disown
.venv/bin/python -m app.worker.event  & disown    # 없으면 AI 작업이 큐에 안 들어간다
.venv/bin/python -m app.worker.stream & disown
.venv/bin/python -m app.worker.batch  & disown

# 마인드봄 API
cd movies/26IRDEMO/_tool/mindbom/apps/api
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 4502 & disown

# 웹 둘
cd _tool/saas-center-platform && pnpm dev:web & disown   # 3503
cd _tool/mindbom             && pnpm dev:web & disown    # 4503
```

---

## 9. 다음 세션에 권하는 순서

1. **Simulator 창을 눈으로 봐라** — s06 앱 절반의 검은 화면 원인부터. 이게 풀려야 s06이 끝난다
2. **s08 `care_board_entries` 재구축** — 0행이면 케어보드가 빈다
3. **스틸 재추출** — 새 테이크 기준으로 `stills.sh`의 표를 다시 잡는다
4. **CUT.md** — 다른 세션과 조율. 선택본 5개가 바뀌었고 길이도 전부 달라졌다

**보고할 때는 프레임을 실제로 확인하고 말하라.** 이 세션은 DOM 수치만 보고 "그림이 들어가 있다"고 말했다가 틀렸다(그림이 666×942px라 900px 뷰포트에 애초에 안 담겼다). 촬영본은 `ffmpeg`으로 프레임을 뽑아 눈으로 본 뒤에 판단하라.

---

## 10. 이후 확인 (2026-09-10 저녁, 다음 세션이 덧붙임)

§9의 1·2번을 확인했다. **§5의 "화면이 검다"는 오해였다.**

### ① s06 앱 — 검은 화면이 아니다. 앱은 정상 렌더 중이다

`s06-필드노트/stills/calibrate-phone.png`를 눈으로 봤다. **필드노트 홈이 온전히 그려져 있다** —
`오늘은 예정된 일정이 없어요` 헤드라인 · 시계/머그 일러스트 · `최근 노트` 카드 4장 · 하단 탭바까지.

`YAVG=33.9`는 **전문가 앱이 다크 테마**라서다. 같은 프레임의 `YMAX=255`다 — 순백 픽셀(흰 글자)이 있다.
검은 화면이면 YMAX도 0 근처여야 한다. **§5가 세운 원인 셋(창 가림 · 번들 실패 · 크롭 어긋남)은 전부 해당 없다.**

```
ffprobe -v error -f lavfi -i "movie='<png>',format=gray,signalstats" \
  -show_entries frame_tags=lavfi.signalstats.YAVG,lavfi.signalstats.YMAX -of csv=p=0
→ 33.941,255
```

`stage.mjs status`도 전부 초록이다(시뮬레이터 · Release 빌드 · 설치 · 토큰 · 딥링크).
`expo-updates`의 EAS 400과 `readonly database` 경고는 **무해했다** — 앱이 그려지고 있다.

**s06 앱 절반에 남은 것은 조작 하나뿐이다.** `idb`가 없어 `capture-phone.mjs --manual`(사람이 탭)로 간다.

### ② s08 케어보드 — 재구축 완료

`care_board_entries` 0행을 확인하고 제품의 백필로 되살렸다. 멱등이라 다시 돌려도 안전하다.

```
cd _tool/saas-center-platform/apps/api
export DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib REDIS_URL=redis://localhost:3505/0 MESSAGING_DRY_RUN=true
.venv/bin/python -m scripts.backfill_care_board      # → 대상 7명 · 16행 · 실패 0
```

이하준(s08의 축) 스트림이 8행으로 섰다 — 회기 3 · 바우처 3 · 필드노트 1 · 케이스 개설 1.
`kind='memo'`는 0행이 맞다. 그건 `_scripts/s08-setup.sql`이 촬영 직전에 넣는 김원장 메모다.

### ③ 스틸 재추출 — 손대지 않았다 (지시 충돌)

§0.1이 `_scripts/stills.sh`를 **다른 세션 소관으로 지정하고 건드리지 말라**고 했는데
§6·§9는 이쪽에 재추출을 맡겼다. **§0.1을 따랐다.** 파일은 그대로다.

참고로 그 표는 옛 테이크를 가리킨다 — `s01_web_intake_t07`(→t08) · `s03_web_draft_t01`(선택본 자체가
`s03_web_aireview_t08`로 바뀌어 대상이 다르다) · `s04_web_sendlink_t03`(→t04) ·
`s06_web_fieldnote_t02`(→t03) · `s07_web_draft_t04`(→t05). s02·s05·s08·s09 줄은 유효하다.
CUT.md와 함께 그쪽 세션이 잡는 것이 맞다.

### 남은 것

| | |
|---|---|
| s06 앱 절반 | 조작만. `--manual`로 촬영하면 끝난다 |
| 스틸 재추출 · CUT.md | 다른 세션 소관 (위 ③) |
| s01 · s03 · s04 재촬영 | §3대로 새 테이크는 이미 찍혀 있다. STATUS의 선택본 표를 새 테이크로 옮기는 일이 남았다 |

### ④ `raw/` 유실은 둘이 아니라 31개다 — 그리고 git이 안 지킨다

§0.2의 "s03 raw에서 파일이 사라졌는데 원인을 못 밝혔다"는 훨씬 큰 일의 일부였다.
**meta·manifest는 56 테이크인데 `.mov`는 25개뿐이다.** §0.3이 적은 `s02_web_receive-entry_t01/t02`
둘 말고도 29개가 더 없고, **어느 문서도 그 삭제를 기록하지 않았다.**

```
mov 25 · meta 56 · manifest 56
mov 없는 테이크 31개 — s01 t01~t06 · s02 t01~t04 · s04 t01~t02 · s05 t01~t04 ·
                      s07 t01~t03 · s08 t01~t02 · s09 t01~t02 · 프로브류 전부
```

**원인은 거의 확실하다.** `.gitignore:7`이 `movies/26IRDEMO/**/raw/*.mov`를 제외한다 —
추적되는 mov가 **0개**다. 그래서 `git clean -fdx`(또는 `-fdX`) 한 번이면 촬영 원본이 통째로 날아간다.
§0.1이 적은 "`git checkout --`을 잘못 돌려 다른 세션 작업을 날렸다"와 같은 계열의 사고로 보인다
(`checkout --`은 mov를 못 건드리지만 `clean -x`는 건드린다).

**지켜야 할 것**: 이 저장소에서 `git clean`에 `-x`·`-X`를 붙이지 마라. git은 복구 수단이 아니다 —
백업하려면 저장소 밖으로 복사해야 한다. **선택본 12개는 mov·meta·manifest 모두 온전하다**(편집 손실 없음).

### ⑤ 같은 저장소에 다른 세션이 **지금** 붙어 있다

이 확인을 하는 동안에도 파일이 계속 바뀌고 있었다. 그쪽은 `s01_web_intake_t09`를 15:58에 찍었고
(SPEC **v5** · 시드 `saas-2026-09-10d` · 25.77s · 드롭 0 · `retake_of`는 t07로 적혔지만 실제로는 t08 다음이다),
STATUS.md의 선택본 표 s01 줄을 t09로 이미 고쳤으며, `mockup/`·`_motion/`에서 iMac 목업을 굽고 있다.

**그래서 선택본 표는 건드리지 않았다.** 그쪽이 장면 순서대로 직접 갱신하고 있다.
아직 옛 테이크를 가리키는 줄: s03 A/B·마인드봄 · s04 · s06 웹 · s07. 그쪽과 맞춰서 고칠 것.

시드도 `c` → **`d`**로 옮겨갔다. 내용은 c와 **완전히 같고 UUID만 다르다**(재시드 결과).
§2의 "확정 시드 c"는 s01 t09 기준으로는 낡았다.
