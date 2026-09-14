# Kling 3.0 i2v 실측 — 실패 유형 · 프롬프트 패턴 (조사 2026-09-14)

손·책상·종이 클로즈업을 3~5초 다큐 톤으로 움직일 때 현장에서 무엇이 먹는가.
**한계:** Reddit은 fetch 차단으로 실측 0건, HN 스레드는 댓글 0, Artlist 도움말·블로그 403.
근거 등급 — **공식 / 다수 실측 / 단일 보고 / 추정 / SEO**(실측 없는 리스티클).

## 1. v3 vs O3 — i2v에는 v3

- **AA Image-to-Video**(오디오 부문): Kling 3.0 1080p Pro **1077** · 3.0 720p Std 1072 · **Omni 1080p Pro 1066** · Omni 720p 1058. Pro/Std 차이는 작다 — **다수 실측(블라인드 투표)** ([AA](https://artificialanalysis.ai/video/leaderboard/image-to-video))
- 파라미터: v3는 `negative_prompt`·`cfg_scale`이 있고 O3는 없다. **둘 다 seed 없음** — **공식(API)** ([fal v3](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video/api) · [fal o3](https://fal.ai/models/fal-ai/kling-video/o3/standard/image-to-video/api))
- 가격: O3가 약 25% 비쌈 — 5초 Pro 무음 v3 $1.12 / O3 $1.40 ([Segmind](https://blog.segmind.com/kling-v3-vs-kling-o3-which-video-model-should-you-use/)) · Std 초당 20 vs 25 크레딧 ([PixVerse](https://pixverse.ai/en/blog/kling-o3-and-3-0-now-available-on-pixverse))
- Segmind · Picsart · PixVerse의 "v3 vs O3" 비교글에 **i2v 실측은 없다 — SEO.** "Omni가 temporal consistency 최고"는 원자료 확인 실패

## 2. 실패 유형과 처방

| 증상 | 근거 | 처방 |
|---|---|---|
| **손가락** | *"occasional weird finger moments"* ([a2e](https://a2e.ai/kling-3-0-review/)) · *"hand detail … soft in one take"* ([vuela](https://vuela.ai/models/kling-3/review)) — 단일 보고 | 가장 작은 관절에 동작, 나머지 고정: *"fingers doing most of the motion. Shoulder and elbow remain steady"* · 손을 물건에 앵커 — **단일 실측(2.6)** ([WaveSpeed](https://wavespeed.ai/blog/posts/blog-kling-2-6-motion-control-prompt-patterns/)) |
| **가짜 글자** | 빈 종이 위 글자 생성 3.0 실측 **없음**. fal은 원본 텍스트 보존을 주장 ([fal](https://blog.fal.ai/kling-3-0-prompting-guide/)) | 추정: 획을 만드는 동사 금지, 펜 끝의 작은 움직임만. 네거티브 `text, letters` |
| **원치 않는 카메라** | 모델이 안정을 위해 움직임을 카메라로 떠넘긴다 — 단일 실측(2.6) | `Camera on tripod` 명시, 줌은 **숫자로** `5% zoom-in over 2 seconds` |
| **모든 게 움직임** | 모션 품질 최고는 *"one dominant vector, one hierarchy, no competing motion"*. 크고 대비 강한 앵커가 있어야 드리프트가 없다(*"geometric tethering"*). 한계에서 모델은 **충실도를 희생해 안정**을 지킨다 — **다수 실측(체계적 벤치, 한 기관)** ([Curious Refuge](https://curiousrefuge.com/blog/kling-3-ai-video-generator-review)) | 동작 하나 · 카메라 하나. 우리 프레임(키보드 · 책상 모서리 · 블라인드)은 앵커가 많아 유리하다(추정) |
| **슬로모션** | 극적 동작은 속도어와 무관하게 슬로모 처리 — 단일 실측 ([vicsee](https://vicsee.com/blog/kling-3-prompts)) | 추정: `at natural speed`, 극적 형용사 금지 |
| **컷 전환 · 새 인물** | 이미지와 크게 다른 묘사는 *"may trigger camera cuts"* — 공식(2.x 시기) | 프레임 밖 인물·행동을 암시하지 않는다 |
| **플리커 · 색 이동** | *"conflicting visual cues"*가 원인, Pro · 중간 motion intensity 권고 — 공식(수치는 마케팅) ([품질 가이드](https://kling.ai/blog/ai-image-to-video-quality-optimization-guide)). 멀티샷 컷 사이 색 이동 — 단일 실측 | 멀티샷을 쓰지 않는다 |
| **끝 워핑 · 루프 · 5 vs 10초** | 3.0 전용 실측 **없음** | 짧게. 편집 여유 1초만 |

## 3. 프롬프트 패턴

- **움직임만 쓴다** — fal *"focus on how the scene evolves from the image"* · 공식 `Subject + Movement` (공식)
- **길이 50–150단어** — O1 기준 파트너 가이드, 3.0 전이는 추정 ([fal O1](https://fal.ai/learn/devs/kling-o1-prompt-guide))
- **시간어** `gradually, smoothly, slowly`가 속도감에 도움 (파트너 가이드)
- **고정 절** `background remains motionless; only [X] moves` — 흔들림 감소, 단일 실측(2.6)
- **부정형**: 2.6에서 `no camera movement of any kind`는 **효과가 있었고** 긴 네거티브보다 짧은 국소 부정이 나았다. 3.0 역효과 보고 없음. → 긍정 상태 서술 먼저, 부정은 한 구절까지
- **시간 순서 서술** *"freezes when the subject pauses, resumes smoothly"* — 공식 3.0 가이드

권장 템플릿(추정, 위를 합친 것):
```
Locked-off tripod shot [또는 very slow dolly-in, about 5% over 5 seconds].
[손/손가락] [작은 동작] at natural speed; wrists and forearms stay steady.
Soft light through blinds stays constant. Everything else remains still.
```

## 4. 시작+끝 프레임

- 공식: 두 프레임은 *"as similar as possible"*, *"within 5 seconds"*, 다르면 *"may trigger a shot switch"* ([공식](https://kling.ai/quickstart/ai-video-start-end-frames))
- 같은 이미지를 시작·끝에 넣으면 루프 (2.x 플랫폼 문서) → **미세 움직임 샷에선 되감기처럼 보일 위험**(추정). 끝 프레임은 쓰지 않는다

## 5. cfg · 오디오

- cfg: v3 기본 0.5, 0–1(1이 가장 엄격). **값 비교 실측 0건**
- 오디오: fal 기본 true. 공식 가격 1080p 켬 12 / 끔 8 크레딧/초 ([Omni 가이드](https://kling.ai/quickstart/klingai-video-3-omni-model-user-guide)). **끄면 화질이 좋아진다는 근거는 없다** — 무음 B-roll이니 비용 때문에 끈다

## 남은 실측 — 자체 A/B로만 가를 수 있다

손 모핑과 가짜 글자는 공개 근거가 없다. 최소 설계: **같은 프레임 3장 × {v3 Pro, O3} × 프롬프트 2종**.
