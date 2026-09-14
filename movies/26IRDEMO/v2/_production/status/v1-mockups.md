DONE

# v1-mockups — v1 재사용 10컷 + 카드·로고 2컷

원본은 `movies/26IRDEMO/v1/sNN-*/raw/`(읽기만). 잘라 둔 중간본 `v2/_mockups/src/`, spec `v2/_mockups/spec/`,
결과 `v2/_mockups/*.mp4` (1920×1080 · 30fps · 무대 배경은 기본 그라디언트, 자막 없음).

| 컷 | 테이크 | 구간(초) | 무대 | 길이 | 파일 | 비고 |
|---|---|---|---|---|---|---|
| C0.1 | — | — | cells | 12.0s→12.00s | C0.1_cards.mp4 | 새 무대 `cells`(검은 지면·일곱 칸). 기존 `cards`는 로샤 자료 전용이라 섞지 않았다. 5번째부터 반 박자 지연 |
| C1.8 | s01_web_intake_t07 | 9.4–21.4 | imac | 12.0s→12.00s | C1.8_imac.mp4 | 계획 구간 8.0–21.4(13.4s)에서 앞 1.4s 트림. 노컷 18.66–21.35 보존 |
| C1.10 | s04_web_sendlink_t03 | 1.9–11.9 | imac | 10.0s→10.00s | C1.10_imac.mp4 | |
| C2.3 | s02_web_collect_t05 | 5.3–15.2 | imac | 10.0s→9.90s | C2.3_imac.mp4 | |
| C2.4 | s03_web_aireview_t10 | 2.24–15.72 | imac | 12.0s→13.50s | C2.4_imac.mp4 | **길이 초과 +1.5s.** s03 notes.md 선택본은 `aireview` 하나(t10·17.20s)이고 노컷이 2.24–15.72로 13.48s다 — 자르면 노컷을 깬다. 노컷 보존을 택했다. 홀드(15.72–16.32)만 뺐다 |
| C3.6 | s05_phone_request | — | phone | — | — | **차단: 테이크 없음 → 신규 촬영 필요.** s05-일정/raw에 폰 테이크는 `s05_phone_smoke_t01`(도구 시험 촬영)뿐 |
| C3.7 | s05_web_approve_t05 | 4.4–16.4 | imac | 12.0s→12.00s | C3.7_imac.mp4 | 계획 구간 4.0–16.4(12.4s)에서 앞 0.4s 트림 |
| C4.4 | s06_phone_fieldnote-app_t01 | 5.0–13.0 | phone | 8.0s→8.00s | C4.4_phone.mp4 | 노컷 5.72–11.04 보존 |
| C4.5 | s06_web_fieldnote_t02 | 4.0–10.0 | imac | 6.0s→6.00s | C4.5_imac.mp4 | 노컷 4.22–9.47 보존 |
| C4.6 | s07_web_draft_t04 | 1.9–14.6 | imac | 12.0s→12.70s | C4.6_imac.mp4 | **+0.7s.** cuts.json이 "전체 · 자르지 않는다"로 지정한 구간 그대로 |
| C7.4 | s09_web_noshow_t03 | 1.9–12.2 | imac | 10.0s→10.30s | C7.4_imac.mp4 | +0.3s (±0.5 안) |
| C8.1 | — | — | logo | 9.0s→9.00s | C8.1_logo.mp4 | 로고 `_motion/brand/mindscope-mark.svg`. S8 브리프의 move대로 한 줄 7초 → 로고 → 배경. `logo` 무대에 `copy`·`logoAt` 필드를 더했다(없으면 종전과 동일) |

## 무대 쪽 변경 (motion-stage 스킬)

- `scripts/stages/cells.html` 신규 — 검은 지면에 칸이 차례로 켜진다. 칸 이름·간격·반 박자 지연 전부 spec.
- `scripts/stages/logo.html` — `copy`(한 줄) · `copyAt` · `copyOut` · `logoAt` 추가. 기본값이 종전 동작이라 `logo-intro.json`은 그대로다. `--selftest` 통과 확인.
