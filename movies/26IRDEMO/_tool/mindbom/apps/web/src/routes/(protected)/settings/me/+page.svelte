<script lang="ts">
  import { fade } from 'svelte/transition'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth'
  import { modalStore } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { postRaw } from '$lib/services/api/instances'
  import PasswordChangeModal from '$lib/features/auth/components/PasswordChangeModal.svelte'
  import Button from '$components/ui/Button.svelte'
  import Card from '$components/ui/Card.svelte'
  import PageTitleSection from '$components/ui/PageTitleSection.svelte'
  import SectionTitle from '$components/ui/SectionTitle.svelte'
  import DescriptionList, {
    type DescriptionItem
  } from '$components/ui/DescriptionList.svelte'

  let user = $derived($auth.user)

  const ROLE_LABELS: Record<string, string> = {
    admin: '관리자',
    clinician: '임상심리사',
    researcher: '연구원',
  }

  let accountItems = $derived<DescriptionItem[]>([
    { label: '이름', value: user?.name },
    { label: '이메일', value: user?.email },
    {
      label: '역할',
      value: user?.role ? (ROLE_LABELS[user.role] ?? user.role) : null
    }
  ])

  function openPasswordModal() {
    modalStore.open({
      component: PasswordChangeModal,
      props: {
        onConfirm: async (data: { current_password: string; new_password: string }) => {
          // 백엔드는 변경 성공 시 모든 refresh 토큰을 무효화 — 재로그인 강제
          await postRaw('/auth/change-password', data)
          snackbarStore.success('비밀번호가 변경되었습니다. 다시 로그인해주세요.')
          await auth.logout()
          goto('/login', { replaceState: true })
        }
      },
      options: { size: 'md' }
    })
  }
</script>

<!-- 설정은 폼·정보 카드만 있어 한 화면 고정을 쓰지 않는다 — 페이지가 스크롤한다. -->
<div in:fade class="max-w-200 p-4 md:p-6 lg:p-8">
  <PageTitleSection title="내 설정" description="내 계정과 보안 설정을 관리합니다" />

  <!-- 내 계정 -->
  <Card class="mb-4">
    <SectionTitle title="내 계정" />
    <DescriptionList items={accountItems} />
  </Card>

  <!-- 보안 -->
  <Card>
    <SectionTitle title="보안" />
    <div class="flex items-center justify-between gap-4">
      <div class="min-w-0">
        <p class="text-body-01-normal-medium text-gray-900">비밀번호 변경</p>
        <p class="mt-1 text-body-03-normal-regular text-gray-500">
          현재 비밀번호를 새 비밀번호로 변경합니다
        </p>
      </div>
      <Button variant="outlineSecondary" size="md" onclick={openPasswordModal}>
        변경
      </Button>
    </div>
  </Card>
</div>
