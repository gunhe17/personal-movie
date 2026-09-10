<script lang="ts">
  import ArrowLeftIcon24 from '$lib/assets/ArrowLeftIcon24.svelte'
  import MindScopeLogo from '$lib/assets/MindScopeLogo.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import {
    registerCenter,
    type CenterRegisterParams
  } from '$lib/features/signup/center-register-service'
  import Typography from '@common/components/Typography.svelte'

  let name = $state('')
  let phone = $state('')
  let zipCode = $state('')
  let address = $state('')
  let addressDetail = $state('')
  let brn = $state('')
  let repName = $state('')

  let loading = $state(false)
  let error = $state('')
  let isAddressSearching = $state(false)

  /** 전화번호 자동 하이픈 (02 지역번호 대응) */
  function onPhoneInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement
    const digits = target.value.replace(/\D/g, '').slice(0, 11)
    const is02 = digits.startsWith('02')

    if (is02) {
      if (digits.length <= 2) {
        phone = digits
      } else if (digits.length <= 6) {
        phone = `${digits.slice(0, 2)}-${digits.slice(2)}`
      } else {
        phone = `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(digits.length - 4)}`
      }
    } else {
      if (digits.length <= 3) {
        phone = digits
      } else if (digits.length <= 7) {
        phone = `${digits.slice(0, 3)}-${digits.slice(3)}`
      } else {
        phone = `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(digits.length - 4)}`
      }
    }
  }

  /** 사업자등록번호 자동 하이픈 */
  function onBrnInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement
    const digits = target.value.replace(/\D/g, '').slice(0, 10)
    if (digits.length <= 3) {
      brn = digits
    } else if (digits.length <= 5) {
      brn = `${digits.slice(0, 3)}-${digits.slice(3)}`
    } else {
      brn = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
    }
  }

  /** 다음 주소 검색 API */
  function openAddressSearch() {
    if (isAddressSearching) return
    const { kakao } = window as any
    if (!kakao?.Postcode) return
    isAddressSearching = true
    new kakao.Postcode({
      oncomplete: (data: any) => {
        zipCode = data.zonecode || ''
        address = data.address || data.roadAddress || data.jibunAddress || ''
        isAddressSearching = false
      },
      onclose: () => {
        isAddressSearching = false
      }
    }).open()
  }

  /** 전화번호 패턴 검증 (입력된 경우만) */
  const isPhoneValid = $derived(
    !phone.trim() || /^\d{2,3}-\d{3,4}-\d{4}$/.test(phone)
  )

  /** 사업자등록번호 패턴 검증 (입력된 경우만) */
  const isBrnValid = $derived(!brn.trim() || /^\d{3}-\d{2}-\d{5}$/.test(brn))

  const canSubmit = $derived(
    name.trim().length > 0 &&
      phone.trim().length > 0 &&
      isPhoneValid &&
      address.trim().length > 0 &&
      brn.trim().length > 0 &&
      isBrnValid &&
      repName.trim().length > 0
  )

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!canSubmit || loading) return

    loading = true
    error = ''

    const params: CenterRegisterParams = {
      name,
      phone,
      zipCode,
      address,
      addressDetail,
      businessRegistrationNumber: brn,
      representativeName: repName
    }

    const result = await registerCenter(params)

    if (!result.success) {
      error = result.error || '센터 등록 신청에 실패했습니다.'
    }

    loading = false
  }
</script>

<!-- 헤더 -->
<header
  class="flex h-16 items-center gap-2 border-b border-gray-100 bg-white px-4"
>
  <Tooltip text="뒤로가기">
    <button
      type="button"
      onclick={() => history.back()}
      class="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-50"
      aria-label="뒤로가기"
    >
      <ArrowLeftIcon24 />
    </button>
  </Tooltip>
  <MindScopeLogo />
</header>

<div
  class="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center bg-gray-50 px-4 py-8"
