# 공식 스펙 · 이름 · 약관 (조사 2026-09-12)

1차 자료는 Kuaishou 보도자료와 kling.ai 공식 문서. 확인 못 한 것은 명시했다.

---

## 1. **"Kling O3"는 공식 이름이 아니다**

이번 조사에서 가장 먼저 바로잡아야 할 것이다.

Kuaishou 공식 보도자료(2026-02-05)가 출시했다고 밝힌 모델은 **정확히 넷**이다.
`Video 3.0` · `Video 3.0 Omni` · `Image 3.0` · `Image 3.0 Omni`
**보도자료 전문에 "O3"라는 문자열은 없다.**

| 표기 | 정체 |
|---|---|
| `3.0` | 패밀리명 |
| `Image 3.0` (`kling-v3`) | 기본 등급 — **1K·2K만 · 레퍼런스 1장 · series 없음** |
| **`Image 3.0 Omni`** (`kling-v3-omni`) | 상위 등급 — **4K · 레퍼런스 10장 · series 지원** |
| **`O3`** | **`Omni 3`의 파트너·커뮤니티 약칭.** fal·Artlist가 쓰는 이름 |

**→ 우리가 쓰는 "Kling o3"는 `Image 3.0 Omni`다.** 같은 세대의 두 등급이지 다른 라인이 아니다.
`v3`와 `o3`는 fal에서 **서로 다른 스키마로 동시에 살아 있다** — 개명이 아니라 별개 SKU다.

공식 모델 ID: `kling-v3-omni`(omni-image 엔드포인트) · `kling-image-o1`(이전 세대).
`Kling Image O1`은 2025-11-29 출시된 **별개의 이전 모델**이다. Kuaishou가 이미지 모델에 "O" 명명을 쓴 전례가 여기 있고,
그래서 "O3"라는 약칭이 자연스럽게 생겼다.

> ⚠ **Artlist에는 `Kling v3`(그룹 355·349·402)도 따로 있다.** 그것은 `Image 3.0`(기본 등급)이므로
> **4K도 다중 레퍼런스도 series도 안 된다.** 우리가 쓸 것은 **o3(354/347)** 쪽이다.

---

## 2. 공식 능력 사양

| 항목 | Image 3.0 (v3) | **Image 3.0 Omni (o3)** |
|---|---|---|
| 해상도 | `1k` `2k` — **4K 없음** | `1k` `2k` **`4k`** |
| 레퍼런스 | `image_url` **1장** | `image_urls` **최대 10장** |
| 시리즈 | 미지원 | `result_type: single \| series` |
| 시리즈 장수 | — | `series_amount` **2–9** (공식 기본 4) |
| 배치 | `n` / `num_images` **1–9** | 동일 |
| 프롬프트 | **최대 2500자** | 동일 |

**입력 이미지 제약 (공식)**: `.jpg/.jpeg/.png` · **≤10MB** · **변 300–8000px** · **종횡비 1:2.5 ~ 2.5:1** ·
**레퍼런스 + subject 합계 ≤ 10** · Base64는 `data:` 접두사 없이 순수 문자열만.

**아키텍처 명칭**: 공식 보도자료가 쓴 용어는 **"Multi-modal Visual Language (MVL) framework"** 하나다.

**4K 네이티브**: 공식 가이드가 **"Direct 2K/4K Ultra HD Model Output"**이라고 명시한다.
다만 **"업스케일을 쓰지 않는다"는 부정형 문구는 공식 자료에 없다.** "no upscaling needed"는 3자 마케팅 표현이다.

**동시성 (공식)**: QPS 제한은 **없다**. 대신 동시 작업 수 제한이 있고,
**"이미지 생성은 요청의 `n` 값만큼 동시성을 소모한다 (n=9면 9 소모)"**.
초과 시 `{"code": 1303, "message": "parallel task over resource pack limit"}`. 지수 백오프 권장.

**보관**: 생성물 URL은 **30일 뒤 삭제된다**. "Please save promptly."
**→ 스킬은 생성 즉시 로컬로 내려받아 보관해야 한다.**

---

## 3. vCoT — 1차 자료로 뒷받침되지 않는다

"Visual Chain-of-Thought"는 이 모델을 설명할 때 가장 많이 인용되는 말이지만 근거가 약하다.

| | |
|---|---|
| **공식 보도자료** | `Visual Chain-of-Thought` · `vCoT` · `Deep-Stack` 문자열이 **전부 없다** (전문 검색 확인) |
| **공식 사용자 가이드** | vCoT 언급 **없음**. 기능 주장 넷만 있다 — 서사 표현 강화 · 시리즈 모드 · 2K/4K 직접 출력 · 리얼리즘 일관성 |
| **중국어 보도자료** | ⚠ **여기에 원출처가 있다** — 「依托**视觉思维链（vCoT）**技术，精准把控构图、光影与物理约束」. **快手가 직접 쓴 용어다.** IT之家(2026-01-31)도 "vCoT" + "Deep-Stack 视觉信息流机制"을 보도 |
| **논문** | arXiv 검색 0건. 테크리포트 못 찾음 |
| **API** | **제어 파라미터가 하나도 없다** — 사고 토글·노력도·예산 전부 부재 |

