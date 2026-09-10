<script lang="ts">
  // ── Atom 기반 렌더 ──
  import { ATOM_CATALOG, TOOL_ATOM_COLUMNS } from '../column-atoms'
  import { getAtomValue, renderAtom } from '../column-renderer'

  interface Props {
    tool?: string
    output: unknown
    content?: string
    isError?: boolean
    rolledBack?: boolean
    truncated?: boolean
    limit?: number | null
  }

  let {
    tool,
    output,
    content = '',
    isError = false,
    rolledBack = false,
    truncated = false,
    limit = null
  }: Props = $props()

  // atom 컬럼 (데이터 존재 필드만 필터링)
  let atomColIds = $derived.by<string[]>(() => {
    if (!tool) return []
    const ids = TOOL_ATOM_COLUMNS[tool] ?? []
    if (!ids.length) return []
    const sample = getSample(output)
    if (!sample) return ids
    const dataKeys = new Set(Object.keys(sample))
    const filtered = ids.filter((id) => {
      const atom = ATOM_CATALOG[id]
      return atom && dataKeys.has(atom.key)
    })
    return filtered.length > 0 ? filtered : ids
  })

  function getSample(data: unknown): Record<string, unknown> | null {
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object')
      return data[0] as Record<string, unknown>
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const items = (data as Record<string, unknown>).items
      if (
        Array.isArray(items) &&
        items.length > 0 &&
        typeof items[0] === 'object'
      )
        return items[0] as Record<string, unknown>
      return data as Record<string, unknown>
    }
    return null
  }

  // paginated wrapper → items 배열 추출
  let unwrapped = $derived(unwrapOutput(output))

  function unwrapOutput(val: unknown): unknown {
    if (
      val &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      Array.isArray((val as Record<string, unknown>).items)
    ) {
      return (val as Record<string, unknown>).items
    }
    return val
  }

  let mode = $derived<'none' | 'table' | 'card' | 'empty'>(
    deriveMode(unwrapped, atomColIds)
  )

  function deriveMode(
    val: unknown,
    atomIds: string[]
  ): 'none' | 'table' | 'card' | 'empty' {
    if (val == null || val === '') return 'none'
    if (!atomIds.length) return 'none'
    if (Array.isArray(val)) return val.length > 0 ? 'table' : 'empty'
    if (typeof val === 'object') return 'card'
    return 'none'
  }

  let rows = $derived<Record<string, unknown>[]>(
    mode === 'table' ? (unwrapped as Record<string, unknown>[]) : []
  )

  // ── tool → 사용자 친화적 라벨 (empty/error 메시지용) ──
  const TOOL_LABEL_MAP: Record<string, string> = {
    query_client_handler: '내담자',
    query_member_handler: '구성원',
    query_schedule_handler: '일정',
    query_case_handler: '상담 사례',
    query_counseling_session_handler: '상담 회기',
    query_counseling_note_handler: '상담노트',
    query_counseling_participant_handler: '참여자',
    query_assessment_handler: '검사',
    query_assessment_case_handler: '검사 사례',
    query_assessment_session_handler: '검사 회기',
    query_assessment_participant_handler: '검사 참여자',
    query_room_handler: '상담실',
    query_program_handler: '프로그램',
    query_notification_handler: '알림',
    query_notice_handler: '공지',
    query_form_template_handler: '양식',
    query_form_instance_handler: '양식 제출',
    query_member_invitation_handler: '초대',
    query_field_note_handler: '현장 노트',
    query_document_handler: '문서',
    query_billable_handler: '청구',
    query_price_list_handler: '단가',
    query_institution_handler: '연계 기관',
    query_activity_handler: '활동 기록'
  }

  let emptyMessage = $derived.by(() => {
    const label = TOOL_LABEL_MAP[tool ?? ''] ?? '데이터'
    const lastChar = label.charCodeAt(label.length - 1)
    // 한글 종성(받침) 유무로 이/가 판별: (code - 0xAC00) % 28 !== 0 이면 받침 있음
    const particle =
      lastChar >= 0xac00 && lastChar <= 0xd7a3 && (lastChar - 0xac00) % 28 !== 0
        ? '이'
        : '가'
    return `등록된 ${label}${particle} 없어요.`
  })

  // backend completion 메시지가 전달되면 우선 사용, 없으면 fallback
  let displayEmptyMessage = $derived(content?.trim() || emptyMessage)

  // 표 상단 제목 — 조회한 대상(모듈) 라벨
  let tableTitle = $derived(TOOL_LABEL_MAP[tool ?? ''] ?? '')
