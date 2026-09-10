<script lang="ts">
  import { fly, scale } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'
  import { goto } from '$app/navigation'
  import { snackbarStore, type SnackbarData } from '../stores/snackbar'
  import ErrorCircleCloseIcon from '$lib/assets/ErrorCircleCloseIcon.svelte'
  import Warning from '$lib/assets/Warning.svelte'
  import InfoChatIcon from '$lib/assets/InfoChatIcon.svelte'
  import CircleCheckIcon from '$lib/assets/CircleCheckIcon.svelte'
  import CircleCheckBlueIcon from '$lib/assets/CircleCheckBlueIcon.svelte'
  import Typography from '@common/components/Typography.svelte'
  import CheckBlueIcon from '../assets/CheckBlueIcon.svelte'

  $: snackbars = $snackbarStore

  const getIcon = (type: SnackbarData['type']) => {
    switch (type) {
      case 'success':
        return CheckBlueIcon
      case 'error':
        return ErrorCircleCloseIcon
      case 'warning':
        return Warning
      case 'info':
        return InfoChatIcon
      case 'request':
        return CircleCheckBlueIcon
      default:
        return CircleCheckIcon
    }
  }

  const getWidth = (type: SnackbarData['type']) => {
    switch (type) {
      case 'success':
        return 'w-[360px]'
      case 'error':
        return 'w-[394px]'
      case 'warning':
        return 'w-[360px]'
      case 'info':
        return 'w-[360px]'
      case 'request':
        return 'w-[264px]'
      default:
        return 'w-[360px]'
    }
  }

  const getSize = (snackbar: SnackbarData) => {
    if (snackbar.size === 'lg') {
      return {
        width: 'w-[420px]',
        height: 'h-16',
        padding: 'px-5 py-4',
        messageClass: 'leading-relaxed tracking-[0.01em]'
      }
    }
    if (snackbar.size === 'sm') {
      return {
        width: 'w-[320px]',
        height: 'h-12',
        padding: 'px-3 py-2',
        messageClass: 'leading-snug'
      }
    }
    return null
  }

  const getColors = (type: SnackbarData['type']) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-gray-800',
          border: 'border-none',
          icon: 'text-white',
          text: 'text-white'
        }
      case 'error':
        return {
          bg: 'bg-[#ffffff]',
          border: 'border-status-negative',
          icon: 'text-status-danger',
          text: 'text-status-negative'
        }
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: 'text-yellow-500',
          text: 'text-yellow-800'
        }
      case 'info':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: 'text-blue-500',
          text: 'text-blue-800'
        }
      case 'request':
        return {
          bg: 'bg-[#34363D]',
          border: 'border-transparent',
          icon: 'text-blue-500',
          text: 'text-white'
        }
      default:
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          icon: 'text-green-500',
          text: 'text-green-800'
        }
    }
  }

  const handleClose = (id: string) => {
    snackbarStore.hide(id)
  }

  const handleActionClick = async (
    action: { text: string; run: () => void | Promise<void> },
    id: string
  ) => {
    snackbarStore.hide(id)
    await action.run()
  }

  const handleLinkClick = (
    link: {
      text: string
      href: string
    },
    id: string
  ) => {
    snackbarStore.hide(id)
    goto(link.href)
  }
</script>

<!-- 스낵바 컨테이너 -->
{#if snackbars.length > 0}
  <div
    class="fixed bottom-[32px] left-1/2 z-[20000] flex -translate-x-1/2 transform flex-col gap-2"
  >
    {#each snackbars as snackbar (snackbar.id)}
      {#if snackbar.isVisible}
        {@const colors = getColors(snackbar.type)}
        {@const IconComponent = getIcon(snackbar.type)}
        {@const size = getSize(snackbar)}
        {@const width = size?.width ?? getWidth(snackbar.type)}
        {@const hasMultiLine = snackbar.message.includes('\n')}
        {@const height =
          size?.height ??
          (hasMultiLine ? '' : snackbar.type === 'request' ? 'h-12' : 'h-14')}
        {@const padding = size?.padding ?? 'px-4 py-3'}
        {@const messageClass = size?.messageClass ?? ''}
        {@const borderRadius =
          snackbar.type === 'request' ? 'rounded-[8px]' : 'rounded-[10px]'}
        {@const shadow =
          snackbar.type === 'request'
            ? 'shadow-[0_4px_12px_0_rgba(200,200,200,0.05)]'
            : 'shadow-xl'}
        <div
          class="flex items-center justify-between gap-1 border {padding} backdrop-blur-sm {height} {borderRadius} {width} {colors.bg} {colors.border} {shadow}"
          style={snackbar.type !== 'request'
            ? 'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);'
            : ''}
          in:fly|global={{
            y: 20,
            duration: 600,
            opacity: 0,
            easing: quintOut
          }}
          out:scale|global={{
            start: 0.95,
            duration: 500,
            opacity: 0,
            easing: quintOut
          }}
        >
          <div class="flex items-center gap-1.5">
            <!-- 아이콘 -->
            <div class="shrink-0 {colors.icon}">
              <svelte:component this={IconComponent} />
            </div>

            <!-- 메시지 -->
            <div class="flex-1">
              {#if hasMultiLine}
                {#each snackbar.message.split('\n') as line, i}
                  <Typography
                    variant={i === 0 ? 'body-01-semibold' : 'body-02-regular'}
                    color={colors.text}
                    className={`wrap-break-word ${messageClass}`}
                  >
                    {line}
                  </Typography>
                {/each}
              {:else}
                <Typography
                  variant="body-01-semibold"
                  color={colors.text}
                  className={`wrap-break-word ${messageClass}`}
                >
                  {snackbar.message}
                </Typography>
              {/if}
            </div>
          </div>

          {#if snackbar.action}
            {@const action = snackbar.action}
            <!-- 되돌리기 등 그 자리 실행 액션. 링크와 달리 컬러를 메시지와 같은 값으로 둔다
                 — success 스낵바는 배경이 gray-800이라 gray-600 링크색은 거의 안 보인다.
                 대신 불투명도를 70으로 낮춰 메시지(흰색 100)보다 한 단 뒤에 둔다 —
                 색을 바꾸면 타입별 팔레트를 또 하나 만들어야 하지만 알파는 전 타입 공통이다.
                 hover는 100으로 올린다(단조 심화 — 흐려지는 방향 금지). -->
            <button
              class="shrink-0 cursor-pointer opacity-70 transition-opacity hover:opacity-100"
              on:click={() => handleActionClick(action, snackbar.id)}
            >
              <Typography
                variant="label-02-normal-medium"
                color={colors.text}
                className="wrap-break-word underline"
              >
                {action.text}
              </Typography>
            </button>
          {:else if snackbar.link}
            {@const link = snackbar.link}
            <button
              class="shrink-0 cursor-pointer transition-opacity hover:opacity-80"
              on:click={() => handleLinkClick(link, snackbar.id)}
            >
              <Typography
                variant="label-02-normal-medium"
                color="text-gray-600"
                className="wrap-break-word underline hover:text-blue-800"
              >
                {link.text}
              </Typography>
            </button>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}
