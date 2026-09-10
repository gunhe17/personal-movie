<!--
  촬영용 목 에이전트 컨트롤러 — 화면에 아무것도 그리지 않는다.

  루트 레이아웃에 상주해, 촬영 모드일 때 어느 화면에서든 단축키로 다음 턴을 넘긴다.
  화면 요소가 없으므로 촬영 프레임에 조작 흔적이 남지 않는다.
-->
<script lang="ts">
  import { onMount } from 'svelte'
  import { mockAgent, ADVANCE_KEY } from '$lib/features/agent-mock/store.svelte'

  onMount(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.key !== ADVANCE_KEY || !mockAgent.active) return
      e.preventDefault()
      mockAgent.advance()
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  })
</script>
