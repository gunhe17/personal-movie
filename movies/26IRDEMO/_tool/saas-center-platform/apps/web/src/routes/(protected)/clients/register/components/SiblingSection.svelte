<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import Typography from '@common/components/Typography.svelte'
  import TrashIcon24 from '$lib/assets/TrashIcon24.svelte'
  import {
    formatBirthInput,
    getBirthError
  } from '$lib/features/clients/register/view-model'
  import type {
    SiblingForm,
    SiblingFieldErrors
  } from '$lib/features/clients/register/register-form-hooks.svelte'

  interface Props {
    siblings: SiblingForm[]
    siblingErrors: Record<string, SiblingFieldErrors>
    onAdd: () => void
    onRemove: (id: string) => void
    onClearError: (id: string, field: keyof SiblingFieldErrors) => void
    onUpdate: (id: string, patch: Partial<SiblingForm>) => void
  }

  let {
    siblings,
    siblingErrors,
    onAdd,
    onRemove,
    onClearError,
    onUpdate
  }: Props = $props()
</script>

<div class="space-y-4">
  <div>
    <Typography variant="body-02-normal-regular" color="text-gray-500">
      같은 보호자의 다른 자녀를 함께 등록해요. 형제·자매로 자동 연결되고
      보호자·주소는 공유돼요.
    </Typography>
  </div>

  {#each siblings as sibling, idx}
    <div
      data-sibling-id={sibling.id}
      class="relative rounded-xl bg-gray-50 p-5 pb-6"
    >
      <!-- 1행: 이름 -->
      <div>
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          이름 <span class="field-required">*</span>
        </Typography>
        <input
          type="text"
          value={sibling.name}
          placeholder="자녀 이름을 입력해주세요"
          class={twMerge(
            'field-input',
            siblingErrors[sibling.id]?.name ? 'is-error' : ''
          )}
          oninput={(e) => {
            onUpdate(sibling.id, { name: (e.target as HTMLInputElement).value })
            onClearError(sibling.id, 'name')
          }}
        />
        <p class="mt-1 field-help is-error">
          {siblingErrors[sibling.id]?.name ?? ''}
        </p>
      </div>

      <!-- 2행: 생년월일 | 성별 -->
      <div class="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            생년월일 <span class="field-required">*</span>
          </Typography>
          <input
            type="text"
            inputmode="numeric"
            maxlength="10"
            value={sibling.birth}
            placeholder="YYYY-MM-DD"
            class={twMerge(
              'field-input',
              siblingErrors[sibling.id]?.birth_date ||
                getBirthError(sibling.birth)
                ? 'is-error'
                : ''
            )}
            oninput={(e) => {
              onUpdate(sibling.id, {
                birth: formatBirthInput((e.target as HTMLInputElement).value)
              })
              onClearError(sibling.id, 'birth_date')
            }}
          />
          {#if siblingErrors[sibling.id]?.birth_date || getBirthError(sibling.birth)}
            <p class="mt-1 field-help is-error">
              {siblingErrors[sibling.id]?.birth_date ??
                getBirthError(sibling.birth)}
            </p>
          {/if}
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
                name="sibling-gender-{sibling.id}"
                checked={sibling.gender === 'MALE'}
                onchange={() => onUpdate(sibling.id, { gender: 'MALE' })}
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
                name="sibling-gender-{sibling.id}"
                checked={sibling.gender === 'FEMALE'}
                onchange={() => onUpdate(sibling.id, { gender: 'FEMALE' })}
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
      <!-- 삭제: "형제·자매 추가"로 늘린 행에만, 카드 하단 우측 -->
      {#if idx > 0}
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            class="flex items-center gap-2 text-gray-500 hover:text-gray-700"
            onclick={() => onRemove(sibling.id)}
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
        형제·자매 추가
      </Typography>
    </button>
  </div>
</div>
