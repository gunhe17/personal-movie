# 결정 — 첫 프레임 모델은 **Kling o3**

확정 2026-09-13 · 랩 01 결과 · 결정자 사용자

---

## 정한 것

| | |
|---|---|
| **모델** | **Kling o3** — `modelId 2189` (Image 3.0 Omni · T2I · 1K+2K) |
| 설정 | `aspect_ratio: 16:9` · `resolution: 2K` · `num_images: 4~9` |
| 실측 산출 | **2720 × 1536** (비율 1.771) |
| 비용 | **장수와 무관하게 100 크레딧** — 1장이든 9장이든 같다 |

## 왜 이 모델인가

네 모델을 같은 장면으로 돌리고 각 모델의 공식 문법에 맞춰 프롬프트를 따로 썼다.
결과는 **셋이 서로 다른 것을 잘하는** 형태였다.

| | 빛 | 피부 | 공간 충실도 | 글자 누출 | 4장 |
|---|---|---|---|---|---|
| **Kling o3** | 강함 | 보통 | **좋음** | **0/4** | **100** |
| Seedream 5.0 Pro | 매우 좋음 | 매우 좋음 | 최상 | 0/4 | 300 |
| Nano Banana 2 | 평평함 | **최상** | 좋음 | **2/4** | 360 |
| Artlist Original Indie | **최상** | 좋음 | **방이 빔** | 0/4 | 640 |

Kling o3를 고른 근거 넷:

1. **정액 배치.** 2K에서 9장을 뽑아도 100 크레딧이다. 다른 모델은 전부 장당 과금이라
   같은 9장에 900(Seedream) · 810(NB2)이 든다. **첫 프레임은 여러 장 뽑아 고르는 일**이므로
   이 차이가 그대로 작업 방식을 정한다.
2. **공간을 가장 성실히 짓는다.** 지시한 소품(블라인드 · 방문자 의자 · 화분 · 그림책 선반)을
   빠짐없이 넣었다. Artlist는 방을 통째로 비웠다.
3. **팔레트가 v1과 맞는다.** 공식 팔레트명 `Low Saturation Gray`가 실제로 작동해
   저채도 회녹색이 나왔다. v1의 미드저니 룩과 결이 같다.
4. **글자 누출 0/4.** Nano Banana 2는 그림책 표지에서 2/4로 샜다.
   이 프로젝트는 생성 프레임에 읽히는 글자를 넣지 않는 것이 하우스 룰이라 이 항목이 무겁다.

## 알면서 받아들인 것

| | |
|---|---|
| **피부가 1위가 아니다** | Nano Banana 2가 팔뚝 힘줄·정맥에서 확연히 낫다. 우리 컷은 얼굴 클로즈업이 주가 아니므로 감수한다 |
| **인물 나이가 위로 나온다** | 프롬프트에 40대라고 썼는데 더 위로 나왔다. 배역이 중요한 컷은 프롬프트를 조일 것 |
| **정확한 16:9가 아니다** | 2720×1536 = 1.771. 촬영본 3200×1800(1.778)과 화소가 안 맞는다. 편집에서 흡수한다 |
| **Nano Banana Pro는 안 재봤다** | 4장 1,120 크레딧이라 승인 게이트에 걸렸다. 독립 비교에서 사실감 1위인 모델이다 — **인물 클로즈업이 필요한 컷이 생기면 그때 다시 연다** |

---

## 확정된 프롬프트 문법 (이 모델 전용)

랩에서 통과한 형태다. 다음 장면들은 이 골격을 따른다.

```
Documentary photograph aesthetic, unretouched, fine film grain.

<주체와 동작 — 동작의 시작점으로. "the moment before …">

FG: <전경>  MG: <중경>  BG: <배경>

Light: <방향 + 질 + 색온도>; <반대편이 어떻게 떨어지는지>

Composition: rule of thirds. <주체가 차지하는 분수>;
<비워둘 사분면>, left clear for copy added later.

Angle: <앵글>

Focus: hard focus on <대상>. Set to <NN>mm, <심도> so <배경>
stays readable during a <이후 카메라 무브>.

Tone: Low Saturation Gray palette, muted grey-green and warm beige.
Natural skin texture with visible pores, matte skin with no shine,
believable proportions and natural hands.

Overall vibe: <한 줄>

<모든 표면을 긍정문으로 비운다 — bare and unmarked / plain and unbranded /
 clean and free of print>
```

