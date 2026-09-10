<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { fade } from 'svelte/transition'
  import { onDestroy, untrack } from 'svelte'

  import { documentUploadStore } from '../../mocks/docUploadStore'

  import Button from '../Button.svelte'
  import BaseModal from './BaseModal.svelte'
  import CloseIcon from '$lib/assets/CloseIcon.svelte'
  import FileUploadIcon from '$lib/assets/FileUploadIcon.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { requireCenterId } from '$lib/stores/center.store'
  import { postRaw } from '$lib/services/api/instances'

  export interface UploadedDocumentResult {
    id: string
    name: string
    original_name: string | null
    description: string | null
    file_type: string
    file_size: number
    created_at: string
  }

  interface Props {
    modalId?: string
    closeModal?: () => void
    onConfirm?: (uploadedDocs: UploadedDocumentResult[]) => void | Promise<void>
    maxFiles?: number
  }

  let {
    modalId,
    closeModal = () => {},
    onConfirm = () => {},
    maxFiles = 10
  }: Props = $props()

  const MAX_FILES = Math.max(1, maxFiles)
  const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
  const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf']
  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

  let fileInput = $state<HTMLInputElement | null>(null)
  let isDragging = $state<boolean>(false)
  let lastUploadStatus = $state<'idle' | 'uploading' | 'error' | 'success'>(
    'idle'
  )

  const isValidType = (file: File) => {
    const mimeValid = ALLOWED_MIME_TYPES.includes(file.type)
    const ext = file.name.split('.').pop()?.toLowerCase()
    const extValid = ext ? ALLOWED_EXTENSIONS.includes(ext) : false
    return mimeValid && extValid
  }

  const validateFiles = (files: File[]) => {
    const existingCount = $documentUploadStore.files.length

    return files.filter((file, index) => {
      if (existingCount + index >= MAX_FILES) return false
      if (file.size > MAX_FILE_SIZE) return false
      if (!isValidType(file)) return false
      return true
    })
  }

  const handleFiles = (files: FileList | File[]) => {
    const validFiles = validateFiles(Array.from(files))
    if (validFiles.length === 0) return

    const dt = new DataTransfer()
    validFiles.forEach((f) => dt.items.add(f))

    documentUploadStore.clearError()
    documentUploadStore.addFiles(dt.files)
  }

  const formatFileSize = (size: number) => `${Math.ceil(size / 1024)}KB`

  const onChange = (e: Event) => {
    if (!fileInput) return
    const files = (e.target as HTMLInputElement).files
    if (files) handleFiles(files)
    fileInput.value = ''
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    isDragging = false
    if (e.dataTransfer?.files) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const onSubmitUpload = async () => {
    if (
      $documentUploadStore.files.length === 0 ||
      $documentUploadStore.isUploading
    )
      return

    try {
      documentUploadStore.setUploading()

      const centerId = requireCenterId()
      const uploadedDocs: UploadedDocumentResult[] = []

      for (const item of $documentUploadStore.files) {
        const formData = new FormData()
        formData.append('file', item.file)

        const title = item.title.trim()
        if (title) {
          formData.append('name', title)
        }

        const result = await postRaw<UploadedDocumentResult>(
          `/centers/${centerId}/documents`,
          formData
        )
        uploadedDocs.push(result)
      }

      documentUploadStore.setUploadSuccess()
      await Promise.resolve(onConfirm(uploadedDocs))
      snackbarStore.success('문서 등록을 완료했어요.')
      documentUploadStore.reset()
      closeModal()
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '문서 등록에 실패했어요.'
      documentUploadStore.setUploadError(errorMessage)
    }
  }

  $effect(() => {
    const currentStatus = $documentUploadStore.status
    const prevStatus = untrack(() => lastUploadStatus)

    if (currentStatus === 'error' && prevStatus !== 'error') {
      snackbarStore.error(
        $documentUploadStore.errorMessage ??
          '파일 업로드에 실패했어요. 다시 시도해 주세요.'
      )
    }
    lastUploadStatus = currentStatus
  })

  onDestroy(() => {
    documentUploadStore.reset()
  })
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  size="lg"
  title="문서를 등록할게요"
  bodyClass="p-5 pb-7"
>
  {#snippet body()}
    <div class="flex-center flex-col mb-4">
      <FileUploadIcon size={54} />
      <Typography
        variant="body-01-reading-regular"
        color="text-gray-600"
        className="mt-3"
      >
        JPG, PNG, PDF 파일을 업로드할 수 있어요
      </Typography>
      <Typography variant="body-01-reading-regular" color="text-gray-600">
        한 파일당 20MB 이하, 최대 {MAX_FILES}개까지 등록 가능합니다.
      </Typography>
    </div>
    {#if $documentUploadStore.status === 'uploading'}
      <div
        in:fade
        class="h-29.5 border border-dashed rounded-lg flex-center border-gray-300 flex-col bg-[#F8F9FB] transition-colors duration-150"
      >
        <svg
          width="30"
          height="30"
          viewBox="0 0 30 30"
          fill="none"
          class="animate-spin mb-4"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M15 2.10352C15 0.860875 16.013 -0.163764 17.2416 0.0219428C19.6069 0.379442 21.8639 1.29941 23.8168 2.71826C26.3795 4.58018 28.287 7.20561 29.2658 10.2183C30.2447 13.2309 30.2447 16.4761 29.2658 19.4888C28.287 22.5014 26.3795 25.1269 23.8168 26.9888C21.2541 28.8507 18.1677 29.8535 15 29.8535C11.8323 29.8535 8.74593 28.8507 6.18322 26.9888C3.62051 25.1268 1.71302 22.5014 0.734152 19.4888C-0.0117797 17.193 -0.189286 14.7622 0.201633 12.4022C0.4047 11.1763 1.69221 10.5295 2.87403 10.9135C4.05585 11.2975 4.6762 12.5702 4.55231 13.8066C4.40813 15.2457 4.56199 16.7073 5.01391 18.0982C5.69911 20.207 7.03435 22.0448 8.82825 23.3482C10.6222 24.6515 12.7826 25.3535 15 25.3535C17.2174 25.3535 19.3778 24.6515 21.1717 23.3482C22.9656 22.0448 24.3009 20.2071 24.9861 18.0982C25.6713 15.9893 25.6713 13.7177 24.9861 11.6088C24.3009 9.49998 22.9656 7.66218 21.1717 6.35884C19.9886 5.49925 18.646 4.90124 17.2329 4.59367C16.0186 4.3294 15 3.34616 15 2.10352Z"
            fill="#4C87F6"
          />
        </svg>
        <Typography variant="body-02-regular" color="text-gray-700">
          파일을 업로드 하고 있어요. 잠시만 기다려 주세요
        </Typography>
      </div>
    {:else if $documentUploadStore.status === 'error'}
      <div
        in:fade
        class="h-29.5 border border-dashed rounded-lg flex-center flex-col bg-[#F8F9FB] border-gray-300 transition-colors duration-150"
      >
        <Typography
          variant="body-02-regular"
          color="text-gray-700"
          className="mb-3"
        >
          {$documentUploadStore.errorMessage ??
            '파일 업로드에 실패했어요. 다시 시도해 주세요'}
        </Typography>
        <button
          class="h-8 rounded-lg border border-primary-400 px-4 hover:border-primary-500 duration-200"
          onclick={() => fileInput?.click()}
        >
          <Typography variant="body-03-medium" color="text-primary-400">
            파일 선택
          </Typography>
        </button>
      </div>
    {:else}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        in:fade
        class={twMerge(
          'h-29.5 border border-dashed rounded-lg flex-center flex-col bg-[#F8F9FB] transition-colors duration-150',
          isDragging ? 'border-primary-400 bg-primary-50' : 'border-gray-300'
        )}
        ondragenter={(e) => {
          e.preventDefault()
          isDragging = true
        }}
        ondragover={(e) => {
          e.preventDefault()
          isDragging = true
        }}
        ondragleave={(e) => {
          e.preventDefault()
          isDragging = false
        }}
        ondrop={onDrop}
      >
        <Typography
          variant="body-02-regular"
          color="text-gray-700"
          className="mb-2"
        >
          파일을 여기로 드래그하여 업로드 해주세요
        </Typography>
        <Typography
          variant="label-02-regular"
          color="text-gray-500"
          className="mb-3"
        >
          PNG, JPG, JPEG, PDF 형식만 가능해요
        </Typography>
        <button
          class="h-8 rounded-lg border border-primary-400 px-4 hover:border-primary-500 duration-200"
          onclick={() => {
            fileInput && fileInput.click()
          }}
        >
          <Typography variant="body-03-medium" color="text-primary-400">
            파일 선택
          </Typography>
        </button>
      </div>
    {/if}
    <input
      bind:this={fileInput}
      type="file"
      multiple={MAX_FILES > 1}
      accept=".jpg,.jpeg,.png,.pdf"
      class="hidden"
      onchange={onChange}
    />
    {#if $documentUploadStore.files.length > 0}
      <div transition:fade class="space-y-2 mt-4">
        <div class="flex justify-between items-center text-xs text-gray-500">
          <Typography variant="body-03-regular" color="text-gray-600">
            <span class="text-primary-500">
              {$documentUploadStore.files.length}
            </span>
            / {MAX_FILES}개
          </Typography>
          <button onclick={() => documentUploadStore.reset()}>
            <Typography
              variant="body-03-regular"
              color="text-gray-600"
              className="hover:underline"
            >
              전체삭제
            </Typography>
          </button>
        </div>
        {#each $documentUploadStore.files as f (f.id)}
          <div class="border border-gray-200 rounded-lg bg-white p-3 space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="flex gap-1 items-center min-w-0">
                <svg
                  class="shrink-0"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8.16667 1.1665H3.5C2.85567 1.1665 2.33333 1.68884 2.33333 2.33317V11.6665C2.33333 12.3108 2.85567 12.8332 3.5 12.8332H10.5C11.1443 12.8332 11.6667 12.3108 11.6667 11.6665V4.6665L8.16667 1.1665Z"
                    fill="#9BAFC4"
                  />
                  <path d="M8.1665 1.1665V4.6665H11.6665" fill="#C7D4E3" />
                </svg>
                <Typography
                  variant="body-02-regular"
                  color="text-gray-800"
                  className="truncate-safe"
                >
                  {f.file.name}
                </Typography>
                <Typography variant="body-03-regular" color="text-gray-500">
                  {formatFileSize(f.file.size)}
                </Typography>
              </div>
              <button
                class="shrink-0 flex-center h-5 w-5 rounded-full bg-gray-200 hover:bg-gray-300"
                onclick={() => documentUploadStore.removeFile(f.id)}
              >
                <CloseIcon size={10} color="#ffffff" />
              </button>
            </div>
            <input
              class="field-input w-full"
              placeholder="문서 이름을 입력해주세요"
              value={f.title}
              oninput={(e) =>
                documentUploadStore.setFileTitle(
                  f.id,
                  (e.target as HTMLInputElement).value
                )}
            />
          </div>
        {/each}
      </div>
    {/if}
  {/snippet}
  {#snippet footer()}
    <div class="flex justify-end">
      <Button
        class="h-11 rounded-lg bg-primary px-8"
        onclick={onSubmitUpload}
        disabled={$documentUploadStore.files.length === 0 ||
          $documentUploadStore.isUploading}
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          등록
        </Typography>
      </Button>
    </div>
  {/snippet}
</BaseModal>
