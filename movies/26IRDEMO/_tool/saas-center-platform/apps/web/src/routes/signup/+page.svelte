<script lang="ts">
  import { page } from '$app/state'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import Select from '$lib/components/Select.svelte'
  import type { SelectOptionType } from '$lib/types/common'
  import ArrowLeftIcon24 from '$root/src/lib/assets/ArrowLeftIcon24.svelte'
  import MindScopeLogo from '$lib/assets/MindScopeLogo.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import {
    validateSignupFields,
    signup,
    type FieldErrors
  } from '$lib/features/signup/signup-service'

  const genderOptions: SelectOptionType[] = [
    { value: 'male', title: '남성' },
    { value: 'female', title: '여성' }
  ]

  let email = $state(page.url.searchParams.get('email') ?? '')
  let password = $state('')
  let passwordConfirm = $state('')
  let name = $state('')
  let birthRaw = $state('')
  let gender = $state<'male' | 'female' | ''>('')
  let phoneRaw = $state('')

  let showPassword = $state(false)
  let showPasswordConfirm = $state(false)
  let loading = $state(false)
  let error = $state('')
  let fieldErrors = $state<FieldErrors>({})

  // 약관 동의
  let agreeAll = $state(false)
  let agreeTerms = $state(false)
  let agreePrivacy = $state(false)

  const redirectTo = $derived(
    page.url.searchParams.get('redirectTo') || '/dashboard'
  )

  /** 생년월일: YYYY-MM-DD 자동 포맷 (커서 위치 보존) */
  function onBirthInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement
    const cursorPos = target.selectionStart ?? 0

    // 커서 앞쪽의 숫자 개수를 세어 논리적 커서 위치 계산
    const beforeFormat = target.value
    const digitsBefore = beforeFormat
      .slice(0, cursorPos)
      .replace(/\D/g, '').length

    const digits = beforeFormat.replace(/\D/g, '').slice(0, 8)
    let formatted: string
    if (digits.length <= 4) {
      formatted = digits
    } else if (digits.length <= 6) {
      formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`
    } else {
      formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
    }
    birthRaw = formatted

    // 포맷 후 논리적 커서 위치(숫자 N개째)에 해당하는 실제 위치 복원
    requestAnimationFrame(() => {
      let count = 0
      let newPos = 0
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) {
          count++
          if (count === digitsBefore) {
            newPos = i + 1
            break
          }
        }
      }
      if (digitsBefore === 0) newPos = 0
      if (count < digitsBefore) newPos = formatted.length
      target.setSelectionRange(newPos, newPos)
    })
  }

  /** API 전송용 YYYY-MM-DD */
  const birth = $derived.by(() => {
    const raw = birthRaw.replace(/\D/g, '')
    if (raw.length !== 8) return ''
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  })

  /** 휴대폰: 000-0000-0000 자동 포맷 (커서 위치 보존) */
  function onPhoneInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement
    const cursorPos = target.selectionStart ?? 0

    const beforeFormat = target.value
    const digitsBefore = beforeFormat
      .slice(0, cursorPos)
      .replace(/\D/g, '').length

    const digits = beforeFormat.replace(/\D/g, '').slice(0, 11)
    let formatted: string
    if (digits.length <= 3) {
      formatted = digits
    } else if (digits.length <= 7) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`
    } else {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    }
    phoneRaw = formatted

    requestAnimationFrame(() => {
      let count = 0
      let newPos = 0
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) {
          count++
          if (count === digitsBefore) {
            newPos = i + 1
            break
          }
        }
      }
      if (digitsBefore === 0) newPos = 0
      if (count < digitsBefore) newPos = formatted.length
      target.setSelectionRange(newPos, newPos)
    })
  }

  /** API 전송용 (하이픈 포함 그대로) */
  const phone = $derived(
    phoneRaw.replace(/\D/g, '').length >= 10 ? phoneRaw : ''
  )

  const canSubmit = $derived(
    name.trim() &&
      gender &&
      birthRaw.replace(/\D/g, '').length === 8 &&
      email.trim() &&
      phone &&
      password.length >= 8 &&
      password === passwordConfirm &&
      agreeTerms &&
      agreePrivacy
  )

  function toggleAgreeAll() {
    const next = !agreeAll
    agreeAll = next
    agreeTerms = next
    agreePrivacy = next
  }

  function syncAgreeAll() {
    agreeAll = agreeTerms && agreePrivacy
  }

  // 값이 유효해지면 해당 필드 에러 자동 클리어
  $effect(() => {
    if (fieldErrors.name && name.trim())
      fieldErrors = { ...fieldErrors, name: undefined }
  })
  $effect(() => {
    if (fieldErrors.gender && gender)
      fieldErrors = { ...fieldErrors, gender: undefined }
  })
  $effect(() => {
    const digits = birthRaw.replace(/\D/g, '')
    if (fieldErrors.birth && digits.length === 8) {
      const y = parseInt(digits.slice(0, 4))
      const m = parseInt(digits.slice(4, 6))
      const d = parseInt(digits.slice(6, 8))
      const date = new Date(y, m - 1, d)
      if (
        date.getFullYear() === y &&
        date.getMonth() === m - 1 &&
        date.getDate() === d &&
        date <= new Date()
      ) {
        fieldErrors = { ...fieldErrors, birth: undefined }
      }
    }
  })
  $effect(() => {
    if (fieldErrors.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldErrors = { ...fieldErrors, email: undefined }
    }
  })
  $effect(() => {
    if (fieldErrors.phone && phoneRaw.replace(/\D/g, '').length >= 10) {
      fieldErrors = { ...fieldErrors, phone: undefined }
    }
  })
  $effect(() => {
    if (fieldErrors.password && password.length >= 8)
      fieldErrors = { ...fieldErrors, password: undefined }
  })
  $effect(() => {
    if (fieldErrors.passwordConfirm && password === passwordConfirm) {
      fieldErrors = { ...fieldErrors, passwordConfirm: undefined }
    }
  })
  $effect(() => {
    if (fieldErrors.terms && agreeTerms && agreePrivacy) {
      fieldErrors = { ...fieldErrors, terms: undefined }
    }
  })

  /** 필드 순서 기준 첫 번째 에러 필드 */
  const FIELD_ORDER: (keyof FieldErrors)[] = [
    'name',
    'gender',
    'birth',
    'email',
    'phone',
    'password',
    'passwordConfirm',
    'terms'
  ]
  const firstErrorField = $derived(FIELD_ORDER.find((f) => fieldErrors[f]))

  /** 에러 있는 input의 border 클래스 */
  function inputClass(field: keyof FieldErrors, base: string): string {
    if (fieldErrors[field]) {
      return base.replace('border-gray-200', 'border-red-400')
    }
    return base
  }

  async function handleSubmit(e: Event) {
    e.preventDefault()

    // 프론트엔드 필드별 검증
    const errors = validateSignupFields({
      name,
      gender,
      birthDigits: birthRaw.replace(/\D/g, ''),
      email,
      phone,
      password,
      passwordConfirm,
      agreeTerms,
      agreePrivacy
    })

    if (Object.keys(errors).length > 0) {
      fieldErrors = errors
      error = ''
      return
    }

    loading = true
    error = ''
    fieldErrors = {}

    const result = await signup(
      {
        email,
        password,
        name: name.trim(),
        phone: phone.trim(),
        ...(birth && { birth }),
        ...(gender && { gender })
      },
      redirectTo
    )

    if (!result.success) {
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        fieldErrors = result.fieldErrors
      }
      error = result.error || '회원가입에 실패했습니다.'
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
      <h1 class="text-headline-01-normal-bold text-gray-800">
        회원가입을 위한 정보를 입력해주세요
      </h1>

      <form onsubmit={handleSubmit} novalidate class="mt-8 flex flex-col gap-5">
        <!-- 이름 + 성별 (같은 행) -->
        <div class="flex gap-3">
          <div class="flex-1">
            <label
              for="signup-name"
              class="block text-body-03-normal-medium text-gray-700"
              >이름 <span class="text-red-500">*</span></label
            >
            <input
              id="signup-name"
              type="text"
              bind:value={name}
              placeholder="이름을 입력하세요"
              class={inputClass(
                'name',
                'mt-1.5 h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-body-02-normal-regular text-gray-800 placeholder-gray-400 outline-none focus:border-border-active'
              )}
              required
            />
            {#if fieldErrors.name}
              <p class="mt-1 field-help is-error">
                {fieldErrors.name}
              </p>
            {/if}
          </div>
          <div class="w-[140px]">
            <span class="block text-body-03-normal-medium text-gray-700"
              >성별 <span class="text-red-500">*</span></span
            >
            <div class="mt-1.5">
              <Select
                placeholder="성별"
                options={genderOptions}
                selected={gender || undefined}
                on:change={(e) => {
                  const val = e.detail
                  gender =
                    typeof val === 'object' && val !== null ? val.value : val
                }}
                class="h-12 rounded-lg {fieldErrors.gender
                  ? 'border-red-400'
                  : ''}"
                btnClass="px-3"
              />
            </div>
            {#if fieldErrors.gender}
              <p class="mt-1 field-help is-error">
                {fieldErrors.gender}
              </p>
            {/if}
          </div>
        </div>

        <!-- 생년월일 -->
        <div>
          <label
            for="signup-birth"
            class="block text-body-03-normal-medium text-gray-700"
            >생년월일 <span class="text-red-500">*</span></label
          >
          <input
            id="signup-birth"
            type="text"
            value={birthRaw}
            oninput={onBirthInput}
            placeholder="YYYY-MM-DD (예: 1998-04-13)"
            maxlength="10"
            inputmode="numeric"
            class={inputClass(
              'birth',
              'mt-1.5 h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-body-02-normal-regular text-gray-800 placeholder-gray-400 outline-none focus:border-border-active'
            )}
            required
          />
          {#if fieldErrors.birth}
            <p class="mt-1 field-help is-error">
              {fieldErrors.birth}
            </p>
          {/if}
        </div>

        <!-- 이메일 -->
        <div>
          <label
            for="signup-email"
            class="block text-body-03-normal-medium text-gray-700"
            >이메일 <span class="text-red-500">*</span></label
          >
          <input
            id="signup-email"
            type="email"
            bind:value={email}
            placeholder="이메일을 입력하세요"
            class={inputClass(
              'email',
              'mt-1.5 h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-body-02-normal-regular text-gray-800 placeholder-gray-400 outline-none focus:border-border-active'
            )}
            required
          />
          {#if fieldErrors.email}
            <p class="mt-1 field-help is-error">
              {fieldErrors.email}
            </p>
          {/if}
        </div>

        <!-- 휴대폰 번호 -->
        <div>
          <label
            for="signup-phone"
            class="block text-body-03-normal-medium text-gray-700"
            >휴대폰 번호 <span class="text-red-500">*</span></label
          >
          <input
            id="signup-phone"
            type="tel"
            value={phoneRaw}
            oninput={onPhoneInput}
            placeholder="010-0000-0000"
            maxlength="13"
            inputmode="numeric"
            class={inputClass(
              'phone',
              'mt-1.5 h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-body-02-normal-regular text-gray-800 placeholder-gray-400 outline-none focus:border-border-active'
            )}
            required
          />
          {#if fieldErrors.phone}
            <p class="mt-1 field-help is-error">
              {fieldErrors.phone}
            </p>
          {/if}
        </div>

        <!-- 비밀번호 -->
        <div>
          <label
            for="signup-password"
            class="block text-body-03-normal-medium text-gray-700"
            >비밀번호 <span class="text-red-500">*</span></label
          >
          <div
            class={inputClass(
              'password',
              'mt-1.5 flex h-12 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 focus-within:border-border-active'
            )}
          >
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              bind:value={password}
              placeholder="8~16자 영문, 숫자, 특수문자 조합"
              class="min-w-0 flex-1 border-0 bg-transparent text-body-02-normal-regular text-gray-800 placeholder-gray-400 outline-none"
              minlength="8"
              required
            />
            <button
              type="button"
              onclick={() => (showPassword = !showPassword)}
              class="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            >
              {#if showPassword}
                <svg
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              {:else}
                <svg
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              {/if}
            </button>
          </div>
          {#if fieldErrors.password}
            <p class="mt-1 field-help is-error">
              {fieldErrors.password}
            </p>
          {/if}
        </div>

        <!-- 비밀번호 확인 -->
        <div>
          <label
            for="signup-password-confirm"
            class="block text-body-03-normal-medium text-gray-700"
            >비밀번호 확인 <span class="text-red-500">*</span></label
          >
          <div
            class={inputClass(
              'passwordConfirm',
              'mt-1.5 flex h-12 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 focus-within:border-border-active'
            )}
          >
            <input
              id="signup-password-confirm"
              type={showPasswordConfirm ? 'text' : 'password'}
              bind:value={passwordConfirm}
              placeholder="비밀번호를 다시 한번 입력해주세요"
              class="min-w-0 flex-1 border-0 bg-transparent text-body-02-normal-regular text-gray-800 placeholder-gray-400 outline-none"
              minlength="8"
            />
            <button
              type="button"
              onclick={() => (showPasswordConfirm = !showPasswordConfirm)}
              class="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label={showPasswordConfirm
                ? '비밀번호 숨기기'
                : '비밀번호 보기'}
            >
              {#if showPasswordConfirm}
                <svg
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              {:else}
                <svg
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              {/if}
            </button>
          </div>
          {#if fieldErrors.passwordConfirm}
            <p class="mt-1 field-help is-error">
              {fieldErrors.passwordConfirm}
            </p>
          {/if}
        </div>

        <!-- 약관 동의 -->
        <div class="space-y-3 border-t border-gray-200 pt-6">
          <!-- 전체 동의 -->
          <div
            class="flex cursor-pointer items-center gap-2"
            role="none"
            onclick={toggleAgreeAll}
          >
            <Checkbox
              id="agree-all"
              checked={agreeAll}
              onchange={toggleAgreeAll}
            />
            <span class="text-body-02-normal-medium text-gray-800"
              >모든 항목에 동의합니다</span
            >
          </div>

          <div class="space-y-2 pl-1">
            <!-- 이용약관 -->
            <div class="flex items-center justify-between">
              <div
                class="flex cursor-pointer items-center gap-2"
                role="none"
                onclick={() => {
                  agreeTerms = !agreeTerms
                  syncAgreeAll()
                }}
              >
                <Checkbox
                  id="agree-terms"
                  checked={agreeTerms}
                  onchange={(checked) => {
                    agreeTerms = checked
                    syncAgreeAll()
                  }}
                />
                <span class="text-body-03-normal-regular text-gray-700"
                  >이용약관 동의(필수)</span
                >
              </div>
              <a
                href="/terms"
                target="_blank"
                class="text-body-03-normal-medium text-gray-400 hover:text-gray-600 cursor-pointer"
                >약관보기 &gt;</a
              >
            </div>
            <!-- 개인정보 -->
            <div class="flex items-center justify-between">
              <div
                class="flex cursor-pointer items-center gap-2"
                role="none"
                onclick={() => {
                  agreePrivacy = !agreePrivacy
                  syncAgreeAll()
                }}
              >
                <Checkbox
                  id="agree-privacy"
                  checked={agreePrivacy}
                  onchange={(checked) => {
                    agreePrivacy = checked
                    syncAgreeAll()
                  }}
                />
                <span class="text-body-03-normal-regular text-gray-700"
                  >개인정보 수집·이용 동의(필수)</span
                >
              </div>
              <a
                href="/privacy"
                target="_blank"
                class="text-body-03-normal-medium text-gray-400 hover:text-gray-600 cursor-pointer"
                >약관보기 &gt;</a
              >
            </div>
          </div>
          {#if fieldErrors.terms}
            <p class="mt-1 field-help is-error">
              {fieldErrors.terms}
            </p>
          {/if}
        </div>

        {#if error}
          <p class="text-body-03-normal-regular text-red-600">{error}</p>
        {/if}

        <!-- 가입하기 -->
        <button
          type="submit"
          disabled={loading}
          class="mt-2 h-[52px] w-full rounded-lg text-body-02-normal-medium font-medium text-white transition focus:outline-none focus:ring-offset-2 disabled:cursor-not-allowed {loading
            ? 'bg-primary-200 cursor-not-allowed'
            : canSubmit
              ? 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700'
              : 'bg-[#B2CEF7] text-gray-700 focus:ring-blue-300'}"
        >
          {loading ? '가입 중...' : '가입'}
        </button>
      </form>
    </div>
  </div>
</div>
