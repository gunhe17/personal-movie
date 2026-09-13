# Seedream 5.0 Pro 프롬프트 (조사 2026-09-13 · 렌더링 DOM으로 재검증)

공식 1차 사료 둘:
[API 정본](https://www.volcengine.com/docs/82379/1541523) ([영문](https://docs.byteplus.com/en/docs/ModelArk/1541523)) ·
[프롬프트 가이드](https://www.volcengine.com/docs/82379/1829186)

> ⚠ **Pro 전용 프롬프트 가이드는 존재하지 않는다.** 공식 가이드는 첫 줄에
> 「本文介绍 Seedream 5.0 lite、4.5 和 4.0 的提示词」이라고 명시한다.
> Pro에 대한 조언은 전부 그 가이드의 유추 적용 · API 주석 · 민간전승이다.
> **재검증 결과**: 영문 Seedream 5.0 프롬프트 가이드는 ByteDance가 발행한 적이 없다.

---

## 1. ⚠ 워터마크가 기본값 켜짐이다

```
watermark  boolean  默认值 true
→ true: 在图片右下角添加"AI 生成"字样的水印标识
```

**프롬프트로는 절대 못 막는다** — *"a prompt saying 无水印 will NOT remove the platform AI watermark."*
호출 시 `"watermark": false`가 유일한 방법이다.

> **랩 실측: Artlist는 false로 넘긴다.** 출력 우하단을 크롭해 확인했고 표시가 없었다.

---

## 2. 자연어 문장 — 태그 나열 금지 (공식 규칙 1)

> **「用自然语言清晰描述画面」** — 主体 + 行为 + 环境을 **简洁连贯**한 자연어로.
> 권장: *"A girl in a lavish dress walking under a parasol along a tree-lined path, in the style of a Monet oil painting."*
> 금지: *"Girl, umbrella, tree-lined street, oil painting texture."*

나머지 공식 규칙 넷: 용도·타입 명시 · 정확한 스타일어 또는 참조 이미지 · **렌더링할 글자는 쌍따옴표 안에** ·
편집 시 바꿀 것과 유지할 것을 명확히.

그리고: *"**采用简洁精确的提示通常优于重复堆叠华丽复杂的词汇**"*

---

## 3. 길이 — 공식이 드롭 현상을 직접 인정한다

> **"Prompt length recommendation: Use no more than 300 Chinese characters or 600 English words.
> Excessively long prompts may scatter information, **causing the model to overlook details and
> focus only on major elements**, which can result in missing details."**
> *(렌더링 DOM에서 토씨까지 재확인)*

**드롭 순서가 여기서 나온다**: 모델은 **重点(주요 요소)을 붙잡고 细节(디테일)을 버린다.**
즉 **큰 명사구(주체·장소·구도)는 살고, 작은 수식·재질·부수 오브젝트가 먼저 증발한다.**

| 등급 | 내용 | 배치 |
|---|---|---|
| A | 에셋 유형 · 주체 · 장소 · **화면비** · 비워둘 영역 | 맨 앞 1~2문장 |
| B | 광원 방향·질 · 렌즈 · 팔레트 | 중간 |
| C | 질감 | B 뒤 |
| D | 배제 | 맨 끝, 5~8개 |

하드 리밋은 공급자 레벨 3000자. **권장 길이 150~220 영단어.**

---

## 4. 네거티브 필드 없음 — 인라인 부정이 **공식 용법**이다

전수 확인: `negative_prompt` 파라미터가 **API 어디에도 없다.**
*(렌더링된 세 공식 페이지에 그 문자열이 0건 — 재검증)*

**그런데 ByteDance 자신이 프롬프트 안에 부정어를 쓴다.** 공식 예시:
- *"…poetic realistic lighting, **with no text**."*
- *"Keep all adjustments realistic and natural, **avoiding excessive skin smoothing or deformation**."*

중국어권 실무 상용구: **`不要文字、Logo和水印。画面比例：16:9。`**

실무 규칙: *"Keep exclusions concrete: 'no logo, no watermark' beats 'nothing bad.'"* ·
*"for anatomy, **prefer positive phrasing** — 'relaxed natural hands' gives the model a target,
while a bare 'no distorted hands' only names the failure."*

---

## 5. ⚠ 스타일을 안 박으면 모란디·PPT풍으로 간다

> **「如果用户没有在提示词中明确限定图片风格，模型会默认偏浅色、浅蓝或莫兰迪配色，
> 整体更接近通用PPT风格，不会主动往…写实视觉效果靠拢」**

**저채도 팔레트를 요구하는 우리에게 특히 위험하다.** 모란디 디폴트는 저대비·플랫 쪽이라
다큐 실사가 아니라 일러스트풍으로 빠진다.
**→ 팔레트 명시만으로 부족하고 "사진임"을 따로 못 박아야 한다** (`真实摄影质感` / `A still frame from a documentary video`).

---

## 6. 피부 — 공식 주장과 반증이 둘 다 있다

**공식**: *"faithfully reproduces skin texture — **facial lines and rough skin details** appear three-dimensional."*
⚠ **"visible pores"는 공식 문구가 아니다.** 실무자 어휘다.

**반증**: 출시 직후 r/singularity 테스터들이 **Pro가 4.5보다 인물에서 덜 사실적**이라고 보고.
WeShop: **"Hands, jewelry, fabric patterns, small text remain inconsistent across generations."**

중국어권 실무자의 상비 방어구: **`不过度磨皮`** · **`避免皮肤塑料感`** ·
영문 `uneven skin tone`(모공보다 강한 신호) · `no beauty retouching` · `no glossy sheen`

> **손이 알려진 불안정 영역이다.** 여러 장 뽑아 고르는 것을 전제로.

---

## 7. 한국어가 **프롬프트 언어로** 공식 지원된다 — Pro에서만

> **"All models support Chinese and English prompts. **Seedream 5.0 pro also supports** Russian, Arabic,
> Filipino, Thai, Turkish, **Korean**, Malay, Spanish, Portuguese, Indonesian, French, German, Vietnamese, Japanese."**

그리고 공식 주장: *"When creators input prompts in different languages, the model... **aligns the
architectural styles, facial features, and clothing details with the corresponding cultural context**."*

**그럼에도 랩에서는 영어로 썼다.** 이유 셋: 네이티브 쌍이 中/英이고, 우리 컷은 화면 내 글자가 0이라
한글 렌더링 강점이 쓰일 데가 없으며, **한국어 프롬프트가 한글 간판·안내문을 유도할 구조적 위험**이 있다.
⚠ **세 번째는 미검증 추론이다.**

---

## 8. Pro는 시리즈 생성이 안 된다

| | Pro | 5.0 lite / 4.5 / 4.0 |
|---|---|---|
| 文生组图 (시리즈) | **暂不支持** | ✓ |
| 交互编辑 · 图层拆分 | ✓ | ✗ |
| 해상도 | 1K / **1.5K** / 2K | 2K / 3K / 4K |
| 참조 이미지 | 10장 | 14장 |

*(렌더링 DOM에서 두 번 확인: API 레퍼런스와 Pro 튜토리얼 능력표 양쪽)*

> **⚠ 1K를 쓰지 말 것.** 공식: **「1.5K 与 1K 价格相同…且图片生成效果更优」** — 같은 값에 더 좋다.
> **랩 실측: Artlist의 `2616`(이름은 1.5K)이 실제로는 `quality: 1k`로 해석돼 1376×768이 나왔다.**
> 2K가 필요하면 `2615`를 쓴다(4장 600).

**글자가 박혀 나오면 우회로가 있다**: `layer_decomposition: true`로 재호출해
텍스트 레이어만 제거하고 底图를 쓴다. Pro 전용 공식 기능이다.

---

## 9. 여백 — 직접 제어는 실패하고 우회로가 둘

중국어권 결론: *"There is no dedicated mechanism, and no one found a reliable 'leave this area empty' trick."*

실제로 통한 것:
1. **영역에 용도를 이름 붙인다** (비우라고 하지 말고)
2. ★ **자막 베드로는 "빈 흰 영역"보다 "크게 아웃포커스된 균일한 면"이 안정적이다** —
   모델이 거기 디테일을 그릴 이유가 사라지고 자막 가독성도 오른다

---

## 10. i2v 첫 프레임 — 공식 지침이 있다

[Seedream→Seedance 베스트 프랙티스](https://www.volcengine.com/docs/82379/1951250) 「注意事项」:

> **「宽高比匹配」** — 이미지와 최종 영상의 종횡비 차이가 크면 크롭·왜곡이 생긴다
> **「提示词建议」** — *"可明确加入『**视频静帧画面**』等说明，以引导模型生成更适配视频生成的图像内容"*

**→ 프롬프트에 "영상 정지 프레임"이라고 쓰라는 것이 공식 지침이다.**
영어로 `A still frame from a documentary video`. **랩에서 이 문장을 맨 앞에 넣었다.**

---

## 11. 랩 결과

`_lab/01-model-bakeoff/report.html`의 Seedream 절에 프롬프트 전문이 있다.

**넷 중 브리프를 가장 많이 충족했다** — 빛·팔레트·여백·소품이 다 맞았다.
**떨어진 이유는 해상도(1376×768)와 장당 과금이다.** 채택은 Kling o3.

## 출처
[API 정본](https://www.volcengine.com/docs/82379/1541523) · [프롬프트 가이드](https://www.volcengine.com/docs/82379/1829186) ·
[Pro 튜토리얼](https://www.volcengine.com/docs/82379/2582774) · [공식 런치 포스트](https://seed.bytedance.com/en/blog/beyond-generation-it-understands-design-introducing-seedream-5-0-pro) ·
[Seedream→Seedance 베스트 프랙티스](https://www.volcengine.com/docs/82379/1951250) ·
[302.AI 벤치마크](https://302.ai/blog/302-ai-benchmark-lab-review-on-seedream-5-0-pro/) ·
[优设网 실사 프롬프트](https://www.uisdc.com/seedream-5-pro) · [WeShop 초기 테스트](https://www.weshop.ai/blog/seedream-5-0-pro-review-what-early-tests-reveal/)
