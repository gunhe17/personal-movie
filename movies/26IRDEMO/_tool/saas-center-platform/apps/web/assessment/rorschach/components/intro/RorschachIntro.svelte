<script lang="ts">
  interface Props {
    [key: string]: unknown
  }

  let { ...rest }: Props = $props()
</script>

<div class="flex items-center justify-center p-8 text-gray-500" {...rest}>
  <p>로르샤흐 검사 인트로 (컴포넌트 준비 중)</p>
</div>
