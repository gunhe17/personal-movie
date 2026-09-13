# 경쟁 모델 비교 — Kling o3를 1순위로 둘 근거가 없다 (조사 2026-09-12)

Artlist 크레딧은 **이 계정에서 직접 견적을 뽑은 값**이고, 핵심 수치는 이 세션이 재검증했다.

---

## 1. Artlist 실측 가격 — **여기서 판단이 뒤집힌다**

동일 조건(16:9, 1장) 견적. **★는 이 세션이 직접 재검증한 값.**

| 모델 | 크레딧 | resolvedSettings |
|---|---|---|
| ★ Seedream 5.0 **Pro** (2616) | **75** | quality **1k** |
| ★ **Nano Banana 2** (2250) | **90** | **2k** |
| ★ **Seedream 5.0 4K** (2354) | **100** | **4k** |
| ★ Kling o3 1K/2K (2189) | 100 | 1K=2K 동일 |
| Qwen Image 3 (2633) | 100 | |
| Ideogram V4 Quality (2420) | 150 | |
| Grok Imagine 2.0 (3094) | 150 | |
| GPT Image 2.5 Flare High (3213) | 170 | |
| ★ Kling o3 **4K** (2195) | **200** | |
| Nano Banana 2 4K (2252) | 200 | |
| **Flux 2.0 Pro 2K** (2065) | **320** | 아레나 #36인데 3.2배 — 가성비 최악 |
| **Recraft 4.1 Pro** (3192) | **390** | 최고가 |
| Reve 2.1 (2627) | **견적 실패** | `No UI configuration found` — **현재 Artlist에서 사실상 못 쓴다** |

### 배치 확장 — ★ 전부 재검증

| 모델 | 해상도 | 1장 | 4장 | 9장 |
|---|---|---|---|---|
| **Kling o3 (2189)** | 2K | 100 | **100** | **100** |
| Seedream 5.0 (2354) | 4K | 100 | **400** | — |
| Nano Banana 2 (2250) | 2K | 90 | **360** | — |
| Seedream 5.0 (2216) | 2K | 100 | — | (5장 500) |

> **→ Kling o3의 유일하고 진짜인 경제적 이점은 "정액 배치" 하나다.**
> **1장만 뽑을 거라면 Kling o3를 쓸 이유가 전혀 없다.** 같은 100 크레딧에
> Seedream 5.0은 **4K**를 주고 아레나는 164 Elo 위다. Nano Banana 2는 90에 2K를 준다.

### ⚠ Artlist SKU 이름이 실제 해상도와 어긋난다

- `Nano Banana 2 - T2I - **1K**`(2250) → 실제 `resolution: **2k**`
- `Seedream 5.0 Pro - T2I - **1.5K**`(2616) → 실제 `quality: **1k**`

**쓰기 전에 반드시 `get_generation_cost`의 `resolvedSettings`를 확인한다.** 이름을 믿으면 안 된다.

---

## 2. 아레나 순위 — 이미지

**Artificial Analysis Text-to-Image** (159개 · 블라인드)

| 순위 | 모델 | Elo | 표본 |
|---|---|---|---|
| 1 | GPT Image 2.5 Flare (max) | 1187 | 5,236 |
| 5 | **Reve 2.1** | 1127 | 16,045 |
| 6 | **Nano Banana 2** | 1122 | 16,711 |
| 11 | Nano Banana Pro | 1097 | 15,182 |
| 15 | **Seedream 5.0 Pro** | 1081 | 12,814 |
| 32 | Ideogram 4.0 Quality | 1017 | 11,933 |
| 36 | Flux.2 [pro] | 1009 | 9,794 |
| 42 | Luma UNI 1 | 999 | 5,270 |
| 72 | Kolors 2.1 (Kling 구모델) | 947 | 3,640 |
| **87** | **Kling Image 3.0 Omni** | **917** ±7 | **6,805** |

표본 6,805에 ±7이면 **통계적 요행이 아니다.**

**arena.ai** (78개 · 614만 표 · 2026-09-07): **Kling·kwai·kolors 항목 0개.**

**편집 아레나**: Kling Image 3.0 **#32(1010)** > Kling Image O1 **#56(949)** > **Kling 3.0 Omni #58(946)**.
**Omni가 구버전보다 편집에서 낮다.**

> ⚠ **두 보드의 Elo 스케일이 다르다**(AA 최고 1187 vs arena.ai 최고 1421). **교차 비교하지 말 것.**
> 그리고 검색하면 나오는 **"Kling O3 Elo 1243/1248"은 전부 영상 모델 점수다.** 섞어 읽으면 안 된다.

---

## 3. **영상 순위 — 앞선 문서의 오류를 고친다**

06번 문서가 "Kling 3.0이 영상 1위"라고 적었다. **그것은 Text-to-Video 순위다.**
**우리가 쓰는 것은 Image-to-Video이고, 거기서는 중위권이다.**

