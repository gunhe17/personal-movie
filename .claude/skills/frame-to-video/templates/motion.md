<!-- 이 파일이 모션 프롬프트의 정본이다. 슬롯을 다 채우고 주석은 지운다. 영어로 쓴다.
     규칙은 .claude/skills/frame-to-video/SKILL.md §모션 프롬프트.
     장면·룩·구도는 쓰지 않는다 — 첫 프레임이 이미 준다. 움직임만 40~100단어. -->

<!-- 카메라는 정확히 하나. 첫 프레임 prompt.md 의 "during a …" 무브를 이월하거나 정지.
     움직이면 숫자로 조인다: "Very slow dolly in, about 5% over the whole shot." / "Locked-off tripod shot." -->
<카메라 한 문장>

<!-- 주 동작 하나. 주어는 손 · 손가락 · 손목 · 물건 — 사람 명사·대명사(her, she)를 쓰지 않는다.
     가장 작은 관절에 동작을 주고 나머지를 고정한다: "the fingers do the motion; the wrists stay resting".
     글자를 만드는 동사(writes a note · types a message · screen lights up) 대신 펜 끝·손끝의 작은 움직임. at natural speed -->
<주 동작 한두 문장>

<!-- 고정 절 + 배제. Artlist 349 에는 negative_prompt 가 없다 — 배제는 긍정 상태로 쓴다:
     the page stays blank apart from its faint ruled lines · the screen stays dark -->
<지켜야 할 상태 한 문장>
Everything else remains still and the light stays constant.
