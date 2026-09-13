# v1이 이미 쓰던 이미지 생성 문법 (미드저니)

출처는 저장소 안이다 — `v1/MJ-HOWTO.html` · 산출물 `v1/_midjourney/`.
**v2의 첫 프레임 스킬은 이 문법을 이어받는다.** 새로 지어내는 것이 아니라 엔진만 Kling o3로 바꾸는 일이다.

---

## 1. v1은 이미 "첫 프레임 → 영상"으로 일했다

`v1/_midjourney/`의 파일 이름이 그 증거다.

```
s01-first.png   s01-first.mp4   s01-second.mp4   s01-third.mp4
s02-first.png   s02-first.mp4   s02-second.mp4
s03-first.mp4   s03-second.mp4  s03-third.mp4
s04-first.mp4   s04-second.mp4
intro.png       intro.mp4       room.png   member.png   info-desk-1.png
```

장면마다 **스틸 한 장을 먼저 만들고 그것을 움직였다.** 이름의 `first`·`second`·`third`는 그 장면 안의 컷 순서다.
**v2가 새로 만드는 것은 이 관행의 자동화이지 새 관행이 아니다.**

---

## 2. 프롬프트 문법 (실제 사용례에서 추출)

구조가 네 토막으로 일정하다.

```
<피사체와 동작> , <공간과 소품> , <빛> , <렌즈와 앵글>
--ar 16:9 --raw --s 80 --c 4
--no <배제 목록>
```

실제 예 (verbatim):

```
open shelves with soft toys, warm late-afternoon daylight through a half-closed blind,
eye-level static wide, 35mm
--ar 16:9 --raw --s 80 --c 4
--no illustration, anime, cartoon, cel shading, line art, painting, 3d render, cgi,
    plastic skin, airbrushed, beauty retouch, glamour, smooth flawless skin, teenage,
    legible text, lettering, numbers, watermark, logo
```

```
a switched-off monitor beside it, a ruled ledger, laminate reception counter,
fluorescent overhead, high three-quarter angle, hands and forearms only, no face, 50mm
--ar 16:9 --raw --s 80 --c 4
```

### 고정된 파라미터

| | 값 | 뜻 |
|---|---|---|
| `--ar` | **16:9** 전부 | 아홉 장면 촬영본(3200×1800)과 같은 비율 |
| `--raw` | 항상 | 미드저니의 미화 보정을 끈다 |
| `--s` (stylize) | **80** (강조 컷만 90, 인물 클로즈업 50) | 낮게 — 모델의 취향보다 지시를 따르게 |
| `--c` (chaos) | **4** (강조 90일 때 5, 인물 3) | 낮게 — 네 장의 변주 폭을 좁혀 고르기 쉽게 |

### 렌즈 어휘

`35mm`(공간 와이드) · `50mm`(손·책상 중간) · `85mm` `85mm macro` `f/2.0` `f/2.8`(인물·소품).
빛은 거의 항상 자연광 서술이다 — `warm late-afternoon daylight through a half-closed blind`,
`soft window light from the left`, `soft even window light`. 형광등은 **낡은 방식을 보여주는 컷에만** 쓴다
(`fluorescent overhead`) — 빛이 그 자체로 논지다.

---

## 3. 가장 중요한 결정 — **생성 이미지에 글자를 넣지 않는다**

모든 `--no` 목록에 이 넷이 빠짐없이 들어 있다.

```
legible text, lettering, numbers, watermark, logo
```

**의도적이다.** 이 영화에서 읽히는 글자는 전부 실제 제품 화면 촬영본(`capture-service`)에서 온다.
생성 이미지는 분위기와 공간을 맡고, 정보는 촬영본이 맡는다. 둘의 경계가 이 한 줄이다.

**이것이 한글 렌더링 문제를 통째로 비켜 간다.** Kling o3가 한글을 얼마나 잘 그리는지와 무관하게,
이 저장소의 생성 프레임에는 애초에 읽히는 글자가 들어가지 않는다.
→ 스킬의 기본 네거티브에 이 넷을 **기본값으로 박아 둔다.** 예외는 사람이 명시할 때만.

### 인물 처리도 같은 계열이다

`plastic skin, airbrushed, beauty retouch, glamour, smooth flawless skin, teenage`를 전부 뺀다.
그리고 손·팔만 찍는 컷이 반복된다 — `hands and forearms only, no face`.
**얼굴을 피하는 것이 기본 전략이다.** 생성 얼굴은 영상으로 만들 때 가장 먼저 무너지는 부분이고,
실제 배역은 촬영본에 있다.

---

## 4. Kling o3로 옮길 때 바뀌는 것

| 미드저니 | Kling o3 (354) | 비고 |
|---|---|---|
| `--ar 16:9` | `settings.aspect_ratio: "16:9"` | 그대로 |
| `--raw` | **없다** | 프롬프트 문장으로 대신한다 (`documentary photograph, unretouched`) |
| `--s 80` | **없다** | 같음 — 서술로 눌러야 한다 |
| `--c 4` | **없다** | 대신 `num_images`로 변주를 뽑고 사람이 고른다 |
| `--no …` | **미확인** | 네거티브 프롬프트 지원 여부가 조사 대상이다. 없으면 긍정문으로 뒤집어 써야 한다 |
| 4장 그리드 | `num_images` **1~9 · 2K에서 가격 동일** | 미드저니보다 유리하다 — 9장을 100 크레딧에 뽑는다 |
| `--cref` (캐릭터 고정) | `input` 참조 **최대 10장** | 더 넉넉하다 |

> ⚠ **`--s`·`--c`·`--no`에 해당하는 손잡이가 Kling o3에는 없다.**
> v1이 숫자로 눌러 둔 것(미화 억제·변주 축소)을 v2에서는 **문장으로** 눌러야 한다.
> 이 번역을 얼마나 잘하느냐가 스킬의 품질을 정한다.

---

## 5. 색과 글꼴 (문서 쪽 정본)

`MJ-HOWTO.html`의 토큰이 이 프로젝트의 화면 색이다 — 생성 프레임의 색감도 여기서 멀어지지 않게 한다.

```
--ground:#E9EAEA   --surface:#F8F8F7   --ink:#191E21   --ink-2:#4B565A
--go:#3F5B66 (청록 계열)   --do:#A9702F (황토)   --stop:#8C3A2E (벽돌)
글꼴 Hahmlet · Nanum Myeongjo (제목) / Gothic A1 (본문)
```

차갑고 낮은 채도의 회녹색 바탕에 따뜻한 황토·벽돌이 포인트다.
**생성 프레임의 기본 팔레트를 여기에 맞춘다** — 과채도 결과는 버린다.
