<script lang="ts">
  import { mutationBuilder } from '../../hooks/queries/builder'
  import Select from '../Select.svelte'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
  }

  let { modalId = '', closeModal = () => {} }: Props = $props()

  // TODO: This modal is deprecated. Use MemberInviteModal instead.
  // const createMember = mutationBuilder(postCreateMember, ['getMemberList'])

  // 폼 상태
  let memberName = $state('')
  let gender = $state<'male' | 'female'>('male')
  let birth = $state('')
  let email = $state('')
  let memo = $state('')
  let phone = $state('')
  let contractType = $state<'정규직' | '계약직' | '프리랜서'>('정규직')
  let role = $state<'CENTER' | 'MANAGER' | 'SPECIALIST'>('SPECIALIST')

  const handleConfirm = () => {
    const request = {
      name: memberName,
      gender: gender.toUpperCase(),
      birth,
      email,
      memo,
      role,
      employment_type:
        contractType === '정규직'
          ? 'FULLTIME'
          : contractType === '계약직'
            ? 'CONTRACT'
            : 'FREELANCER',
      center_id: '46d1573e-dfca-4fb1-adff-ba1f4cecc947',
      permission_policy_id: '229a6a3a-6715-4723-ae49-e8d3469acaee',
      phone
    }
    // TODO: Replace with invitation flow
    console.warn('MemberRegisterModal is deprecated. Use MemberInviteModal.')
    closeModal()
  }

  const roleOptions = [
    { title: '최고 관리자', value: 'CENTER' },
    { title: '관리자', value: 'MANAGER' },
    { title: '전문가', value: 'SPECIALIST' }
  ]
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
  title="구성원을 등록할게요"
>
  {#snippet body()}
    <div class="flex max-h-162.5 flex-col">
      <Typography
        variant="headline-02-medium"
        color="text-gray-800"
        className="mb-5 font-semibold"
      >
        기본 정보
      </Typography>
      <div class="mb-6">
        <label for="memberName">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">구성원 이름</Typography
          >
        </label>
        <input
          type="text"
          name="memberName"
          bind:value={memberName}
          placeholder="구성원 이름을 입력해주세요"
          class="field-input w-full"
        />
      </div>
      <div class="grid grid-cols-2 gap-4 mb-6">
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">생년월일</Typography
          >
          <input type="date" bind:value={birth} class="field-input w-full" />
        </div>
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">성별</Typography
          >
          <div class="flex w-full h-11 items-center gap-6">
            <button
              onclick={() => (gender = 'male')}
              class="flex w-22 items-center gap-2"
            >
              <div
                class="flex h-6 w-6 items-center justify-center rounded-full transition-colors {gender ===
                'male'
                  ? 'bg-primary-500'
                  : 'border border-gray-300 bg-white'}"
              >
                {#if gender === 'male'}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M13.3337 4L6.00033 11.3333L2.66699 8"
                      stroke="white"
                      stroke-width="1"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                {/if}
              </div>
              <Typography
                variant="body-01-normal-medium"
                color="text-body-default"
              >
                남자
              </Typography>
            </button>
            <button
              onclick={() => (gender = 'female')}
              class="flex w-22 items-center gap-2"
            >
              <div
                class="flex h-6 w-6 items-center justify-center rounded-full transition-colors {gender ===
                'female'
                  ? 'bg-primary-500'
                  : 'border border-gray-300 bg-white'}"
              >
                {#if gender === 'female'}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M13.3337 4L6.00033 11.3333L2.66699 8"
                      stroke="white"
                      stroke-width="1"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                {/if}
              </div>
              <Typography
                variant="body-01-normal-medium"
                color="text-body-default">여자</Typography
              >
            </button>
          </div>
        </div>
      </div>
      <div class="mb-6">
        <label for="email">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">이메일</Typography
          >
        </label>
        <input
          type="text"
          name="email"
          bind:value={email}
          placeholder="구성원 이메일을 입력해주세요"
          class="field-input w-full"
        />
      </div>
      <div class="mb-6">
        <label for="phone">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">연락처</Typography
          >
        </label>
        <input
          type="text"
          name="phone"
          bind:value={phone}
          placeholder="구성원 연락처를 입력해주세요"
          class="field-input w-full"
        />
      </div>
      <div class="mb-6">
        <label for="role">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">역할</Typography
          >
        </label>
        <Select
          selected={role}
          on:change={(e) => (role = e.detail.value)}
          hoverBoxClass="left-0 w-full"
          options={roleOptions}
        />
      </div>
      <div class="mb-6">
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-3"
        >
          계약형태
        </Typography>
        <div class="flex w-full gap-6">
          <button
            onclick={() => (contractType = '정규직')}
            class="flex w-22 items-center gap-2"
          >
            <div
              class="flex h-6 w-6 items-center justify-center rounded-full transition-colors {contractType ===
              '정규직'
                ? 'bg-primary-500'
                : 'border border-gray-300 bg-white'}"
            >
              {#if contractType === '정규직'}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M13.3337 4L6.00033 11.3333L2.66699 8"
                    stroke="white"
                    stroke-width="1"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              {/if}
            </div>
            <Typography
              variant="body-01-normal-medium"
              color="text-body-default"
            >
              정규직
            </Typography>
          </button>
          <button
            onclick={() => (contractType = '계약직')}
            class="flex w-22 items-center gap-2"
          >
            <div
              class="flex h-6 w-6 items-center justify-center rounded-full transition-colors {contractType ===
              '계약직'
                ? 'bg-primary-500'
                : 'border border-gray-300 bg-white'}"
            >
              {#if contractType === '계약직'}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M13.3337 4L6.00033 11.3333L2.66699 8"
                    stroke="white"
                    stroke-width="1"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              {/if}
            </div>
            <Typography
              variant="body-01-normal-medium"
              color="text-body-default"
            >
              계약직
            </Typography>
          </button>
          <button
            onclick={() => (contractType = '프리랜서')}
            class="flex w-22 items-center gap-2"
          >
            <div
              class="flex h-6 w-6 items-center justify-center rounded-full transition-colors {contractType ===
              '프리랜서'
                ? 'bg-primary-500'
                : 'border border-gray-300 bg-white'}"
            >
              {#if contractType === '프리랜서'}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M13.3337 4L6.00033 11.3333L2.66699 8"
                    stroke="white"
                    stroke-width="1"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              {/if}
            </div>
            <Typography
              variant="body-01-normal-medium"
              color="text-body-default"
            >
              프리랜서
            </Typography>
          </button>
        </div>
      </div>
      <div class="mb-6">
        <label for="memo">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">메모</Typography
          >
        </label>
        <!-- svelte-ignore element_invalid_self_closing_tag -->
        <textarea
          bind:value={memo}
          placeholder="메모 내용을 입력해주세요"
          class="text-body-01-reading-regular h-30 w-full resize-none rounded-lg border border-gray-200 focus:border-border-active focus:outline-none px-3 py-3.5"
        />
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end">
      <button
        onclick={handleConfirm}
        class="flex h-11 w-40 items-center justify-center rounded-lg bg-primary-500 text-white transition-colors hover:bg-primary-500"
      >
        <Typography variant="body-01-normal-medium" color="text-white"
          >등록</Typography
        >
      </button>
    </div>
  {/snippet}
</BaseModal>
