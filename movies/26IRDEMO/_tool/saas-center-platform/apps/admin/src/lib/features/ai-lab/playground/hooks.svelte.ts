/**
 * Playground - Hooks (상태 관리)
 * 프롬프트 편집 → 실험 실행 → 결과 확인 → A/B 비교 통합 워크플로우
 */

import {
  getLabPromptList,
  getLabPromptDetail,
  createLabPrompt,
  runLLMExperiment,
  runSTTExperiment,
  type LLMExperimentParams,
  type PromptVersionResponse,
  type ExperimentRunResponse,
  type LabMetadataResponse,
} from '$hooks/actions/aiLab.action'
import { snackbarStore } from '$stores/snackbar'
import { mapToPlaygroundResult, type PlaygroundResultVM } from './view-model'
import { mapPrompt, groupPromptsByKey } from '../prompt-editor/view-model'
import { buildPlaygroundCategories } from '../metadata-helpers'
import { createComparisonState } from '../hooks/use-comparison.svelte'

export function createPlaygroundState(getMetadata: () => LabMetadataResponse | undefined) {
  // ── Config ──
  let selectedCategory = $state<string>('llm_summary')
  let modelA = $state<string>('gpt-4.1-mini')
  let modelB = $state<string>('')
  let selectedPromptVersionId = $state<string | null>(null)

  let isABMode = $derived(modelB !== '')

  // ── 프롬프트 에디터 ──
  let systemPrompt = $state('')
  let userPromptTemplate = $state('')
  let loadedSystemPrompt = $state('')
  let loadedUserPromptTemplate = $state('')

  // ── 입력 ──
  let inputText = $state('')

  // ── STT 모드 ──
  let selectedSampleId = $state('')
  let isUploading = $state(false)

  // ── 실행 ──
  let isRunning = $state(false)
  let sessionResults = $state<PlaygroundResultVM[]>([])

  // ── 비교 모드 (공유 훅) ──
  const comparison = createComparisonState()

  // ── 프롬프트 목록 캐시 ──
  let promptList = $state<PromptVersionResponse[]>([])
  let isLoadingPrompts = $state(false)

  // ── Derived ──
  let isPromptDirty = $derived(
    systemPrompt !== loadedSystemPrompt ||
    userPromptTemplate !== loadedUserPromptTemplate
  )

  let categories = $derived(buildPlaygroundCategories(getMetadata()))

  let currentCategory = $derived(
    categories.find((c) => c.value === selectedCategory) ?? null
  )

  let isSTTMode = $derived(currentCategory?.category === 'stt')

  let currentPromptKey = $derived(currentCategory?.promptKey ?? null)

  let inputPlaceholder = $derived(
    currentCategory?.inputPlaceholder ?? 'AI가 처리할 텍스트를 입력하세요.'
  )

  let instructionPlaceholder = $derived(
    currentCategory?.instructionPlaceholder ?? '비워두면 입력 텍스트가 그대로 전달됩니다.'
  )

  let filteredPrompts = $derived(
    currentPromptKey
      ? promptList.filter((p) => p.prompt_key === currentPromptKey)
      : promptList
  )

  let groupedPrompts = $derived(groupPromptsByKey(filteredPrompts, getMetadata()))

  let canRun = $derived(
    !isRunning && (
      isSTTMode
        ? selectedSampleId !== ''
        : (systemPrompt.trim().length > 0 && inputText.trim().length > 0)
    )
  )

  let canCompare = $derived(comparison.canCompare)

  // ── 프롬프트 목록 로드 ──
  async function loadPrompts() {
    isLoadingPrompts = true
    try {
      promptList = await getLabPromptList().request({})
      // 초기 카테고리에 대해 기본 프롬프트 자동 채움
      if (!systemPrompt) {
        changeCategory(selectedCategory)
      }
    } catch {
      promptList = []
      snackbarStore.error('프롬프트 목록을 불러오지 못했습니다.')
    } finally {
      isLoadingPrompts = false
    }
  }

  // ── 프롬프트 버전 로드 → 에디터 채움 ──
  async function loadPromptVersion(id: string) {
    selectedPromptVersionId = id
    try {
      const prompt = await getLabPromptDetail().request({ promptId: id })
      systemPrompt = prompt.system_prompt
      userPromptTemplate = prompt.user_prompt_template ?? ''
      loadedSystemPrompt = prompt.system_prompt
      loadedUserPromptTemplate = prompt.user_prompt_template ?? ''
    } catch {
      snackbarStore.error('프롬프트 버전을 불러오지 못했습니다.')
    }
  }

  // ── 카테고리 변경 → 기본 프롬프트 자동 채움 ──
  function changeCategory(category: string) {
    selectedCategory = category
    selectedPromptVersionId = null

    const catMeta = categories.find((c) => c.value === category)

    // STT 카테고리 진입 시 LLM 상태 초기화
    if (catMeta?.category === 'stt') {
      systemPrompt = ''
      userPromptTemplate = ''
      loadedSystemPrompt = ''
      loadedUserPromptTemplate = ''
      inputText = ''
      return
    }

    // LLM 카테고리 진입 시 STT 상태 초기화
    selectedSampleId = ''

    // 해당 카테고리의 프로덕션 프롬프트 버전이 있으면 로드
    const promptKey = catMeta?.promptKey
    if (promptKey && promptList.length > 0) {
      const productionPrompt = promptList.find(
        (p) => p.prompt_key === promptKey && p.is_production
      )
      const latestPrompt = promptList.find((p) => p.prompt_key === promptKey)
      const targetPrompt = productionPrompt ?? latestPrompt
      if (targetPrompt) {
        systemPrompt = targetPrompt.system_prompt
        userPromptTemplate = targetPrompt.user_prompt_template ?? ''
        loadedSystemPrompt = targetPrompt.system_prompt
        loadedUserPromptTemplate = targetPrompt.user_prompt_template ?? ''
        selectedPromptVersionId = targetPrompt.id
        return
      }
    }

    // 프롬프트 버전이 없으면 메타데이터의 기본 프롬프트 사용
    const defaultPrompt = catMeta?.defaultSystemPrompt ?? ''
    systemPrompt = defaultPrompt
    userPromptTemplate = ''
    loadedSystemPrompt = defaultPrompt
    loadedUserPromptTemplate = ''
  }

  // ── 새 프롬프트 버전 저장 ──
  async function saveAsNewVersion(name: string): Promise<PromptVersionResponse | null> {
    if (!currentPromptKey) return null
    try {
      const result = await createLabPrompt().request({
        prompt_key: currentPromptKey,
        name,
        system_prompt: systemPrompt,
        user_prompt_template: userPromptTemplate || null,
      })
      // 목록 새로고침
      await loadPrompts()
      // 새로 생성된 버전을 선택
      if (result?.id) {
        selectedPromptVersionId = result.id
        loadedSystemPrompt = systemPrompt
        loadedUserPromptTemplate = userPromptTemplate
      }
      return result
    } catch {
      snackbarStore.error('프롬프트 저장에 실패했습니다.')
      return null
    }
  }

  // ── 실험 실행 ──
  async function runExperiment(): Promise<PlaygroundResultVM | null> {
    if (!canRun) return null
    isRunning = true

    try {
      let raw: ExperimentRunResponse
      let promptLabel: string

      if (isSTTMode) {
        // STT 실험
        raw = await runSTTExperiment().request({
          sample_id: selectedSampleId,
          model_name: modelA,
        })
        promptLabel = 'STT'
      } else {
        // LLM 실험
        const useInlinePrompt = isPromptDirty || !selectedPromptVersionId
        const params: LLMExperimentParams = {
          experiment_type: selectedCategory === 'custom' ? 'llm_summary' : selectedCategory,
          model_name: modelA,
          provider: 'openai',
        }

        if (useInlinePrompt) {
          params.system_prompt = systemPrompt
          params.user_prompt_template = userPromptTemplate || null
        } else {
          params.prompt_version_id = selectedPromptVersionId
        }

        params.input_text = inputText

        raw = await runLLMExperiment().request(params)
        promptLabel = useInlinePrompt
          ? '인라인 프롬프트'
          : filteredPrompts.find((p) => p.id === selectedPromptVersionId)
              ? `${mapPrompt(filteredPrompts.find((p) => p.id === selectedPromptVersionId)!).name}`
              : '프롬프트'
      }

      const result = mapToPlaygroundResult(raw, promptLabel, getMetadata())
      sessionResults = [result, ...sessionResults]
      return result
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '실험 실행에 실패했습니다.'
      snackbarStore.error(msg.includes('timeout') ? '요청 시간이 초과되었습니다.' : msg)
      return null
    } finally {
      isRunning = false
    }
  }

  // ── A/B 비교 실행 ──
  async function runABComparison(): Promise<void> {
    if (!canRun || !isABMode) return
    isRunning = true

    try {
      let rawA: ExperimentRunResponse
      let rawB: ExperimentRunResponse
      let promptLabel: string

      if (isSTTMode) {
        // STT A/B 비교: 같은 샘플로 두 모델 병렬 실행
        ;[rawA, rawB] = await Promise.all([
          runSTTExperiment().request({ sample_id: selectedSampleId, model_name: modelA }),
          runSTTExperiment().request({ sample_id: selectedSampleId, model_name: modelB }),
        ])
        promptLabel = 'STT'
      } else {
        // LLM A/B 비교
        const useInlinePrompt = isPromptDirty || !selectedPromptVersionId
        const baseParams: Omit<LLMExperimentParams, 'model_name'> = {
          experiment_type: selectedCategory === 'custom' ? 'llm_summary' : selectedCategory,
          provider: 'openai',
          input_text: inputText,
        }

        if (useInlinePrompt) {
          baseParams.system_prompt = systemPrompt
          baseParams.user_prompt_template = userPromptTemplate || null
        } else {
          baseParams.prompt_version_id = selectedPromptVersionId
        }

        ;[rawA, rawB] = await Promise.all([
          runLLMExperiment().request({ ...baseParams, model_name: modelA } as LLMExperimentParams),
          runLLMExperiment().request({ ...baseParams, model_name: modelB } as LLMExperimentParams),
        ])

        promptLabel = useInlinePrompt
          ? '인라인 프롬프트'
          : filteredPrompts.find((p) => p.id === selectedPromptVersionId)
              ? `${mapPrompt(filteredPrompts.find((p) => p.id === selectedPromptVersionId)!).name}`
              : '프롬프트'
      }

      const resultA = mapToPlaygroundResult(rawA, promptLabel, getMetadata())
      const resultB = mapToPlaygroundResult(rawB, promptLabel, getMetadata())
      sessionResults = [resultA, resultB, ...sessionResults]

      // 자동으로 비교 모드 진입
      comparison.exitCompare()
      comparison.toggleSelection(resultA.id)
      comparison.toggleSelection(resultB.id)
      await comparison.enterCompare()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'A/B 비교 실행에 실패했습니다.'
      snackbarStore.error(msg.includes('timeout') ? '요청 시간이 초과되었습니다.' : msg)
    } finally {
      isRunning = false
    }
  }

  // ── 결과 목록 초기화 ──
  function clearResults() {
    sessionResults = []
    comparison.exitCompare()
  }

  return {
    // Config
    get selectedCategory() { return selectedCategory },
    get modelA() { return modelA },
    set modelA(v: string) { modelA = v },
    get modelB() { return modelB },
    set modelB(v: string) { modelB = v },
    get isABMode() { return isABMode },
    get selectedPromptVersionId() { return selectedPromptVersionId },

    // Editor
    get systemPrompt() { return systemPrompt },
    set systemPrompt(v: string) { systemPrompt = v },
    get userPromptTemplate() { return userPromptTemplate },
    set userPromptTemplate(v: string) { userPromptTemplate = v },
    get isPromptDirty() { return isPromptDirty },

    // Input
    get inputText() { return inputText },
    set inputText(v: string) { inputText = v },

    // STT Mode
    get isSTTMode() { return isSTTMode },
    get selectedSampleId() { return selectedSampleId },
    set selectedSampleId(v: string) { selectedSampleId = v },
    get isUploading() { return isUploading },
    set isUploading(v: boolean) { isUploading = v },

    // Execution
    get isRunning() { return isRunning },
    get sessionResults() { return sessionResults },
    get canRun() { return canRun },

    // Categories (동적)
    get categories() { return categories },

    // Placeholders
    get inputPlaceholder() { return inputPlaceholder },
    get instructionPlaceholder() { return instructionPlaceholder },

    // Prompts
    get promptList() { return promptList },
    get filteredPrompts() { return filteredPrompts },
    get groupedPrompts() { return groupedPrompts },
    get isLoadingPrompts() { return isLoadingPrompts },
    get currentPromptKey() { return currentPromptKey },

    // Comparison
    get comparisonIds() { return comparison.comparisonIds },
    get isCompareMode() { return comparison.isCompareMode },
    get compareDetails() { return comparison.compareDetails },
    get isLoadingCompare() { return comparison.isLoadingCompare },
    get canCompare() { return canCompare },

    // Actions
    loadPrompts,
    loadPromptVersion,
    changeCategory,
    saveAsNewVersion,
    runExperiment,
    runABComparison,
    toggleResultSelection: comparison.toggleSelection,
    enterCompare: comparison.enterCompare,
    exitCompare: comparison.exitCompare,
    clearResults,
  }
}
