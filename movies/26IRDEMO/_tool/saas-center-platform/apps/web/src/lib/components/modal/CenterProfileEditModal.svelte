<!--
  CenterProfileEditModal
  센터 기본 정보(로고·센터명·대표자·사업자번호·주소·전화·소개) 수정 모달.

  form은 페이지가 소유한 $state 프록시를 그대로 받아 직접 바인딩한다 —
  에이전트 page-tool이 같은 객체에 쓰기 때문에 사본을 뜨면 입력이 화면에 반영되지 않는다.
-->
<script lang="ts">
  import { twMerge } from 'tailwind-merge'

  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Select from '$lib/components/Select.svelte'
  import CameraIcon from '$lib/assets/CameraIcon.svelte'
  import {
    PHONE_PREFIXES,
    type CenterProfileForm
  } from '$lib/features/center/info'
  import type { CenterDetailResponse } from '$lib/hooks/actions/center.action'

  interface Props {
    modalId?: string
    center: CenterDetailResponse
    form: CenterProfileForm
    onSubmit: (selectedFile: File | null) => Promise<boolean>
    closeModal?: () => void
  }

  let {
    modalId = '',
    center,
    form,
    onSubmit,
    closeModal = () => {}
  }: Props = $props()

  let logoPreview = $state<string | null>(center.logo_url || null)
  let selectedFile = $state<File | null>(null)
  let fileInput = $state<HTMLInputElement | undefined>(undefined)
  let isSubmitting = $state(false)
  let isAddressSearching = $state(false)

  const inputClass = 'field-input'

  const onImageChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    selectedFile = file
    const reader = new FileReader()
    reader.onload = () => {
      logoPreview = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  function openAddressSearch() {
    if (isAddressSearching) return
    const { kakao } = window as any
    if (!kakao?.Postcode) return
    isAddressSearching = true
    new kakao.Postcode({
      oncomplete: (data: any) => {
        form.zipCode = data.zonecode || ''
        form.address =
          data.address || data.roadAddress || data.jibunAddress || ''
        isAddressSearching = false
      },
      onclose: () => {
        isAddressSearching = false
      }
    }).open()
  }

  const handleSubmit = async () => {
    if (isSubmitting) return
    isSubmitting = true
    try {
      const success = await onSubmit(selectedFile)
      if (success) closeModal()
    } finally {
      isSubmitting = false
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  size="lg"
  title="센터 정보를 수정할게요"
  headerClass="px-5 py-4"
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
>
  {#snippet body()}
    <div class="space-y-6">
      <!-- 센터 로고 -->
      <div class="flex gap-3">
        <label
          class="flex-center relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-gray-100"
        >
          {#if logoPreview}
            <img
              src={logoPreview}
              alt="센터 로고"
              class="h-full w-full rounded-lg object-cover"
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
        <!-- 안내 문구가 위, 등록 버튼이 아래 — 조건을 읽고 나서 고르는 순서 -->
        <div class="flex flex-col items-start gap-2 py-1">
          <div>
            <Typography
              variant="body-03-reading-regular"
              color="text-caption-default"
              className="block"
            >
              권장크기 80 x 80 px
            </Typography>
            <Typography
              variant="body-03-reading-regular"
              color="text-caption-default"
              className="block"
            >
              10MB 이하 · JPG, PNG
            </Typography>
          </div>
          <button
            type="button"
            onclick={() => fileInput?.click()}
            class="h-9 rounded-lg border border-gray-200 px-5 transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            <Typography variant="body-02-normal-medium" color="text-gray-600">
              이미지 등록
            </Typography>
          </button>
        </div>
      </div>

      <div class="space-y-2">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          센터명
        </Typography>
        <input class={inputClass} bind:value={form.centerName} />
      </div>

      <div class="space-y-2">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          대표자명
        </Typography>
        <input class={inputClass} bind:value={form.ownerName} />
      </div>

      <div class="space-y-2">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          사업자등록번호
        </Typography>
        <input
          class={inputClass}
          bind:value={form.businessNumber}
          placeholder="000-00-00000"
        />
      </div>

      <div class="space-y-2">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          주소
        </Typography>
        <div class="flex gap-2">
          <input
            value={form.zipCode}
            placeholder="우편번호"
            readonly
            class={twMerge(inputClass, 'w-28 cursor-default bg-gray-50')}
          />
          <button
            type="button"
            onclick={openAddressSearch}
            class="text-body-03-normal-medium h-11 shrink-0 rounded-lg border border-primary-400 px-4 text-primary-600 hover:bg-primary-50"
          >
            주소 검색
          </button>
        </div>
        <input
          value={form.address}
          placeholder="주소를 검색해주세요"
          readonly
          class={twMerge(inputClass, 'cursor-default bg-gray-50')}
        />
        <input
          class={inputClass}
          bind:value={form.addressDetail}
          placeholder="상세 주소 (동/호수)"
        />
      </div>

      <div class="space-y-2">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          센터 전화번호
        </Typography>
        <div class="flex gap-2">
          <Select
            class="text-body-01-normal-regular"
            bind:selected={form.phonePrefix}
            options={PHONE_PREFIXES}
          />
          <input
            class={twMerge(inputClass, 'grow bg-white')}
            bind:value={form.phoneBody}
            placeholder="1234-5678"
          />
        </div>
      </div>

      <div class="space-y-2">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          센터 소개
        </Typography>
        <textarea
          bind:value={form.description}
          placeholder="센터를 소개하는 문구를 입력해주세요"
          rows="4"
          class={twMerge(
            inputClass,
            'h-auto resize-none px-3 py-3.5 leading-relaxed'
          )}
        ></textarea>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex justify-end gap-2 px-3 py-3.5">
      <button
        type="button"
        onclick={closeModal}
        class="text-body-01-normal-medium flex h-11 w-30 items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
      >
        취소
      </button>
      <button
        type="button"
        onclick={handleSubmit}
        disabled={isSubmitting}
        class="text-body-01-normal-medium flex h-11 w-35 items-center justify-center rounded-lg bg-primary-500 text-white hover:bg-primary-400 disabled:cursor-not-allowed disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
      >
        {#if isSubmitting}
          <div
            class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-white"
          ></div>
        {/if}
        저장
      </button>
    </div>
  {/snippet}
</BaseModal>
