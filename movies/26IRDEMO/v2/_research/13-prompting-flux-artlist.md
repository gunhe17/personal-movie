# FLUX.2 · Artlist Original 1.0 프롬프트 (조사 2026-09-13)

## 0. Artlist Original 1.0의 정체

`fal-ai-flux-2-lora` = fal의 `fal-ai/flux-2/lora` 엔드포인트(**FLUX.2 [dev] 베이스 + LoRA**) 위에
**Artlist가 자사 스톡 푸티지로 학습시킨 스타일 LoRA 4종**을 드롭다운으로 얹은 것.

> 공식 블로그: *"trained on Artlist's own catalog of **cinematic footage**, not broad internet imagery"*

| LoRA | 공식 설명 (블로그 / 제품 페이지) |
|---|---|
| **Professional** | *"balanced, neutral, versatile for commercial work"* / *"sharp, corporate, broadcast standards"* |
| **Cinematic** | *"artistic with **narrative tension and drama**"* / *"**high-drama**, filmic looks"* |
| **Indie** | *"textured, moody, grounded contrast"* / ***"raw, authentic, documentary feel"*** |
| **Commercial** | *"premium, aspirational, **polished**, and luxury"* |

**노출된 설정은 다섯뿐이다**: `prompt` · `aspect_ratio` · `arlist_model` · `resolution` · `num_images`.
**`seed` · `guidance_scale` · LoRA strength · steps · `negative_prompt` 전부 숨겨져 있다.**

> ⚠ **시드가 없으므로 마음에 드는 결과를 재현할 수 없다. 나오면 즉시 저장한다.**

### 없는 것
벤치마크 없음 · 예시 프롬프트 공개 없음 · 트리거 워드 문서 없음 · 커뮤니티 테스트 없음.
**트리거 토큰을 추측해 프롬프트에 넣지 말 것** — 무의미하거나 노이즈가 된다.

편집자 Jonny Elwyn 실사용: *"I am really impressed by the quality"* 그러나
**네 스타일이 "극적으로 다르게 느껴지지 않는다"**고 적었다.

---

## 1. ⭐ 네거티브가 **역효과를 낸다** — 이번 랩 실패의 원인

FLUX.2에는 **API 레벨에 `negative_prompt` 필드가 없다**(fal OpenAPI 스키마 직접 확인).
BFL 공식: *"FLUX.2 does not support negative prompts. **Focus on describing what you want, not what you don't want.**"*

그리고 이유가 구조적이다. FLUX.2는 guidance-distilled라 무조건부 경로를 모델 안으로 접어 넣었다.
더 나쁜 것은:

> **"English negation actively backfires — the Mistral encoder reads 'a person without glasses'
> as semantically loaded with the word 'glasses' and frequently renders them anyway."**

**→ `_lab/01-model-bakeoff`의 Kling 라운드 1이 정확히 이것이었다.**
`No face and no head in frame`이 얼굴을 오히려 불러냈다. **모델이 달라도 같은 함정이다.**

### 지우고 싶은 것을 긍정문으로 바꾸는 표

| 지울 것 | ❌ 쓰지 말 것 | ✅ 쓸 것 |
|---|---|---|
| **얼굴** | `no face` | **프레이밍으로 해결** — `her head and face outside the frame above the top edge` · `cropped at the elbows` |
| 텍스트·간판 | `no text` `no signage` | `the counter surface **bare and unmarked**` · `plain wall with **nothing printed on it**` |
| 로고·브랜드 | `no logos` `no watermark` | `**unbranded** plain objects` · `clean image, professional photography` |
| 잡동사니 | `no clutter` | `a bare concrete floor, edge to edge` |
| 흐림 | `no blur` | `crisp focus with razor-sharp details` |

원칙: *"identify the unwanted element, **ask what would fill that space**, then describe that positively."*

---

## 2. BFL 공식 프롬프트 구조

```
Subject + Action + Style + Context
어순: Main subject → Key action → Critical style → Essential context → Secondary details
```

| 길이 | 공식 권고 |
|---|---|
| Short (10–30 단어) | 빠른 컨셉·스타일 탐색 |
| **Medium (30–80 단어)** | **대부분의 작업에 이상적** |
| Long (80+ 단어) | 상세 지정이 필요한 복잡한 장면 |

