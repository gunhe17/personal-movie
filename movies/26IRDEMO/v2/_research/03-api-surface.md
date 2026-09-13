# Kling O3 API 표면 — 프로바이더별 전수 (조사 2026-09-12)

조사 대상: fal.ai · WaveSpeed · Runware · APIMODELS · MindStudio · PoYo · Alibaba Model Studio(공식 포트).
**이 문서의 값은 전부 각 프로바이더 문서에서 직접 읽은 것이다.** 식별자는 영문 원문 그대로 둔다.

---

## 0. 무엇이 모델이고 무엇이 래퍼인가 — 이것부터 갈라야 한다

공식(Kuaishou) 스펙을 그대로 옮긴 것으로 보이는 Alibaba Model Studio 포트와 fal/WaveSpeed를 대조하면 경계가 드러난다.

| 항목 | 모델 본체(공식 스펙) | 래퍼(fal/WaveSpeed) |
|---|---|---|
| 레퍼런스 지칭 | 이미지: 자연어(`reference image 1`) · 비디오: `<<<image_1>>>` `<<<element_1>>>` `<<<video_1>>>` | `@Image1` `@Element1` `@Video1` |
| element | `element_list: [{element_id}]` — **사전 등록된 subject ID** | `elements[].frontal_image_url` — **원본 이미지 직접** |
| 모드 분기 | 단일 엔드포인트 + `mode: std/pro/4k` | 엔드포인트 자체를 분리 |
| audio 기본값 | `audio` **false** | `generate_audio` **true** |
| aspect_ratio | `16:9 / 9:16 / 1:1` **3종뿐** | 8~9종 (21:9 · 3:2 · 2:3 · auto 포함) |

**→ `@Image1` 표기법, 넓은 종횡비 목록, 이미지 URL 직접 수납 element는 래퍼 계층의 산물이다.**
Artlist도 래퍼다 — 종횡비 9종을 노출하므로 fal 계열에 가깝다.

---

## 1. 이미지 — fal 스키마 (가장 완전한 공개 스펙)

### text-to-image (`O3TextToImageRequest`, required: `prompt`)

| 파라미터 | 타입 | 기본 | 허용값 |
|---|---|---|---|
| `prompt` | string | 필수 | **maxLength 2500** |
| `resolution` | string | `1K` | `1K` `2K` `4K` |
| `aspect_ratio` | string | `16:9` | `16:9 9:16 1:1 4:3 3:4 3:2 2:3 21:9` (**auto 없음**) |
| `result_type` | string | `single` | `single` `series` |
| `num_images` | int | 1 | 1–9 · **`result_type=single`일 때만** |
| `series_amount` | int\|null | 없음 | 2–9 · **`result_type=series`일 때만** |
| `elements` | array\|null | — | face/character control |
| `output_format` | string | `png` | `jpeg` `png` `webp` |
| `sync_mode` | bool | false | data URI 반환 |

### image-to-image (required: `prompt`, `image_urls`) — 위와 세 군데만 다르다

| 파라미터 | 기본 | 비고 |
|---|---|---|
| `prompt` | 필수 | "Reference images using **@Image1, @Image2**, etc. (or @Image if only one image)" |
| `image_urls` | 필수 | **최대 10장** · 프롬프트에서 **1-indexed**로 지칭 |
| `aspect_ratio` | **`auto`** | auto 포함 9종. "'auto' intelligently determines based on input content" |

> **`auto`가 t2i에는 없고 i2i에만 있다.** 입력 이미지가 없으면 판단 근거가 없기 때문이다.
> 이 비대칭이 "intelligent aspect ratio detection"의 실체다.

---

## 2. 레퍼런스 메커니즘 — 태그를 안 붙이면 격하된다

