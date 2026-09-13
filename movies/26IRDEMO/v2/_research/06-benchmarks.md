# 벤치마크 — 이미지 모델은 중위권이다 (조사 2026-09-12)

**이 문서가 이번 조사에서 가장 불편한 사실을 담고 있다.**
Kling 3.0의 명성은 **영상 모델**이 번 것이고, **이미지 모델은 그 명성을 물려받지 못했다.**

---

## 1. Artificial Analysis — Text-to-Image 아레나

2026-09-12 조회. 159개 모델 등재. (페이지에 명시적 스냅샷 날짜는 없고 실시간으로 흔들린다)

| 모델 | 순위 | Elo | 노출 | 출시 |
|---|---|---|---|---|
| **Kling Image 3.0 Omni** | **87 / 159** | **917** | 6,805 | 2026-02 |
| Kolors 2.1 (KlingAI의 옛 이미지 모델) | 72 | 947 | 3,640 | 2025-07 |
| Kling Image 3.0 (non-Omni) | **미등재** | — | — | — |

상위권 기준선:

| 모델 | Elo |
|---|---|
| GPT Image 2.5 Flare (max) | 1187 |
| GPT Image 2.5 Sunburst (max) | 1179 |
| GPT Image 2 (high) | 1171 |
| MAI-Image-2.6 | 1144 |
| **Reve 2.1** | 1127 |
| **Nano Banana 2** (Gemini 3.1 Flash Image) | 1122 |
| GPT Image 1.5 (high) | 1102 |

**→ 선두와 약 270 Elo 차이다. 그리고 KlingAI 자신의 1년 묵은 Kolors 2.1보다도 낮다.**

## 2. Artificial Analysis — 이미지 편집 아레나

| 모델 | 순위 | Elo | 출시 |
|---|---|---|---|
| **Kling Image 3.0** (non-Omni) | 32 | **1010** | 2026-02 |
| Kling Image O1 | 56 | 949 | 2025-12 |
| **Kling Image 3.0 Omni** | 58 | **946** | 2026-02 |

> ⚠ **편집에서는 비-Omni 3.0이 "플래그십" Omni를 64 Elo 앞선다.** Kling의 마케팅 위계와 반대다.
> 즉 **Omni는 더 좋은 모델이 아니라 기능이 더 많은 모델**일 가능성이 있다(4K·10 레퍼런스·series).

## 3. LMArena (arena.ai)

2026-09-07 갱신 · 총 614만 표 · 78개 모델.
**Kling 이미지 모델은 어떤 것도 등재되어 있지 않다.** 3.0도, Omni도, O1/O3도 없다.

## 4. 공식 벤치마크 주장

**없다.** Kuaishou 공식 보도자료에 벤치마크·아레나·평가 수치가 **전혀 없다.**
대신 채택 지표만 제시한다 — 창작자 6천만 명, 영상 6억 편, 기업 고객 3만 곳.
논문도 테크리포트도 찾지 못했다.

> **→ 이 모델을 고를 근거는 벤치마크가 아니라 기능 스펙(4K · 레퍼런스 10장 · series)과 가격이다.**

## 5. 영상 쪽 — ⚠ **처음 쓴 것을 정정한다**

이 문서는 처음에 "Kling 3.0이 영상 1위"라고 적었다. **그것은 Text-to-Video 순위다.**
**우리가 쓰는 것은 Image-to-Video이고, 거기서는 중위권이다.** 09번 문서가 두 보드를 직접 열어 확인했다.

| AA **Image-to-Video** (35개) | Elo | | arena.ai **i2v** (47개·190만 표) | 점수 |
|---|---|---|---|---|
| 1 MiniMax H3 Max | 1207 | | 1 minimax-h3 | 1497 |
| 2 Seedance 2.0 720p | 1196 | | 4 seedance-2.5-720p | 1478 |
| 6 Wan 3.0 | 1178 | | 7 grok-imagine-video-1.5 | 1456 |
| 11 Veo 3.1 | 1088 | | 12 veo-3.1-audio | 1398 |
| **15 Kling 3.0 1080p Pro** | **1076** | | **18 kling-v3-pro** | **1356** |

