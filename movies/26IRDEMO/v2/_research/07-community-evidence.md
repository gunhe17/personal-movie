# 실사용자 증거 — Kling O3는 검증된 적이 없다 (조사 2026-09-12)

Reddit(r/StableDiffusion · r/comfyui · r/aivideo · r/midjourney) · Hacker News를 2026년 1~9월 범위로 뒤진 결과.
Reddit은 이 환경에서 막혀 있어 **Arctic Shift 아카이브 API**로 원문(점수·날짜·작성자·본문)을 받았다.
**X와 YouTube는 접근 못 했다 — 공백이지 부재가 아니다.**

---

## 1. 가장 중요한 발견 — **Kling O3에 대한 독립 검증이 하나도 없다**

| 검색 | 결과 |
|---|---|
| r/aivideo "Kling O3" | **0건** |
| r/StableDiffusion "Kling O3" | 1건 — 무관한 스레드 |

웹 검색으로 나온 "Kling Image O3 character consistency" 페이지는 **전부 벤더 또는 제휴 마케팅 사이트**였다
(pixverse · vidofy · somake · vidmuse · tryonr · selfielabstudio · flick.art · atlascloud).

그 문구의 수준: *"Visual Chain-of-Thought reasoning and Reference Attention Mechanism deliver
**unbreakable character continuity** that traditional diffusion models simply cannot match."*
**어떤 모델도 "unbreakable"하지 않다. 실사용자는 이렇게 쓰지 않는다.**

제휴 사이트끼리도 서로 어긋난다 — tryonr는 O3가 아니라 **V3**가 여섯 컷 동일성에 더 안전하다고 쓴다.
**벤더의 플래그십 기능을 두고 제휴 사이트들이 갈리면 거기엔 신호가 없다.**

Kling을 다룬 진짜 게시물은 저참여 자기홍보 둘뿐이다 —
"4분 누아르 단편의 캐릭터 일관성 도전"(1점·댓글 5) · "Azure Spirit 4K 쇼케이스"(1점·댓글 2).
**둘 다 테스트가 아니고 커뮤니티가 무시했다.**

> **→ 05번 문서의 "벤치마크 없음"에 이어 "실사용 검증도 없음"이 확인됐다.**
> 이 모델을 쓸 근거는 **기능 스펙과 가격**뿐이다. 품질 평판은 존재하지 않는다.

---

## 2. 실무자들이 실제로 쓰는 것은 우리 목록에 없다

2026년 8~9월 r/StableDiffusion의 캐릭터 일관성 논의는 **MiniMax H3**가 압도한다.

| 스레드 | 점수 | 날짜 |
|---|---|---|
| "Minimax H3: Consistent face, body & cloths via reference identity" | **456** | 2026-08-31 |
| "Character consistency via cached reference embeddings (SFace + DINOv2) + portable .char file, no LoRA" | 85 (댓글 94) | 2026-08-15 |
| "Minimax H3: Portable character consistency via reference identity" | 124 | 2026-08-26 |

반복 등장하는 이름: **FLUX.2 Klein** · **Krea 2** · **Seedance 2.0/2.5** · **LTX 2.5** · **Qwen-Image-Edit-2511** · **Z-Image** · **Nano Banana Pro**.

합의는 **배포 방식으로 갈린다.**

| 진영 | 기본 선택 |
|---|---|
| 클라우드 | **Nano Banana / Nano Banana Pro**를 캐릭터 레퍼런스 엔진으로. 시트·룩은 GPT Image·미드저니로 상류에서 |
| 로컬(ComfyUI) | **MiniMax H3 reference identity** · FLUX.2 Klein |

**Kling Image O3 · Reve 2.1 · Luma Uni-1 · Ideogram V4 · Recraft 4.1 · Grok Imagine 2.0 · Flux 2 Pro는
실사용 검증을 찾지 못했다.**

---

## 3. 가장 신뢰할 만한 단일 워크플로 증언

미드저니 기반 단편 제작자 u/grajagans (스레드 251점·댓글 111, 2026-08-15):

> "I use GPT once to build a character sheet, and that's it, no back and forth in there.
> Separately I build a location sheet in Midjourney. Then I take both into **Nano Banana Pro**,
> character sheet as the character ref and location sheet as the environment ref, and generate each shot from there.
> Because every angle is a fresh generation from the same clean refs, **you're not stacking noise**
> the way you do when you keep re-prompting the same image in GPT."

**핵심 원리: 한 곳에서 반복 수정하지 말고, 깨끗한 레퍼런스에서 매번 새로 뽑는다.**
04번 문서의 "라스트 프레임 체이닝 누적 오차"와 같은 이야기다.

같은 스레드에서 u/variety_dirtbag가 독립적으로 같은 형태를 확인한다.

---

## 4. 이름 붙은 실패 모드 (증거 있는 것만)

### (a) 아이덴티티 평균화 — 프롬프트가 예산을 뺏는다
가장 잘 설명된 메커니즘이다 (u/TaniaDictee, 2026-09-07):

> "ReferenceLatent puts the identity in the conditioning, and the conditioning is a **fixed budget**.
> When the prompt is 'woman, window light' the reference owns most of that budget.
> Once the prompt becomes combat choreography plus dramatic lighting plus background action,
> all of that semantic weight lands in the same place, and **the face is the first thing to get averaged away,
> because it is the smallest region of the frame and the part your words constrain least.**"

**→ 프롬프트가 길고 복잡해질수록 얼굴이 가장 먼저 무너진다.**

### (b) 스티커처럼 붙은 얼굴 — 이 보고서에서 가장 강한 증거
**Max Woolf**(minimaxir, 실적 있는 독립 테스터)가 HN에서 2026-02-26:

> "Anyone who has used Nano Banana Pro for awhile knows that it will **strongly overfit on any input images
> by copy/pasting the subject without changes** which is bad for creativity."

그리고 레퍼런스 가중치를 올려도 안 풀린다:
> "Cranking the reference weight usually does not save it. You end up bidding against your own prompt,
> and **past a certain point you just get a stiff pasted-on face that ignores the scene lighting.**"

**→ (a)와 (b)는 같은 다이얼의 양 끝이다. 조절로 둘을 동시에 피할 수 없다.**

### (c) 레퍼런스 번짐
u/Hillobar(오픈소스 face-swap 프로젝트 **Rope** 저자 — 신뢰할 만한 기술 목소리):
> "I'm not sure dino is going to get you the body embedding you're after.
> **It will find similarity in clothing, environment and other image elements, washing out the body identity.**"

### (d) 거리에 따른 얼굴 드리프트 — 실행 가능한 발견
u/mabseyuk (2026-09-08):
> "When you want to see the person further away, **it effectively has to regenerate the person's face
> and that's where drift comes in.**"

그의 대응: 클로즈업 29 + 미디엄 전신 29 + 원경 전신 29, **거기에 군중 속 사진**을 더해
"트리거 단어를 썼을 때 모두가 그 사람이 되지 않도록" 학습시킨다.

### (e) 반복 수정이 노이즈를 쌓는다
> "Iteration to get specific camera angles leads to **noise patterns in the images which obviously carry on in the video**."
> "GPT Image 2 is rough if you don't get it right the first time… **Gpt2 really is a first shot tool at the moment.**"

### (f) 소폭 조정이 안 된다 — 진동
u/Zarathruster (HN, 2026-02-27), Nano Banana로 캐릭터 레퍼런스를 만들며:
> 발을 어깨너비로 벌리라고 했더니 모아서 그렸다. 조금 넓히라니 말을 탈 만큼 벌렸다. 조금 좁히라니 다시 모았다.
> 결국 **"발목 사이에 캔털루프를 끼운 모습"으로 그리게 한 뒤 캔털루프를 지우라고 해서** 원하는 것을 얻었다.

**→ 절대 수치 지시("어깨너비")가 안 먹는다. 물리적 구성으로 우회해야 할 때가 있다.**

### 증거를 못 찾은 것
**인종 드리프트 · 나이 드리프트** — 찾지 못했다. **없다는 뜻이 아니라 못 찾았다는 뜻이다.**

---

## 5. 실무자들이 실제로 쓰는 우회책 (커뮤니티 지지 순)

1. **작업을 도구별로 쪼개고 한 곳에서 반복하지 않는다.** 캐릭터 시트 한 번, 로케이션 시트 따로, 그다음 매 컷을 깨끗한 레퍼런스에서 새로
2. **컨디셔닝으로 부족하면 가중치로 옮긴다** — LoRA 학습. *"**25~40장을 진짜로 다른 각도·초점거리·조명으로** 모으는 것이 한 세션에서 나온 150장의 유사본보다 낫다. 유사본은 얼굴이 아니라 그 촬영을 가르친다"* (일부 반박 있음 — 확정된 합의가 아니라 그럴듯한 휴리스틱)
3. **거리별 학습 세트** — 근/중/원 균등 + 군중 사진을 네거티브 예시로
4. **유지할 것이 아니라 바꿀 것을 캡션한다.** *"늘 같은 옷이면 옷을 아예 캡션하지도 프롬프트하지도 마라. 늘 같은 헤어스타일이면 헤어스타일을 쓰지 마라"*
5. 정면 + 측면 프로필 **레퍼런스 두 장** 조합
6. **시드 삼중 진단**(고치는 법이 아니라 디버깅) — 같은 시드로 ① 레퍼런스만 ② 레퍼런스+장면 프롬프트 ③ 장면 프롬프트만 을 뽑아, 프롬프트 압력 탓인지 파이프라인 고장인지 가른다

---

## 6. 블로그스팸 경계 목록

이 모델명들의 웹 검색 첫 페이지는 거의 전부 제휴 SEO다. 제외할 도메인:
`nenobanana.com` · `selfielab.me` · `vidguru.ai` · `createvision.ai` · `chatimg.ai` · `morphed.app` ·
`fluxproweb.com` · `piapi.ai` · `vofy.art` · `imagine.art` · `somake.ai` · `vidofy.ai` · `atlascloud.ai` ·
`soku.ai` · `picovix.app` · `neolemon.com` · `opencreator.io` · `aiphotogenerator.net` · `fluxnote.io`

**판별 기준**: 방법론 없는 어림수 주장("90% consistency rates", "up to 5 characters and 14 objects") ·
무관한 도메인들에서 동일한 문구 · 끝에 그 모델 API로 유도하는 CTA.

---

## 7. 이 조사가 스킬 설계에 남기는 것

1. **Kling o3를 "품질이 좋아서" 고르는 서술을 쓰지 마라.** 근거가 없다. 고르는 이유는 **가격과 기능**이다
2. **인물 얼굴이 중요한 컷이라면 Kling o3를 기본값으로 두지 마라.** 클라우드 실무자의 기본은 Nano Banana Pro다
3. **v1이 얼굴을 피하고 손·팔만 찍은 것은 옳았다.** (a)(b)(d) 세 실패 모드를 통째로 비켜 간다
4. **프롬프트를 길게 쓸수록 얼굴이 먼저 무너진다** — 인물이 있는 프레임에서는 프롬프트를 짧게
5. **한 이미지를 반복 수정하지 말고 매번 새로 뽑는다** — Artlist의 9장 배치가 이 원리와 정확히 맞는다