### 이 문법이 지키는 규칙 다섯

1. **길게 쓴다 (400~1,200자).** 이 모델에는 Prompt Enhancer가 내장돼 있어
   짧게 쓰면 모델이 멋대로 채운다. 간결하게 쓰라는 통념이 여기서는 틀렸다.
2. **부정문을 쓰지 않는다.** 네거티브 프롬프트 필드가 없고, 영어 부정문은
   **억제가 아니라 소환으로 작동한다**(아래 §라운드 1). 배제는 전부 긍정문으로 뒤집는다.
3. **공간을 분수로 명시한다.** `1/3` · `FG/MG/BG` · 비워둘 사분면.
4. **이후 카메라 무브를 이미지 프롬프트에 미리 적는다.**
   공식 키프레임 템플릿의 트릭이다 — 그 무브가 가능한 구도로 프레임을 짠다.
5. **공식 어휘 안에서만 논다.** `Set to 50mm` · `Low Saturation Gray` 같은
   공식 표기·팔레트명은 작동하고, 임의의 필름 룩 이름(VHS 등)은 무시된다.

---

## 라운드 1이 남긴 것 (100 크레딧 · 폐기)

첫 판은 얼굴을 빼려고 `No face and no head in frame`을 넣었다.
**네 장 모두 얼굴이 크게 들어왔다.** 원인은 모델이 아니라 프롬프트였다.

문장이 `A woman's hands and forearms rest on…`으로 시작했다.
**사람을 명명하면 모델이 그 사람을 만든다.** 뒤따르는 부정문으로는 이미 불려 나온 주체를 못 지운다.

나중에 도착한 FLUX.2 조사가 같은 것을 독립적으로 확인해 줬다 —
인코더가 `a person without glasses`를 읽으면 **glasses라는 단어에 의미가 실려 오히려 안경을 그린다.**

| | |
|---|---|
| ❌ 버림 | `No face and no head in frame` |
| ❌ 버림 | `No visible words, lettering, numbers, signage, logos, watermark` |
| ✅ 대신 | `the counter surface is bare and unmarked, the wall plain and unbranded, every surface clean and free of print` |

**결과**: 글자 누출 2/4 → **0/4**, 손 이상 2/4 → **0/4**.

---

## 산출물

```
kling-o3/              라운드 1 (폐기) · 4장 + 컨택트 시트
kling-o3-r2/           ★ 라운드 2 (채택) · 4장 + 컨택트 시트
nano-banana-2/         비교군 · 4장
artlist-original-indie/ 비교군 · 4장
seedream-5-pro/        비교군 · 4장
web/                   아티팩트용 축소본 (jpg)
report.html            프롬프트 전문 + 결과 비교 아티팩트
3-way-compare.png · 4-way-compare.png
```

**Kling 생성물은 30일 뒤 서버에서 삭제된다.** 전부 로컬에 내려받아 두었다.

## 쓴 비용

| | 크레딧 |
|---|---|
| Kling o3 라운드 1 (폐기) | 100 |
| **Kling o3 라운드 2 (채택)** | **100** |
| Seedream 5.0 Pro | 300 |
| Nano Banana 2 | 360 |
| Artlist Original Indie | 640 |
| **합계** | **1,500** |

잔액 6,413 (2026-10-10 갱신). **채택본 자체는 100 크레딧이다.**

## 다음

1. 아홉 장면의 첫 프레임을 이 문법으로 뽑는다 — 장면당 **2K 9장 = 100 크레딧**
2. 컷 간 룩 고정을 참조 이미지(`input`, 최대 10장)로 시험한다
3. 그 프레임을 영상에 넣어 **끝 프레임을 받는 셋**을 비교한다 —
   Kling O3(347) · Flux 3 FLF(550) · Omni 1.1 Interpolation(592)
