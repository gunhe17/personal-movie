<script lang="ts">
  import { hasGuardianRole, t, josa } from '$lib/ontology/terms'
  import { browser } from '$app/environment'
  import { goto } from '$app/navigation'
  import { useQueryClient } from '@tanstack/svelte-query'
  import Typography from '@common/components/Typography.svelte'
  import Button from '$lib/components/Button.svelte'
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import { centerId } from '$lib/stores/center.store'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getAppLinkStatus } from '$lib/hooks/actions/appLink.action'
  import { getClientRelations } from '$lib/hooks/actions/client.action'
  import {
    mapToAppLinkVM,
    createAppLinkService
  } from '$lib/features/clients/detail/app-link'
  import { maskName } from '$lib/utils/maskingHandler'

  interface Props {
    modalId?: string
    closeModal?: () => void
    clientId: string
    /** 내담자 role — guardian|both면 이 화면에서 발급, client면 보호자로 안내만 */
    role: string
    /** 보호자 상세일 때의 표시 이름 (시크릿 모드 마스킹 적용된 값) */
    guardianName: string
    isSecretMode?: boolean
  }

  let {
    modalId = '',
    closeModal = () => {},
    clientId,
    role,
    guardianName,
    isSecretMode = false
  }: Props = $props()

  const isGuardian = $derived(hasGuardianRole(role))

  // 발급은 보호자 상세 한 곳에서만 — 코드 생명주기(발급·재발급·연결됨)를 한 화면에
  // 모아 상태 혼란을 없앤다(설계 §0-6, 발급 단위=보호자). 아이 상세는 안내만.
  // 쿼리 키는 트리거(AppLinkSection)와 동일 — 캐시를 공유하므로 중복 호출이 아니다.
  const statusQuery = $derived(
    queryBuilder(
      getAppLinkStatus,
      () =>
        $centerId && isGuardian ? { centerId: $centerId, clientId } : null,
      { enabled: browser && !!$centerId && isGuardian, throwOnError: false }
    )
  )

  // 아이 상세 — 발급하지 않고, 연결된 보호자가 있는지만 확인해 길을 안내한다.
  const relationsQuery = $derived(
    queryBuilder(
      getClientRelations,
      () =>
        $centerId && !isGuardian
          ? { centerId: $centerId, clientId, relationCategory: 'guardian' }
          : null,
      { enabled: browser && !!$centerId && !isGuardian, throwOnError: false }
    )
  )

  const linkedGuardian = $derived(
    (relationsQuery.data ?? []).find((r) => r.relation_type === 'guardian')
  )

  const vm = $derived(mapToAppLinkVM(statusQuery.data))

  const queryClient = useQueryClient()

  const service = $derived.by(() =>
    createAppLinkService({
      clientId,
      refetchStatus: () => statusQuery.refetch(),
      // 본인 연결 성공 = role이 both로 승격 → 상세를 다시 불러오면
      // 이 모달이 보호자 화면으로 바뀌며 발급된 코드가 표시된다
      onSelfLinked: () =>
        queryClient.invalidateQueries({
          queryKey: ['getClientDetail'],
          exact: false
        })
    })
  )

  let issuing = $state(false)
  let sendingSms = $state(false)

  async function handleSendSms() {
    sendingSms = true
    try {
      await service.sendCodeSms()
    } finally {
      sendingSms = false
    }
  }

  async function handleIssue() {
    issuing = true
    try {
      await service.issueInvitation()
    } finally {
      issuing = false
    }
  }

  async function handleReissue() {
    issuing = true
    try {
      // 이미 연결된 자녀가 있으면 "가족 갈라짐" 경고를 띄운다
      await service.reissueInvitation((vm?.children.length ?? 0) > 0)
    } finally {
      issuing = false
    }
  }

  async function handleSelfIssue() {
    issuing = true
    try {
      await service.issueSelfInvitation()
    } finally {
      issuing = false
    }
  }

  function goAndClose(path: string) {
    closeModal()
    goto(path)
  }
</script>

