<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Button from '$components/ui/Button.svelte'

  let {
    title = '확인',
    message = '',
    confirmText = '확인',
    cancelText = '취소',
    modalId = '',
    closeModal = () => {},
    _modalResolve = (_v: any) => {}
  }: {
    title?: string
    message?: string
    confirmText?: string
    cancelText?: string
    modalId?: string
    closeModal?: () => void
    _modalResolve?: (v: any) => void
  } = $props()

  function handleConfirm() {
    _modalResolve('confirmed')
    closeModal()
  }

  function handleCancel() {
    _modalResolve(null)
    closeModal()
  }
</script>

<!--
  작은 확인 다이얼로그(§5-10)라 헤더 구분선과 닫기 X를 쓰지 않는다.
  본문이 짧아 스크롤도 필요 없고, 닫는 길은 취소 버튼과 ESC로 충분하다.

  ⚠️ **`bodyScrollable={false}`를 반드시 넘긴다.** `BaseModal`의 기본값이
  `true`(`overflow-y-auto`)라, 안 넘기면 확인 문구가 두어 줄만 길어져도 이
  작은 상자 안에 스크롤바가 생긴다. 위 주석이 "스크롤도 필요 없다"고 적고도
  실제로는 스크롤 영역이던 자리다. 확인 다이얼로그는 내용을 다 보고 결정하는
  곳이므로, 문구가 길면 상자가 늘어나는 것이 맞다.
-->
<BaseModal
  closeModal={handleCancel}
  {title}
  showCloseButton={false}
  showHeaderBorder={false}
  showFooterBorder={false}
  bodyScrollable={false}
  headerClass="px-6 pt-5 pb-0"
  bodyClass="px-6 pt-3 pb-0"
  footerClass="px-6 pt-6 pb-5"
>
  {#snippet body()}
    <p class="text-body-02-normal-regular text-gray-600">{message}</p>
  {/snippet}

  {#snippet footer()}
    <Button variant="outlineSecondary" size="md" onclick={handleCancel}>
      {cancelText}
    </Button>
    <Button variant="primary" size="md" onclick={handleConfirm}>
      {confirmText}
    </Button>
  {/snippet}
</BaseModal>
