/**
 * 검사 진행 화면 공통 컨텍스트 — 검사 메타(exam/client) 로드 + 단계 상태.
 *
 * 이전에는 검사마다 +layout.svelte에 같은 112줄이 복사돼 있었다
 * (HTP와 SCT의 실질 차이는 파라미터 이름과 타입 문자열 2곳뿐이었다).
 * 여기 하나로 합치고, 검사별 차이는 모듈 선언이 담당한다.
 */
import { getContext, setContext } from 'svelte'
import { goto } from '$app/navigation'
import { get } from '$lib/services/api/instances'
import { snackbarStore } from '$lib/stores/snackbar'
import { gateFrom, stepNeighbors } from './module'
import type { ExamGate, ExamModule, ExamProgress, ExamStep } from './module'
import type { ExamStatus } from '../common/constants'
import type { SidebarStep } from './ExamLayoutShell.svelte'

export interface ExamDetail {
  id: string
  client_id: string
  examiner_id: string
  exam_type: string
  status: string
  scheduled_at?: string | null
  created_at?: string
  /** 서버가 서브모듈을 보고 계산해 준다. 단계 진입 판정의 근거. */
  progress?: ExamProgress | null
}

export interface ClientInfo {
  id: string
  name: string
  birth_date: string | null
  gender: string | null
}

export interface ExamContext {
  readonly exam: ExamDetail | null
  readonly client: ClientInfo | null
  readonly isLoading: boolean
  readonly module: ExamModule
  /** 단계 진입 판정 입력 (status + progress) */
  readonly gate: ExamGate
  /** 현재 상태 기준 사이드바 단계 목록 (셸에 그대로 넘긴다) */
  readonly steps: SidebarStep[]
  /**
   * 현재 단계의 앞/뒤 이웃 — 푸터 '이전'·'다음' 버튼용.
   *
   * 진입 가능한 것만 온다. null이면 그 방향으로 갈 곳이 없다는 뜻이므로
   * 버튼을 감춘다. 경로는 goTo로 이동한다.
   */
  readonly neighbors: { prev: ExamStep | null; next: ExamStep | null }
  /** 단계로 이동한다 — 경로 조립을 화면마다 반복하지 않는다. */
  goTo(step: ExamStep): void
  /**
   * 검사 상태 — core/status.ts 술어에 바로 넘길 수 있는 타입.
   *
   * ExamDetail.status는 서버 응답이라 string이다. 화면마다 `as ExamStatus`를
   * 뿌리면 캐스팅이 흩어지므로 여기서 한 번만 좁힌다. exam이 아직 없으면
   * 'created' — 어떤 단계도 열리지 않는 가장 보수적인 값이다.
   */
  readonly status: ExamStatus
  refreshExam(): Promise<void>
  /**
   * 활성 단계의 일시 작업 표시 — 사이드바 뱃지를 덮어쓴다.
   *
   * 'AI 분석 중'처럼 서버 상태(status·progress)에는 남지 않고 화면이 도는 동안만
   * 참인 것들이다. 예전에는 SCT Review만 layoutCtx.steps를 손으로 map해 뱃지를
   * 갈아끼웠고 같은 상태인 HTP Collect는 사이드바에 아무 표시가 없었다 —
   * 계약에 자리가 없으니 아는 화면만 각자 처리한 것이다.
   *
   * null이면 평소 뱃지로 돌아간다. 끝나면 반드시 null로 되돌려야 한다.
   */
  setBusy(label: string | null): void
}

const KEY = Symbol('exam-context')

export function setExamContext(ctx: ExamContext) {
  setContext(KEY, ctx)
}

export function getExamContext(): ExamContext {
  const ctx = getContext<ExamContext>(KEY)
  if (!ctx) {
    throw new Error('getExamContext: 검사 layout 안에서만 사용 가능합니다.')
  }
  return ctx
}

interface CreateOptions {
  /** 현재 라우트의 검사 ID */
  examId: () => string
  /** 선택된 기관 ID (없으면 로드를 미룬다) */
  institutionId: () => string | null
  /** 이 라우트가 담당하는 검사 모듈 */
  module: ExamModule
  /** 현재 활성 단계 key */
  activeStep: () => string
  /** +layout.ts가 이미 받아 온 exam — 있으면 초기 조회를 건너뛴다. */
  initialExam?: ExamDetail | null
}

/**
 * 검사 메타를 로드하고 컨텍스트를 구성한다.
 * effect는 호출하는 컴포넌트가 소유한다 — 소유권이 뒤섞이면 정리 시점이 꼬인다.
 */