포토리얼리즘 공식 예시구:
`"shot on Sony A7IV, clean sharp, high dynamic range"` · `"shot on Kodak Portra 400, natural grain, organic colors"`

**hex 컬러 코드를 직접 지정할 수 있다** (`color #FF5733`) — 공식 기능. **팔레트를 박는 가장 확실한 수단.**

---

## 3. 토큰 — FLUX.1과 근본적으로 다르다

**FLUX.1**: CLIP-L(77토큰) + T5-XXL(512토큰) 이중 인코더 → "앞쪽 키워드 뭉치"가 통했다.
**FLUX.2**: **Mistral-Small-3.2-24B 단일 VLM 하나.** `max_sequence_length` = **512**.

→ **SDXL식 가중치 문법 `(word:1.5)` · `++`는 조용히 무시된다. 쉼표 태그 나열도 약하다. 산문으로 쓴다.**

fal 공식: **"prompts exceeding 100 words create confusion"** ·
순서는 *subject first, environment second, style third, technical specifications last* ·
*"content words (nouns and proper nouns) exerting stronger effects than modifiers."*

---

## 4. 플라스틱 피부

**FLUX.2 고유 결함 둘**:
1. t2i 인물 얼굴 품질이 *"often does not come close to the quality of Flux.1"*
2. **과채도** — CFG를 낮추면 완화되는데 **Artlist에서는 CFG를 못 만진다.**
   **→ 저채도를 원하면 프롬프트에서 명시적으로 지정해야 한다.**

**손은 강점이다.** FLUX 계열은 손가락 수·포즈가 정확한 편이고 FLUX.2는 *"stronger anatomical grounding than FLUX.1"*.
(손가락 융합 보고는 klein 4-step 증류판 것이고 우리가 쓰는 dev 베이스에는 해당 없음)

### 실제로 듣는 구절
`natural skin texture with visible pores` · `subtle fine lines` · `realistic uneven skin tone` ·
**`matte skin`**(번들거림 억제에 가장 자주 인용되는 단일 구절) · `subtle imperfections` ·
`fine grain` / `35mm film grain` · `slightly asymmetric, candid composition`

### 안 듣는 것
`more realistic` · `ultra realistic` · `8k` · `masterpiece` 류.

> *"Adding 'more realistic' rarely fixes it because the model does not know which axis failed:
> skin material, lens, light, retouching, or negative constraints. **Name the broken axis.**"*

---

## 5. LoRA가 프롬프팅을 바꾸는 지점

**⚠ 스타일 LoRA와 프롬프트 스타일어가 충돌한다.** 이게 실질적 리스크다.

> fal: *"Never conflict styles: Requesting 'photorealistic portrait' and 'watercolor painting style'
> simultaneously confuses the model."*

LoRA가 이미 시네마틱 컬러를 걸고 있는데 프롬프트에서 또 `cinematic color grade, teal and orange`를 겹치면
**이중 적용**이 되어 과채도·과대비로 간다. FLUX.2의 과채도 결함과 겹쳐 악화된다.

> **원칙: LoRA가 이미 주는 것은 프롬프트에서 빼고, LoRA가 안 주는 것만 지정한다.**

---

## 6. 실증적으로 반응하는 촬영 어휘

- **카메라**: `Hasselblad X2D` · `Canon 5D Mark IV` · `Sony A7IV` · `Fujifilm X-T5`
- **초점거리** 14~135mm · **조리개** f/1.4~f/16
- **조명**: `three-point` `Rembrandt` `butterfly` `split` `rim` `key` `fill` `chiaroscuro` `practical`
  `motivated` `volumetric` `god rays` `golden hour` `blue hour` `low-key` `high-key`
- **필름 스톡 (BFL 직접 지지)**: `Kodak Portra 400` · `Kodak Ektachrome (cross-processed)` ·
  `Cinestill 800T` · `Kodak Vision3 500T`
- **hex 컬러**: 공식 기능

