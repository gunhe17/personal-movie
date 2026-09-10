<script lang="ts">
  /**
   * 범용 파일 드롭존 — 클릭/드래그앤드롭으로 파일 선택, 콜백으로 파일 배열 전달.
   * 즉시 업로드 X. 호출하는 쪽에서 파일을 들고 있다가 사용.
   */
  import SearchIcon from '$lib/assets/SearchIcon.svelte'

  interface Props {
    multiple?: boolean
    accept?: string
    disabled?: boolean
    title?: string
    description?: string
    hint?: string
    /** 'sm' = 기본 (py-10/text-base), 'lg' = 크게 강조 (py-16/text-lg) */
    size?: 'sm' | 'lg'
    onFilesPicked: (files: File[]) => void
  }

  let {
    multiple = false,
    accept,
    disabled = false,
    title = '파일을 여기로 드래그하거나',
    description,
    hint,
    size = 'sm',
    onFilesPicked
  }: Props = $props()

  let isDragging = $state(false)
  let inputEl: HTMLInputElement | null = $state(null)

  function pick() {
    if (disabled) return
    inputEl?.click()
  }

  function handleSelect(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const files = input.files ? Array.from(input.files) : []
    if (files.length > 0) onFilesPicked(files)
    input.value = '' // 같은 파일 재선택 가능
  }

  function matchesAccept(file: File): boolean {
    if (!accept) return true
    const list = accept.split(',').map((s) => s.trim().toLowerCase())
    const name = file.name.toLowerCase()
    const type = file.type.toLowerCase()
    for (const a of list) {
      if (!a) continue
      if (a.startsWith('.')) {
        if (name.endsWith(a)) return true
      } else if (a.endsWith('/*')) {
        if (type.startsWith(a.slice(0, -1))) return true
      } else if (a.includes('/')) {
        if (type === a) return true
      }
    }
    return false
  }

  function onDragEnter(e: DragEvent) {
    if (disabled) return
    e.preventDefault()
    isDragging = true
  }

  function onDragOver(e: DragEvent) {
    if (disabled) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  function onDragLeave(e: DragEvent) {
    // 자식 진입 시 발생하는 의도치 않은 leave 회피
    if (e.currentTarget === e.target) {
      isDragging = false
    }
  }

  function onDrop(e: DragEvent) {
    if (disabled) return
    e.preventDefault()
    isDragging = false
    const dropped = Array.from(e.dataTransfer?.files ?? [])
    if (dropped.length === 0) return

    const files = dropped.filter(matchesAccept)
    if (!multiple) {
      onFilesPicked(files.slice(0, 1))
    } else if (files.length > 0) {
      onFilesPicked(files)
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick()
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  role="button"
  tabindex={disabled ? -1 : 0}
  aria-disabled={disabled}
  class="flex flex-col items-center justify-center rounded-lg border border-dashed text-center transition-colors duration-150
    {size === 'lg' ? 'gap-5 px-10 py-16' : 'gap-4 px-6 py-10'}
    {isDragging ? 'border-primary-400 bg-primary-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}
    {disabled ? 'pointer-events-none opacity-40' : 'cursor-pointer'}"
  ondragenter={onDragEnter}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
  onclick={pick}
  onkeydown={onKeyDown}
>
  <svg
    class="{size === 'lg' ? 'h-14 w-14' : 'h-10 w-10'} {isDragging ? 'text-primary-500' : 'text-gray-400'}"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
    />
  </svg>

  <!-- 주 메시지 + 액션 버튼: 한 묶음으로 인지되도록 좁은 간격 -->
  <div class="flex flex-col items-center gap-3">
    <p class="{size === 'lg' ? 'text-xl font-semibold' : 'text-base font-medium'} text-gray-800">
      {title}
    </p>
    <button
      type="button"
      onclick={(e) => {
        e.stopPropagation()
        pick()
      }}
      {disabled}
      class="inline-flex items-center gap-1.5 rounded-md border border-primary-400 bg-white font-medium text-primary-500 transition-colors hover:border-primary-500 hover:bg-primary-50 disabled:opacity-50
        {size === 'lg' ? 'px-6 py-2.5 text-base' : 'px-5 py-2 text-sm'}"
    >
      <SearchIcon class={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} strokeColor="currentColor" />
      찾기
    </button>
  </div>

  <!-- 보조 설명: 액션 클러스터에서 한 단계 분리 -->
  {#if description || hint}
    <div class="flex flex-col items-center gap-1">
      {#if description}
        <p class="text-gray-600 {size === 'lg' ? 'max-w-xl text-sm leading-relaxed' : 'max-w-md text-sm'}">
          {description}
        </p>
      {/if}
      {#if hint}
        <p class="text-xs text-gray-400">{hint}</p>
      {/if}
    </div>
  {/if}

  <input
    bind:this={inputEl}
    type="file"
    {accept}
    {multiple}
    {disabled}
    class="hidden"
    onchange={handleSelect}
  />
</div>
