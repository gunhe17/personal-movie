# Veo 3.1 (Gemini · Google AI Pro) — 사양 · 프롬프트 문법 · 우리 쓰임

조사 2026-09-10. 용도는 `STORY.md` BEFORE 층의 **움직임** — 미드저니 V1이 480p·24fps·무음이라
그 자리를 대신할 수 있는지 본 것이다. 도구 비교의 짝은 `midjourney.md`, AI 티를 줄이는 법은 `ai-look.md`.

**조사 방법.** 1차는 **Google Cloud 공식 프롬프팅 가이드**(직접 읽음). 요금제·물량은 검색 결과의 2차 문서다.
2차만 있는 항목은 그렇게 표시했다. **버전이 빠르게 바뀌므로 제작 직전에 다시 확인한다.**

---

## 1. 요금제와 접근 (2차)

| | Google AI Pro | Google AI Ultra |
|---|---|---|
| 월 | **$19.99** | 상위 등급 |
| 모델 | Veo 3.1 | Veo 3.1 |
| **기본 해상도** | **720p** | **1080p** |
| 크레딧 | 월 **1,000** | 더 많음 |
| 환산 | Quality **약 10편** · Fast **약 50편** · Lite **약 100편** | — |

**우리에게 걸리는 두 가지**

- **720p는 1920 타임라인에 1.5배 부족하다.** 미드저니 480p(2.25배)보다는 낫지만 무손실은 아니다. 1080p가 필요하면 Ultra
- **Quality 10편은 재시도 여지가 없다.** BEFORE가 10컷인데 실사 영상은 컷당 3~5번은 돌린다.
  현실적 운용은 **Fast로 탐색 → 확정본만 Quality**

## 2. 모델 사양 (1차)

| | |
|---|---|
| 길이 | **4 · 6 · 8초** 중 선택 |
| 해상도 | **720p / 1080p** |
| 화면비 | **16:9 / 9:16** |
| 오디오 | **네이티브 생성** — 대사 · 효과음 · 앰비언스가 영상과 동기 |
| 참조 이미지 | **Ingredients to Video** — 인물 · 사물 · 배경을 각각 올려 한 클립으로 합친다 |
| 시작·끝 프레임 | **First and Last Frame** — 두 이미지 사이의 전환을 오디오와 함께 생성 |
| 편집 | **Flow** — Veo 클립을 이어 붙이는 전용 도구. Ingredients · Frames · Extend가 여기 있다 |

**길이는 짧을수록 안 무너진다.** 우리 BEFORE는 ASL 1.0초 불규칙이라 4~8초면 넘치고,
**앞 1~2초만 쓰는 것**이 AI 티를 줄이는 방법이기도 하다.

## 3. 프롬프트 문법 (1차)

미드저니와 **완전히 다르다.** 파라미터가 없고 전부 문장이다.

```
[Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance]
   촬영              피사체       동작       배경         스타일·분위기
```

이 순서를 지키면 결과가 눈에 띄게 안정된다.

**공식이 권하는 어휘**

| 갈래 | 예 |
|---|---|
| 카메라 | `dolly shot` · `tracking shot` · `crane shot` · `aerial view` · `slow pan` · `POV shot` |
| 렌즈 · 초점 | `shallow depth of field` · `wide-angle lens` · `soft focus` · `macro lens` · `deep focus` |
| 조명 | `harsh fluorescent overhead lights` · `green glow of monochrome monitor` · `dramatic spotlight from front` · `soft morning light` |

**오디오는 세 갈래로 나눠 적는다**

- 대사 — `A woman says, "We have to leave now."` (따옴표)
- 효과음 — `SFX: thunder cracks in the distance`
- 배경음 — `Ambient noise: the quiet hum of a starship bridge`

**네거티브 프롬프트는 별도 필드다.** 공식 지침은 **막연한 부정 대신 구체적 서술** —
`"no man-made structures"`보다 `"a desolate landscape with no buildings or roads"`가 낫다.
실무적으로는 **명사 나열**이 안전하다(`music, dialogue, subtitles, camera pan, …`).

## 4. 우리 어법 — 세 줄이 결과를 가른다

공식 문법 위에 **우리 규칙**으로 얹은 것. 세 컷을 써 보며 도출했다.

**① 카메라를 안 움직이려면 그렇게 써야 한다.** Veo는 기본으로 카메라를 움직인다.
`The camera does not move at all.` + **움직이는 것 하나를 지정** + **나머지를 명시적으로 얼린다.**
```
The camera does not move at all. Nothing in the frame moves except her shoulders falling once.
```

