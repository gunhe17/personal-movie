# 이미지 모델과 영상 모델의 조합 — 공개 증거는 없다 (조사 2026-09-12)

"Kling 이미지로 만든 프레임을 Kling 영상에 넣으면 더 낫다"는 통념을 검증하려 한 조사.
**Reddit·X·YouTube는 이 환경에서 접근이 막혔다. 결과 없음은 접근 제약이지 부재의 증명이 아니다.**

---

## 1. 결론 — **검증된 적이 없다**

> **첫 프레임을 만든 모델을 바꿔 가며 영상 모델은 고정하는 실험은 공개적으로 하나도 없다.**

공개된 비교는 전부 **반대 방향**이다 — 프레임을 고정하고 영상 모델을 바꾼다.
그리고 그중 **어느 하나도 그 프레임을 어떤 이미지 모델이 만들었는지 밝히지 않는다.**

**같은 패밀리 가설은 반증된 것이 아니라 미검증이다.**

학술 문헌도 다루지 않는다. I2V 논문들(ConsistI2V · FrameBridge · AIGCBench · SG-I2V · I2VEdit)은
첫 프레임을 순수한 조건 신호로 취급할 뿐 **그 생성자를 변수로 두지 않는다.**

---

## 2. 그 자리를 채우고 있는 것은 마케팅이다

| 출처 | 주장 | 성격 |
|---|---|---|
| seedance.tv (ByteDance 인접) | "Seedream으로 프레임을 만들고 Seedance로 움직이는 것이 가장 강력한 워크플로" | 주장, 테스트 없음 |
| Tech Jacks | Nano Banana 2 → Veo 3.1이 "깔끔하게 인계된다" | **한 벤더 UI 안의 편의**에 대한 말이지 품질 비교가 아니다 |
| createv.ai | 미드저니 영상이 "미드저니 이미지에서 비할 데 없는 미감 이전" | 403이라 DDG 스니펫만 — **이 보고서에서 가장 약한 항목** |
| **Kling 공식** | 이미지 O3와 시작·끝 프레임 기능을 **별개 제품으로 다룬다.** 같은 패밀리를 쓰라는 품질 주장이 **없다** | — |

**Kling 자신이 그런 주장을 하지 않는다**는 것이 이 절에서 가장 무거운 사실이다.

---

## 3. 오히려 실무자들이 추천하는 조합은 **패밀리를 가로지른다**

같은 패밀리 효과가 크고 눈에 보였다면 in-family 조합으로 수렴했을 텐데, 그런 일이 일어나지 않았다.
**약한 반대 증거다.**

- Creative Pad Media의 결론: **Nano Banana(구글 이미지) + Kling 2.1(콰이쇼우 영상)** — 가로지르는 조합
- animateai.pro: Nano Banana Pro 프레임을 Kling 3.0에 투입
- oneaiworld: 미드저니 → Gemini Flash → Veo 3 + Ideogram — **한 체인에 벤더 셋**

---

## 4. 그나마 가장 통제된 비교 (프레임 고정 · 영상 모델 변경)

**fal.ai, 2026-03-13** — 같은 소스 이미지와 같은 모션 프롬프트로 10개 모델.
Veo 3.1 · Kling 3.0 Pro · Sora 2 Pro · Kling 2.5 Turbo Pro · Seedance 1.5 Pro · Hailuo 2.3 Pro · LTX-2-19B · PixVerse v5.6 · Wan Pro.

고정 프롬프트(verbatim):
> "A gentle breeze moves through the scene, swaying the ferns and causing the mist to drift slowly
> across the clearing. Tiny particles of pollen float through the light beams.
> The camera slowly dollies forward toward the fox."

**엄밀도 중하.** 입력은 진짜로 통제했지만 프롬프트 하나, 모델당 한 판, 블라인드 없음, 채점 기준 없음,
그리고 **fal은 그 모델들을 전부 재판매한다**(벤더 페이지).

유일하게 진짜 블라인드 방법론을 내건 곳(testingmodels.com)은 **아직 데이터가 없다**
("This is the evaluation roster... Nothing here has been ranked"). 게다가 **t2v만 하고 i2v 비교는 안 한다.**

---

## 5. 첫 프레임의 역할에 대한 유일한 학술적 단서

**arXiv 2511.15700 "First Frame Is the Place to Go for Video Content Customization"**

