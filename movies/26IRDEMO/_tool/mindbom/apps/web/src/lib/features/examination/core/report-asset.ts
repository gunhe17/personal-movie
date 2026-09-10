/**
 * 보고서 자료 추출에서 검사 종류와 무관하게 쓰이는 것들.
 *
 * 검사별 추출 로직은 각 모듈의 report.ts가 갖는다(ExamModule.loadReportAssets).
 */

/**
 * 이미지 URL 정규화.
 *
 * 절대 URL(공개 S3)은 동일 출처 이미지 프록시로 감싼다 — 그래야 PDF 생성 시
 * html2canvas가 크로스오리진 CORS 없이 픽셀을 읽을 수 있다.
 */
export function resolveImageUrl(url: string): string {
  if (url.startsWith('http')) return `/api/img?url=${encodeURIComponent(url)}`
  return `/api/proxy/storage/${url}`
}
