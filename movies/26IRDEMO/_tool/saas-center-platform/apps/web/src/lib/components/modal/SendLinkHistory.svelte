<script lang="ts">
  import { onMount } from 'svelte'
  import { requireCenterId } from '$lib/stores/center.store'
  import {
    listLinkHistory,
    getLinkDeliveries,
    resendLinkMessage,
    type SendLinkSummary
  } from '$lib/hooks/actions/sendLinkHistory.action'
  import type { LinkDelivery } from '$lib/hooks/actions/sendLinkHistory.action'
  import { formatUtcToKst } from '$lib/utils/date'

  let {
    caseId,
    templateId,
    templateName,
    canResend,
    onSent,
    onBusy
  }: {
    caseId: string
    templateId?: string
    templateName: string
    canResend: boolean
    onSent?: () => void
    onBusy?: (busy: boolean) => void
  } = $props()
  let links = $state<SendLinkSummary[]>([])
  let deliveries = $state<Record<string, LinkDelivery[]>>({})
  let error = $state('')
  let feedback = $state('')
  let loading = $state(true)
  let busy = $state(false)
  let confirming = $state('')
  let disposed = false
  async function load() {
    loading = true
    error = ''
    try {
      const centerId = requireCenterId()
      const entries = await listLinkHistory(centerId, caseId)
      const logs = await Promise.all(
        entries.map(
          async (entry) =>
            [
              entry.id,
              await getLinkDeliveries(centerId, caseId, entry.id)
            ] as const
        )
      )
      if (disposed) return
      links = entries.toSorted((first, second) =>
        second.created_at.localeCompare(first.created_at)
      )
      deliveries = Object.fromEntries(logs)
    } catch {
      if (!disposed)
        error =
          '전송 내역을 불러오지 못했습니다. 조회 권한과 연결을 확인하고 다시 시도해주세요.'
    } finally {
      if (!disposed) loading = false
    }
  }
  function inactive(link: SendLinkSummary) {
    return (
      !!link.revoked_at ||
      (!!link.expires_at &&
        Date.parse(
          link.expires_at.endsWith('Z') ||
            /[+-]\d\d:\d\d$/.test(link.expires_at)
            ? link.expires_at
            : link.expires_at + 'Z'
        ) <= Date.now())
    )
  }
  async function resend(link: SendLinkSummary) {
    if (busy || !canResend || inactive(link)) return
    busy = true
    onBusy?.(true)
    feedback = ''
    try {
      const result = await resendLinkMessage(
        requireCenterId(),
        caseId,
        link.id,
        templateId
      )
      const failed = result.delivery_results.filter(
        (entry) => entry.status !== 'sent'
      )
      feedback = !result.delivery_results.length
        ? '재전송 대상이 없습니다.'
        : failed.length
          ? `${failed.length}건의 재전송에 실패했습니다. 발송 내역을 확인해주세요.`
          : '메시지를 재전송했습니다.'
      if (result.delivery_results.some((entry) => entry.status === 'sent'))
        onSent?.()
      confirming = ''
      await load()
    } catch {
      feedback = '재전송하지 못했습니다. 링크 상태와 발송 설정을 확인해주세요.'
    } finally {
      busy = false
      onBusy?.(false)
    }
  }
  onMount(() => {
    void load()
    return () => {
      disposed = true
    }
  })
</script>

<section class="space-y-4" aria-label="바로링크 전송 내역">
  {#if !canResend}
    <p class="text-sm text-amber-700">
      재전송하려면 전송 탭에서 검사 링크와 인증번호가 포함된 양식을
      선택해주세요.
    </p>
  {/if}
  <div class="flex flex-wrap items-center justify-between gap-3">
    <p class="text-sm text-gray-600">
      재전송 양식: {templateName} · 변경은 전송 탭에서 가능합니다.
    </p>
    <button
      type="button"
      onclick={load}
      disabled={loading || busy}
      class="text-sm text-primary-500 underline">내역 새로고침</button
    >
  </div>
  {#if feedback}<p role="status" class="text-sm text-gray-700">
      {feedback}
    </p>{/if}
  {#if error}<p role="alert" class="text-sm text-red-600">{error}</p>
  {:else if loading}
    <div role="status" aria-label="전송 내역 불러오는 중" class="space-y-3">
      <p class="text-sm text-gray-500">전송 내역을 불러오는 중입니다.</p>
      <div aria-hidden="true" class="h-28 rounded-lg bg-gray-100"></div>
      <div aria-hidden="true" class="h-28 rounded-lg bg-gray-100"></div>
    </div>
  {:else if !links.length}<p class="py-10 text-center text-gray-500">
      아직 전송 내역이 없습니다.
    </p>
  {:else}
    {#each links as link (link.id)}
      <article class="space-y-3 rounded-lg border border-gray-200 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-gray-800">
            {formatUtcToKst(link.created_at, 'YYYY-MM-DD HH:mm')} · {link.channel ===
            'alarmtalk'
              ? '알림톡'
              : '문자'}
          </h3>
          <span class="text-xs text-gray-500"
            >{link.revoked_at
              ? '사용 중지'
              : inactive(link)
                ? '만료됨'
                : link.expires_at
                  ? `만료: ${formatUtcToKst(link.expires_at, 'YYYY-MM-DD HH:mm')}`
                  : '만료일 없음'}</span
          >
        </div>
        <p class="text-sm text-gray-700">
          {link.recipients
            .map((recipient) => `${recipient.name} · ${recipient.phone}`)
            .join(', ')}
        </p>
        {#each deliveries[link.id] ?? [] as log (log.id)}
          <p class="text-sm text-gray-600">
            {formatUtcToKst(log.created_at, 'YYYY-MM-DD HH:mm')} · {log.recipient}
            · {log.status === 'sent'
              ? '발송 접수'
              : log.status === 'failed'
                ? '발송 실패'
                : '처리 중'}
          </p>
        {/each}
        {#if confirming === link.id}
          <div class="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            <p>
              선택한 양식으로 위 수신자 모두에게 다시 보낼까요? 기존 링크와 기존
              발송 채널을 유지하며 발송 비용이 발생할 수 있습니다.
            </p>
            <div class="mt-3 flex gap-3">
              <button
                type="button"
                disabled={busy || !canResend}
                onclick={() => resend(link)}
                class="rounded-lg bg-primary-500 px-4 py-2 text-white"
                >{busy ? '재전송 중…' : '재전송 확인'}</button
              >
              <button
                type="button"
                disabled={busy}
                onclick={() => (confirming = '')}>취소</button
              >
            </div>
          </div>
        {:else}
          <button
            type="button"
            disabled={busy || !canResend || inactive(link)}
            onclick={() => (confirming = link.id)}
            class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-primary-500 disabled:opacity-40"
            >재전송</button
          >
        {/if}
      </article>
    {/each}
  {/if}
</section>
