---
name: frame-to-video
description: v2 AI 컷의 채택 첫 프레임(first-frame.png)과 모션 프롬프트(motion.md)를 받아 Kling 3.0 image-to-video로 영상을 만든다. 모션 프롬프트를 확정 문법으로 쓰고, 린트로 알려진 실패를 막고, 생성물을 즉시 로컬에 보관하고, 한 테이크를 채택한다. "영상 만들어줘", "첫 프레임 움직여줘", "sNN 클립 뽑자", "모션 프롬프트 써줘", "i2v", "테이크 저장", "클립 채택" 요청에 쓴다. 첫 프레임 생성은 first-frame, 서비스 화면 촬영은 capture-service다.
---

# frame-to-video — 첫 프레임을 움직인다

`first-frame`이 만든 한 장을 3~5초 컷으로 움직인다. **이 스킬이 만드는 것도 화면 바깥의 세계다** —
제품 화면은 `capture-service`가 찍고 `motion-stage`가 끼워 넣는다.

조사는 [`_research/16-kling3-video-official.md`](../../../movies/26IRDEMO/v2/_research/16-kling3-video-official.md)(공식 · API 스키마)와
[`17-kling3-i2v-field.md`](../../../movies/26IRDEMO/v2/_research/17-kling3-i2v-field.md)(실측 · 커뮤니티). 규칙마다 근거가 거기 있다.

| | |
|---|---|
| **모델** | **Kling 3.0** (base · Video 3.0) — Artlist `modelGroupId` **349** "Kling v3 [Kling direct]" |
| 설정 | `resolution: pro`(1080p) · `aspect_ratio: 16:9` · `generate_audio: false` — **Artlist가 주는 것은 이것과 `duration`뿐이다** |
| 모델 | `modelId` 3146 "Kling v3 Pro (1080) - No Audio - I2V" — `modelGroupId` 349 + `generate_audio: false`로 간다 |
| 길이 | 컷 길이(`cuts.json`) **+1초** 편집 여유. 3.0은 3~15초 |
| 끝 프레임 | **쓰지 않는다** (§함정) |
| 대상 | 지금은 **S1~S3의 AI 컷 10개** — 전부 `motion.md` 초안이 들어 있다 |

## 왜 3.0 base 인가 — O3(347)가 아니다

| | **3.0 base (349)** | 3.0 Omni = O3 (347) |
|---|---|---|
| AA **i2v** 리더보드 | **1077** (1080p Pro) | 1066 |
| `negative_prompt` · `cfg_scale` | fal 스키마엔 있다 — **Artlist엔 없다** | 없다 |
| 가격 | 기준 | 약 25% 비쌈 |
| Omni만의 것 | — | 다중 참조 · 요소 · 영상 캐릭터 참조 · 음성 바인딩 — **우리 컷에 필요 없다** |

첫 프레임 한 장에서 작은 움직임을 내는 일에는 base가 순위·가격에서 앞선다.
**Kling v3 Turbo(402)는 쓰지 않는다** — 끝 프레임이 없고 오디오가 항상 켜진다.

> **Artlist `get_model_config` 349 실측 (2026-09-14)** — `resolution`(standard · **pro** · 4k) · `duration`(3~15, 기본 5) ·
> `generate_audio`(**기본 On**) · `aspect_ratio`(**기본 auto** · 16:9 · 9:16 · 1:1) · `image_url` · `end_frame`.
> **`negative_prompt`와 `cfg_scale`이 없다.** 조사(fal 기준)와 다르다 — 배제는 전부 본문의 긍정 상태 서술로 한다.
> 기본값이 둘 다 우리 반대라 **`generate_audio: false` · `aspect_ratio: 16:9`를 반드시 명시한다.**

## 사이클

```
1 first-frame.png 확인 → 2 motion.md → 3 check → 4 call(페이로드) → 5 견적 → 6 생성 → 7 save → 8 판정
                          ↑                                                                    ↓ 실패
                          └────────────────────── 테이크 번호를 올려 다시 ──────────────────────┘
                                                                                     ↓ 통과
                                                                                  9 pick
```

**프레임과 달리 한 번이 비싸다.** 5초 1080p 무음이 O3 기준 500 크레딧이다(3.0 base 단가는 견적으로 확인).
그래서 **프롬프트를 린트와 눈으로 다 고친 뒤에 한 번 부른다.** 결함이 첫 프레임에 있으면 영상을 다시 뽑지 말고 `first-frame`으로 돌아간다.

## 러너

