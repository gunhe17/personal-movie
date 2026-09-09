// s02 · 검사 실시 (마인드봄) — 종이 채점지가 화면이 된다. 실시 화면만 보여준다.
// 배역: 검사 축 — **윤도현**. s01에서 접수한 그 아이의 로샤를 여기서 실시한다(마인드봄 seed:yun-rorschach).
// 임상가 정상담(clinician). 시작 URL: /examinations/<윤도현 로샤 examId>/collect
//
// 반응 하나(①)를 끝까지 기록하면서 팝오버의 기능을 전부 보여준다.
// 설계 근거는 화면 코드에 있다:
//   §14-1 자유반응과 질문이 한 화면 — 모드 전환이 없다
//   §14-2 반응 하나 = 채점지의 한 줄. 자유반응 / 질문 / 위치를 아무 순서로나 채운다
//   §14-7 위치는 반응당 하나 — 조각을 고르는 것이 곧 반응을 고르는 것
//   §14-12 헤더의 `영역`·`질문` 배지가 "어느 칸이 비었는지"를 알린다 — 누락 없음의 최전선
//   반응 칸에는 마이크가 없다(지난 반응을 고칠 때 지금 말이 섞이면 R이 오염된다). 질문 칸에만 있다
//
// 자유반응은 **내담자 화면**에서 받아쓰기로 채운다 — 임상가 화면에 자유반응 마이크가
// 없는 것이 그 이유다(§자유반응 오염 위험). 태블릿을 피검자 쪽으로 돌리면 기록이 전부
// 가려지고 카드만 남는다. 마이크를 켜고, 피검자가 말할 때마다 카드를 한 번 누르면
// 그 탭이 반응의 경계가 되어 탭과 탭 사이의 말이 그 줄의 자유반응이 된다.
// 촬영은 마이크와 전사 모델만 갈아 끼운다 — `--stt _mocks/s02-stt.json` (capture-service/scripts/stt.mjs).
export default async function steps(page, h) {
  await h.beat('로샤 실시 — 카드 I')

  // ① 자유반응 — 태블릿을 피검자 쪽으로 돌려 받아쓰기로 받는다
  h.nocutStart('말한 것이 그대로 반응이 된다')
  await h.click('button[aria-label^="내담자 화면"]', '내담자 화면 — 태블릿을 돌린다')
  await h.beat('카드만 남는다 — 이전 반응은 가려진다')
  await h.click('button:has-text("받아쓰기")', '받아쓰기 — 마이크를 켠다')
  await h.beat('마이크가 켜졌다 — 피검자가 말한다')

  // 카드 어디를 눌러도 된다. 그 탭이 반응의 경계다 — 탭과 탭 사이의 말이 이 줄의 것
  await h.click('button[aria-label^="반응 기록"]', '반응 기록 — 반응 하나에 한 번')
  await h.hold(2600, '전사가 도착해 그 줄에 붙는다')

  await h.click('button[aria-label^="내담자 화면"]', '임상가 화면으로 돌아온다')
  await h.beat('채점지가 돌아온다 — 칩에는 번호만 있다')

  // 반응 ①을 열면 받아쓴 말이 자유반응 칸에 들어와 있다 — 이 장면의 반환점
  await h.click('button[aria-label="반응 1 선택"]', '반응 ① 을 연다')
  await h.until('textarea[placeholder="피검자가 무엇으로 봤는지"]', '피검자의 말이 자유반응 칸에 있다')
  await h.beat('영역·질문 배지는 아직 회색이다')
  h.nocutEnd()

  // ② 영역 — 위치 부호를 고르고, 카드 위에 직접 그린다
  h.nocutStart('한 줄을 끝까지 — 영역 · 질문')
  await h.reveal('button:has-text("영역 그리기")', '위치 칸으로 내려간다')
  await h.click('button:has-text("W")', '위치 부호 W — 반점 전체')
  await h.beat('W가 반응에 저장된다')
  await h.click('button:has-text("영역 그리기")', '영역 그리기')
  await h.beat('카드 위에 직접 그린다')

  // 캔버스에 실제로 그린다 — 반점의 가운데를 감싸는 자리
  // 그리기 판은 `FreehandDrawing.svelte`의 svg 하나뿐이고 aria-label로 잡는다.
  // `svg, canvas`로 잡으면 우상단 사용자 메뉴의 16px 아이콘이 먼저 걸린다(features.md 참조).
  await h.drawOnCanvas('svg[aria-label="영역 그리기"]', [[0.42,0.34],[0.58,0.34],[0.62,0.55],[0.50,0.70],[0.38,0.55]], '영역을 그린다')
  await h.beat('그린 영역이 반응에 붙는다')

  // ③ 질문 (2바퀴) — 같은 줄의 다음 칸. 화면을 옮기지 않으므로 노컷이 여기까지 이어진다
  await h.type('textarea[placeholder="어디가 그렇게 보였는지"]', '가운데 검은 부분이 몸통이고 양옆이 날개요.', '질문 답변')
  await h.beat('배지가 초록으로 — 빈 칸이 없다')
  h.nocutEnd()

  // ④ 카드 방향 — 피검자가 돌려 본 것도 기록이다
  await h.click('button[aria-label^="카드 방향"] >> nth=1', '방향 — 피검자가 카드를 돌렸다')
  await h.beat('방향이 남는다')

  await h.hold(600, '끝')
}
