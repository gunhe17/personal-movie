// s01 초안 — record.mjs 기록(0개 이벤트)에서 생성. 계정 staff · 시작 http://localhost:3503/schedule/calendar
// 할 일: note 다듬기 · 상태가 바뀐 곳에 h.beat · 모달 뒤 h.modal · 노컷 구간 h.nocutStart/End · 헛클릭 삭제
export default async function steps(page, h) {
  await h.beat('첫 화면')

  await h.hold(1500, '끝')
}