```bash
node .claude/skills/frame-to-video/scripts/video.mjs <명령>

  new   <컷>                               motion.md 골격 (first-frame.png 필수)
  check <컷>                               모션 프롬프트 린트 — 종료 코드 2가 불합격
  call  <컷> [--duration N]                Artlist 호출 페이로드 + 입력 이미지 경로
  gen   <컷> --max-credits N [--take N]    헤드리스 생성(업로드 → 견적 → 생성) → save 까지
  save  <컷> --take N [옵션] <url|경로>      내려받기 + sheet.png + motion.json 기록
        --gen <generationId> --credits <n> --duration <n> --note "…" --force
  pick  <컷> <파일> [--note …]              채택 → CN.N_ai.mp4 (컷 길이 · 30fps · 절차 표시줄 · 무음)
  list  [컷]                               테이크 목록
  selftest                                린트 자체 검사
```

**생성은 `gen`이 한다.** 헤드리스 세션(`claude -p`)에 Artlist 도구 다섯(`upload_image` · `confirm_upload` · `get_generation_cost` ·
`generate_video` · `get_generation_status`)과 `curl`만 열어 업로드 → 견적 → 생성 → 폴링을 맡기고, 결과 URL을 곧바로 `save`한다.
**대화 세션에 Artlist 도구가 없어도 된다** — 필요한 건 이 컴퓨터의 인증뿐이다(`node .claude/skills/artlist/scripts/artlist.mjs verify` 종료 0).
인증은 기기마다 따로다. 다른 컴퓨터에서 첫 프레임을 뽑았어도 여기서 `/mcp` 인증을 한 번 한다.

- **`--max-credits`는 필수다.** 견적이 넘으면 생성하지 않고 종료 코드 3. 1080p 무음은 **초당 100 크레딧**(C1.1 4초 = 400 실측)
- 실패하면 `tN-gen-fail.log`를 컷 폴더에 남긴다. 테이크 폴더는 성공했을 때만 생긴다
- 여러 컷을 동시에 돌려도 된다 — 컷마다 업로드·생성이 따로다

### 컷 폴더

```
movies/26IRDEMO/v2/sNN-cN-이름/
  first-frame.png    입력 (first-frame 스킬의 채택본 1920×1080)
  prompt.md          첫 프레임 프롬프트 — 여기 적힌 "during a …" 무브를 이월한다
  motion.md          ★ 모션 프롬프트 정본. save 가 테이크마다 스냅샷한다
  motion.json        테이크 기록 — generationId · 크레딧 · 설정 · 프롬프트 전문 · 첫 프레임 해시 · ffprobe · 판정
  t1/ t2/ …          테이크별 원본 mp4 · sheet.png
  CN.N_ai.mp4           완성본 — 무대 컷(CN.N_imac.mp4)과 같은 자리. cuts.json 길이로 자르고 30fps · 절차 표시줄 · 무음 (1920×1080)
```

## 1. 모션 프롬프트를 쓰는 법

골격은 [`templates/motion.md`](templates/motion.md). **영어로, 40~100단어, 세 덩어리**다.

```
Very slow dolly in, about 5% over the whole shot.                       ← 카메라 하나
The fingers … at natural speed; the wrists stay resting ….               ← 주 동작 하나 + 나머지 고정
The page stays blank apart from its faint ruled lines.                   ← 지킬 상태 (네거티브 대신)
Everything else remains still and the light stays constant.              ← 고정 절
```

