import type { QuestionItem, QuestionOption, DefinitionType } from '$hooks/actions/assessment.action'

export type EditorQuestion = QuestionItem & { _id: number }

let _nextId = 0
function assignId(q: QuestionItem): EditorQuestion {
  return { ...q, _id: _nextId++ }
}

/**
 * 문항 정의 편집 상태 + 조작 함수를 제공하는 runes 훅.
 * 등록 페이지와 수정 모달에서 공용으로 사용.
 *
 * definitionType에 따라 문항 추가/export 구조가 달라짐:
 * - choice: { number, text, options? } + common_options
 * - sentence_completion: { number, stem_before, stem_after? } (선택지 없음)
 *
 * 유형 전환 시 기존 데이터를 캐싱하여, 원래 유형으로 돌아오면 복원.
 */
export function createDefinitionEditor(
  initial?: {
    definitionType?: DefinitionType
    questions?: QuestionItem[]
    commonOptions?: QuestionOption[]
  }
) {
  let definitionType = $state<DefinitionType>(initial?.definitionType ?? 'choice')
  let questions = $state<EditorQuestion[]>((initial?.questions ?? []).map(assignId))
  let commonOptions = $state<QuestionOption[]>(initial?.commonOptions ?? [])

  // ─── 유형별 데이터 캐시 ───
  const cache = new Map<DefinitionType, { questions: EditorQuestion[]; commonOptions: QuestionOption[] }>()

  // ─── 문항 ───

  function addQuestion() {
    if (definitionType === 'sentence_completion') {
      questions = [...questions, assignId({ number: questions.length + 1, text: '', stem_before: '' })]
    } else {
      questions = [...questions, assignId({ number: questions.length + 1, text: '' })]
    }
  }

  function removeQuestion(index: number) {
    questions = questions.filter((_, i) => i !== index)
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= questions.length) return
    const copy = [...questions]
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
    questions = copy
  }

  // ─── 공통 선택지 ───

  function addOption() {
    const nextValue =
      commonOptions.length > 0 ? Math.max(...commonOptions.map((o) => o.value)) + 1 : 1
    commonOptions = [...commonOptions, { value: nextValue, label: '' }]
  }

  function removeOption(index: number) {
    commonOptions = commonOptions.filter((_, i) => i !== index)
  }

  // ─── 유형 전환 (캐시 저장 + 복원) ───

  function switchDefinitionType(newType: DefinitionType) {
    if (newType === definitionType) return

    // 현재 유형 데이터를 캐시에 저장
    cache.set(definitionType, {
      questions: $state.snapshot(questions) as EditorQuestion[],
      commonOptions: $state.snapshot(commonOptions) as QuestionOption[]
    })

    // 새 유형으로 전환
    definitionType = newType

    // 캐시에 저장된 데이터가 있으면 복원, 없으면 빈 상태
    const cached = cache.get(newType)
    if (cached) {
      questions = cached.questions
      commonOptions = cached.commonOptions
    } else {
      questions = []
      commonOptions = []
    }
  }

  // ─── 초기화 (모달 수정 모드 진입 시) ───

  function reset(data: {
    definitionType?: DefinitionType
    questions?: QuestionItem[]
    commonOptions?: QuestionOption[]
  }) {
    cache.clear()
    definitionType = data.definitionType ?? 'choice'
    questions = (data.questions ?? []).map(assignId)
    commonOptions = data.commonOptions ?? []
  }

  // ─── 번호 재정렬된 최종 데이터 (_id 제거) ───

  function getDefinition() {
    if (definitionType === 'sentence_completion') {
      const renumbered = questions.map((q, i) => ({
        number: i + 1,
        stem_before: q.stem_before ?? '',
        stem_after: q.stem_after || null
      }))
      return {
        type: 'sentence_completion' as const,
        questions: renumbered
      }
    }

    const renumbered = questions.map((q, i) => ({
      number: i + 1,
      text: q.text,
      ...(q.options ? { options: q.options } : {})
    }))
    return {
      type: 'choice' as const,
      questions: renumbered,
      common_options: commonOptions.length > 0 ? commonOptions : undefined
    }
  }

  return {
    get definitionType() { return definitionType },
    set definitionType(v: DefinitionType) { switchDefinitionType(v) },
    get questions() { return questions },
    set questions(v: EditorQuestion[]) { questions = v },
    get commonOptions() { return commonOptions },
    set commonOptions(v: QuestionOption[]) { commonOptions = v },
    addQuestion,
    removeQuestion,
    moveQuestion,
    addOption,
    removeOption,
    reset,
    getDefinition
  }
}
