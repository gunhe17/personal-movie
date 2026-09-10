export function buildCenterDetailInput(centerId: string) {
  return { centerId }
}

export function buildOperatingTimesInput(centerId: string) {
  return { centerId }
}

export function buildNonOperatingTimesInput(centerId: string) {
  return { centerId }
}

// ─── 운영 현황 통계 (total만 필요하므로 최소 size로 호출) ───

export function buildMemberCountInput(centerId: string) {
  return { centerId, page: 1, size: 1 }
}

export function buildClientCountInput(centerId: string) {
  return { centerId, skip: 0, limit: 1 }
}

export function buildRoomListInput(centerId: string) {
  return { center_id: centerId }
}

export function buildProgramCountInput(centerId: string) {
  return { centerId, page: 1, size: 1 }
}
