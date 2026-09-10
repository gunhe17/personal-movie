<script lang="ts">
  // AI 초안 이력 모달 — 일지 문서 맨 위 '초안 N건'에서 연다.
  // 조회 전용(footer 없음)이라 본문 하단만 40, 좌우·상단은 20 (Web_Design.md §Components>modal).
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import AiDraftHistory from './AiDraftHistory.svelte'

  interface Props {
    sessionId: string
    /** 본문 필드에 초안 텍스트를 이어붙인다 */
    onInsert?: (field: 'goal' | 'progress' | 'nextPlan', text: string) => void
    /** modalStore가 주입 */
    modalId?: string
    closeModal?: () => void
  }

  let { sessionId, onInsert, modalId = '', closeModal }: Props = $props()
</script>

<BaseModal
  {modalId}
  title="AI 초안 이력"
  size="md"
  bodyClass="p-5 pb-10"
  closeModal={() => closeModal?.()}
>
  {#snippet body()}
    <AiDraftHistory
      {sessionId}
      onInsert={(field, text) => {
        onInsert?.(field, text)
        closeModal?.()
      }}
    />
  {/snippet}
</BaseModal>
