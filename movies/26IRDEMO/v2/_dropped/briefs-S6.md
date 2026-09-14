# S6 증명 · 슈퍼비전

## 사례 (A 기존 흐름)
- **인물 · 시각**: 상담사 정상담 · 슈퍼비전 전날 22:00
- **흐름**: 파일철에서 12회기 일지를 처음부터 다시 읽는다 → 언제 무엇이 달라졌는지 기억으로 찾아 A4 한 장에 요약한다
- **이 A가 말하는 것**: 답은 이미 열두 장 안에 있는데, 그것을 한 장으로 만드는 일이 사람의 밤이다.
- **B로 이음새**: A의 빈 A4(요약을 쓰려는 손)가 B에서 케이스 분석 화면이 된다 — 근거 회기 번호가 달린 채.

## C6.1 열두 장을 넘긴다 — 4.0s · ai · AI · none
- flow: ① 파일철의 일지 열두 장을 처음부터
- situation: 밤. 파일철의 일지 열두 장을 넘기는 손. 옆에 빈 A4와 펜.
- caption: 기존 · 슈퍼비전 전날 밤. 12회기를 처음부터 다시 읽는다

```prompt
Documentary photograph aesthetic, unretouched, fine film grain.

A counsellor's desk at night seen from slightly above. A woman's hands enter from the right edge, turning through a thick ring binder of plain sheets, each carrying only faint ruled boxes, while a blank sheet of paper and a pen wait beside it. The moment before the twelfth page. Patient, searching, unposed.

FG: the blank sheet and the pen, slightly below centre. MG: the hands and the open binder, occupying the right third. BG: a plain wall and a shelf edge, softly defocused.

Light: a warm desk lamp from the upper right; the left side of the desk falls into shade.

Composition: rule of thirds. The binder and the hands fill the right third; the lower left quadrant is calm bare desk in shade, left clear for copy added later.

Angle: high three-quarter, just above desk height, with comfortable margin around the subject on all sides.

Focus: hard focus on the fingertips on the page edge. Set to 50mm, medium depth of field so the shelf edge stays readable during a slow dolly in.

Tone: Low Saturation Gray palette, muted grey-green and warm beige. Natural skin texture with visible pores, matte skin with no shine, believable proportions and natural hands.

The subject reads clearly against the background in tone and value.

Overall vibe: looking for the week something changed.

The desk surface is bare and unmarked, every sheet plain with faint ruled boxes and free of print, the binder plain and unbranded, every surface clean and free of lettering.
```

## C6.2 기억으로 요약 — 3.0s · ai · AI · none
- flow: ② 언제 달라졌는지 기억으로 찾아 한 장에 쓴다
- situation: 같은 책상. 빈 A4에 펜을 대는 손, 옆에 펼쳐진 파일철.
- caption: 기존 · 언제 달라졌는지, 기억으로 찾아 한 장에

```prompt
Documentary photograph aesthetic, unretouched, fine film grain.

A counsellor's desk at night seen from above. A woman's hands enter from the right edge, writing with a pen on a blank sheet of paper; beside it a thick ring binder lies open with plain sheets carrying only faint ruled boxes. The moment of writing from memory what the pages should already say. Weary, unposed.

FG: the open binder, slightly below centre. MG: the hands and the blank sheet, occupying the right third. BG: a plain wall and a shelf edge, softly defocused.

Light: a warm desk lamp from the upper right; the left side of the desk falls into shade.

Composition: rule of thirds. The sheet and the hands fill the right third; the lower left quadrant is calm bare desk in shade, left clear for copy added later.

Angle: high three-quarter, just above desk height, with comfortable margin around the subject on all sides.

Focus: hard focus on the pen tip. Set to 50mm, medium depth of field so the background stays readable during a slow dolly in.

Tone: Low Saturation Gray palette, muted grey-green and warm beige. Natural skin texture with visible pores, matte skin with no shine, believable proportions and natural hands.

The subject reads clearly against the background in tone and value.

Overall vibe: which week did it change.

The desk surface is bare and unmarked, every sheet plain with faint ruled boxes and free of print, every object clean and free of lettering.
```

## C6.4 케이스 분석 — 14.3s · new · AI 무대 · 신규 화면 · imac
- flow: ①②가 사라진다 — 열두 장이 한 화면이 되고, 판단마다 회기 번호
- situation: 케이스 → 분석 생성 → 변화 흐름 · 전환점 · 슈퍼비전 방향. 커서가 "7회기"라는 근거 번호 하나를 짚는다.
- caption: 모든 판단에 회기 번호가 달린다
- segment: 1.9–16.2
- check: 목 대본. 생성 소요는 노컷
- source: v2/s06-c4-케이스분석/raw/s06_web_analysis_t01.mov (16.47s · SPEC v8) · 노컷 3.74–11.33 · v2/_scripts/c64-analysis.mjs → s06-c4-케이스분석/C6.4_imac.mp4 (1.9–16.2 · 14.3s)
