# Kling 3.0 영상 — base vs Omni, 파라미터, 공식 프롬프트 (조사 2026-09-14)

목적: S1~S3 AI 컷을 **Kling 3.0 i2v**로 움직일 때 어느 줄기를 쓰고 어떤 조건으로 부를지.
공식 문서(kling.ai) → API 스키마(fal · Alibaba · WaveSpeed) 순으로 모았다.
**Artlist 설정은 실측하지 못했다** — MCP가 이 세션에서 승인 대기였다.

## 결론

**Video 3.0 (base) Pro 1080p · 무음 · 끝 프레임 없음.** 공개 스키마에서 `negative_prompt`·`cfg_scale`을 받는 것은 base다.

> ⚠ **정정 — Artlist 실측 (2026-09-14, `get_model_config` 349).** Artlist는 **`negative_prompt`·`cfg_scale`을 노출하지 않는다.**
> 설정은 `resolution`(standard · pro · 4k) · `duration`(3~15, 기본 5) · `generate_audio`(기본 On) · `aspect_ratio`(기본 auto) ·
> `image_url` · `end_frame`뿐이다. I2V 모델: 3146 Pro 1080 무음 · 3145 Pro 유음 · 3143/3144 Standard · 3147/3130 4K.
> 입력 이미지는 `upload_image` → PUT → `confirm_upload`로 받은 `assetId`를 최상위 `input`으로 준다.
> **아래 표의 네거티브·cfg 이점은 Artlist 경로에서는 사라진다** — base를 고르는 근거는 i2v 순위와 가격만 남는다.
Omni만의 기능(다중 이미지 요소 · 영상 캐릭터 참조 · 음성 바인딩)은 우리 컷에 필요 없다. **Turbo는 피한다.**

## 1. 계보와 차이

