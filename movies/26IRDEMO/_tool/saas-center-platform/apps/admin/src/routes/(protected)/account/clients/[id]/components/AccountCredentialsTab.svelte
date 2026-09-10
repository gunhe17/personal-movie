<!--
  AccountCredentialsTab
  계정 상세 페이지의 '자격 정보' 탭.

  - 검증 우선순위 정렬은 백엔드가 처리
  - 각 항목에 첨부 미리보기 + (pending이면) 승인/반려 버튼
  - 반려 시 사유 입력
-->
<script lang="ts">
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import { queryBuilder, mutationBuilder } from '$hooks/queries/builder'
  import { modalStore } from '$lib/stores/modal'
  import { formatDate } from '$lib/utils/format'

  import {
    listCredentialsByAccount,
    approveCredential,
    rejectCredential,
    type AdminCredential,
    type CredentialType,
    type VerificationStatus
  } from '$hooks/actions/credential.action'

  import RejectReasonModal from './RejectReasonModal.svelte'

  interface Props {
    accountId: string
  }

  let { accountId }: Props = $props()

  const query = $derived(
    queryBuilder(listCredentialsByAccount, () => ({ accountId }))
  )

  const credentials = $derived<AdminCredential[]>(query.data ?? [])
  const isLoading = $derived(query.isPending)

  // kind별로 그룹화 (학력 → 경력 → 자격 순서 고정)
  const KIND_ORDER: CredentialType[] = ['education', 'career', 'certification']

  const groups = $derived(
    KIND_ORDER.map((credential_type) => ({
      credential_type,
      items: credentials.filter((c) => c.credential_type === credential_type)
    })).filter((g) => g.items.length > 0)
  )

  const approveMutation = mutationBuilder(
    approveCredential,
    undefined,
    undefined,
    { successMessage: '자격을 승인했습니다.' }
  )

  const rejectMutation = mutationBuilder(
    rejectCredential,
    undefined,
    undefined,
    { successMessage: '자격을 반려했습니다.' }
  )

  function handleApprove(credentialId: string) {
    approveMutation.mutate({ credentialId })
  }

  async function handleReject(credentialId: string) {
    const reason = (await modalStore.openWithPromise(
      RejectReasonModal,
      {},
      { size: 'sm' }
    )) as string | null
    if (!reason) return
    rejectMutation.mutate({ credentialId, reason })
  }

  // ─── 라벨 매핑 ───

  const KIND_LABEL: Record<CredentialType, string> = {
    education: '학력',
    career: '경력',
    certification: '자격증'
  }

  const STATUS_LABEL: Record<VerificationStatus, string> = {
    unverified: '미인증',
    pending: '검증 대기',
    verified: '인증됨',
    rejected: '반려됨'
  }

  const STATUS_TONE: Record<
    VerificationStatus,
    { bg: string; text: string; dot: string }
  > = {
    unverified: {
      bg: 'bg-gray-50',
      text: 'text-gray-600',
      dot: 'bg-gray-400'
    },
    pending: {
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      dot: 'bg-yellow-500'
    },
    verified: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500'
    },
    rejected: {
      bg: 'bg-red-50',
      text: 'text-red-600',
      dot: 'bg-red-500'
    }
  }

  function formatPeriod(c: AdminCredential): string {
    const start = c.start_date ? c.start_date.slice(0, 7).replace('-', '.') : ''
    if (c.credential_type === 'certification') return start
    const end = c.is_current
      ? c.credential_type === 'career'
        ? '재직중'
        : '재학중'
      : c.end_date
        ? c.end_date.slice(0, 7).replace('-', '.')
        : ''
    if (!start && !end) return ''
    if (start && end) return `${start} - ${end}`
    return start || end
  }

  function formatFileSize(bytes: number): string {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }
</script>

