# s06 회기 진행 — 필드노트 : 기억으로 쓰는 일지

장면이 약속한 것: `scenes9.html` §06 — 회기 중 관찰이 **치료사의 머릿속에만** 있다가 밤까지 버티던 것이,
앱에서 녹음을 켜면 **실시간으로 전사**되고 화자가 분리되고 요약이 만들어지는 것으로 바뀐다.
웹에서는 원본 전사 · 화자별 대화를 **시간 축으로** 열람한다.

**배역: 검사 축 — 윤도현**(2014-05-08 · 만 12세 · 햇살지역아동센터 단체 접수). 상담사 정상담. 앱 로그인도 같은 계정이다.
회기는 **개인상담 C00003 1회기**(**2026-09-09 (수) 16:00–16:50** — 어제 방과 후)이고, 케이스·일정·회기·전사를 전부 `_scripts/s06-setup.sql`이 만든다.

> 2026-09-10 이전 판은 **이하준(회기 축 · 놀이치료 C00002)** 이었다. 검사 축의 아이로 옮기면서
> 전사·케이스·프로그램을 전부 다시 썼다. **s07(자동일지)도 같은 날 따라왔다** — 같은 회기를 앞뒤로 쓰는 한 쌍이다. 아래 §연쇄.
>
> **회기 날짜가 오늘(09-10)에서 어제(09-09)로 옮겨졌다** — s07의 회기 상세가 `new Date(session.start) > Date.now()`로
> 시작 시각을 벽시계로 비교해(`InlineJournalEditor.svelte:145-150`) 오늘 16:00 회기는 낮에 열면 "아직 진행되지 않은 회기"가 되고
> 일지가 통째로 안 열린다. `status=completed`인 회기의 시작 시각이 미래인 것 자체가 어긋난 데이터였다.
> 벽시계 16:00(방과 후)은 그대로 두고 날짜만 하루 당겼다 — 몇 시에 돌리든 지난 회기다.

## 왜 SQL이 케이스부터 만들어야 하나 (코드로 확인한 것)

| 사실 | 근거 |
|---|---|
| 필드노트는 **일정**에 매달린다 — `field_notes.schedule_id` | `field_note/models.py` · DB `idx_field_note_schedule` (살아있는 노트 기준 일정당 1개) |
| 회기 카드는 일정 → 세션 → 케이스 순으로 세 번을 탄다 | `[id]/+page.svelte:186-229`(scheduleQuery → linkedSession) · `:240-270`(케이스 상세) |
| **윤도현에게는 상담 케이스가 없다** — s01이 만드는 건 검사 케이스 AC0002뿐 | DB 실측: `counseling_cases` = C00001 박지우 · C00002 이하준 둘뿐 |
| 그래서 필요한 최소 행: 케이스 1 · 케이스 참여자 2 · 일정 1 · 회기 1 · 회기 참여자 2 · 필드노트 1 | 시드의 `seed/develop/counseling.py:_seed_case`가 만드는 것과 같은 묶음 |
| 케이스 참여자가 없으면 상세 조회가 404 | `counseling.py:191-196` 주석 — "No active counselor found" |

## 전사를 화면이 읽는 길

| | |
|---|---|
| 우선순위 | `refined_transcript` > `audios[0].diarized_transcript` > 청크별 `transcript` (`field-note/view-model.ts:140-166`) |
| 형식 | `{speaker, text, start}` 배열 (`:102-126`) |
| **화자 표시 이름** | 저장된 `speaker_map`이 없으면 **세션 참가자 순서**로 붙는다 — `participantCandidates = [상담사, …내담자]` (`FieldNoteCompleted.svelte:231-246`). 그래서 전사의 **첫 화자가 상담사여야** 화면에 `정상담` · `윤도현`으로 갈린다. `상담사`/`내담자`라는 원문 문자열은 화면에 안 나온다 |
| 침묵 구분선 | `nonverbal_markers`의 `[{type:'silence', start, end, duration}]` → `"13.2초 침묵"` (`view-model.ts:258-273`) |
| 요약 카드 | **이 라우트에는 없다.** `[id]` 페이지는 `FieldNoteCompleted`를 `activeTab='transcript'`로만 쓴다. 요약·일지는 s07의 회기 상세가 받는다 |

## 새 전사 (23 세그먼트 · 침묵 2)

만 12세, 초등 고학년 말투. **놀이치료 어휘(인형놀이 등)를 쓰지 않는다.**
마인드봄 종합보고서(`_tool/mindbom/apps/api/scripts/seed_content.py` `REPORT_BODIES`)와 한 줄씩 맞춰 썼다.