- Omni는 VIDEO O1을, base는 VIDEO 2.6을 잇는다 — *"Building on the Kling VIDEO O1 and Kling VIDEO 2.6, the Kling 3.0 Model Series…"* ([Omni 가이드](https://kling.ai/quickstart/klingai-video-3-omni-model-user-guide))
- **base와 Omni의 화질 비교 주장은 공식 문서에 없다.** base 가이드는 2.6 대비 *"Overall realism of the visuals is significantly improved"*만 ([3.0 가이드](https://kling.ai/quickstart/klingai-video-3-model-user-guide))
- 공식 구분: v3 = prompt-led(멀티샷 · 프롬프트 충실도), Omni = reference-driven ([v3 vs O3](https://kling.ai/blog/kling-v3-vs-o3-comparison-guide))
- 공통: 3~15초(1초 단위) · 720p std / 1080p pro / 4K · 시작+끝 프레임 · 네이티브 오디오 · 멀티샷 최대 6샷
- 4K(3840×2160)는 2026-04-23 출시 ([공식](https://kling.ai/blog/kling-ai-introduces-native-4k-video-model))

### 파라미터 표

| | fal v3 pro i2v | fal o3 pro i2v | Alibaba kling-v3 / v3-omni | WaveSpeed v3.0 pro i2v |
|---|---|---|---|---|
| 입력 | `start_image_url` | `image_url` | `media:[{type:first_frame}]` | `image` |
| 끝 프레임 | `end_image_url` | `end_image_url` | `last_frame` (Turbo 불가) | `end_image` (멀티샷과 병용 불가) |
| prompt 최대 | 2500 | 2500 | 2500자 (중·영) | – |
| `negative_prompt` | **있음**, 기본 `"blur, distort, and low quality"` | **없음** | v3 · v3-omni 둘 다 있음 | 있음, 기본 없음 |
| `cfg_scale` | 0–1, 기본 0.5 | **없음** | 언급 없음 | 0–1, 기본 0.5 |
| 오디오 | `generate_audio` 기본 **true** | 기본 false | `audio` 기본 false | `sound` (켜면 ×1.5) |
| duration | 3–15, 기본 5 | 3–15, 기본 5 | 3–15, 기본 5 | 3–15 |
| 카메라 컨트롤 파라미터 | 없음 | 없음 | 없음 | 없음 |

출처: [fal v3 스키마](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/kling-video/v3/pro/image-to-video) ·
[fal o3 스키마](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/kling-video/o3/pro/image-to-video) ·
[Alibaba](https://help.aliyun.com/en/model-studio/kling-video-generation-api-reference/) ·
[WaveSpeed](https://wavespeed.ai/docs/docs-api/kwaivgi/kwaivgi-kling-v3.0-pro-image-to-video) ·
[Replicate v3](https://replicate.com/kwaivgi/kling-v3-video)

**충돌:**
- fal O3 HTML 페이지 요약엔 `negative_prompt`가 보였으나 **OpenAPI 스키마엔 없다 — 스키마를 믿는다**
- Alibaba는 v3-omni도 negative를 받는다 — **프로바이더마다 다르다. Artlist는 `get_model_config`로 확인한다**
- Runware의 "Negative prompt ignored when CFGScale ≤ 1"은 Kling cfg 범위(0–1)와 모순 — 공통 문구로 보인다 ([Runware](https://runware.ai/docs/models/klingai-video-3-0-pro))
- 공식 API 문서(kling.ai/document-api)는 JS 렌더링이라 원문 미확인

**Turbo** (2026-06-17): std/pro만, **negative · last_frame · 요소 없음**, *"The turbo model always generates video with audio."* ([Alibaba](https://help.aliyun.com/en/model-studio/kling-video-generation-api-reference/))

## 2. 공식 프롬프트 가이드

**i2v 공식** ([Image-to-Video Guide](https://kling.ai/quickstart/image-to-video-guide)):
> *"Prompt = Subject + Movement, Background + Movement"*
> *"Image-to-Video is already provided with a scene. Thus, it only requires the depiction of the subjects in the image and the intended movement for these subjects."*
> *"Use simple words and sentence structures"* · *"describe movements that are likely to occur in the image"*

**3.0 구조** ([프롬프트 가이드 2026-08-07](https://kling.ai/blog/kling-ai-prompt-guide)): *"subject, visible action, scene, camera language, lighting, and mood"* · *"visible motion language is safer and clearer"*. **권장 길이 수치 없음.**

**카메라 어휘** ([카메라 가이드 2026-08-13](https://kling.ai/blog/kling-ai-camera-control-video-guide)):
`Push in, Pull back, Pan left, Pan right, Tilt up, Tilt down, Track forward, Orbit slowly, Static camera` ·
속도는 `slow push-in` · `smooth pan` · `camera slowly pulls back`. **샷당 무브 하나.**
반례: *"Static camera with fast push-in and orbit movement"*. 고정은 `Static camera` / `stable camera`.

**3.0 가이드 i2v 예문의 톤**: *"Authentic workplace texture, one continuous long take without any cuts. The camera follows … steadily … freezes instantly when she pauses, with natural and smooth movements"*

**멀티샷**: `Shot 1, […]. Shot 2, […]` — 샷별 duration 합 = 전체. **샷 안 타이밍("처음 2초")은 공식 근거 없음.**

**언어**: 프롬프트는 중·영. 프롬프트 인핸서의 3.0 공식 설명·파라미터 없음.

## 3. 피할 것

- 재묘사 — 공식 i2v 논리 + fal: *"treat the input image as an anchor … focus on how the scene evolves"* ([fal 가이드](https://blog.fal.ai/kling-3-0-prompting-guide/)). **"재묘사 금지"를 명시한 3.0 공식 문서는 없다**
- 모호어("Make the camera cool") · 모순 카메라 · 피사체 변화와 카메라 이동의 중첩 · 복잡한 물리 동작
- *"Avoid drastic lighting changes"* · *"Avoid busy or moving backgrounds"* ([품질 가이드](https://kling.ai/blog/ai-image-to-video-quality-optimization-guide))
- 이미지와 크게 다른 묘사 → *"may trigger camera cuts"* (i2v 가이드)

## 4. 제한

| | 형식 | 용량 | 크기 | 비율 |
|---|---|---|---|---|
| Alibaba | JPEG/PNG | ≤10MB | 300–8000px | 1:2.5–2.5:1 |
| fal | – | ≤10MB | ≥300px | 0.4–2.5 |

권장 *"Minimum 1024x1024px (preferably 2K and higher)"*. 출력: pro 1920×1080(입력 비율 추종) · std 1280×720 · MP4 H.264.
**fps 충돌** — Alibaba 응답 `"fps": 24` vs 공식 블로그(3.0 이전) *"1080p/30 fps"* ([fps](https://kling.ai/blog/fps-motion-intensity-ai-video-quality)). "4K 60fps"는 제3자 주장뿐. **ffprobe로 확인한다.**
