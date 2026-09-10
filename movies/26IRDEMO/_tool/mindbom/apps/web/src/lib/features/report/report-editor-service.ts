/**
 * 종합보고서 편집 화면의 Service 층 — 본문을 고치고, 모달을 띄우고, 토스트를 낸다.
 *
 * 에디터 인스턴스는 매 호출 시점에 읽는다(`getEditor()`) — 화면이
 * `bind:this`로 나중에 채우기 때문이다. 생성 시점에 값을 받으면 항상
 * undefined다.
 *
 * 상태를 갖지 않는다. 단계·타이머는 각 상태머신(overall-review/span-review)이,
 * 데이터는 report-data가 갖는다. 여기는 "누르면 무슨 일이 일어나는가"만 안다.
 */
import type PaginatedEditor from '$lib/components/document-editor/components/PaginatedEditor.svelte'
import type { ModelSelection } from '$lib/components/document-editor/editor-core'
import { snackbarStore } from '$lib/stores/snackbar'
import { modalStore } from '$lib/stores/modal'
import { isSupportedExamType } from '$lib/features/examination/core/registry'
import { exportPagesToPdf } from '$lib/utils/pdf-export'
import ResultEmbedModal from './ResultEmbedModal.svelte'
import SheetViewerModal from './SheetViewerModal.svelte'
import FixPreviewModal from './FixPreviewModal.svelte'
import { chartDataUri } from './chart-svg'
import { buildPaperClip, findBlockEl, type PaperClip } from './paper-clip'
import type { MaterialAsset, MaterialGroup, ResultCard } from './materials'
import type { AssetItem } from './report-assets'
import type {
  IssueFix,
  OverallIssue,
  ReviewBlock
} from './overall-review'

type Editor = PaginatedEditor | undefined

export interface ReportEditorDeps {
  /** 매 호출 시점의 에디터 인스턴스 (bind:this로 늦게 채워진다) */
  getEditor: () => Editor
  /** 실검사 에셋 원본 — 목업 클릭을 실자료로 되돌릴 때 쓴다 */
  getAssets: () => AssetItem[]
  /** 에디터 문서를 리뷰용 블록으로 변환 */
  readReviewBlocks: () => ReviewBlock[]
  /** 본문이 바뀐 뒤 리뷰 갱신 (지적이 실제로 사라지는 걸 보여준다) */
  onDocumentChanged: () => void
}

