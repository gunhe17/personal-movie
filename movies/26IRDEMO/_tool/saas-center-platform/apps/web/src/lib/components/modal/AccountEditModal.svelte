<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'

  export interface AccountEditFormData {
    name: string
    phone: string
    profileImage?: File | null
  }

  interface Props {
    modalId?: string
    email?: string
    name?: string
    phone?: string
    profileImageUrl?: string | null
    closeModal?: () => void
    onConfirm?: (data: AccountEditFormData) => Promise<void>
  }

  let {
    modalId = '',
    email = '',
    name = '',
    phone = '',
    profileImageUrl = null,
    closeModal = () => {},
    onConfirm
  }: Props = $props()

  let editName = $state('')
  let editPhone = $state('')
  let profileImage = $state<File | null>(null)
  let profilePreview = $state<string | null>(null)
  let isSubmitting = $state(false)
  let fileInput = $state<HTMLInputElement | null>(null)

  $effect(() => {
    editName = name
    editPhone = phone
    profilePreview = profileImageUrl ?? null
  })

  function handleImageUpload() {
    fileInput?.click()
  }

  function onFileChange(e: Event) {
    const target = e.currentTarget as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하여야 합니다.')
      return
    }

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      alert('JPG, PNG 파일만 업로드 가능합니다.')
      return
    }

    profileImage = file
    profilePreview = URL.createObjectURL(file)
  }

  const handleConfirm = async () => {
    if (isSubmitting) return
    isSubmitting = true
    try {
      await onConfirm?.({ name: editName, phone: editPhone, profileImage })
      closeModal()
    } finally {
      isSubmitting = false
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={true}
  size="md"
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
  title="정보 수정"
>
  {#snippet body()}
    <div class="flex flex-col">
      <!-- 프로필 이미지 -->
      <div class="mb-6">
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-3"
        >
          프로필 이미지
        </Typography>
        <div
          class="flex items-center gap-4 rounded-lg border border-gray-200 px-4 py-4"
        >
          <!-- 프로필 미리보기 -->
          <div
            class="flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100"
          >
            {#if profilePreview}
              <img
                src={profilePreview}
                alt="프로필"
                class="h-full w-full object-cover"
              />
            {:else}
              <svg
                class="h-7 w-7 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            {/if}
          </div>
          <div>
            <button
              type="button"
              onclick={handleImageUpload}
              class="text-body-03-normal-medium rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              이미지 등록
            </button>
            <p class="text-body-03-reading-regular text-caption-default mt-2">
              권장크기: 80 x 80 px
            </p>
            <p class="text-body-03-reading-regular text-caption-default">
              용량 : 10MB 이하, 파일 형식 JPG, PNG
            </p>
          </div>
        </div>
        <input
          bind:this={fileInput}
          type="file"
          accept="image/jpeg,image/png"
          class="hidden"
          onchange={onFileChange}
        />
      </div>

      <!-- 이름 -->
      <div class="mb-6">
        <label for="accountName" class="field-label mb-2"> 이름 </label>
        <input
          type="text"
          id="accountName"
          bind:value={editName}
          placeholder="이름을 입력해주세요"
          class="field-input w-full"
        />
      </div>

      <!-- 로그인 이메일 (읽기전용 텍스트) -->
      <div class="mb-6">
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          로그인 이메일
        </Typography>
        <Typography variant="body-01-regular" color="text-gray-800">
          {email}
        </Typography>
      </div>

      <!-- 연락처 -->
      <div>
        <label for="accountPhone" class="field-label mb-2"> 연락처 </label>
        <input
          type="text"
          id="accountPhone"
          bind:value={editPhone}
          placeholder="연락처를 입력해주세요"
          class="field-input w-full"
        />
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end">
      <button
        onclick={handleConfirm}
        disabled={isSubmitting}
        class="flex h-11 w-40 items-center justify-center rounded-lg bg-primary-500 text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          수정
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
