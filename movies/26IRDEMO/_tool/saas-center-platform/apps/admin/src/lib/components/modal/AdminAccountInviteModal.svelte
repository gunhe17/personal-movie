<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Button from '$components/Button.svelte'
  import Typography from '$components/Typography.svelte'
  import Select from '$components/Select.svelte'
  import { post } from '$services/api/instances'
  import { showErrorSnackbar } from '$lib/utils/errorHandler'

  interface Props {
    modalId?: string
    closeModal?: () => void
  }

  let { modalId = '', closeModal = () => {} }: Props = $props()

  let email = $state('')
  let name = $state('')
  let role = $state<'admin' | 'customer_service'>('admin')
  let isSubmitting = $state(false)
  let invitationLink = $state('')

  const ROLE_OPTIONS = [
    { value: 'admin', title: '관리자' },
    { value: 'customer_service', title: 'CS 담당자' }
  ]

  async function handleSubmit() {
    if (!email.trim() || !name.trim()) return
    isSubmitting = true
    try {
      const res = await post<{ invitation_link: string }>(
        '/admin/admin-accounts/invite',
        {
          email: email.trim(),
          name: name.trim(),
          role
        }
      )
      invitationLink = (res as any).invitation_link
    } catch (e) {
      showErrorSnackbar(e)
    } finally {
      isSubmitting = false
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(invitationLink)
  }

  function handleOpenLink() {
    window.open(invitationLink, '_blank')
  }
</script>

<BaseModal {modalId} {closeModal} headerClass="px-6 py-4" bodyClass="px-6 py-5">
  {#snippet header()}
    <Typography variant="title-02-semibold" color="text-gray-900">
      어드민 계정 초대
    </Typography>
  {/snippet}

  {#snippet body()}
    {#if invitationLink}
      <!-- 초대 링크 생성 완료 -->
      <div class="space-y-4">
        <div class="flex flex-col items-center gap-2 py-2 text-center">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-xl"
          >
            ✓
          </div>
          <Typography variant="body-01-reading-regular" color="text-gray-700">
            초대 링크가 생성되었습니다.<br />아래 링크를 복사해 전달하세요.
          </Typography>
        </div>
        <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
          <p class="break-all text-xs text-gray-500">{invitationLink}</p>
        </div>
        <div class="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
          <Typography variant="body-03-normal-regular" color="text-amber-700">
            ⚠️ 개발 모드: 이메일 발송이 비활성화되어 있습니다. 링크를 직접
            복사해 전달해주세요. 초대 링크는 7일간 유효합니다.
          </Typography>
        </div>
      </div>
    {:else}
      <!-- 초대 폼 -->
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <div class="space-y-4">
        <!-- 이메일 -->
        <div>
          <label class="mb-1.5 block text-sm font-medium text-gray-700">
            이메일 <span class="text-red-500">*</span>
          </label>
          <input
            type="email"
            bind:value={email}
            placeholder="admin@insighter.co.kr"
            class="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <!-- 이름 -->
        <div>
          <label class="mb-1.5 block text-sm font-medium text-gray-700">
            이름 <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            bind:value={name}
            placeholder="홍길동"
            class="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <!-- 역할 -->
        <div>
          <label class="mb-1.5 block text-sm font-medium text-gray-700">
            역할 <span class="text-red-500">*</span>
          </label>
          <Select
            class="w-full h-11 rounded-lg bg-white"
            selected={role}
            options={ROLE_OPTIONS}
            on:change={(e) => (role = e.detail.value as 'admin' | 'customer_service')}
          />
          <p class="mt-1 text-xs text-gray-400">
            슈퍼관리자는 초대로 생성할 수 없습니다
          </p>
        </div>

        <!-- 안내 메시지 -->
        <div class="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
          <Typography variant="body-03-normal-regular" color="text-amber-700">
            ⚠️ 개발 모드: 이메일 발송이 비활성화되어 있습니다. 초대 링크를 생성
            후 직접 전달해주세요.
          </Typography>
        </div>
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    {#if invitationLink}
      <Button color="light" content="링크 열기" onclick={handleOpenLink} />
      <Button color="primary" content="링크 복사" onclick={handleCopyLink} />
    {:else}
      <Button
        color="light"
        content="취소"
        onclick={closeModal}
        disabled={isSubmitting}
      />
      <Button
        color="primary"
        content={isSubmitting ? '생성 중...' : '초대 링크 생성'}
        onclick={handleSubmit}
        disabled={isSubmitting || !email.trim() || !name.trim()}
      />
    {/if}
  {/snippet}
</BaseModal>
