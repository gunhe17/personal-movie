<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import ConfirmModal from './ConfirmModal.svelte'
  import Button from '$components/Button.svelte'
  import Typography from '$components/Typography.svelte'
  import { modalStore } from '$lib/stores/modal'
  import { auth } from '$lib/stores/auth'
  import { canOperate } from '$lib/utils/permissions'
  import { formatDate, formatAddress } from '$lib/utils/format'
  import { queryBuilder, mutationBuilder } from '$hooks/queries/builder'
  import {
    getApplicationDetail,
    postApproveApplication,
    postRejectApplication,
    type ApplicationDetail,
    type ApplicationStatus
  } from '$hooks/actions/application.action'

  interface Props {
    modalId?: string
    closeModal?: () => void
    applicationId: string
  }

  let { modalId = '', closeModal = () => {}, applicationId }: Props = $props()

  let rejectReason = $state('')

  // ─── 쿼리 ───
  const detailQuery = $derived(
    queryBuilder(getApplicationDetail, () => ({ applicationId }))
  )

  const detail = $derived<ApplicationDetail | null>(detailQuery.data ?? null)
  const isLoading = $derived(detailQuery.isPending)

  // ─── 뮤테이션 ───
  const approveMutation = mutationBuilder(
    postApproveApplication,
    undefined,
    undefined,
    {
      successMessage: '센터 신청이 승인되었습니다.',
      onSettled: () => closeModal()
    }
  )

  const rejectMutation = mutationBuilder(
    postRejectApplication,
    undefined,
    undefined,
    {
      successMessage: '센터 신청이 거절되었습니다.',
      onSettled: () => closeModal()
    }
  )

  // ─── 확인 모달 후 실행 ───
  async function handleApprove() {
    const result = await modalStore.openWithPromise(
      ConfirmModal,
      {
        title: '신청 승인',
        message: '해당 센터 신청을 승인하시겠습니까?',
        confirmText: '승인',
        type: 'info'
      },
      { size: 'sm' }
    )
    if (result === 'confirmed') {
      approveMutation.mutate({ applicationId })
    }
  }

  async function handleReject() {
    const result = await modalStore.openWithPromise(
      ConfirmModal,
      {
        title: '신청 거절',
        message: '해당 센터 신청을 거절하시겠습니까?',
        confirmText: '거절',
        type: 'danger'
      },
      { size: 'sm' }
    )
    if (result === 'confirmed') {
      rejectMutation.mutate({
        applicationId,
        reason: rejectReason || undefined
      })
    }
  }

  const canManage = $derived(canOperate($auth.user?.role))

  const statusConfig: Record<
    ApplicationStatus,
    { label: string; bg: string; text: string; dot: string }
  > = {
    pending: {
      label: '대기',
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      dot: 'bg-yellow-500'
    },
    approved: {
      label: '승인',
      bg: 'bg-green-50',
      text: 'text-green-700',
      dot: 'bg-green-500'
    },
    rejected: {
      label: '거절',
      bg: 'bg-red-50',
      text: 'text-red-600',
      dot: 'bg-red-500'
    }
  }
</script>

<BaseModal {modalId} {closeModal} headerClass="px-6 py-4" bodyClass="px-6 py-5">
  {#snippet header()}
    <Typography variant="title-02-semibold" color="text-gray-900"
      >신청 상세</Typography
    >
  {/snippet}

  {#snippet body()}
    {#if isLoading}
      <div class="flex items-center justify-center py-16">
        <Typography variant="body-02-regular" color="text-gray-400"
          >불러오는 중...</Typography
        >
      </div>
    {:else if detail}
      {@const status = statusConfig[detail.status]}
      <div class="space-y-5">
        <!-- 기본 정보 그리드 -->
        <div class="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">센터명</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800"
              >{detail.center_name}</Typography
            >
          </div>
          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">상태</Typography
            >
            {#if status}
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium {status.bg} {status.text}"
              >
                <span class="h-1.5 w-1.5 rounded-full {status.dot}"></span>
                {status.label}
              </span>
            {/if}
          </div>

          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">신청자</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800"
              >{detail.applicant_name}</Typography
            >
            <Typography variant="body-03-normal-regular" color="text-gray-500"
              >{detail.applicant_email}</Typography
            >
          </div>
          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">신청일</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800"
              >{formatDate(detail.created_at)}</Typography
            >
          </div>

          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">대표자</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800"
              >{detail.representative_name ?? '-'}</Typography
            >
          </div>
          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">사업자번호</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800"
              >{detail.business_registration_number ?? '-'}</Typography
            >
          </div>

          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">연락처</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800"
              >{detail.phone ?? '-'}</Typography
            >
          </div>
          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">주소</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800"
              >{formatAddress(detail.address)}</Typography
            >
          </div>
        </div>

        <!-- 센터 소개 -->
        {#if detail.description}
          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-400"
              className="mb-2">센터 소개</Typography
            >
            <Typography
              variant="body-02-normal-regular"
              color="text-gray-700"
              whitespace="pre-line">{detail.description}</Typography
            >
          </div>
        {/if}

        <!-- 거절 사유 표시 -->
        {#if detail.status === 'rejected' && detail.reviewed_reason}
          <div class="rounded-lg bg-red-50 p-3">
            <Typography
              variant="body-03-normal-regular"
              color="text-red-500"
              className="mb-2">거절 사유</Typography
            >
            <Typography variant="body-02-normal-regular" color="text-red-700"
              >{detail.reviewed_reason}</Typography
            >
          </div>
        {/if}

        <!-- 거절 사유 입력 (admin+ 전용) -->
        {#if canManage && detail.status === 'pending'}
          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">거절 사유 (선택)</Typography
            >
            <textarea
              bind:value={rejectReason}
              placeholder="거절 시 사유를 입력해주세요"
              class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-primary-500 resize-none"
              rows="2"
            ></textarea>
          </div>
        {/if}
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    {#if canManage && detail?.status === 'pending'}
      <Button color="stroke-delete" content="거절" onclick={handleReject} />
      <Button color="primary" content="승인" onclick={handleApprove} />
    {:else}
      <Button color="primary" content="닫기" onclick={closeModal} />
    {/if}
  {/snippet}
</BaseModal>