| | 규칙 | 근거 |
|---|---|---|
| 1 | **장면을 다시 쓰지 않는다** — 룩·구도·팔레트·렌즈는 첫 프레임이 이미 준다 | 공식 i2v: "already provided with a scene… only requires the subjects and the intended movement". 재묘사는 모션을 줄이고, 이미지와 어긋난 묘사는 **컷 전환**을 부른다 |
| 2 | **카메라는 정확히 하나, 움직이면 숫자로** — `about 5% over the whole shot` | 공식 카메라 가이드: 샷당 무브 하나, 섞인 신호 금지. 지시가 없으면 모델이 발명한다. 숫자 지시가 원치 않는 줌을 멈췄다(2.6 실측) |
| 3 | **손 동작 컷은 `Locked-off tripod shot`부터.** 움직이면 첫 프레임의 무브만 | **C1.1 t1 실측** — 5% 돌리인 + 펜 손 동작이 겹치자 카메라가 오른쪽으로 크게 돌고 수첩 모양까지 바뀌었다(시작↔끝 SSIM 0.57). 같은 날 **Locked-off로 뽑은 C1.3·C1.4·C1.5는 0.85·0.81·0.85**였고 셋 다 통과했다 |
| 4 | **주 동작 하나, 가장 작은 관절에** — 나머지 관절은 고정 | Curious Refuge 벤치: "one dominant vector, no competing motion"일 때 모션 품질 최고. 손가락에 동작, 손목·팔 고정이 떨림을 줄였다(2.6 실측) |
| 5 | **고정 절을 넣는다** | "only X moves, background remains motionless"가 의도치 않은 흔들림을 줄였다 |
| 6 | **사람 명사·대명사를 쓰지 않는다** — 주어는 손·손가락·물건 | 첫 프레임 배치에서 사람 명사가 얼굴을 8/26 불렀다. 영상은 프레임 밖에서 사람을 새로 들일 수 있다 |
| 7 | **글자를 만드는 동사를 쓰지 않는다** — `writes a note` 대신 `makes one small tick mark` | 빈 종이·꺼진 화면 위에 가짜 글자가 생긴다. 필기는 체크 표시 하나, 폰은 화면이 꺼진 채로 |
| 8 | **`at natural speed`, 극적 어휘 금지** | 3.0은 극적 동작을 속도어와 무관하게 슬로모션으로 처리했다 |
| 10 | **첫 프레임에 화면(모니터·폰·노트북)이 있으면 잠금 절** — `the monitor screen stays dark` · `the monitor stays beyond the top edge` | **C1.1 t1 실측** — 프레임 위 모서리의 꺼진 모니터에 2.5초부터 가짜 글자(`BAULIO KCCTTOSBIAT…`)가 떴다. 린트가 `prompt.md`에서 화면을 찾아 강제한다 |
| 9 | **배제는 긍정 상태로** — `the page stays blank` · `the screen stays dark`. 본문 부정어는 최대 하나 | Artlist 349에는 negative_prompt가 없다. 본문의 짧은 국소 부정 하나는 먹었다(2.6), 긴 부정은 소환으로 작동한다(첫 프레임 랩) |

### `check`가 잡는 것

재묘사 어휘 · 카메라 0개/2개 이상 · 이월 무브와 다른 방향(경고) · 글자 생성 동사 · 사람 명사·대명사 ·
본문 부정어 2개 이상 · `Negative:` 줄(Artlist에 필드가 없다) · 화면 있는 첫 프레임의 잠금 절 누락 · 움직이는 카메라(경고) · 속도·극적 어휘(경고) · 고정 절 없음(경고) · 15~150단어 밖 · 슬롯·주석.

### 아직 처방이 없는 것 — 첫 테이크들이 가를 것

- **손 모핑** — 3.0에도 "occasional weird finger moments"가 있다. 타이핑(C1.3)·필기(C1.5)가 가장 위험하다. 손을 물건에 붙인 컷부터 뽑는다
- **빈 종이 위 가짜 글자** — C1.1 t1은 `the page stays blank`로 종이는 버텼다(화면은 못 버텼다 → 규칙 10). 체크 표시를 긋는 C1.5가 다음 판정이다
- **손이 지시보다 크게 움직인다** — C1.1 t1은 "펜 끝을 내려놓아라"에 손을 들어 펜을 눕히고 전화기 쪽으로 옮겼다. 도착 상태를 주면 거기까지 가는 경로를 지어낸다 — 관절 하나의 작은 동작으로 쓴다

## 2. 입력 이미지

**`first-frame.png`(채택 크롭본 1920×1080)를 올려서 준다.** 10MB·300px·비율 0.4~2.5 조건 안이다.

```
upload_image { mimeType: "image/png", fileName }      → uploadUrl · uploadId
curl -X PUT -H "Content-Type: image/png" --data-binary @first-frame.png <uploadUrl>
confirm_upload { uploadId, mimeType: "image/png" }    → assetId
generate_video { …, input: { assetId } }
```

- **`image_url`은 `settings`로 못 준다** — config가 명시한다: `_upload` 설정은 settings가 아니라 `input: { assetId }`
- `input: { generationId, outputIndex }`도 받지만 그것은 **크롭 전 2720×1536 원본**이다. 채택본은 크롭본이므로 업로드를 쓴다

## 3. 견적 → 생성

```
video.mjs call <컷> → get_generation_cost(input 포함) → (승인) → 생성 → get_generation_status 폴링
```

- **I2V는 입력 이미지 없이 견적이 안 난다**(`wrong_feature`) — `input`을 넣고 견적한다
- 비싼 호출은 `confirmation_required`로 물러난다 — **사람 승인 없이 크레딧을 쓰지 않는다**
- **오디오를 끈다.** Artlist 349의 기본이 **On**이다. O3 기준 +300 크레딧(60%)이고 화질 이득 근거는 없다
- `generate_video`의 `confirmCost: true`는 **견적을 사람이 본 뒤에만** 준다
- 응답의 `resolvedSettings`로 해상도·길이·오디오를 확인한다. **SKU 이름을 믿지 않는다**