| AA Image-to-Video (35개) | Elo | | arena.ai i2v (47개 · 190만 표) | 점수 |
|---|---|---|---|---|
| 1 MiniMax H3 Max | 1207 | | 1 minimax-h3 | 1497 |
| 2 **Seedance 2.0 720p** | 1196 | | 4 seedance-2.5-720p | 1478 |
| 5 Gemini Omni Flash | 1179 | | 5 seedance-2.0-720p | 1477 |
| 6 Wan 3.0 | 1178 | | 7 grok-imagine-video-1.5 | 1456 |
| 11 Veo 3.1 | 1088 | | 12 veo-3.1-audio | 1398 |
| **15 Kling 3.0 1080p Pro** | **1076** | | **18 kling-v3-pro** | **1356** |
| **20 Kling 3.0 Omni 1080p Pro** | 1065 | | 25 kling-2.6-pro | 1293 |

> **→ "프레임을 Kling으로 만들었으니 영상도 Kling"은 근거 없는 이익을 위해
> 측정 가능한 품질 손실(약 120~140 Elo)을 감수하는 선택이다.**
>
> 다만 **Artlist에서 끝 프레임(`end_frame`)을 받는 것은 Kling O3 계열이다.**
> 끝 프레임이 필요한 컷과 아닌 컷을 갈라 쓰는 것이 맞다.

---

## 4. Kling o3가 실제로 이기는 것

| | 근거 |
|---|---|
| **정액 배치** — 2K 9장이 100 크레딧 | 이 세션 실측 (1·4·9 세 번) |
| **레퍼런스 10장** (참조+element 합산) | Alibaba 공식 API 문서 |
| **시리즈 생성 2~9장** (`result_type=series`) | 같은 문서. ⚠ **Artlist에는 노출 안 됨** |
| **21:9 지원** | Artlist 설정 |
| **캐릭터 일관성** | 유일한 독립 리뷰어(banani)가 3인 얼굴 합성 테스트에서 인정 — **O3의 유일한 실측 강점** |

## 5. 지는 것 (정직하게)

1. **종합 품질 #87/159.** fal 제품 페이지의 *"Top-tier text-to-image with flawless consistency"*와 정면충돌
2. **텍스트 렌더링이 약하다** — 독립 3곳 확인. banani *"Illegible copy, inconsistent font and color"* ·
   overchat *"struggles with longer text — quite a few typos"* ·
   MindStudio(리셀러인데도) *"weaker than specialized models like GPT Image 1.5"*
3. **느리다** — Runware 실측 **평균 2분 22초**(30초~5분). banani는 Omni에서 **15분 초과** 경험.
   **시도 횟수가 곧 시간인 작업에서 이건 크레딧보다 비싸다**
4. **편집이 편집이 아니다** — banani: *"It does show the elements I asked for but not by editing the original hero image —
   **by creating a new one altogether**"*, 그리고 *"the color was changed unsolicited"*.
   **한 장을 반복 수정해 조이는 워크플로에 치명적이다**
5. **미세 지시를 흘린다** — *"I had asked for caustic sunlight but it's not there"*
6. **손·다인 연속성** — PixVerse(Kling 리셀러인데도): *"hands, readable text, and multi-person continuity"* 문제
7. **웹앱 해상도가 작다** — Kling 공식 사이즈 가이드는 16:9 = **1344×768** 7종뿐.
   API는 4K를 광고하는데 자사 가이드와 어긋난다

---

## 6. 한글 — **강한 부정 신호가 하나 있다**

**쿠아이쇼우 공식 API 문서가 프롬프트 언어를 "Supports Chinese and English"로 명시한다.**

그리고 한글 렌더링의 정량 비교는 **상용 모델 대상으로 존재하지 않는다.**
LongText-Bench · OneIG-Bench · CVTG-2K · ChineseWord · TextCraft **전부 영·중 전용, 한국어 트랙 없음.**

유일한 정량 데이터는 연구 모델 대상이다 (GlyphPrinter, arXiv:2603.15616):

| 방법 | 한국어 문장정확도 |
|---|---|
| GlyphPrinter | 0.9362 |
| Glyph-ByT5-v2 | 0.8511 |
| AnyText2 | 0.4894 |
| **Qwen-Image** (중문 텍스트 1위) | **0.2128** |

> **중문 1위 모델의 한글 문장정확도가 21.3%다. 중국어 강세는 한글로 전이되지 않는다.**
> 자모 조합이 깨지는 것이 한글 특유의 실패 모드다.

한국어권 실사용 비교는 눈대중 하나뿐(carat.im, 프롬프트 1개): 나노바나나 "한글도 정교하게 표현 가능" ·
이디오그램 "한계" · 레브 "약해". **Kling은 테스트 대상에 없다.**

Seedream은 **공식적으로 한국어를 명시**한다(단 수치 0). 구글은 지원 언어를 명시하지 않는다.

**→ 화면에 한글이 들어가야 한다면 Kling o3는 후보에서 뺀다.**
**다만 이 저장소는 생성 프레임에 글자를 안 넣기로 이미 정해져 있다**(02 · 04번 문서). 그러면 이 항목은 무관해진다.

