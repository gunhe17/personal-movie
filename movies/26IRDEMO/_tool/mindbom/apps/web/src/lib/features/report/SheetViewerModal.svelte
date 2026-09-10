<script lang="ts">
  /**
   * 결과지 이미지 뷰어 — 결과 화면이 아직 없는 검사(목업 표준화 검사)용.
   *
   * 실검사는 ResultEmbedModal이 결과 페이지를 그대로 띄우고, 이쪽은 스캔된
   * 결과지 이미지를 세로로 나열하기만 한다.
   */
  import BaseModal from '$components/modal/BaseModal.svelte'

  interface Props {
    title: string
    images: string[]
    closeModal?: () => void
  }

  let { title, images, closeModal = () => {} }: Props = $props()
</script>

<!--
  높이는 호출부의 customHeight가 잡는다(ModalContainer).
  스크롤은 BaseModal 바디가 갖는다 — 안쪽에 overflow를 또 주면 두 겹이 된다.
-->
<BaseModal
  {title}
  {closeModal}
  bodyClass="scrollbar-custom scrollbar-light space-y-4 bg-gray-50 p-5"
>
  {#snippet body()}
    {#each images as src (src)}
      <img
        {src}
        alt={title}
        class="w-full rounded-lg bg-white shadow-sm ring-1 ring-gray-200"
      />
    {/each}
  {/snippet}
</BaseModal>
