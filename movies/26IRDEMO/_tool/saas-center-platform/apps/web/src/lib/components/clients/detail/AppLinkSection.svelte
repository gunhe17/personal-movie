<script lang="ts">
  import { hasGuardianRole } from '$lib/ontology/terms'
  import { browser } from '$app/environment'
  import Typography from '@common/components/Typography.svelte'
  import { centerId } from '$lib/stores/center.store'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getAppLinkStatus } from '$lib/hooks/actions/appLink.action'
  import { mapToAppLinkVM } from '$lib/features/clients/detail/app-link'
  import { modalStore } from '$lib/stores/modal'
  import AppLinkModal from './AppLinkModal.svelte'
  import CheckIcon20 from '$lib/assets/CheckIcon20.svelte'

  interface Props {
    clientId: string
    /** 내담자 role — guardian|both면 이 화면에서 발급, client면 보호자로 안내만 */
    role: string
    /** 보호자 상세일 때의 표시 이름 (시크릿 모드 마스킹 적용된 값) */
    guardianName: string
    isSecretMode?: boolean
  }

  let { clientId, role, guardianName, isSecretMode = false }: Props = $props()

  const isGuardian = $derived(hasGuardianRole(role))

  // 좌측 패널은 상태 배지까지만 — 발급·재발급·코드 표시는 전부 모달이 담당한다.
  // (코드 생명주기 UI가 패널 세로 공간을 통째로 먹던 문제)
  const statusQuery = $derived(
    queryBuilder(
      getAppLinkStatus,
      () =>
        $centerId && isGuardian ? { centerId: $centerId, clientId } : null,
      { enabled: browser && !!$centerId && isGuardian, throwOnError: false }
    )
  )

  const vm = $derived(mapToAppLinkVM(statusQuery.data))

  // 상태를 라벨에 실어 배지 없이 표기 — 미연결이면 행동(연결하기), 그 외엔 현재 상태
  const buttonLabel = $derived(
    isGuardian && vm && vm.status !== 'none'
      ? vm.status === 'linked'
        ? '연동 완료'
        : vm.badge.label
      : '앱 연동'
  )
  // 연결 완료면 폰 아이콘 대신 초록 체크 — 상태를 아이콘으로도 알린다
  const isLinked = $derived(isGuardian && vm?.status === 'linked')

  function openModal() {
    modalStore.open({
      component: AppLinkModal as any,
      props: { clientId, role, guardianName, isSecretMode },
      options: { customWidth: 420 }
    })
  }
</script>

<!-- 사전기록지 버튼과 나란히 놓이는 그레이 라인 버튼(button-white · Medium 40 규격) —
     옛 gray-50 카드형 행을 대체한다. 상태는 라벨에 실어 배지를 없앤다
     (반폭 버튼에 배지까지 넣으면 라벨이 잘린다). -->
<button
  type="button"
  onclick={openModal}
  aria-label="앱 연동 관리"
  class="flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-border-default bg-white px-6 text-body-default transition-colors hover:bg-bg-base hover:text-body-strong"
>
  <span class="shrink-0 {isLinked ? 'text-green-700' : ''}" aria-hidden="true">
    {#if isLinked}
      <CheckIcon20 />
    {:else}
      {@render phoneAppIcon()}
    {/if}
  </span>
  <Typography
    variant="body-02-normal-medium"
    color="text-inherit"
    className="min-w-0 truncate-safe"
  >
    {buttonLabel}
  </Typography>
</button>

{#snippet phoneAppIcon()}
  <!-- 사전기록지 아이콘과 한 쌍 — 둘 다 fill · 20×20 · viewBox 0 0 20 20 -->
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="shrink-0">
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M7.25 2.5h5.5A2.25 2.25 0 0 1 15 4.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-5.5A2.25 2.25 0 0 1 5 15.25V4.75A2.25 2.25 0 0 1 7.25 2.5Zm1.25 2a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z"
      fill="currentColor"
    />
  </svg>
{/snippet}
