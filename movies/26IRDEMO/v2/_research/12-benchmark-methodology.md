# 벤치마크는 프롬프트를 어떻게 구성하나 (조사 2026-09-13)

**"모두 같은 방식인가"에 대한 답: 아니다. 셋이 근본적으로 다르게 설계돼 있고,
그 차이가 순위가 서로 어긋나는 이유를 상당 부분 설명한다.**

이 문서는 06·09번 문서의 서술을 **일부 정정한다** — 아레나를 "일반 취향 투표"로 뭉뚱그린 것은
Artificial Analysis에 대해서는 부정확했다.

---

## 1. 세 가지 설계

| | 프롬프트 출처 | 모델 간 동일? | 재는 축 |
|---|---|---|---|
| **Artificial Analysis** | **큐레이션된 고정 corpus** · 월간 갱신 | **예** — 같은 프롬프트로 두 모델 대결 | 취향(단, 분류체계로 통제) |
| **arena.ai (LMArena)** | **사용자가 직접 씀** | 예(그 배틀 안에서) | 취향(통제 없음) |
| **GenAI Showdown** | 고정 15개 · 공개 | **아니오 — 모델별로 조정한다** | **프롬프트 준수** |

---

## 2. Artificial Analysis — 생각보다 훨씬 엄밀하다

> **"Our prompts are written to reflect how end users actually prompt, informed by anonymized
> crowdsourced data and a human-curated, live-updated prompt corpus."**

**사용자가 쓴 프롬프트가 아니다.** 크라우드 데이터를 참고해 **사람이 작성·큐레이션한 고정 집합**이다.

### 분류체계 — 9 × 9로 균등 표집

| 실사용 용도 9 | 모델 능력 9 |
|---|---|
| Marketing & Advertising | Reasoning |
| Retail & E-commerce | Knowledge |
| **Live-Action Film** | **Text Rendering** |
| Animation & Gaming | Layout |
| Architecture & Real Estate | Complex Compositions |
| Productivity & Knowledge Work | **Lighting** |
| UI/UX Design | **Material** |
| Consumer | Physics |
| Social Media & Creator Content | **Human Anatomy** |

**우리 과제에 걸리는 칸이 실제로 있다** — 용도의 `Live-Action Film`, 능력의 `Lighting` · `Material` · `Human Anatomy`.

### 투표 방식
- **블라인드 페어와이즈**: *"Evaluators see two outputs generated from the same prompt by two different
  models, without model identities, and select the one they prefer."*
- **판정 힌트**: *"Each matchup surfaces short hints tied to the prompt's use case, capability, and style
  tags, directing attention to the specific aspects under test on complex prompts."*
- **참여 게이트**: *"Votes can only be cast after a minimum engagement time with each output."*
- **점수**: Bradley-Terry 최대우도추정을 Elo 유사 범위로 재척도
- **코호트 필터**: 현행 모델은 **최근 투표만으로** 순위, 레거시 모델은 전체 이력

### 프롬프트 교체 — 여기에 선택 효과가 있다
- **월 1회 갱신**: *"We refresh our prompt set every month."*
- **변별력 기준 폐기**: *"Prompts whose favorite win rate is **statistically indistinguishable from chance**
  are flagged for retirement."*
- **현실성 기준 폐기**: 실사용 corpus와 대조해 *"no longer reflect real-world prompting conventions"*인 것 제거

> ⚠ **변별력으로 프롬프트를 걸러내면 살아남는 집합이 "모델 간 차이가 큰 쪽"으로 치우친다.**
> 순위를 가르는 힘은 세지지만 **대표성은 그만큼 떨어진다.**
> 그리고 **월간 교체 + 코호트 필터** 때문에 **몇 달 전 순위와 오늘 순위는 같은 자를 잰 것이 아니다.**

---

## 3. arena.ai (LMArena) — 통제가 없다

> **"When you submit your prompt, it is collected to support fair, public evaluations
> and shape the development of AI models."**
> *"In battle mode, you'll be served 2 anonymous models."*

**사용자가 아무 프롬프트나 쓴다.** 배틀 안에서는 두 모델이 같은 프롬프트를 받지만,
**전체 프롬프트 분포는 사람들이 실제로 무엇을 쳐 넣느냐에 달려 있다.**

배틀 짝짓기 방식과 평점 계산식은 이 페이지에 없다(논문 참조로 넘긴다).

> **→ 614만 표라는 규모는 신뢰의 근거이지만, 그 표가 무엇에 대한 표인지는 통제되지 않았다.**

---

## 4. GenAI Showdown — **프롬프트가 모델마다 다르다**

자체 설명: *"A comparison of various SOTA generative image models on specific prompts and challenges
with a **strong emphasis placed on adherence**."*

