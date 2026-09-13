# Kling Image 3.0 Omni 프롬프트 실무 (조사 2026-09-12)

**정본 문서는 하나다** — [IMAGE 3.0 Omni User Guide](https://kling.ai/quickstart/klingai-image-3-omni-user-guide).
이 문서 근거의 절반이 거기서 왔다. 검색할 때 키워드는 "O3"가 아니라 **`IMAGE 3.0 Omni`**다.

---

## 1. 짧게 쓰면 안 된다 — **Prompt Enhancer가 멋대로 채운다**

이 모델의 가장 중요한 실무 포인트다.

> 302.AI 문서: 「内置 Prompt Enhancer 自动优化模糊描述… 将"一个女孩"优化为
> "阳光下穿丝绸长裙的亚洲女孩，微风轻拂发丝"」

**"한 소녀"라고 쓰면 모델이 "햇살 아래 실크 드레스를 입은 아시아 소녀, 산들바람에 흩날리는 머리칼"로 부풀린다.**

> **→ 통제하려면 길게 쓰는 것이 오히려 안전하다.**
> 이 모델에서 "짧고 간결하게"는 나쁜 조언이다.

**실무 길이: 400~1,200자.** 중요한 지시(주체·구도·비워둘 공간·배제절)를 **앞 60%에 배치**하고,
뒤쪽은 톤·무드·질감 같은 "떨어져도 괜찮은" 수식으로 채운다.

한도는 **2,500자**다(5,000자 캡은 어디에서도 확인되지 않았다).
공식: 「支持中英文，长度不超过 2500 个字符, **每个汉字、字母、数字或符号计为一个字符**」
— **한글 1글자 = 1 character다. 2500 바이트가 아니다.**

---

## 2. 공식 템플릿 — 슬롯을 다 채운다

태그 나열이 아니라 자연어지만, 형식은 장문이든 전보체든 상관없다.
**통제력을 주는 것은 슬롯을 빠짐없이 채우는 것이다.**

```
Narrative/Realism Build:
  [Style] + [Subject] + [Setting] + [Details] + [Vibe]

Pro Cinematic Gen:                       ← 우리가 쓸 것
  [Style] + [Subject] + [Setting] + [Light] + [Composition] + [Angle] + [Focus] + [Tone] + [Vibe]
    Style:       "[....] aesthetic."
    Subject:     Look / Pose
    Setting:     Scene / Time / Space / Structure
    Light:       Brightness / Direction / Color
    Composition: Centered / Thirds
    Angle:       High / Low / Eye-level
    Focus:       "Hard focus on [....]"
    Tone:        Color palette / Temp
    Vibe:        "Overall vibe [....]"
```

공식 경고: **"요소를 맹목적으로 쌓으면 출력 품질이 떨어진다."** 슬롯을 채우되 중복 수식은 빼라.

---

## 3. vCoT를 쓰는 법 — **추론을 흉내내게 하지 말고 추론할 대상을 넘겨라**

공식 문서 전체(퀵스타트 9편 + 블로그 4편)를 훑어도 `vCoT` · `chain-of-thought` **0건**이다.
그러니 "Step 1: …" 같은 단계형 지시를 넣을 근거가 없다.

**대신 공식이 실제로 보상하는 것은 명시적 공간·역할 배분이다.**

| 기법 | 공식 예시 (verbatim) |
|---|---|
| **프레임 내 위치를 분수로** | `the person is on the right (1/3 of the image), while the reflections extend leftward into the distance (2/3)` |
| **전경/중경/배경 분리** | `FG: blurred petals/greenery. MG: cozy room, wood decor. BG: sunny Japanese interior.` |
| **레이어별 광원 방향** | `Cold artificial top lighting casts shadows, enhancing the closed-in feel and the depth of reflections.` |
| **여백을 용도와 함께 예약** | `calm negative space toward the upper right for optional campaign copy outside the generated image` |

**마지막 항목이 이 프로젝트에 특히 중요하다** — 자막·카피가 들어갈 자리를 미리 비워 둘 수 있다.

---

## 4. 공식이 출력 그리드로 검증한 어휘

공식 가이드 §1은 **용어마다 실제 출력 이미지 격자를 붙여** 놓았다. 마케팅 문구가 아니라 문서상의 결과물이다.

**구도** Centered · Rule of Thirds · Golden Ratio · Triadic · Foreground · **Negative space** · Diagonal · Symmetrical · Leading lines · Frame-in-frame

**샷 사이즈** Long Shot · Full Shot · Mid Shot · Close-Up · Extreme Close-Up

**앵글** Top-Down · High-Angle · Low-Angle · Eye-Level · Worm's Eye · Frontal · 3/4 View · Profile · Overhead · Bird's-eye · Fisheye · **OTS(over-the-shoulder)**

**초점거리 — 숫자 직접 지시가 먹힌다.** 공식 예시가 문자 그대로:
`Set to 24mm` · `Set to 35mm, keep aspect ratio` · `Set to 50mm` · `Set to 85mm` · `Set to 100mm` · `Set to 200mm`
산문 안에서는 `85mm portrait, creamy bokeh` · `50mm editorial food photography`

**톤** Low-key · Mid-key · High-key **라이팅** Top · Back · Soft · Hard · 편집 명령형 `Relight the pic [xx]`

**필름 스톡·필터 (§5.1, 각각 출력 예시 있음)**
Kodak Portra 400 · Fuji NC Film · Ricoh Negative Film · **Ricoh Bleach Bypass** · Ricoh Nostalgia ·
Hasselblad Blue · High Exposure · Blues Hour · Mixed Light · God Rays · Starburst

**컬러 그레이딩 (§5.2)**
Teal · Reddish Brown · Pastel Colors · **Morandi Colors** · Autumn Yellow · **Low Saturation Gray** · Cedar Ash

> **이 프로젝트에 맞는 것**: `Low Saturation Gray` · `Morandi Colors` · `Cedar Ash`.
> v1의 회녹색 저채도 팔레트(02번 문서)와 결이 같다.

**역맵핑** `Generate [] based on this image` → Spatial Map · Line Art · Contour Map · Thermal Imaging
(스토리보드·레이아웃 추출에 쓸 수 있다)

### ⚠ 작동하지 않는 것 — 실측

**임의의 필름/미디어 룩 이름은 무시된다.** 302.AI 벤치마크랩이 *"90s Japanese Analog VHS"* 미학을 요청했으나
**레트로 VHS 룩 재현에 실패**했다. 결론: 「特定视觉美学(VHS 颗粒、胶片特性)无法仅通过提示词准确复刻」

> **→ 공식 §5.1 필터 이름 안에서만 논다.** `Kodak Portra 400`은 먹히고 `VHS`는 안 먹힌다.

---

## 5. 네거티브 프롬프트가 없다 — 긍정문 안에 부정절을 넣는다

**Image O3에는 `negative_prompt` 필드 자체가 없다**(fal · Runware · 공식 · Artlist 4중 확인).
`seed` · `cfg_scale` · `guidance_scale` · `image_fidelity`도 **전부 없다.**

**fal이 그 필드 설명에 정본 방식을 적어 놓았다** (verbatim):

> **"It is recommended to supplement negative prompt information through negative sentences
> directly within positive prompts."**

Runware의 프로급 O3 예시 8개가 **전부 이 패턴으로 끝난다**:

```
No visible words, labels, logos, signage, interface elements or watermark.
No lettering, labels, logos, watermarks, interface elements, or synthetic plastic appearance.
No people, no visible brands, no labels, no typography, no watermark, no mockup borders.
```

**→ v1의 `--no` 목록을 이 형식으로 옮기면 된다.** 02번 문서가 남긴 번역 과제의 답이 이것이다.

그리고 **긍정형으로 뒤집는 것이 더 잘 먹힌다**:
```
believable proportions and natural hands
natural skin texture, visible pores
realistic skin and hands, tactile macro detail
```

---

## 6. 레퍼런스 지시 문법 — **산문형이 가장 호환된다**

| 경로 | 문법 |
|---|---|
| fal / WaveSpeed | `@Image1` `@Image2` (1-indexed) · `@Element1` |
| Kling 웹앱 | `[@이름]` |
| 공식 API | `<<<image_1>>>` `<<<element_1>>>` |
| Segmind | `(element1)` |
| **공식 가이드 산문체** | **`Image 1` · `reference image 2` · `Ref 1`** |

> **→ 산문형 `Image 1` / `reference image 2`가 모든 경로에서 통한다.**
> 공식 가이드 예시 전부가 이 방식이다. `@ImageN`은 fal/WaveSpeed 전용으로 취급한다.
> **Artlist 경로에서는 산문형을 쓴다.**

### 레퍼런스 이미지를 역할별로 비워서 준비한다 — 공식 §6.2

```
Environment Ref: Empty scene, focus on space.
Character Ref:   Plain background, focus on face/hair/OOTD.
Pose Ref:        Plain background, focus on stickman/action lines.
Composition Ref: Element layout, perspective focus.
Style Ref:       Consistent vibe, strong aesthetic.
```

> **구도 복사를 막는 방법은 프롬프트가 아니라 레퍼런스 이미지 전처리다.**
> 인물 레퍼런스는 배경을 비우고, 환경 레퍼런스는 인물을 비운다.

**스타일만 가져오고 구도는 복사하지 않기** — 실제로 먹힌 문장 (Runware):
```
Blend the composition and architectural character of the first reference image with
the styling and silhouette language of the second reference image.
```

**얼굴 고정 공식** (공식):
```
Keep []'s facial features, character has [] hairstyle, wearing [] clothing,
performing [] action, background is [], with [] lighting, and [] atmosphere.
```

일관성 실측 정확도는 **약 80%**이고 피부톤·헤어스타일 드리프트가 남는다.

---

## 7. 한글 — **모델에 그리게 하지 않는다**

공식 텍스트 렌더링 문서는 Kolors 시절 한 편뿐이고 **중국어·영어만** 언급한다.
IMAGE 3.0 Omni 가이드에는 **텍스트 렌더링 섹션 자체가 없다.**
그리고 공식 API 스펙이 프롬프트 언어를 **「支持中英文」 둘로 못 박는다.**

**한글 렌더링 결과물은 성공이든 실패든 공개 아티팩트를 찾지 못했다** —
"실패한다"가 아니라 **"아무도 공개적으로 테스트하지 않았다"**가 정확하다.

### ⚠ 흔한 오해 — "한국어 지원"은 **음성** 스펙이다

집계 사이트들이 "Chinese, English, Japanese, Korean, Spanish 지원"이라 쓰는 것은
**VIDEO 3.0의 Native Audio(음성·립싱크) 다국어** 스펙을 이미지 타이포그래피로 잘못 옮긴 것이다.

> 공식: *"Native Audio with dialogue, lip-sync alignment, **multilingual support in
> Chinese, English, Japanese, Korean, and Spanish**"*

게다가 fal 스키마의 `generate_audio` 설명은 정반대를 말한다 —
*"Supports Chinese and English voice output. **Other languages are automatically translated to English.**"*

### → 이 프로젝트의 답

**텍스트 없이 생성하고 여백만 예약한 뒤, `motion-stage`로 실제 한글 폰트를 얹는다.**
자간·폰트·가독성이 완전히 통제된다. 영상 파이프라인에서 유일하게 안전한 선택이다.

```
No visible words, labels, logos, signage, interface elements or watermark.
... with calm uncluttered negative space on the upper right for copy added later.
```

굳이 모델이 한글을 그려야 한다면 **Nano Banana Pro**가 한국어권에 공개 검증 사례가 있는 유일한 모델이다
(Artlist `modelId 2071`).

---

## 8. 첫 프레임 프롬프트 — 단품 이미지와 다르다

| | 단품 이미지 | **i2v 시작 프레임** |
|---|---|---|
| 구도 | 완결·닫힘 | **움직일 여지(headroom/leadroom)를 남김** |
| 포즈 | 결정적 순간 | **동작의 시작점** — 끝난 자세가 아니라 들어가는 자세 |
| 심도 | 자유 | **얕은 심도는 신중히** — 배경이 뭉개져 있으면 카메라 이동 시 재발명된다 |
| 텍스트 | 넣어도 됨 | **넣지 말 것** — 모션 중 글자가 가장 먼저 붕괴 |
| 비율 | 자유 | **최종 출력 비율로 고정**, 시작·끝 프레임 동일 |

### 공식 키프레임 템플릿 — **핵심 트릭이 여기 있다**

```
[Character] + [Pose/Action] + [Environment] + [Camera/Lens] + [Lighting/Color] + [Style/Quality] + [Timing]
```
> *"Reserve a slot for motion cues that will carry into the image-to-video stage:
> **'35mm lens, shallow depth of field, slow dolly in, 6-second move.'**"*

**이미지 프롬프트에 이후의 카메라 무브를 미리 적어 두면, 모델이 그 무브가 가능한 구도
(여백·깊이 레이어)로 프레임을 짠다.** 그 문장을 그대로 영상 프롬프트로 이월한다.

### 영상 단계 공식

```
Prompt = Subject + Movement, Background + Movement
```
> *"Image-to-Video is already provided with a scene. Thus, it only requires the depiction of
> the subjects in the image and the intended movement for these subjects."*

공식 반례/정례 (verbatim):
```
✗  Put on sunglasses
△  Mona Lisa puts on sunglasses with her hand
✓  Mona Lisa puts on sunglasses with her hand, and a ray of light appears in the background
```

> *"**A description that significantly deviates from the image may cause a camera cut or transition**"*

### 시작·끝 프레임 쌍은 `series`로 뽑는 것이 정석이다

> *"the content of the first and last frame videos should be as similar as possible,
> as **significant differences may cause a lens switch**."*

`result_type: "series"`가 「叙事/视觉连续性을 가진 분镜 시리즈」를 만든다.
`num_images` 배치는 「批量生成时仅风格相似，无分镜关联」이라 **시작·끝 짝으로는 부적합하다.**

> ⚠ **Artlist에는 `series`가 노출되지 않는다.** 시작·끝 쌍이 필요하면 fal이나 Kling 웹앱을 직접 써야 한다.

---

## 9. 실행형 골격 (이 프로젝트용)

**① 첫 프레임 (Image O3 · 2K · 16:9 · 텍스트 금지)**
```
[Style] aesthetic. [Subject: look + 동작의 시작 자세].
[Setting: scene / time / space / structure].
[Light: brightness + direction + color].
Composition: rule of thirds, subject occupies [left third],
with calm uncluttered negative space on the [upper right] reserved for copy added later.
Angle: eye-level. Focus: hard focus on [X]. Set to 50mm, medium depth of field
so the background stays readable during a slow dolly in.
Tone: Low Saturation Gray palette. Natural skin texture, believable proportions and natural hands.
Overall vibe [X].
No visible words, labels, logos, signage, interface elements or watermark.
```

**② 같은 이미지를 O3 영상에 (start frame + prompt)**
```
[Subject] + [하나의 동작]. Camera: slow dolly in. [Background] + [환경 모션].
Everything else must remain unchanged: [라벨/재질 목록].
```

---

## 10. 실패 모드와 회피

| 증상 | 회피 |
|---|---|
| **플라스틱 피부** | 긍정형 질감 명시 — `natural skin texture` · `Raw skin/cotton texture` · `visible pores` |
| **손·해부** | 클로즈업에서 손을 주역으로 두지 않는다. `natural hands, believable proportions` |
| **군중·작은 얼굴** | **3~5명으로 제한**, 원경 인물은 **실루엣**으로 지정 |
| **컷 간 컬러 드리프트** | 샷마다 **동일 조명·팔레트 문장을 반복**해 넣는다 |
| **비율 아티팩트** | **공식 네이티브는 `16:9 / 9:16 / 1:1` 셋뿐.** 래퍼가 광고하는 21:9 등은 크롭일 수 있다 |
| **전체 가용률** | 「仅 30-40% 的提示词直接产出可用素材」 — **9장 배치로 뽑아 고르는 것이 정답** |

---

## 11. 열두 줄 요약

1. 정본은 **IMAGE 3.0 Omni 가이드** 하나다
2. 태그 나열 아님. **슬롯을 다 채운 자연어**. 장문·전보체 둘 다 OK
3. **2500자**. 한글 1글자 = 1자. 중요 지시는 앞 60%에
4. **짧게 쓰면 Prompt Enhancer가 멋대로 채운다.** 400~1200자가 스윗스팟
5. vCoT는 공식 용어가 아니다. 대신 **1/3·2/3 · FG/MG/BG · 여백 예약**을 명시
6. 어휘는 **공식이 출력 그리드로 증명한 목록 안에서.** 임의 필름 룩(VHS)은 무시된다
7. **한글 렌더링 공개 증거 제로.** API 계약도 중국어·영어뿐
8. **텍스트는 생성에서 배제하고 여백만 예약 → `motion-stage`로 한글 조판**
9. **네거티브 필드 없음.** 긍정문 끝에 `No lettering, labels, logos…` 부정절
10. **seed·cfg 없음.** 재현 불가. `num_images: 9`로 뽑아 고르는 것이 합리적
11. 레퍼런스 **산문형 `Image 1`**이 최고 호환. **역할별로 비운 레퍼런스**가 구도 복사 방지법
12. 첫 프레임은 **최종 비율 고정 + 동작의 시작 자세 + 배경 판독 가능 + 글자 없음 + 이후 카메라 무브를 미리 명시**

## 출처

[IMAGE 3.0 Omni 가이드](https://kling.ai/quickstart/klingai-image-3-omni-user-guide) ·
[AI Image Prompt Formula](https://kling.ai/quickstart/ai-image-prompt-formula) ·
[Image-to-Video Guide](https://kling.ai/quickstart/image-to-video-guide) ·
[시작·끝 프레임](https://kling.ai/quickstart/ai-video-start-end-frames) ·
[Kling 프롬프트 가이드](https://kling.ai/blog/kling-ai-prompt-guide) ·
[4K & Series Mode](https://kling.ai/blog/kling-image-3-omni-4k-series-mode-guide) ·
[Aliyun API 레퍼런스](https://help.aliyun.com/zh/model-studio/kling-image-generation-api-reference) ·
[Runware O3 갤러리](https://runware.ai/models/klingai-image-o3) ·
[302.AI 벤치마크랩 실측](https://302.ai/blog/302-ai-benchmark-lab-review-on-kling-o3/) ·
[PixVerse 실측](https://pixverse.ai/en/blog/kling-o3-and-3-0-now-available-on-pixverse) ·
[Curious Refuge 리뷰](https://curiousrefuge.com/blog/kling-30-review) ·
[carat.im 한글 비교](https://carat.im/blog/image-generation-ai-recommendation)

---

# 보론 — 뒤늦게 온 정정과 보강 (같은 날)

## A. ⚠ 정정 — vCoT에는 공식 출처가 있다

§3에서 "공식 문서에 0건"이라 썼는데 **절반만 맞다.** 원출처는 중국어 보도자료다.

> 「依托**视觉思维链（vCoT）**技术，精准把控构图、光影与物理约束」

**快手가 직접 쓴 용어다.** 영어권의 "think before it renders"는 이 문장의 번역 파생이다.
다만 **kling.ai 영문 공식 문서·유저 가이드에는 여전히 0건**이라는 것도 사실이다.

**정확한 상태: 보도자료 용어이되, 사용자 문서에는 반영되지 않았고, 조종할 수 없다.**

유일한 실측 리뷰어의 판정이 결정적이다:
> *"**This isn't something you can see happening — unlike the visible reasoning in some
> text-generation models** — but it results in images that feel noticeably more realistic."*

추론 트레이스 노출 없음, 노브 없음, **"think step by step" 류로 효과를 봤다는 보고 0건.**
그리고 **O1도 이미 chain-of-thought로 마케팅됐으므로 O3의 신규 능력이 아니다.**
**→ §3의 결론(추론 흉내 대신 공간 명시)은 그대로 유지된다.**

## B. 길이 — 벤더 근거가 생겼다

§1의 "앞 60%에 중요 지시" 권고가 중문 포크로어뿐이었는데, fal 공식 가이드에 같은 말이 있다:

> *"**Burying critical information:** Place your most important requirements at the prompt's beginning.
> **Kling O1 weighs earlier information more heavily.**"*
> *"maintain 50-150 words for consistent professional output"*

단 이것은 **비디오 기준**이고, **이미지 쪽 벤더 쇼케이스는 180~250단어**로 그 조언을 위반하면서 잘 작동한다.
**→ "50~150단어"는 비디오 규칙, 이미지는 150~250단어가 실증 구간이다.**

그리고 **2500자 초과는 fal에서 스키마 검증으로 400 거절이지 조용한 절단이 아니다.**
조용한 절단은 Alibaba wan 계열 이야기다. 같은 이슈 트래커가 **可灵 공식 문서에 실제 오류가 있음**을 기록한다
(`kling-video-o1` duration이 문서 3–15s vs 레지스트리 `[5,10]`). 개발자 결론: 「改前先实测」 —
**스펙을 믿지 말고 라이브 호출로 확인하라.**

## C. 레퍼런스 — 실무에 큰 둘

### (a) 소비자 UI는 3장, 10장은 API 전용

| 경로 | 상한 |
|---|---|
| fal · Runware · WaveSpeed · 공식 API | **10** |
| 소비자 UI 실측 | **3** |
| Reference-to-**Video** (O3) | **4** |

10장 부위별 배분(§6의 공식 예시)을 쓰려면 **반드시 API 경로**여야 한다. **Artlist는 10장이라 OK.**

### (b) 태그 문법 — 어느 쪽이 센지 아무도 모른다

한 출처가 *"the model treats **untagged images as loose style hints rather than identity anchors**"*라고 쓰지만,
**이것은 한 출처가 여러 사이트로 복제된 것이라 독립 확인 1건이다.**
그리고 Runware의 프로 예시는 `@Image1` 대신 **평문 `reference image 1`**을 쓰는데 잘 작동한다.

> **두 표기 중 어느 쪽이 정체성을 더 강하게 잠그는지 아무도 테스트하지 않았다.**
> 장당 100 크레딧짜리 배치 한 번이면 판정된다.

### (c) Reference-to-Video의 레퍼런스는 **첫 프레임이 아니다**

> *"the reference images are **not** used as the first frame. They serve as visual anchors only,
> so the model composes the scene freely based on your text prompt while keeping the character
> or object looking the same throughout."*

§8의 "첫 프레임 생성 → i2v"와 **다른 경로다.**
구도까지 잡으려면 `start_image_url`(i2v), 정체성만 유지하고 구도를 모델에 맡기려면 reference-to-video.

## D. 손 — 구체적 회피 문구

§10에서 "손을 주역으로 두지 말 것"까지만 썼는데 실제 권고 문구가 있다(비디오 검증, 이미지 미검증).

- **물체에 고정이 가장 확실하다**: *"Try anchoring them to an object first (like a cup or a railing).
  **This is the most reliable fix**"*
- **디테일 압력 낮추기**: *"'Medium shot of hands' is safer than 'extreme close-up of fingers'"* ·
  *"'Hands holding object' is safer than 'hands typing on keyboard'"*
- **손마다 역할 배정** (verbatim):
  `Chef's right hand gripping knife handle, blade edge positioned against cutting board,
   left hand steadying vegetable, controlled downward cutting motion.`

> ⚠ **네거티브 과다 경고**: *"**Extremely long negative prompts can actually make the animation look stiff.**"*
> §5의 인라인 부정절도 **5~8개로 제한한다.**

## E. 하우스 룩 — 이 모델은 필름에 저항한다

> *"The images it produces are more vibrant and punchy — **they remind me of iPhone photography, but done right**."*
> *"Nano Banana 2 has a distinct cinematic, film-like quality that other models struggle to replicate —
> **Kling 3.0 included**."*

§4의 "임의 필름 룩은 무시된다"와 같은 현상의 다른 얼굴이다.
**영화적 톤이 필요하면 공식 §5.1 필터명 + 팔레트를 색 이름으로 직접 나열**하는 수밖에 없다
(Runware 방식: `restrained palette of terracotta, sage green, mustard and rain-washed charcoal`).

## F. Omni는 카메라를 덜 지정하는 게 나을 수 있다

O3 비디오로 15초 샷 100개를 뽑아 감독과 분석한 중국어 실측:

> 「在提示语里只是写出了剧情内容，**完全没有告诉它**需要在人物进行什么动作的时候，用什么样的镜头…
> **可灵是自己做出了5个分镜。**」
> 「它能够在生成的过程中，**自己补足我们在写提示语时可能没有写完整的部分**。」

**"항상 카메라 무브를 명시하라"는 표준 조언과 정면으로 배치된다.**
`shot_type: "intelligent"`가 존재하는 이유이기도 하다.

> **→ 제품 영상처럼 통제가 필요하면 `customize` + 명시, 탐색 단계에서는 `intelligent` + 줄거리만.**
> 두 모드를 용도별로 쓴다.

## G. 레퍼런스 품질이 결과를 지배한다

> *"**Reference quality dependency:** Blurry, inconsistent, low-light, or cluttered references
> can weaken R2V and image reference control."*
>
> HN 1인칭: *"they are extremely picky about input images. If the subject isn't perfectly framed
> or standing in a standard T/A-pose, **the generation usually fails**"*

**흐릿·저조도·잡다한 배경 레퍼런스는 넣느니 안 넣는 게 낫다.**
그리고 레퍼런스는 **비율 0.40~2.50 밖이면 거절된다**(파노라마·세로 스트립 불가).

## H. SEO 슬롭 판별어

재검색할 때 이 문구들이 보이면 **생성 이미지 한 장 없이 보도자료를 돌려쓴 사이트**다:

```
Reference Attention Mechanism · random face problem · raw photography quality · Deep-Stack Transformer
```

vidofy는 같은 페이지 안에서 레퍼런스 상한을 3장과 10장으로 **두 번 다르게 쓴다.**

## I. 지금 당장 할 가치가 있는 테스트 셋

Artlist에서 2K 9장 배치가 100 크레딧이므로 **셋 다 300 크레딧이면 끝난다.**

1. **`@Image1` vs `reference image 1`** — 동일 레퍼런스·동일 프롬프트, 표기만 교체.
   정체성 잠금 강도 비교. **미해결 중 가장 중요하다**
2. **한글 렌더링 1회** — 짧은 한글 문자열 + 표면·위치 명시로 9장.
   **공개 데이터포인트가 세계 최초가 된다.** 결과가 어떻든 이 프로젝트의 의사결정은 끝난다
3. **인라인 부정문 유무 A/B** — `No visible words, labels, logos…` 절만 붙였다 뗐다.
   **네거티브 필드가 없는 모델에서 이게 실제로 먹는지 아무도 측정한 적이 없다**
