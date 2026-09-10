미드저니 영상 실무 팁을 X에서 직접 찾겠습니다. 항목별로 키워드·의미 검색을 동시에 돌리고, 인용·좋아요가 높은 글부터 모은 뒤 일반 지식과 구분해서 정리합니다.기존 조사 형식(`x-discourse-grok.md`)에 맞춰 항목별로 고인게이지먼트 게시와 실패담을 더 좁혀 검색합니다.고인게이지먼트 스레드와 저작권·반발 사례를 더 좁혀 원문과 수치를 확인합니다.검색 결과를 항목별로 정리해 리포트 파일로 남깁니다. 인용된 계정·수치·파라미터는 검색된 원문만 쓰고, 못 찾은 것은 지어내지 않습니다.X 검색은 됐습니다. 원문·계정·시점만 인용했고, 없는 트윗은 만들지 않았습니다. 전문은 [`03-research/midjourney-video-grok.md`](03-research/midjourney-video-grok.md)에 있습니다.

한 줄 결론부터: **2026년 9월 실무에서 미드저니 V1 비디오는 3~4분 시퀀스 엔진이 아닙니다.** 스틸·시트·첫 프레임은 MJ, 움직임은 Seedance/Kling/Veo, 손·텍스트는 다른 도구로 고칩니다. `--oref`/`--ow`는 **V7 문법**이고, V8.2에는 없습니다.

---

## 검색 범위

잘 나온 것: 2025-06 V1 론치 팁, 2025-05 Omni-Reference 공식 수치, 2026년 MJ→Seedance 파이프라인, 디즈니 소송 잔향, 코카콜라 반발의 2026 잔존.
안 나온 것: “극사실 상담실 + 2D 상담사”를 MJ 한 방+`--sref`로 여러 컷 유지한 상업 사례. 그 룩의 고성과 코드는 없었습니다.

---

## 1. V1 비디오 팁 (인용·좋아요가 많았던 것)

**실제로 검색된 것**