## 4. 즉시 보관한다

```bash
node …/video.mjs save s01-c1-전화한통 --take 1 --gen <generationId> --credits <n> <url>
```

**시드가 없고 생성물은 30일 뒤 서버에서 사라진다.** `save`가 mp4를 받고, 프롬프트·네거티브·설정·**첫 프레임 해시**를
`motion.json`에 스냅샷하고, ffprobe(해상도·fps·길이·오디오)를 남긴다. 테이크 폴더는 덮어쓰지 않는다.
원본 mp4는 `.gitignore`다 — 저장소에는 `sheet.png`·`motion.json`·채택본 `CN.N_ai.mp4`만 남는다.

## 5. 판정 — 사람이 눈으로 본다

`t N/sheet.png`는 **입력 첫 프레임 | 0% · 33% · 66% · 끝** 다섯 칸이다. 먼저 이것으로 거르고, 후보는 **100%로 재생**한다.

1. **손** — 손가락 수 · 관절 · 손이 물건을 통과하는가. 하나라도 있으면 탈락
2. **끝 프레임** — 마지막 1초가 녹거나 휘는가. sheet의 마지막 칸이 첫 칸과 같은 세계인가
3. **카메라** — 지시한 무브만 있는가. 지시 안 한 팬·줌·흔들림
4. **글자·사람** — 종이·화면에 글자가 생기는가. 프레임 가장자리에서 얼굴·몸이 들어오는가
5. **속도** — 실제 속도인가, 슬로모션인가. 되감기(동작이 돌아가는 것)가 있는가
6. **빛** — 플리커 · 색 이동
7. **여백** — 자막 자리가 끝까지 비어 있는가
8. **옆 컷과 이어지는가** — 같은 씬의 이전·다음 컷(촬영본 목업 포함) 옆에서 본다. **이것이 최종 기준이다**

통과하면 `pick`. **무대 컷과 같은 완성본을 굽는다** — cuts.json `length`로 앞에서부터 자르고(생성 +1초 여유는 여기서 버린다) · 30fps · 무음 ·
cuts.json `steps`의 절차 표시줄(`_assets/steps/SN-흐름/`)을 motion-stage `render.mjs`와 같은 규칙으로 얹는다: head는 0초부터, hold PNG는 그 뒤로 tail 앞까지, tail은 끝에.
`steps`가 null인 컷(C1.1)은 표시줄 없이 자르기만 한다. 원본 테이크는 `tN/`에 그대로 남는다 — 다시 `pick`하면 언제든 새로 굽는다.

## 이 스킬이 하지 않는 것

| | 누가 |
|---|---|
| 첫 프레임 생성 · 채택 | `first-frame` |
| 마인드스코프 서비스 화면 촬영 | **`capture-service`만** (`.claude/rules/capture.md` 규칙 1) |
| 한글 자막 · 카카오톡 PNG · 절차 표시줄 얹기 | `motion-stage` · 편집 |
| MCP 연결·인증 | `artlist` |

**생성물을 `raw/`에 넣지 않는다.** 편집 소재이지 촬영본이 아니다.

## 함정

- **"Kling 3.0"이 Artlist 안에서 세 줄기다** — base 349 · Omni(O3) 347 · Turbo 402. 이 스킬은 **349**다. `first-frame`의 "v3는 쓰지 않는다"는 **이미지** 모델(355) 이야기다
- **끝 프레임을 쓰지 않는다.** 같은 이미지를 끝에 넣으면 왕복(되감기)이 되고, 다른 이미지면 "as similar as possible"을 어길 때 컷 전환이 난다. 무브가 필요하면 프롬프트로 준다
- **멀티샷(`multi_prompt`)을 쓰지 않는다.** 한 컷 = 한 샷. 멀티샷은 샷 사이 색이 흔들렸다
- **seed가 없다.** 같은 프롬프트로 다시 뽑아도 다른 결과다 — 좋은 테이크는 즉시 `save`
- **fps는 24/30이 엇갈린다.** `save`가 ffprobe로 찍는다. 60fps 촬영본 목업과 섞을 때 편집에서 맞춘다
- **아동이 나오는 프레임**(C2.1의 작은 손)은 커뮤니티 가이드라인 미성년자 조항에 걸릴 수 있다. 거절되면 그 손을 프레임 밖으로 뺀 첫 프레임부터 다시 뽑는다
- **Artlist 라이선스는 납품 전에 사람이 확인한다.** IR 영상은 대외 공개물이다