>
  <div class="w-full max-w-md">
    <div class="rounded-lg border border-gray-200 bg-white px-6 py-8 shadow-sm">
      <Typography variant="headline-01-normal-semibold" color="text-gray-800">
        새로 생성할 센터 정보를 입력해주세요
      </Typography>
      <p class="mt-2 text-body-03-normal-regular text-gray-600">
        센터 정보를 입력하면 검토 후 승인됩니다.
      </p>

      <form onsubmit={handleSubmit} class="mt-8 flex flex-col gap-5">
        <!-- 센터 이름 -->
        <div>
          <label
            for="center-name"
            class="block text-body-03-normal-medium text-gray-700"
            >센터 이름 <span class="text-red-500">*</span></label
          >
          <input
            id="center-name"
            type="text"
            bind:value={name}
            placeholder="센터 이름을 입력하세요"
            class="mt-1.5 h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-body-02-normal-regular text-gray-800 placeholder-gray-400 outline-none focus:border-border-active"
            required
          />
        </div>

        <!-- 대표자명 -->
        <div>
          <label
            for="center-rep"
            class="block text-body-03-normal-medium text-gray-700"
            >대표자명 <span class="text-red-500">*</span></label
          >
          <input
            id="center-rep"
            type="text"
            bind:value={repName}
            placeholder="대표자 이름"
            class="mt-1.5 h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-body-02-normal-regular text-gray-800 placeholder-gray-400 outline-none focus:border-border-active"
            required
          />
        </div>

        <!-- 전화번호 -->
        <div>
          <label
            for="center-phone"
            class="block text-body-03-normal-medium text-gray-700"
            >전화번호 <span class="text-red-500">*</span></label
          >
          <input
            id="center-phone"
            type="tel"
            value={phone}
            oninput={onPhoneInput}
            placeholder="010-1234-5678 또는 02-1234-5678"
            maxlength="13"
            inputmode="numeric"
            class="mt-1.5 h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-body-02-normal-regular text-gray-800 placeholder-gray-400 outline-none focus:border-border-active"
            class:!border-red-300={phone.trim() && !isPhoneValid}
            required
          />
          {#if phone.trim() && !isPhoneValid}
            <p class="mt-1 field-help is-error">
              예: 010-1234-5678 또는 02-1234-5678
            </p>
          {/if}
        </div>

        <!-- 사업자등록번호 -->
        <div>
          <label
            for="center-brn"
            class="block text-body-03-normal-medium text-gray-700"
            >사업자등록번호 <span class="text-red-500">*</span></label
          >
          <input
            id="center-brn"
            type="text"
            value={brn}
            oninput={onBrnInput}
            placeholder="000-00-00000"
            maxlength="12"
            inputmode="numeric"
            class="mt-1.5 h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-body-02-normal-regular text-gray-800 placeholder-gray-400 outline-none focus:border-border-active"
            class:!border-red-300={brn.trim() && !isBrnValid}
            required
          />
          {#if brn.trim() && !isBrnValid}
            <p class="mt-1 field-help is-error">예: 000-00-00000</p>
          {/if}
        </div>

        <!-- 주소 -->
        <div>
          <label class="block text-body-03-normal-medium text-gray-700"
            >주소 <span class="text-red-500">*</span></label
          >
          <div class="mt-1.5 flex gap-2">
            <input
              type="text"
              value={zipCode}
              placeholder="우편번호"
              readonly
              class="h-12 w-28 rounded-lg border border-gray-200 bg-gray-50 px-3 text-body-02-normal-regular text-gray-800 placeholder-gray-400 outline-none"
            />
            <button
              type="button"
              onclick={openAddressSearch}
              class="h-12 shrink-0 rounded-lg border border-primary-400 px-4 text-body-03-normal-medium text-primary-600 hover:bg-primary-50"
            >
              주소 검색
            </button>
          </div>
          <input
            type="text"
            value={address}
            placeholder="주소를 검색해주세요"
            readonly
            class="mt-2 h-12 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-body-02-normal-regular text-gray-800 placeholder-gray-400 outline-none"
          />
          <input
            type="text"
            bind:value={addressDetail}
            placeholder="상세 주소 (동/호수)"
            class="mt-2 h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-body-02-normal-regular text-gray-800 placeholder-gray-400 outline-none focus:border-border-active"
          />
        </div>

        {#if error}
          <p class="text-body-03-normal-regular text-red-600">{error}</p>
        {/if}

        <!-- 등록 신청 버튼 -->
        <button
          type="submit"
          disabled={loading || !canSubmit}
          class="mt-2 h-[52px] w-full rounded-lg bg-primary-500 text-body-02-normal-medium font-medium text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? '신청 중...' : '센터 등록 신청'}
        </button>
      </form>
    </div>
  </div>
</div>
