<!-- 이 파일이 프롬프트의 정본이다. 슬롯을 다 채우고 주석은 지운다.
     규칙은 .claude/skills/first-frame/SKILL.md §프롬프트를 쓰는 법.
     frame.mjs save 가 이 파일을 라운드 기록에 스냅샷한다 — 시드가 없으므로 이것이 유일한 재현 근거다. -->

Documentary photograph aesthetic, unretouched, fine film grain.

<!-- 주체 — 동작의 시작점으로. "the moment before …". 나이는 숫자가 아니라 생김새로.
     사람을 명명하면 모델이 그 사람을 만든다. 얼굴을 빼려면 프레이밍으로 뺀다:
     "Only hands and forearms enter the frame from the left edge" -->
<주체와 동작>. <표정·기색 한 마디>.

<!-- 전경/중경/배경 분리. ⚠ 주체를 여백 예약 사분면의 반대쪽에 둔다 — 아래 Composition과 충돌하면 모델은 주체를 택한다 -->
<!-- ⚠ 블러로 뭉갤 배경에 글자·UI·얼굴을 두지 않는다 — 모델이 해석을 시도해 영상에서 헤엄친다.
     그 자리는 무지 표면(plain wall / bare surface)으로 짓는다 -->
FG: <전경>  MG: <중경>  BG: <배경 소품 3~4개 — 모두 무지 표면>

Light: <방향 + 질 + 색온도>; <반대편이 어떻게 떨어지는지>

<!-- ⚠ 주체가 차지하는 사분면과 비워둘 사분면이 겹치면 안 된다 -->
Composition: rule of thirds. <주체가 차지하는 분수 — 예: the counter and her hands fill the lower left (1/3 of the frame)>;
<비워둘 사분면 — 예: the entire right half is calm empty wall, softly defocused>, left clear for copy added later.

<!-- 피사체 주변 10~15% 여백. 카메라 무브 방향으로 여백이 없으면 모델이 프레임 밖을 지어낸다.
     푸시인을 암시하는 타이트 크롭을 쓰지 않는다 — 구도가 지시하지 않은 줌을 부른다 -->
Angle: <앵글>, with comfortable margin around the subject on all sides.

<!-- Set to NNmm 은 공식 verbatim 형식. 이후 카메라 무브를 여기 미리 적으면 그 무브가 가능한 구도로 짠다 -->
Focus: hard focus on <대상>. Set to <NN>mm, <심도> so <배경>
stays readable during a <이후 카메라 무브 — 예: slow dolly in>.

<!-- Low Saturation Gray 는 공식 팔레트명이고 실제로 작동한다. 임의 필름 룩(VHS 등)은 무시된다 -->
Tone: Low Saturation Gray palette, muted grey-green and warm beige.
Natural skin texture with visible pores, matte skin with no shine,
believable proportions and natural hands.

<!-- 피사체 윤곽이 배경과 명도로 갈리게. 붙어 있으면 실루엣이 매 프레임 끓는다 -->
The subject reads clearly against the background in tone and value.

Overall vibe: <한 줄>

<!-- 배제는 전부 긍정문으로. bare and unmarked / plain and unbranded / clean and free of print.
     부정문(No …)은 억제가 아니라 소환으로 작동한다 -->
<모든 표면을 긍정문으로 비운다>
