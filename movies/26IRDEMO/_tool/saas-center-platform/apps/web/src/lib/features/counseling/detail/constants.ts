export const MODAL_SIZES = {
  // 740 = 좌우 2단 레이아웃(달력 + 선택된 날짜) 전용 구간 — Web_Design.md §modal 폭 4단
  sessionEdit: { customWidth: 740, desktopOnly: true },
  sessionCancel: { customWidth: 540 },
  billing: { customWidth: 640, isReceipt: true }
} as const