T2V에서는 1위가 맞다(오디오 유·무 양쪽). **하지만 첫 프레임을 넣는 우리 경로는 I2V다.**

> **→ "이 패밀리의 강점은 영상"이라는 말은 T2V에 한해서만 참이다.**
> Kling O3를 영상에 쓸 근거는 순위가 아니라 **`end_frame` 입력이 Artlist에서 여기밖에 없다**는 것이다.

---

## 6. 자료 충돌 — 정직하게 적는다

두 조사가 엇갈렸다.

| | 결과 |
|---|---|
| `artificialanalysis.ai/image/leaderboard/text-to-image` 조회 | Kling Image 3.0 Omni **87위 · Elo 917** (두 번 조회해 동일값) |
| `artificialanalysis.ai/text-to-image` 조회 | "Kling 이미지 모델 미등재" · 아레나 서브페이지는 404 |

**URL이 다르다.** 앞쪽이 159개 모델 목록을 반환하며 Kling 항목을 두 번 일관되게 찾았으므로 **앞쪽을 채택한다.**
뒤쪽은 다른 페이지를 봤을 가능성이 높다. 다만 **단일 아레나의 Elo 하나에 판단을 전부 걸지는 않는다.**

---

## 7. 그래서 무엇을 쓸 것인가 — 이 조사가 만든 긴장

세 사실이 서로 당긴다.

| 사실 | 방향 |
|---|---|
| Kling o3 이미지는 T2I 아레나 **87위** | 첫 프레임에 다른 모델을 쓰라 |
| Artlist에서 **2K 9장이 100 크레딧**, 다른 모델은 장당 100 | 후보 탐색에는 Kling o3가 압도적 |
| Kling 영상은 **T2V 1위**이고 **끝 프레임**을 받는다 | 영상 단계는 Kling으로 가라 |

**합리적인 결론:**

1. **탐색은 Kling o3 2K 9장으로 싸게 돈다** — 구도·빛·앵글 후보를 넓게 본다 (100 크레딧)
2. **마감 한 장은 상위 모델로 다시 뽑는 것을 검토한다** — Nano Banana 2(1122) · Reve 2.1(1127) · Seedream 5.0 Pro.
   Artlist에 전부 있다. 장당 100~200 크레딧이므로 **마감에만 쓰면 비용이 크지 않다**
3. **영상은 끝 프레임이 필요한 컷만 Kling O3로 간다** — 순위로는 Seedance 2.x·MiniMax H3가 위다(위 정정 참조).
   Kling을 쓰는 이유는 **`end_frame` 입력이 Artlist에서 여기밖에 없다**는 것 하나다

> **이 2단 구성(싼 탐색 → 좋은 마감)이 스킬의 뼈대가 되어야 한다.**
> 한 모델로 끝까지 가려는 설계는 벤치마크와 가격 중 하나를 반드시 버리게 된다.
>
> ⚠ 단, **아레나 Elo는 일반 취향 투표**다. 우리가 필요한 것은
> "낮은 채도의 한국 상담센터 실내, 글자 없음, 다큐멘터리 톤"이라는 좁은 과제다.
> **87위가 이 과제에서도 87위라는 보장은 없다.** 실사 A/B가 최종 판정이다 — 같은 프롬프트로
> Kling o3와 상위 모델 한둘을 나란히 뽑아 눈으로 비교하는 것이 스킬의 첫 작업이 되어야 한다.

---

## 출처

[AA text-to-image 리더보드](https://artificialanalysis.ai/image/leaderboard/text-to-image) ·
[AA 편집 리더보드](https://artificialanalysis.ai/image/leaderboard/editing) ·
[arena.ai t2i](https://arena.ai/leaderboard/text-to-image) ·
[AA Kling 3.0 Pro 비디오](https://artificialanalysis.ai/video/models/kling-3-0-pro) ·
[Kuaishou 보도자료](https://www.prnewswire.com/news-releases/kling-ai-launches-3-0-model-ushering-in-an-era-where-everyone-can-be-a-director-302679944.html)
