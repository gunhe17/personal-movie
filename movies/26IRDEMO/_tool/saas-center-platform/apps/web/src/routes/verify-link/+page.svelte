<style>
  .link-shell {
    min-height: 100dvh;
    background: var(--color-white);
    display: flex;
    flex-direction: column;
    padding: env(safe-area-inset-top) 24px
      max(24px, env(safe-area-inset-bottom));
  }
  .link-brand {
    width: 100%;
    max-width: 440px;
    margin: 0 auto;
    height: 72px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-body-default);
  }
  .link-brand img {
    width: 24px;
    height: 24px;
  }
  .brand-caption {
    margin-left: auto;
    color: var(--color-body-subtle);
  }
  .link-main {
    width: 100%;
    max-width: 440px;
    margin: 0 auto;
    flex: 1;
    padding-bottom: 40px;
  }
  .screen-enter {
    animation: screen-in 360ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .question-page {
    animation: question-in 260ms ease-out both;
  }
  .question {
    scroll-margin-top: 112px;
  }
  @keyframes question-in {
    from {
      opacity: 0;
      transform: translateX(16px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  .eyebrow {
    margin: 40px 0 16px;
    color: var(--color-primary-500);
  }
  .intro {
    color: var(--color-body-subtle);
    line-height: 1.7;
    margin-top: 16px;
  }
  .list-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 44px;
    padding-bottom: 12px;
    color: var(--color-body-subtle);
  }
  .list-heading h2 {
    color: var(--color-body-default);
  }
  .task-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px 16px;
    text-align: left;
    border: 1px solid var(--color-border-subtle);
    border-radius: 16px;
    background: var(--color-white);
    transition:
      opacity 150ms,
      transform 150ms;
  }
  .task-list {
    display: grid;
    gap: 12px;
    margin-top: 16px;
  }
  .task-row.in-progress {
    border-color: var(--color-primary-500);
    background: var(--color-primary-50);
  }
  .task-row.finished {
    background: var(--color-gray-50);
  }
  @media (max-width: 767px) {
    :global(html.barolink-page),
    :global(html.barolink-page body),
    :global(.barolink-surface *) {
      scrollbar-width: none;
    }
    :global(html.barolink-page::-webkit-scrollbar),
    :global(html.barolink-page body::-webkit-scrollbar),
    :global(.barolink-surface *::-webkit-scrollbar) {
      display: none;
    }
  }
  .task-row:hover:not(:disabled) {
    background: var(--color-gray-50);
  }
  .task-index {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 8px;
    color: var(--color-primary-500);
    background: var(--color-primary-50);
  }
  .task-copy {
    flex: 1;
    min-width: 0;
  }
  .task-copy small {
    display: block;
    color: var(--color-body-subtle);
    margin-top: 8px;
  }
  .task-copy small.report-ready {
    color: var(--color-primary-500);
    font-weight: 600;
  }
  .status-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-top: 24px;
    padding: 16px;
    border-radius: 12px;
    background: var(--color-gray-50);
    color: var(--color-body-subtle);
  }
  .task-status {
    display: inline-flex;
    margin-bottom: 8px;
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--color-gray-100);
    color: var(--color-body-subtle);
  }
  .task-status.active {
    background: var(--color-primary-50);
    color: var(--color-primary-500);
  }
  .task-row:disabled .task-index {
    background: var(--color-gray-100);
    color: var(--color-body-subtle);
  }
  .task-arrow {
    color: var(--color-body-subtle);
  }
  .privacy-note,
  .notice {
    color: var(--color-body-subtle);
    line-height: 1.8;
    margin-top: 28px;
  }
  .notice[role='alert'] {
    color: var(--color-status-danger);
  }
  .link-footer {
    display: flex;
    justify-content: center;
    gap: 20px;
    color: var(--color-body-subtle);
    padding-top: 24px;
  }
  .done-mark {
    margin-top: 48px;
    width: 64px;
    height: 64px;
    display: grid;
    place-items: center;
    background: var(--color-primary-50);
    color: var(--color-primary-500);
    border-radius: 50%;
  }
  @keyframes screen-in {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .screen-enter,
    .question-page {
      animation: none;
    }
    .task-row {
      transition: none;
    }
  }
</style>