---

## 7. 캐릭터 일관성 — 측정된 데이터

arXiv:2609.04151 (2026-09-03). ArcFace 신원 유사도. ⚠ **저자 소속이 자사 기법 홍보 논문이라 베이스라인은 당사자 비교다.**

| 모델 | 생성 | 편집 | 복원 |
|---|---|---|---|
| gpt-image-2 | 0.64 | **0.68** | 0.67 |
| **reve-2.1** | **0.65** | 0.61 | 0.68 |
| seedream-5-pro | 0.61 | 0.65 | 0.66 |
| **nb2** | **0.50** | 0.62 | 0.71 |

**Kling은 평가 대상에 없다.**

이 논문에서 우리 작업에 직결되는 셋:

1. **순차 편집으로 신원이 무너진다** — gpt-image-2가 4라운드에 **0.71 → 0.53**.
   **11번 샷을 편집해 12번 샷을 만들면 안 된다.** 매번 고정된 캐논 레퍼런스에서 새로 생성한다
2. **얼굴이 화면에서 작으면 신원이 붕괴한다**(small face 0.56). **와이드 시네마틱 샷이 최악의 조건이다**
3. **인물이 늘수록 급격히 악화된다**

그리고 **"Nano Banana 2가 캐릭터 일관성 최강"이라는 통설은 이 측정에서 생성 항목 최하위(0.50)로 뒤집힌다.**
구글 자신도 NB2 Lite 발표글에서 *"Character consistency when changing scenes or panning movements has some limitations"*라고 인정한다.

### 레퍼런스 수용량

| 모델 | 장수 | 역할 구분 |
|---|---|---|
| Kling Image O3 | 10 (참조+element 합산) | 없음 — 프롬프트에서 `@Image1`로 지시 |
| **Nano Banana 2** | 객체 10 + **캐릭터 4** + 스타일 3 | **있음** |
| Seedream 5.0 | 10 (입출력 합 15) | 없음 |
| Luma Uni-1.1 | 9 | 있음 (identity/composition/style) |
| **Ideogram V4** | 캐릭터 1장 | — **이 작업에 부적합** |
| **Recraft 4.1** | **캐릭터 참조 기능 없음** | — **탈락** |

---

## 8. 시네마틱 룩 — 정성 평가뿐이다

이 항목을 측정하는 공개 벤치마크가 **없다**(AA·arena.ai 모두 photorealism 카테고리 없음).

| 모델 | 성격 |
|---|---|
| **Reve 2.1** | 공식 포지셔닝 자체가 **"cinematic, filmic, photojournalistic"** · *"Lighting feels more natural"* · AA #5로 뒷받침 |
| **Nano Banana 2** | *"a distinct **cinematic, film-like quality** that other models struggle to replicate"* (Kling 쪽 글이 경쟁자를 이렇게 평가) |
| **Kling o3** | *"more **vibrant and punchy**"* · **"iPhone photography, but done right"** |
| Seedream 5.0 Pro | 공식: *"faithfully reproduces **skin texture**"* · 한국 커뮤니티에서 아시아인 인물·조명 평가 좋음 |

> **Kling o3는 필미크가 아니라 HDR 폰카 룩이다. 시네마틱 첫 프레임과는 결이 반대다.**
> v1의 `--raw --s 80`(미화 억제)이 겨냥한 것과 정확히 반대 방향이다.

---

## 9. 버려야 할 수치 (마케팅이 측정으로 위장한 것)

- Atlas Cloud **"98.5 / 94.8 / 91.2 / 89.5% CJK 정확도"** → 자사 API 판매 페이지 · 표본·평가자·언어별 분해 전부 없음
- **"Seedream 99%+ 텍스트 정확도"** → 바이트댄스 페이지 어디에도 없다. 리셀러 창작
- Kling o3의 **"vCoT / flawless consistency / top-tier"** → 1차 출처 없음. 리셀러 페이지 십여 곳에 **토씨까지 동일한 복붙**
- Luma **"Human Preference Elo 1위"** 자사 주장 → 실제로는 AA #42 · arena.ai #19
- PixMind "3파전 쇼다운" → **본인들이 테스트 안 했다고 명시**

---

## 10. 결론 — 스킬이 따라야 할 것

**Kling o3를 첫 프레임의 기본 모델로 두지 않는다.** 쓸 자리는 하나다 —
**정액 배치로 후보를 넓게 훑는 탐색 단계.** 2K 9장 100 크레딧은 다른 어떤 모델도 못 맞춘다.

**마감 후보 셋:**

