<script lang="ts">
  /**
   * Snackbar — 운영 플랫폼(마인드스코프)과 같은 형태.
   *
   * 타입마다 생김새가 다르다. 성공은 어두운 면에 흰 글자, 나머지는
   * 옅은 색 면에 같은 계열 진한 글자 — 성공이 가장 흔하므로 화면에서
   * 가장 조용하고, 손이 필요한 쪽(실패·경고)이 더 눈에 띈다.
   *
   * 참조 구현은 임의 hex(#ffffff·#34363D)와 off-palette(yellow/blue-50)를
   * 썼고 가이드가 P2 부채로 지목한 것이라, 형태만 가져오고 색은 §2-2의
   * status 토큰으로 옮겼다.
   */
  import { fly, scale } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'
  import { snackbarStore, type SnackbarData } from '$lib/stores/snackbar'
  import CheckCircle from '$lib/assets/icons/CheckCircle.svelte'
  import ErrorCircle from '$lib/assets/icons/ErrorCircle.svelte'
  import WarningCircle from '$lib/assets/icons/WarningCircle.svelte'
  import InfoCircle from '$lib/assets/icons/InfoCircle.svelte'

  let snackbars: SnackbarData[] = $state([])

  snackbarStore.subscribe((value) => {
    snackbars = value
  })

  const ICONS = {
    success: CheckCircle,
    error: ErrorCircle,
    warning: WarningCircle,
    info: InfoCircle
  } as const

  /**
   * surface: 면·테두리 / icon: 아이콘 원 색 / mark: 아이콘 속 획 색
   *
   * mark는 아이콘이 얹히는 면과 같아야 "뚫린" 것처럼 보인다 —
   * success는 어두운 면이라 gray-800, 나머지는 옅은 면이라 흰색.
   */
  const STYLES = {
    success: {
      surface: 'bg-gray-800 border-transparent text-white',
      // 어두운 면 위 파란 원 — 참조 플랫폼과 같은 조합(거긴 #256EF4, 우리 대응은 primary-500).
      // 흰 원으로 두면 배경과 대비만 셀 뿐 '성공'이라는 신호가 사라진다.
      icon: 'text-primary-500',
      mark: '#f1f0f4'
    },
    error: {
      surface: 'bg-white border-status-danger text-status-danger',
      icon: 'text-status-danger',
      mark: '#fff'
    },
    warning: {
      surface: 'bg-status-warning-bg border-status-warning/30 text-orange-800',
      // 참조는 회색 원(#A3A3A3)이지만 여기선 §2-2대로 주황을 쓴다 —
      // 경고를 회색으로 두면 신호 역할을 못 한다.
      // 느낌표는 흰색이면 주황 위에서 2.24:1로 흐리다 → 글자색과 같은 orange-800(3.66:1).
      icon: 'text-status-warning',
      mark: '#754300'
    },
    info: {
      surface: 'bg-status-info-bg border-status-info/30 text-status-blue',
      icon: 'text-status-info',
      mark: '#fff'
    }
  } as const

  type SnackType = keyof typeof STYLES

  const styleOf = (t: string) => STYLES[(t as SnackType) in STYLES ? (t as SnackType) : 'info']
  const iconOf = (t: string) => ICONS[(t as SnackType) in ICONS ? (t as SnackType) : 'info']
</script>

{#if snackbars.length > 0}
  <!--
    §2-6 snackbar(20000) — 항상 최상위. 이전 값은 9999라 락 스크린과 같고
    모달(10000)보다 아래여서, 모달 위에서 띄운 토스트가 가려졌다.
  -->
  <div
    class="pointer-events-none fixed bottom-8 left-1/2 z-snackbar flex -translate-x-1/2 flex-col items-center gap-2"
  >
    {#each snackbars as snackbar (snackbar.id)}
      {#if snackbar.isVisible}
        {@const s = styleOf(snackbar.type)}
        {@const Icon = iconOf(snackbar.type)}
        {@const lines = snackbar.message.split('\n')}
        <div
          class="pointer-events-auto flex max-w-[min(420px,calc(100vw-2rem))] items-center gap-2 rounded-norm border px-4 py-3 shadow-popup {s.surface}"
          in:fly|global={{ y: 20, duration: 600, opacity: 0, easing: quintOut }}
          out:scale|global={{ start: 0.95, duration: 500, opacity: 0, easing: quintOut }}
        >
          <span class="shrink-0 {s.icon}">
            <Icon size={20} markColor={s.mark} />
          </span>

          <!--
            여러 줄이면 첫 줄이 제목 노릇을 한다(참조와 같은 규칙).
            폭은 max-w로 잡고 내용에 맞춘다 — 참조처럼 타입별 고정폭(360/394)을
            두면 한글 길이에 안 맞아 남거나 넘친다.
          -->
          <div class="min-w-0">
            {#each lines as line, i (i)}
              <p
                class="wrap-break-word {i === 0
                  ? 'text-body-02-normal-semibold'
                  : 'text-body-02-reading-regular opacity-90'}"
              >
                {line}
              </p>
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  </div>
{/if}