> **정확한 상태: 보도자료 용어이되, 사용자 문서에는 반영되지 않았고, 조종할 수 없다.**
> "공식 근거가 전혀 없다"고 쓰면 틀린다 — 快手가 직접 쓴 말이다.
> 다만 유일한 실측 리뷰어의 판정이 결정적이다:
> *"**This isn't something you can see happening — unlike the visible reasoning in some text-generation models**"*
> 추론 트레이스 노출 없음, 노브 없음, **"think step by step" 류를 넣어 효과를 봤다는 보고 0건.**
> 그리고 **O1도 이미 chain-of-thought로 마케팅됐으므로 O3의 신규 능력이 아니다.**
> 프롬프팅에서 실제로 달라지는 것은 vCoT가 아니라 **참조 문법과 공간 명시**다(10번 문서).

---

## 4. 약관 — **이 프로젝트에 직접 걸린다**

kling.ai 공식 문서에서 직접 인용한 것이다.

### 소유권
> "You own all intellectual property rights and other proprietary interests in and to the Content...
> **We do not claim ownership of the Content.**" — ToS §4.4

### 무료 등급은 상업적 사용이 금지된다
> "**Specifically, without our written permission, you may not use, reproduce, distribute, and create
> derivative works of, and make modifications to, the Output for any commercial purposes.**" — ToS §4.6

그리고 무료 사용자는 **"Kling AI" 브랜드 표기 의무**가 있다(ToS §4.5, 유료약관 §7.2).

### 유료 회원·API는 풀린다
> "KLING AI members' use of the Output for commercial purposes is **not restricted**...
> (except for the purposes of developing or offering competitive products or services of KLING AI)"
> — 유료약관 §3.1.2

> API: "You use of the AI-generated content for commercial purposes is **not restricted**."
> — API 유료약관 §6.4

### 워터마크는 경로에 따라 정반대다

| 경로 | 기본 |
|---|---|
| 웹앱 무료 | **워터마크 붙음** + 표기 의무 |
| 웹앱 유료 | 워터마크 제거가 **명시된 회원 혜택** |
| **API** | **무워터마크가 기본.** `watermark_info.enabled`로 워터마크본을 **추가 생성**하는 옵션이고, 응답이 `url`과 `watermark_url`을 따로 준다 |

> **→ 우리는 Artlist(유료 파트너 API)를 통해 쓰므로 상업적 사용과 무워터마크 쪽에 해당한다.**
> 다만 **Artlist의 자체 약관이 별도로 적용된다.** IR 영상은 대외 공개물이므로
> **실제 납품 전에 Artlist 라이선스 조항을 사람이 한 번 확인하는 것이 안전하다.**

### 그 밖의 제한
- **Kling 출력물로 다른 AI 모델을 학습시키는 것 금지** (ToS §3.1(w))
- 서비스·권리의 재판매·양도·대여 금지
- Kling은 입력·출력에 대해 **비독점·무상 라이선스를 되가져간다** (ToS §4.7.1)

### 확인 못 한 것
등급별 혜택 표(어느 등급이 워터마크 제거·상업권을 주는지)는 가격 페이지가 클라이언트 렌더링이라 확인 실패.
중국 《人工智能生成合成内容标识办法》에 따른 **암묵적 메타데이터 라벨 삽입 여부는 kling.ai 어디에도 없다** — 단정하지 말 것.

---

## 5. 콘텐츠 정책

커뮤니티 가이드라인(2026-09-08 발효)이 영상·이미지·오디오에 **공통**으로 적용된다. 이미지 전용 정책은 없다.

금지 범주 여덟: 정치·사회질서 / 폭력·범죄 / 성적 노골성 / 타인 권리 침해 / 미성년자 / 지식재산 / 공서양속 / 플랫폼 질서.

이 프로젝트에 걸릴 수 있는 것:
- **초상권** — 무단으로 타인의 명예·프라이버시·초상을 침해하는 생성 금지. **다만 "공인 금지"라는 포괄 조항은 문서에 없다**(필터 동작으로 존재한다는 보고는 3자 일화)
- **미성년자** — 18세 미만. 학대·착취·위험 묘사 금지, **애니메이션·디지털 생성물 포함**.
  ⚠ **이 영상의 배역에 아동이 있다**(김민준 2019년생 · 김서연 2021년생 · 윤도현 만 12세).
  아동이 등장하는 프레임을 생성할 때는 이 조항을 의식해야 한다 — v1이 **손·팔만 찍거나 얼굴을 피한 것**이 결과적으로 안전한 선택이었다
- **브랜드** — 브랜드 제휴를 날조하거나 공식 홍보물을 모방하는 것 금지
- 위반 시 **이미 낸 요금은 환불되지 않는다**

---

## 출처

[Kuaishou 보도자료](https://www.prnewswire.com/news-releases/kling-ai-launches-3-0-model-ushering-in-an-era-where-everyone-can-be-a-director-302679944.html) ·
[공식 Omni 가이드](https://kling.ai/quickstart/klingai-image-3-omni-user-guide) ·
[공식 이미지 API](https://kling.ai/document-api/api/image/3-0-omni/image-omni) ·
[capability map](https://kling.ai/document-api/guides/capability-map/image) ·
[동시성 규칙](https://kling.ai/document-api/api/get-started/concurrency-rules) ·
[ToS](https://kling.ai/docs/user-policy) · [유료약관](https://kling.ai/docs/payment-policy) ·
[커뮤니티 가이드](https://kling.ai/docs/community-policy) · [API 유료약관](https://kling.ai/document-api/guides/protocols/paid-service) ·
[Alibaba 포트](https://help.aliyun.com/en/model-studio/kling-image-generation-api-reference) ·
[IT之家 2026-01-31](https://www.ithome.com/0/918/081.htm) · [IMAGE O1 릴리스노트](https://kling.ai/release-note/release-notes/exv6o36sxa)
