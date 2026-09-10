<script lang="ts">
  let { value = $bindable('') } = $props<{ value?: string }>()
</script>

<div>
  <span class="field-label mb-2">
    메모
    <span class="text-body-03-normal-regular text-body-subtle">(선택)</span>
  </span>
  <!-- 여러 줄 입력 = 높이 120(h-30) · 16/150%(body-01-reading) — 전 모달 다수파 규격
       (design-system-guide §form textarea, Web_Design.md §Typography 여러 줄 텍스트) -->
  <textarea
    bind:value
    placeholder="메모를 입력해주세요"
    class="field-input text-body-01-reading-regular h-30 resize-none py-3 text-gray-800"
  ></textarea>
</div>