경기 규칙 (verbatim):
1. *"The models were not allowed to use any inpainting or editing features."*
2. *"Features such as remixing by instructing the model to make corrections were also prohibited."*
3. **⚠ *"Prompts are tuned and adjusted as necessary towards the particular strengths of each model
   to ensure a fair comparison."***

> **세 번째 규칙이 결정적이다. 같은 문자열을 넣은 비교가 아니다.**
> 설계자는 공정성을 위해 그렇게 했다고 말하지만, **"같은 프롬프트에서 누가 나은가"라는 질문에는 답하지 않는다.**

### 15개 프롬프트의 성격 — 사실감 테스트가 아니다

```
Angelic Forge · The Prussian Ring Toss · Count Tyrone Rugen · Nine-Pointed Star ·
An Overcrowded Flat Earth · Spheron · Cubed⁵ · Mermaid Disciplinary Committee ·
Cephalopodic Puppet Show · Quantum Entangled Einstein · Red Next to Yellow ·
Not The Bees · The Yarrctic Circle · The Labyrinth · A Dicey Situation
```

통과 기준 예시:
- `Count Tyrone Rugen` — 프롬프트: *"A man with only four fingers on one hand and six fingers on his other hand."*
  기준: *"One hand must have exactly three fingers and a thumb. The other hand must have exactly five fingers and a thumb."*
- `Nine-Pointed Star` — *"A digital illustration of a star with exactly 9 points."*
- `The Prussian Ring Toss` — 기준: *"A minimum of one ring must be in the air or over a spike."*

**전부 논리·계수·공간 배치 함정이다.** 피부·조명·질감을 재지 않는다.
**애초에 사실감을 측정하도록 설계되지 않았다.**

---

## 5. 저널리스트·실무자 테스트

| 출처 | 프롬프트 |
|---|---|
| fal.ai i2v 비교 | 소스 이미지 1장 + 모션 프롬프트 1개 **verbatim 공개** · 모델당 1판 |
| 302.AI | 「统一 prompt」 · **첫 생성 결과만** 사용(본인들이 명시) |
| PixVerse | 5개 **verbatim 공개** · 벤더 인접 |
| Curious Refuge | 9개 작업 · 약 50장 나란히 |
| TechRadar | 기사당 3~7개 · 산문으로 서술, 문자열 비공개 |
| Segmind | 7개 케이스 · **프롬프트 비공개** |

**대체로 모델 간 동일 프롬프트를 쓰지만, 판수가 1회이고 블라인드가 아니다.**
06번 문서가 적었듯 *"for reference only"*라고 본인들이 단서를 다는 경우도 있다.

---

## 6. 그래서 순위가 왜 어긋나는가

| 어긋남 | 원인 |
|---|---|
| AA 87위 ↔ 사실감 1위(NB Pro) | **AA는 81칸에 균등 표집한 총합**이다. 우리 과제는 그중 한두 칸이다 |
| AA ↔ lmarena 스케일 차이 | 산출 방식이 다르다(BT-MLE 재척도 vs 별도). **교차 비교 불가** |
| GenAI Showdown ↔ 나머지 | **축이 다르고(준수) 프롬프트도 모델별로 다르다** |
| 시점 간 불일치 | AA는 **월간 교체 + 코호트 필터**. 지난달 순위는 다른 자다 |

---

## 7. 열려 있는 실마리 하나 — **확인할 가치가 크다**

AA 리더보드 페이지에 **`Category: All` 드롭다운이 있다.**
분류체계가 9×9로 정의돼 있으므로, **이 드롭다운이 용도·능력별 순위를 준다면
`Live-Action Film` 또는 `Lighting` 순위를 직접 읽을 수 있다.**
그것은 총합 Elo보다 우리 과제에 훨씬 가깝다.

**도구로는 드롭다운 항목을 펼치지 못했다.** 브라우저로 직접 열어 확인할 것.
**이것이 "벤치마크로 순위를 매길 수 있나"라는 질문의 답을 바꿀 수 있는 유일한 단서다.**

---

## 8. 정정 기록

06·09번 문서에서 **"아레나 Elo는 일반 취향 투표다"**라고 쓴 것은
**Artificial Analysis에 대해서는 부정확하다.** AA는 통제된 분류체계와 블라인드 페어와이즈,
참여 게이트, 판정 힌트를 갖춘 설계다. 통제가 없는 것은 **arena.ai 쪽**이다.

그러나 **결론은 바뀌지 않는다** — AA도 **총합 점수**만 공개하므로,
우리 과제에 해당하는 칸의 성적은 **드롭다운이 열리지 않는 한 읽을 수 없다.**
