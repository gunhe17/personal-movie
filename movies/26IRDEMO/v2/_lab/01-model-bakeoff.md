# 랩 01 — 첫 프레임 모델 선정 (설계 2026-09-13)

**묻는 것 하나**: 우리 소재로 첫 프레임을 만들 때 어느 모델이 가장 나은가.
공개 벤치마크가 답하지 못하는 질문이다(`_research/12-benchmark-methodology.md`).

**방법**: 동일 프롬프트 · 동일 비율 · 모델당 4장 · 사람이 눈으로 판정.

---

## 1. 프롬프트 (전 모델 동일 · 변경 금지)

```
Documentary photograph, unretouched. A woman's hands and forearms rest on a pale laminate
reception counter, one hand about to pick up a pen, the other flat and still, the moment
before she writes. Behind the counter, a small Korean child-counselling centre in late
afternoon: a low shelf of worn picture books, a cloth armchair, a potted plant, a
half-closed blind. Warm late-afternoon daylight enters from the left through the blind and
falls across the counter in soft bands; the far side of the room stays in cool shade.
Composition: rule of thirds, the hands occupying the lower left third, with calm
uncluttered negative space in the upper right for copy added later. Angle: high
three-quarter, eye-level with the counter. Focus: hard focus on the knuckles and the pen.
Set to 50mm, medium depth of field so the shelves behind stay readable during a slow dolly
in. Tone: low saturation grey-green and warm beige, Morandi colours, natural skin texture
with visible pores and fine creases, believable proportions and natural hands. Overall
vibe: quiet, ordinary, a little tired. No visible words, lettering, numbers, signage,
logos, watermark, or interface elements. No face.
```

### 이 프롬프트가 이렇게 생긴 이유 (전부 `_research` 근거)

| 요소 | 근거 |
|---|---|
| **손·팔만, 얼굴 없음** | v1의 하우스 룰(`02`) · 얼굴은 i2v에서 가장 먼저 무너진다(`04`) · 작은 얼굴은 신원 붕괴(`09`) · 아동 등장 조항 회피(`05`) |
| **그런데 피부는 프레임 안에 있다** | 모델 간 차이가 가장 크게 나는 축이 피부다(`09` 보론 3). 얼굴 없이 피부를 시험하는 유일한 방법 |
| `Documentary photograph, unretouched` | 미드저니 `--raw`의 대체(`02`). Kling에는 `--s`·`--c`가 없다 |
| **`the moment before she writes`** | **동작의 시작점.** 중간 동작·모션 블러는 i2v에서 되감기를 부른다(`04` §2) |
| `negative space in the upper right for copy added later` | 공식이 보상하는 **여백 예약** 패턴(`10` §3). 자막 자리를 미리 비운다 |
| `Set to 50mm` | 공식 예시의 **verbatim 형식**(`10` §4) |
| **`during a slow dolly in`** | 공식 키프레임 템플릿의 핵심 트릭 — **이후 카메라 무브를 이미지 프롬프트에 미리 적으면 그 무브가 가능한 구도로 짠다**(`10` §8) |
| `Morandi colours` · `low saturation` | 공식 §5.2 팔레트 이름(`10` §4) · v1의 회녹색 저채도(`02` §5) |
| `natural skin texture with visible pores` | OpenAI 공식 가이드가 **명시하라고 지시**(`09` 보론 2 §E) |
| `believable proportions and natural hands` | 손 실패 회피의 긍정형(`10` §10) |
| **끝의 `No visible words…` 절** | **네거티브 프롬프트 필드가 없다**(`10` §5). fal 공식 권고대로 긍정문 안에 부정절로 넣는다. v1의 `--no` 목록 이식 |
| 길이 1,180자 | **Prompt Enhancer가 짧은 프롬프트를 멋대로 부풀린다**(`10` §1). 400~1,200자가 스윗스팟 |

### 공정성 규칙
- **문자열을 모델별로 손보지 않는다.** GenAI Showdown이 모델별로 조정해 비교 가능성을 잃은 것과 반대로 간다(`12` §4)
- 모델별로 다른 것은 **기계적 설정뿐**이다 — 비율·해상도·장수
- 네거티브 프롬프트 필드를 가진 모델이 있어도 **쓰지 않는다.** Kling에 없기 때문이다
- 시드는 **어느 모델에도 없다**(`10` §5). 재현은 포기하고 장수로 대신한다

