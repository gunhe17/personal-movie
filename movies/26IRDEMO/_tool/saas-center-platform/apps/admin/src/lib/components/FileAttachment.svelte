<script lang="ts">
  import { appInstance } from '$services/api/instances'
  import type { AttachmentItem } from '$hooks/actions/notice.action'

  interface Props {
    attachments?: AttachmentItem[]
    noticeId?: string
    maxFiles?: number
    readonly?: boolean
    onchange?: (attachments: AttachmentItem[]) => void
  }

  let {
    attachments = $bindable([]),
    noticeId = 'draft',
    maxFiles = 5,
    readonly = false,
    onchange
  }: Props = $props()

  const MAX_FILE_SIZE = 10 * 1024 * 1024
  const ALLOWED_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'hwp', 'hwpx'
  ]

  let fileInput: HTMLInputElement | null = $state(null)
  let isDragging = $state(false)
  let isUploading = $state(false)

  function getExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() ?? ''
  }

  function validateFile(file: File): string | null {
    const ext = getExtension(file.name)
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `허용되지 않는 파일 형식입니다: .${ext}`
    }
    if (file.size > MAX_FILE_SIZE) {
      return '파일 크기는 최대 10MB까지 가능합니다.'
    }
    if (file.size === 0) {
      return '빈 파일은 업로드할 수 없습니다.'
    }
    return null
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  function getFileIcon(contentType: string): string {
    if (contentType.startsWith('image/')) return '🖼️'
    if (contentType === 'application/pdf') return '📄'
    if (contentType.includes('word') || contentType.includes('document')) return '📝'
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) return '📊'
    if (contentType.includes('powerpoint') || contentType.includes('presentation')) return '📑'
    if (contentType.includes('hwp')) return '📃'
    return '📎'
  }

  async function uploadFiles(files: File[]) {
    if (isUploading) return

    const remaining = maxFiles - attachments.length
    if (remaining <= 0) {
      alert(`최대 ${maxFiles}개까지 첨부할 수 있습니다.`)
      return
    }

    const filesToUpload = files.slice(0, remaining)
    isUploading = true

    try {
      for (const file of filesToUpload) {
        const error = validateFile(file)
        if (error) {
          alert(error)
          continue
        }

        const formData = new FormData()
        formData.append('file', file)

        const response = await appInstance.post(
          `/admin/notices/attachments/upload?notice_id=${noticeId}`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        )

        const item: AttachmentItem = response.data
        attachments = [...attachments, item]
      }
      onchange?.(attachments)
    } catch (e) {
      console.error('파일 업로드 실패:', e)
      alert('파일 업로드에 실패했습니다.')
    } finally {
      isUploading = false
    }
  }

  function removeFile(index: number) {
    attachments = attachments.filter((_, i) => i !== index)
    onchange?.(attachments)
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement
    const files = input.files
    if (files) uploadFiles(Array.from(files))
    input.value = ''
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    isDragging = false
    if (event.dataTransfer?.files) {
      uploadFiles(Array.from(event.dataTransfer.files))
    }
  }
</script>

<div>
  <!-- svelte-ignore a11y_label_has_associated_control -->
  <label class="mb-1.5 block text-sm font-medium text-gray-700">
    첨부파일
    <span class="font-normal text-gray-400">({attachments.length}/{maxFiles})</span>
  </label>

  {#if !readonly}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-6 transition-colors duration-150
        {isDragging ? 'border-primary-400 bg-primary-50' : 'border-gray-300 bg-gray-50'}
        {isUploading ? 'pointer-events-none opacity-50' : ''}"
      ondragenter={(e) => { e.preventDefault(); isDragging = true }}
      ondragover={(e) => { e.preventDefault(); isDragging = true }}
      ondragleave={(e) => { e.preventDefault(); isDragging = false }}
      ondrop={handleDrop}
    >
      {#if isUploading}
        <div class="mb-2 h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-primary-500"></div>
        <p class="text-sm text-gray-500">업로드 중...</p>
      {:else}
        <p class="mb-1 text-sm text-gray-600">파일을 여기로 드래그하거나</p>
        <button
          type="button"
          class="rounded-md border border-primary-400 px-4 py-1.5 text-sm font-medium text-primary-500 transition-colors hover:border-primary-500 hover:bg-primary-50"
          onclick={() => fileInput?.click()}
        >
          파일 선택
        </button>
        <p class="mt-2 text-xs text-gray-400">
          이미지, 문서, 한글 파일 · 최대 10MB · {maxFiles}개까지
        </p>
      {/if}
    </div>

    <input
      bind:this={fileInput}
      type="file"
      multiple
      accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.hwpx"
      class="hidden"
      onchange={handleFileSelect}
    />
  {/if}

  {#if attachments.length > 0}
    <div class="mt-3 space-y-2">
      {#each attachments as file, index}
        <div class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <span class="text-base">{getFileIcon(file.content_type)}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-gray-800">{file.name}</p>
            <p class="text-xs text-gray-400">{formatFileSize(file.size)}</p>
          </div>
          {#if readonly}
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              class="shrink-0 text-xs text-primary-500 hover:underline"
            >
              다운로드
            </a>
          {:else}
            <button
              type="button"
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
              onclick={() => removeFile(index)}
            >
              ✕
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