export function createExamContext(opts: CreateOptions) {
  let exam = $state<ExamDetail | null>(opts.initialExam ?? null)
  let client = $state<ClientInfo | null>(null)
  let isLoading = $state(true)
  let isInitialized = $state(false)
  /** 활성 단계에 덧입힐 일시 작업 라벨 (ExamContext.setBusy 참고) */
  let busyLabel = $state<string | null>(null)

  async function initialize() {
    const instId = opts.institutionId()
    const eId = opts.examId()
    if (!instId || !eId || isInitialized) return

    isLoading = true
    try {
      // exam은 +layout.ts가 이미 받아 왔다. 없을 때만 조회한다.
      const examRes = exam ?? (await get<ExamDetail>(
        `/institutions/${instId}/examinations/${eId}`
      ))
      if (examRes.exam_type !== opts.module.type) {
        snackbarStore.error(`${opts.module.title}가 아닙니다.`)
        goto('/examinations')
        return
      }
      exam = examRes
      client = await get<ClientInfo>(
        `/institutions/${instId}/clients/${examRes.client_id}`
      ).catch(() => null)
      isInitialized = true
    } catch (err) {
      console.error(`[${opts.module.type} layout init] 실패`, err)
      snackbarStore.error('검사 정보를 불러오지 못했습니다.')
    } finally {
      isLoading = false
    }
  }

  async function refreshExam() {
    const instId = opts.institutionId()
    const eId = opts.examId()
    if (!instId || !eId) return
    try {
      exam = await get<ExamDetail>(`/institutions/${instId}/examinations/${eId}`)
    } catch (err) {
      console.error(`[${opts.module.type} refreshExam] 실패`, err)
    }
  }

  /**
   * 단계 판정 입력 — status와 progress를 함께 넘긴다.
   *
   * exam이 아직 로드되기 전이면 created + progress 없음으로 취급된다.
   * 그 상태에서는 어떤 단계도 열리지 않으므로, 가드는 exam이 채워질
   * 때까지 판정을 미뤄야 한다([step]/+page.svelte).
   */
  const gate = $derived<ExamGate>(gateFrom(exam?.status, exam?.progress))

  /** 모듈 선언 + 현재 상태 → 셸이 그릴 사이드바 단계 */
  const steps = $derived.by((): SidebarStep[] => {
    const g = gate
    const active = opts.activeStep()
    const eId = opts.examId()
    const busy = busyLabel

    return opts.module.steps.map((step: ExamStep) => {
      const isActive = step.key === active
      const locked = step.enabled ? !step.enabled(g) : false
      const done = step.done ? step.done(g) : false

      /**
       * 뱃지는 "이 단계가 끝났나"만 말한다 — 검사의 진행 상태 축.
       *
       * 예전에는 active를 먼저 봐서 '진행중'을 씌웠는데, 그러면 확정된 검사에서
       * 결과 화면을 보고 있을 때 '결과 보기: 진행중'이 되고, 완료한 채점 단계를
       * 다시 열면 '완료'였던 게 '진행중'으로 뒤집혔다. 앞 단계가 진행중인데
       * 뒷 단계가 완료로 보이는 역전도 생겼다.
       * "지금 어디를 보고 있나"는 다른 축이고, 활성 행 스타일(회색 면 + 파란
       * 아이콘)이 이미 보여준다. 한 뱃지에 두 축을 섞지 않는다.
       *
       * '이동'도 뺐다 — 상태가 아니라 동작이라 나머지와 층이 다르다.
       * 클릭 가능 여부는 hover로 드러난다.
       */
      return {
        label: step.label,
        icon: step.icon,
        active: isActive,
        locked,
        lockedHint: locked ? step.lockedHint : undefined,
        /**
         * busy는 활성 단계에만, 그리고 다른 판정보다 먼저 얹는다 — '지금 이
         * 화면이 무언가 돌리는 중'이 다른 어떤 표시보다 급한 정보다.
         */
        badge:
          isActive && busy
            ? { label: busy, variant: 'active' as const }
            : done
              ? { label: '완료', variant: 'completed' as const }
              : locked
                ? { label: '잠김', variant: 'pending' as const }
                : isActive
                  ? { label: '진행중', variant: 'active' as const }
                  : { label: '대기', variant: 'pending' as const },
        onClick: () => goto(`/examinations/${eId}/${step.key}`)
      }
    })
  })

  /** 현재 단계의 앞/뒤 — 진입 가능한 것만. 푸터 버튼이 읽는다. */
  const neighbors = $derived(stepNeighbors(opts.module, opts.activeStep(), gate))

  const ctx: ExamContext = {
    get exam() {
      return exam
    },
    get client() {
      return client
    },
    get isLoading() {
      return isLoading
    },
    get module() {
      return opts.module
    },
    get gate() {
      return gate
    },
    get status() {
      return gate.status
    },
    get steps() {
      return steps
    },
    get neighbors() {
      return neighbors
    },
    goTo(step: ExamStep) {
      void goto(`/examinations/${opts.examId()}/${step.key}`)
    },
    refreshExam,
    setBusy(label: string | null) {
      busyLabel = label
    }
  }

  return { ctx, initialize }
}