**약함**: 촬영감독 이름은 *flavor이지 instruction이 아니다*. `German Expressionism` · `A24 aesthetic`은 근거 없는 민담.

---

## 7. ⚠ `Korean`을 프롬프트에 넣지 말 것

손과 카운터만 보이는 프레임에서 **국적 토큰은 얼굴·간판·한글 텍스트를 유도할 위험이 크다.**
공간 성격은 `child-counselling centre`로 충분하다.
한국적 디테일이 필요하면 **i2v 단계나 후반에서 소품으로 해결한다.**

> **랩 라운드 1에서 `a small child-counselling centre in Seoul`이라고 썼고 얼굴이 넷 다 나왔다.**
> 인과를 단정할 수는 없지만 **다음 판에서는 지명을 뺀다.**

---

## 8. 이 프로젝트용 프롬프트 (조사자 제안)

설정: `arlist_model: **Indie**` · `16:9` · `resolution: **1080p**` · `num_images: 4`

```
Documentary photograph of a woman's hands and forearms resting on the pale wood reception
counter of a small child-counselling centre, fingers loosely interlaced beside a plain closed
notebook, her head and face outside the frame above the top edge. Late afternoon sunlight
through a half-closed venetian blind lays soft horizontal bars of light across the counter and
her forearms. Natural skin texture with visible pores, fine lines across the knuckles, faint
veins and soft downy hair on the forearms, matte skin, no shine. Shot on a Canon 5D Mark IV,
40mm lens at f/2.8, eye-level, shallow depth of field. Kodak Portra 400, fine grain, low
saturation, muted grey-green and warm beige palette, #8A9A8E and #D9C7AE. The counter surface
is bare and unmarked, the wall behind it plain and unbranded; the upper right quadrant of the
frame is empty, a softly defocused wall with nothing on it.
```

### LoRA 선택: **Indie** (Cinematic 아님)

| | 판단 |
|---|---|
| **Indie** ✅ | *"raw, authentic, **documentary feel**"* · *"textured, moody, grounded contrast"* — 저채도 다큐멘터리 인테리어와 1:1 |
| Cinematic ❌ | *"**high-drama**"* — 블라인드 빛줄기가 과장되고 FLUX.2 과채도와 겹쳐 저채도 팔레트가 무너진다. 상부 우측 여백도 그림자·비네트로 오염되기 쉽다 |
| Commercial ❌ | *"**polished**, luxury"* = **플라스틱 피부 방향.** 정확히 피할 것 |
| Professional △ | 차선. **중립 그레이드라 실촬영 클립과 컬러 매칭이 가장 쉽다.** Indie가 너무 거칠면 여기로 |

> Elwyn이 네 스타일이 크게 다르지 않다고 했으므로 **Indie와 Professional 두 벌을 뽑아 비교하는 것이 가장 빠르다.**

## 9. i2v 첫 프레임으로 쓸 때

- **시드 미노출 → 재현 불가.** 좋은 결과는 즉시 저장
- **기본이 720p다. 반드시 `resolution: 1080p`로 올린다**
- 얕은 심도로 상부 우측을 비우면 자막 영역에 디포커스 그라디언트가 생겨 **가독성에 오히려 유리하다**

## 출처
[BFL 프롬프트 가이드](https://docs.bfl.ml/guides/prompting_guide_flux2) · [BFL FLUX.2 발표](https://bfl.ai/blog/flux-2) ·
[HF FLUX.2 해설](https://huggingface.co/blog/flux-2) · [fal FLUX.2 프롬프트 가이드](https://fal.ai/learn/devs/flux-2-klein-prompt-guide) ·
[fal LoRA 스키마](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/flux-2/lora) ·
[Artlist 블로그](https://artlist.io/blog/artlist-original-1-0-the-most-cinematic-image-generation-model/) ·
[Jonny Elwyn 실사용](https://jonnyelwyn.co.uk/film-and-video-editing/inside-artlists-new-ai-toolkit/) ·
[bako02 FLUX.2 가이드](https://github.com/bako02/flux2-prompt-guide) ·
[Prompt Architects 포토리얼 레시피](https://prompt-architects.com/blog/472-flux-2-photorealism-recipes-10-prompt-formulas)