<div class="space-y-4">
  {#if isLoading}
    <div class="flex items-center justify-center py-16">
      <Typography variant="body-02-regular" color="text-gray-400">
        불러오는 중...
      </Typography>
    </div>
  {:else if credentials.length === 0}
    <div
      class="flex items-center justify-center rounded-lg border border-gray-100 py-16"
    >
      <Typography variant="body-02-regular" color="text-gray-400">
        등록된 자격 정보가 없습니다.
      </Typography>
    </div>
  {:else}
    <div class="flex flex-col gap-6">
      {#each groups as group (group.credential_type)}
        <section>
          <header class="mb-3 flex items-center gap-2">
            <Typography variant="body-01-semibold" color="text-gray-800">
              {KIND_LABEL[group.credential_type]}
            </Typography>
            <span class="text-sm font-normal text-gray-400">
              ({group.items.length})
            </span>
          </header>

          <ul class="flex flex-col gap-3">
            {#each group.items as c (c.id)}
              {@const tone = STATUS_TONE[c.verification.status]}
              <li
                class="rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300"
              >
                <div class="flex items-start gap-4">
                  <div class="flex-1 min-w-0">
                    <!-- 제목 + 상태 -->
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                      <Typography
                        variant="body-01-semibold"
                        color="text-gray-900"
                        className="truncate"
                      >
                        {c.title}
                      </Typography>
                      <span
                        class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {tone.bg} {tone.text}"
                      >
                        <span class="h-1.5 w-1.5 rounded-full {tone.dot}"></span>
                        {STATUS_LABEL[c.verification.status]}
                      </span>
                    </div>

              <!-- 보조 정보 -->
              <div class="text-sm text-gray-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>{c.organization}</span>
                {#if formatPeriod(c)}
                  <span class="text-gray-300">·</span>
                  <span class="text-gray-500">{formatPeriod(c)}</span>
                {/if}
              </div>

              <!-- 신청 정보 -->
              {#if c.verification.requested_at}
                <div class="mt-2 text-xs text-gray-500">
                  신청일: {formatDate(c.verification.requested_at)}
                </div>
              {/if}
              {#if c.verification.reviewed_at}
                <div class="text-xs text-gray-500">
                  처리일: {formatDate(c.verification.reviewed_at)}
                </div>
              {/if}

              <!-- 반려 사유 -->
              {#if c.verification.status === 'rejected' && c.verification.reject_reason}
                <div
                  class="mt-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700"
                >
                  반려 사유: {c.verification.reject_reason}
                </div>
              {/if}

              <!-- 첨부 파일명 (클릭 시 다운로드) -->
              {#if c.attachment}
                <a
                  href={c.attachment.url}
                  download={c.attachment.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 hover:underline max-w-full"
                >
                  <svg
                    class="h-3.5 w-3.5 shrink-0"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <span class="truncate">{c.attachment.filename}</span>
                  {#if c.attachment.size}
                    <span class="text-gray-400 shrink-0">({formatFileSize(c.attachment.size)})</span>
                  {/if}
                </a>
              {/if}
            </div>

            <!-- 우측: 썸네일 + 액션 -->
            <div class="shrink-0 flex flex-col items-end gap-2">
              {#if c.attachment}
                <a
                  href={c.attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="block h-20 w-20 overflow-hidden rounded-md border border-gray-200 bg-gray-50 hover:border-primary-300"
                  title="원본 보기 — {c.attachment.filename}"
                >
                  {#if c.attachment.content_type?.startsWith('image/')}
                    <img
                      src={c.attachment.url}
                      alt={c.attachment.filename}
                      class="h-full w-full object-cover"
                      loading="lazy"
                    />
                  {:else if c.attachment.content_type === 'application/pdf'}
                    <div
                      class="flex h-full w-full flex-col items-center justify-center gap-1 bg-red-50"
                    >
                      <svg
                        class="h-6 w-6 text-red-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                      </svg>
                      <span class="text-[10px] font-semibold text-red-600">PDF</span>
                    </div>
                  {:else}
                    <div
                      class="flex h-full w-full items-center justify-center bg-gray-100"
                    >
                      <svg
                        class="h-6 w-6 text-gray-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                      </svg>
                    </div>
                  {/if}
                </a>
              {/if}

                    {#if c.verification.status === 'pending'}
                      <div class="flex flex-col gap-2 w-24">
                        <Button
                          color="primary"
                          size="sm"
                          content="승인"
                          onclick={() => handleApprove(c.id)}
                        />
                        <Button
                          color="stroke-delete"
                          size="sm"
                          content="반려"
                          onclick={() => handleReject(c.id)}
                        />
                      </div>
                    {/if}
                  </div>
                </div>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {/if}
</div>