| 보고서가 말한 것 | 전사에서 대응하는 자리 |
|---|---|
| "또래와 어울리는 데는 무리가 없으나 자기 이야기를 거의 하지 않는다" | 1:12 "애들이랑 축구도 하고" ↔ 1:36 "제 얘기요? … 별로 안 해요" |
| "집에서 말수가 줄고 힘든 일이 있어도 내색하지 않는다" | 2:36 "말하면 걱정하잖아요. 엄마도 요즘 힘든데" |
| "응답 전 침묵이 길고 '이렇게 말해도 돼요?'와 같이 확인을 구하는 태도" | **13.2초 침묵**(0:41) · **17.4초 침묵**(2:00) → 2:17 "…이런 것도 말해도 돼요?" |
| "정서를 표현하기보다 혼자 감내하는 대처" | 3:01 "그냥 제가 참으면 되니까요" |
| 제언 ③ "수면·식사 등 일상 리듬의 변화를 3개월간 모니터링" | 17:22 "잠이 잘 안 와요" · 17:42 "두세 주 됐어요. 말한 적은 없어요" |
| 제언 ① "정서 인식과 표현을 목표로 한 개인 상담을 주 1회" | 케이스 자체가 그 제언에서 이어진다(프로그램 **개인상담** · `total_sessions=12`) · 26:28 하루 한 단어 기분 기록 과제 |

전사는 3:10 다음이 곧 17:22다 — 회기 중반을 건너뛴 게 아니라, **두 시각이 한 화면에 나란히 서는 자리**를 만들려고 그렇게 뒀다.
이 목록이 시간 축이라는 것이 거기서 제일 크게 읽힌다.

## 준비 단계 — `_scripts/s06-setup.sql`

```bash
PGPASSWORD=imomtae_dev psql -h localhost -p 3501 -U imomtae -d imomtae -f _scripts/s06-setup.sql
```

- **전제: s01을 먼저 돌려야 한다.** 윤도현은 시드에 없고 s01이 화면에서 만든다. 없으면 파일 맨 위 `do $$ … raise exception`이 소리 내어 멈춘다
- 맨 위 정리 블록이 제 것(C00003 묶음)만 지우고 다시 만들므로 **몇 번을 돌려도 같은 상태**다 (실측: 두 번 연속 동일)
- 마지막 `select`가 촬영이 열 **fieldNoteId**를 뽑는다 — 재실행마다 바뀐다. 명령에 박지 말고 그때 뽑는다
- **옛 §4(이하준 C00002 전사) 블록은 2026-09-10에 지웠다** — s07이 윤도현으로 따라오면서 쓰는 데가 없어졌다(아래 §연쇄)

## 확인한 화면 (실측 · 2026-09-10)

머리 — `정상담_2026 09 10_필드노트` · `30분 0초` · `연결됨` · `분석 완료`
회기 카드 — `C00003` · `윤도현` · `HMK2AX` · `2014-05-08` · 프로그램 `개인상담` · 일정 `2026-09-09 (수) 16:00 - 16:50` · `회기 상세`
※ 날짜를 09-09로 옮긴 뒤 이 줄은 **다시 재보지 않았다**(시각 표기 규칙은 같다 — 저장값 그대로).
전사 — `화자 설정` · `텍스트`/`JSON` 내려받기 · `정상담`/`윤도현`으로 갈린 발화 + `0:14`꼴 타임스탬프 + `0:41 · 13.2초 침묵` 구분선

## 두 화면으로 나눈다

| | 무대 | 무엇 |
|---|---|---|
| 앞 | **전문가 앱**(시뮬레이터) | 필드노트 홈 — 오늘 기록할 일정 · `최근 노트` · **`바로 녹음`** |
| 뒤 | 웹 | `/schedule/field-notes/[id]` — 원본 전사 · 화자별 대화를 시간 축으로 |

**녹음 자체는 찍지 않는다.** 시뮬레이터에 마이크 입력이 없어 실시간 전사가 돌지 않는다.

## 앱 절반 — 지금은 못 돌린다 (2026-09-10 실측)

| 확인 | 결과 |
|---|---|
| 시뮬레이터 | `iPhone 17 Pro` **2964900F-E9FC-4EB4-B58F-4C0349E448E1** (Shutdown). 앞 세션이 적어 둔 `F6685208-…`는 **없다** |
| 전문가 앱 설치 | **없음.** `xcrun simctl get_app_container … kr.mindscope.app.dev` 실패 |
| 빌드 산출물 | `~/Library/Developer/Xcode/DerivedData/MindScope-fxpn…/Build/Products/` 에 **`Debug-iphoneos`만** — 시뮬레이터 빌드가 없다. 앞 세션의 `MindScopeDev-*` 디렉터리도 사라졌다 |
| idb | **미설치** (`idb`·`idb_companion` 둘 다 없음) |

→ **앱 절반은 스크립트까지만 준비됐다.** 라벨은 앞 세션 실측을 그대로 두되 **미검증**으로 표시했다.
다시 세우는 순서는 아래. 세운 뒤 `describe-all`로 라벨을 다시 확인해야 한다 —
s06-setup.sql의 회기는 **어제(2026-09-09 16:00)** 라 `오늘 기록할 일정`에는 안 뜬다 — `최근 노트`에서 찾는다.