---

## 2. 후보와 탈락 사유

### 넣는 것

| 모델 | modelId | 4장 | 넣는 이유 |
|---|---|---|---|
| **Kling o3 2K** | 2189 | **100** | 비용 기준점. 장수 무관 정액 |
| **Seedream 5.0 Pro** | 2616 | 300 | 최저가 유력 후보 · **한국어 공식 지원 명시** · 아시아인 인물 평 좋음 |
| **Nano Banana 2** | 2250 | 360 | AA #6 · 2048×1152로 촬영본 비율과 일치 |
| **Artlist Original — Cinematic** | 2122 | 640 | **아무도 벤치마크한 적 없다.** Artlist 자체 시네마틱 튜닝 |
| **Nano Banana Pro** | 2071 | **1,120** | **독립 실사용 비교에서 사실감 1위**(`09` 보론 3). 이 랩의 기준선 |

### 빼는 것

| 모델 | 4장 | 사유 |
|---|---|---|
| GPT Image 2.5 | 680 | 독립 두 곳에서 **과샤프·합성 그레인** 지적. 하우스 룩이 스튜디오 광택이라 다큐멘터리와 반대 |
| Grok Imagine 2.0 | 600 | *"overly crisp or hyper-defined"* · 강점인 21:9가 우리에겐 불필요 |
| Flux 2 Pro | 1,280 | **플라스틱 피부 반복 지목** · AA #36인데 최고가 |
| Qwen Image 3 | 400 | *"over exposed over filtered mannequins"* · 해부 오류 |
| Reve 2.1 | — | **Artlist에서 견적 자체가 실패한다** |
| Recraft 4.1 | 1,560 | 강점이 **샷 간 룩 고정**이다. 단일 프레임 경쟁이 아니라 **2단계 과제** |
| Ideogram V4 | 600 | V4 generate에 **참조 파라미터가 없다.** 컷 간 일관성 불가 |

---

## 3. 비용

| 구성 | 크레딧 | 잔액 대비 |
|---|---|---|
| **A. 권장 5종** | **2,520** | 32% |
| B. 기준선 제외 4종 | 1,400 | 18% |
| C. 최소 3종 (Kling o3 · Seedream Pro · NB2) | 760 | 10% |

잔액 7,913 (2026-10-10 갱신).

**A를 권하는 이유**: Nano Banana Pro는 **우리 축(피부·질감)에서 이겼다는 독립 증거가 있는 유일한 모델**이다.
프레임당 280 대 Nano Banana 2의 90. 본편에서 프레임을 20장 쓴다면 **차액이 3,800이다.**
**1,120을 한 번 써서 그 선택을 확정하는 것이 남는 장사다.**
반대로 우리 소재에서 Pro가 안 이기면 그 자리에서 3,800을 아낀다.

---

## 4. 판정

산출물은 `_lab/01-model-bakeoff/<모델>/` 에 내려받는다.
**Kling 생성물은 30일 뒤 서버에서 삭제되므로 즉시 로컬 보관한다**(`05` §2).

**판정은 사람이 한다.** 볼 것 넷:

1. **피부** — 손등 모공·주름·힘줄. 플라스틱·왁스·과샤프면 탈락
2. **빛** — 블라인드 띠가 물리적으로 맞는가. 그림자가 한 방향인가. HDR처럼 전체가 균일하면 탈락
3. **글자** — 배제 절이 먹었는가. 간판·숫자가 새어 들어왔으면 감점
4. **촬영본 옆에 놓았을 때** — `v1/s01-접수/raw/`의 실제 프레임 옆에 두고 본다. **이것이 최종 기준이고 어떤 아레나도 대신 못 한다**

---

## 5. 다음 단계 (이 랩 이후)

- **2단계**: 고른 모델로 아홉 장면의 첫 프레임을 뽑고, 룩 고정을 Recraft 스타일 참조로 시험
- **3단계**: 그 프레임을 i2v에 넣어 **끝 프레임 지원 셋**(Kling O3 · Flux 3 FLF · Omni 1.1 Interpolation)을 비교
