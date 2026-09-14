DONE — C4.3 재촬영(t03 · 13.4s) · C4.4 4.0s로 단축 · `phone.mjs`에 `until` 추가

# c43-record-v2 — 녹음이 전사가 되고 정리로 넘어가는 데까지

갱신: 2026-09-14 22:4x

| 단계 | 한 줄 |
|---|---|
| ① `phone.mjs` until | `async until(라벨, note, timeout=20000)` — `idb ui describe-all`을 300ms로 폴링해 라벨이 뜨면 `T.settle` 뒤 마크(`(+N.Ns)`), 안 뜨면 던진다. 대상 찾는 길은 `tap`과 같다(`find`). SPEC_PHONE **v2→v3**(`timing.settle: 300` 추가) · `SPEC`(웹 v8)은 안 건드렸다. 자체 검사: 떠 있는 라벨 통과 · 없는 라벨 3초 타임아웃 → 종료 코드 0 |
| ② 제품(촬영용 사본) | 갈림길을 **회기 선택 시트 뒤로** 옮겼다 — `home.tsx` `onRecord`의 데모 분기를 빼고 `onSessionRecord` 머리에 넣었다(`EXPO_PUBLIC_FIELDNOTE_DEMO=1`일 때만). 그래서 제품의 진짜 진입(바로 녹음 → 연결 선택 시트)이 그대로 찍힌다 |
| ③ 데모 라우트 확장 | `app/(main)/field-note/demo.tsx` — 녹음 종료(`StopRecordingSheet`) → `ProcessingScreen`까지. 전사 줄 4개(0.8/2.0/3.2/4.4초) · 파이프라인 `transcribing 0s → refining 1.2s → completed 2.6s`. 제품 컴포넌트를 그대로 렌더하고 **상태만 대본으로 흘린다** |
| ④ 접근성 두 곳 | 정지 버튼에 `accessibilityLabel="녹음 멈춤"` · 키보드 내리는 껍데기 `Pressable`에 `accessible={false}`. **껍데기가 접근성 요소라서 배지·타이머·정지 버튼·전사가 한 덩어리 라벨이었다**(idb 트리 실측) — VoiceOver가 한 번에 다 읽고 정지 버튼에 초점이 안 갔다. 고치니 개별 선택이 된다 |
| ⑤ 데이터 | 재시드로 **윤도현이 사라져 있었다**(s01 접수가 촬영 중에 만드는 사람이다). `v2/_scripts/c43-client.sql` 신설 — s01 판에서 윤도현 한 줄만 뗀다. 순서: c43-client → `_scripts/s06-setup.sql` → `c44-time-fix.sql` → `c43-pre-record.sql`. 촬영 뒤 `c43-restore.sql`로 되돌렸다(C4.4·C4.5 상태 복구 확인: completed · notes 1) |
| ⑥ 리허설 | 헤드리스 리허설 3회. 1차 `녹음 멈춤` 요소 없음 → ④로 해결. 최종 exit 0 · 16.38s |
| ⑦ 촬영 | `s04_phone_record_t03.mov` **22.52s · 804×1748 · notReady 0 · appended=ticks(드롭 0)** · `--retake-of t02`. t01·t02는 그대로 둔다 |
| ⑧ 무대 | `C4.3_phone.mp4` 3840×2160 · 30fps · **5.2–18.6 · 13.4s**. 노컷 둘: 3.83–12.54(필드노트 → 회기 → 전사 세 줄) · 12.54–18.70(종료 → 음성 전사 → AI 보정 → 완료) |
| ⑨ C4.4 | **재촬영 안 했다.** 같은 테이크(`s04_web_fieldnote_t03.mov`)에서 구간만 4.7–8.7로 다시 잡아 `C4.4_imac.mp4` 4.0s로 재합성 — 스크롤이 멎으며 3:01 → 3:10 → 17:22이 한 화면에 서는 데까지만 |
| ⑩ 원장 | cuts.json(C4.3 13.4s · C4.4 4.0s · situation · segment · source) · briefs/S4.md 재생성(C4.5의 낡은 12.0s·v1도 cuts.json대로) · storyboard.html(카드 길이·썸네일 둘 · S4 29s→32s · 뒤 씬 타임코드 3초 이동 · 합계 4:29→**4:32**) |

## 전사 목을 어떻게 배선했나

**진짜 STT·LLM은 한 번도 안 불렀다.** llm-stub(3599)도 띄우지 않았다 — 이 컷은 API를 아예 안 탄다.

