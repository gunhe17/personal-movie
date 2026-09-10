<style>
  .editor:empty::before {
    content: attr(data-placeholder);
    color: #9ca3af;
    pointer-events: none;
  }

  .editor :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 8px 0;
  }
</style>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import { appInstance } from '$services/api/instances'

  import BoldIcon from '../assets/editorIcons/BoldIcon.svelte'
  import LinkIcon from '../assets/editorIcons/LinkIcon.svelte'
  import UnderlineIcon from '../assets/editorIcons/UnderlineIcon.svelte'
  import HighlightIcon from '../assets/editorIcons/HighlightIcon.svelte'
  import OrderedListIcon from '../assets/editorIcons/OrderedListIcon.svelte'
  import UnorderedListIcon from '../assets/editorIcons/UnorderedListIcon.svelte'
  import ImageIcon from '../assets/editorIcons/ImageIcon.svelte'

  interface Props {
    id?: string
    value?: string
    readonly?: boolean
    hasLinkOption?: boolean
    hasImageOption?: boolean
    imageCategory?: string
    imageEntityId?: string
    placeholder?: string
    label?: string
    required?: boolean
    class?: string
    onchange?: (value: string) => void
  }

  let {
    id = '',
    value = $bindable(''),
    readonly = false,
    hasLinkOption = false,
    hasImageOption = false,
    imageCategory = 'notice',
    imageEntityId = '',
    placeholder = '내용을 입력하세요',
    label,
    required = false,
    class: className,
    onchange
  }: Props = $props()

  const FONT_SIZES = [
    { value: '2', label: '작게' },
    { value: '3', label: '보통' },
    { value: '5', label: '크게' },
    { value: '7', label: '매우 크게' }
  ]

  let editor: HTMLElement | null = $state(null)
  let fileInput: HTMLInputElement | null = $state(null)
  let initialId = $state('')
  let isUploading = $state(false)
  let hasSelection = $state(false)
  let currentFontSize = $state('3')
  let savedRange: Range | null = null
  const highlightColor = '#FFD8DA'

  function saveSelection() {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      savedRange = selection.getRangeAt(0).cloneRange()
    }
  }

  function restoreSelection() {
    if (!savedRange) return
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(savedRange)
    }
  }

  function syncValue() {
    if (!editor) return
    value = editor.innerHTML
    onchange?.(value)
  }

  function execCommand(command: string, value?: string) {
    document.execCommand(command, false, value)
    syncValue()
  }

  function applyListStyles() {
    if (!editor) return
    editor.querySelectorAll('ol, ul').forEach((list) => {
      if (!(list instanceof HTMLElement)) return
      list.style.display = 'block'
      list.style.marginBlockStart = '0.5em'
      list.style.marginBlockEnd = '0.5em'
      list.style.marginInlineStart = '0px'
      list.style.marginInlineEnd = '0px'
      list.style.paddingInlineStart = '40px'
      list.style.unicodeBidi = 'isolate'
      list.style.listStyleType = list.tagName === 'OL' ? 'decimal' : 'disc'
    })
    syncValue()
  }

  function handleAddLink() {
    const inputUrl = prompt('링크 주소를 입력하세요')
    if (!inputUrl) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
      return

    const range = selection.getRangeAt(0)
    const anchor = document.createElement('a')
    anchor.href = inputUrl
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    anchor.setAttribute('contenteditable', 'false')
    anchor.classList.add('text-blue-500', 'underline')

    try {
      anchor.appendChild(range.extractContents())
      range.insertNode(anchor)

      selection.removeAllRanges()
      const newRange = document.createRange()
      newRange.setStartAfter(anchor)
      newRange.collapse(true)
      selection.addRange(newRange)
      syncValue()
    } catch (e) {
      console.error('링크 추가 실패:', e)
    }
  }

  function handleHighlight() {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    if (range.collapsed) return

    const parentEl = range.commonAncestorContainer.parentElement
    if (
      parentEl?.tagName === 'SPAN' &&
      parentEl.style.boxShadow?.includes('inset')
    ) {
      const textNode = document.createTextNode(parentEl.textContent || '')
      parentEl.replaceWith(textNode)
    } else {
      const span = document.createElement('span')
      span.style.boxShadow = `inset 0 -22px ${highlightColor}`
      range.surroundContents(span)
    }
    syncValue()
  }

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  function validateImageFile(file: File): string | null {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return 'JPG, PNG, GIF, WebP 파일만 업로드할 수 있습니다.'
    }
    if (file.size > MAX_FILE_SIZE) {
      return '이미지 파일 크기는 최대 10MB까지 가능합니다.'
    }
    return null
  }

  async function uploadFile(file: File) {
    if (!editor) return

    const error = validateImageFile(file)
    if (error) {
      alert(error)
      return
    }

    isUploading = true
    try {
      const formData = new FormData()
      formData.append('file', file)

      const entityId = imageEntityId || 'draft'
      const response = await appInstance.post(
        `/admin/upload/images/?category=${imageCategory}&entity_id=${entityId}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      const { url } = response.data
      insertImageAtCursor(url)
    } catch (e) {
      console.error('이미지 업로드 실패:', e)
    } finally {
      isUploading = false
    }
  }

  function handleImageSelect(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) uploadFile(file)
    input.value = ''
  }

  function insertImageAtCursor(url: string) {
    if (!editor) return

    editor.focus()
    const img = document.createElement('img')
    img.src = url
    img.alt = ''

    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      range.insertNode(img)

      const newRange = document.createRange()
      newRange.setStartAfter(img)
      newRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(newRange)
    } else {
      editor.appendChild(img)
    }

    syncValue()
  }

  function handleFocus() {
    if (!readonly && editor && editor.innerHTML.trim() === placeholder) {
      editor.innerHTML = ''
    }
  }

  function handlePaste(event: ClipboardEvent) {
    if (readonly) return
    event.preventDefault()

    if (hasImageOption && event.clipboardData?.files.length) {
      const file = event.clipboardData.files[0]
      if (file.type.startsWith('image/')) {
        uploadFile(file)
        return
      }
    }

    const text = event.clipboardData?.getData('text/plain') || ''
    document.execCommand('insertText', false, text)
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Tab' || !editor || readonly) return
    event.preventDefault()

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const spaceNode = document.createTextNode('\u00A0\u00A0\u00A0')
    range.insertNode(spaceNode)
    range.setStartAfter(spaceNode)
    range.setEndAfter(spaceNode)
    selection.removeAllRanges()
    selection.addRange(range)
    syncValue()
  }

  function updateSelectionState() {
    if (!editor) return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      hasSelection = false
      return
    }
    const range = selection.getRangeAt(0)
    hasSelection = !range.collapsed && editor.contains(range.commonAncestorContainer)
  }

  function handleFontSizeChange(event: Event) {
    const select = event.target as HTMLSelectElement
    const size = select.value
    currentFontSize = size
    restoreSelection()
    document.execCommand('fontSize', false, size)
    syncValue()
  }

  $effect(() => {
    if (id && id !== initialId && editor) {
      editor.innerHTML = value
      initialId = id
    }
  })

  onMount(() => {
    if (editor && value) {
      editor.innerHTML = value
    }
    if (id) {
      initialId = id
    }
    document.addEventListener('selectionchange', updateSelectionState)
  })

  onDestroy(() => {
    if (browser) {
      document.removeEventListener('selectionchange', updateSelectionState)
    }
  })
</script>

<div class="flex h-full flex-col">
  {#if label}
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label class="mb-1.5 block text-sm font-medium text-gray-700">
      {label}
      {#if required}<span class="text-red-500">*</span>{/if}
    </label>
  {/if}

  {#if !readonly}
    <div
      class="flex rounded-t-lg border border-b-0 border-gray-200 bg-white px-3"
    >
      <div class="flex w-full items-center border-b border-gray-200 py-2.5">
        <div class="flex items-center gap-3 border-r border-gray-300 pr-3">
          <select
            class="h-8 rounded border border-gray-200 bg-white text-xs px-1 text-gray-700 outline-none"
            value={currentFontSize}
            onchange={handleFontSizeChange}
            onmousedown={saveSelection}
          >
            {#each FONT_SIZES as { value, label }}
              <option {value}>{label}</option>
            {/each}
          </select>
        </div>
        <div class="flex gap-3 px-3">
          <button
            type="button"
            class="flex-center h-8 w-8 rounded transition-colors hover:bg-gray-100"
            onclick={() => execCommand('bold')}
          >
            <BoldIcon class="w-5" />
          </button>
          <button
            type="button"
            class="flex-center h-8 w-8 rounded transition-colors hover:bg-gray-100"
            onclick={() => execCommand('underline')}
          >
            <UnderlineIcon class="w-5" />
          </button>
          <button
            type="button"
            class="flex-center h-8 w-8 rounded transition-colors hover:bg-gray-100"
            onclick={handleHighlight}
          >
            <HighlightIcon class="w-5" strokeColor={highlightColor} />
          </button>
        </div>
        <div class="flex gap-3 px-3">
          <button
            type="button"
            class="flex-center h-8 w-8 rounded transition-colors hover:bg-gray-100"
            onclick={() => {
              execCommand('insertUnorderedList')
              applyListStyles()
            }}
          >
            <UnorderedListIcon class="w-5" />
          </button>
          <button
            type="button"
            class="flex-center h-8 w-8 rounded transition-colors hover:bg-gray-100"
            onclick={() => {
              execCommand('insertOrderedList')
              applyListStyles()
            }}
          >
            <OrderedListIcon class="w-5" />
          </button>
        </div>
        {#if hasLinkOption}
          <div class="flex gap-3 border-l border-gray-300 px-3">
            <button
              type="button"
              class="flex-center h-8 w-8 rounded transition-colors {hasSelection
                ? 'hover:bg-gray-100'
                : 'opacity-40 cursor-not-allowed'}"
              onclick={handleAddLink}
              disabled={!hasSelection}
              title={hasSelection ? '링크 추가' : '텍스트를 선택하세요'}
            >
              <LinkIcon class="w-5" />
            </button>
          </div>
        {/if}
        {#if hasImageOption}
          <div class="flex gap-3 border-l border-gray-300 pl-3">
            <button
              type="button"
              class="flex-center h-8 w-8 rounded transition-colors hover:bg-gray-100
                {isUploading ? 'opacity-50 pointer-events-none' : ''}"
              onclick={() => fileInput?.click()}
            >
              {#if isUploading}
                <div
                  class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"
                ></div>
              {:else}
                <ImageIcon class="w-5" />
              {/if}
            </button>
            <input
              bind:this={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              class="hidden"
              onchange={handleImageSelect}
            />
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    {id}
    class="editor min-h-100 flex-1 overflow-y-auto bg-white p-4 text-sm outline-none transition-colors {readonly
      ? 'rounded-lg border border-gray-200'
      : 'rounded-b-lg border border-t-0 border-gray-200'} {className ?? ''}"
    spellcheck="false"
    contenteditable={!readonly}
    bind:this={editor}
    oninput={syncValue}
    onpaste={handlePaste}
    onfocus={handleFocus}
    onkeydown={handleKeyDown}
    data-placeholder={placeholder}
    role="textbox"
    aria-multiline="true"
    aria-readonly={readonly}
  ></div>
</div>