공식 메시지(2025-06-18, [@LudovicCreator](https://x.com/LudovicCreator)가 인용): Image-to-Video만. Auto/Manual. Low/High. Extend는 **약 4초씩 4회**. 외부 이미지도 start frame.

[@nickfloats](https://x.com/nickfloats) (2025-06-18, 좋아요 1573, 북마크 833):

| 항목 | 론치 실측 |
|---|---|
| 한 잡 | 4개, 24fps, **480p** |
| Low | ambient |
| High | dramatic |
| Extend | 4회, 합계 ~20초 |
| 핵심 | Extend는 **원문 프롬프트를 남기고 지시를 덧붙여라**. 지우면 효과가 떨어짐 |

모션:

- 공식: Low는 카메라 고정·의도적 움직임. 단점 **아예 안 움직임**. High는 둘 다 움직임. 단점 **wonky mistakes**.
- [@oden_ai_ai](https://x.com/oden_ai_ai) (2025-06-21): high는 화려하나 **얼굴이 붕괴**. low는 안정.
- [@Artedeingenio](https://x.com/Artedeingenio) (2025-08-08, 좋아요 1158): 스케치→실사 타임랩스는 `--motion high --raw --video 1 --end`.
- [@LudovicCreator](https://x.com/LudovicCreator): “Auto보다 **manual + motion low**가 통제된다.” 예: `Side dolly shot, camera moves parallel to…`
- `--raw`는 비디오에도 유효 (Nick 스레드 댓글, **V1 비디오**).

Extend: [@Ror_Fly](https://x.com/Ror_Fly) “4x, seamless” 후 Topaz. [@MrDavids1](https://x.com/MrDavids1) “가장 심리스한 extend.” 반대: [@TheJakeneutron](https://x.com/TheJakeneutron) 좋아요 1521 — “TV quality.”

Start frame: [@reidhannaford](https://x.com/reidhannaford) (2026-06, 좋아요 3320)는 MJ 첫 프레임 + Blender 박스 카메라를 Seedance에 넣음. [@eattheethos](https://x.com/eattheethos)는 MJ 이미지로 턴어라운드 영상을 뽑아 시트를 만듦.

2026-09 [@midjourney](https://x.com/midjourney): V9 이미지를 V2 비디오보다 먼저. “updated animation and video tool should look like?” — V1을 완성품으로 안 봄.

**시사점:** 상담실 정지는 `--motion low`. 얼굴 클로즈에서 high+Extend는 위험. 3~4분을 V1으로 잇는 주장은 검색에 없음.

---

## 2. 캐릭터 일관성

**버전 (검색된 것)**

| 파라미터 | 버전 | 비고 |
|---|---|---|
| `--cref`/`--cw` | V6/V6.1 | V7에서 대체 |
| `--oref`/`--ow` | **V7만** | niji 6 불가 ([@aiehon_aya](https://x.com/aiehon_aya)) |
| V8/V8.2 oref | **없음. V7 폴백** | 공식 2026-08-28. [@Sente_us](https://x.com/Sente_us): “v8 still doesn’t have oref” |
| `--sref`, `--p`, 무드보드 | V6.1~V8.2 | 공식: V8.2 edit는 최대 4장 레퍼런스 + sref/무드보드/`--p` |

**공식 `--ow` 수치** ([@midjourney](https://x.com/midjourney) 2025-05-01, 조회 142만):

- 범위 0–1000, **기본 100**
- 사진→애니메 등 스타일 변환: **`--ow 25`**
- 얼굴·옷 고정: **`--ow 400`**
- `--stylize`/`--exp`와 경쟁. 둘 다 높으면 ow도 높여라
- 경고: stylize/exp가 극단이 아니면 **400을 넘기면 오히려 나빠질 수 있다**
- 보존할 부위를 과잉 명시. 투명 PNG가 더 잘 된다 ([@Morph_VGart](https://x.com/Morph_VGart))

실무 순서:

- [@aiehon_aya](https://x.com/aiehon_aya) (북마크 966): oref → 프롬프트에 `character sheet` → 표정·뒷모습.
- [@alban_gz](https://x.com/alban_gz): `--ow <100` 스타일 변경, `>400` 레퍼런스 근접. `--p`/sref/무드보드와 동시 사용.
- [@Ror_Fly](https://x.com/Ror_Fly): `--ow 400` + `--profile` → Kling.
- [@michaelrabone](https://x.com/michaelrabone): **1) oref 2) sref 3) 프롬프트**, `--ow 90`.
- [@reidhannaford](https://x.com/reidhannaford): oref로 대략 잡은 뒤 Nano Banana로 손가락·장비 수정. 얼굴 교체는 조명까지 무너짐.
- [@aimikoda](https://x.com/aimikoda) (2026-09): 무드보드로 낙서 캐릭터 → 한 장에 세 명을 넣으면 스케일 실패 → **컷별 키프레임 + 시트**를 같이.

**검색에 없는 것:** “이 조합이면 N컷 중 M컷 유지”라는 재현 가능한 성공률 표.

**시사점:** 상담사 시트(정면·3/4·손, PNG) → V7 `--oref --ow 400`으로 얼굴 잠금 → 방만 프롬프트로 바꿈. 2D 룩을 입힐 때는 ow를 25 근처로 낮추고 안경·재킷을 과잉 명시. V8.2만 쓰면 oref가 없다.

---

## 3. “아직 안 된다” — 반복된 한계

| 한계 | 누가, 언제 |
|---|---|
| 480p / TV 화질 | @TheJakeneutron, @nickfloats, 2025-06 |
| 오디오 없음 | 2026-09 공식 피드백에도 @Ha9n0, @SharkAnth0ny가 그대로 요청 |
| 길이 5초+4회≈21초 | 공식. @Ha9n0: 연장 없이 5/10/15초를 직접 고르게 해달라 |
| 텍스트·문서 | @salihkizilkayaa 2026-09: “롤백·후작업 없으면 글자가 안 된다.” @nan_in_space: “mangles text.” @vermithor_JT: “손을 줌하고 글자를 줌하라” |
| 손 | 같은 디자이너 + Reid가 Nano Banana로 손가락을 고침 |
| 얼굴 (비디오) | @oden_ai_ai: high+extend에서 붕괴 |
| 카메라 | @Ha9n0: 카메라 지시를 하면 **포즈가 바뀐다**. Adobe Firefly @amogh42: “controllability가 없어서 MJ를 프로덕션에 못 넣는다” |
| 플라스틱 질감 | @Shakaama, 2026-09 |

**시사점:** K-WISC 용지·전자바우처·카톡은 MJ가 그리면 안 됩니다. 실제 UI를 합성해야 합니다.

---

## 4. 파이프라인 — 스틸 MJ + 다른 모델이 아직 우세

**실제로 검색된 2026 생산 조합은 거의 전부 이쪽입니다.**

- [@reidhannaford](https://x.com/reidhannaford) 2026-06: MJ 첫 프레임 + Blender 박스 + **Seedance** (좋아요 3320)
- [@yagi_dsn](https://x.com/yagi_dsn): MJ + Runway Gen-4.5 + Kling O3 PRO + CapCut
- [@kreevslab](https://x.com/kreevslab): MJ 스틸 → Seedance → Topaz → Premiere
- [@WorldEverett](https://x.com/WorldEverett): 같은 스틸을 Kling/Seedance/Veo에 넣고 샷 타입별로 고름
- [@humble_whisper](https://x.com/humble_whisper) 2026-08: “스틸은 MJ. 비디오는 Runway, Kling, Veo, Sora…”

V1을 “스타일 보존·Extend 심리스”로 칭찬한 글은 많습니다. **3~4분 제품 내러티브 엔진으로 충분하다는 고성과 주장은 없습니다.** @vermithor_JT (2026-09): “10초 일관 비디오는 Runway 일이다.”

**시사점:** V1은 형광등·종이 같은 5초 앰비언트 테스트용. 본편은 MJ 키프레임 → Seedance(샷에 따라 Kling/Veo) → Topaz → 편집기. Reid의 Blender 박스는 상담실 락오프 35mm / 핸드헬드 85mm를 미리 잠그는 데 직접 해당합니다.

---

## 5. 극사실 배경 + 2D 캐릭터

**정직하게:** 그 룩의 고성과 `--sref` 코드는 검색되지 않았습니다.

가장 가까운 검색 결과:

1. **공식 V7:** `a anime woman with blonde hair and red suspenders --oref url --ow 25` — 사진→애니메. 반대 방향(2D를 실사 방에)의 공식 예문은 없음.
2. **[@Artedeingenio](https://x.com/Artedeingenio)** (좋아요 1158 / 312): 스케치 start + 포토 end. 그리고
   ```
   child playing guitar --raw --sref 4127131107 3422803553 --p
   ```
   낙서 sref 두 개 + 실제 아이 이미지를 비디오에 넣으면 4장 중 **1~2장만** 그림과 현실이 섞임.
3. **[@aimikoda](https://x.com/aimikoda)** 2026-09: 낙서 캐릭터 + **실사 손**. 층이 우리 룩과 반대(배경이 종이)지만, 실사 층과 2D 층을 프롬프트에서 분리하고 컷별 키프레임으로 스케일을 잠그는 방법은 같습니다.

공유된 `--sref` 대부분은 네오레트로 애니, 포토리얼 플래시, 펠트 스톱모션이지 상담실 혼합이 아닙니다. niji는 oref가 안 됩니다.

**시사점:** 방을 MJ 포토리얼로, 인물을 2D 시트로 따로 잠근 뒤 합성하거나 Seedance 레퍼런스로 겹치십시오. 한 번의 sref로 여러 컷을 유지한다는 증거는 없습니다.

---

## 6. 상업 이용·저작권

**검색된 것:** 2025-06 Disney & Universal 제소. 2026년 게시들은 Warner Bros. 합류, “still ongoing.” 소장 문구 “bottomless well of theft”가 2026-09에도 반복. [@Rahll](https://x.com/Rahll) (Reid Southen): 자기 자료가 소장 **10페이지**.

유료 플랜 = MJ와의 상업 이용 계약이지 제3자 IP 면책이 아닙니다. [@vermithor_JT](https://x.com/vermithor_JT): “화가 이름 프롬프트는 변호사 편지를 받는 길.” 실존 인물 얼굴을 ref로 쓰지 말 것.

브랜드가 “우리 제품 영상에 MJ를 썼다”고 밝힌 뒤 박수받은 사례는 이번 검색에 없습니다. DreamWorks/Sony 제소는 한 계정만 말해 **교차확인 못 함**.

**시사점:** 상담사·아동은 지어낸 얼굴. 지브리/에반게리온을 프롬프트에 넣는 습관(OscarAI 시트 예문에 둘 다 있음)은 빼는 편이 소송 이후 공기와 맞습니다.

---

## 7. 브랜드 AI 광고 반발 — 2026에도 같은가

**분위기가 뒤집혔다는 고성과 합의는 없습니다. “AI slop”은 2026-09에도 모욕입니다.**

- 코카콜라 2024 홀리데이: [@TODAYshow](https://x.com/TODAYshow) 좋아요 2466. **2026-09** [@Creamy_Spinach_](https://x.com/Creamy_Spinach_): “그 광고 이후로 콜라를 안 마신다.” [@philshelly](https://x.com/philshelly): “크리스마스에 AI 쓰지 마라.” 해리포터 트레일러를 “콜라 AI 광고인 줄” 아는 드립까지 남아 있음.
- 토이저러스: 2024 Charles Lazarus 광고가 2025-11에도 “repulsive.” 2026 **신규** 반발 스레드는 상단에 없음.
- 2026 슈퍼볼: [@tomas_corza](https://x.com/tomas_corza) “올해 슈퍼볼 AI 광고 감성 급부정. AI처럼 **보이기만 해도** 감점.” Svedka, Liquid Death, UFC 프로모 모두 같은 단어로 맞음.

**시사점:** 임상 B2B는 소비재보다 가짜 손·가짜 서식에 더 민감합니다. 생존 전략은 AI 룩을 숨기거나, 2D를 **의도된 양식**으로 선언하거나, 실제 UI는 실제 화면으로 넣는 것. 코카콜라식 전부 생성은 2026년에도 비용이 쌉니다.

---

## 일반 지식으로 보강하지 않은 것

파라미터 문법은 검색된 공식/실무만 적었습니다. 아래는 **이번 검색에서 못 찾은 것**입니다.

- V1으로 3~4분을 완성한 상업 작품명
- `--ow`+`--p`+무드보드+`--sref`의 성공률 표
- 상담실 혼합 전용 sref
- V8.2 4-레퍼런스가 `--ow 400`을 대체한다는 독립 실측 (공식은 “better in every way”만)
- 한국 기업이 MJ 제품 영상을 스스로 밝힌 게시
- 코카콜라 2025/2026 홀리데이 AI 광고의 1차 자료 (2024 광고에 대한 2026 잔여 반발만 확인)
