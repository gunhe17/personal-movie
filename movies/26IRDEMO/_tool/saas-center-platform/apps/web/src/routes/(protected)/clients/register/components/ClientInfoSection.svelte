<script lang="ts">
  import { twMerge } from 'tailwind-merge'

  import Typography from '@common/components/Typography.svelte'
  import {
    formatBirthInput,
    formatPhoneInput
  } from '$lib/features/clients/register/view-model'
  import type { ClientFieldErrors } from '$lib/features/clients/register/register-form-hooks.svelte'

  interface Props {
    name: string
    birth: string
    gender: 'MALE' | 'FEMALE'
    email: string
    phone: string
    zipCode: string
    address: string
    addressDetail: string
    fieldErrors: ClientFieldErrors
    isGuardianEdit: boolean
    onUpdate: (
      patch: Partial<{
        name: string
        birth: string
        gender: 'MALE' | 'FEMALE'
        email: string
        phone: string
        addressDetail: string
      }>
    ) => void
    onClearFieldError: (key: keyof ClientFieldErrors) => void
    onAddressSearch: () => void
  }

  let {
    name,
    birth,
    gender,
    email,
    phone,
    zipCode,
    address,
    addressDetail,
    fieldErrors,
    isGuardianEdit,
    onUpdate,
    onClearFieldError,
    onAddressSearch
  }: Props = $props()

  // 이메일 형식(aaa@bbb.ccc) — 입력 중엔 조용히, 포커스를 뗀 뒤부터 에러를 보여준다.
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  let emailTouched = $state(false)
  const emailFormatError = $derived(
    emailTouched && email.trim() && !EMAIL_PATTERN.test(email.trim())
      ? '이메일을 확인해주세요'
      : ''
  )
  const emailError = $derived(fieldErrors.email ?? emailFormatError)
</script>

<div class="xl:max-w-200">
  <div class="space-y-6">
    <!-- Row 1: 이름 -->
    <div data-field="name">
      <label for="client-name" class="field-label mb-2">
        이름 <span class="field-required">*</span>
      </label>
      <input
        id="client-name"
        type="text"
        value={name}
        placeholder={isGuardianEdit
          ? '보호자 이름을 입력해주세요'
          : '내담자 이름을 입력해주세요'}
        class="field-input w-full"
        oninput={(e) => {
          onUpdate({ name: (e.target as HTMLInputElement).value })
          onClearFieldError('name')
        }}
      />
    </div>

    <!-- Row 2: 성별 -->
    <div data-field="gender">
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        className="mb-2"
      >
        성별 <span class="field-required">*</span>
      </Typography>
      <div class="flex h-12 items-center gap-4">
        <label class="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="client-gender"
            checked={gender === 'MALE'}
            onchange={() => onUpdate({ gender: 'MALE' })}
            class="h-5 w-5 cursor-pointer accent-primary-500"
          />
          <Typography variant="body-01-normal-medium" color="text-body-default">
            남자
          </Typography>
        </label>
        <label class="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="client-gender"
            checked={gender === 'FEMALE'}
            onchange={() => onUpdate({ gender: 'FEMALE' })}
            class="h-5 w-5 cursor-pointer accent-primary-500"
          />
          <Typography variant="body-01-normal-medium" color="text-body-default">
            여자
          </Typography>
        </label>
      </div>
    </div>

    <!-- Row 3: 생년월일 | 연락처 -->
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div data-field="birth">
        <label for="client-birth" class="field-label mb-2">
          생년월일 <span class="field-required">*</span>
        </label>
        <input
          id="client-birth"
          type="text"
          inputmode="numeric"
          maxlength="10"
          value={birth}
          placeholder="YYYY-MM-DD"
          class="field-input w-full"
          oninput={(e) => {
            onUpdate({
              birth: formatBirthInput((e.target as HTMLInputElement).value)
            })
            onClearFieldError('birth_date')
          }}
        />
      </div>
      <div data-field="phone">
        <label for="client-phone" class="field-label mb-2"> 연락처 </label>
        <input
          id="client-phone"
          type="tel"
          inputmode="numeric"
          maxlength="13"
          value={phone}
          placeholder="연락 가능한 주 연락처를 입력해주세요"
          class="field-input w-full"
          oninput={(e) => {
            onUpdate({
              phone: formatPhoneInput((e.target as HTMLInputElement).value)
            })
            onClearFieldError('phone')
          }}
        />
      </div>
    </div>

    <!-- Row 4: 이메일 -->
    <div data-field="email">
      <label for="client-email" class="field-label mb-2"> 이메일 </label>
      <input
        id="client-email"
        type="email"
        value={email}
        placeholder="example@email.com"
        class={twMerge('field-input', emailError ? 'is-error' : '')}
        oninput={(e) => {
          onUpdate({ email: (e.target as HTMLInputElement).value })
          onClearFieldError('email')
        }}
        onblur={() => (emailTouched = true)}
      />
      {#if emailError}
        <p class="mt-1 field-help is-error">{emailError}</p>
      {/if}
    </div>

    <!-- Row 5: 주소 -->
    <div data-field="address">
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        className="mb-2"
      >
        주소
      </Typography>
      <div class="flex gap-2">
        <input
          type="text"
          value={zipCode}
          placeholder="우편번호"
          readonly
          class="field-input w-1/3 min-w-0"
        />
        <input
          type="text"
          value={address}
          placeholder="주소"
          readonly
          class="field-input min-w-0 flex-1"
        />
        <button
          type="button"
          onclick={onAddressSearch}
          class="h-12 w-17 shrink-0 rounded-xl bg-gray-100 text-body-01-normal-medium text-gray-600 hover:bg-gray-200"
        >
          검색
        </button>
      </div>
      <input
        type="text"
        value={addressDetail}
        placeholder="상세주소를 입력해주세요"
        class="field-input mt-2 w-full"
        oninput={(e) =>
          onUpdate({ addressDetail: (e.target as HTMLInputElement).value })}
      />
    </div>
  </div>
</div>