| | 왜 | 주의 |
|---|---|---|
| **Seedream 5.0 (2354)** | **4K가 100 크레딧** · 멀티레퍼런스 편집 #4 · 피부·조명 강점 · **한국어 공식 지원 명시** · 아시아인 인물 평가 좋음 | Pro는 시리즈 생성 불가 |
| **Nano Banana 2 (2250)** | AA #6 · **캐릭터 4장 역할 슬롯** · 512px~4K로 영상 해상도 맞추기 쉬움 · 한글 정성 평가 최고 | 신원 유사도 측정은 의외로 낮음(0.50) |
| **Reve 2.1** | 시네마틱/필미크가 필요하면 여기. AA #5 · 신원 측정 생성 1위(0.65) | **Artlist에서 견적조차 실패한다 — 현재 못 쓴다** |

**영상**: i2v 아레나 기준으로는 Seedance 2.x · MiniMax H3 · Wan 3.0이 Kling보다 위다.
**단 Artlist에서 `end_frame`을 받는 것은 Kling O3다.** 끝 프레임이 필요한 컷만 Kling으로 가른다.

**측정 근거가 있는 프로덕션 규칙 셋:**
- **편집 체이닝 금지** — 4라운드에 신원 0.71→0.53
- **와이드 샷에서 얼굴이 작으면 신원이 무너진다** — 인물 식별이 중요하면 별도로 타이트하게
- **첫 프레임은 움직임을 암시하는 상태로, 최종 프레이밍보다 약간 넓게**

---

## 11. 조사 공백

1. **Kling o3 vs Seedream 5 vs NB2 직접 3자 비교는 존재하지 않는다**
2. **한글 렌더링 정량 비교는 상용 모델 대상으로 존재하지 않는다**
3. **동일 프레임 → 다른 영상 모델 / 다른 프레임 → 동일 영상 모델 통제 실험은 아무도 공개하지 않았다**
4. Reddit·X 여론은 표집 실패. "커뮤니티 컨센서스"라는 문장들은 추적하면 **서로를 인용하는 순환 참조**였다

> **가장 값진 제안**: 같은 프롬프트로 Seedream · NB2 · Kling o3 프레임 셋을 뽑아
> 같은 영상 모델에 넣고 블라인드로 보는 실험은 **크레딧 몇백 개면 끝나고,
> 지금까지 찾은 어떤 블로그보다 이 프로젝트에 정확한 답을 준다.** 공개된 적도 없다.

---

# 보론 — 뒤늦게 온 정정과 보강 (같은 날)

## A. ⚠ 정정 — Seedream 5.0 Pro의 "피부 강점"은 유일한 맞대결에서 졌다

앞에서 바이트댄스 공식 주장(*"skin texture… visible pores, three-dimensional"*)을 근거로
Seedream을 피부 쪽에 올렸는데, **실제 맞대결 기록이 나왔다.**

