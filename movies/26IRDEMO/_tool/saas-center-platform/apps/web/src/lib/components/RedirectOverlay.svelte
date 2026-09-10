<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'

  interface Props {
    to: string
    message?: string
    delay?: number
  }

  let { to, message = '잠시만 기다려주세요...', delay = 800 }: Props = $props()

  let visible = $state(false)

  onMount(() => {
    // 페이드인
    requestAnimationFrame(() => {
      visible = true
    })

    const timer = setTimeout(() => {
      goto(to)
    }, delay)

    return () => clearTimeout(timer)
  })
</script>

<div
  class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-50 transition-opacity duration-300"
  class:opacity-0={!visible}
  class:opacity-100={visible}
>
  <!-- 스피너 -->
  <div class="relative h-10 w-10">
    <div
      class="absolute inset-0 rounded-full border-[3px] border-primary-100"
    ></div>
    <div
      class="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-primary-500"
    ></div>
  </div>

  <!-- 메시지 -->
  <p
    class="mt-5 text-body-02-normal-regular text-gray-500 transition-all delay-150 duration-300"
    class:translate-y-1={!visible}
    class:opacity-0={!visible}
    class:translate-y-0={visible}
    class:opacity-100={visible}
  >
    {message}
  </p>
</div>