</script>

<div class={rolledBack ? 'relative opacity-50' : ''}>
  {#if rolledBack}
    <div
      class="absolute -top-2 right-2 z-10 rounded bg-amber-100 px-2 py-0.5 text-label-02-normal-medium text-amber-800 border border-amber-200"
    >
      ⚠ 취소됨 (저장 안 됨)
    </div>
  {/if}

  {#if isError}
    <p class="my-1 text-label-01-normal-regular text-gray-400">
      요청을 처리하지 못했어요. 다시 시도해 주세요.
    </p>
  {:else if mode === 'empty'}
    <p class="my-1 text-label-01-normal-regular text-gray-400">
      {displayEmptyMessage}
    </p>
  {:else if mode === 'table' && atomColIds.length > 0}
    {#if tableTitle}
      <p class="mt-2 mb-1 text-label-01-normal-medium text-gray-500">
        {tableTitle}
      </p>
    {/if}
    <div class="my-2 overflow-x-auto rounded-lg border border-gray-200">
      <table
        class="min-w-full border-collapse text-[13px] leading-relaxed whitespace-nowrap"
      >
        <thead>
          <tr>
            {#each atomColIds as atomId (atomId)}
              {@const atom = ATOM_CATALOG[atomId]}
              {#if atom}
                <th
                  class="bg-white font-semibold text-gray-500 text-left text-[13px] px-4 py-3 border-b border-gray-200 align-middle select-none whitespace-nowrap"
                >
                  {atom.label}
                </th>
              {/if}
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each rows as row, idx (idx)}
            <tr
              class="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
            >
              {#each atomColIds as atomId (atomId)}
                {@const atom = ATOM_CATALOG[atomId]}
                {#if atom}
                  {@const val = getAtomValue(row, atom)}
                  {@const result = renderAtom(atom, val)}
                  <td class="px-4 py-2.5 align-middle">
                    {#if result.type === 'badge' && result.badge}
                      <span
                        class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {result
                          .badge.bg} {result.badge.text}"
                      >
                        {result.text}
                      </span>
                    {:else}
                      <span class={result.className ?? 'text-gray-800'}
                        >{result.text}</span
                      >
                    {/if}
                  </td>
                {/if}
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if truncated}
      <div
        class="mt-2 px-3 py-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg"
      >
        {rows.length}{limit ? `건 (최대 ${limit})` : '건'} 표시. 더 있을 수 있으니
        조건을 좁혀주세요.
      </div>
    {/if}
  {:else if mode === 'card' && atomColIds.length > 0}
    {#if tableTitle}
      <p class="mt-2 mb-1 text-label-01-normal-medium text-gray-500">
        {tableTitle}
      </p>
    {/if}
    <!-- Atom-only 카드 (1건 결과) -->
    {@const obj = unwrapped as Record<string, unknown>}
    <div class="my-2 rounded-lg bg-white p-4 ring-1 ring-gray-200 ring-inset">
      <div class="space-y-1.5 text-[13px]">
        {#each atomColIds as atomId (atomId)}
          {@const atom = ATOM_CATALOG[atomId]}
          {#if atom}
            {@const val = getAtomValue(obj, atom)}
            {@const result = renderAtom(atom, val)}
            <div class="flex items-center justify-between gap-2">
              <span class="shrink-0 text-gray-600">{atom.label}</span>
              <span class="truncate-safe text-right">
                {#if result.type === 'badge' && result.badge}
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {result
                      .badge.bg} {result.badge.text}"
                  >
                    {result.text}
                  </span>
                {:else}
                  <span class={result.className ?? 'text-gray-800'}
                    >{result.text}</span
                  >
                {/if}
              </span>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</div>