[fal.ai — Seedream 5.0 Pro vs GPT Image 2 (2026-07-14)](https://fal.ai/learn/devs/seedream-5-0-pro-vs-gpt-image-2):
GPT Image 2가 *"unretouched skin with natural texture, visible pores"*를 냈고 테스터가
*"I'm a bigger fan of GPT Image 2's generation here since it looks more realistic"*라고 명시했다.
**fal은 두 모델을 모두 호스팅하므로 OpenAI 편을 들 이유가 없다** — 그래서 증거 가치가 있다.

> **정정: Seedream 5.0 Pro는 "피부를 가장 세게 마케팅하고, 그 축에서 유일한 맞대결을 진" 모델이다.**
> 1차 후보인 것은 유지되지만 **근거는 가성비와 멀티레퍼런스이지 피부가 아니다.**

같은 출처의 프롬프트 준수 보강: *"If you cram in more than the frame can hold,
**you can expect a few instructions to drop**."* — **긴 상세 프롬프트에서 지시를 흘린다.**
시네마틱 첫 프레임 프롬프트는 길어지므로 실질적 약점이다.

그리고 **Reve 2.1의 "시네마틱" 평판도 피부를 직접 본 사람의 글이 아니다** —
자사 포지셔닝 + AA #5라는 종합 순위에서 온 추론이다. 독립 테스트 0건.

## B. 전제 정정 셋

1. **독립 제품으로서의 "Seedream 5.0"은 없다.** 바이트댄스가 낸 것은 **5.0 Lite(2026-02-13)**와 **5.0 Pro(2026-07-08)**뿐이다.
   **→ Artlist의 "Seedream 5.0" SKU(4K를 100 크레딧에 주는 그것)가 실제로 어느 쪽인지 확인이 필요하다. Lite일 가능성이 있다.**
2. **Flux 2 Pro는 2026 모델이 아니다** — 2025-11-25 출시. BFL의 현행 프론티어는 **FLUX 3(2026-07-23)**이고,
   같은 세대 안에서도 **FLUX.2 [max]**가 pro보다 위다.
   **Artlist에서 320 크레딧에 Flux 2.0 Pro를 사는 것은 한 세대 뒤진 모델의 하위 티어를 최고가에 사는 것이다.**
3. **Nano Banana Pro가 Nano Banana 2보다 구형이다.** Pro = `gemini-3-pro-image`(2025-11-20),
   2 = `gemini-3.1-flash-image`(더 최신). 이름만 보면 Pro가 상위 같지만 아니다.

## C. "AI 룩" 최종 정리

| 판정 | 모델 | 근거 |
|---|---|---|
| **진짜 질감 증거 있음** | **GPT Image 2 / 2.5**(모공 보임) · **FLUX.2**(*"believable pores and translucency"*) | fal 맞대결 · mage.space |
| **설계 의도가 가장 시네마틱** | **Luma Uni-1.1** — *"trained in collaboration with **Hollywood cinematographers**"* | 공식. ⚠ **독립 검증 0건**, AA #42 |
| **사실감 편향이나 언캐니** | Nano Banana Pro / 2 — 비정형 요청을 관습적 구도로 "치팅" | minimaxir 리뷰 |
| **플라스틱 피부 → 인물 회피** | **Qwen Image 3** — *"over exposed over filtered mannequins"* · 다리 3개 | HN 571pts |
| **혼재/미검증** | Seedream 5.0 Pro | 위 A |
| **피부 평가 자체가 없음** | Ideogram 4.0 · Recraft V4.1 · Grok Imagine 2.0 · **Reve 2.1** | — |

**구조적 설명**: 확산 모델은 미세 질감을 노이즈로 보고 제거하고, 학습 데이터는 이미 리터칭돼 있고,
업스케일러가 또 뭉갠다. *"plastic skin is not a prompt problem, it is baked into how these models work."*
**→ 프롬프트로 "포어, 질감"을 아무리 써도 한계가 있고 모델 선택이 더 결정적이다.**

## D. 명단 밖 다크호스 둘

- **MAI-Image-2.6 (Microsoft)** — AA **#4(1144)** · arena.ai **#4(1331)**
- **Meta Muse Image** — AA **#7(1109)** · **$0.01/장**

둘 다 Kling o3(#87)는 물론 Seedream 5.0 Pro(#15)·Flux 2 Pro(#36)보다 위다. Artlist에 없다.
**"Artlist에 있는 것 중에서"라는 제약이 실제로 비용을 물리고 있다는 뜻이다.**

## E. Ideogram · Recraft · Grok 세부 (첫 프레임 관점)

| | Ideogram 4.0 | Recraft V4.1 | Grok Imagine 2.0 |
|---|---|---|---|
| 최대 화소 | 2048² · 긴 변 3328 | 1024² 표준 · **2048² / 3072×1536 Pro** | 1k / 2k |
| 시네마틱 비율 | 2560×1440 · **21:9 없음** | 16:9 → 2688×1536 Pro · **21:9 없음** | **21:9 + 5:2 네이티브** |
| 레퍼런스 | **1장**(remix만) | **스타일 10장** | **5장** |
| 프롬프트 한도 | JSON 계약(**키 순서가 중요**) | **10,000자** + 네거티브 | 장문 자연어 |
| AI 룩 | ⚠ **플라스틱 피부 문서화됨**, 기본 CFG에서 과조리 | ✅ 가장 조용한 피부, 단 **스타일이 밋밋** | ⚠ *"overly crisp or hyper-defined"* |
| 속도 | 가장 느림(*"minutes vs seconds"*) | 6.5초 / Pro 12초 | **66~94초** |

- **Ideogram 4.0은 캐릭터 레퍼런스가 V3 전용**이고 V4 generate에는 **참조 파라미터가 아예 없다.** 컷 간 룩 고정이 어렵다
- **Recraft V4.1은 스타일 레퍼런스 10장을 받아 재사용 가능한 `style_id`를 돌려준다** — 샷 리스트 전체의 룩을 잠그는 데 가장 적합한 구조다. 단 Pro는 장당 $0.21
- **Grok 2.0만 21:9를 네이티브로 준다**(문서에 *"Cinematic widescreen"*으로 명시). 텍스처가 처리된 느낌이라 그레인 패스를 예산에 넣어야 한다

## F. 이 보론이 바꾸는 것

**Kling o3에 대한 결론은 약해지지 않았다 — 오히려 강해졌다.**
이번 조사에서도 Kling은 **사실감·피부·조명 비교에 단 한 번도 등장하지 않았다.**

**마감 후보 수정판:**

| 용도 | 모델 |
|---|---|
| **인물 클로즈업 · 피부가 보이는 샷** | **GPT Image 2.5** 또는 **FLUX.2 [max]** — 실제 질감 증거가 있는 유이한 둘. 비싸다 |
| **와이드 시네마틱 · 대량** | **Nano Banana 2** — 21:9, 512px~4K로 영상 해상도 정확 매칭, **배치 50% 할인**, 한글 정성 1위 |
| **저비용 대량 + 멀티레퍼런스 합성** | **Seedream 5.0 Pro** — Artlist 75 크레딧. ⚠ **긴 프롬프트에서 지시 누락** |
| **샷 리스트 전체 룩 고정** | **Recraft V4.1** — 스타일 10장 → 재사용 `style_id` |
| **인물에 쓰지 말 것** | **Qwen Image 3** |
| **Kling o3** | **탐색 배치 전용.** 메인 프레임용 아님 |

---

# 보론 2 — Google · OpenAI 세부 (같은 날 · 마지막 회수분)

## A. ⚠ **Nano Banana 2보다 Nano Banana Pro가 더 필미크하다**

앞선 보론 B-3에서 "Pro가 구형"이라고만 적었는데, **룩에서는 그 구형이 더 낫다.**

> the-decoder 자체 벤치마크 렌더(2026-02-26): NB2가 복잡한 프롬프트를 대체로 맞게 그리지만,
> *"**Pro output still looks more dynamic and realistic overall, while Nano Banana 2 has a
> slightly artificial quality to it.**"*

**→ NB2는 속도와 가격을 위해 룩을 내준 모델이다. 시네마틱 프레임에는 NB Pro가 낫다.**

그리고 **NB2에는 치명적인 약점이 하나 더 있다**:
> *"Nano Banana 2 **deteriorates the output with each turn, becoming unusable with just a few edits.**"*

04번 문서의 "편집 체이닝 금지"와 정확히 같은 이야기다. **NB2는 한 번에 뽑고 끝내야 한다.**

## B. 하우스 룩이 갈린다 — 이 프로젝트에 직결된다

> the-decoder: ChatGPT는 *"more intense-looking images"*에 광택 있는 **화보 품질**,
> Nano Banana Pro는 더 문자 그대로 해석하며 ***"casual photo look"*** 을 낸다.

> **OpenAI = 스튜디오·상업 광택 / Google = 스냅샷·다큐멘터리**

**v1의 룩은 다큐멘터리다** — `--raw`, 낮은 stylize, 자연광 서술, 미화 배제(02번 문서).
**→ 결이 맞는 쪽은 Google이다.**

## C. 사양 (공식)

### Nano Banana 2 / Pro

| | NB2 (`gemini-3.1-flash-image`) | NB Pro (`gemini-3-pro-image`) |
|---|---|---|
| 출시 | 2026-02-26 | 2025-11-20 |
| 해상도 | **0.5K · 1K · 2K · 4K** | 1K · 2K · 4K |
| 종횡비 | `1:1 3:2 2:3 3:4 4:3 4:5 5:4 9:16 16:9` **`21:9`** | 같음 |
| 16:9 픽셀 | 1024×576 / **2048×1152** / **4096×2304** | 같음 |
| 21:9 픽셀 | 1216×520 / 2432×1040 / 4864×2080 | 같음 |
| 참조 | 객체 **10** + 캐릭터 **4** + 스타일 **3** (총 14) | 객체 **6** + 캐릭터 **5** |
| 공식 단가 | 1K $0.067 · 2K **$0.101** · 4K $0.151 | 1K·2K **$0.134** · 4K **$0.24** |
| 배치 | **−50%** | −50% |

**16:9 2K가 2048×1152다.** 우리 촬영본 3200×1800(정확히 16:9)과 비율이 같다 — **Kling o3보다 낫다**(03번 문서의 격자 불일치 참조).

### GPT Image 2.5

두 모델이 있다. `sunburst`(편집 정밀도 최상) · `flare`(빠른 일상 생성). 둘 다 2026-09-08.

| | 값 |
|---|---|
| 크기 제약 | 두 변 모두 **16의 배수** · 종횡비 **1:3 ~ 3:1** · **긴 변 ≤ 3840px** · 총 화소 0.65~8.29MP |
| 실질 최대 | **3840×2160** (4096×2048은 불가 — 긴 변 초과) |
| 품질 | `low` `medium` `high` **`xhigh`** **`max`** `auto` |
| 참조 이미지 | **최대 16장** |

**1920×1080 `high`가 $0.0396/장이다** — 시네마틱 16:9로는 가장 싼 축이다.
3840×2160 `high`는 $0.10, `max`는 $0.40.
⚠ **정사각형이 4K 16:9보다 비싸다**(토큰이 짧은 변 비율의 제곱으로 는다).

## D. 실사용 증언 — 피부

**gpt-image-2로 5만 장을 돌린 실무자**(HN):
> gpt-image-2는 *"a lot of the **'fried' look for some of his skin**"* · 2.5는 *"Did very well modifying the pose
> while keeping the appearance"* · 지연 104초 → **35~40초**
> 다만 회귀도 있다: *"the microglyphs… they're kinda **blurry / not straight**"*

**OpenAI의 알려진 약점 — 편집 시 디테일 손실**:
> *"I've also found the OpenAI image models to **lose fine detail on image edits** compared to
> Nano Banana or Flux models which faithfully retain input source image geometry and details."*

**닮음의 "미화" — 2.5에 대한 가장 선명한 불만**:
> OpenAI 자체 데모에 대해: *"The shoulders of ChatGPT's output are just wrong. Sure, the kid looks
> prettier, stronger… but it's not him… **It's just not the same child**. I find that particular example creepy."*

**NB Pro의 언캐니 신호**(minimaxir): *"triggers my uncanny valley sensor"* ·
*"color/lighting contrast between the cats and the setting too great"* — **피사체가 배경에서 떠 보이는 HDR 합성 룩**.

## E. **두 벤더가 스스로 플라스틱 피부를 인정한다**

- **OpenAI 공식 프롬프트 가이드가 질감을 명시하라고 시킨다**:
  *"Request 'photorealistic' or 'real photograph' explicitly when that is the goal"* ·
  *"The image should feel honest and unposed, with **real skin texture**, worn materials, and everyday detail"*
- Google NB2 마케팅은 *"vibrant lighting"*을 앞세운다 — **우리가 싸워야 할 바로 그 HDR 레지스터다**

그리고 OpenAI가 정직하게 적어 둔 경고:
> *"**Treat camera specifications as cues for appearance, not a guarantee of exact physical simulation.**"*

10번 문서의 "렌즈 용어는 주문이지 계산이 아니다"와 같은 말이고, **이번엔 벤더 공식 문구다.**

## F. 최종 후보 — 세 번째 수정판

| 용도 | 모델 | 근거 |
|---|---|---|
| **시네마틱 첫 프레임 (기본)** | **Nano Banana Pro** 4K | 룩에서 NB2보다 낫다(the-decoder) · 다큐멘터리 결 · 캐릭터 참조 5장. $0.24 |
| **와이드·대량, 비용 우선** | **Nano Banana 2** 2K | 2048×1152로 우리 비율과 일치 · 배치 −50% · $0.101. ⚠ **한 번에 뽑고 끝낸다**(편집 시 열화) |
| **가장 싼 시네마틱 16:9** | GPT Image 2.5 `high` 1920×1080 | $0.0396 |
| **반복 편집으로 정체성 유지** | **GPT Image 2.5 sunburst** `xhigh`/`max` | NB2가 무너지는 지점. 다만 **편집 시 디테일 손실**과 **미화** 주의 |
| **탐색 배치** | Kling o3 2K ×9 | Artlist 100 크레딧 |

> ⚠ 위 단가는 **벤더 API 기준**이다. **Artlist 크레딧 체계는 다르게 매겨진다** — 실제 결정은
> `get_generation_cost`로 Artlist 안에서 다시 재야 한다. Artlist에 NB **Pro**는 `modelId 2071`(4K)로 있다.

---

# 보론 3 — 실사용 대결 증거 (마지막 회수분)

## A. ⭐ 이 조사 전체에서 가장 좋은 단일 증거

**Curious Refuge**(AI 영화 제작 학교), 2026-09-11 — [기사](https://curiousrefuge.com/blog/open-ai-gpt-image-model-review) · [영상](https://www.youtube.com/watch?v=pEYqorQrc4U)

GPT Image 2.5(Sunburst) 대 **Nano Banana Pro · Nano Banana 2 · Seedream 5.0 · MAI Image 2.6 · 미드저니**.
**9개 작업 테스트에 약 50장의 나란히 놓은 생성물.** 결론 (verbatim):

> **"Nano Banana Pro Still Wins for Photorealism."**
> *"Nano Banana Pro consistently produced **more natural skin, cleaner textures**, and more convincing photography."*
> GPT Image 2.5: *"faces and other fine details can develop an **artificial fractal-like texture**.
> **Skin can look overly sharpened**, and small features like eyebrows begin to feel synthetic."*
> **Seedream 5.0: *"also solid, but the skin looked more plasticky in comparison."***

그리고 반복 편집에 대해: *"With every edit, the image became slightly **sharper, more saturated, and more artificial**."*

**→ 보론 2의 "NB Pro가 기본" 판단이 실물 비교로 확인됐다.**

## B. **피부 순위가 아레나 순위와 거의 반대다** — 이번 조사의 핵심 통찰

두 개의 가장 잘 조사된 2026년 테스트가 일치하는 순위:

```
Nano Banana Pro  >  Nano Banana 2  ≳  Seedream 5.0(플라스틱)
                 >  GPT Image 2.5(과샤프·합성 그레인)  >  FLUX.2(플라스틱 피부)
```

**이것은 lmarena 순위의 거의 정확한 역순이다** (lmarena: GPT 2.5 1·2위 · Seedream 5.0 Pro 10위 · NB2 9위 · **NB Pro 14위**).

> **→ 아레나 Elo는 일반 취향 투표이지 사실감 측정이 아니다.**
> 06·09번 문서에서 "87위가 우리 과제에서도 87위라는 보장은 없다"고 적은 것의 근거가 이것이다.
> **시네마틱 프레임을 고를 때 아레나 순위를 1차 기준으로 쓰면 틀린 방향으로 간다.**

벤치 운영자 본인(vunderba, GenAI Showdown 저자)도 같은 말을 한다:
> *"I wouldn't put a lot of stock in Arena's scoring system… They have Meta's Muse Image ranked above NB Pro,
> which is just **patently absurd**."*

## C. 다른 독립 실사용 대결

| 출처 | 날짜 | 무엇 | 판정 |
|---|---|---|---|
| **TechRadar** (Schwartz) | 2026-09-10 | GPT Image 2.5 단독 심층 | *"the image feels like an **overprocessed photograph**"* · *"grain creeping across the twilight sky and their hair and skin is glaringly obvious"* · **uncanny valley** |
| **TechRadar** | 2026-02-13 | Seedream 5.0 **대** NB Pro, 5 프롬프트 | Seedream = *"feels like a **fantasy illustration** rendered with high polish"* · NBP = *"sharper caustics and more believable distortion"* · *"visible surface wear"* |
| **TechRadar** | 2026-04-28 | ChatGPT Images 2.0 대 NB2, **리라이팅** | ⚠ **NB2의 실패 모드**: *"**The face is smoothed out**, too, to add a glow, which looks nice but makes it feel less like a real photo"* |
| **TechRadar** | 2026-08-05 | NB2 대 ChatGPT | NB2가 *"that 'it looks like AI'-quality… a slightly **flat** quality"* |
| **Fstoppers** (현직 패션 사진가) | 2026-04-25 | NB Pro로 실제 15룩 캠페인 재현 | *"a designer immediately flagged that the **fabric didn't match** the feel of the real material"* · 각도 간 일관성 붕괴 · **해상도가 현대 카메라에 크게 못 미침** · *"for professional client work, it's still **too sloppy**"* |
| **GenAI Showdown** | 상시 (최신 2026-08-04) | 15개 난제 · 전 모델 결과물 공개 | **프롬프트 준수 측정이지 사실감이 아니다.** GPT_IMAGE_2 12/15 · NB Pro 10 · NB2 10 · Reve 2.1 10 · Ideogram 4 8 · FLUX2_PRO 6 · Qwen 4 |

## D. "AI 룩"의 정체 — 실무자들의 진단

**FLUX 계열이 가장 많이 지목된다** (Artcraft 개발자, HN):
> *"why do Flux model outputs look so God-awful bad? They have **plastic skin, weird chins**, and have that 'AI' aura…
> **Flux 2 seems to suffer from the exact same problems**."*

**HDR 비유가 명시적으로 나온다** (HN):
> *"**It's the HDR era all over again**, where people edited their photos to lack all contrast and just be ultra flat."*
> *"**The lighting is wrong**… They look **too crisp. No proper shadows, everything looks crystal clear**."*
> *"Human skins in AI images tend to look **clouded, opaque, and overall un-alive**."*

**판별 포인트**:
> *"**Eyebrows, eyelashes and skin texture are still a dead giveaway** for AI generated portraits."*

**미감과 사실감의 상충이 이름 붙어 있다**:
> *"Apparently image models have to **choose between aesthetics and photorealism**. Many aren't good at either."*
> *"there is a **tradeoff between prompt following and avoiding slop style**."*

**사진가의 표현** (Fstoppers, 2026-02-07):
> *"the images often end up **technically polished yet emotionally flat**… there is still a tell,
> a **dreamlike wrongness** that many serious clients will notice even if they can't name it."*

## E. 하지 않은 것 / 없는 것

- **PetaPixel과 Fstoppers는 모델 대결을 하지 않는다.** 전 2026년 사이트맵을 훑어 확인했다 — 뉴스·윤리·법 기사뿐
- **the-decoder는 출시 보도이지 테스트가 아니다**
- **Recraft V4.1 · Grok Imagine 2 · Qwen-Image-3.0 Pro · Luma Uni-1.1은 피부·사실감으로 평가한 실사용 비교가 하나도 없다.** 리더보드 항목과 출시 글만 있다
- **imgsys.org는 버려졌다** — 36개 모델 전부 `created_at = 2025-03-24`. 쓰지 말 것

## F. 최종 확정

| 용도 | 모델 | 근거 등급 |
|---|---|---|
| **시네마틱 첫 프레임 (기본)** | **Nano Banana Pro** | ⭐ 50장 나란히 놓은 독립 실사용 비교에서 사실감 1위 |
| 비용 우선 대량 | Nano Banana 2 | ⚠ 리라이팅에서 **얼굴을 매끄럽게 만든다** · 편집할수록 열화 |
| 반복 편집 | GPT Image 2.5 sunburst | ⚠ 편집할수록 **더 샤프·채도↑·인공적** |
| 탐색 배치 | Kling o3 2K ×9 | 가격만 |
| **쓰지 말 것** | FLUX.2 · Qwen Image 3 | 플라스틱 피부 반복 지목 |

> **그리고 v1의 실사 소재가 있다는 것이 이 프로젝트의 진짜 이점이다.**
> Fstoppers의 패션 사진가가 발견한 것 — 실물과 대조하면 AI가 금방 들통난다 — 은 우리에게도 그대로 적용된다.
> **생성 프레임은 실제 촬영본 옆에 놓인다.** 그 대비를 견디는지가 최종 판정이고, 그것은 아레나가 못 말해 준다.
