// s01 · 접수 — 통화하면서 한 번의 요청으로 단체 검사 접수가 끝난다.
// 목 대본: --mock _mocks/s01-intake.json (1턴) · 계정: counselor1(정상담) — 담당 검사자 자동 채움
// 시작 URL: /agent
//
// 폼 화면의 순서 규칙(v4):
//   ① 페이지에 도착하면 잠깐 둔다 — 관객이 화면을 알아볼 시간.
//   ② 맨 위부터, 아직 안 채워진 것을 채운다.
//   ③ 지금 스크롤에서 보이는 것을 다 전달했으면 그때 내린다.
export default async function steps(page, h) {
  await h.beat('에이전트 화면')

  // 한 번의 요청 — 통화 중에 들은 것을 그대로 말한다
  await h.type('textarea[placeholder="무엇이든 물어보세요"]',
    '전화 하고 있는데, 햇살지역아동센터 아이 셋 검사 접수해줘. 윤도현 2014-05-08, 장서아 2015-11-21, 홍시우 2016-02-13이야.',
    '통화 중 요청 — 한 번에')
  await h.key('Enter', '전송')

  h.nocutStart('한 마디 → 검사 접수 폼 · 기관·명단이 얹힌다')
  await h.until('text=접수 진행', '폼으로 갈아끼워진다')
  h.nocutEnd()

  // ① 도착했으니 화면을 알아볼 짧은 대기 — until의 settle에 이어 붙는다.
  //    (v5의 beat 0.7초는 노컷 ① 끝에서 0.96초를 정지시켰다. 폼을 알아보는 데는 이만큼이면 된다)
  await h.hold(350, '폼 도착 — 짧게')

  // ② 맨 위의 빈 칸부터 채운다 — 검사 항목이 폼 최상단이다
  //    한 접수가 두 갈래로 갈린다: 대면 3종은 마인드봄으로, 온라인 1종은 바로링크로.
  //    대면 셋이 윤도현의 배터리가 되어 s03의 종합보고서가 된다 — 그래서 셋을 여기서 고른다.
  await h.click('button:has-text("로르샤흐")', '로르샤흐(투사·대면) → s02 실시')
  await h.click('button:has-text("집-나무-사람")', 'HTP(투사·대면) → s03 배터리')
  await h.click('button:has-text("문장완성검사")', 'SCT(투사·대면) → s03 배터리')
  await h.click('button:has-text("스마트폰중독검사")', '스마트폰중독검사(온라인) → s04 바로링크')
  await h.beat('접수 진행 3/3 — 버튼이 살아난다')

  // ③ 위쪽을 다 봤으니 목표(맨 아래 담당자 칸)까지 한 번에 내린다 — 명단 · 기관 · 담당자가 한 흐름으로 지나간다(v8 scrollTo).
  //    폼은 안쪽 div가 스크롤한다(`overflow-y-auto` · 실측 1265/726) — scrollTo가 스크롤러를 찾아 남은 거리로 자른다.
  //    `등록` 버튼은 스크롤러 밖 고정 바에 있어 목표가 못 된다(리허설 실측: "이미 보인다").
  await h.scrollTo('text=대표 검사자로 지정돼요', '한 번에 맨 밑까지 — 명단 · 기관 · 담당자', 'end')

  h.nocutStart('등록 → 검사 현황')
  await h.click('role=button[name="등록"]', '등록 — 내담자 3명이 실제로 생성된다')
  await h.until('text=검사 현황', '검사 현황에 새 케이스')
  h.nocutEnd()

  await h.hold(600, '끝')
}
