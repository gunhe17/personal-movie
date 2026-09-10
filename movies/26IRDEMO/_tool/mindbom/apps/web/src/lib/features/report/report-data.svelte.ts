/**
 * 종합보고서 편집 화면의 실데이터 — 로드와 파생.
 *
 * Hooks + ViewModel 층. 검사·내담자·검사자·에셋을 불러와 사이드바가 그리는
 * 모양(MaterialGroup[])까지 만든다. 에디터·모달·토스트는 알지 못한다 —
 * 그쪽은 report-editor-service.ts가 맡는다.
 *
 * 자료 목록은 **실제로 묶인 검사만** 그린다. 예전에는 실검사 뒤에 목업 표준화
 * 검사(MMPI-2/TCI/S-척도)를 덧붙여 배터리처럼 보이게 했으나 2026-09-10에 걷어냈다 —
 * 실시된 적 없는 검사가 화면에 서면 시드와 어긋난다.
 */
import { get } from '$lib/services/api/instances'
import { snackbarStore } from '$lib/stores/snackbar'
import {
  getExamModule,
  isSupportedExamType
} from '$lib/features/examination/core/registry'
import { formatDate } from '$lib/utils/format'
import {
  chartShapeFor,
  codeFor,
  colorFor,
  longNameFor,
  type ClientInfo,
  type ExamDetail,
  type MaterialGroup,
  type MemberInfo,
  type ResultCard
} from './materials'
import type { AssetItem, RawAsset } from './report-assets'

