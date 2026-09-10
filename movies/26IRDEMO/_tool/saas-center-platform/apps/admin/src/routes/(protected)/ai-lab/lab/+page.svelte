<script lang="ts">
  import { getContext } from 'svelte'
  import { page } from '$app/stores'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { queryBuilder } from '$hooks/queries/builder'
  import type { SelectOptionType } from '$lib/types/common'
  import {
    getProductionConfigs,
    getLabPromptList,
    getLabExperimentList,
    getSampleList,
    runLLMExperiment,
    runSTTExperiment,
    runChainExperiment,
    getExperiment,
    createLabPrompt,
    evaluateExperiment,
    promoteToProduction,
    importProductionPrompts,
    uploadAudioSample,
    type ProductionAIConfigResponse,
    type PromptVersionResponse,
    type ExperimentListResponse,
    type SampleListResponse,
    type LabMetadataResponse,
  } from '$hooks/actions/aiLab.action'
  import { buildPipelineConfigs, type PipelineConfigVM } from '$lib/features/ai-lab/production/view-model'
  import { getLlmModels, getSttModels, getDefaultSystemPrompt, getSampleInputText } from '$lib/features/ai-lab/metadata-helpers'
  import { snackbarStore } from '$stores/snackbar'

  import PageHeader from '$components/PageHeader.svelte'
  import StepGrid from '$lib/features/ai-lab/lab/components/StepGrid.svelte'
  import ExperimentEditor from '$lib/features/ai-lab/lab/components/ExperimentEditor.svelte'
  import SttEditor from '$lib/features/ai-lab/lab/components/SttEditor.svelte'
  import ChainEditor from '$lib/features/ai-lab/lab/components/ChainEditor.svelte'
  import AgentEditor from '$lib/features/ai-lab/lab/components/AgentEditor.svelte'
  import ResultCard from '$lib/features/ai-lab/lab/components/ResultCard.svelte'
  import type { TestResult } from '$lib/features/ai-lab/lab/types'
  import ExperimentHistory from '$lib/features/ai-lab/lab/components/ExperimentHistory.svelte'
  import PromoteConfirmModal from '$lib/features/ai-lab/lab/components/PromoteConfirmModal.svelte'
  import FieldNoteImportModal from '$lib/features/ai-lab/lab/components/FieldNoteImportModal.svelte'
  import ReferenceEditorModal from '$lib/features/ai-lab/lab/components/ReferenceEditorModal.svelte'
  import { parseSyncSegments } from '$lib/features/ai-lab/shared/audio-sync'

  const WORKFLOW_STEPS = [
    { n: 1, label: '단계 선택' },
    { n: 2, label: '수정' },
    { n: 3, label: '결과 확인' },
    { n: 4, label: '평가 · 반영' },
  ] as const

  const queryClient = useQueryClient()
  const getMetadata = getContext<() => LabMetadataResponse | undefined>('labMetadata')
  const metadata = $derived(getMetadata())

  // ── Queries ──
  const configsQ = $derived(
    queryBuilder(getProductionConfigs, () => ({}), () => ({ throwOnError: false })),
  )
  const promptsQ = $derived(
    queryBuilder(getLabPromptList, () => ({}), () => ({ throwOnError: false })),
  )
  const historyQ = $derived(
    queryBuilder(getLabExperimentList, () => ({ size: 50 }), () => ({ throwOnError: false })),
  )
  const samplesQ = $derived(
    queryBuilder(getSampleList, () => ({ input_type: 'audio', size: 50 }), () => ({ throwOnError: false })),
  )

  // ── Derived ──
  const configs = $derived(
    buildPipelineConfigs((configsQ.data as ProductionAIConfigResponse[]) ?? [], null, metadata),
  )
  const prompts = $derived((promptsQ.data as PromptVersionResponse[]) ?? [])
  const llmModels = $derived(getLlmModels(metadata))
  const sttModels = $derived(getSttModels(metadata))
  const historyItems = $derived((historyQ.data as ExperimentListResponse)?.items ?? [])
  const audioSamples = $derived((samplesQ.data as SampleListResponse)?.items ?? [])
  const isLoading = $derived(configsQ.isPending)

  // ── URL ?step= 자동 선택 ──
  let autoSelectDone = $state(false)
  $effect(() => {
    if (autoSelectDone || isLoading || configs.length === 0) return
    const stepParam = $page.url.searchParams.get('step')
    if (stepParam) {
      const target = configs.find((c) => c.step === stepParam)
      if (target) selectStep(target)
    }
    autoSelectDone = true
  })

  // ── State ──
  // TestResult 타입은 lab/types.ts 에서 공유 (ResultCard 와 동일 타입 사용)

  let selectedStep = $state<PipelineConfigVM | null>(null)
  const isAgentStep = $derived(selectedStep?.step === 'skill_selection')
  const isVoucherPdfStep = $derived(selectedStep?.step === 'voucher_pdf_to_md')
  const isSttStep = $derived(selectedStep != null && !selectedStep.hasPrompt && selectedStep.step !== 'chain_stt_refine' && !isAgentStep)
  const isChainStep = $derived(selectedStep?.step === 'chain_stt_refine')
  // 텍스트 화자분리: STT 스텝이지만 화자 추론 프롬프트를 튜닝한다(SttEditor 에 프롬프트 영역 노출).
  // whisper 전사 기반(stt_text_diarize)과 AWS 전사 기반(stt_aws_text_diarize) 둘 다 동일하게 처리.
  const isTextDiarizeStep = $derived(
    selectedStep?.step === 'stt_text_diarize' || selectedStep?.step === 'stt_aws_text_diarize',
  )

  // 워크플로 현재 단계: 1=선택, 2=수정, 3=테스트 실행, 4=평가/반영
  const workflowPhase = $derived.by(() => {
    if (!selectedStep) return 1
    if (testResults.some((r) => r.experimentId)) return 3
    return 2
  })

  // LLM state
  let editPrompt = $state('')
  let editModel = $state('')
  let testInput = $state('')

  // Agent state
  let agentModel = $state('')
  let agentInput = $state('')

  // STT state
  let sttModel = $state('')
  let selectedSampleId = $state('')
  // 텍스트 화자분리 프롬프트(편집/수정baseline/원본기본값)
  let textDiarizePrompt = $state('')
  let textDiarizeBasePrompt = $state('')
  let textDiarizeDefaultPrompt = $state('') // 메타데이터 원본 기본값(버전 로드와 무관, 복원용)

  // Chain state
  let chainSttModel = $state('')
  let chainLlmModel = $state('')
  let chainPrompt = $state('')
  let chainBasePrompt = $state('')

  // A/B 비교 모드
  let compareMode = $state(false)
  $effect(() => {
    // 결과가 2개 미만이면 비교 모드 자동 해제
    if (testResults.length < 2) compareMode = false
  })

  // Shared state
  let isRunning = $state(false)
  let isUploading = $state(false)
  let runStartTime = $state<number | null>(null)
  let elapsedSeconds = $state(0)

  // 실행 경과 시간 타이머
  $effect(() => {
    if (!isRunning) {
      runStartTime = null
      elapsedSeconds = 0
      return
    }
    runStartTime = Date.now()
    const interval = setInterval(() => {
      if (runStartTime) elapsedSeconds = Math.floor((Date.now() - runStartTime) / 1000)
    }, 1000)
    return () => clearInterval(interval)
  })
  let allSessionResults = $state<TestResult[]>([])  // 세션 전체 결과 (스텝 전환해도 유지)
  let testResults = $state<TestResult[]>([])         // 현재 스텝 결과 (화면 표시용)

  // Prompt version tracking (LLM only)
  let loadedVersionId = $state<string | undefined>(undefined)
  let basePrompt = $state('')
  const loadedVersion = $derived(prompts.find((p) => p.id === loadedVersionId))
  const isPromptModified = $derived(
    isChainStep
      ? chainPrompt.trim() !== chainBasePrompt.trim() && chainPrompt.trim() !== ''
      : isTextDiarizeStep
        ? textDiarizePrompt.trim() !== textDiarizeBasePrompt.trim() && textDiarizePrompt.trim() !== ''
        : editPrompt.trim() !== basePrompt.trim() && editPrompt.trim() !== '',
  )

  // 이전 결과 → LLM 입력 연결용
  // 1) 현재 세션 결과 (다른 스텝) + 2) 서버 이력 (completed, output_text 있는 것)
  const recentResults = $derived.by(() => {
    const fromSession = allSessionResults
      .filter((r) => r.content && r.content !== '(결과 없음)' && r.stepKey !== selectedStep?.step)
      .map((r) => ({
        id: r.experimentId,
        label: `${r.stepKey} · ${r.model} — ${r.content.slice(0, 50)}…`,
        text: r.content,
      }))

    const sessionIds = new Set(fromSession.map((r) => r.id))
    const fromHistory = historyItems
      .filter((h) => h.status === 'completed' && h.output_text && !sessionIds.has(h.id))
      .slice(0, 10)
      .map((h) => ({
        id: h.id,
        label: `${h.experiment_type} · ${h.model_name} — ${h.output_text!.slice(0, 50)}…`,
        text: h.output_text!,
      }))

    return [...fromSession, ...fromHistory].slice(0, 8)
  })

  const sttDiarizeModels = $derived(metadata?.stt_diarize_models ?? [])
  // LLM 모델 옵션: 스텝 전용 모델이 있으면 그것을 사용, 없으면 글로벌 llmModels
  const modelOptions: SelectOptionType[] = $derived.by(() => {
    const stepModels = selectedStep?.stepModels ?? []
    const hasStepModels = stepModels.length > 0
      && selectedStep?.step !== 'skill_selection'
      && !isSttStep && !isChainStep
    const models = hasStepModels ? stepModels : llmModels
    return models.map((m) => ({ value: m.value, title: `${m.label}${m.cost_label ? ` (${m.cost_label})` : ''}` }))
  })
  const sttModelOptions: SelectOptionType[] = $derived.by(() => {
    // 스텝이 자체 모델을 선언하면 그것을 사용(스트리밍=AWS, 화자분리(음향)=diarize, 화자분리(텍스트)=LLM),
    // 없으면 전체 STT 모델. stt_transcribe 는 stepModels === sttModels 라 동작 동일.
    const own = selectedStep?.stepModels ?? []
    const models = own.length > 0 ? own : sttModels
    return models.map((m) => ({ value: m.value, title: `${m.label}${m.cost_label ? ` (${m.cost_label})` : ''}` }))
  })
  const chainSttModelOptions = $derived<SelectOptionType[]>(
    sttDiarizeModels.map((m) => ({ value: m.value, title: `${m.label}${m.cost_label ? ` (${m.cost_label})` : ''}` })),
  )
  const chainLlmModelOptions = $derived<SelectOptionType[]>(
    llmModels.map((m) => ({ value: m.value, title: m.label })),
  )
  const agentModelOptions = $derived<SelectOptionType[]>(
    (selectedStep?.stepModels ?? []).map((m) => ({ value: m.value, title: `${m.label}${m.cost_label ? ` (${m.cost_label})` : ''}` })),
  )
  const sampleOptions = $derived<SelectOptionType[]>(
    audioSamples.map((s) => ({ value: s.id, title: `${s.name}${s.tags ? ` [${s.tags}]` : ''}` })),
  )

  // ── Handlers ──
  function selectStep(config: PipelineConfigVM) {
    selectedStep = config
    testResults = []
    loadedVersionId = undefined

    if (config.step === 'skill_selection') {
      // Agent step — 스텝 전용 모델 사용
      agentModel = config.raw?.model_name ?? config.stepModels[0]?.value ?? ''
      agentInput = ''
    } else if (config.step === 'chain_stt_refine') {
      // Chain step — 프로덕션 프롬프트 → 메타데이터 기본값 순 폴백
      chainSttModel = sttDiarizeModels[0]?.value ?? 'gpt-4o-transcribe-diarize'
      chainLlmModel = config.raw?.model_name?.split(' + ')[1] ?? llmModels[0]?.value ?? 'gpt-4.1'
      chainPrompt = config.raw?.system_prompt || getDefaultSystemPrompt(metadata, 'chain_stt_refine')
      chainBasePrompt = chainPrompt
      selectedSampleId = ''
    } else if (config.hasPrompt) {
      // LLM step — 프로덕션 프롬프트 → 메타데이터 기본값 → 빈 문자열 순 폴백
      editPrompt = config.raw?.system_prompt || getDefaultSystemPrompt(metadata, config.step)
      basePrompt = editPrompt
      // 스텝 전용 모델(voucher 등)이 있으면 그것을 기본값으로 사용
      const defaultModels = config.stepModels.length > 0 ? config.stepModels : llmModels
      editModel = config.raw?.model_name ?? defaultModels[0]?.value ?? ''
      testInput = ''
    } else {
      // STT step — 스텝 전용 모델이 있으면 그것을, 없으면 전체 STT 모델
      const defaultModels = config.stepModels.length > 0 ? config.stepModels : sttModels
      sttModel = config.raw?.model_name ?? defaultModels[0]?.value ?? ''
      selectedSampleId = ''
      // 텍스트 화자분리: 화자 추론 프롬프트 시드(프로덕션 설정 → 메타데이터 기본값)
      if (config.step === 'stt_text_diarize' || config.step === 'stt_aws_text_diarize') {
        const seed = config.raw?.system_prompt || getDefaultSystemPrompt(metadata, config.step)
        textDiarizePrompt = seed
        textDiarizeBasePrompt = seed
        textDiarizeDefaultPrompt = getDefaultSystemPrompt(metadata, config.step)
      }
    }
  }

  function goBack() {
    selectedStep = null
    testResults = []
    loadedVersionId = undefined
  }

  // 히스토리(영구 저장된 과거 실험)를 결과뷰로 불러오기 — 세그먼트·재생 싱크·비교 가능.
  // 긴 오디오가 클라이언트 타임아웃에 걸려도 서버엔 저장되므로, 여기서 다시 불러와 확인한다.
  async function loadHistoryExperiment(id: string) {
    const cached = allSessionResults.find((r) => r.experimentId === id)
    try {
      const exp = cached ? null : await getExperiment().request({ experimentId: id })
      const expType = cached?.stepKey ?? exp!.experiment_type
      const cfg = configs.find((c) => c.step === expType)
      if (!cfg) {
        snackbarStore.error('이 실험 타입은 현재 비교 뷰에서 지원하지 않습니다.')
        return
      }
      // 결과 패널은 selectedStep 기준이라 해당 스텝으로 전환 (testResults 가 초기화됨)
      selectStep(cfg)
      const result: TestResult = cached ?? {
        index: allSessionResults.length + 1,
        content: exp!.output_text ?? exp!.output_json ?? '(결과 없음)',
        model: exp!.model_name,
        latencyMs: exp!.latency_ms ?? 0,
        costUsd: exp!.estimated_cost_usd ?? 0,
        experimentId: exp!.id,
        inputText: exp!.input_text ?? (exp!.sample_id ? '오디오 샘플' : ''),
        systemPrompt: '',
        stepKey: exp!.experiment_type,
        isStt: exp!.experiment_type.startsWith('stt_'),
        outputJson: exp!.output_json ?? undefined,
        sampleId: exp!.sample_id ?? undefined,
      }
      if (!cached) allSessionResults = [result, ...allSessionResults]
      testResults = [result]
    } catch {
      snackbarStore.error('실험을 불러올 수 없습니다.')
    }
  }

  function loadPromptVersion(id: string) {
    const pv = prompts.find((p) => p.id === id)
    if (!pv) return
    if (isChainStep) {
      chainPrompt = pv.system_prompt
      chainBasePrompt = pv.system_prompt
    } else if (isTextDiarizeStep) {
      textDiarizePrompt = pv.system_prompt
      textDiarizeBasePrompt = pv.system_prompt
    } else {
      editPrompt = pv.system_prompt
      basePrompt = pv.system_prompt
    }
    loadedVersionId = pv.id
  }

  // ── LLM 실행 ──
  async function handleRunLLM() {
    if (!selectedStep || !editPrompt || !testInput || !editModel) {
      snackbarStore.error('모델, 프롬프트, 입력 텍스트를 모두 입력해주세요.')
      return
    }
    isRunning = true
    try {
      // 스텝 전용 모델이면 해당 provider 사용
      const stepModelMeta = selectedStep.stepModels.find((m) => m.value === editModel)
      const provider = stepModelMeta?.provider ?? 'openai'
      const resp = await runLLMExperiment().request({
        experiment_type: `llm_${selectedStep.step}`,
        model_name: editModel,
        provider,
        system_prompt: editPrompt,
        input_text: testInput,
      })
      // 백엔드는 실패를 HTTP 200 + status='failed' 로 반환 → catch에 안 걸리므로 직접 확인
      if (resp.status === 'failed') {
        snackbarStore.error(resp.error_message?.trim() || '테스트 실행에 실패했습니다.')
        return
      }
      const newResult: TestResult = {
        index: allSessionResults.length + 1,
        content: resp.output_text ?? '(결과 없음)',
        model: resp.model_name,
        latencyMs: resp.latency_ms ?? 0,
        costUsd: resp.estimated_cost_usd ?? 0,
        experimentId: resp.id,
        inputText: testInput,
        systemPrompt: editPrompt,
        stepKey: selectedStep.step,
        versionName: loadedVersion?.name,
      }
      testResults = [newResult, ...testResults]
      allSessionResults = [newResult, ...allSessionResults]
      await queryClient.invalidateQueries({ queryKey: ['getLabExperimentList'], exact: false })
    } catch {
      snackbarStore.error('테스트 실행에 실패했습니다.')
    } finally {
      isRunning = false
    }
  }

  // ── STT 실행 ──
  async function handleRunSTT() {
    if (!selectedStep || !sttModel || !selectedSampleId) {
      snackbarStore.error('모델과 오디오 샘플을 선택해주세요.')
      return
    }
    isRunning = true
    try {
      const resp = await runSTTExperiment().request({
        experiment_type: selectedStep.step,
        sample_id: selectedSampleId,
        model_name: sttModel,
        system_prompt: isTextDiarizeStep ? textDiarizePrompt : undefined,
      })
      if (resp.status === 'failed') {
        snackbarStore.error(resp.error_message?.trim() || 'STT 실행에 실패했습니다.')
        return
      }
      const sampleName = audioSamples.find((s) => s.id === selectedSampleId)?.name ?? selectedSampleId
      const newResult: TestResult = {
        index: allSessionResults.length + 1,
        content: resp.output_text ?? resp.output_json ?? '(결과 없음)',
        model: resp.model_name,
        latencyMs: resp.latency_ms ?? 0,
        costUsd: resp.estimated_cost_usd ?? 0,
        experimentId: resp.id,
        inputText: `오디오 샘플: ${sampleName}`,
        systemPrompt: '',
        stepKey: selectedStep.step,
        isStt: true,
        outputJson: resp.output_json ?? undefined,
        sampleId: selectedSampleId,
      }
      testResults = [newResult, ...testResults]
      allSessionResults = [newResult, ...allSessionResults]
      await queryClient.invalidateQueries({ queryKey: ['getLabExperimentList'], exact: false })
    } catch {
      snackbarStore.error('STT 실행에 실패했습니다.')
    } finally {
      isRunning = false
    }
  }

  // ── Chain 실행 ──
  async function handleRunChain() {
    if (!selectedStep || !chainSttModel || !chainLlmModel || !selectedSampleId) {
      snackbarStore.error('STT 모델, LLM 모델, 오디오 샘플을 모두 선택해주세요.')
      return
    }
    isRunning = true
    try {
      const resp = await runChainExperiment().request({
        sample_id: selectedSampleId,
        stt_model_name: chainSttModel,
        llm_model_name: chainLlmModel,
        system_prompt: chainPrompt || undefined,
      })
      if (resp.status === 'failed') {
        snackbarStore.error(resp.error_message?.trim() || '체인 실행에 실패했습니다.')
        return
      }
      const sampleName = audioSamples.find((s) => s.id === selectedSampleId)?.name ?? selectedSampleId
      // output_json에서 실제 사용된 프롬프트 추출 (백엔드가 resolve한 값)
      let usedPrompt = chainPrompt
      try {
        const outputJson = resp.output_json ? JSON.parse(resp.output_json) : null
        if (outputJson?.used_system_prompt) usedPrompt = outputJson.used_system_prompt
      } catch { /* ignore */ }
      const newResult: TestResult = {
        index: allSessionResults.length + 1,
        content: resp.output_text ?? '(결과 없음)',
        model: resp.model_name,
        latencyMs: resp.latency_ms ?? 0,
        costUsd: resp.estimated_cost_usd ?? 0,
        experimentId: resp.id,
        inputText: `오디오 샘플: ${sampleName}`,
        systemPrompt: usedPrompt,
        stepKey: 'chain_stt_refine',
        versionName: loadedVersion?.name,
        isStt: false,
      }
      testResults = [newResult, ...testResults]
      allSessionResults = [newResult, ...allSessionResults]
      await queryClient.invalidateQueries({ queryKey: ['getLabExperimentList'], exact: false })
    } catch {
      snackbarStore.error('체인 실행에 실패했습니다.')
    } finally {
      isRunning = false
    }
  }

  // ── Agent 실행 ──
  async function handleRunAgent() {
    if (!selectedStep || !agentModel || !agentInput.trim()) {
      snackbarStore.error('모델과 사용자 메시지를 입력해주세요.')
      return
    }
    isRunning = true
    try {
      const modelMeta = selectedStep.stepModels.find((m) => m.value === agentModel)
      const resp = await runLLMExperiment().request({
        experiment_type: `agent_${selectedStep.step}`,
        model_name: agentModel,
        provider: modelMeta?.provider ?? 'openai',
        input_text: agentInput,
      })
      if (resp.status === 'failed') {
        snackbarStore.error(resp.error_message?.trim() || '에이전트 실행에 실패했습니다.')
        return
      }
      const newResult: TestResult = {
        index: allSessionResults.length + 1,
        content: resp.output_text ?? '(결과 없음)',
        model: resp.model_name,
        latencyMs: resp.latency_ms ?? 0,
        costUsd: resp.estimated_cost_usd ?? 0,
        experimentId: resp.id,
        inputText: agentInput,
        systemPrompt: '',
        stepKey: selectedStep.step,
      }
      testResults = [newResult, ...testResults]
      allSessionResults = [newResult, ...allSessionResults]
      await queryClient.invalidateQueries({ queryKey: ['getLabExperimentList'], exact: false })
    } catch {
      snackbarStore.error('에이전트 실행에 실패했습니다.')
    } finally {
      isRunning = false
    }
  }

  function handleRun() {
    if (isAgentStep) handleRunAgent()
    else if (isChainStep) handleRunChain()
    else if (isSttStep) handleRunSTT()
    else handleRunLLM()
  }

  // ── 오디오 샘플 업로드 ──
  async function handleUploadSample(file: File, name: string) {
    isUploading = true
    try {
      const result = await uploadAudioSample().request({ file, name })
      snackbarStore.success('오디오 샘플이 업로드되었습니다.')
      await queryClient.invalidateQueries({ queryKey: ['getSampleList'], exact: false })
      selectedSampleId = result.id
    } catch {
      snackbarStore.error('업로드에 실패했습니다.')
    } finally {
      isUploading = false
    }
  }

  // ── 프롬프트 저장 (LLM + Chain) ──
  let showSaveDialog = $state(false)
  let saveName = $state('')

  function openSaveDialog() {
    if (!selectedStep) return
    const stepPrompts = prompts.filter((p) => p.prompt_key === selectedStep!.step)
    const maxVersion = stepPrompts.reduce((max, p) => Math.max(max, p.version), 0)
    saveName = `${selectedStep.label} V${maxVersion + 1}`
    showSaveDialog = true
  }

  async function handleSavePrompt() {
    if (!selectedStep || !saveName.trim()) return
    const promptText = isChainStep ? chainPrompt : isTextDiarizeStep ? textDiarizePrompt : editPrompt
    if (!promptText) return
    try {
      await createLabPrompt().request({
        prompt_key: selectedStep.step,
        name: saveName.trim(),
        system_prompt: promptText,
      })
      snackbarStore.success('프롬프트가 저장되었습니다.')
      await queryClient.invalidateQueries({ queryKey: ['getLabPromptList'], exact: false })
      // 저장 후 basePrompt 갱신 → "수정됨" 뱃지 해제
      if (isChainStep) chainBasePrompt = promptText
      else if (isTextDiarizeStep) textDiarizeBasePrompt = promptText
      else basePrompt = promptText
      showSaveDialog = false
      saveName = ''
    } catch {
      snackbarStore.error('저장에 실패했습니다.')
    }
  }

  async function handleImportProduction() {
    try {
      await importProductionPrompts().request()
      snackbarStore.success('프로덕션 프롬프트를 가져왔습니다.')
      await queryClient.invalidateQueries({ queryKey: ['getLabPromptList'], exact: false })
    } catch {
      snackbarStore.error('가져오기에 실패했습니다.')
    }
  }

  // ── 평가 상태 (experimentId → 평가, SSOT) ──
  // ResultCard에 savedEval로 전달 → 카드 재마운트·A/B 비교 전환에도 점수가 유지된다.
  type EvalEntry = { score: number | null; note: string; saved: boolean }
  let evalStates = $state(new Map<string, EvalEntry>())
  function setEvalState(id: string, entry: EvalEntry) {
    const next = new Map(evalStates)
    next.set(id, entry)
    evalStates = next
  }

  async function handleEvaluate(experimentId: string, score: number, note: string) {
    // 낙관적 업데이트: 저장 응답을 기다리는 동안에도 점수를 즉시 반영 (saved=false)
    const prev = evalStates.get(experimentId)
    setEvalState(experimentId, { score, note, saved: false })
    try {
      await evaluateExperiment().request({
        experimentId,
        quality_score: score,
        quality_note: note || null,
      })
      setEvalState(experimentId, { score, note, saved: true })
      snackbarStore.success('평가가 저장되었습니다.')
      await queryClient.invalidateQueries({ queryKey: ['getLabExperimentList'], exact: false })
    } catch {
      // 저장 실패 시 이전 상태로 롤백
      setEvalState(experimentId, prev ?? { score: null, note: '', saved: false })
      snackbarStore.error('평가 저장에 실패했습니다.')
    }
  }

  // ── 필드노트 가져오기 모달 ──
  let showImportModal = $state(false)

  // ── 정답(reference) 편집 모달 ──
  let showReferenceModal = $state(false)
  let referenceSampleId = $state('')
  let referenceSampleName = $state('')
  let referenceInitialSegments = $state<{ speaker: string; text: string; start: number; end: number }[]>([])
  function openMakeReference(result: TestResult) {
    if (!result.sampleId) {
      snackbarStore.error('샘플 정보가 없어 정답을 만들 수 없습니다.')
      return
    }
    const segs = parseSyncSegments(result.outputJson)
    if (!segs || segs.length === 0) {
      snackbarStore.error('화자 세그먼트가 없어 정답을 만들 수 없습니다.')
      return
    }
    referenceSampleId = result.sampleId
    referenceSampleName = audioSamples.find((s) => s.id === result.sampleId)?.name ?? ''
    referenceInitialSegments = segs.map((s) => ({ speaker: s.speaker, text: s.text, start: s.start, end: s.end }))
    showReferenceModal = true
  }

  // ── 프로덕션 승격 모달 ──
  let showPromoteModal = $state(false)
  let promoteTarget = $state<{
    experimentId: string
    model: string
    systemPrompt: string
    versionName?: string
    score?: number
  } | null>(null)

  function handlePromote(experimentId: string) {
    if (!selectedStep) return
    const result = testResults.find((r) => r.experimentId === experimentId)
    if (!result) return
    promoteTarget = {
      experimentId,
      model: result.model,
      systemPrompt: result.systemPrompt,
      versionName: result.versionName,
    }
    showPromoteModal = true
  }

  async function confirmPromote() {
    if (!selectedStep || !promoteTarget) return
    try {
      await promoteToProduction().request({
        module: selectedStep.module,
        pipeline_step: selectedStep.step,
        model_name: promoteTarget.model,
        provider: selectedStep.stepModels.find((m) => m.value === promoteTarget!.model)?.provider ?? 'openai',
        system_prompt: (isSttStep || isAgentStep) ? undefined : promoteTarget.systemPrompt,
        prompt_version_id: loadedVersionId ?? null,
        description: `실험실에서 프로덕션 반영${promoteTarget.versionName ? ` (${promoteTarget.versionName})` : ''}`,
      })
      snackbarStore.success('프로덕션에 반영되었습니다!')
      await queryClient.invalidateQueries({ queryKey: ['getProductionConfigs'], exact: false })
      await queryClient.invalidateQueries({ queryKey: ['getProductionConfigHistory'], exact: false })
    } catch {
      snackbarStore.error('반영에 실패했습니다.')
    } finally {
      showPromoteModal = false
      promoteTarget = null
    }
  }

  function closePromoteModal() {
    showPromoteModal = false
    promoteTarget = null
  }