첫 프레임이 모델의 **"개념적 기억 버퍼"**이고, 거기에 **"후속 프레임이 참조하는 모든 시각 개체가 조용히 저장된다"**.
영상 생성 모델은 첫 프레임의 인물·사물·질감·레이아웃을 **자동으로 "기억"해 이후 프레임에서 계속 재사용한다.**

> **→ 04번 문서의 "아티팩트가 증폭된다"와 같은 이야기를 반대편에서 말한 것이다.**
> 첫 프레임은 시작점이 아니라 **그 클립 전체의 사전(dictionary)**이다.
> 거기 없는 것은 나중에 생기지 않고, 거기 잘못된 것은 끝까지 간다.

단, 이 논문도 **네이티브 생성 프레임 대 외부 제공 프레임을 비교하지 않는다.**

---

## 6. 닫지 못한 선 하나

오픈웨이트 쪽에 **"영상 모델 자신으로 시작 프레임을 뽑으면(예: Wan T2V로 한 프레임만) 같은 VAE·잠재공간이라
입력이 분포 안에 들어온다"**는 관행이 있다는 말이 있다.
**이것이 같은 패밀리 가설의 가장 강한 기계적 논거가 될 것이다.**

ComfyUI 문서 표면을 뒤졌으나 FLF2V 메커니즘만 있고 이 논거는 찾지 못했다.
그 근거는 r/StableDiffusion·r/comfyui·Discord에 있을 텐데 **이 세션에서 접근할 수 없었다.**
**열린 질문으로 남긴다.**

---

## 7. "Tested and Compared"를 믿지 마라

머리말에 시험을 내걸고 방법론이 없는 페이지가 대부분이다. 직접 열어 확인한 결과:

| 페이지 | 실제 |
|---|---|
| Higgsfield "5 Best AI Video Models 2026, Tested and Compared" | 같은 기준 다섯으로 평가했다고만 하고, **동일 프롬프트 여부·소스 이미지 출처·테스터·원자료 전부 없음** |
| Atlas Cloud "Best AI Image-to-Video Models Compared" | "Excellent"/"Good" 등급만 있고 **시험 조건도 평가 기준도 없음.** 발행일이 내부적으로 모순(2026-06-12 발행에 2026-02-28 갱신 주석) |
| wiro.ai "4 Smart Clip Tests" | 저자가 **"WiroBlogAgent"** — 봇이 쓴 글 |

**→ 방법론 절을 읽기 전에는 어떤 2026년 비교 글도 증거로 쓰지 않는다.**

---

## 8. 이 조사가 스킬 설계에 남기는 것

1. **"같은 패밀리라서 Kling 영상에 Kling 이미지를 쓴다"는 서술을 쓰지 마라.** 근거가 없다
2. **Kling 영상을 쓰는 이유는 따로 있다** — T2V 1위(06번 문서)와 **끝 프레임 입력**(Artlist에서 여기만 된다)
3. **첫 프레임은 시작점이 아니라 클립 전체의 사전이다**(arXiv 2511.15700). 스킬이 프레임 품질에 투자할 근거가 여기 있다
4. **우리가 직접 A/B를 돌리면 그것은 복제가 아니라 새 데이터다.** 공개된 적이 없다.
   최소 설계: 프레임 2~3장 · 영상 모델 고정 · 이미지 모델 3~4개 · 모션 프롬프트 하나 · 시드 3개 · 블라인드 평가

---

## 출처

[fal.ai i2v 비교](https://fal.ai/learn/tools/ai-image-to-video-generators) ·
[testingmodels.com](https://testingmodels.com/videos) ·
[Creative Pad Media](https://www.creativepadmedia.com/nano-banana-kling-2-1-most-consistent-videos-comparison-with-seedream-4-0/) ·
[Kling 시작·끝 프레임 가이드](https://kling.ai/quickstart/ai-video-start-end-frames) ·
[arXiv 2511.15700](https://arxiv.org/html/2511.15700v1) · [36Kr 해설](https://eu.36kr.com/en/p/3572037696715648) ·
[ConsistI2V](https://tiger-ai-lab.github.io/ConsistI2V/) · [AIGCBench](https://www.sciencedirect.com/science/article/pii/S2772485924000048) ·
[Segmind Kling V3 vs O3](https://blog.segmind.com/kling-v3-vs-kling-o3-which-video-model-should-you-use/)