export function createReportEditorService(deps: ReportEditorDeps) {
  const { getEditor, getAssets, readReviewBlocks, onDocumentChanged } = deps

  // ── 검사 결과 모달 ──
  // 결과 단계는 검사 종류와 무관하게 /results 로 통일돼 있다(공통 step 어휘).
  // 백드롭·스택·Escape·폭은 modalStore/ModalContainer가 잡는다.
  function openResultModal(card: ResultCard) {
    if (!isSupportedExamType(card.examType)) {
      snackbarStore.error('결과 화면을 지원하지 않는 검사입니다.')
      return
    }
    modalStore.open({
      component: ResultEmbedModal,
      props: {
        url: `/examinations/${card.id}/results?embed=1`,
        title: `${card.type} 검사 결과`
      },
      // 검사 결과 화면을 통째로 담는다 — 로샤는 카드·코딩표가 가로로 넓어
      // wide(896px)로는 좁다. 결과지 이미지만 보는 뷰어와 폭이 다른 이유.
      // customHeight로 높이를 고정하는 건 iframe 때문이다. 컨테이너 기본값은
      // max-h라서 내용 높이를 모르는 iframe이 들어가면 모달이 쪼그라든다.
      options: { size: 'wide', customWidth: 1152, customHeight: 900 }
    })
  }

  /** 검사 결과 전체보기 — 결과 페이지가 있으면 모달 임베드, 없으면 결과지 이미지 뷰어 */
  function openGroupResult(g: MaterialGroup) {
    if (g.card) {
      openResultModal(g.card)
      return
    }
    const images = g.items
      .filter((it) => it.kind === 'image' && it.src)
      .map((it) => it.src as string)
    if (!images.length) {
      snackbarStore.info('표시할 결과지가 없습니다.')
      return
    }
    modalStore.open({
      component: SheetViewerModal,
      props: { title: `${g.code} 검사 결과`, images },
      // 결과지 이미지를 세로로 나열하기만 해서 결과 화면보다 좁다.
      options: { size: 'wide', customHeight: 900 }
    })
  }

  // ── 본문 삽입 ──

  function insertAsset(a: AssetItem) {
    const editor = getEditor()
    if (a.kind === 'image' && a.src) {
      editor?.insertImage({
        src: a.src,
        alt: a.name,
        caption: a.name,
        sourceId: a.id
      })
    } else if (a.kind === 'table' && a.table) {
      // 표 제목은 넣지 않는다 — 차트·이미지와 마찬가지로 본문에는 표 자체만
      // 들어가고, 설명은 임상가가 문단으로 쓴다.
      editor?.insertTable({
        headers: a.table.headers,
        rows: a.table.rows,
        sourceId: a.id
      })
    }
  }

  /** 사이드바 자료 클릭 — 목업도 실기능과 동일하게 본문에 삽입한다 */
  function insertMaterial(g: MaterialGroup, a: MaterialAsset) {
    const editor = getEditor()
    if (g.origin === 'mock') {
      if (a.kind === 'image' && a.src) {
        editor?.insertImage({
          src: a.src,
          alt: `${g.code} ${a.name}`,
          caption: `${g.code} · ${a.name}`,
          sourceId: a.id
        })
        return
      }
      if (a.kind === 'chart') {
        // SVG 차트를 data URI로 렌더해 삽입.
        // 제목은 SVG 안에 넣지 않는다 — 캡션과 겹쳐 보이고, 실제 결과지
        // 이미지와도 형태가 달라진다.
        editor?.insertImage({
          src: chartDataUri(
            a.chart ?? 'bar',
            a.color ?? '#0ea5e9',
            a.id.length + a.name.length
          ),
          alt: `${g.code} ${a.name}`,
          caption: `${g.code} · ${a.name}`,
          sourceId: a.id
        })
        return
      }
      snackbarStore.info('시연용 목업 자료입니다.')
      return
    }
    const orig = getAssets().find((x) => x.id === a.id)
    if (orig) insertAsset(orig)
  }

  /** 첨부된 자료의 본문 위치를 보여준다 — 어느 자료를 말하는지 즉시 드러난다 */
  function revealAttached(assetId: string) {
    const editor = getEditor()
    const paraId = editor?.findParaIdBySource(assetId) ?? null
    if (paraId) editor?.revealPara(paraId)
  }

  /** 첨부된 자료를 본문에서 제거 */
  function removeAttached(assetId: string, name: string) {
    const removed = getEditor()?.removeParaBySource(assetId) ?? false
    if (removed) {
      snackbarStore.success(`'${name}'을(를) 본문에서 제거했습니다.`)
    } else {
      // sourceId 없이 들어간 프리셋 이미지 등 — 자동으로 찾지 못한다
      snackbarStore.info(
        '본문에서 해당 블록을 찾지 못했습니다. 직접 삭제해주세요.'
      )
    }
  }

  // ── 구간 리뷰 수정안 적용 ──

  /**
   * 선택 구간에 치환쌍들을 적용.
   * @returns 반영 성공 여부. false면 호출부가 범위를 비우지 않는다.
   */
  function applySpanFix(
    range: ModelSelection | null,
    text: string,
    pairs: [string, string][]
  ): boolean {
    const editor = getEditor()
    if (!editor || !range) {
      snackbarStore.error('수정할 구간을 찾지 못했습니다.')
      return false
    }
    const replaced = pairs.reduce(
      (acc, [before, after]) => acc.split(before).join(after),
      text
    )
    if (!editor.replaceRange(range, replaced)) {
      snackbarStore.error('수정할 구간을 찾지 못했습니다.')
      return false
    }
    snackbarStore.success(
      pairs.length > 1
        ? `${pairs.length}곳을 수정했습니다.`
        : '수정안을 반영했습니다.'
    )
    return true
  }

  // ── 종합 리뷰 수정안 (CDSS: 미리보기 → 임상가 승인 → 반영) ──

  /** 치환 대상 문단 — 헤딩은 제외한다(본문 표현을 고치는 것이지 목차가 아니다) */
  function replaceTargets(before: string): ReviewBlock[] {
    return readReviewBlocks().filter(
      (b) => !b.isHeading && b.text.includes(before)
    )
  }

  /**
   * 승인된 수정안을 본문에 반영한다.
   *
   * 드래그 선택 없이 동작해야 하므로 ModelSelection을 직접 구성한다
   * ({paraId, offset} 쌍이면 replaceRange가 받아준다).
   *
   * @returns 반영 성공 여부. false면 모달이 열린 채로 남는다.
   */
  function applyOverallFix(fix: IssueFix): boolean {
    const editor = getEditor()
    if (!editor) return false

    if (fix.type === 'insert') {
      // 빈 문단 전체를 초안으로 치환
      const ok = editor.replaceRange(
        {
          start: { paraId: fix.blockId, offset: 0 },
          end: { paraId: fix.blockId, offset: 0 }
        },
        fix.text
      )
      if (!ok) {
        snackbarStore.error('삽입할 위치를 찾지 못했습니다.')
        return false
      }
      snackbarStore.success('초안을 삽입했습니다.')
    } else {
      // 문서 전체에서 before를 찾아 치환 (여러 문단에 걸쳐 있을 수 있음)
      // (미리보기의 matchCount와 같은 기준이어야 안내 문구가 실제와 맞는다)
      const targets = replaceTargets(fix.before)
      if (!targets.length) {
        snackbarStore.error('바꿀 표현을 찾지 못했습니다.')
        return false
      }
      let n = 0
      for (const b of targets) {
        const i = b.text.indexOf(fix.before)
        if (i === -1) continue
        const ok = editor.replaceRange(
          {
            start: { paraId: b.id, offset: i },
            end: { paraId: b.id, offset: i + fix.before.length }
          },
          fix.after
        )
        if (ok) n++
      }
      if (!n) {
        snackbarStore.error('바꿀 표현을 찾지 못했습니다.')
        return false
      }
      snackbarStore.success(
        n > 1 ? `${n}곳을 수정했습니다.` : '수정안을 반영했습니다.'
      )
    }

    onDocumentChanged()
    return true
  }

  function openFixPreview(issue: OverallIssue, fix: IssueFix) {
    const blocks = readReviewBlocks()

    // 대상 문단과, 그 문단이 속한 섹션명을 함께 넘긴다.
    // "문서 어디를 고치는지"가 보여야 임상가가 판단할 수 있다.
    const targetId = fix.type === 'replace' ? undefined : fix.blockId
    const idx = blocks.findIndex((b) =>
      fix.type === 'replace' ? b.text.includes(fix.before) : b.id === targetId
    )

    let context = ''
    let section = ''
    let clip: PaperClip | null = null
    // 치환이 실제로 몇 군데에 적용되는지 (적용 로직과 같은 기준: 문단당 1회)
    const matchCount =
      fix.type === 'replace' ? replaceTargets(fix.before).length : 0

    if (idx !== -1) {
      context = blocks[idx].text
      clip = buildPaperClip(
        blocks[idx].id,
        fix.type === 'insert'
          ? { insert: fix.text }
          : { replace: { before: fix.before, after: fix.after } }
      )
      // 위로 거슬러 올라가며 가장 가까운 헤딩을 찾는다
      for (let i = idx; i >= 0; i--) {
        if (blocks[i].isHeading) {
          section = blocks[i].text
          break
        }
      }
    }

    modalStore.open({
      component: FixPreviewModal,
      props: {
        issue,
        fix,
        contextText: context,
        section,
        clip,
        matchCount,
        onconfirm: () => applyOverallFix(fix)
      },
      options: { size: 'wide', customWidth: 768 }
    })
  }

  // ── PDF 생성 ──

  /**
   * 화면에서 숨긴 표지/마무리도 PDF엔 포함 → 캡처 동안 숨김을 일시 해제한다.
   * @returns 다운로드까지 끝났는지
   */
  async function generatePdf(fileName: string): Promise<boolean> {
    const ed = getEditor()
    if (!ed) {
      snackbarStore.error('에디터가 아직 준비되지 않았습니다.')
      return false
    }
    try {
      let ok = false
      await ed.withAllPagesVisible(async () => {
        const pages = ed.getPageElements()
        if (pages.length === 0) {
          snackbarStore.error('생성할 보고서 내용이 없습니다.')
          return
        }
        await exportPagesToPdf(pages, fileName)
        snackbarStore.success('보고서 PDF를 다운로드했습니다.')
        ok = true
      })
      return ok
    } catch (err) {
      console.error('[report pdf] 생성 실패', err)
      snackbarStore.error('보고서 PDF 생성에 실패했습니다.')
      return false
    }
  }

  return {
    openResultModal,
    openGroupResult,
    insertMaterial,
    revealAttached,
    removeAttached,
    applySpanFix,
    applyOverallFix,
    openFixPreview,
    generatePdf
  }
}

export type ReportEditorService = ReturnType<typeof createReportEditorService>

/**
 * 지적사항 클릭 → 해당 블록으로 이동하며 잠시 강조한다.
 *
 * 본문 가로 위치는 패널이 열려 있는 동안 이미 좁아진 영역의 중앙에 고정돼
 * 있으므로(main의 width 참고), 여기서는 세로 스크롤과 강조만 처리한다.
 * 강조를 걷어내는 타이머를 갖고 있어 화면이 destroy()를 불러 준다.
 */
export function createBlockJumper() {
  let timer: ReturnType<typeof setTimeout> | null = null

  function jumpTo(blockId: string) {
    const el = findBlockEl(blockId)
    if (!el) return

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('review-jump-target')

    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      el.classList.remove('review-jump-target')
      timer = null
    }, 2000)
  }

  function destroy() {
    if (timer) clearTimeout(timer)
  }

  return { jumpTo, destroy }
}