**가장 중요한 실무 규칙.** 스키마상 `@Image1` 태그는 강제되지 않는다. 그러나 태그 없는 이미지는
**동일성 앵커가 아니라 느슨한 스타일 힌트로 격하된다** ("the model treats untagged images as loose style
hints rather than identity anchors"). 인물·제품을 고정하려면 반드시 프롬프트 안에서 번호로 지칭한다.

- fal: `image_urls` **최대 10**
- 공식: **이미지 + element 합산이 10을 넘으면 안 된다** — fal은 이 합산 규칙을 문서화하지 않았다
- 파일 제약(공식): JPEG/JPG/PNG(**알파 불가**) · 변 300–8,000px · 종횡비 1:2.5 ~ 2.5:1 · ≤10MB

---

## 3. `series` — 배치와 다르다 (Artlist에는 없다)

공식 문구가 가장 명확하다.

| | 무엇 |
|---|---|
| `single` | "generated **independently**; batch outputs share **similar style only**" |
| `series` | "generates a **sequence of shots with consistent characters, scenes, and narrative continuity**" |

**`series`는 스토리보드용 연속 컷이다.** 인물·장면·서사가 이어진다. `single`의 여러 장은 스타일만 비슷한 독립 샘플이다.
`num_images`와 `series_amount`는 상호 배타다. 공식 `series_amount` 기본값은 4.

> ⚠ **Artlist는 `result_type`·`series_amount`를 노출하지 않는다** (`get_model_config` 확인 — `num_images`만 있다).
> **즉 Artlist에서 얻는 9장은 `single` 모드의 독립 샘플이지 연속 컷이 아니다.**
> 아홉 장면의 룩을 잇는 일은 `series`가 아니라 **참조 이미지(`input`)로** 해야 한다.
> WaveSpeed·Runware·APIMODELS에도 없다. `series`를 쓰려면 fal이나 공식 경로여야 한다.

---

## 4. 해상도 — 4K는 진짜 네이티브다

"Generate at 1K, 2K, or 4K — **no upscaling needed**. 4K output contains genuine fine-grained detail,
not interpolated pixels." Runware가 공개한 실제 픽셀 격자가 이를 뒷받침한다.

| | 값 |
|---|---|
| 1K | 1024×1024 · **1248×832** · 832×1248 · 1168×880 · 880×1168 · 768×1360 · 1360×768 · 1552×656 |
| 2K | 2048×2048 · **2496×1664** · 1664×2496 · 2368×1760 · 1760×2368 · 1536×2720 · 2720×1536 · 3136×1344 |
| 4K | 4096×4096 · **4992×3328** · 3328×4992 · 4736×3520 · 3520×4736 · 3072×5440 · 5440×3072 · 6272×2688 |

2K = 1K×2, 4K = 1K×4의 정수배 격자다. 가격도 4K만 정확히 2배다.

> **16:9에 가장 가까운 격자는 3:2(1248×832)다.** 목록에 순수 16:9(1.778)가 없다 —
> 1360×768이 1.771로 가장 가깝고, 2K에서는 2720×1536이다.
> **촬영본이 3200×1800(정확히 16:9)이므로 생성 프레임과 화소가 딱 맞지 않는다.** 편집에서 맞춰야 한다.

---

## 5. 영상 — 시작·끝 프레임과 멀티샷

`fal-ai/kling-video/o3/*` 계열. 확인된 경로: `pro/text-to-video` · `pro/reference-to-video` ·
`pro/video-to-video/reference` · `standard/image-to-video` · `4k/*`.

| 파라미터 | 기본 | 값 |
|---|---|---|
| `prompt` \| `multi_prompt` | — | **둘 중 하나만** ("but not both") |
| `start_image_url` | — | "Image to use as the **first frame**" |
| `end_image_url` | — | "Image to use as the **last frame**" |
| `image_urls` + `elements` | — | **합계 최대 4** (pro) · **7** (4k) |
| `generate_audio` | **true** | fal 기본이 켜짐 — 비용 직결 |
| `duration` | `5` | 3–15초 |
| `shot_type` | `customize` | `customize` `intelligent` (공식 철자는 `intelligence`) |
| `aspect_ratio` | `16:9` | `16:9 9:16 1:1` |
| `negative_prompt` | `"blur, distort, and low quality"` | **t2v에만 있다** |

멀티샷은 최대 6샷, 샷마다 `prompt`(최대 512자)와 `duration`.
오디오는 "supports **Chinese and English** voice output. **Other languages are automatically translated to English.**"
→ **한국어 내레이션은 이 모델로 못 만든다.** 소리는 따로 간다.

4K는 "**Only the Singapore server supports this mode.**"

---

## 6. 가격 (2026-09-12 관측 · 원가 기준)

### 이미지 — $0.028이 사실상 표준가

| 프로바이더 | 1K | 2K | 4K |
|---|---|---|---|
| fal · WaveSpeed · Runware | $0.028 | $0.028 | $0.056 |
| PoYo | $0.0175 | $0.0175 | $0.035 |
| APIMODELS | $0.05 | $0.05 | $0.10 |

과금식은 어디나 `num_images × 장당 단가`.

> ⚠ **여기가 Artlist와 다르다.** 원가는 **장당** 과금인데
> **Artlist의 2K(2189)는 9장을 뽑아도 100 크레딧 고정이다**(01번 문서 실측).
> 원가 논리대로면 9장은 9배여야 한다. **Artlist 요금제가 유리하게 어긋나 있다** —
> 언제 정상화될지 모르므로, 이 이점에 설계를 거는 대신 **가격을 매번 견적으로 확인**한다.

### 영상 (초당)

| 변형 | audio off | audio on |
|---|---|---|
| o3 standard | $0.084/s | $0.112/s |
| o3 pro | $0.112/s | $0.14/s |
| o3 4k | $0.42/s | $0.42/s |

WaveSpeed의 건당 표기(std $0.42 · pro $0.56 · 4k $2.10)는 **5초 기준 환산가**다.

---

## 7. 오류 · 한도 · 모더레이션

- 정책 위반 프롬프트는 **422 CONTENT_POLICY_VIOLATION** · **크레딧 미차감**이지만 쿼터는 소모된다 (2차 출처)
- 레퍼런스 이미지도 생성 전 입력 단계에서 심사된다
- Runware는 모더레이션이 **기본 꺼짐**이고 켜면 느려진다 (`safety.checkContent`)
- 공식은 비동기 필수 · `PENDING → RUNNING → SUCCEEDED/FAILED` · 생성 1–2분 · 조회 20 RPS · 이미지 URL 30일
- **동시 실행 한도는 자료마다 엇갈린다**(1/사용자 vs 3 vs 10 vs 5). **확정 수치로 쓰지 말 것**

---

## 8. 프로바이더 차이 — 이 목록이 곧 "래퍼가 만든 것"

1. `@Image1` / `<<<image_1>>>` / 자연어 — **같은 모델에 표기 계층이 셋**
2. element: 공식은 사전 등록 ID, fal은 이미지 URL 직접
3. 종횡비: 공식 3종 vs 래퍼 8~9종
4. `series`: fal과 공식에만 있다
5. **audio 기본값: 공식 false, fal true** — 아무 설정 없이 부르면 25~33% 비싸다
6. 레퍼런스 셈법: 공식은 이미지+element 합산, fal 이미지는 단독
7. `shot_type` 철자: 공식 `intelligence`, fal `intelligent`
8. Runware `numberResults` 최대 20 — 모델 상한 9를 넘기므로 내부 다중 호출이다
9. 영상 해상도: 공식 `mode` 파라미터 vs fal 엔드포인트 분리

---

## 9. 확보 못 한 것

kling.ai 공식 문서 원문(JS 렌더링이라 본문을 못 받았다 — rateLimits · 3-0-omni 이미지/영상 페이지),
공식 에러 코드 표, Replicate 등재본(404), Segmind 전체 스키마.

## 출처

fal: [t2i](https://fal.ai/models/fal-ai/kling-image/o3/text-to-image/api) ·
[i2i](https://fal.ai/models/fal-ai/kling-image/o3/image-to-image/api) ·
[r2v](https://fal.ai/models/fal-ai/kling-video/o3/pro/reference-to-video/api) ·
[i2v](https://fal.ai/models/fal-ai/kling-video/o3/standard/image-to-video/api) ·
[explore](https://fal.ai/explore/kling)
공식 포트: [이미지](https://help.aliyun.com/en/model-studio/kling-image-generation-api-reference) ·
[영상](https://help.aliyun.com/en/model-studio/kling-video-generation-api-reference/)
[WaveSpeed 블로그](https://wavespeed.ai/blog/posts/introducing-kwaivgi-kling-image-o3-on-wavespeedai/) ·
[WaveSpeed 가격](https://wavespeed.ai/collections/kling-o3) ·
[Runware 문서](https://runware.ai/docs/models/klingai-image-o3) ·
[PoYo](https://poyo.ai/models/kling-o3-image) ·
[APIMODELS](https://apimodels.app/docs/kling-omni-image)
