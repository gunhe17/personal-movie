import { redirect } from '@sveltejs/kit'

// 바우처 목록 확정 단계 제거 — 목록·구간 분리는 옳다고 보고 바우처별 확정으로 바로 간다.
// 옛 링크(히스토리·북마크)가 404 로 떨어지지 않게 문서 상세로 보낸다.
export const load = ({ params }: { params: { extractionId: string } }) => {
  redirect(307, `/voucher-extraction/${params.extractionId}`)
}
