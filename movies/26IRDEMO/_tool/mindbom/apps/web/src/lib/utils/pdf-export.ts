import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas-pro'

/**
 * 문서 에디터의 A4 페이지(.page) 요소들을 그대로 캡처해 A4 PDF로 저장한다.
 * 각 페이지 요소는 794x1123px(A4@96dpi)이므로 페이지당 1장씩 A4 면에 꽉 채운다.
 * (Tailwind 4의 oklch 색상 때문에 html2canvas-pro 사용)
 *
 * @param pages   순서대로 캡처할 페이지 요소들 (표지 + 본문 + 마무리)
 * @param filename 저장 파일명 (.pdf 포함)
 */
export async function exportPagesToPdf(
  pages: HTMLElement[],
  filename: string
): Promise<void> {
  if (!pages.length) throw new Error('내보낼 페이지가 없습니다.')

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()

  for (let i = 0; i < pages.length; i++) {
    const canvas = await html2canvas(pages[i], {
      scale: 2, // 2배 해상도로 텍스트·표 선명도 확보
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    })
    const img = canvas.toDataURL('image/png')
    if (i > 0) pdf.addPage()
    pdf.addImage(img, 'PNG', 0, 0, pageW, pageH)
  }

  pdf.save(filename)
}