</script>

{#if isLoading}
  <div class="flex items-center justify-center py-32">
    <div class="flex flex-col items-center gap-3">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
      <p class="text-body-03-normal-regular text-gray-400">불러오는 중...</p>
    </div>
  </div>

{:else if !selectedStep}
  <!-- 단계 선택 화면 -->
  <PageHeader title="실험실" description="프롬프트 · 모델을 테스트하고 비교" />
  <div class="space-y-6">
    <div class="section-border p-6">
      <div class="mb-5">
        <h2 class="text-title-01-normal-bold text-gray-900">어떤 단계를 개선하시겠습니까?</h2>
        <p class="mt-1 text-body-03-normal-regular text-gray-500">
          파이프라인 단계를 선택하면 모델이나 프롬프트를 바꿔보고 결과를 즉시 비교할 수 있습니다.
        </p>
      </div>

      <!-- 워크플로 가이드 -->
      <div class="mb-5 flex items-center gap-2">
        {#each WORKFLOW_STEPS as step}
          {#if step.n > 1}
            <div class="h-px flex-1 bg-gray-200"></div>
          {/if}
          <div class="flex items-center gap-1.5">
            <span class="flex h-5 w-5 items-center justify-center rounded-full text-label-01-normal-bold
              {step.n === 1 ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-400'}">
              {step.n}
            </span>
            <span class="hidden text-label-01-normal-regular sm:inline {step.n === 1 ? 'text-gray-700' : 'text-gray-400'}">
              {step.label}
            </span>
          </div>
        {/each}
        <span class="ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-label-01-normal-medium text-emerald-600">무료</span>
      </div>

      <StepGrid {configs} onSelect={selectStep} />
    </div>

    <!-- 실험 이력 -->
    <ExperimentHistory experiments={historyItems} isLoading={historyQ.isPending} onLoad={loadHistoryExperiment} />
  </div>

{:else}
  <!-- 실험 편집 + 결과 화면 -->
  <div class="space-y-6">
    <div class="section-border p-6">
      <!-- 워크플로 진행 표시 -->
      <div class="mb-5 flex items-center gap-2">
        {#each WORKFLOW_STEPS as step}
          {#if step.n > 1}
            <div class="h-px flex-1 {workflowPhase >= step.n ? 'bg-primary-300' : 'bg-gray-200'}"></div>
          {/if}
          {#if step.n === 1}
            <button class="flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-gray-100" onclick={goBack}>
              <span class="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-label-01-normal-bold text-white">✓</span>
              <span class="hidden text-label-01-normal-medium text-primary-600 sm:inline">{selectedStep?.label ?? step.label}</span>
            </button>
          {:else}
            <div class="flex items-center gap-1.5">
              <span class="flex h-5 w-5 items-center justify-center rounded-full text-label-01-normal-bold
                {workflowPhase >= step.n ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-400'}">
                {step.n}
              </span>
              <span class="hidden text-label-01-normal-regular sm:inline {workflowPhase >= step.n ? 'text-gray-700' : 'text-gray-400'}">
                {step.label}
              </span>
            </div>
          {/if}
        {/each}
      </div>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <!-- 좌: 편집기 + 프롬프트 관리 -->
      <div class="flex flex-col gap-4">
        {#if isVoucherPdfStep}
          <!-- 바우처 PDF 변환: 멀티모달 처리 필요 → 준비 중 -->
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-3">
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
                onclick={goBack}
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
              </button>
              <div class="flex items-center gap-2">
                <div>
                  <p class="text-body-03-normal-semibold text-gray-900">{selectedStep.label}</p>
                  <p class="text-label-01-normal-regular text-gray-400">{selectedStep.description}</p>
                </div>
                <span class="rounded-full bg-teal-50 px-2 py-0.5 text-label-01-normal-bold text-teal-600">LLM</span>
              </div>
            </div>
            <div class="flex items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-16">
              <div class="flex flex-col items-center gap-3 text-center">
                <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                  <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <p class="text-body-03-normal-medium text-gray-500">PDF 멀티모달 실험 준비 중</p>
                <p class="text-label-01-normal-regular text-gray-400">바우처 PDF 변환은 멀티모달(이미지) 처리가 필요하여<br/>실험실에서 아직 지원하지 않습니다.</p>
                <p class="text-label-01-normal-regular text-gray-400">프로덕션 설정은 <strong>프로덕션 관리</strong> 탭에서 변경할 수 있습니다.</p>
              </div>
            </div>
          </div>
        {:else if isAgentStep}
          <!-- 에이전트 편집기 -->
          <AgentEditor
            step={selectedStep}
            bind:agentModel
            bind:testInput={agentInput}
            modelOptions={agentModelOptions}
            sampleInputText={getSampleInputText(metadata, selectedStep.step)}
            {isRunning}
            onRun={handleRun}
            onBack={goBack}
          />
        {:else if isChainStep}
          <!-- 체인 편집기: STT + LLM -->
          <ChainEditor
            step={selectedStep}
            bind:sttModel={chainSttModel}
            bind:llmModel={chainLlmModel}
            bind:systemPrompt={chainPrompt}
            bind:selectedSampleId
            sttModelOptions={chainSttModelOptions}
            llmModelOptions={chainLlmModelOptions}
            {sampleOptions}
            promptVersions={prompts}
            {isRunning}
            {isUploading}
            {isPromptModified}
            loadedVersionName={loadedVersion?.name ?? ''}
            onRun={handleRun}
            onBack={goBack}
            onUpload={handleUploadSample}
            onSave={openSaveDialog}
            onLoadVersion={loadPromptVersion}
            onImportProduction={handleImportProduction}
          />
        {:else if isSttStep}
          <!-- STT 편집기 -->
          <SttEditor
            step={selectedStep}
            bind:sttModel
            bind:selectedSampleId
            {sttModelOptions}
            {sampleOptions}
            {isRunning}
            {isUploading}
            onRun={handleRun}
            onBack={goBack}
            onUpload={handleUploadSample}
            onImportFieldNote={() => (showImportModal = true)}
            showPrompt={isTextDiarizeStep}
            bind:systemPrompt={textDiarizePrompt}
            defaultPrompt={textDiarizeDefaultPrompt}
            promptVersions={prompts}
            {isPromptModified}
            loadedVersionName={loadedVersion?.name ?? ''}
            onSave={openSaveDialog}
            onLoadVersion={loadPromptVersion}
            onResetPrompt={() => {
              textDiarizePrompt = textDiarizeDefaultPrompt
              textDiarizeBasePrompt = textDiarizeDefaultPrompt
              loadedVersionId = undefined
            }}
          />
        {:else}
          <!-- LLM 편집기 -->
          <ExperimentEditor
            step={selectedStep}
            bind:editPrompt
            bind:editModel
            bind:testInput
            {modelOptions}
            {recentResults}
            promptVersions={prompts}
            sampleInputText={getSampleInputText(metadata, selectedStep.step)}
            {isRunning}
            {isPromptModified}
            loadedVersionName={loadedVersion?.name ?? ''}
            onRun={handleRun}
            onSave={openSaveDialog}
            onLoadVersion={loadPromptVersion}
            onImportProduction={handleImportProduction}
            onBack={goBack}
          />
        {/if}
      </div>

      <!-- 우: 결과 -->
      <div class="flex flex-col gap-3">
        {#if isRunning}
          <div class="flex items-center justify-center rounded-2xl border border-primary-200 bg-primary-50/30 py-10">
            <div class="flex flex-col items-center gap-3">
              <div class="relative h-8 w-8">
                <div class="absolute inset-0 rounded-full border-[3px] border-primary-100"></div>
                <div class="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-primary-500"></div>
              </div>
              <p class="text-body-03-normal-medium text-primary-700">
                {isAgentStep ? '에이전트 실행 중...' : isChainStep ? 'STT + 보정 실행 중...' : isSttStep ? '음성 분석 중...' : '생성 중...'}
              </p>
              <p class="text-label-01-normal-regular tabular-nums text-primary-400">
                {elapsedSeconds === 0 ? '시작 중...' : elapsedSeconds < 60 ? `${elapsedSeconds}초 경과` : `${Math.floor(elapsedSeconds / 60)}분 ${(elapsedSeconds % 60).toString().padStart(2, '0')}초 경과`}
                <span class="mx-1">·</span>
                {isAgentStep ? '보통 5~15초' : isChainStep ? '최대 5분' : isSttStep ? '최대 3분' : '보통 5~30초'}
              </p>
            </div>
          </div>
        {/if}

        {#if testResults.length === 0 && !isRunning}
          <div class="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-16">
            <div class="flex flex-col items-center gap-3 text-center">
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                </svg>
              </div>
              <p class="text-body-03-normal-medium text-gray-500">
                왼쪽에서 설정을 완료하고
              </p>
              <p class="text-body-03-normal-medium text-gray-500">
                {isChainStep ? '"체인 실행"' : '"테스트 실행"'}을 클릭하세요
              </p>
              <p class="mt-1 text-label-01-normal-regular text-gray-400">결과가 여기에 나타납니다</p>
            </div>
          </div>
        {:else}
          <!-- A/B 비교 토글 (결과 2개 이상일 때) -->
          {#if testResults.length >= 2}
            <div class="flex items-center justify-between">
              <span class="text-label-01-normal-regular text-gray-400">{testResults.length}개 결과</span>
              <button
                class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-label-01-normal-medium transition-colors
                  {compareMode ? 'bg-primary-50 text-primary-600 ring-1 ring-primary-200' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}"
                onclick={() => compareMode = !compareMode}
              >
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
                </svg>
                A/B 비교
              </button>
            </div>
          {/if}

          {#if compareMode && testResults.length >= 2}
            <!-- A/B 나란히 비교 뷰 -->
            <div class="grid grid-cols-2 gap-2">
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center gap-1.5">
                  <span class="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-label-01-normal-bold text-white">A</span>
                  <span class="text-label-01-normal-medium text-gray-500">최신 결과</span>
                </div>
                <ResultCard
                  result={testResults[0]}
                  isLatest={false}
                  forceExpanded={true}
                  compareLabel="A"
                  savedEval={evalStates.get(testResults[0].experimentId)}
                  onEvaluate={handleEvaluate}
                  onPromote={handlePromote}
                  onMakeReference={openMakeReference}
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center gap-1.5">
                  <span class="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-label-01-normal-bold text-white">B</span>
                  <span class="text-label-01-normal-medium text-gray-500">이전 결과</span>
                </div>
                <ResultCard
                  result={testResults[1]}
                  isLatest={false}
                  forceExpanded={true}
                  compareLabel="B"
                  savedEval={evalStates.get(testResults[1].experimentId)}
                  onEvaluate={handleEvaluate}
                  onPromote={handlePromote}
                  onMakeReference={openMakeReference}
                />
              </div>
            </div>
          {:else}
            {#each testResults as result, i}
              <ResultCard
                {result}
                isLatest={i === 0}
                savedEval={evalStates.get(result.experimentId)}
                onEvaluate={handleEvaluate}
                onPromote={handlePromote}
                onMakeReference={openMakeReference}
              />
            {/each}
          {/if}
        {/if}
      </div>
    </div>
    </div>

    <!-- 실험 이력 (하단) -->
    <ExperimentHistory experiments={historyItems} isLoading={historyQ.isPending} onLoad={loadHistoryExperiment} />
  </div>
{/if}

<!-- 프롬프트 저장 모달 -->
{#if showSaveDialog}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div class="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
      <h3 class="mb-1 text-body-03-normal-semibold text-gray-900">프롬프트 버전 저장</h3>
      <p class="mb-4 text-label-01-normal-regular text-gray-500">이 버전에 대한 이름을 입력해주세요.</p>
      <input
        type="text"
        class="mb-4 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-body-03-normal-regular text-gray-700 outline-none focus:border-primary-500 focus:bg-white"
        placeholder="예: 요약 개선 v2"
        bind:value={saveName}
        onkeydown={(e) => { if (e.key === 'Enter') handleSavePrompt() }}
      />
      <div class="flex gap-2">
        <button
          class="flex-1 rounded-xl border border-gray-200 py-2.5 text-body-03-normal-medium text-gray-600 transition-colors hover:bg-gray-50"
          onclick={() => { showSaveDialog = false; saveName = '' }}
        >취소</button>
        <button
          class="flex-1 rounded-xl bg-primary-600 py-2.5 text-body-03-normal-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          disabled={!saveName.trim()}
          onclick={handleSavePrompt}
        >저장</button>
      </div>
    </div>
  </div>
{/if}

<!-- 프로덕션 승격 확인 모달 -->
{#if selectedStep && promoteTarget}
  <PromoteConfirmModal
    open={showPromoteModal}
    step={selectedStep}
    target={promoteTarget}
    onConfirm={confirmPromote}
    onClose={closePromoteModal}
  />
{/if}

<!-- 필드노트에서 샘플 가져오기 모달 -->
<FieldNoteImportModal
  open={showImportModal}
  onClose={() => (showImportModal = false)}
  onImported={() => queryClient.invalidateQueries({ queryKey: ['getSampleList'], exact: false })}
/>

<!-- 정답(화자) 편집 모달 -->
<ReferenceEditorModal
  open={showReferenceModal}
  sampleId={referenceSampleId}
  sampleName={referenceSampleName}
  initialSegments={referenceInitialSegments}
  onClose={() => (showReferenceModal = false)}
  onSaved={() => queryClient.invalidateQueries({ queryKey: ['getSampleList'], exact: false })}
/>
