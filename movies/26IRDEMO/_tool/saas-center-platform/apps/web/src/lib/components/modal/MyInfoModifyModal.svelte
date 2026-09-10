<script lang="ts">
  import type { MemberDetailResponse } from '$lib/hooks/actions/member.action'
  import { appInstance } from '$lib/services/api/instances'
  import { centerId } from '$lib/stores/center.store'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import DatePickerInput from '../DatePickerInput.svelte'
  import AvatarImage from '$lib/assets/memberAvatar.png'

  export interface MyInfoModifyFormData {
    name?: string
    birth?: string
    phone?: string
    profile_image_url?: string
  }

  interface Props {
    modalId?: string
    member?: MemberDetailResponse
    closeModal?: () => void
    onConfirm?: (data: MyInfoModifyFormData) => Promise<void>
  }

  let {
    modalId = '',
    member,
    closeModal = () => {},
    onConfirm
  }: Props = $props()

  let memberName = $state('')
  let birth = $state('')
  let phone = $state('')
  let profileImageUrl = $state('')
  let profileImagePreview = $state('')
  let selectedFile = $state<File | null>(null)
  let uploading = $state(false)
  let isSubmitting = $state(false)

  let fileInput = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (!member) return
    memberName = member.person.name || ''
    birth = member.person.birth || ''
    phone = member.person.phone || ''
    profileImageUrl = member.profile_image_url || ''
    profileImagePreview = member.profile_image_url || ''
  })

  const onImageChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    // 파일 형식 검증
    const validTypes = ['image/jpeg', 'image/png']
    if (!validTypes.includes(file.type)) {
      return
    }

    // 파일 크기 검증 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return
    }

    selectedFile = file

    const reader = new FileReader()
    reader.onload = () => {
      profileImagePreview = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  const uploadProfileImage = async (): Promise<string | null> => {
    if (!selectedFile) return null
    uploading = true
    try {
      const form = new FormData()
      form.append('file', selectedFile)
      const query = `?category=profile&entity_id=${$centerId}`
      const res = await appInstance.post(`/upload/images${query}`, form)
      const data = res?.data ?? res
      const url = data?.url ?? data?.data?.url
      return url ?? null
    } catch (err) {
      console.error('Profile image upload failed', err)
      return null
    } finally {
      uploading = false
    }
  }

  const handleConfirm = async () => {
    if (!member || isSubmitting) return
    isSubmitting = true
    try {
      let imageUrl = profileImageUrl

      // 새 이미지가 선택된 경우 업로드
      if (selectedFile) {
        const uploadedUrl = await uploadProfileImage()
        if (uploadedUrl) {
          imageUrl = uploadedUrl
        }
      }

      await onConfirm?.({
        name: memberName,
        birth,
        phone,
        profile_image_url: imageUrl || undefined
      })
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
  size="lg"
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
  title="내 정보 수정"
>
  {#snippet body()}
    <div class="flex max-h-162.5 flex-col">
      <!-- 프로필 이미지 -->
      <div class="mb-6">
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          프로필 이미지
        </Typography>
        <div class="flex items-start gap-4">
          <label
            class="relative w-25 h-25 rounded-lg flex-center cursor-pointer bg-gray-100 overflow-hidden"
          >
            {#if profileImagePreview}
              <img
                src={profileImagePreview}
                alt="프로필"
                class="object-cover w-full h-full"
              />
            {:else}
              <img
                src={AvatarImage}
                alt="기본 프로필"
                class="object-cover w-full h-full"
              />
            {/if}
            <input
              bind:this={fileInput}
              type="file"
              accept=".jpg,.jpeg,.png"
              class="hidden"
              onchange={onImageChange}
            />
          </label>
          <div class="flex flex-col gap-1">
            <button
              onclick={() => fileInput?.click()}
              class="w-30 rounded-lg border border-gray-200 px-4 py-3 text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              <Typography variant="body-01-normal-medium" color="text-gray-600">
                이미지 등록
              </Typography>
            </button>
            <Typography
              variant="body-03-reading-regular"
              color="text-caption-default"
              className="whitespace-pre-wrap"
            >
              {'권장크기: 80 x 80 px\n용량: 10MB 이하, 파일 형식 JPG, PNG'}
            </Typography>
          </div>
        </div>
      </div>

      <!-- 이름 -->
      <div class="mb-6">
        <label for="myInfoName">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">이름</Typography
          >
        </label>
        <input
          type="text"
          id="myInfoName"
          bind:value={memberName}
          placeholder="이름을 입력해주세요"
          class="field-input w-full"
        />
      </div>

      <!-- 생년월일 -->
      <div class="mb-6">
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2">생년월일</Typography
        >
        <DatePickerInput bind:value={birth} class="flex-1" />
      </div>

      <!-- 이메일 (읽기전용) -->
      <div class="mb-6">
        <label for="myInfoEmail">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">이메일</Typography
          >
        </label>
        <input
          type="text"
          id="myInfoEmail"
          value={member?.person.email || ''}
          disabled
          class="field-input w-full"
        />
      </div>

      <!-- 연락처 -->
      <div class="mb-6">
        <label for="myInfoPhone">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">연락처</Typography
          >
        </label>
        <input
          type="text"
          id="myInfoPhone"
          bind:value={phone}
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
        disabled={isSubmitting || uploading}
        class="flex h-11 w-40 items-center justify-center rounded-lg bg-primary-500 text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          수정
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