**② 오디오를 지정하지 않으면 음악과 대사를 넣는다.** 우리는 사운드를 5레이어로 직접 설계하므로
룸톤만 요청하고 결과 트랙은 버린다. 그래도 **요청해 두면 화면이 그 톤에 맞춰 차분해진다.**
```
Ambient noise: fluorescent ballast hum and a phone ringing. No music. No dialogue.
```

**③ 참조 이미지를 넣어도 옷·머리를 문장에 다시 적는다.** 참조에만 맡기면 컷마다 드리프트가 난다.
사진과 문장이 어긋나면 **그 지점부터 인물이 흔들린다.**

### 템플릿

```
[샷 종류] [각도] [높이].
A Korean woman in her mid-thirties, [옷·머리·명찰 — 참조 사진과 일치시킬 것], [자세].
[동작 한 가지. 나머지는 정지].
[공간 · 소품 · 마모 흔적]. [광원 하나 + 방향 + 그림자]. [필름 스톡 · 그레인 · 노출].
The camera does not move at all. Nothing else in the frame moves.
Ambient noise: [룸톤]. No music. No dialogue.
```

## 5. 미드저니와 나란히

| | 미드저니 V1 | Veo 3.1 (AI Pro) | Veo 3.1 (Ultra) |
|---|---|---|---|
| 해상도 | **480p** | **720p** | **1080p** |
| 프레임률 | 24fps | (미확인) | (미확인) |
| 길이 | 5초 + 연장 4회 ≈ 20초 | 4·6·8초 | 4·6·8초 |
| 오디오 | **없음** | 있음 | 있음 |
| 참조 | Edit Model 4장 | Ingredients | Ingredients |
| 문법 | 파라미터 (`--ar --s --c --no`) | **자연어 5부 구조** |

**결론.** 2026년 실무의 표준 조합과 같은 결론에 닿는다 — **스틸은 미드저니, 움직임은 외부 모델.**
미드저니로 잠근 인물 참조 4장에서 스틸을 뽑고, 그것을 Veo의 첫 프레임 또는 ingredient로 넣는다.

## 6. ChatGPT · Sora — 신뢰도 낮음, 확인 필요

검색 결과가 **서로 모순된다.** 한쪽은 *"2026-01 기준 Plus·Pro만 접근 유지"*, 다른 쪽은
*"2026-04-26 소비자용 Sora 앱 종료 · Sora 2 API도 2026-09-24 종료 예정"*이라고 한다.
출처가 전부 SEO성 가격비교 사이트라 **어느 쪽도 채택하지 않았다.**

참고로 적힌 사양: Plus 720p·20초 / Pro($200) Sora 2 Pro 1080p·25초·24~60fps·동기 오디오.
**검토 전에 OpenAI 공식 페이지에서 생존 여부부터 확인할 것.**

## 확인하지 못한 것

- **Ingredients to Video의 참조 이미지 장수 상한** — 공식 가이드에 없다
- **seed · extend** — 공식 가이드에 없다. Flow에 Extend가 있다는 언급만
- **프레임률** — 720p/1080p만 밝히고 fps는 없다
- **워터마크** — SynthID(비가시)는 알려져 있으나 **가시 워터마크가 붙는 등급이 있는지 미확인.
  IR 영상에는 치명적이라 반드시 확인**
- **상업 이용 조건** — 요금제별 권리 범위 미확인
- 위 요금제·물량은 **전부 2차 출처**다

## 출처

1차 — [Ultimate prompting guide for Veo 3.1 (Google Cloud Blog)](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1)
2차 — [Veo 3.1 (Google DeepMind)](https://deepmind.google/models/veo/) · [Gemini 구독 페이지](https://gemini.google/subscriptions/) · [Veo API 문서](https://ai.google.dev/gemini-api/docs/veo) · [Gemini Pricing 2026](https://www.ai-toolbox.co/gemini-models/gemini-pricing-plans-2026) · [Ingredients to Video 가이드](https://www.veo3ai.io/blog/veo-3-1-ingredients-to-video-guide-2026) · Sora 관련(신뢰도 낮음) [costgoat](https://costgoat.com/pricing/sora) · [aifreeapi](https://www.aifreeapi.com/en/posts/chatgpt-plus-sora-limits)