<BaseModal {modalId} {closeModal} title="앱 연결" size="narrow" bodyClass="p-5">
  {#snippet body()}
    {#if isGuardian}
      {#if statusQuery.isLoading}
        <Typography variant="body-02-normal-regular" color="text-gray-400">
          로딩 중...
        </Typography>
      {:else if statusQuery.isError}
        <div class="flex flex-col gap-2">
          <Typography variant="body-02-normal-regular" color="text-gray-500">
            연결 상태를 불러오지 못했어요.
          </Typography>
          <Button
            color="stroke-secondary"
            size="sm"
            weight="medium"
            content="다시 시도"
            onclick={() => statusQuery.refetch()}
          />
        </div>
      {:else if vm}
        <!-- 연결 상태 -->
        <div class="flex items-center justify-between">
          <Typography variant="body-01-normal-medium" color="text-gray-800">
            연결 상태
          </Typography>
          <span
            class="flex h-6 shrink-0 items-center rounded-full px-2 text-label-01-normal-medium {vm
              .badge.className}"
          >
            {vm.badge.label}
          </span>
        </div>

        {#if vm.status === 'none'}
          <!-- 발급 전: 대상 확인 문구 + 발급 CTA -->
          <Typography
            variant="body-02-reading-regular"
            color="text-gray-600"
            className="mt-3 block"
          >
            {guardianName}
            {t('guardian')}에게 발급됩니다 — 연결되면 자녀가 앱에 보여요.
          </Typography>
          <Button
            color="primary-dark"
            size="title"
            weight="medium"
            class="mt-6 w-full"
            content="앱 초대 코드 발급"
            loading={issuing}
            onclick={handleIssue}
          />
        {:else if vm.status === 'invited' && vm.invitation}
          <!-- 발급됨·대기: 6자리 코드 크게 + 만료 안내 + 재발급 -->
          {@render codeBlock(vm.invitation.code)}
          <Typography
            variant="label-01-reading-regular"
            color="text-gray-500"
            className="mt-2 block text-center"
          >
            48시간 유효 · {vm.invitation.expiresAtLabel}까지
          </Typography>
          <Typography
            variant="label-01-reading-regular"
            color="text-gray-500"
            className="mt-1 block text-center"
          >
            {guardianName}
            {josa(t('guardian'), '이/가')} 앱에서 이 코드를 입력하면 연결돼요.
          </Typography>
          <Button
            color="stroke-secondary"
            size="title"
            weight="medium"
            class="mt-6 w-full"
            content="문자로 코드 보내기"
            loading={sendingSms}
            onclick={handleSendSms}
          />
          <Button
            color="stroke-secondary"
            size="title"
            weight="medium"
            class="mt-2 w-full"
            content="재발급"
            loading={issuing}
            onclick={handleReissue}
          />
        {:else if vm.status === 'linked'}
          <!-- 연결됨: 자녀 목록 + (있으면) 대기 중 코드 + 추가 연결용 재발급 -->
          {#if vm.children.length > 0}
            <ul class="mt-3 flex flex-col gap-2">
              {#each vm.children as child (child.clientId)}
                <li
                  class="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="shrink-0 text-green-700" aria-hidden="true">
                      {@render checkIcon()}
                    </span>
                    <Typography
                      variant="body-02-normal-medium"
                      color="text-gray-800"
                      className="truncate-safe"
                    >
                      {isSecretMode ? maskName(child.name) : child.name}
                    </Typography>
                  </div>
                  {#if child.linkedAtLabel}
                    <Typography
                      variant="label-01-normal-regular"
                      color="text-gray-500"
                      className="shrink-0 whitespace-nowrap"
                    >
                      {child.linkedAtLabel} 연결
                    </Typography>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
          {#if vm.invitation}
            <div class="mt-3">
              {@render codeBlock(vm.invitation.code)}
              <Typography
                variant="label-01-reading-regular"
                color="text-gray-500"
                className="mt-2 block text-center"
              >
                추가 연결 대기 중 · 48시간 유효 · {vm.invitation
                  .expiresAtLabel}까지
              </Typography>
              <Button
                color="stroke-secondary"
                size="title"
                weight="medium"
                class="mt-2 w-full"
                content="문자로 코드 보내기"
                loading={sendingSms}
                onclick={handleSendSms}
              />
            </div>
          {/if}
          <Button
            color="stroke-secondary"
            size="title"
            weight="medium"
            class="mt-6 w-full"
            content={vm.invitation ? '재발급' : '추가 연결 코드 발급'}
            loading={issuing}
            onclick={handleReissue}
          />
          <!-- 같은 집 부부는 재발급이 아니라 앱 가족 초대를 써야 데이터가 안 갈라진다 -->
          <div class="mt-6 flex gap-2 rounded-lg bg-gray-50 p-3">
            <span class="shrink-0 text-gray-400" aria-hidden="true">
              {@render familyIcon()}
            </span>
            <div class="flex flex-col gap-1">
              <Typography
                variant="label-01-normal-medium"
                color="text-gray-700"
              >
                같은 가족이 함께 보려면
              </Typography>
              <Typography
                variant="label-01-reading-regular"
                color="text-gray-500"
                className="block"
              >
                이미 연결한 {josa(t('guardian'), '이/가')} 앱에서
                <span class="font-medium text-gray-600"
                  >[마이 › 가족 › 초대]</span
                >로 초대하세요. 새 코드는 다른 {josa(t('guardian'), '을/를')} 따로
                연결할 때만 씁니다.
              </Typography>
            </div>
          </div>
        {/if}
      {/if}
    {:else if linkedGuardian}
      <!-- 아이 상세 · 보호자 있음 — 발급은 보호자 화면에서만. 여기선 길만 안내한다. -->
      <Typography
        variant="body-02-reading-regular"
        color="text-gray-600"
        className="block"
      >
        앱 연결은 {t('guardian')} 화면에서 관리해요. 초대 코드는 {t(
          'guardian'
        )}에게 발급되고, 연결되면 이 아이가 앱에 보여요.
      </Typography>
      <Button
        color="stroke-secondary"
        size="title"
        weight="medium"
        class="mt-6 w-full"
        content={`${t('guardian')} 화면으로 이동`}
        onclick={() =>
          goAndClose(`/clients/${linkedGuardian.related_client_id}`)}
      />
    {:else if !relationsQuery.isLoading}
      <!-- 아이 상세 · 보호자 미등록 — 보호자 등록으로 잇거나, 청소년·성인 본인이면
           본인에게 직접 발급(서버가 both 승격+발급, 14세 미만은 거절) -->
      <Typography
        variant="body-02-reading-regular"
        color="text-gray-600"
        className="block"
      >
        앱 연결은 {t('guardian')} 단위로 이뤄져요. {josa(
          t('guardian'),
          '을/를'
        )} 등록하거나, 본인이 직접 사용한다면 본인에게 발급할 수 있어요.
      </Typography>
      <Button
        color="stroke-secondary"
        size="title"
        weight="medium"
        class="mt-6 w-full"
        content={`${t('guardian')} 등록`}
        onclick={() =>
          goAndClose(`/clients/register?editClient=${clientId}&focus=guardian`)}
      />
      <Button
        color="stroke-secondary"
        size="title"
        weight="medium"
        class="mt-2 w-full"
        content="본인에게 코드 발급"
        loading={issuing}
        onclick={handleSelfIssue}
      />
    {/if}
  {/snippet}
</BaseModal>

<!-- 6자리 초대 코드 (모노스페이스, 복사 버튼) -->
{#snippet codeBlock(code: string)}
  <div
    class="mt-3 flex items-center justify-center gap-2 rounded-lg bg-gray-50 px-3 py-4"
  >
    <span
      class="text-headline-01-normal-bold font-mono tracking-widest text-gray-900 select-all"
    >
      {code}
    </span>
    <button
      type="button"
      class="flex-center shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      aria-label="초대 코드 복사"
      onclick={() => service.copyCode(code)}
    >
      {@render copyIcon()}
    </button>
  </div>
{/snippet}

{#snippet copyIcon()}
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect
      x="5.5"
      y="5.5"
      width="8"
      height="8"
      rx="1.5"
      stroke="currentColor"
      stroke-width="1.3"
    />
    <path
      d="M10.5 5.5v-2A1.5 1.5 0 0 0 9 2H4a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 4 10h1.5"
      stroke="currentColor"
      stroke-width="1.3"
      stroke-linecap="round"
    />
  </svg>
{/snippet}

{#snippet checkIcon()}
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="m3 7.5 2.5 2.5L11 4.5"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
{/snippet}

{#snippet familyIcon()}
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="5" cy="4.5" r="2" stroke="currentColor" stroke-width="1.3" />
    <circle cx="11" cy="4.5" r="2" stroke="currentColor" stroke-width="1.3" />
    <path
      d="M2 13v-.5a3 3 0 0 1 3-3 3 3 0 0 1 2.4 1.2M14 13v-.5a3 3 0 0 0-3-3 3 3 0 0 0-2.4 1.2"
      stroke="currentColor"
      stroke-width="1.3"
      stroke-linecap="round"
    />
  </svg>
{/snippet}
