# Nano Banana Pro / 2 프롬프트 (조사 2026-09-13)

`gemini-3-pro-image`(Pro) · `gemini-3.1-flash-image`(NB2). 정본은
[ai.google.dev 이미지 생성 문서](https://ai.google.dev/gemini-api/docs/image-generation).

> ⚠ **API가 바뀌었다.** 현재 문서는 `client.interactions.create(...)` 형태의 **Interactions API**다.
> 인터넷의 구버전 `generate_content` 예제를 복붙하면 안 맞는다.

---

## 1. 서술형 문단 — 키워드 나열이 아니다 (공식)

공식 사진 템플릿 verbatim:

```
A photorealistic [type of shot] of a [subject description] in a [setting description].
[Description of the light]. Shot from a [camera angle] with a [lens type].
```

Best practices 중 우리에게 걸리는 넷 (verbatim):
- *"**Be hyper-specific:** The more detail you provide, the more control you have."*
- *"**Provide context and intent:** Explain the purpose of the image."*
- *"**Use step-by-step instructions:** For complex scenes with many elements, break your prompt into steps."*
- *"**Use 'semantic negative prompts':** Instead of saying 'no cars,' describe the intended scene positively:
  'an empty, deserted street with no signs of traffic.'"*

Google Cloud 블로그의 공식: `[Subject] + [Action] + [Location/context] + [Composition] + [Style]`.

---

## 2. ⚠ 여기서만 직접 부정문이 먹는다

**공식은 "semantic negative prompts"(긍정 서술)를 권한다.** 그런데 실측 리뷰어(minimaxir)의
성공한 프롬프트들은 **직접 부정문을 쓴다.** 텍스트 인코더가 LLM이라 CLIP 시절과 다르다.

```
NEVER include any text, watermarks, or line overlays.
Do not include any logos, text, or watermarks.
```

> *"Negative instructions prove effective: 'Do not include any text or watermarks'
> successfully removed undesired newspaper formatting."*

**그리고 `MUST` / `NEVER` 대문자 강조가 실제로 준수율을 높인다** —
*"Nano Banana is extremely responsive to Markdown formatting compared to older text encoders."*

> **→ 이것이 다른 모델과 갈리는 지점이다.** Kling·FLUX에서는 부정문이 **소환**으로 작동하고
> (10·13번 문서), Nano Banana에서는 **억제**로 작동한다. **모델마다 반대다.**
>
> ⚠ **랩 실측에서는 완전히 막지 못했다** — 대문자 NEVER 절을 넣었는데 그림책 표지에 글자가 2/4로 샜다.

---

## 3. 길이 — 길어도 된다

공식에 최적·최대 길이 언급이 **없다.** 실측: **컨텍스트 32,768토큰**으로 T5(512)·CLIP(77)보다 자릿수가 크다.
900토큰 넘는 프롬프트도 정상 처리된다.

**단 "요소 수"를 늘리지 말고 "한 요소당 묘사 밀도"를 늘려라.** 제약이 경합하면 토큰 희소성 문제가 생긴다.

---

## 4. Thinking — 끌 수 없다. 그리고 우리에겐 유리하다

> **"Gemini 3 image models are thinking models... This feature is enabled by default and
> **cannot be disabled in the API**. The model generates **up to two interim images**."**

**NB2만 등급 조절이 된다**: `thinking_level` = **`minimal`(기본) / `high`** 둘뿐이다.
Pro는 등급 노출 없이 thinking 강제. ⚠ **Artlist는 이 설정을 노출하지 않는다.**

### 알려진 실패 모드 — 확인됨
> *"it's too good and it **tends to push prompts toward realism**... the thinking aspect
> **attempting to ascribe and correct user intent toward the median behavior**, which can
> ironically cause problems."*

**우리에겐 아군이다.** 다큐 리얼리즘을 원하므로 median realism 편향이 같은 방향이다.
다만 **thinking이 "비어 있는 구도"를 실수로 보고 채우려 들 수 있다** —
그래서 여백에 **용도를 밝혀야 한다**(*"for subtitles to be added later"*). 공식 "Provide context and intent"가 여기서 결정적이다.

---

## 5. 여백 예약 — 공식 템플릿이 있다

```
A minimalist composition featuring a single [subject] positioned in the [bottom-right/top-left]
of the frame. The background is a vast, empty [color] canvas, creating significant negative space.
```

핵심 셋: **① 주체를 반대편 사분면에 명시 배치 ② 빈 쪽을 긍정 서술 ③ 용도를 밝힌다**
(*"creating significant negative space for text"*).

**단 우리는 다큐 실내라 "canvas"가 아니라 실재 표면으로 써야 한다** —
`a plain, faintly scuffed pale grey-green wall`. 안 그러면 thinking이 스튜디오 배경으로 교정한다.

---

## 6. 피부 — 공식 언급 없음, 실무 합의만

`natural skin texture with visible pores` · `skin grain` · `slight asymmetry` ·
`no skin smoothing` · `no airbrushing` · **광 억제를 따로**: `no glossy sheen, no rim-light halo`

> *"The plastic look comes from a model given no texture instruction at all. So **ask for skin, not smoothness**."*

**랩 실측: 넷 중 피부가 가장 좋았다.** 팔뚝 힘줄·정맥·손등 주름이 실제 사진에 가까웠다.

---

## 7. 카메라 어휘

공식이 이름 댄 것: `wide-angle shot` · `macro shot` · `low-angle perspective` ·
`three-point softbox setup` · `slightly elevated 45-degree shot` · `soft, diffused lighting from the top left`

실측으로 먹힌 것: `Canon EOS 90D DSLR camera` · **`real-world natural lighting and real-world natural uniform depth of field`**
(AI 특유의 과장된 보케 억제 — **i2v 첫 프레임에 특히 중요하다**) · `neutral diffuse 3PM lighting`(시각 지정이 먹는다)

> **"photorealistic"이라는 단어 하나보다 카메라 바디·렌즈 지정이 더 강하게 작동한다.**

---

## 8. 해상도와 참조

| | NB2 | NB Pro |
|---|---|---|
| 해상도 | **0.5K** · 1K · 2K · 4K | 1K · 2K · 4K |
| 16:9 2K | **2048×1152** | 같음 |
| 21:9 | 지원 | 지원 |
| 참조 | 객체 10 + **캐릭터 4** + 스타일 3 | 객체 6 + **캐릭터 5** |

**SynthID 비가시 워터마크는 끌 수 없다.** 가시 워터마크는 Gemini 앱에만 붙고 **API 경로에는 없다**.

---

## 9. 랩에서 쓴 프롬프트

`_lab/01-model-bakeoff/report.html`의 Nano Banana 2 절에 전문이 있다. 구조는
**산문 도입 1문단 + `Composition, all of the following MUST be followed EXACTLY:` 불릿 블록 +
광원/색 블록 + 피부/재질 블록 + 용도 선언 + 마지막 대문자 NEVER 한 줄 + `16:9 aspect ratio.`**

## 출처
[이미지 생성 문서](https://ai.google.dev/gemini-api/docs/image-generation) ·
[blog.google NB Pro 프롬프트 팁](https://blog.google/products-and-platforms/products/gemini/prompting-tips-nano-banana-pro/) ·
[Google Cloud 프롬프팅 가이드](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana) ·
[minimaxir 2025-11](https://minimaxir.com/2025/11/nano-banana-prompts/) · [minimaxir 2025-12](https://minimaxir.com/2025/12/nano-banana-pro/)
