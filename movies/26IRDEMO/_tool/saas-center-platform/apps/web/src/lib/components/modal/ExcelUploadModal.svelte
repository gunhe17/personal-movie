<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Button from '../Button.svelte'
  import Typography from '@common/components/Typography.svelte'
  import UploadIcon54 from '$lib/assets/UploadIcon54.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import * as XLSX from 'xlsx'

  interface Props {
    modalId?: string
    closeModal?: () => void
    onSubmit?: (file: File) => void
    title?: string
    subtitle?: string
    description?: string
    templateData?: (string | number)[][]
    templateFileName?: string
    submitLabel?: string
    acceptHint?: string
  }

  let {
    modalId = '',
    closeModal = () => {},
    onSubmit = () => {},
    title = '엑셀 일괄 등록하기',
    subtitle,
    description = '아래 엑셀 양식 파일을 다운로드하고,\n내담자를 등록해보세요.',
    templateData: customTemplateData,
    templateFileName = '내담자_등록_템플릿.xlsx',
    submitLabel = '다음',
    acceptHint = '.xlsx, .xls 형식만 가능해요'
  }: Props = $props()

  let selectedFile = $state<File | null>(null)
  let isDragging = $state(false)
  let fileInputRef: HTMLInputElement | null = $state(null)

  function handleDragOver(event: DragEvent) {
    event.preventDefault()
    isDragging = true
  }

  function handleDragLeave() {
    isDragging = false
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    isDragging = false

    const files = event.dataTransfer?.files
    if (files && files.length > 0) {
      const file = files[0]
      if (isValidExcelFile(file)) {
        selectedFile = file
      } else {
        alert('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.')
      }
    }
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (file) {
      selectedFile = file
    }
  }

  function handleFileSelectClick() {
    fileInputRef?.click()
  }

  function removeFile() {
    selectedFile = null
    if (fileInputRef) {
      fileInputRef.value = ''
    }
  }

  function isValidExcelFile(file: File): boolean {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]
    const validExtensions = ['.xlsx', '.xls']
    const hasValidType = validTypes.includes(file.type)
    const hasValidExtension = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    )
    return hasValidType || hasValidExtension
  }

  function handleSubmit() {
    if (selectedFile) {
      onSubmit(selectedFile)
      selectedFile = null
      closeModal()
    }
  }

  function downloadTemplate() {
    const defaultTemplateData = [
      ['이름', '생년월일', '성별', '보호자 연락처'],
      ['홍길동', '2015-03-15', '남', '010-1234-5678'],
      ['김영희', '2016-07-22', '여', '010-9876-5432']
    ]

    const data = customTemplateData ?? defaultTemplateData
    const worksheet = XLSX.utils.aoa_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
    XLSX.writeFile(workbook, templateFileName)
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={true}
  size="fit"
  headerClass="px-5 py-4"
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
>
  {#snippet header()}
    <div>
      <Typography
        variant="headline-02-normal-semibold"
        color="text-body-strong"
      >
        {title}
      </Typography>
      {#if subtitle}
        <Typography
          variant="body-02-regular"
          color="text-gray-600"
          className="mt-1"
        >
          {subtitle}
        </Typography>
      {/if}
    </div>
  {/snippet}

  {#snippet body()}
    <div class="flex flex-col gap-4">
      <!-- 샘플 파일 다운로드 -->
      <div
        class="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-5 py-4"
      >
        <div>
          <Typography
            variant="body-01-semibold"
            color="text-gray-800"
            className="mb-0.5">샘플 파일 다운로드</Typography
          >
          <Typography variant="body-02-regular" color="text-gray-500">
            {description}
          </Typography>
        </div>
        <button
          type="button"
          onclick={downloadTemplate}
          class="flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="#217346" />
            <path
              d="M7 7L12 12M12 12L17 17M12 12L17 7M12 12L7 17"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="text-gray-700">템플릿 다운로드</span>
        </button>
      </div>

      <!-- 파일 업로드 영역 -->
      {#if selectedFile}
        <div
          class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
        >
          <div class="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="4" fill="#217346" />
              <path
                d="M7 7L12 12M12 12L17 17M12 12L17 7M12 12L7 17"
                stroke="white"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <Typography variant="body-02-medium" color="text-gray-700">
              {selectedFile.name}
            </Typography>
          </div>
          <Tooltip text="파일 삭제">
            <button
              type="button"
              onclick={removeFile}
              class="p-1 text-gray-400 transition-colors hover:text-gray-600"
              aria-label="파일 삭제"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M15 5L5 15M5 5L15 15"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </Tooltip>
        </div>
      {:else}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="flex min-h-55 flex-col items-center justify-center rounded-lg border border-dashed bg-gray-50 transition-colors duration-150 {isDragging
            ? 'border-primary-400 bg-primary-50'
            : 'border-gray-300'}"
          ondragover={handleDragOver}
          ondragleave={handleDragLeave}
          ondrop={handleDrop}
        >
          <UploadIcon54 />
          <Typography
            variant="body-02-regular"
            color="text-gray-700"
            className="mt-3"
          >
            파일을 여기로 드래그하여 업로드 해주세요
          </Typography>
          <Typography
            variant="label-02-regular"
            color="text-gray-500"
            className="mt-1 mb-3"
          >
            {acceptHint}
          </Typography>
          <button
            type="button"
            onclick={handleFileSelectClick}
            class="flex h-8 items-center justify-center rounded-lg border border-primary-400 px-4 transition-colors duration-200 hover:border-primary-500"
          >
            <Typography variant="body-03-medium" color="text-primary-400">
              파일 선택
            </Typography>
          </button>
        </div>
      {/if}

      <input
        bind:this={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onchange={handleFileSelect}
        class="hidden"
      />
    </div>
  {/snippet}

  {#snippet footer()}
    <Button
      class="h-11 rounded-lg {selectedFile
        ? 'bg-primary-500 hover:bg-primary-600'
        : 'cursor-not-allowed bg-action-primary-disabled'}"
      onclick={selectedFile ? handleSubmit : undefined}
      disabled={!selectedFile}
    >
      <Typography variant="body-01-normal-medium" color="text-white">
        {submitLabel}
      </Typography>
    </Button>
  {/snippet}
</BaseModal>
