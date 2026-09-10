<script lang="ts">
  import { twMerge } from 'tailwind-merge'

  import {
    postCreateRoom,
    patchModifyRoom
  } from '../../hooks/actions/room.action'
  import { mutationBuilder } from '../../hooks/queries/builder'
  import { appInstance } from '../../services/api/instances'

  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import CameraIcon from '../../assets/CameraIcon.svelte'
  import { centerId } from '../../stores/center.store'

  interface Props {
    id?: string
    modalId?: string
    name?: string
    description?: string
    memo?: string
    thumbnail_url?: string
    closeModal?: () => void
    onSuccessAfterCreate?: (created: any) => void
  }

  let {
    id = '',
    modalId = '',
    name = '',
    thumbnail_url = '',
    description = '',
    memo = '',
    closeModal = () => {},
    onSuccessAfterCreate
  }: Props = $props()

  const createRoom = mutationBuilder(postCreateRoom, ['getRoomList'])
  const modifyRoom = mutationBuilder(patchModifyRoom, ['getRoomList'])

  // 폼 상태
  // keep a local `thumbnail` variable for preview/binding (template uses `thumbnail`)
  let thumbnail = $derived(thumbnail_url)
  let selectedFile = $state<File | null>(null)
  let uploading = $state(false)
  let fileInput: HTMLInputElement | null = null

  const handleConfirm = () => {
    const request = id
      ? {
          center_id: $centerId,
          name,
          thumbnail_url: thumbnail,
          memo,
          room_id: id,
          description
        }
      : {
          name,
          description,
          center_id: $centerId,
          thumbnail_url: thumbnail,
          memo
        }

    if (id) {
      modifyRoom.mutate(request, {
        onSuccess() {
          closeModal()
        }
      })
    } else {
      createRoom.mutate(request, {
        onSuccess(data: any) {
          const created = data?.data ?? data
          onSuccessAfterCreate?.(created)
          closeModal()
        }
      })
    }
  }

  const onImageChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    selectedFile = file

    const reader = new FileReader()
    reader.onload = async () => {
      // 자동 업로드 트리거
      await uploadImage()
    }
    reader.readAsDataURL(file)
  }

  const uploadImage = async () => {
    if (!selectedFile) return
    uploading = true
    try {
      const form = new FormData()
      form.append('file', selectedFile)
      const query = `?category=room-thumbnail&entity_id=${$centerId}`
      const res = await appInstance.post(`/upload/images${query}`, form)
      const data = res?.data ?? res
      const url = data?.url ?? data?.data?.url
      const path = data?.path ?? data?.data?.path
      if (url) thumbnail = ''
      // prefer storing storage path into thumbnail (for DB)
      if (path) thumbnail = url ?? ''
    } catch (err) {
      console.error('Image upload failed', err)
    } finally {
      uploading = false
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
  title="상담실 정보를 입력해주세요"
>
  {#snippet body()}
    <div class="flex max-h-162.5 flex-col">
      <div class="mb-6">
        <label for="name" class="field-label mb-2"> 상담실 이미지 </label>
        <div class="flex gap-3">
          <label
            class="relative w-25 h-25 rounded-lg flex-center cursor-pointer bg-gray-100"
          >
            {#if thumbnail}
              <img
                src={thumbnail}
                alt="logo"
                class="object-cover w-full h-full rounded-lg"
              />
            {:else}
              <CameraIcon />
            {/if}
            <input
              bind:this={fileInput}
              type="file"
              class="hidden"
              accept="image/png,image/jpeg"
              onchange={onImageChange}
            />
          </label>
          <div class="text-xs text-gray-500 py-2">
            <button
              class="mb-2 h-11 rounded-lg border border-gray-200 px-6 transition-colors hover:border-gray-300 hover:bg-gray-50"
              onclick={() => fileInput?.click()}
            >
              <Typography variant="body-01-normal-medium" color="text-gray-600">
                이미지 등록
              </Typography>
            </button>
            <Typography
              variant="body-03-reading-regular"
              color="text-caption-default"
            >
              권장크기: 80 x 80 px
            </Typography>
            <Typography
              variant="body-03-reading-regular"
              color="text-caption-default"
            >
              용량: 10MB 이하, 파일형식 JPG, PNG
            </Typography>
          </div>
        </div>
      </div>
      <div class="mb-6">
        <label for="name" class="field-label mb-2">
          상담실명 <span class="field-required">*</span>
        </label>
        <input
          type="text"
          name="name"
          bind:value={name}
          placeholder="상담실명을 입력해주세요"
          class="field-input w-full"
        />
      </div>
      <div class="mb-6">
        <label for="description" class="field-label mb-2">
          상담실 설명 <span class="field-required">*</span>
        </label>
        <input
          type="text"
          name="description"
          bind:value={description}
          placeholder="상담실에 대한 설명을 입력해주세요"
          class="field-input w-full"
        />
      </div>
      <div class="mb-6">
        <label for="memo" class="field-label mb-2"> 메모 </label>
        <input
          type="text"
          name="memo"
          bind:value={memo}
          placeholder="추가 메모를 입력해주세요"
          class="field-input w-full"
        />
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end">
      <button
        disabled={!name || !description}
        onclick={handleConfirm}
        class={twMerge(
          'flex h-11 w-40 items-center justify-center rounded-lg bg-primary-500',
          'text-white transition-colors hover:bg-primary-400 disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg disabled:cursor-not-allowed'
        )}
      >
        <Typography variant="body-01-normal-medium" color="text-white"
          >등록</Typography
        >
      </button>
    </div>
  {/snippet}
</BaseModal>