앞선 조사 결과: 제품의 청크 STT는 `production_ai_configs`의 model_name·system_prompt만 읽고 provider는 env로 간다
(`ai_gateway.py:596` → `infrastructure/stt/factory.py:16` → `whisper/client.py:56`이 `settings.OPENAI_BASE_URL`을 끼운다).
`apps/api/.env`는 이미 `http://localhost:3599/v1`이라 **API 경로는 스텁으로 우회돼 있다.** 그런데 그 길로 가려면
청크 오디오가 있어야 하고 시뮬레이터엔 마이크 입력이 없다 — 그래서 API를 태우는 대신 **앞선 세션이 만든 촬영용 데모 라우트를 넓혔다.**

고친 파일(촬영용 사본 `_tool/saas-center-platform`):

| 파일 | 무엇 |
|---|---|
| `apps/mobile/app/(main)/field-note/home.tsx` (`onRecord` · `onSessionRecord` 머리) | 데모 갈림길을 시트 뒤로 |
| `apps/mobile/app/(main)/field-note/demo.tsx` | 종료 시트 · ProcessingScreen · 대본 타이밍 |
| `apps/mobile/src/features/field-note/components/RecordingScreen.tsx` | 정지 버튼 라벨 · 껍데기 Pressable `accessible={false}` |

셋 다 `EXPO_PUBLIC_FIELDNOTE_DEMO=1`로 구운 빌드에서만 데모로 갈린다(라벨·접근성 수정은 항상 적용 — 그게 맞다).
대본은 s06-setup.sql이 DB에 넣는 윤도현 1회기 전사와 같은 줄이고, 배역은 CAST 안이다(윤도현 · 정상담).

## 브리프와 제품이 어긋난 자리 (편집이 알아야 한다)

| | 브리프 · 지시 | 제품 |
|---|---|---|
| 종료 후 단계 | `음성 전사 중 → AI 보정 중 → 요약 생성 중 → 상담일지 작성 중` 넷 | **둘뿐이다.** `executor.py:61` `_PIPELINE_STEPS = [TRANSCRIBING, REFINING]`이고 `ProcessingScreen`의 스텝퍼도 둘만 그린다 — 요약·일지 초안은 파이프라인이 아니라 상세 화면의 온디맨드다(그게 C4.5다). 그래서 `상담일지 작성 중`은 **연출하지 않았다.** 화면은 `음성 전사 → AI 보정 → 2/2 · 정리가 완료되었어요`로 끝난다 |
| 확인창 | "지금 녹음을 시작할까요? … 뒤에 시작해요"를 통과하거나 시각을 맞춘다 | **안 뜬다.** 회기가 오늘 16:00이고 촬영은 22:2x라 `remainMs`가 음수다(`home.tsx` `EARLY_RECORD_CONFIRM_MS`) |
| 홈 첫 화면 | "홈 — 다음 일정 16:00 윤도현" | 촬영 시각이 밤이라 앱 홈은 `좋은 저녁이에요 · 다음 일정 23:00 김영희님의 검사`다. 그래서 **컷을 필드노트 홈부터 시작했다**(5.2s) — 거기엔 `16:00–16:50 윤도현 · 개인상담`이 그대로 있다. 앞선 t02가 쓰던 메인 홈 도입부는 버렸다 |
| 종료 시트 | — | 다크 녹음 화면 위에 **밝은 바텀시트**가 올라온다(BottomSheet 기본 라이트). 제품 실제 화면이라 그대로 찍었다 |

## 남은 것

- `_scripts/c43-record.mjs`의 마크 note가 `오늘 기록할 일정 1건`이라고 적혀 있다 — 실제 화면은 **2건**(23:00 김영희 검사가 같이 선다). t03 meta가 이 문자열을 들고 있어 고치지 않았다.
- 데모 라우트는 `EXPO_PUBLIC_FIELDNOTE_DEMO=1` 빌드에서만 열린다. 이 플래그는 `phone-stage`의 `stage.mjs build`가 넣지 않는다 — **환경변수로 직접 넣어야 한다**(`EXPO_PUBLIC_FIELDNOTE_DEMO=1 node stage.mjs build`).
- 윤도현은 지금 `c43-client.sql`이 만든 한 줄이다 — s01을 다시 찍으면 같은 이름이 둘이 되지 않게 이 행을 먼저 지워라.