<script lang="ts">
  import { tick, onMount, onDestroy, untrack } from 'svelte'
  import { afterNavigate, pushState, replaceState } from '$app/navigation'
  import LinkVerification from '$lib/features/assessment/LinkVerification.svelte'
  import Button from '$lib/components/Button.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ArrowLeftLineIcon24 from '$lib/assets/ArrowLeftLineIcon24.svelte'
  import CircleCheckSolidIcon from '$lib/assets/CircleCheckSolidIcon.svelte'
  import { page } from '$app/state'
  import axios from 'axios'
  import defaultLogo from '$lib/assets/DefaultLogoBlue.svg'
  import {
    linkDraftKey,
    readLinkDraft,
    saveLinkDraft
  } from '$lib/features/assessment/link-draft'

  // ── 타입 ──────────────────────────────────────────────

  interface LinkTask {
    task_id: string
    assessment_id: string
    assessment_name: string
    status: string
    execution_method?: string
    schedule_id?: string | null
    report_available?: boolean
  }

  interface LinkSchedule {
    schedule_id: string
    start: string
    end: string
    status: string
    assessment_names: string[]
  }

  interface Question {
    number?: number
    question_number?: number
    text?: string
    question_text?: string
    options?: Array<{ value: number; label?: string } | number | string>
  }

  interface AssessmentInfo {
    code: string
    kor_name: string
    workflow_type: string
    definition: {
      description?: string
      estimated_time?: number
      total_items?: number
      questions?: Question[]
    }
  }

  interface TaskData {
    id: string
    status: string
    workflow_type?: string
    assessment?: AssessmentInfo | null
  }

  type Phase = 'verify' | 'list' | 'exam' | 'done'

  // ── URL 파라미터 ──────────────────────────────────────

  const sendLinkId = $derived(page.url.searchParams.get('send_link_id') ?? '')

  // ── 상태 ──────────────────────────────────────────────

  let phase = $state<Phase>('verify')

  // 인증 phase
  let verifying = $state(false)
  let verifyError = $state('')
  let restoring = $state(true)
  let reportError = $state('')
  let reportLoading = $state('')

  // 인증 세션 (메모리에만 보관 — localStorage 저장 금지)
  let accessToken = $state('')
  let centerName = $state('')
  let recipientName = $state('')
  let tasks = $state<LinkTask[]>([])
  let schedules = $state<LinkSchedule[]>([])
  function scheduleLabel(value: string) {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value))
  }

  // 수행 phase
  let currentTaskId = $state('')
  let task = $state<TaskData | null>(null)
  let taskLoading = $state(false)
  let taskRequest = 0
  let taskError = $state('')
  let responses = $state<Record<number, number>>({})
  let currentPage = $state(1)
  let submitting = $state(false)
  let formRef = $state<HTMLFormElement | null>(null)
  let draftMessage = $state('')
  let draftSaved = $state(false)
  type LinkNavigation = {
    link: string
    phase: Phase
    taskId: string
    step: number
    depth: number
  }
  const navigation = $derived(
    (page.state as { barolink?: LinkNavigation }).barolink
  )
  function navigate(next: Phase, replace = false) {
    const depth =
      next === 'list' || next === 'verify'
        ? 0
        : (navigation?.depth ?? 0) + (replace ? 0 : 1)
    const state = {
      ...page.state,
      barolink: {
        link: sendLinkId,
        phase: next,
        taskId: currentTaskId,
        step: currentPage,
        depth
      }
    }
    if (replace) replaceState(page.url.href, state)
    else pushState(page.url.href, state)
    phase = next
    window.scrollTo(0, 0)
  }
  let navigationReady = $state(false)
  onMount(() => {
    document.documentElement.classList.add('barolink-page')
    return () => document.documentElement.classList.remove('barolink-page')
  })
  let disposed = false
  onDestroy(() => {
    disposed = true
  })
  afterNavigate(async () => {
    if (navigationReady) return
    await tick()
    if (disposed || navigationReady) return
    navigationReady = true
    navigate('verify', true)
    await restoreSession()
  })
  $effect(() => {
    if (!navigationReady) return
    const linkId = sendLinkId
    untrack(() => {
      if (navigation && navigation.link !== linkId) {
        accessToken = ''
        tasks = []
        schedules = []
        task = null
        currentTaskId = ''
        responses = {}
        centerName = ''
        recipientName = ''
        navigate('verify', true)
      }
    })
  })
  $effect(() => {
    if (!navigationReady) return
    const location = navigation
    untrack(() => {
      if (!location || location.link !== sendLinkId) return
      if (!accessToken && location.phase !== 'verify') {
        navigate('verify', true)
        return
      }
      if (
        location.phase === 'exam' &&
        tasks.some(
          (entry) =>
            entry.task_id === location.taskId && isTaskDone(entry.status)
        )
      ) {
        navigate('list', true)
        return
      }
      phase = location.phase
      if (location.phase === 'exam') {
        currentPage = location.step
        void tick().then(() => {
          if (phase === 'exam' && currentPage === location.step)
            formRef
              ?.querySelector('[data-question-number]')
              ?.scrollIntoView({ block: 'start', behavior: 'instant' })
        })
        if (currentTaskId !== location.taskId || (!task && !taskLoading)) {
          currentTaskId = location.taskId
          task = null
          responses = {}
          void loadTask()
        }
      }
    })
  })

  $effect(() => {
    if (phase !== 'exam' || taskLoading || !task || isTaskDone(task.status))
      return
    try {
      saveLinkDraft(sessionStorage, linkDraftKey(sendLinkId, currentTaskId), {
        definition: JSON.stringify(task.assessment?.definition),
        responses,
        page: currentPage
      })
      draftSaved = true
      draftMessage =
        '이 탭에 임시 저장됩니다. 탭을 닫으면 이어서 진행할 수 없습니다.'
    } catch {
      draftSaved = false
      draftMessage =
        '임시 저장하지 못했습니다. 이 화면을 나가면 응답이 사라질 수 있습니다.'
    }
  })

  // ── 목록 파생값 ───────────────────────────────────────

  const DONE_STATUSES = ['submitted', 'completed']

  function isTaskDone(status: string): boolean {
    return DONE_STATUSES.includes(status)
  }
  function taskStatusLabel(status: string) {
    if (status === 'submitted') return '제출 완료'
    if (status === 'completed') return '검사 완료'
    return (
      (
        {
          pending: '예정',
          in_progress: '진행 중',
          cancelled: '취소',
          on_hold: '보류'
        } as Record<string, string>
      )[status] ?? '진행 불가'
    )
  }

  const allDone = $derived(
    tasks.length > 0 && tasks.every((t) => isTaskDone(t.status))
  )
  const remainingCount = $derived(
    tasks.filter((t) => !isTaskDone(t.status)).length
  )

  // ── 수행 파생값 (기존 수행 페이지 로직 재사용) ───────

  const PAGE_SIZE = 5

  const questions = $derived(task?.assessment?.definition?.questions ?? [])
  const supportsQuestionForm = $derived(
    task?.assessment?.workflow_type === 'self_report' &&
      ['pending', 'in_progress'].includes(task?.status ?? '')
  )
  const totalItems = $derived(
    task?.assessment?.definition?.total_items ?? questions.length
  )
  const totalPages = $derived(Math.ceil(questions.length / PAGE_SIZE) || 1)
  const visibleQuestions = $derived(
    questions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  )

  function getQuestionNumber(q: Question, index: number): number {
    return q.number ?? q.question_number ?? index + 1
  }

  const canSubmit = $derived(
    supportsQuestionForm &&
      questions.length > 0 &&
      questions.every((q, i) => responses[getQuestionNumber(q, i)] != null)
  )

  const canProceedToNext = $derived(
    visibleQuestions.every((q, i) => {
      const num = getQuestionNumber(q, (currentPage - 1) * PAGE_SIZE + i)
      return responses[num] != null
    })
  )

  function getQuestionText(q: Question, displayNum: number): string {
    return q.text ?? q.question_text ?? `문항 ${displayNum}`
  }

  const unansweredNumbers = $derived(
    visibleQuestions.flatMap((question, index) => {
      const number = getQuestionNumber(
        question,
        (currentPage - 1) * PAGE_SIZE + index
      )
      return responses[number] == null ? [number] : []
    })
  )
  function focusUnanswered() {
    const input = formRef?.querySelector<HTMLInputElement>(
      `[data-question-number="${unansweredNumbers[0]}"] input`
    )
    input?.focus({ preventScroll: true })
    input
      ?.closest('article')
      ?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }

  function getOptions(q: Question): Array<{ value: number; label: string }> {
    const opts = q.options
    if (!opts || !Array.isArray(opts)) {
      return [
        { value: 1, label: '전혀 그렇지 않다' },
        { value: 2, label: '때때로 그렇다' },
        { value: 3, label: '자주 그렇다' },
        { value: 4, label: '항상 그렇다' }
      ]
    }
    return opts.map((o) => {
      if (typeof o === 'object' && o !== null && 'value' in o) {
        const v = o as { value: number; label?: string }
        return { value: v.value, label: v.label ?? String(v.value) }
      }
      const num = typeof o === 'number' ? o : parseInt(String(o), 10)
      return { value: num, label: String(o) }
    })
  }

  async function setResponse(questionNumber: number, value: number) {
    if (submitting) return
    const firstAnswer = responses[questionNumber] == null
    const answeredPage = currentPage
    responses = { ...responses, [questionNumber]: value }
    if (!firstAnswer) return
    await tick()
    if (phase !== 'exam' || currentPage !== answeredPage) return
    const articles = Array.from(
      formRef?.querySelectorAll<HTMLElement>('[data-question-number]') ?? []
    )
    const currentIndex = articles.findIndex(
      (article) => Number(article.dataset.questionNumber) === questionNumber
    )
    const next = articles
      .slice(currentIndex + 1)
      .find(
        (article) => responses[Number(article.dataset.questionNumber)] == null
      )
    const target =
      next ?? formRef?.querySelector<HTMLElement>('[data-exam-actions]')
    target?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start'
    })
  }

  // ── 인증 ──────────────────────────────────────────────

  async function restoreSession() {
    const link = sendLinkId
    restoring = true
    reportError = ''
    try {
      if (!link) return
      const response = await fetch(`/api/barolink/${link}/session`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000)
      })
      if (disposed || sendLinkId !== link) return
      if ([400, 401, 403, 404, 422].includes(response.status)) {
        accessToken = ''
        navigate('verify', true)
        return
      }
      if (!response.ok)
        throw new Error(
          '인증 상태를 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해주세요.'
        )
      const data = await response.json()
      if (disposed || sendLinkId !== link) return
      if (!data.session_active)
        throw new Error('인증 상태를 확인하지 못했어요.')
      accessToken = 'cookie-session'
      centerName = data.center_name ?? ''
      recipientName = data.recipient_name ?? ''
      tasks = data.tasks ?? []
      schedules = data.schedules ?? []
      navigate('list', true)
    } catch {
      if (!disposed && sendLinkId === link) {
        verifyError =
          '인증 상태를 불러오지 못했어요. 연결을 확인하거나 번호로 다시 인증해주세요.'
        if (phase === 'list')
          reportError =
            '목록을 새로 불러오지 못했어요. 잠시 후 다시 시도해주세요.'
      }
    } finally {
      if (!disposed && sendLinkId === link) restoring = false
    }
  }

  async function openReport(entry: LinkTask) {
    if (reportLoading || !entry.report_available) return
    reportLoading = entry.task_id
    reportError = ''
    const popup = window.open('', '_blank')
    if (popup) popup.opener = null
    try {
      if (!popup)
        throw new Error('팝업을 허용한 뒤 결과 보기를 다시 눌러주세요.')
      const response = await fetch(
        `/api/barolink/${sendLinkId}/tasks/${entry.task_id}/report`,
        { cache: 'no-store', signal: AbortSignal.timeout(15000) }
      )
      if (!response.ok)
        throw new Error(
          '결과를 열 수 없어요. 인증이 만료되었거나 공개 상태가 변경되었을 수 있어요. 새로고침 후 확인해주세요.'
        )
      const data = await response.json()
      const url = new URL(data.download_url)
      if (!['https:', 'http:'].includes(url.protocol))
        throw new Error('결과 주소를 확인하지 못했어요.')
      popup.location.replace(url.href)
    } catch (error) {
      popup?.close()
      reportError =
        error instanceof Error ? error.message : '결과를 열지 못했어요.'
    } finally {
      reportLoading = ''
    }
  }

  async function verifyCode(value: string) {
    if (verifying) throw new Error('인증을 확인하고 있습니다.')
    if (!sendLinkId)
      throw new Error('문자에 있는 바로링크로 다시 접속해주세요.')
    verifying = true
    verifyError = ''
    try {
      const res = await axios.post(
        `/api/barolink/${sendLinkId}/verify`,
        { verification_code: value },
        { timeout: 15000 }
      )
      const data = res.data?.data ?? res.data
      if (!data?.session_active && !data?.access_token)
        throw new Error('인증 응답을 확인하지 못했습니다. 다시 시도해주세요.')
      accessToken = 'cookie-session'
      centerName = data.center_name ?? ''
      recipientName = data.recipient_name ?? ''
      tasks = data.tasks ?? []
      schedules = data.schedules ?? []
    } catch (cause) {
      const failure = cause as {
        response?: {
          status?: number
          data?: {
            detail?: unknown
            meta?: { message?: string }
            message?: string
          }
        }
      }
      const status = failure.response?.status
      const payload = failure.response?.data
      const detail =
        typeof payload?.detail === 'string'
          ? payload.detail
          : (payload?.meta?.message ?? payload?.message)
      if (status === 404)
        throw new Error(
          '유효하지 않은 링크예요. 가장 최근 문자에 있는 링크를 확인해주세요.'
        )
      if (status && status >= 500)
        throw new Error(
          '서버 연결에 문제가 생겼어요. 잠시 후 다시 시도해주세요.'
        )
      if (!status && !(cause instanceof Error && !('isAxiosError' in cause)))
        throw new Error('연결을 확인한 뒤 다시 시도해주세요.')
      throw new Error(
        detail ||
          (cause instanceof Error
            ? cause.message
            : '인증을 확인하지 못했습니다.')
      )
    } finally {
      verifying = false
    }
  }

  // ── 검사 시작 / 조회 ─────────────────────────────────

  function startTask(t: LinkTask) {
    if (t.execution_method === 'onsite') return
    if (!['pending', 'in_progress'].includes(t.status)) return
    currentTaskId = t.task_id
    task = null
    responses = {}
    currentPage = 1
    taskError = ''
    draftMessage = ''
    draftSaved = false
    navigate('exam')
    void loadTask()
  }

  async function loadTask() {
    const request = ++taskRequest
    const requestedTaskId = currentTaskId
    taskLoading = true
    taskError = ''
    try {
      const res = await fetch(
        `/api/barolink/${sendLinkId}/tasks/${currentTaskId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (
        request !== taskRequest ||
        phase !== 'exam' ||
        requestedTaskId !== currentTaskId
      )
        return
      if (res.status === 401) {
        accessToken = ''
        verifyError =
          '인증 시간이 지났습니다. 다시 인증하면 이 탭의 임시 응답을 이어갈 수 있습니다.'
        navigate('verify', true)
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          err.detail ?? err.message ?? '검사 조회에 실패했습니다.'
        )
      }
      const raw = await res.json()
      if (
        request !== taskRequest ||
        phase !== 'exam' ||
        requestedTaskId !== currentTaskId
      )
        return
      task = raw?.assessment ? raw : (raw?.data ?? raw)
      if (task && isTaskDone(task.status)) {
        tasks = tasks.map((entry) =>
          entry.task_id === currentTaskId
            ? { ...entry, status: task!.status }
            : entry
        )
        try {
          sessionStorage.removeItem(linkDraftKey(sendLinkId, currentTaskId))
        } catch {}
        navigate('done', true)
        return
      }
      try {
        const draft = readLinkDraft(
          sessionStorage,
          linkDraftKey(sendLinkId, currentTaskId),
          JSON.stringify(task?.assessment?.definition)
        )
        if (draft) {
          responses = draft.responses
          const restoredPage = Math.min(draft.page, totalPages)
          currentPage = 1
          navigate('exam', true)
          for (let step = 2; step <= restoredPage; step += 1) {
            currentPage = step
            navigate('exam')
          }
        }
      } catch {
        draftMessage = '임시 응답을 읽지 못했습니다.'
      }

      // pending → in_progress 자동 전환 반영
      tasks = tasks.map((t) =>
        t.task_id === currentTaskId && t.status === 'pending'
          ? { ...t, status: 'in_progress' }
          : t
      )
    } catch (e) {
      if (request === taskRequest)
        taskError = e instanceof Error ? e.message : '검사 조회에 실패했습니다.'
    } finally {
      if (request === taskRequest) taskLoading = false
    }
  }

  // ── 제출 ──────────────────────────────────────────────

  async function handleSubmit() {
    if (!canSubmit || submitting) return
    submitting = true
    const submittedTaskId = currentTaskId
    taskError = ''
    try {
      const statusResponse = await fetch(
        `/api/barolink/${sendLinkId}/tasks/${submittedTaskId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(15000)
        }
      )
      if (phase !== 'exam' || currentTaskId !== submittedTaskId) return
      if (statusResponse.status === 401) {
        accessToken = ''
        verifyError =
          '인증 시간이 지났어요. 다시 인증한 뒤 임시 응답을 확인하고 제출해주세요.'
        navigate('verify', true)
        return
      }
      if (!statusResponse.ok)
        throw new Error(
          '최신 제출 상태를 확인하지 못했어요. 응답은 유지되니 목록에서 상태를 확인한 뒤 다시 시도해주세요.'
        )
      const statusRaw = await statusResponse.json()
      const latest = statusRaw?.data ?? statusRaw
      if (isTaskDone(latest.status)) {
        completeSubmission(submittedTaskId, latest)
        return
      }
      if (!['pending', 'in_progress'].includes(latest.status))
        throw new Error(
          '현재 진행할 수 없는 검사예요. 목록으로 돌아가 센터에 확인해주세요.'
        )
      if (
        latest.assessment?.workflow_type !== 'self_report' ||
        JSON.stringify(latest.assessment?.definition) !==
          JSON.stringify(task?.assessment?.definition)
      )
        throw new Error(
          '검사 내용이 변경됐어요. 목록에서 검사를 다시 열어 확인해주세요.'
        )
      const payload = {
        workflow_type: 'self_report',
        responses: Object.entries(responses)
          .filter(([, v]) => v != null)
          .map(([qn, v]) => ({
            question_number: parseInt(qn, 10),
            answer_value: v
          }))
          .sort((a, b) => a.question_number - b.question_number),
        current_item: totalItems
      }
      const res = await fetch(
        `/api/barolink/${sendLinkId}/tasks/${currentTaskId}/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30000)
        }
      )
      if (res.status === 401) {
        accessToken = ''
        verifyError = draftSaved
          ? '인증 시간이 지났습니다. 다시 인증한 뒤 임시 응답을 확인하고 제출해주세요.'
          : '인증 시간이 지났고 임시 저장을 확인하지 못했습니다. 다시 인증해주세요.'
        navigate('verify', true)
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          err.detail ?? err.message ?? '검사 제출에 실패했습니다.'
        )
      }

      const submitted = await res.json().catch(() => null)
      completeSubmission(submittedTaskId, submitted?.data ?? submitted)
    } catch (e) {
      taskError =
        e instanceof Error &&
        !(e instanceof TypeError) &&
        !['TimeoutError', 'AbortError'].includes(e.name)
          ? e.message
          : '제출 결과를 확인하지 못했어요. 응답은 유지되며 다시 제출하면 서버 상태를 먼저 확인해요.'
    } finally {
      submitting = false
    }
  }

  function completeSubmission(
    submittedTaskId: string,
    result?: {
      status?: string
      report_document_id?: string | null
      is_report_visible_to_guardian?: boolean
    } | null
  ) {
    tasks = tasks.map((t) =>
      t.task_id === submittedTaskId
        ? {
            ...t,
            status: result?.status === 'completed' ? 'completed' : 'submitted',
            report_available:
              result?.status === 'completed' &&
              !!result.report_document_id &&
              result.is_report_visible_to_guardian === true
          }
        : t
    )
    if (phase === 'exam' && currentTaskId === submittedTaskId)
      navigate('done', true)
    try {
      sessionStorage.removeItem(linkDraftKey(sendLinkId, submittedTaskId))
      draftMessage = ''
    } catch {
      draftMessage =
        '제출은 완료됐지만 임시 응답을 지우지 못했습니다. 사용 후 이 탭을 닫아주세요.'
    }
  }

  // ── 이동 ──────────────────────────────────────────────

  function backToList() {
    taskError = ''
    navigate('list', true)
  }

  function handleExitExam() {
    const answered = Object.keys(responses).length > 0
    if (
      !answered ||
      window.confirm(
        draftSaved
          ? '목록으로 돌아갈까요? 같은 탭에서 임시 응답을 이어갈 수 있습니다.'
          : '검사를 중단하고 목록으로 돌아갈까요?\n입력한 응답은 저장되지 않을 수 있습니다.'
      )
    ) {
      backToList()
    }
  }
</script>

<svelte:head>
  <title>바로링크 | 마인드스코프</title>
</svelte:head>

{#if phase === 'exam'}
  <!-- ═══ 수행 phase: 기존 수행 페이지와 동일한 문항 렌더·페이징·제출 ═══ -->
  <div
    class="barolink-surface screen-enter min-h-screen min-h-[100dvh] flex flex-col bg-gray-100"
  >
    <header
      class="sticky top-0 z-10 border-b border-gray-200 bg-white shrink-0"
    >
      <div
        class="mx-auto flex min-h-14 w-full max-w-4xl items-center gap-3 px-3 sm:px-6"
      >
        <button
          type="button"
          onclick={handleExitExam}
          aria-label="검사 목록으로"
          disabled={submitting}
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-body-subtle focus-visible:outline-2 focus-visible:outline-primary-500"
          ><ArrowLeftLineIcon24 color="currentColor" /></button
        >
        <div class="min-w-0 flex-1">
          <Typography
            tag="h1"
            variant="body-01-normal-medium"
            color="text-title-default"
            className="break-words py-3"
            >{task?.assessment?.kor_name ?? '검사'}</Typography
          >
        </div>
        {#if task && !taskLoading}<span
            class="shrink-0 text-body-03-normal-medium text-body-subtle"
            aria-label="검사 페이지">{currentPage} / {totalPages}</span
          >{/if}
      </div>
    </header>

    <main class="flex-1 flex flex-col min-h-0">
      {#if draftMessage && !draftSaved}<p
          role="status"
          class="bg-gray-50 px-4 py-3 text-center text-sm text-gray-600"
        >
          {draftMessage}
        </p>{/if}
      {#if taskLoading}
        <div
          class="flex flex-1 items-center justify-center text-center text-gray-600"
        >
          검사를 불러오는 중입니다...
        </div>
      {:else if taskError && !task}
        <div class="flex flex-1 items-center justify-center p-8">
          <div
            class="rounded-lg bg-white border border-gray-200 p-8 text-center max-w-md"
          >
            <p class="text-sm text-red-600 mb-6">{taskError}</p>
            <Button
              type="button"
              onclick={backToList}
              color="tertiary"
              size="lg"
            >
              목록으로
            </Button>
          </div>
        </div>
      {:else if task && questions.length > 0 && supportsQuestionForm}
        <form
          bind:this={formRef}
          class="flex flex-1 flex-col min-h-0 min-w-0 bg-white"
          onsubmit={async (e) => {
            e.preventDefault()
            if (submitting) return
            if (currentPage < totalPages) {
              if (!canProceedToNext) return
              currentPage += 1
              navigate('exam')
              await tick()
              formRef?.scrollTo(0, 0)
              window.scrollTo(0, 0)
              formRef
                ?.querySelector('[data-question-number]')
                ?.scrollIntoView({ block: 'start', behavior: 'instant' })
            } else {
              handleSubmit()
            }
          }}
        >
          {#key currentPage}
            <section
              class="question-page flex flex-1 flex-col items-center bg-white sm:bg-gray-100 px-5 sm:px-6 md:px-10 pt-8 sm:pt-10 w-full min-w-0 pb-[max(24px,env(safe-area-inset-bottom))]"
            >
              <div
                class="mx-auto w-full max-w-4xl bg-white sm:px-8 sm:pt-8 sm:rounded-2xl min-w-0"
              >
                {#each visibleQuestions as q, idx (q.number ?? q.question_number ?? (currentPage - 1) * PAGE_SIZE + idx)}
                  {@const qNum = getQuestionNumber(
                    q,
                    (currentPage - 1) * PAGE_SIZE + idx
                  )}
                  <article
                    data-question-number={qNum}
                    class={`question flex flex-col gap-6 ${visibleQuestions.length - 1 === idx ? '' : 'border-b border-gray-200'} py-8 first:pt-0`}
                  >
                    <p
                      id="question-{qNum}"
                      class="min-w-0 text-body-01-reading-medium text-gray-800 break-keep"
                    >
                      {qNum}. {getQuestionText(q, qNum)}
                    </p>
                    <div
                      role="radiogroup"
                      aria-labelledby="question-{qNum}"
                      class="grid w-full grid-cols-1 min-[360px]:grid-cols-2 gap-3 sm:grid-cols-4"
                    >
                      {#each getOptions(q) as opt}
                        {@const isSelected = responses[qNum] === opt.value}
                        <label
                          class="flex min-w-0 items-center gap-3 p-3 cursor-pointer select-none min-h-16 border touch-manipulation has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary-500 rounded-xl {isSelected
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 bg-white'}"
                        >
                          <span
                            class="min-w-0 flex-1 text-body-03-reading-regular text-gray-800 break-words"
                          >
                            {opt.label}
                          </span>
                          <span
                            class="order-first inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors {isSelected
                              ? 'border-primary-500 bg-primary-500'
                              : 'border-gray-300 bg-white'}"
                            aria-hidden="true"
                          >
                            {#if isSelected}
                              <svg
                                class="h-5 w-5 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2.5"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            {/if}
                          </span>
                          <input
                            type="radio"
                            disabled={submitting}
                            name="task-{currentTaskId}-q{qNum}"
                            value={opt.value}
                            checked={isSelected}
                            onchange={() => setResponse(qNum, opt.value)}
                            class="sr-only"
                          />
                        </label>
                      {/each}
                    </div>
                  </article>
                {/each}
                {#if taskError}
                  <p role="alert" class="text-sm text-red-600 mt-4">
                    {taskError}
                  </p>
                {/if}
              </div>
              {#if unansweredNumbers.length}
                <div
                  class="mt-6 w-full max-w-4xl border-t border-gray-200 pt-6 text-body-03-normal-regular text-body-subtle"
                  role="status"
                >
                  <p>
                    이 페이지에 답하지 않은 문항이 {unansweredNumbers.length}개
                    있어요.
                  </p>
                  <button
                    type="button"
                    class="min-h-11 text-primary-500 underline"
                    onclick={focusUnanswered}
                    >{unansweredNumbers[0]}번 문항으로 이동</button
                  >
                </div>
              {/if}
              <div
                data-exam-actions
                class="mt-6 w-full max-w-4xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-4 min-w-0 pb-2"
              >
                <button
                  type="button"
                  disabled={submitting}
                  onclick={handleExitExam}
                  class="order-2 md:order-1 min-h-[44px] text-sm text-gray-600 hover:text-gray-800 underline underline-offset-2 py-2 touch-manipulation self-center"
                >
                  검사 나가기
                </button>
                <div
                  class="order-1 md:order-2 flex flex-wrap gap-3 justify-end"
                >
                  {#if currentPage > 1}
                    <Button
                      type="button"
                      disabled={submitting}
                      onclick={() => window.history.back()}
                      color="tertiary"
                      size="lg"
                      class="flex-1 sm:flex-initial"
                    >
                      이전
                    </Button>
                  {/if}
                  {#if currentPage < totalPages}
                    <Button
                      type="submit"
                      disabled={!canProceedToNext}
                      class="flex-1 sm:flex-initial"
                      size="lg"
                    >
                      다음
                    </Button>
                  {:else}
                    <Button
                      type="submit"
                      disabled={!canSubmit || submitting}
                      class="flex-1 sm:flex-initial"
                      size="lg"
                    >
                      {submitting ? '제출 중...' : '제출'}
                    </Button>
                  {/if}
                </div>
              </div>
            </section>
          {/key}
        </form>
      {:else}
        <div class="flex flex-1 items-center justify-center p-8">
          <div
            class="rounded-lg bg-white border border-gray-200 p-8 text-center max-w-md"
          >
            <p class="text-sm text-gray-600 mb-6">
              {task && !supportsQuestionForm
                ? '이 검사는 현재 바로링크의 문항 화면에서 진행할 수 없어요. 진행 방법을 센터에 확인해주세요.'
                : '문항 정보를 불러올 수 없어요. 센터에 확인해주세요.'}
            </p>
            <Button
              type="button"
              onclick={backToList}
              color="tertiary"
              size="lg"
            >
              목록으로
            </Button>
          </div>
        </div>
      {/if}
    </main>
  </div>
{:else}
  <div class="barolink-surface link-shell">
    <header class="link-brand text-body-02-normal-semibold">
      <img src={defaultLogo} alt="" /><span>마인드스코프</span>
      {#if phase === 'list'}
        <button
          type="button"
          class="brand-caption min-h-11 text-body-03-normal-medium underline"
          disabled={restoring}
          onclick={() => restoreSession()}
          >{restoring ? '불러오는 중…' : '목록 새로고침'}</button
        >
      {/if}
    </header>
    <main class="link-main">
      {#key phase}
        <div class="screen-enter">
          {#if !sendLinkId}
            <Typography
              tag="h1"
              variant="headline-01-reading-semibold"
              color="text-title-default"
              className="leading-normal">링크를 확인해주세요</Typography
            >
            <p class="intro text-body-02-reading-regular">
              문자에 있는 바로링크로 다시 접속해주세요.
            </p>
          {:else if phase === 'verify'}
            {#if restoring}
              <p role="status" class="notice">인증 상태를 확인하고 있어요…</p>
            {:else}
              <LinkVerification
                verify={verifyCode}
                onVerified={() => navigate('list', true)}
              />
            {/if}
            {#if verifyError}<p
                role="alert"
                class="notice text-body-03-reading-regular"
              >
                {verifyError}
              </p>{/if}
          {:else if phase === 'done'}
            <div class="done-mark" aria-hidden="true">
              <CircleCheckSolidIcon class="h-16 w-16 text-primary-500" />
            </div>
            <p class="eyebrow text-body-02-normal-medium">제출 완료</p>
            <Typography
              tag="h1"
              variant="headline-01-reading-semibold"
              color="text-title-default"
              >수고하셨어요.<br />응답을 잘 받았어요</Typography
            >
            <p class="intro">
              {remainingCount > 0
                ? `이어서 진행할 검사가 ${remainingCount}개 있어요.`
                : '안내받은 검사를 모두 마쳤어요.'}
            </p>
            {#if draftMessage}<p role="status" class="notice">
                {draftMessage}
              </p>{/if}
            <Button class="mt-8 w-full" size="xl" onclick={backToList}
              >검사 목록으로</Button
            >
          {:else}
            <p class="eyebrow">{centerName || '나의 검사'}</p>
            <Typography
              tag="h1"
              variant="headline-01-reading-semibold"
              color="text-title-default"
              >{allDone ? '검사를 모두 마쳤어요' : '나의 검사'}</Typography
            >
            <p class="intro">
              {allDone
                ? '제출한 검사는 목록에서 확인할 수 있어요.'
                : '진행할 검사를 선택해주세요. 작성 중인 검사는 이어서 할 수 있어요.'}
            </p>
            {#if schedules.length}
              <section class="mt-8 space-y-3" aria-label="방문 검사 일정">
                <Typography
                  tag="h2"
                  variant="body-01-normal-medium"
                  color="text-title-default">방문 일정</Typography
                >
                {#each schedules as schedule (schedule.schedule_id)}
                  <div class="rounded-xl border border-gray-200 p-4 space-y-2">
                    <p class="text-body-01-reading-medium text-title-default">
                      {scheduleLabel(schedule.start)}
                    </p>
                    <p class="text-body-03-reading-regular text-body-subtle">
                      {schedule.assessment_names.join(' · ')}
                    </p>
                    <p class="text-body-03-reading-regular text-body-subtle">
                      {schedule.status === 'cancelled'
                        ? '취소된 방문 일정이에요.'
                        : schedule.status === 'attended'
                          ? '방문 완료'
                          : schedule.status === 'no_show'
                            ? '미참석'
                            : '일정 변경이 필요하면 센터에 문의해주세요.'}
                    </p>
                  </div>
                {/each}
              </section>
            {/if}
            <div class="list-heading text-body-02-normal-medium">
              <h2>검사 목록</h2>
              <span>{tasks.length}개</span>
            </div>
            {#if tasks.length}
              <div
                class="status-summary text-body-03-normal-medium"
                aria-label="검사 상태 요약"
              >
                <span
                  >예정 {tasks.filter((entry) => entry.status === 'pending')
                    .length}</span
                >
                <span
                  >진행 중 {tasks.filter(
                    (entry) => entry.status === 'in_progress'
                  ).length}</span
                >
                <span
                  >완료 {tasks.filter((entry) => isTaskDone(entry.status))
                    .length}</span
                >
              </div>
            {/if}
            {#if !tasks.length}<p class="notice">
                안내된 검사가 없습니다. 센터에 확인해주세요.
              </p>{/if}
            {#if reportError}<p role="alert" class="notice">
                {reportError}
              </p>{/if}
            <div class="task-list">
              {#each tasks as entry, index (entry.task_id)}
                <button
                  class="task-row"
                  class:in-progress={entry.status === 'in_progress'}
                  class:finished={isTaskDone(entry.status)}
                  disabled={!entry.report_available &&
                    (entry.execution_method === 'onsite' ||
                      !['pending', 'in_progress'].includes(entry.status))}
                  onclick={() =>
                    entry.report_available
                      ? openReport(entry)
                      : startTask(entry)}
                >
                  <span class="task-index text-body-03-normal-medium"
                    >{isTaskDone(entry.status)
                      ? '✓'
                      : String(index + 1).padStart(2, '0')}</span
                  >
                  <span class="task-copy">
                    <span
                      class="task-status text-body-03-normal-medium"
                      class:active={entry.status === 'in_progress'}
                      >{taskStatusLabel(entry.status)}</span
                    >
                    {#if entry.execution_method === 'onsite'}<span
                        class="ml-2 text-body-03-normal-regular text-body-subtle"
                        >센터 방문</span
                      >{/if}
                    <Typography
                      tag="span"
                      variant="body-01-reading-medium"
                      color="text-body-default"
                      className="block break-words"
                      >{entry.assessment_name}</Typography
                    ><small class:report-ready={entry.report_available}
                      >{entry.execution_method === 'onsite' &&
                      !isTaskDone(entry.status)
                        ? entry.schedule_id
                          ? '방문 일정을 확인해주세요'
                          : '방문 일정은 센터에 확인해주세요'
                        : isTaskDone(entry.status)
                          ? entry.report_available
                            ? '결과 보기 · PDF'
                            : entry.status === 'submitted'
                              ? '제출 완료 · 결과 준비 중'
                              : '검사 완료 · 결과 공개 대기'
                          : entry.status === 'in_progress'
                            ? '이어서 진행할 수 있어요'
                            : entry.status === 'pending'
                              ? '준비되면 시작해주세요'
                              : entry.status === 'cancelled'
                                ? '취소된 검사'
                                : '현재 진행할 수 없어요'}</small
                    ></span
                  >
                  {#if entry.execution_method !== 'onsite' && ['pending', 'in_progress'].includes(entry.status)}<span
                      class="task-arrow"
                      aria-hidden="true">›</span
                    >{/if}
                </button>
              {/each}
            </div>
            {#if !allDone}<p class="privacy-note text-body-03-reading-regular">
                응답은 이 탭에 임시 저장됩니다.<br />진행 중에는 탭을 닫지
                말아주세요.
              </p>{/if}
          {/if}
        </div>
      {/key}
    </main>
    <footer class="link-footer text-caption-01-normal-regular">
      <a href="/terms">이용약관</a><a href="/privacy">개인정보처리방침</a>
    </footer>
  </div>
{/if}
