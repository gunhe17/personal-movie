<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import Typography from '@common/components/Typography.svelte'
  import Select from '$lib/components/Select.svelte'
  import TrashIcon24 from '$lib/assets/TrashIcon24.svelte'
  import { GUARDIAN_RELATION_OPTIONS } from '$lib/features/clients/register/constants'
  import {
    formatBirthInput,
    formatPhoneInput,
    getBirthError
  } from '$lib/features/clients/register/view-model'
  import type {
    GuardianForm,
    GuardianFieldErrors
  } from '$lib/features/clients/register/register-form-hooks.svelte'

  interface Props {
    guardians: GuardianForm[]
    guardianErrors: Record<string, GuardianFieldErrors>
    isEditMode: boolean
    onAdd: () => void
    onRemove: (id: string) => void
    onClearError: (id: string, field: keyof GuardianFieldErrors) => void
    onUpdateGuardian: (id: string, patch: Partial<GuardianForm>) => void
  }

  let {
    guardians,
    guardianErrors,
    isEditMode,
    onAdd,
    onRemove,
    onClearError,
    onUpdateGuardian
  }: Props = $props()
</script>

<div class="space-y-4">
  <div>
    <Typography variant="body-02-normal-regular" color="text-gray-500">
      보호자 정보는 내담자 정보에 함께 저장돼요
    </Typography>
  </div>
  {#each guardians as guardian, idx}
    <div
      data-guardian-id={guardian.id}
      class="relative rounded-xl bg-gray-50 p-5 pb-6"
    >
      <!-- 1행: 이름 -->
      <div class="flex items-end gap-4">
        <div class="flex-1">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            이름 <span class="field-required">*</span>
          </Typography>
          <input
            type="text"
            value={guardian.name}
            placeholder="보호자 이름을 입력해주세요"
            class={twMerge(
              'field-input',
              guardianErrors[guardian.id]?.name ? 'is-error' : ''
            )}
            oninput={(e) => {
              onUpdateGuardian(guardian.id, {
                name: (e.target as HTMLInputElement).value
              })
              onClearError(guardian.id, 'name')
            }}
          />
          <p class="mt-1 field-help is-error">
            {guardianErrors[guardian.id]?.name ?? ''}
          </p>
        </div>
      </div>
      <!-- 2행: 생년월일 | 성별 -->
      <div class="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            생년월일
          </Typography>
          <input
            type="text"
            inputmode="numeric"
            maxlength="10"
            value={guardian.birth}
            placeholder="YYYY-MM-DD"
            class={twMerge(
              'field-input',
              guardianErrors[guardian.id]?.birth_date ||
                getBirthError(guardian.birth)
                ? 'is-error'
                : ''
            )}
            oninput={(e) => {
              onUpdateGuardian(guardian.id, {
                birth: formatBirthInput((e.target as HTMLInputElement).value)
              })
              onClearError(guardian.id, 'birth_date')
            }}
          />
          <p class="mt-1 field-help is-error">
            {guardianErrors[guardian.id]?.birth_date ??
              getBirthError(guardian.birth)}
          </p>
        </div>
        <div>
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
                name="guardian-gender-{guardian.id}"
                checked={guardian.gender === 'male'}
                onchange={() =>
                  onUpdateGuardian(guardian.id, { gender: 'male' })}
                class="h-5 w-5 cursor-pointer accent-primary-500"
              />
              <Typography
                variant="body-01-normal-medium"
                color="text-body-default"
              >
                남자
              </Typography>
            </label>
            <label class="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="guardian-gender-{guardian.id}"
                checked={guardian.gender === 'female'}
                onchange={() =>
                  onUpdateGuardian(guardian.id, { gender: 'female' })}
                class="h-5 w-5 cursor-pointer accent-primary-500"
              />
              <Typography
                variant="body-01-normal-medium"
                color="text-body-default"
              >
                여자
              </Typography>
            </label>
          </div>
        </div>
      </div>
      <!-- 3행: 연락처 | 관계 -->
      <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            연락처 <span class="field-required">*</span>
          </Typography>
          <input
            type="tel"
            inputmode="numeric"
            maxlength="13"
            value={guardian.phone}
            placeholder="010-0000-0000"
            class={twMerge(
              'field-input',
              guardianErrors[guardian.id]?.phone ? 'is-error' : ''
            )}
            oninput={(e) => {
              onUpdateGuardian(guardian.id, {
                phone: formatPhoneInput((e.target as HTMLInputElement).value)
              })
              onClearError(guardian.id, 'phone')
            }}
          />
          {#if guardianErrors[guardian.id]?.phone}
            <p class="mt-1 field-help is-error">
              {guardianErrors[guardian.id]?.phone}
            </p>
          {/if}
        </div>
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            관계 <span class="field-required">*</span>
          </Typography>
          <Select
            placeholder="내담자와의 관계"
            textClass="text-body-01-normal-regular"
            class={twMerge(
              'h-12 w-full bg-white',
              guardianErrors[guardian.id]?.relation
                ? 'border border-status-danger'
                : ''
            )}
            selected={guardian.relation}
            options={[...GUARDIAN_RELATION_OPTIONS]}
            on:change={(e) => {
              onUpdateGuardian(guardian.id, { relation: e.detail })
              onClearError(guardian.id, 'relation')
            }}
          />
          {#if guardianErrors[guardian.id]?.relation}
            <p class="mt-1 field-help is-error">
              {guardianErrors[guardian.id]?.relation}
            </p>
          {/if}
        </div>
      </div>
      <!-- 삭제: "추가"로 늘린 행에만 둔다(처음 열리는 행은 지울 대상이 아님).
           수정 모드는 저장된 보호자를 지울 수 있어야 하므로 예외. -->
      {#if idx > 0 || isEditMode}
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            class="flex items-center gap-2 text-gray-500 hover:text-gray-700"
            onclick={() => {
              if (idx === 0 && !isEditMode) {
                onUpdateGuardian(guardian.id, {
                  name: '',
                  relation: '',
                  birth: '',
                  phone: '',
                  gender: 'male'
                })
              } else {
                onRemove(guardian.id)
              }
            }}
          >
            <TrashIcon24 size={24} color="#7D848F" />
            <Typography variant="body-02-normal-medium" color="text-gray-500">
              삭제
            </Typography>
          </button>
        </div>
      {/if}
    </div>
  {/each}
  <div class="flex justify-center">
    <button
      type="button"
      onclick={onAdd}
      class="flex items-center gap-2 text-primary-500 hover:text-primary-600"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="10" fill="#D7E5FD" />
        <path
          d="M7 12L17 12"
          stroke="#4C87F6"
          stroke-width="2"
          stroke-linecap="round"
        />
        <path
          d="M12 7L12 17"
          stroke="#4C87F6"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
      <Typography variant="body-02-normal-regular" color="text-primary-500">
        보호자 추가
      </Typography>
    </button>
  </div>
</div>
