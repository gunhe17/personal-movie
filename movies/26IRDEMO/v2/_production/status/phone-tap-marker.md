DONE — 탭 링 3컷(C4.3 · C5.6 · C7.4) · C3.6은 시드가 깨져 보류

# phone-tap-marker — 폰 컷에서 어디를 눌렀는지 보이게

갱신: 2026-09-14 23:1x

| 단계 | 한 줄 |
|---|---|
| ① `phone.mjs` 좌표 | `mark(kind, target, note, xy)` — 네 번째 인자로 좌표를 얹는다. `tap`은 `{x,y}`, `swipe`는 `{x,y,x2,y2}`. **`target`(라벨)은 한 글자도 안 바꿨다** — 기존 meta 계약 그대로고 필드가 늘기만 했다. 단위는 idb 포인트(기기 논리 좌표) |
| ①-b `pxPerPoint` | 기존 meta엔 포인트↔픽셀 배율이 **말로만** 있었다(`viewport.scale: "point-accurate (창 pt × 2)"`). `SPEC_PHONE.capture.pxPerPoint: 2`를 넣고 sckcap `--scale`이 이 값을 쓴다 → meta `capture.pxPerPoint`로 남는다. **SPEC_PHONE v3→v4** · `capture.md` 규칙 8 · `capture-service/SKILL.md` 같이 고쳤다. 웹 `SPEC`(v8)은 안 건드렸다 |
| ② 무대 탭 링 | `render.mjs` — spec 키 `taps`(촬영 meta 경로 또는 `[{t,x,y}]`) · `tapScale` · `tapRadius`(기본 42pt) · `tapDur`(기본 0.45s). 링 애니메이션을 straight-RGBA 원본 프레임 한 파일로 굽고(≈14프레임 · 2MB) 탭마다 같은 파일을 `tpad`로 시각만 밀어 `[u]`와 `[fg]` 사이에 얹는다 — Chrome을 한 번도 더 안 띄운다 |
| ②-b 좌표 변환 | **눈이 아니라 계산이다.** 합성이 촬영본을 슬롯에 앉히는 그 식을 그대로 푼다: 배율 `f = max((rect.w+2ov)/sw, (rect.h+2ov)/sh)`, crop이 잘라낸 만큼 뺀 원점 `ox·oy`. 무대 좌표 = `ox + 포인트×pxPerPoint×f`. 시각은 `t − start`, 구간 밖 탭은 안 그린다. 4K 폰 무대는 슬롯이 804×1748이라 `f = 1.0000`(1:1) |
| ②-c 색 | 흰 띠(α.92) 양옆에 잉크(#0E1B2E, α.45) 테. **흰 원만 그리면 밝은 앱 화면에서 사라진다** — 녹음 화면은 검고 시트는 희다. 가운데 점에도 같은 테. 저채도 · 형광 없음 |
| ②-d 자체 검사 | `render.mjs --selftest`에 넷째 판을 더했다 — 폰 무대를 탭 있는 판/없는 판으로 굽고 PSNR로 **링이 실제로 픽셀을 바꿨는지** 본다(60dB 미만이어야 통과). 통과 |
| ③ C4.3 t04 | `c43-record.mjs` 그대로 · API 3502 · `stage.mjs login` · `c43-pre-record.sql` → 촬영 → **`c43-restore.sql`로 되돌림(completed · notes 1 확인)**. 헤드리스 리허설 exit 0 뒤에 찍었다. `s04_phone_record_t04.mov` 22.6s · 804×1748 · notReady 0 · `--retake-of t03`. 흐름·노컷 구조는 t03과 같고 전체가 약 0.5초씩 뒤로 밀렸다(4.30–12.86 · 12.86–19.21). 완성본 **5.85–19.25 · 13.4s** — t03과 같은 길이. 탭 링 4 |
| ④ C7.4 t02 | `phone-link.mjs`(보호자 이수진 · guardian.lee@) → 리허설 exit 0 → 촬영. 16.12s · `--retake-of t01`. v1 타이밍이던 t01보다 탭 사이가 짧다. 완성본 **9.18–13.98 · 4.8s**(길이 유지) · 탭 링 1(바우처) |
| ④ C5.6 t03 | 같은 배선. 19.88s · `--retake-of t02`. t02는 SPEC_PHONE v1이라 t03이 3.5초 짧다 — 구간을 다시 잡아 **8.6–18.0 · 9.4s**로 길이를 지켰다(글 읽는 꼬리가 1초 길다). 탭 링 1(12회기 상담 내용 보기) |
| ④ C3.6 **보류** | 시드가 깨져 있다: 14회기 스케줄(`ca37e0de-…037`)이 DB에 **없다**. 되살리려면 `c37-approve-setup.sql`이 필요한데 그 파일 23행이 `update clients set person_id = (… guardian.leesujin@…)` — **이하준 클라이언트를 다른 보호자 계정에 다시 묶는다.** 지금 앱이 붙어 있는 계정은 `guardian.lee@`이고 C5.6·C7.4가 그 위에서 찍혔다. 컷 하나 때문에 다른 두 컷이 쓰는 연결을 뒤집지 않는다 — `C3.6_phone.mp4`는 t03(탭 링 없음) 그대로 둔다 |
| ④-b 겹침 | C5.6.json을 읽은 뒤 옆 작업이 **절차 표시줄을 `hold 01.png`만으로** 고쳤다(S5 정리). 내 판이 덮어써서 다시 맞추고 재합성했다 — `steps`는 cuts.json과 일치(무대 spec ↔ cuts.json 검사 통과). 같은 파일을 둘이 만질 때는 굽기 직전에 다시 읽는다 |
| ⑤ 원장 | cuts.json(세 컷 `source`·`segment`) · briefs S4·S5·S7 해당 블록(S7은 낡은 4.0s도 cuts.json대로 4.8s) · storyboard.html 썸네일 셋 교체(길이·타임코드는 안 바뀌었다 — 합계 4:32 그대로) |

## 라이브러리 계약이 어떻게 바뀌나 (한 줄)

`phone.mjs`의 `mark`가 네 번째 인자 `xy`를 받는다 — `tap`/`swipe` 마크에 `x`·`y`(`swipe`는 `x2`·`y2`)가 **추가**되고, meta `capture.pxPerPoint`가 그 포인트를 촬영본 픽셀로 옮긴다.
**기존 meta는 그대로 읽힌다** — 없던 필드가 생긴 것뿐이라 t01~t03 메타를 보는 도구는 아무것도 안 깨진다. 다만 좌표가 없으니 그 테이크로는 탭 링을 그릴 수 없다(그래서 재촬영이었다).

## 남은 것

- **C3.6**만 탭 링이 없다. 살리려면 ① `c37-approve-setup.sql` → `c36-phone-setup.sql`을 넣고 ② 앱을 `guardian.leesujin@`로 다시 링크해 찍은 뒤 ③ `phone-link.mjs`로 원래 계정을 되돌려야 한다. C3.7(웹)은 이미 찍혀 있어 DB를 다시 뒤집을 이유가 없다.
- 세 테이크의 `seed`는 `_seed/saas-2026-09-14c.json`으로 적었다 — 그 뒤 `c43-client.sql`·`c43-restore.sql`이 지나간 같은 계보의 DB다. 새 스냅샷을 뜨지 않았다.
- 스와이프는 좌표를 meta에 남기지만 무대는 **그리지 않는다**(탭만). C5.6·C3.6의 스크롤을 보여주려면 그때 궤적 레이어를 더한다.