```bash
open -a Simulator && xcrun simctl boot 2964900F-E9FC-4EB4-B58F-4C0349E448E1
cd _tool/saas-center-platform/apps/mobile && APP_VARIANT=development npx expo run:ios --device <UDID> --no-bundler   # 빌드만
# ↑ 마지막 '실행' 단계는 osascript 자동화 권한이 없어 실패한다. 빌드는 성공하므로 아래로 우회:
xcrun simctl install <UDID> ~/Library/Developer/Xcode/DerivedData/MindScope*/Build/Products/Debug-iphonesimulator/MindScopeDev.app
APP_VARIANT=development npx expo start --dev-client --port 8081     # Metro
xcrun simctl launch <UDID> kr.mindscope.app.dev "mindscope-dev://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
brew trust facebook/fb && brew tap facebook/fb && brew install idb-companion && python3 -m pip install fb-idb
```

## 함정 (실측)

- **전사는 페이지가 아니라 안쪽 영역이 스크롤된다** — `flex-1 min-h-0 overflow-y-auto`(실측 826×532pt, 내용 2092). 커서가 그 안에 있어야 휠이 먹는다. 그래서 스크립트가 첫 발화에 `hover`부터 한다
- **`text=C00003 - 1회기`는 화면에 없다** — 일정 title은 안 그려지고 케이스 배지는 `C00003`뿐이다. 도착 대기는 `text=C00003`
- **필드노트 화면의 일정 시각은 저장값이 그대로 나온다** — 제품이 두 번 어긋나 상쇄된다: `+page.svelte:322`가 오프셋 없는 문자열을 `new Date(...)`로 **로컬(KST)** 파싱하고, `formatUtcToKst`가 다시 +9h 해서 UTC로 읽는다. 시드도 같은 관례로 쓴다(`seed/develop/counseling.py:230` 10시 = 오전 10시 회기). **제품 버그로 기록만 하고 고치지 않았다**(scene-prep §7). 그래서 SQL은 화면에 띄울 벽시계 시각(16:00)을 그대로 넣는다
- **시드는 필드노트를 만들되 전사는 안 채운다** — `status=completed`인데 화면은 "전사 데이터가 없어요."
- **`idb`는 `/usr/local/bin/idb_companion`을 고정 경로로 찾는다** — Apple Silicon(`/opt/homebrew/bin`)이면 못 본다 → `idb_companion --udid <UDID> --grpc-port 10882` 직접 띄우고 `idb connect localhost 10882`
- **`idb ui tap`은 픽셀이 아니라 포인트다** — iPhone 17 Pro는 402×874pt(1206×2622px, ×3)
- **`idb ui text`가 마지막 몇 글자를 흘린다** — 입력 후 `describe-all`로 `AXValue` 확인
- **개발 클라이언트가 두 번 막는다** — 시스템 다이얼로그(`열기`)와 개발자 메뉴(`Close`)

## 연쇄 — 이 이동이 건드리는 다른 장면 (고치지 않았다 · 보고만)

| 장면 | 무엇이 걸리나 |
|---|---|
| **s07 자동일지** | **2026-09-10에 같이 옮겼다 — 해소.** `s07-setup.sql`이 `case_code='C00003'`을 고르고 초안 본문 JSON을 **윤도현 전사에서 다시 썼다**(자기 이야기를 안 함 · 긴 침묵 · "말하면 걱정하잖아요" · 수면 곤란 · 하루 한 단어 기분 기록). 옛 §4(이하준 전사) 블록은 지웠다. 네 번 돌려 본문이 문자 단위로 동일 |
| **s08 케어보드** | 이하준의 보드다. 스트림의 `필드노트` 줄은 **시드가 만드는 필드노트 행**에서 나오고 전사 유무와 무관하므로 **화면은 안 깨진다** — §4를 지운 뒤 코드로 확인했다: 케어보드는 `status='completed'`이고 `summary`가 빈 문자열이 아닌 필드노트만 모은다(`field_note/repository.py:317-337`). §4가 건드리던 것은 `refined_transcript`·`refine_status`·`diarization_status`뿐이라 겹치지 않는다(DB 실측: 이하준 필드노트의 `status`·`summary` 그대로). 다만 "s05·s06·s07에서 쌓은 기록이 그대로 모인 화면"이라는 논지는 s06이 빠진 만큼 약해진다 |
| **s05 일정** | 이하준. 보호자 **이수진**의 변경 요청이 축이고 `s05-setup.sql`이 그 보호자 계정까지 만든다. **윤도현에게는 보호자가 없다**(s01은 아이 셋만 접수한다) — 옮기려면 보호자 인물·관계·앱 계정을 새로 지어야 한다 |