export function createReportData() {
  let exams = $state<ExamDetail[]>([])
  let client = $state<ClientInfo | null>(null)
  // 검사자는 검사마다 다를 수 있어 id → 멤버로 보관
  let examiners = $state<Record<string, MemberInfo>>({})
  let loaded = $state(false)
  let assets = $state<AssetItem[]>([])
  let assetsLoading = $state(false)

  // 한 번만 로드 — 반응형일 필요가 없어 $state로 두지 않는다
  let initialized = false

  // 표지·서명 등 대표값에 쓰는 진입(첫) 검사
  const primaryExam = $derived<ExamDetail | null>(exams[0] ?? null)
  const primaryExaminer = $derived<MemberInfo | null>(
    primaryExam ? (examiners[primaryExam.examiner_id] ?? null) : null
  )

  // ── 속한 검사 결과 ──
  // 종합보고서에 묶인 모든 검사(배터리 포함)를 표시.
  const examResults = $derived<ResultCard[]>(
    exams.map((ex) => ({
      id: ex.id,
      examType: ex.exam_type,
      type: codeFor(ex.exam_type),
      label: longNameFor(ex.exam_type),
      status: ex.status,
      // 결과 카드 식별용 표시 — '검사일' 같은 라벨이 붙지 않으므로 등록일이
      // 검사일로 읽힐 여지가 없다. 보고서 본문의 날짜는 report-template.ts에서
      // 검사일과 등록일을 나눠 적는다(앵커 개념 제거와 같은 논지).
      date: formatDate(ex.scheduled_at ?? ex.created_at ?? null)
    }))
  )

  // ── 통합 자료 목록 (검사 헤더 + 소속 에셋) ──
  // 검사의 이름·색은 모듈 선언이 단일 출처다(materials.ts 경유).
  const materialGroups = $derived<MaterialGroup[]>(
    [
      ...exams.map((ex) => {
        const card = examResults.find((r) => r.id === ex.id) ?? null
        // 색·모양은 exam_type으로 찾는다. 예전에는 code('HTP'·'로샤')로 조회했는데
        // 표의 키는 'Rorschach'라 로샤만 조용히 폴백(회색)으로 떨어지고 있었다.
        const color = colorFor(ex.exam_type)
        return {
          examId: ex.id,
          code: codeFor(ex.exam_type),
          nameKo: longNameFor(ex.exam_type),
          // 사이드바의 식별용 표시("HTP · 2026.08.18") — 라벨이 붙지 않으므로
          // 등록일이 검사일로 읽힐 여지가 없다.
          date: formatDate(ex.scheduled_at ?? ex.created_at ?? null),
          status: ex.status,
          dotColor: color,
          origin: 'real' as const,
          card,
          items: assets
            .filter((a) => a.examId === ex.id)
            .map((a) => ({
              id: a.id,
              name: a.name,
              kind: a.kind,
              src: a.src,
              table: a.table,
              count: a.count,
              chart: chartShapeFor(ex.exam_type),
              color,
              hint:
                a.kind === 'table' && a.count ? `${a.count}개 항목` : undefined
            }))
        }
      }),
      // 목업 표준화 검사(TCI·MMPI-2·S-척도)를 걷어냈다 (2026-09-10).
      // 배터리가 윤도현의 실검사 3종(로샤·HTP·SCT)이라, 실시된 적 없는 검사가
      // 자료 목록에 서면 화면과 시드가 어긋난다. mock-materials.ts 주석이 적어둔
      // 제거 경로 그대로 — MOCK_MATERIALS 전개와 groupRank 정렬만 뺀다.
    ]
  )

  /**
   * 각 검사 결과에서 에셋 추출.
   *
   * 무엇을 뽑을지는 검사가 안다 — 예전에는 exam_type if-체인 아래로 세 검사의
   * 추출 로직 135줄과 검사 고유 어휘(클러스터명·해석 카테고리·그림 라벨)가
   * 화면에 그대로 있었다. 새 검사를 붙일 때 모듈만 봐서는 여기를 고쳐야
   * 하는지 알 수 없었다.
   */
  async function loadAssets(instId: string, exs: ExamDetail[]) {
    assetsLoading = true
    try {
      const all: AssetItem[] = []
      for (const ex of exs) {
        try {
          const load = isSupportedExamType(ex.exam_type)
            ? getExamModule(ex.exam_type).loadReportAssets
            : undefined
          const items: RawAsset[] = load ? await load(instId, ex.id) : []
          // 검사별 섹션 그룹핑용 메타 부착 (id 충돌 방지)
          const typeLabel = codeFor(ex.exam_type)
          for (const it of items) {
            all.push({
              ...it,
              id: `${ex.id}:${it.id}`,
              examId: ex.id,
              examLabel: typeLabel
            })
          }
        } catch (err) {
          console.error(`[report assets] ${ex.exam_type}(${ex.id}) 실패`, err)
        }
      }
      assets = all
    } finally {
      assetsLoading = false
    }
  }

  /**
   * 검사·내담자·검사자를 불러온다. 실패해도 finally에서 loaded를 세워
   * 화면이 로딩 문구에 갇히지 않게 한다.
   *
   * @param onLoaded 데이터가 자리잡은 뒤 — 화면이 템플릿을 조립할 지점
   */
  async function load(instId: string, ids: string[], onLoaded: () => void) {
    try {
      // 선택된 모든 검사 병렬 로드 (일부 실패해도 나머지는 표시)
      const loadedExams = await Promise.all(
        ids.map((id) =>
          get<ExamDetail>(`/institutions/${instId}/examinations/${id}`).catch(
            () => null
          )
        )
      )
      exams = loadedExams.filter((e): e is ExamDetail => e !== null)
      if (exams.length === 0) throw new Error('로드된 검사가 없습니다.')

      // 내담자: 종합보고서는 동일 내담자 대상 — 첫 검사 기준으로 로드
      client = await get<ClientInfo>(
        `/institutions/${instId}/clients/${exams[0].client_id}`
      ).catch(() => null)

      // 검사자: 검사별로 다를 수 있으므로 고유 id만 병렬 로드
      const uniqueExaminerIds = [...new Set(exams.map((e) => e.examiner_id))]
      const members = await Promise.all(
        uniqueExaminerIds.map((mid) =>
          get<MemberInfo>(`/institutions/${instId}/members/${mid}`)
            .then((m) => [mid, m] as const)
            .catch(() => null)
        )
      )
      examiners = Object.fromEntries(
        members.filter((m): m is readonly [string, MemberInfo] => m !== null)
      )

      // 에셋은 표지 렌더를 막지 않도록 백그라운드
      void loadAssets(instId, exams)
    } catch (err) {
      console.error('[report load] 실패', err)
      snackbarStore.error('검사 정보를 불러오지 못했습니다.')
    } finally {
      onLoaded()
      loaded = true
    }
  }

  /** 기관·검사 id가 준비되면 한 번만 로드한다 (재호출은 무시) */
  function loadOnce(
    instId: string | null | undefined,
    ids: string[] | undefined,
    onLoaded: () => void
  ) {
    if (!instId || !ids?.length || initialized) return
    initialized = true
    void load(instId, ids, onLoaded)
  }

  return {
    get exams() {
      return exams
    },
    get client() {
      return client
    },
    get examiners() {
      return examiners
    },
    get primaryExaminer() {
      return primaryExaminer
    },
    get loaded() {
      return loaded
    },
    get assets() {
      return assets
    },
    get assetsLoading() {
      return assetsLoading
    },
    get materialGroups() {
      return materialGroups
    },
    loadOnce
  }
}

export type ReportData = ReturnType<typeof createReportData>
