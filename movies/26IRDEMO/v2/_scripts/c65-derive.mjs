// C6.5 제출 서류 파생 (웹) — 같은 일지에서, 제출처마다.
// 배역: 회기 축 — 이하준 놀이치료 C00002 · 2026-09-06 12회기. 바우처는 아동비전형성지원서비스.
// 시작 URL: /counseling/status/<caseId>?session=<sessionId>  (회기 상세 = 확정된 일지)
// 전제: v2/_scripts/c65-derive-setup.sql (바우처↔회기 기록지 연결 + 파생 본문 고정)
//       llm-stub.mjs(:3599)가 떠 있어야 한다 — 파생이 진짜 LLM 1콜을 탄다(요청형, batch 워커 불필요).
//
// 논지는 "다시 치는 것이 아니라 파생된다"이다. 그래서 커서가 마지막에 좌우를 오간다 —
// 일지의 그 문장과 양식의 그 칸이 **같은 텍스트**라 `text=…`가 두 곳에 걸린다(nth=0 좌 / nth=1 우).
// 임상 표기(K-CBCL T 68 · F93.8 R/O)는 왼쪽에만 있고 오른쪽 양식에는 안 넘어간다 — 이것도 논지다.
const 같은문장 = 'text=역할놀이에서 자신감 있게 참여'

export default async function steps(page, h) {
  await h.beat('회기 상세 — 확정된 일지')
  await h.hover('textarea[placeholder="진행 내용을 작성해주세요"]', '원문 — 이 문장이 옮겨진다')

  await h.click('button:has-text("제출 서류 초안 작성")', '제출 서류 초안 작성')
  await h.modal('제출 서류 모달 — 좌 일지 / 우 바우처 양식(빈칸)')

  h.nocutStart('양식 채우기 → 오른쪽이 채워진 채 선다 (생성 소요는 노컷)')
  await h.click('button:has-text("이 일지로 양식 채우기")', '이 일지로 양식 채우기')
  await h.until('text=회기 내용', '옮기는 중… → 양식이 섰다', 60000)
  h.nocutEnd()

  await h.beat('일지 옆에 양식이 채워진 채 선다')
  await h.hover(`${같은문장} >> nth=0`, '일지의 그 문장')
  await h.hover(`${같은문장} >> nth=1`, '양식의 같은 문장')
  await h.hover(`${같은문장} >> nth=0`, '다시 일지 — 같은 문장')
  await h.hold(700, '끝')
}
