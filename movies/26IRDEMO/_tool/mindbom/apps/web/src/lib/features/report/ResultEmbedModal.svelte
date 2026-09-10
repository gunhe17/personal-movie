<script lang="ts">
  /**
   * 검사 결과 화면을 iframe으로 띄우는 모달.
   *
   * 결과 페이지는 ?embed=1을 붙이면 크롬(헤더·사이드바·푸터) 없이 본문만
   * 그린다 — ExamLayoutShell이 흡수하고 있어 호출부는 그것을 몰라도 된다.
   *
   * 바깥(백드롭·스택·Escape·폭)은 ModalContainer가 잡는다. 여기는 내용만.
   */
  import BaseModal from '$components/modal/BaseModal.svelte'

  interface Props {
    /** 결과 화면 주소 (?embed=1 포함) */
    url: string
    title: string
    closeModal?: () => void
  }

  let { url, title, closeModal = () => {} }: Props = $props()
</script>

<!-- 높이는 호출부의 customHeight가 잡는다(ModalContainer). 여기서 h-*를 또 주면
     바깥 높이와 어긋나 바디가 넘치거나 남는다. -->
<BaseModal {title} {closeModal} bodyClass="p-0" bodyScrollable={false}>
  {#snippet body()}
    <!-- iframe이 바디를 꽉 채운다. 결과 화면은 자체 스크롤을 갖고 있어
         바깥에서 또 스크롤을 잡으면 두 겹이 된다(bodyScrollable=false). -->
    <iframe src={url} {title} class="h-full w-full border-0"></iframe>
  {/snippet}
</BaseModal>
